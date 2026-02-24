"use client";

// [cl] CesiumJS + Resium 기본 3D 지구본 컴포넌트
// Phase 0: 기본 렌더링 확인용

// [cl] Cesium 정적 에셋 경로 설정 — import 전에 설정해야 함
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

import { useEffect, useRef } from "react";
import { Viewer, Entity, useCesium } from "resium";
import {
  Cartesian3,
  Color,
  SkyBox,
  Math as CesiumMath,
  SingleTileImageryProvider,
  Rectangle,
  SceneTransforms,
  DistanceDisplayCondition,
  VerticalOrigin,
  HorizontalOrigin,
  NearFarScalar,
  Ion,
} from "cesium";

// [cl] Cesium Ion 토큰 설정 — Bing Maps 위성 타일 사용에 필요
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) {
  Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
}
import "cesium/Build/Cesium/Widgets/widgets.css";

// [cl] ESO 은하수 파노라마 큐브맵 (eso0932a, 6000x3000 → 6면 변환)
// Credit: ESO/S. Brunier - https://www.eso.org/public/images/eso0932a/
// 변환: jaxry.github.io/panorama-to-cubemap (Lanczos 보간)
const SKYBOX_SOURCES = {
  positiveX: "/skybox/px.png",
  negativeX: "/skybox/nx.png",
  positiveY: "/skybox/py.png",
  negativeY: "/skybox/ny.png",
  positiveZ: "/skybox/pz.png",
  negativeZ: "/skybox/nz.png",
};

// [cl] Viewer 마운트 후 SkyBox + 자동 자전을 설정하는 내부 컴포넌트
function SceneSetup() {
  const { viewer, scene } = useCesium();
  const lastInteraction = useRef(Date.now());
  const isInteracting = useRef(false);

  // [cl] SkyBox + 기본 지구 텍스처 설정
  useEffect(() => {
    if (!scene || !viewer) return;
    scene.skyBox = new SkyBox({ sources: SKYBOX_SOURCES });
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.globe.showGroundAtmosphere = false;

    // [cl] 기본 타일 색감 보정
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) {
      baseLayer.saturation = 0.7;
      baseLayer.brightness = 1.05;
      baseLayer.contrast = 1.1;
    }

    // [cl] 구름 오버레이
    SingleTileImageryProvider.fromUrl("/textures/clouds_alpha.png", {
      rectangle: Rectangle.MAX_VALUE,
    }).then((cloudProvider) => {
      const cloudLayer = viewer.imageryLayers.addImageryProvider(cloudProvider);
      cloudLayer.alpha = 0.15;
    });
  }, [scene, viewer]);

  // [cl] CSS 대기 글로우: 매 프레임 지구 화면 좌표를 계산해서 방사형 그라데이션 오버레이
  // 확대/축소/회전 모두 추적됨
  useEffect(() => {
    if (!viewer) return;

    const glowEl = document.createElement("div");
    glowEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;";
    viewer.container.appendChild(glowEl);

    // [cl] 그림자 오버레이: 태양이 오른쪽에 있는 것처럼 왼쪽을 약간 어둡게
    const shadowEl = document.createElement("div");
    shadowEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;";
    viewer.container.appendChild(shadowEl);

    let frameId: number;
    const updateGlow = () => {
      // [cl] 지구 중심의 화면 좌표
      const center = SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        Cartesian3.ZERO
      );
      if (center) {
        // [cl] 카메라 거리 → 지구의 화면상 반지름 계산 (CSS 픽셀 기준)
        const distance = Cartesian3.magnitude(viewer.camera.positionWC);
        const globeRadius = 6378137;
        const angularRadius = Math.asin(
          Math.min(globeRadius / distance, 1)
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fovy = (viewer.camera.frustum as any).fovy || 1.0;
        // [cl] clientHeight = CSS 픽셀, canvas.height = 디바이스 픽셀 (Retina 2배)
        const screenRadius =
          (Math.tan(angularRadius) / Math.tan(fovy / 2)) *
          (viewer.canvas.clientHeight / 2);

        // [cl] 대기 글로우
        const glowSize = screenRadius * 2 * 1.75;
        glowEl.style.width = `${glowSize}px`;
        glowEl.style.height = `${glowSize}px`;
        glowEl.style.left = `${center.x - glowSize / 2}px`;
        glowEl.style.top = `${center.y - glowSize / 2}px`;
        glowEl.style.background = `radial-gradient(circle,
          transparent 38%,
          rgba(70, 130, 255, 0.15) 41%,
          rgba(55, 115, 245, 0.10) 50%,
          rgba(40, 100, 230, 0.05) 60%,
          rgba(30, 85, 210, 0.02) 72%,
          transparent 85%
        )`;

        // [cl] 그림자: 지구 크기에 맞춰 왼쪽 어둡게 (태양 = 오른쪽)
        const shadowSize = screenRadius * 2;
        shadowEl.style.width = `${shadowSize}px`;
        shadowEl.style.height = `${shadowSize}px`;
        shadowEl.style.left = `${center.x - shadowSize / 2}px`;
        shadowEl.style.top = `${center.y - shadowSize / 2}px`;
        shadowEl.style.background = `linear-gradient(to right,
          rgba(0, 0, 0, 0.35) 0%,
          rgba(0, 0, 0, 0.22) 20%,
          rgba(0, 0, 0, 0.12) 40%,
          rgba(0, 0, 0, 0.05) 60%,
          transparent 80%
        )`;
      }
      frameId = requestAnimationFrame(updateGlow);
    };
    frameId = requestAnimationFrame(updateGlow);

    return () => {
      cancelAnimationFrame(frameId);
      glowEl.remove();
      shadowEl.remove();
    };
  }, [viewer]);

  // [cl] 자동 자전 + 자전축 복원: 마우스 조작 멈추고 1초 후 서→동 방향 회전
  // 마우스 클릭 시 북극↑ 남극↓ 정위치로 부드럽게 복원
  useEffect(() => {
    if (!viewer) return;

    const canvas = viewer.canvas;

    const onStart = () => {
      isInteracting.current = true;
    };
    const onEnd = () => {
      isInteracting.current = false;
      lastInteraction.current = Date.now();
    };

    canvas.addEventListener("pointerdown", onStart);
    canvas.addEventListener("pointerup", onEnd);
    canvas.addEventListener("pointerleave", onEnd);

    const IDLE_DELAY = 1000;
    const ROTATION_SPEED = 0.05; // [cl] 서→동 자전 (rotateLeft = 동쪽으로)
    const RESTORE_SPEED = 0.03; // [cl] 자전축 복원 속도 (0~1, 클수록 빠름)
    const ROTATION_STOP_DIST = 500_000; // [cl] 이 거리(m) 이하면 자전 정지 (3D 마커 전환 거리와 동일)
    const ROTATION_FADE_DIST = 2_000_000; // [cl] 이 거리부터 서서히 감속 시작

    let frameId: number;
    const spin = () => {
      const elapsed = Date.now() - lastInteraction.current;
      if (!isInteracting.current && elapsed > IDLE_DELAY) {
        // [cl] 카메라 거리에 따른 자전 속도 조절: 가까우면 멈춤, 멀면 정상
        const camDist = Cartesian3.magnitude(viewer.camera.positionWC) - 6378137;
        let speedFactor = 1.0;
        if (camDist < ROTATION_STOP_DIST) {
          speedFactor = 0; // [cl] 500km 이내: 완전 정지
        } else if (camDist < ROTATION_FADE_DIST) {
          // [cl] 500km~2000km: 부드럽게 감속 (0→1 선형 보간)
          speedFactor = (camDist - ROTATION_STOP_DIST) / (ROTATION_FADE_DIST - ROTATION_STOP_DIST);
        }

        // [cl] 서→동 방향 자전 (거리 비례 속도)
        if (speedFactor > 0) {
          viewer.camera.rotateLeft(CesiumMath.toRadians(ROTATION_SPEED * speedFactor));
        }

        // [cl] 자전축 복원: heading→0(북↑), roll→0으로 서서히 보정
        const heading = viewer.camera.heading;
        const roll = viewer.camera.roll;
        const needsHeadingFix = Math.abs(heading) > CesiumMath.toRadians(0.5) && Math.abs(heading) < CesiumMath.toRadians(359.5);
        const needsRollFix = Math.abs(roll) > CesiumMath.toRadians(0.5);

        if (needsHeadingFix || needsRollFix) {
          // [cl] heading을 0 또는 2π 중 가까운 쪽으로 보간
          let newHeading = heading;
          if (needsHeadingFix) {
            if (heading > Math.PI) {
              newHeading = heading + (CesiumMath.TWO_PI - heading) * RESTORE_SPEED;
            } else {
              newHeading = heading * (1 - RESTORE_SPEED);
            }
          }
          const newRoll = needsRollFix ? roll * (1 - RESTORE_SPEED) : 0;

          viewer.camera.setView({
            orientation: {
              heading: newHeading,
              pitch: viewer.camera.pitch,
              roll: newRoll,
            },
          });
        }
      }
      frameId = requestAnimationFrame(spin);
    };
    frameId = requestAnimationFrame(spin);

    return () => {
      canvas.removeEventListener("pointerdown", onStart);
      canvas.removeEventListener("pointerup", onEnd);
      canvas.removeEventListener("pointerleave", onEnd);
      cancelAnimationFrame(frameId);
    };
  }, [viewer]);

  return null;
}

export default function CesiumGlobe() {
  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      homeButton={false}
      geocoder={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      sceneModePicker={false}
      fullscreenButton={false}
      vrButton={false}
      selectionIndicator={false}
      infoBox={false}
    >
      <SceneSetup />

      {/* [cl] 서울 마커 실험: 원거리 = 2D 아이콘(Billboard), 근거리 = 3D 모델 */}

      {/* [cl] 원거리용 2D 박물관 아이콘 (카메라 거리 500km~무한대) */}
      <Entity
        name="Seoul Museum"
        position={Cartesian3.fromDegrees(126.978, 37.5665, 0)}
        billboard={{
          image: "/icons/museum.svg",
          width: 40,
          height: 40,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          distanceDisplayCondition: new DistanceDisplayCondition(500_000, Number.MAX_VALUE),
          scaleByDistance: new NearFarScalar(500_000, 1.0, 15_000_000, 0.4),
        }}
        description="국립중앙박물관 - 서울"
      />

      {/* [cl] 근거리용 3D 프리미티브 (카메라 거리 0~500km) */}
      {/* 시범: CesiumJS 내장 박스로 테스트, 나중에 실제 glTF 모델로 교체 예정 */}
      <Entity
        name="Seoul Museum 3D"
        position={Cartesian3.fromDegrees(126.978, 37.5665, 2000)}
        box={{
          dimensions: new Cartesian3(3000, 3000, 6000),
          material: Color.fromCssColorString("#4ecdc4").withAlpha(0.85),
          outline: true,
          outlineColor: Color.WHITE,
          distanceDisplayCondition: new DistanceDisplayCondition(0, 500_000),
        }}
        description="국립중앙박물관 3D - 서울 (시범)"
      />
    </Viewer>
  );
}
