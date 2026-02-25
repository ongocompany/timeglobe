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
        // [cl] 카메라 경도/위도/높이 공유: 자동 자전(rotateLeft)은 heading이 아닌 longitude를 변경하므로
        // 궤도 회전 동기화에는 longitude가 필요, 위도+높이는 LocationIndicator가 사용
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraLongitude = viewer.camera.positionCartographic.longitude;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraLatitude = viewer.camera.positionCartographic.latitude;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_cameraHeight = viewer.camera.positionCartographic.height;

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

  // [cl] Event Marker: 호버 툴팁 (마커 위 커서 올리면 제목+연도 표시)
  useEffect(() => {
    if (!viewer || !markerMode) return;

    // [cl] 툴팁 HTML 요소 생성 (viewer 컨테이너 안에 절대 위치)
    const tooltipEl = document.createElement("div");
    tooltipEl.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "background:rgba(8,8,18,0.90)",
      "color:#fff",
      "padding:6px 12px",
      "border-radius:8px",
      "font-size:13px",
      "font-weight:600",
      "white-space:nowrap",
      "display:none",
      "z-index:200",
      "border:1px solid rgba(255,255,255,0.13)",
      "backdrop-filter:blur(10px)",
      "letter-spacing:0.02em",
      "box-shadow:0 4px 18px rgba(0,0,0,0.5)",
      "transition:opacity 0.1s",
    ].join(";");
    viewer.container.appendChild(tooltipEl);

    const moveHandler = new ScreenSpaceEventHandler(viewer.canvas);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moveHandler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.endPosition);
      if (defined(picked) && defined(picked.id) && picked.id.id) {
        const ev = eventsRef.current.find((e) => e.id === picked.id.id);
        if (ev) {
          const color = CATEGORY_COLORS[ev.category] || DEFAULT_MARKER_COLOR;
          tooltipEl.innerHTML =
            `<span style="color:${color};margin-right:6px;">●</span>` +
            `${ev.title.ko}` +
            `<span style="color:#999;font-weight:400;margin-left:6px;">${ev.start_year}</span>`;
          tooltipEl.style.display = "block";
          tooltipEl.style.left = `${movement.endPosition.x + 18}px`;
          tooltipEl.style.top = `${movement.endPosition.y - 16}px`;
          viewer.canvas.style.cursor = "pointer";
          return;
        }
      }
      tooltipEl.style.display = "none";
      viewer.canvas.style.cursor = "";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      moveHandler.destroy();
      tooltipEl.remove();
      viewer.canvas.style.cursor = "";
    };
  }, [viewer, markerMode]);

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
      // [cl] ★ resetToDefault 보호: flyTo 진행 중(1초)에는 자전+복원 모두 정지
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resetTs = (window as any).__timeglobe_resetTimestamp || 0;
      const resetProtected = Date.now() - resetTs < 1500;

      // [cl] 마커 포커스 중이면 자전 + 복원 모두 정지
      const markerFocused = markerFocusedRef.current;

      const elapsed = Date.now() - lastInteraction.current;
      if (!isInteracting.current && elapsed > IDLE_DELAY && !resetProtected && !markerFocused) {
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
