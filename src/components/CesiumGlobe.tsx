"use client";

// [cl] CesiumJS + Resium 기본 3D 지구본 컴포넌트
// Phase 0: 기본 렌더링 확인용

// [cl] Cesium 정적 에셋 경로 설정 — import 전에 설정해야 함
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

import { useEffect, useRef } from "react";
import { Viewer, useCesium } from "resium";
import {
  Cartesian3,
  Cartesian2,
  Cartographic,
  SkyBox,
  Math as CesiumMath,
  SingleTileImageryProvider,
  Rectangle,
  SceneTransforms,
  NearFarScalar,
  Ion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from "cesium";
import type { MockEvent } from "@/data/mockEvents";

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

// [cl] 커스텀 조준경 SVG 생성 — DOM 오버레이 방식 (애니메이션 지원)
const RETICLE_BASE_SIZE = 64; // [cl] 기본 크기 (기존 32px × 2)
function makeReticleSvg(color: string, size = RETICLE_BASE_SIZE): string {
  const h = size / 2;
  const r = size * 0.218;  // 원 반지름
  const g = size * 0.09;   // 원과 라인 사이 간격
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.9"/>` +
    `<line x1="${h}" y1="2" x2="${h}" y2="${h - r - g}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>` +
    `<line x1="${h}" y1="${h + r + g}" x2="${h}" y2="${size - 2}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>` +
    `<line x1="2" y1="${h}" x2="${h - r - g}" y2="${h}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>` +
    `<line x1="${h + r + g}" y1="${h}" x2="${size - 2}" y2="${h}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>` +
    `</svg>`
  );
}

// [cl] 카테고리별 글로우 도트 색상 (SF 느낌 네온 톤)
const CATEGORY_COLORS: Record<string, string> = {
  "정치/전쟁": "#FF4444",
  "인물/문화": "#4488FF",
  "과학/발명": "#44CC88",
  "건축/유물": "#FFAA33",
  "자연재해/지질": "#FF8833",
  문화: "#AA55FF",
  지적유산: "#5566FF",
};
const DEFAULT_MARKER_COLOR = "#88AAFF";

// [cl] Canvas API로 글로우 서클 이미지 생성 (카테고리별 캐싱)
const glowImageCache: Record<string, string> = {};
function createGlowImage(color: string, size = 96): string {
  if (glowImageCache[color]) return glowImageCache[color];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.15, color);
  gradient.addColorStop(0.4, color + "80"); // 50% alpha
  gradient.addColorStop(0.7, color + "30"); // 19% alpha
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const dataUrl = canvas.toDataURL();
  glowImageCache[color] = dataUrl;
  return dataUrl;
}

// [cl] 800px 지구 지름에 맞는 카메라 기본 높이 계산
// orbit 진입, resetToDefault, 초기 카메라 모두 이 값을 사용
function calcDefaultHeight(viewer: InstanceType<typeof import("cesium").Viewer>) {
  const TARGET_DIAMETER = 800;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fovy = (viewer.camera.frustum as any).fovy || 1.0;
  const halfHeight = viewer.canvas.clientHeight / 2;
  const tanAngR = (TARGET_DIAMETER / 2) * Math.tan(fovy / 2) / halfHeight;
  const angR = Math.atan(tanAngR);
  const GLOBE_R = 6378137;
  return (GLOBE_R / Math.sin(angR)) - GLOBE_R;
}

// [cl] Viewer 마운트 후 SkyBox + 자동 자전을 설정하는 내부 컴포넌트
interface SceneSetupProps {
  orbitActive: boolean;
  markerMode: boolean;
  events: MockEvent[];
  onMarkerClick?: (event: MockEvent) => void;
}

function SceneSetup({ orbitActive, markerMode, events, onMarkerClick }: SceneSetupProps) {
  const { viewer, scene } = useCesium();
  const lastInteraction = useRef(Date.now());
  const isInteracting = useRef(false);
  // [cl] Orbit 모드 카메라 잠금: flyTo 완료 후 위도/피치/높이 고정
  const lockedOrbitRef = useRef<{ lat: number; pitch: number; height: number } | null>(null);
  // [cl] orbitActive를 ref로 → spin 루프에서 접근 가능 (클로저 갱신 없이)
  const orbitActiveRef = useRef(orbitActive);
  useEffect(() => { orbitActiveRef.current = orbitActive; }, [orbitActive]);
  // [cl] markerMode ref → spin 루프에서 접근
  const markerModeRef = useRef(markerMode);
  useEffect(() => { markerModeRef.current = markerMode; }, [markerMode]);
  // [cl] 마커 포커스 상태: 클릭 후 카메라 이동 → 자전 정지
  const markerFocusedRef = useRef(false);
  // [cl] 마커 호버 상태: 조준경 색상/맥동 제어
  const markerHoverRef = useRef(false);
  // [cl] onMarkerClick ref
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);
  // [cl] events ref
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // [cl] SkyBox + 기본 지구 텍스처 설정
  useEffect(() => {
    if (!scene || !viewer) return;
    scene.skyBox = new SkyBox({ sources: SKYBOX_SOURCES });
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.globe.showGroundAtmosphere = false;

    // [cl] 기본 타일 색감 보정
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) {
      baseLayer.saturation = 1.6;     // [cl] 채도: 바다 파란색 강조
      baseLayer.brightness = 1.5;    // [cl] 밝기: 어두운 바다 살리기
      baseLayer.contrast = 0.9;      // [cl] 대비: 낮춰서 녹색 과포화 방지
      baseLayer.gamma = 1.0;         // [cl] 감마: 원본
    }

    // [cl] 구름 오버레이
    SingleTileImageryProvider.fromUrl("/textures/clouds_alpha.png", {
      rectangle: Rectangle.MAX_VALUE,
    }).then((cloudProvider) => {
      const cloudLayer = viewer.imageryLayers.addImageryProvider(cloudProvider);
      cloudLayer.alpha = 0.15;
    });

    // [cl] ★ 초기 카메라: 적도 + orbit 기본 높이에서 시작
    const initHeight = calcDefaultHeight(viewer);
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(126.978, 0, initHeight),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    });

    // [cl] 지구 초기 타일 로드 완료 → Header/LocationIndicator에 globeReady 신호
    let globeReadyFired = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const removeTileListener = (viewer.scene.globe.tileLoadProgressEvent as any).addEventListener(
      (remaining: number) => {
        if (remaining === 0 && !globeReadyFired) {
          globeReadyFired = true;
          window.dispatchEvent(new CustomEvent("timeglobe:globeReady"));
          removeTileListener();
        }
      }
    );
    return () => {
      try { removeTileListener(); } catch { /* 이미 제거됨 */ }
    };
  }, [scene, viewer]);

  // [cl] CSS 대기 글로우: 매 프레임 지구 화면 좌표를 계산해서 방사형 그라데이션 오버레이
  // 확대/축소/회전 모두 추적됨
  useEffect(() => {
    if (!viewer) return;

    const glowEl = document.createElement("div");
    glowEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;";
    viewer.container.appendChild(glowEl);

    // [cl] 내부 발광 오버레이: 지구가 은은하게 자체 발광하는 효과
    const innerGlowEl = document.createElement("div");
    innerGlowEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;mix-blend-mode:screen;";
    viewer.container.appendChild(innerGlowEl);

    // [cl] 하이라이트 오버레이: 광원 방향(우측 앞)을 실제로 밝게 — screen 블렌드
    const highlightEl = document.createElement("div");
    highlightEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;mix-blend-mode:screen;";
    viewer.container.appendChild(highlightEl);

    // [cl] 그림자 오버레이: 태양이 오른쪽에 있는 것처럼 왼쪽을 약간 어둡게
    const shadowEl = document.createElement("div");
    shadowEl.style.cssText =
      "position:absolute;pointer-events:none;border-radius:50%;will-change:transform;";
    viewer.container.appendChild(shadowEl);

    let frameId: number;
    const updateGlow = () => {
      // [cl] Orbit 모드 카메라 강제 고정: 위도/피치/높이/heading 벗어나면 즉시 복원
      // ★ heading도 0으로 강제 (기존: viewer.camera.heading 유지 → 기울기 고착 버그)
      // ★ resetToDefault 보호 구간(500ms)에는 lock 스킵 — 리셋 setView와 충돌 방지
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resetTsGlow = (window as any).__timeglobe_resetTimestamp || 0;
      const locked = lockedOrbitRef.current;
      if (locked && (Date.now() - resetTsGlow >= 500)) {
        const pos = viewer.camera.positionCartographic;
        const h = viewer.camera.heading;
        const headingOff = h > CesiumMath.toRadians(0.5) && h < CesiumMath.toRadians(359.5);
        if (Math.abs(pos.latitude - locked.lat) > 0.0001 ||
            Math.abs(pos.height - locked.height) > 1 ||
            headingOff) {
          viewer.camera.setView({
            destination: Cartesian3.fromRadians(pos.longitude, locked.lat, locked.height),
            orientation: {
              heading: 0,
              pitch: locked.pitch,
              roll: 0,
            },
          });
        }
      }

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

        // [cl] 지구 화면 상태를 캐러셀 궤도에 공유 (rAF 매 프레임 동기화)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_screenRadius = screenRadius;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_center = { x: center.x, y: center.y };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraPitch = viewer.camera.pitch;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraHeading = viewer.camera.heading;
        // [cl] 카메라 경도/위도/높이 공유
        const camCart = viewer.camera.positionCartographic;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraLongitude = camCart.longitude;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraLatitude = camCart.latitude;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraHeight = camCart.height;

        // [cl] 화면 정중앙 → 지구 표면 좌표 (Dashboard 중심 좌표 표시용)
        try {
          const screenCtr = new Cartesian2(
            viewer.canvas.clientWidth / 2,
            viewer.canvas.clientHeight / 2,
          );
          const centerRay = viewer.camera.getPickRay(screenCtr);
          if (centerRay) {
            const groundPt = viewer.scene.globe.pick(centerRay, viewer.scene);
            if (groundPt) {
              const gc = Cartographic.fromCartesian(groundPt);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__timeglobe_groundLat = gc.latitude;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__timeglobe_groundLng = gc.longitude;
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__timeglobe_groundLat = null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__timeglobe_groundLng = null;
            }
          }
        } catch { /* pick 실패 무시 */ }

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

        // [cl] 내부 발광: 바다(어두운 영역)를 푸른빛으로 살리는 핵심 레이어
        // ★ screen 블렌드: 검은 바다에 파란빛 추가 → "푸른 별" 느낌
        const innerSize = screenRadius * 2;
        innerGlowEl.style.width = `${innerSize}px`;
        innerGlowEl.style.height = `${innerSize}px`;
        innerGlowEl.style.left = `${center.x - innerSize / 2}px`;
        innerGlowEl.style.top = `${center.y - innerSize / 2}px`;
        innerGlowEl.style.background = `radial-gradient(circle,
          rgba(40, 100, 220, 0.35) 0%,
          rgba(35, 90, 200, 0.30) 30%,
          rgba(30, 80, 180, 0.22) 50%,
          rgba(20, 60, 150, 0.10) 70%,
          transparent 85%
        )`;

        // [cl] 하이라이트: 광원 방향(우측 앞)에 밝은 빛 스팟 (screen 블렌드)
        const hlSize = screenRadius * 2;
        highlightEl.style.width = `${hlSize}px`;
        highlightEl.style.height = `${hlSize}px`;
        highlightEl.style.left = `${center.x - hlSize / 2}px`;
        highlightEl.style.top = `${center.y - hlSize / 2}px`;
        highlightEl.style.background = `radial-gradient(circle at 62% 45%,
          rgba(180, 215, 255, 0.30) 0%,
          rgba(140, 190, 250, 0.18) 25%,
          rgba(100, 160, 240, 0.08) 45%,
          transparent 65%
        )`;

        // [cl] 그림자: 광원 = 오른쪽 앞(카메라 기준) → 중앙-우측에 하이라이트, 가장자리+왼쪽 어둡게
        // radial-gradient 중심을 60% 48%로 오프셋 → "오른쪽 앞에서 비추는" 입체 조명
        const shadowSize = screenRadius * 2;
        shadowEl.style.width = `${shadowSize}px`;
        shadowEl.style.height = `${shadowSize}px`;
        shadowEl.style.left = `${center.x - shadowSize / 2}px`;
        shadowEl.style.top = `${center.y - shadowSize / 2}px`;
        shadowEl.style.background = `radial-gradient(circle at 62% 45%,
          transparent 0%,
          transparent 25%,
          rgba(0, 0, 0, 0.04) 40%,
          rgba(0, 0, 0, 0.12) 55%,
          rgba(0, 0, 0, 0.25) 70%,
          rgba(0, 0, 0, 0.38) 90%
        )`;
      }
      frameId = requestAnimationFrame(updateGlow);
    };
    frameId = requestAnimationFrame(updateGlow);

    return () => {
      cancelAnimationFrame(frameId);
      glowEl.remove();
      innerGlowEl.remove();
      highlightEl.remove();
      shadowEl.remove();
    };
  }, [viewer]);

  // [cl] 전역 카메라 리셋 함수: heading→0(북↑), roll→0으로 자전축 즉시 복원
  // ★ setView로 heading/roll 즉시 스냅 (race condition 원천 차단)
  // ★ flyTo는 높이 전환만 담당 (heading은 이미 리셋 완료)
  // orbit 진입, UI 버튼 등 어디서든 호출 가능
  useEffect(() => {
    if (!viewer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_resetToDefault = (options?: {
      height?: number;
      duration?: number;
      onComplete?: () => void;
    }) => {
      // [cl] ★ 보호 플래그: spin loop이 리셋 중 간섭 못 하게
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_resetTimestamp = Date.now();

      const pos = viewer.camera.positionCartographic;
      // [cl] ★ 위도→적도, 높이→기본값으로 flyTo (스케일+기울기 동시 복원)
      const targetHeight = options?.height ?? calcDefaultHeight(viewer);
      viewer.camera.flyTo({
        destination: Cartesian3.fromRadians(
          pos.longitude,  // 경도는 유지
          0,              // ★ 위도 → 0 (적도)
          targetHeight,
        ),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-90), // 위에서 내려다보기
          roll: 0,
        },
        duration: options?.duration ?? 0.8,
        complete: options?.onComplete,
      });
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__timeglobe_resetToDefault;
    };
  }, [viewer]);

  // [cl] Event Orbit 모드: 순차 실행 → ①자전축 리셋 ②800px 줌 ③잠금
  // Event Marker 모드: 줌/틸트/회전 모두 자유
  useEffect(() => {
    if (!viewer) return;
    const controller = viewer.scene.screenSpaceCameraController;

    if (orbitActive) {
      // [cl] orbit 기본 높이 (800px 지구 지름)
      const targetHeight = calcDefaultHeight(viewer);

      // [cl] ①적도 리셋 → ②기본 높이 flyTo → ③완료 후 잠금
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resetFn = (window as any).__timeglobe_resetToDefault;
      if (resetFn) {
        resetFn({
          height: targetHeight,
          duration: 0.8,
          onComplete: () => {
            // [cl] ③ flyTo 완료 후 위도/피치/높이 잠금 → 좌우 회전만 허용
            lockedOrbitRef.current = {
              lat: viewer.camera.positionCartographic.latitude,
              pitch: viewer.camera.pitch,
              height: viewer.camera.positionCartographic.height,
            };
          },
        });
      }

      // [cl] 좌우 회전만 허용: 줌/틸트 잠금
      controller.enableZoom = false;
      controller.enableTilt = false;
    } else {
      // [cl] Marker 모드: 카메라 잠금 해제 + 모든 조작 허용
      lockedOrbitRef.current = null;
      controller.enableZoom = true;
      controller.enableTilt = true;
      controller.minimumZoomDistance = 1;
      controller.maximumZoomDistance = Infinity;
    }
  }, [orbitActive, viewer]);

  // [cl] Event Marker: 글로우 도트 엔티티 동적 생성/제거
  useEffect(() => {
    if (!viewer) return;
    // [cl] 마커 모드 해제 시: 마커 엔티티 제거 + 포커스 해제
    if (!markerMode) {
      events.forEach((ev) => {
        const existing = viewer.entities.getById(ev.id);
        if (existing) viewer.entities.remove(existing);
      });
      markerFocusedRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_markerFocused = false;
      return;
    }

    // [cl] 마커 모드 진입: 글로우 도트 엔티티 생성
    events.forEach((ev) => {
      if (viewer.entities.getById(ev.id)) return; // 중복 방지
      const color = CATEGORY_COLORS[ev.category] || DEFAULT_MARKER_COLOR;
      const glowImage = createGlowImage(color);

      viewer.entities.add({
        id: ev.id,
        name: ev.title.ko,
        position: Cartesian3.fromDegrees(ev.location_lng, ev.location_lat, 0),
        billboard: {
          image: glowImage,
          width: 48,
          height: 48,
          scale: 1.0,
          scaleByDistance: new NearFarScalar(5e5, 1.5, 1.5e7, 0.6),
        },
      });
    });

    return () => {
      // [cl] 클린업: 모든 이벤트 마커 제거
      events.forEach((ev) => {
        const existing = viewer.entities.getById(ev.id);
        if (existing) viewer.entities.remove(existing);
      });
    };
  }, [viewer, markerMode, events]);

  // [cl] Event Marker: 클릭 핸들러 (ScreenSpaceEventHandler)
  useEffect(() => {
    if (!viewer || !markerMode) return;

    const handler = new ScreenSpaceEventHandler(viewer.canvas);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (defined(picked) && defined(picked.id) && picked.id.id) {
        const ev = eventsRef.current.find((e) => e.id === picked.id.id);
        if (ev) {
          // [cl] 카메라 flyTo: 해당 위치로 비스듬히 접근
          viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(ev.location_lng, ev.location_lat, 2_000_000),
            orientation: {
              heading: 0,
              pitch: CesiumMath.toRadians(-45),
              roll: 0,
            },
            duration: 1.5,
          });

          // [cl] 자전 정지 플래그
          markerFocusedRef.current = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__timeglobe_markerFocused = true;

          onMarkerClickRef.current?.(ev);
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [viewer, markerMode]);

  // [cl] Event Marker: 30px 반경 스택 툴팁 (고도 높을수록 다수 → 확대하면 자연 분리)
  // 인/아웃 딜레이로 빠른 커서 이동 시 깜빡임 방지
  useEffect(() => {
    if (!viewer || !markerMode) return;

    const HOVER_RADIUS = 30; // [cl] 스크린 픽셀 반경 (절대값)
    const SHOW_DELAY   = 250; // [cl] 툴팁 표시 딜레이 (ms)
    const HIDE_DELAY   = 450; // [cl] 툴팁 숨김 딜레이 (ms)
    const MAX_DISPLAY  = 5;   // [cl] 최대 표시 항목 수

    const tooltipEl = document.createElement("div");
    tooltipEl.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "background:rgba(8,8,18,0.92)",
      "color:#fff",
      "padding:8px 14px",
      "border-radius:10px",
      "font-size:13px",
      "white-space:nowrap",
      "display:none",
      "z-index:200",
      "border:1px solid rgba(255,255,255,0.13)",
      "backdrop-filter:blur(12px)",
      "letter-spacing:0.02em",
      "box-shadow:0 4px 20px rgba(0,0,0,0.55)",
      "min-width:160px",
    ].join(";");
    viewer.container.appendChild(tooltipEl);

    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingHtml = "";
    let pendingX = 0, pendingY = 0;
    let visible = false; // [cl] style.display 문자열 대신 명시적 상태 추적

    // [cl] Cesium ScreenSpaceEventHandler 대신 DOM addEventListener 사용
    // → 다른 MOUSE_MOVE 핸들러(커서, 좌표추적)와의 충돌 방지
    const handleMouseMove = (e: MouseEvent) => {
      const rect = viewer.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // [cl] 전체 이벤트 → 스크린 좌표 변환 후 반경 30px 이내 필터
      const nearby: { ev: MockEvent; dist: number }[] = [];
      for (const ev of eventsRef.current) {
        const pos3d = Cartesian3.fromDegrees(ev.location_lng, ev.location_lat);
        const sp = SceneTransforms.worldToWindowCoordinates(viewer.scene, pos3d);
        if (!defined(sp)) continue;
        const dist = Math.sqrt((mx - sp.x) ** 2 + (my - sp.y) ** 2);
        if (dist < HOVER_RADIUS) nearby.push({ ev, dist });
      }
      nearby.sort((a, b) => a.dist - b.dist);

      if (nearby.length > 0) {
        // [cl] 스택 툴팁 HTML: 가장 가까운 항목 굵게, 멀수록 투명도 감소
        const shown = nearby.slice(0, MAX_DISPLAY);
        const extra = nearby.length - shown.length;
        const rows = shown.map(({ ev }, i) => {
          const color = CATEGORY_COLORS[ev.category] || DEFAULT_MARKER_COLOR;
          const opacity = Math.max(0.45, 1.0 - i * 0.14);
          return (
            `<div style="display:flex;align-items:center;gap:8px;${i > 0 ? "margin-top:5px;" : ""}opacity:${opacity};">` +
            `<span style="color:${color};font-size:9px;flex-shrink:0;">●</span>` +
            `<span style="font-weight:${i === 0 ? "600" : "400"};flex:1;">${ev.title.ko}</span>` +
            `<span style="color:#777;font-size:11px;margin-left:10px;">${ev.start_year}</span>` +
            `</div>`
          );
        });
        if (extra > 0) {
          rows.push(`<div style="margin-top:6px;color:#555;font-size:11px;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;">+${extra} more</div>`);
        }
        pendingHtml = rows.join("");
        pendingX = mx;
        pendingY = my;

        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

        if (visible) {
          // [cl] 이미 표시 중 → 내용/위치 즉시 갱신
          tooltipEl.innerHTML = pendingHtml;
          tooltipEl.style.left = `${mx + 20}px`;
          tooltipEl.style.top  = `${my - 16}px`;
        } else if (!showTimer) {
          // [cl] 처음 진입 → SHOW_DELAY 후 표시
          showTimer = setTimeout(() => {
            showTimer = null;
            if (pendingHtml) {
              visible = true;
              tooltipEl.innerHTML = pendingHtml;
              tooltipEl.style.left = `${pendingX + 20}px`;
              tooltipEl.style.top  = `${pendingY - 16}px`;
              tooltipEl.style.display = "block";
            }
          }, SHOW_DELAY);
        }

        markerHoverRef.current = true;
      } else {
        // [cl] 반경 밖 → 표시 타이머 취소 + HIDE_DELAY 후 숨김
        pendingHtml = "";
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        markerHoverRef.current = false;

        if (visible && !hideTimer) {
          hideTimer = setTimeout(() => {
            hideTimer = null;
            visible = false;
            tooltipEl.style.display = "none";
          }, HIDE_DELAY);
        }
      }
    };

    viewer.canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      viewer.canvas.removeEventListener("mousemove", handleMouseMove);
      tooltipEl.remove();
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      markerHoverRef.current = false;
    };
  }, [viewer, markerMode]);

  // [cl] 마우스 커서 → 지구 표면 좌표 추적 (항상 활성화, Dashboard 커서 좌표 표시용)
  useEffect(() => {
    if (!viewer) return;
    const handler = new ScreenSpaceEventHandler(viewer.canvas);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler.setInputAction((movement: any) => {
      try {
        const ray = viewer.camera.getPickRay(movement.endPosition);
        if (ray) {
          const groundPt = viewer.scene.globe.pick(ray, viewer.scene);
          if (groundPt) {
            const gc = Cartographic.fromCartesian(groundPt);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__timeglobe_cursorLat = gc.latitude;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__timeglobe_cursorLng = gc.longitude;
            return;
          }
        }
      } catch { /* 무시 */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_cursorLat = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_cursorLng = null;
    }, ScreenSpaceEventType.MOUSE_MOVE);
    return () => handler.destroy();
  }, [viewer]);

  // [cl] 커스텀 조준경 커서: 고도 < 3,000km → 네이티브 커서 숨기고 DOM SVG 커서 표시
  // 기본: 검정 정적 (64px) / 마커 호버: 파랑 + 사인 맥동 (0.7~1.3 스케일)
  useEffect(() => {
    if (!viewer) return;

    const S = RETICLE_BASE_SIZE;
    const PULSE_SPEED = 0.06; // [cl] ~1.7초 주기

    const el = document.createElement("div");
    el.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      `width:${S}px`,
      `height:${S}px`,
      "left:0",
      "top:0",
      "z-index:1000",
      "display:none",
      "will-change:transform",
      "transform-origin:0 0",
    ].join(";");
    el.innerHTML = makeReticleSvg("#111111");
    viewer.container.appendChild(el);

    let mx = 0, my = 0;
    let pulseT = 0;
    let lastHover = false;
    let rafId: number;

    const moveHandler = new ScreenSpaceEventHandler(viewer.canvas);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moveHandler.setInputAction((mv: any) => {
      mx = mv.endPosition.x;
      my = mv.endPosition.y;
    }, ScreenSpaceEventType.MOUSE_MOVE);

    const tick = () => {
      const h = viewer.camera.positionCartographic.height;
      const inZone = h < 3_000_000;
      const hovering = markerHoverRef.current;

      if (inZone) {
        viewer.canvas.style.cursor = "none";
        el.style.display = "block";

        // [cl] 색상 변경은 상태 전환 시에만 (innerHTML 갱신 최소화)
        if (hovering !== lastHover) {
          el.innerHTML = makeReticleSvg(hovering ? "#4488FF" : "#111111");
          lastHover = hovering;
        }

        // [cl] 맥동: 호버 시 scale 0.7~1.3 사인 변화, 비호버 시 scale 1.0
        let scale = 1.0;
        if (hovering) {
          pulseT += PULSE_SPEED;
          scale = 1.0 + 0.3 * Math.sin(pulseT);
        } else {
          pulseT = 0;
        }

        // [cl] transform으로만 위치+스케일 업데이트 (레이아웃 reflow 없음)
        // translate(mx, my) scale(s) translate(-S/2, -S/2) → 커서 중심이 마우스 위치에 고정
        el.style.transform =
          `translate(${mx}px,${my}px) scale(${scale}) translate(-${S / 2}px,-${S / 2}px)`;
      } else {
        if (viewer.canvas.style.cursor === "none") viewer.canvas.style.cursor = "";
        el.style.display = "none";
        pulseT = 0;
        lastHover = false;
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      moveHandler.destroy();
      cancelAnimationFrame(rafId);
      el.remove();
      if (viewer.canvas.style.cursor === "none") viewer.canvas.style.cursor = "";
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
    const ROTATION_STOP_DIST  =  3_000_000; // [cl] 3,000km 이하: 완전 정지
    const ROTATION_FADE_DIST  = 15_000_000; // [cl] 3,000km~15,000km: 선형 가속 → 정상 속도

    let frameId: number;
    const spin = () => {
      // [cl] ★ resetToDefault 보호: flyTo 진행 중(1초)에는 자전+복원 모두 정지
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resetTs = (window as any).__timeglobe_resetTimestamp || 0;
      const resetProtected = Date.now() - resetTs < 1500;

      // [cl] 마커 포커스 중이면 자전 + 복원 모두 정지
      const markerFocused = markerFocusedRef.current;

      const elapsed = Date.now() - lastInteraction.current;
      if (!isInteracting.current && elapsed > IDLE_DELAY && !resetProtected && !markerFocused) {
        // [cl] 고도 기반 자전 속도: 3,000km 이하 정지 → 15,000km 이상 정상 속도
        const camDist = Cartesian3.magnitude(viewer.camera.positionWC) - 6378137;
        let speedFactor = 1.0;
        if (camDist < ROTATION_STOP_DIST) {
          speedFactor = 0;
        } else if (camDist < ROTATION_FADE_DIST) {
          speedFactor = (camDist - ROTATION_STOP_DIST) / (ROTATION_FADE_DIST - ROTATION_STOP_DIST);
        }

        if (speedFactor > 0) {
          const delta = CesiumMath.toRadians(ROTATION_SPEED * speedFactor);
          viewer.camera.rotateLeft(delta);
          // [cl] 자동 자전 누적량 공유 → orbit 반대 회전 계산용
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__timeglobe_autoRotationTotal = ((window as any).__timeglobe_autoRotationTotal || 0) + delta;
        }

        // [cl] 자전축 복원: heading→0(북↑), roll→0으로 서서히 보정
        // ★ orbit 모드에서는 스킵
        if (!orbitActiveRef.current) {
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

// [cl] CesiumGlobe props: orbit + marker 모드
interface CesiumGlobeProps {
  orbitActive?: boolean;
  markerMode?: boolean;
  events?: MockEvent[];
  onMarkerClick?: (event: MockEvent) => void;
}

export default function CesiumGlobe({
  orbitActive = false,
  markerMode = false,
  events = [],
  onMarkerClick,
}: CesiumGlobeProps) {
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
      <SceneSetup
        orbitActive={orbitActive}
        markerMode={markerMode}
        events={events}
        onMarkerClick={onMarkerClick}
      />
    </Viewer>
  );
}
