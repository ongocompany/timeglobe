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
  Color,
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
  DirectionalLight,
  CameraEventType,
  CustomDataSource,
  PolylineGlowMaterialProperty,
  EllipseGraphics,
  ConstantProperty,
} from "cesium";
import type { MockEvent } from "@/data/mockEvents";
import { loadBorderIndex, findClosestSnapshot } from "@/lib/borderIndex";
import type { BorderSnapshot } from "@/lib/borderIndex";

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

// [cl] 카테고리별 글로우 도트 색상 (팔레트: map_marker_color_palettes.scss)
const CATEGORY_COLORS: Record<string, string> = {
  "정치/전쟁":    "#ae2012", // oxidized-iron
  "인물/문화":    "#0a9396", // dark-cyan
  "과학/발명":    "#6a4c93", // purple (custom)
  "건축/유물":    "#ee9b00", // golden-orange
  "자연재해/지질": "#ca6702", // burnt-caramel
  "탐험/발견":    "#2a9d8f", // teal-green
  문화:           "#005f73", // dark-teal
  지적유산:       "#e76f51", // orange
};
const DEFAULT_MARKER_COLOR = "#6a4c93"; // purple (custom)

// [cl] 카테고리별 도형 (의미 없이 시각 구별용)
type ShapeType = "circle" | "square" | "diamond" | "triangle" | "star" | "hexagon" | "cross" | "compass";
const CATEGORY_SHAPE: Record<string, ShapeType> = {
  "정치/전쟁":    "diamond",
  "인물/문화":    "star",
  "과학/발명":    "triangle",
  "건축/유물":    "square",
  "자연재해/지질": "hexagon",
  "탐험/발견":    "compass",
  문화:           "circle",
  지적유산:       "cross",
};

// [cl] 심플 도형 마커 생성 (카테고리 색상 + 글로우 + 기하 도형)
const markerCache: Record<string, string> = {};
function createShapeMarker(category: string, size = 64): string {
  const cacheKey = `shape_${category}`;
  if (markerCache[cacheKey]) return markerCache[cacheKey];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const color = CATEGORY_COLORS[category] || DEFAULT_MARKER_COLOR;
  const shape = CATEGORY_SHAPE[category] || "circle";
  const r = size * 0.25;

  // [cl] 글로우 배경
  const glow = ctx.createRadialGradient(half, half, r * 0.5, half, half, half);
  glow.addColorStop(0, color + "55");
  glow.addColorStop(0.6, color + "18");
  glow.addColorStop(1.0, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // [cl] 도형 그리기
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(half, half, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(half - r * 0.85, half - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "diamond":
      ctx.moveTo(half, half - r);
      ctx.lineTo(half + r, half);
      ctx.lineTo(half, half + r);
      ctx.lineTo(half - r, half);
      break;
    case "triangle":
      ctx.moveTo(half, half - r);
      ctx.lineTo(half + r, half + r * 0.75);
      ctx.lineTo(half - r, half + r * 0.75);
      break;
    case "star": {
      const spikes = 5, outerR = r, innerR = r * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i / spikes) - Math.PI / 2;
        const x = half + Math.cos(angle) * rad;
        const y = half + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      break;
    }
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * i / 3) - Math.PI / 6;
        const x = half + Math.cos(angle) * r;
        const y = half + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      break;
    case "cross": {
      const w = r * 0.4;
      ctx.rect(half - w, half - r, w * 2, r * 2);
      ctx.rect(half - r, half - w, r * 2, w * 2);
      break;
    }
    case "compass": {
      // [cl] 나침반: 4방향 뾰족 별 (◇ 형태이나 날카롭게)
      ctx.moveTo(half, half - r);         // N
      ctx.lineTo(half + r * 0.25, half);
      ctx.lineTo(half, half + r);         // S
      ctx.lineTo(half - r * 0.25, half);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(half - r, half);         // W
      ctx.lineTo(half, half - r * 0.25);
      ctx.lineTo(half + r, half);         // E
      ctx.lineTo(half, half + r * 0.25);
      break;
    }
  }
  ctx.closePath();
  ctx.fill();
  // [cl] 흰색 외곽선
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const url = canvas.toDataURL();
  markerCache[cacheKey] = url;
  return url;
}

// [cl] 마커 이미지 생성
function getMarkerImage(category: string): string {
  return createShapeMarker(category);
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
// [cl] 워프 단계 타입: 카메라 줌아웃 → 홀드(역자전) → 줌인 복귀
type WarpPhase = "idle" | "zoomout" | "hold" | "zoomin";

interface SceneSetupProps {
  orbitActive: boolean;
  orbitPaused: boolean;
  globePaused: boolean;
  globeDirection: "left" | "right";
  markerMode: boolean;
  events: MockEvent[];
  onStackClick?: (events: MockEvent[], pos: { x: number; y: number }) => void;
  warpPhase?: WarpPhase;
  onSpinWarp?: (direction: "past" | "future") => void;
  currentYear: number; // [cl] 역사 국경선 표시용
  visibleTiers?: number[];   // [mk] 표시할 티어 목록 (기본: [1,2,3,4])
  showBorder?: boolean;      // [mk] OHM 국경선 표시 여부 (기본: true)
  popupOpen?: boolean;       // [cl] 캐러셀/팝업 열림 상태 → 툴팁 숨김용
  // [cl] BlurStage 비활성화됨 — 향후 커스텀 셰이더 구현 시 재활용 가능
}

function SceneSetup({ orbitActive, orbitPaused, globePaused, globeDirection, markerMode, events, onStackClick, warpPhase = "idle", onSpinWarp, currentYear, visibleTiers, showBorder, popupOpen = false }: SceneSetupProps) {
  const { viewer, scene } = useCesium();
  const lastInteraction = useRef(Date.now());
  const isInteracting = useRef(false);
  // [cl] Orbit 모드 카메라 잠금: flyTo 완료 후 위도/피치/높이 고정
  const lockedOrbitRef = useRef<{ lat: number; pitch: number; height: number } | null>(null);
  // [cl] orbitActive를 ref로 → spin 루프에서 접근 가능 (클로저 갱신 없이)
  const orbitActiveRef = useRef(orbitActive);
  useEffect(() => { orbitActiveRef.current = orbitActive; }, [orbitActive]);
  // [cl] orbitPaused ref → orbit 캐러셀 전용 정지
  const orbitPausedRef = useRef(orbitPaused);
  useEffect(() => { orbitPausedRef.current = orbitPaused; }, [orbitPaused]);
  // [cl] globePaused ref → 전역 자전 정지 (컨트롤 바 ⏸)
  const globePausedRef = useRef(globePaused);
  useEffect(() => { globePausedRef.current = globePaused; }, [globePaused]);
  // [cl] globeDirection ref → 자전 방향 (left=서→동, right=동→서)
  const globeDirectionRef = useRef(globeDirection);
  useEffect(() => { globeDirectionRef.current = globeDirection; }, [globeDirection]);
  // [cl] markerMode ref → spin 루프에서 접근
  const markerModeRef = useRef(markerMode);
  useEffect(() => { markerModeRef.current = markerMode; }, [markerMode]);
  // [cl] 마커 포커스 상태: 클릭 후 카메라 이동 → 자전 정지
  const markerFocusedRef = useRef(false);
  // [cl] 마커 호버 상태: 조준경 색상/맥동 제어
  const markerHoverRef = useRef(false);
  // [cl] onStackClick ref (단독+스택 공통 콜백)
  const onStackClickRef = useRef(onStackClick);
  useEffect(() => { onStackClickRef.current = onStackClick; }, [onStackClick]);
  // [cl] 캐러셀/팝업 열림 상태 ref (tick에서 툴팁 숨김 판단용)
  const popupOpenRef = useRef(popupOpen);
  useEffect(() => { popupOpenRef.current = popupOpen; }, [popupOpen]);
  // [cl] events ref
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);
  // [cl] 워프 단계 ref: spin 루프에서 즉시 읽기 (클로저 갱신 없이)
  const warpPhaseRef = useRef<WarpPhase>("idle");
  useEffect(() => { warpPhaseRef.current = warpPhase; }, [warpPhase]);
  // [cl] spinWarp 콜백 ref: 빠른 flick 감지 → 랜덤 타임워프
  const onSpinWarpRef = useRef(onSpinWarp);
  useEffect(() => { onSpinWarpRef.current = onSpinWarp; }, [onSpinWarp]);
  // [cl] 워프 스핀 배율: page.tsx rAF 루프에서 매 프레임 주입 (window global 경유)
  const warpSpinMultRef = useRef(0);
  // [cl] 워프 전 카메라 위치: zoomin 복귀 시 사용
  const capturedCameraRef = useRef<{ lon: number; lat: number; alt: number } | null>(null);
  // [cl] 워프 고도 수동 보간 refs: flyTo 대신 spin 루프에서 고도+회전 동시 제어
  const warpAltStartRef = useRef(0);
  const warpAltTargetRef = useRef(0);
  const warpAltStartTimeRef = useRef(0);
  const warpLatStartRef = useRef(0);
  // [cl] SkyBox + 기본 지구 텍스처 설정
  useEffect(() => {
    if (!scene || !viewer) return;
    scene.skyBox = new SkyBox({ sources: SKYBOX_SOURCES });
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.globe.showGroundAtmosphere = false;

    // [cl] 방향성 조명 (기본 밝기)
    scene.light = new DirectionalLight({
      direction: new Cartesian3(0.3, -0.5, -0.7),
      intensity: 2.0,
    });

    // [cl] 우클릭 → 틸트(기울기), 줌은 휠+미들버튼만
    const controller = viewer.scene.screenSpaceCameraController;
    controller.tiltEventTypes = [CameraEventType.RIGHT_DRAG];
    controller.zoomEventTypes = [CameraEventType.MIDDLE_DRAG, CameraEventType.WHEEL, CameraEventType.PINCH];

    // [cl] 지구 내부 진입 방지: 최소 줌 거리 = 지표면에서 500m
    controller.minimumZoomDistance = 500;
    // [cl] 최대 줌 거리: 너무 멀리 빠지지 않게 (5만 km)
    controller.maximumZoomDistance = 50_000_000;

    // [cl] 틸트 각도 제한: 수직(-90°)~수평(-10°) 범위만 허용
    // -90° = 바로 위에서 내려다봄 (기본), -10° = 거의 수평 (지평선 근처)
    controller.minimumCollisionTerrainHeight = 500;

    // [cl] 관성: CesiumJS 기본값 유지 (0.9, 0.9, 0.8)

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
      if (viewer.isDestroyed()) return;
      const cloudLayer = viewer.imageryLayers.addImageryProvider(cloudProvider);
      cloudLayer.alpha = 0.3;
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
      // [cl] Viewer 파괴 후 rAF 잔존 방지
      if (viewer.isDestroyed()) return;
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

    // [cl] 워프용 즉시 카메라 리셋: flyTo 없이 setView → 자전 중단 없음
    // 검정 배경이 가리는 0~500ms 동안 실행되므로 유저 눈에 보이지 않음
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_warpResetCamera = () => {
      if (viewer.isDestroyed()) return;
      const pos = viewer.camera.positionCartographic;
      const targetHeight = calcDefaultHeight(viewer);
      viewer.camera.setView({
        destination: Cartesian3.fromRadians(pos.longitude, 0, targetHeight),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      });
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__timeglobe_resetToDefault;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__timeglobe_warpResetCamera;
    };
  }, [viewer]);

  // [cl] 워프 스핀 배율 외부 주입 창구: page.tsx rAF 루프 → 매 프레임 호출
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_setWarpSpinMult = (mult: number) => {
      warpSpinMultRef.current = mult;
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__timeglobe_setWarpSpinMult;
    };
  }, []);

  // [cl] 워프 배경 제어: page.tsx에서 타이밍별로 호출
  // "black"  → 스카이박스 OFF + 검정 배경 (별만 제거, 지구 유지)
  // "transparent" → 배경 투명 (뒤의 LightSpeed 비침)
  // "normal" → 스카이박스 ON + 검정 배경 (정상 복귀)
  useEffect(() => {
    if (!viewer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_setWarpBackground = (mode: "normal" | "black" | "transparent") => {
      if (viewer.isDestroyed()) return;
      switch (mode) {
        case "black":
          if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
          viewer.scene.backgroundColor = Color.BLACK;
          break;
        case "transparent":
          viewer.scene.backgroundColor = Color.TRANSPARENT;
          break;
        case "normal":
          if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
          viewer.scene.backgroundColor = Color.BLACK;
          break;
      }
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__timeglobe_setWarpBackground;
    };
  }, [viewer]);

  // [cl] 워프 단계 전환: ref 값만 설정 → spin 루프에서 고도 보간 + 회전 동시 처리
  // flyTo 제거: flyTo는 카메라를 매 프레임 덮어쓰므로 rotateRight와 충돌
  useEffect(() => {
    if (!viewer) return;
    if (warpPhase === "zoomout") {
      // [cl] 현재 카메라 위치 저장 + 고도 보간 시작
      const carto = viewer.camera.positionCartographic;
      capturedCameraRef.current = {
        lon: carto.longitude,
        lat: carto.latitude,
        alt: carto.height,
      };
      warpAltStartRef.current = carto.height;
      warpAltTargetRef.current = 70_000_000;
      warpAltStartTimeRef.current = performance.now();
    } else if (warpPhase === "hold") {
      // [cl] 고도 보간 정지 (현재 고도 유지, 회전만)
      warpAltStartTimeRef.current = 0;
    } else if (warpPhase === "zoomin" && capturedCameraRef.current) {
      // [cl] 원위치 복귀 보간 시작
      const carto = viewer.camera.positionCartographic;
      warpAltStartRef.current = carto.height;
      warpAltTargetRef.current = capturedCameraRef.current.alt;
      warpLatStartRef.current = carto.latitude;
      warpAltStartTimeRef.current = performance.now();
    } else if (warpPhase === "idle") {
      warpAltStartTimeRef.current = 0;
      // [cl] 워프 완료 → 정상 자전 즉시 시작 (IDLE_DELAY 스킵)
      lastInteraction.current = 0;
    }
  }, [warpPhase, viewer]);

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
      controller.minimumZoomDistance = 500;      // [cl] 지구 내부 진입 방지 유지
      controller.maximumZoomDistance = 50_000_000;
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

    // [cl] 마커 모드 진입: 도형 마커 엔티티 생성
    const bSize = 24;
    const nearScale = 2.0;
    // [cl] 마커별 랜덤 위상 (heartbeat 비동기화용)
    const phaseMap: Record<string, number> = {};
    events.forEach((ev) => {
      if (viewer.entities.getById(ev.id)) return; // 중복 방지
      const markerImage = getMarkerImage(ev.category);
      phaseMap[ev.id] = Math.random() * Math.PI * 2;

      viewer.entities.add({
        id: ev.id,
        name: ev.title.ko,
        position: Cartesian3.fromDegrees(ev.location_lng, ev.location_lat, 0),
        billboard: {
          image: markerImage,
          width: bSize,
          height: bSize,
          scale: 1.0,
          scaleByDistance: new NearFarScalar(1.5e6, nearScale, 8e6, 1.0),
        },
      });
    });

    // [cl] heartbeat + 랜덤 스핀: 마커별 비동기 펄스 & 가끔 360도 회전
    // 스핀 상태: 각 마커별 { startTime, duration }
    const spinState: Record<string, { start: number; dur: number }> = {};
    const SPIN_INTERVAL = 10_000; // [cl] 평균 10초에 한 번 스핀
    const SPIN_DURATION = 800;    // [cl] 회전 소요 시간 (ms)

    let pulseRaf = 0;
    const pulse = () => {
      const now = performance.now();
      const t = now * 0.002;
      events.forEach((ev) => {
        const entity = viewer.entities.getById(ev.id);
        if (!entity?.billboard) return;
        const phase = phaseMap[ev.id] || 0;

        // [cl] heartbeat
        const s = 1.0 + 0.2 * Math.sin(t + phase);
        entity.billboard.scale = s as unknown as import("cesium").Property;

        // [cl] 랜덤 스핀: 매 프레임 확률 체크 → 약 10초에 한 번 트리거
        const spin = spinState[ev.id];
        if (!spin && Math.random() < 1 / (60 * SPIN_INTERVAL / 1000)) {
          spinState[ev.id] = { start: now, dur: SPIN_DURATION };
        }
        if (spin) {
          const elapsed = now - spin.start;
          if (elapsed < spin.dur) {
            // [cl] easeInOut으로 부드러운 회전
            const p = elapsed / spin.dur;
            const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
            entity.billboard.rotation = (-ease * Math.PI * 2) as unknown as import("cesium").Property;
          } else {
            entity.billboard.rotation = 0 as unknown as import("cesium").Property;
            delete spinState[ev.id];
          }
        }
      });
      pulseRaf = requestAnimationFrame(pulse);
    };
    pulseRaf = requestAnimationFrame(pulse);

    return () => {
      cancelAnimationFrame(pulseRaf);
      // [cl] 클린업: 모든 이벤트 마커 제거 (Viewer 파괴 후 접근 방지)
      if (viewer.isDestroyed()) return;
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
      if (!defined(picked) || !defined(picked?.id) || !picked.id.id) return;

      // [cl] 클릭 위치 30px 반경 내 모든 마커 탐색 (스택 감지)
      const cx = click.position.x, cy = click.position.y;
      const nearbyEvents: MockEvent[] = [];
      for (const ev of eventsRef.current) {
        const pos3d = Cartesian3.fromDegrees(ev.location_lng, ev.location_lat);
        const sp = SceneTransforms.worldToWindowCoordinates(viewer.scene, pos3d);
        if (!defined(sp)) continue;
        if (Math.sqrt((cx - sp.x) ** 2 + (cy - sp.y) ** 2) < 30) nearbyEvents.push(ev);
      }

      const clickPos = { x: cx, y: cy };

      // [cl] 스택(2개 이상): 캐러셀 팝업
      if (nearbyEvents.length > 1) {
        onStackClickRef.current?.(nearbyEvents, clickPos);
        return;
      }

      // [cl] 단독 마커 클릭: 카드 팝업 (바깥 클릭으로만 닫힘)
      const ev = nearbyEvents[0] ?? eventsRef.current.find((e) => e.id === picked.id.id);
      if (!ev) return;

      onStackClickRef.current?.([ev], clickPos);
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [viewer, markerMode]);

  // [cl] Event Marker: 30px 반경 스택 툴팁 / 이미지 팝업 (고도 분기)
  // - 고도 > 1500km: 항상 텍스트 툴팁
  // - 고도 ≤ 1500km + 단독 마커: 이미지 카드 팝업 (3:4, 제목 포함)
  // - 고도 ≤ 1500km + 스택:  텍스트 툴팁 유지
  useEffect(() => {
    if (!viewer || !markerMode) return;

    const HOVER_RADIUS       = 30;
    const SHOW_DELAY         = 0;   // [cl] 딜레이 제거 → CSS 애니메이션으로 대체
    const HIDE_DELAY         = 200; // [cl] 반경 이탈 후 200ms 유예 (마우스 미세이동 깜박임 방지)
    const CONTENT_UPDATE_DELAY = 200;
    const MAX_DISPLAY        = 5;


    // [cl] 툴팁 row 슬라이드인 keyframes (글로벌에 1회만 추가)
    if (!document.getElementById("tg-tooltip-keyframes")) {
      const styleTag = document.createElement("style");
      styleTag.id = "tg-tooltip-keyframes";
      styleTag.textContent = `
        @keyframes tgTooltipRowIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(styleTag);
    }

    // [cl] 텍스트 툴팁: ControlBar와 동일한 글래스모피즘 스타일
    const TEXT_STYLES = [
      "position:absolute", "pointer-events:none", "color:#fff",
      "background:linear-gradient(180deg, rgba(220,218,215,0.10) 0%, rgba(80,80,80,0.06) 100%)",
      "padding:10px 16px", "border-radius:14px", "font-size:13px",
      "white-space:nowrap", "z-index:50",
      "border:1px solid rgba(255,255,255,0.14)",
      "backdrop-filter:blur(12px)", "-webkit-backdrop-filter:blur(12px)",
      "letter-spacing:0.02em",
      "box-shadow:0 0 20px rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
      "min-width:160px",
      "opacity:0", "transition:opacity 0.2s ease",
    ].join(";");

    const tooltipEl = document.createElement("div");
    tooltipEl.style.cssText = TEXT_STYLES;
    viewer.container.appendChild(tooltipEl);

    let inRadius = false;
    let visible = false;
    let enterTime = 0;
    let exitTime = 0;
    let contentChangedTime = 0;
    let currentHtml = "";
    let shownHtml = "";
    let currentX = 0, currentY = 0;
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = viewer.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const now = performance.now();

      const nearby: { ev: MockEvent; dist: number; sx: number; sy: number }[] = [];
      for (const ev of eventsRef.current) {
        const pos3d = Cartesian3.fromDegrees(ev.location_lng, ev.location_lat);
        const sp = SceneTransforms.worldToWindowCoordinates(viewer.scene, pos3d);
        if (!defined(sp)) continue;
        const dist = Math.sqrt((mx - sp.x) ** 2 + (my - sp.y) ** 2);
        if (dist < HOVER_RADIUS) nearby.push({ ev, dist, sx: sp.x, sy: sp.y });
      }
      nearby.sort((a, b) => a.dist - b.dist);

      if (nearby.length > 0) {
        const shown = nearby.slice(0, MAX_DISPLAY);
        const extra = nearby.length - shown.length;
        // [cl] 글래스 툴팁 row: 반투명 배경에 맞춘 밝은 톤
        const rows = shown.map(({ ev }, i) => {
          const color = CATEGORY_COLORS[ev.category] || DEFAULT_MARKER_COLOR;
          const delay = i * 100;
          return (
            `<div style="display:flex;align-items:center;gap:8px;${i > 0 ? "margin-top:6px;" : ""}animation:tgTooltipRowIn 0.3s ease ${delay}ms both;">` +
            `<span style="color:${color};font-size:8px;flex-shrink:0;text-shadow:0 0 6px ${color}40;">●</span>` +
            `<span style="font-weight:${i === 0 ? "600" : "400"};color:rgba(255,255,255,${i === 0 ? "0.95" : "0.75"});flex:1;">${ev.title.ko}</span>` +
            `<span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:10px;">${ev.start_year}</span>` +
            `</div>`
          );
        });
        if (extra > 0) {
          const extraDelay = shown.length * 100;
          rows.push(`<div style="margin-top:7px;color:rgba(255,255,255,0.35);font-size:11px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;animation:tgTooltipRowIn 0.3s ease ${extraDelay}ms both;">+${extra} more</div>`);
        }
        const newHtml = rows.join("");
        currentX = mx; currentY = my;

        if (newHtml !== currentHtml) { currentHtml = newHtml; contentChangedTime = now; }

        if (!inRadius) { inRadius = true; enterTime = now; exitTime = 0; }

        if (visible) {
          tooltipEl.style.left = `${mx + 20}px`;
          tooltipEl.style.top  = `${my - 16}px`;
        }
        markerHoverRef.current = true;
      } else {
        if (currentHtml !== "") { currentHtml = ""; contentChangedTime = now; }
        if (inRadius) { inRadius = false; exitTime = now; enterTime = 0; }
        markerHoverRef.current = false;
      }
    };

    // [cl] rAF 루프: 타임스탬프 비교로 딜레이 판단 + 이미지 팝업 위치 매 프레임 갱신
    const tick = () => {
      // [cl] Viewer 파괴 후 rAF 잔존 방지
      if (viewer.isDestroyed()) return;
      const now = performance.now();

      // [cl] 캐러셀 열려있으면 툴팁 강제 숨김
      if (popupOpenRef.current) {
        if (visible) {
          visible = false; shownHtml = ""; exitTime = 0;
          tooltipEl.style.opacity = "0";
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      // [cl] 표시: 딜레이 없이 즉시 (CSS 슬라이드인 애니메이션이 각 row에 적용됨)
      if (inRadius && !visible && enterTime > 0 && (now - enterTime) >= SHOW_DELAY) {
        if (currentHtml) {
          visible = true; shownHtml = currentHtml;
          tooltipEl.innerHTML = shownHtml;
          tooltipEl.style.left = `${currentX + 20}px`;
          tooltipEl.style.top  = `${currentY - 16}px`;
          tooltipEl.style.opacity = "1";
        }
        enterTime = 0;
      }

      // [cl] 내용 갱신 딜레이
      if (visible && currentHtml !== shownHtml && contentChangedTime > 0 &&
          (now - contentChangedTime) >= CONTENT_UPDATE_DELAY) {
        shownHtml = currentHtml;
        tooltipEl.innerHTML = shownHtml || "";
        contentChangedTime = 0;
      }

      // [cl] 숨김: CSS 페이드아웃 (transition: opacity 0.2s ease)
      if (!inRadius && visible && exitTime > 0 && (now - exitTime) >= HIDE_DELAY) {
        visible = false; shownHtml = ""; exitTime = 0;
        tooltipEl.style.opacity = "0";
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    viewer.canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.canvas.removeEventListener("mousemove", handleMouseMove);
      }
      cancelAnimationFrame(rafId);
      tooltipEl.remove();
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
      // [cl] Viewer 파괴 후 rAF 잔존 방지
      if (viewer.isDestroyed()) return;
      const h = viewer.camera.positionCartographic.height;
      const inZone = h < 3_000_000;
      const hovering = markerHoverRef.current;

      if (inZone) {
        viewer.canvas.style.cursor = "none";
        el.style.display = "block";

        // [cl] 색상 변경은 상태 전환 시에만 (innerHTML 갱신 최소화)
        if (hovering !== lastHover) {
          el.innerHTML = makeReticleSvg(hovering ? "#0a9396" : "#111111");
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
      if (!viewer.isDestroyed() && viewer.canvas.style.cursor === "none") viewer.canvas.style.cursor = "";
    };
  }, [viewer]);

  // [cl] 자동 자전 + 자전축 복원: 마우스 조작 멈추고 1초 후 서→동 방향 회전
  // 마우스 클릭 시 북극↑ 남극↓ 정위치로 부드럽게 복원
  useEffect(() => {
    if (!viewer) return;

    const canvas = viewer.canvas;

    // [cl] ★ 빠른 flick 감지: 드래그 중 커서 위치를 버퍼에 기록 → pointerup 시 속도 계산
    const SPIN_WARP_THRESHOLD = 2500; // [cl] px/sec — 이 속도 이상이면 타임워프 발동
    const SPIN_WARP_COOLDOWN = 10_000; // [cl] ms — 워프 후 10초간 재트리거 방지
    const BUFFER_WINDOW = 300; // [cl] ms — 속도 계산용 최근 샘플 윈도우
    const flickBuffer: { x: number; t: number }[] = [];
    let lastSpinWarpTime = 0;

    const onStart = (e: PointerEvent) => {
      isInteracting.current = true;
      flickBuffer.length = 0;
      flickBuffer.push({ x: e.clientX, t: performance.now() });
    };
    const onMove = (e: PointerEvent) => {
      if (!isInteracting.current) return;
      const now = performance.now();
      flickBuffer.push({ x: e.clientX, t: now });
      // [cl] 오래된 샘플 제거 (300ms 윈도우만 유지)
      while (flickBuffer.length > 1 && now - flickBuffer[0].t > BUFFER_WINDOW) {
        flickBuffer.shift();
      }
    };
    const onEnd = () => {
      isInteracting.current = false;
      lastInteraction.current = Date.now();

      // [cl] flick 속도 판정: 버퍼에서 수평 속도 계산
      if (
        flickBuffer.length >= 2 &&
        warpPhaseRef.current === "idle" &&
        performance.now() - lastSpinWarpTime > SPIN_WARP_COOLDOWN
      ) {
        const first = flickBuffer[0];
        const last = flickBuffer[flickBuffer.length - 1];
        const dt = (last.t - first.t) / 1000; // sec
        if (dt > 0.02) { // [cl] 최소 20ms 이상의 드래그만 판정
          const speed = Math.abs(last.x - first.x) / dt; // px/sec
          if (speed > SPIN_WARP_THRESHOLD) {
            lastSpinWarpTime = performance.now();
            const dir = Math.random() < 0.5 ? "past" : "future";
            onSpinWarpRef.current?.(dir as "past" | "future");
          }
        }
      }
      flickBuffer.length = 0;
    };

    canvas.addEventListener("pointerdown", onStart);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onEnd);
    canvas.addEventListener("pointerleave", onEnd);

    const IDLE_DELAY = 1000;
    const ROTATION_SPEED = 0.05; // [cl] 서→동 자전 (rotateLeft = 동쪽으로)
    const RESTORE_SPEED = 0.03; // [cl] 자전축 복원 속도 (0~1, 클수록 빠름)
    const ROTATION_STOP_DIST  =  3_000_000; // [cl] 3,000km 이하: 완전 정지
    const ROTATION_FADE_DIST  = 15_000_000; // [cl] 3,000km~15,000km: 선형 가속 → 정상 속도

    let frameId: number;
    const spin = () => {
      // [cl] Viewer 파괴 후 rAF 잔존 방지
      if (viewer.isDestroyed()) return;
      const currentWarpPhase = warpPhaseRef.current;

      // [cl] 워프 전체 단계: 수동 고도 보간 + 역방향 회전 동시 처리
      // flyTo 대신 setView → rotateRight가 매 프레임 누적되어 자연스러운 자전
      if (currentWarpPhase === "zoomout" || currentWarpPhase === "hold" || currentWarpPhase === "zoomin") {
        // [cl] ① 고도 보간 (zoomout/zoomin만, hold는 고도 고정)
        if (currentWarpPhase !== "hold" && warpAltStartTimeRef.current > 0) {
          const elapsed = (performance.now() - warpAltStartTimeRef.current) / 1000;
          // [cl] 줌아웃 1.0s / 줌인 1.5s (줌인은 자전 감속과 동기화)
          const dur = currentWarpPhase === "zoomin" ? 1.5 : 1.0;
          const t = Math.min(elapsed / dur, 1);
          const eased = 0.5 - 0.5 * Math.cos(t * Math.PI); // [cl] ease in-out

          const pos = viewer.camera.positionCartographic;
          const newAlt = warpAltStartRef.current + (warpAltTargetRef.current - warpAltStartRef.current) * eased;

          // [cl] zoomin: 위도도 캡처 위치로 보간 복귀
          let newLat = pos.latitude;
          if (currentWarpPhase === "zoomin" && capturedCameraRef.current) {
            newLat = warpLatStartRef.current + (capturedCameraRef.current.lat - warpLatStartRef.current) * eased;
          }

          viewer.camera.setView({
            destination: Cartesian3.fromRadians(pos.longitude, newLat, newAlt),
            orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
          });
        }

        // [cl] ② 순방향 자전: 최소 1배(정상 속도) 보장 → 출발/도착 시 멈춤 없이 연속 자전
        const spinMult = Math.max(warpSpinMultRef.current, 1);
        const delta = CesiumMath.toRadians(ROTATION_SPEED * spinMult);
        if (globeDirectionRef.current !== "right") {
          viewer.camera.rotateLeft(delta);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__timeglobe_autoRotationTotal = ((window as any).__timeglobe_autoRotationTotal || 0) + delta;
        } else {
          viewer.camera.rotateRight(delta);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__timeglobe_autoRotationTotal = ((window as any).__timeglobe_autoRotationTotal || 0) - delta;
        }

        frameId = requestAnimationFrame(spin);
        return;
      }

      // [cl] ★ resetToDefault 보호: flyTo 진행 중(1초)에는 자전+복원 모두 정지
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resetTs = (window as any).__timeglobe_resetTimestamp || 0;
      const resetProtected = Date.now() - resetTs < 1500;

      // [cl] 마커 포커스 중이면 자전 + 복원 모두 정지
      const markerFocused = markerFocusedRef.current;

      const elapsed = Date.now() - lastInteraction.current;
      // [cl] 자전 정지 조건: 전역 일시정지 OR (orbit 캐러셀 전용 정지)
      const shouldStopRotation = globePausedRef.current
        || (orbitActiveRef.current && orbitPausedRef.current);
      if (!isInteracting.current && elapsed > IDLE_DELAY && !resetProtected && !markerFocused && !shouldStopRotation) {
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
          // [cl] 방향에 따라 rotateLeft/Right 선택, autoRotationTotal 부호도 맞춤
          if (globeDirectionRef.current !== "right") {
            viewer.camera.rotateLeft(delta);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__timeglobe_autoRotationTotal = ((window as any).__timeglobe_autoRotationTotal || 0) + delta;
          } else {
            viewer.camera.rotateRight(delta);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__timeglobe_autoRotationTotal = ((window as any).__timeglobe_autoRotationTotal || 0) - delta;
          }
        }

        // [cl] 자전축 복원: heading→0(북↑), roll→0으로 서서히 보정
        // ★ orbit 모드에서는 스킵
        // ★ 기울어진 상태(pitch > -80°)에서는 스킵 — 기울기 중 heading 복원이
        //   한 방향으로만 회전하면서 360° 휙 도는 문제 방지
        const pitch = viewer.camera.pitch;
        if (!orbitActiveRef.current && pitch < CesiumMath.toRadians(-80)) {
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
                pitch,
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
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onEnd);
      canvas.removeEventListener("pointerleave", onEnd);
      cancelAnimationFrame(frameId);
    };
  }, [viewer]);

  // ── [cl] 역사 국경선 — GeoJSON → Polyline 직접 변환 ──────────
  // CesiumJS의 PolygonGeometry/PolygonOutlineGeometry가 복잡한 폴리곤에서 크래시
  // → Polygon 엔티티를 완전히 우회, 좌표만 추출해서 Polyline으로 렌더링
  const borderIndexRef = useRef<BorderSnapshot[] | null>(null);
  const borderDsRef = useRef<InstanceType<typeof CustomDataSource> | null>(null);
  const currentBorderFileRef = useRef<string | null>(null);
  const borderLoadingRef = useRef(false);

  // [cl] Douglas-Peucker 폴리라인 단순화 — 데이터 소스별 복잡도 차이 균일화
  // tolerance: 도(degree) 단위 허용 오차 (0.05° ≈ 5.5km)
  const SIMPLIFY_TOLERANCE = 0.05;
  function simplifyRing(coords: [number, number][]): [number, number][] {
    if (coords.length <= 3) return coords;
    // [cl] Douglas-Peucker: 시작/끝 잇는 직선에서 가장 먼 점이 tolerance 이내면 중간 점 제거
    function perpendicularDist(p: [number, number], a: [number, number], b: [number, number]): number {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
      return Math.sqrt((p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2);
    }
    function dp(pts: [number, number][], tol: number): [number, number][] {
      if (pts.length <= 2) return pts;
      let maxDist = 0, maxIdx = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = perpendicularDist(pts[i], pts[0], pts[pts.length - 1]);
        if (d > maxDist) { maxDist = d; maxIdx = i; }
      }
      if (maxDist > tol) {
        const left = dp(pts.slice(0, maxIdx + 1), tol);
        const right = dp(pts.slice(maxIdx), tol);
        return left.slice(0, -1).concat(right);
      }
      return [pts[0], pts[pts.length - 1]];
    }
    return dp(coords, SIMPLIFY_TOLERANCE);
  }

  // [cl] GeoJSON Feature에서 폴리곤 링 좌표 추출 → 단순화 → Cartesian3 배열
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractRings(geometry: any): Cartesian3[][] {
    const rings: Cartesian3[][] = [];
    if (!geometry) return rings;

    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        const simplified = simplifyRing(ring);
        rings.push(simplified.map(([lng, lat]: [number, number]) => Cartesian3.fromDegrees(lng, lat)));
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          const simplified = simplifyRing(ring);
          rings.push(simplified.map(([lng, lat]: [number, number]) => Cartesian3.fromDegrees(lng, lat)));
        }
      }
    }
    return rings;
  }

  // [cl] 외곽 링만 추출 (국경선용 — 내부 hole 링 제외) + 단순화
  // Polygon: coordinates[0]만, MultiPolygon: 각 polygon의 [0]만
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractOuterRings(geometry: any): Cartesian3[][] {
    const rings: Cartesian3[][] = [];
    if (!geometry) return rings;

    if (geometry.type === "Polygon") {
      if (geometry.coordinates.length > 0) {
        const simplified = simplifyRing(geometry.coordinates[0]);
        rings.push(simplified.map(([lng, lat]: [number, number]) => Cartesian3.fromDegrees(lng, lat)));
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (polygon.length > 0) {
          const simplified = simplifyRing(polygon[0]);
          rings.push(simplified.map(([lng, lat]: [number, number]) => Cartesian3.fromDegrees(lng, lat)));
        }
      }
    }
    return rings;
  }

  // [cl] 폴리곤 외곽 링의 무게중심(centroid) 계산 (라벨 위치용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function calcCentroid(geometry: any): [number, number] | null {
    let coords: number[][] = [];
    if (geometry.type === "Polygon") {
      coords = geometry.coordinates[0]; // 외곽 링만
    } else if (geometry.type === "MultiPolygon") {
      // 가장 큰 폴리곤의 외곽 링 사용
      let maxLen = 0;
      for (const poly of geometry.coordinates) {
        if (poly[0].length > maxLen) {
          maxLen = poly[0].length;
          coords = poly[0];
        }
      }
    }
    if (coords.length === 0) return null;
    let sumLng = 0, sumLat = 0;
    for (const [lng, lat] of coords) {
      sumLng += lng;
      sumLat += lat;
    }
    return [sumLng / coords.length, sumLat / coords.length];
  }

  // [cl] 메타데이터 캐시 (연도별 한 번만 fetch)
  const metadataCacheRef = useRef<Record<number, Record<string, BorderMetadata>>>({});

  // [cl] Wikidata 원형 렌더링용 엔티티 (1886 이전, GeoJSON 대체)
  interface WikidataCircleEntry {
    name_en: string;
    name_ko: string;
    lon: number;
    lat: number;
    start_year: number;
    end_year: number;
    lineage_id: string | null;
    color: string;           // HSL 기반 공간 해싱 색상
    qid: string;
    tier: number | null;     // [cl] Tier 등급 (1~4, null=미분류)
  }
  const wikidataCirclesRef = useRef<WikidataCircleEntry[] | null>(null);
  const circleDsRef = useRef<InstanceType<typeof CustomDataSource> | null>(null);

  // [cl] OHM(OpenHistoricalMap) 폴리곤 렌더링 — 실제 역사 국경선 (1886 이전)
  interface OhmSnapshot { rid: number; start: number | null; end: number | null }
  interface OhmEntity {
    qid: string; name_en: string; name_ko: string; tier: number;
    start_year: number | null; end_year: number | null;
    snapshots: OhmSnapshot[];
  }
  const ohmIndexRef = useRef<OhmEntity[] | null>(null);
  const ohmDsRef = useRef<InstanceType<typeof CustomDataSource> | null>(null);
  // [cl] OHM GeoJSON 캐시: rid → geojson (개별 파일 캐싱, 재 fetch 방지)
  const ohmGeojsonCacheRef = useRef<Map<number, unknown>>(new Map());
  // [cl] 현재 로드된 OHM 연도 (불필요한 재렌더 방지)
  const currentOhmYearRef = useRef<number | null>(null);
  // [cl] OHM 매칭된 QID set (원형 렌더링에서 제외용) — CShapes 매칭 QID도 포함
  const ohmQidsRef = useRef<Set<string>>(new Set());
  const ohmNamesRef = useRef<Set<string>>(new Set());

  // [cl] CShapes 폴리곤 연동 — 1886+ 현대국가 중 OHM 없는 T1/T2에 폴리곤 제공 (라벨 없음!)
  interface CshapesQidEntry {
    qid: string; cshapes_name: string; tier: number;
    start_year: number; end_year: number; cshapes_years: number[];
  }
  const cshapesQidIndexRef = useRef<CshapesQidEntry[] | null>(null);
  // [cl] CShapes 연도별 GeoJSON 캐시: year → { features: [...] }
  const cshapesGeojsonCacheRef = useRef<Map<number, unknown>>(new Map());
  // [mk] T1/T2 경계선 엔티티 목록 — 고도 변화 시 width/show 업데이트
  const t1BorderEntitiesRef = useRef<import("cesium").Entity[]>([]);
  const t2BorderEntitiesRef = useRef<import("cesium").Entity[]>([]); // [cl] T2: 1.5만km+ 에서만 표시
  const lastT1WidthRef = useRef<number>(1.5);   // [cl] T1 고정 1.5px (고도 반응 비활성화)
  const lastT2VisibleRef = useRef<boolean>(true); // [cl] T2 초기 가시 상태
  // [mk] 지도 표시 설정 refs (prop 변경 시 렌더 함수에서 즉시 반영)
  const visibleTiersRef = useRef<number[]>(visibleTiers ?? [1, 2, 3, 4]);
  const showBorderRef = useRef<boolean>(showBorder ?? true);

  // [cl] ★ Tier별 라벨 스타일 — 고도(카메라 거리) 기반 노출 전략
  // T1: 대제국 (로마, 당, 오스만) — 항상 크게 보임
  // T2: 주요국 (고려, 비잔틴) — 중간 거리부터
  // T3: 일반국 — 가까이서
  // T4: 소국/부족 — 매우 가까이서
  interface TierLabelStyle {
    font: string;
    scale: NearFarScalar;       // 거리별 크기 배율
    translucency: NearFarScalar; // 거리별 투명도
  }
  // [cl] ★ 선명도 트릭: 폰트를 2배로 렌더링 → scale 절반 → 텍스처 해상도 2배
  // CesiumJS Label은 Canvas2D→텍스처 변환이라 Retina에서 흐려짐, 이걸로 해결
  const TIER_LABEL_STYLES: Record<number, TierLabelStyle> = {
    1: {
      font: "bold 48px sans-serif",                            // 실효 ~24px
      scale: new NearFarScalar(2e6, 0.6, 2e7, 0.3),
      translucency: new NearFarScalar(5e6, 1.0, 3e7, 0.3),   // 멀어도 30% 유지
    },
    2: {
      font: "bold 38px sans-serif",                            // 실효 ~19px
      scale: new NearFarScalar(2e6, 0.55, 2e7, 0.275),        // [cl] T1과 같은 far(20,000km), 비율 유지
      translucency: new NearFarScalar(5e6, 1.0, 3e7, 0.3),   // [cl] T1과 동일 → 20,000km+에서도 보임
    },
    3: {
      font: "bold 32px sans-serif",                            // 실효 ~16px
      scale: new NearFarScalar(1e6, 0.55, 1e7, 0.2),
      translucency: new NearFarScalar(2e6, 1.0, 1e7, 0),     // 10,000km에서 사라짐
    },
    4: {
      font: "bold 28px sans-serif",                            // 실효 ~14px
      scale: new NearFarScalar(5e5, 0.55, 5e6, 0.2),
      translucency: new NearFarScalar(1e6, 1.0, 5e6, 0),     // 5,000km에서 사라짐
    },
  };
  // [cl] 기본 스타일 (tier 미지정 시 T3 취급)
  const DEFAULT_LABEL_STYLE = TIER_LABEL_STYLES[3];

  function getLabelStyle(tier: number | null | undefined): TierLabelStyle {
    // [cl] Tier별 차등 크기 적용 (T1 가장 크게 → T4 가장 작게)
    if (tier && TIER_LABEL_STYLES[tier]) return TIER_LABEL_STYLES[tier];
    return DEFAULT_LABEL_STYLE; // tier 미지정 → T3 취급
  }

  // [cl] 메타데이터 타입 정의
  interface BorderMetadata {
    display_name: string;
    display_name_en: string;
    display_name_local: string;
    display_name_ko?: string;       // [cl] 한국어 국명
    is_colony: boolean;
    fill_color: string;
    confidence: string;
    tier?: number;                  // [cl] 1=제국/왕국, 2=일반국가, 3=부족/문화
    colonial_ruler?: string;
    colonial_ruler_ko?: string;     // [cl] 식민지 지배국명 한국어
    colonial_note?: string;
    independence_year?: number;
    capital_coords?: [number, number]; // [cl] 수도 좌표 (라벨 위치)
  }

  // [cl] 스냅샷 연도에 해당하는 메타데이터 로드
  // 메타데이터 파일이 있으면 정확히 로드, 없으면 가장 가까운 연도 폴백
  async function loadMetadata(snapYear: number): Promise<Record<string, BorderMetadata> | null> {
    if (metadataCacheRef.current[snapYear]) return metadataCacheRef.current[snapYear];
    // [cl] 모든 스냅샷 연도(BC~AD 2015)에 대해 메타데이터 존재 (음수 연도 포함)
    try {
      const res = await fetch(`/geo/borders/metadata/${snapYear}.json`, { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        metadataCacheRef.current[snapYear] = data;
        return data;
      }
    } catch { /* 파일 없음 */ }
    return null;
  }

  // [cl] GeoJSON fetch → CustomDataSource (BP 기반 분기 렌더링 + 메타데이터 라벨)
  // BORDERPRECISION: 1=근사치(블러), 2=중간(점선), 3=확정(실선)
  async function loadBordersAsPolylines(url: string, snapYear: number): Promise<{ ds: InstanceType<typeof CustomDataSource>; bp1Ratio: number }> {
    const res = await fetch(url);
    const geojson = await res.json();
    const ds = new CustomDataSource("borders");
    const defaultBorderColor = Color.fromCssColorString("rgba(255, 255, 255, 0.3)");

    // [cl] CShapes 파일 여부 (caplong/caplat 사용 가능)
    const isCShapes = url.includes("cshapes_");

    // [cl] 메타데이터 로드 (1880+ 있으면 색상+현지이름, 없으면 GeoJSON NAME 그대로)
    const metadata = await loadMetadata(snapYear);

    // [cl] 라벨은 entity_timeline.json 기반으로 별도 렌더링 (loadBordersAsPolylines에서 제거됨)

    // [cl] BP=1 비율 집계 (블러 강도 결정용)
    let bp1Count = 0;
    let totalCount = 0;

    for (const feature of geojson.features) {
      const name = feature.properties?.NAME;
      // [cl] NAME 없는 feature는 렌더링 스킵 (HB 원본 데이터에 이름 없는 영역)
      if (!name) continue;
      const meta = name && metadata ? metadata[name] : null;
      // [cl] BORDERPRECISION 읽기: CShapes는 항상 3(확정), HB는 필드값 (없으면 1=근사치)
      const bp: number = isCShapes ? 3 : (feature.properties?.BORDERPRECISION ?? 1);
      totalCount++;
      if (bp <= 1) bp1Count++;

      // [cl] 메타데이터 있으면 문명권 색상, 없으면 기본 흰색
      const lineColor = meta
        ? Color.fromCssColorString(meta.fill_color).withAlpha(0.45)
        : defaultBorderColor;

      // ── [cl] BP 값에 따른 렌더링 분기 ──
      if (bp <= 1) {
        // [cl] BP=1 (근사치): 넓은 글로우 — "시간의 안개" 국경 불확실 표현
        // glowPower 1.0 = 선 전체가 그라데이션 (중심 밝음 → 가장자리 투명)
        const rings = extractRings(feature.geometry);
        for (const positions of rings) {
          if (positions.length < 2) continue;
          ds.entities.add({
            polyline: {
              positions,
              width: 12,
              material: new PolylineGlowMaterialProperty({
                glowPower: 1.0,
                color: lineColor.withAlpha(0.4),
              }),
            },
          });
        }
      } else if (bp === 2) {
        // [cl] BP=2 (중간): 중간 글로우 — 경계 존재하나 불확실
        const rings = extractRings(feature.geometry);
        for (const positions of rings) {
          if (positions.length < 2) continue;
          ds.entities.add({
            polyline: {
              positions,
              width: 8,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.8,
                color: lineColor.withAlpha(0.5),
              }),
            },
          });
        }
      } else {
        // [cl] BP=3 (확정 국경): 약한 글로우로 부드러운 실선
        const rings = extractRings(feature.geometry);
        for (const positions of rings) {
          if (positions.length < 2) continue;
          ds.entities.add({
            polyline: {
              positions,
              width: 4,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.3,
                color: lineColor.withAlpha(0.7),
              }),
            },
          });
        }
      }

      // [cl] 라벨은 entity_timeline.json 기반 별도 렌더링으로 이관됨 (renderLabelsForYear)
    }

    const bp1Ratio = totalCount > 0 ? bp1Count / totalCount : 0;
    return { ds, bp1Ratio };
  }

  // [cl] ★ Wikidata 원형 데이터 로드 (1회)
  const CSHAPES_START_YEAR = 1886;
  async function loadWikidataCircles(): Promise<WikidataCircleEntry[]> {
    if (wikidataCirclesRef.current) return wikidataCirclesRef.current;
    const res = await fetch("/geo/borders/wikidata_circles.json");
    const data: WikidataCircleEntry[] = await res.json();
    wikidataCirclesRef.current = data;
    return data;
  }

  // [cl] ★ 연도 기반 원형+라벨 렌더링 (전 구간 — 라벨은 우리 데이터 통일)
  function renderCirclesForYear(targetYear: number) {
    if (!viewer || viewer.isDestroyed() || !wikidataCirclesRef.current) return;

    // 기존 DataSource 제거
    if (circleDsRef.current) {
      viewer.dataSources.remove(circleDsRef.current, true);
      circleDsRef.current = null;
    }

    const ds = new CustomDataSource("wikidata-circles");
    const circles = wikidataCirclesRef.current;
    const RADIUS = 50000; // 50km

    // [cl] 해당 연도에 활성화된 엔티티 필터링
    const activeEntities = circles.filter(
      (e: WikidataCircleEntry) => e.start_year <= targetYear && e.end_year >= targetYear
    );

    // [cl] 좌표 중복 제거: 30km 이내 같은 위치에 여러 라벨 → 최고 tier만 표시
    // Haversine 대신 간이 거리 (적도 기준 1도≈111km, 30km≈0.27도)
    const DEG_THRESHOLD = 0.27;
    const shown = new Set<number>(); // 이미 표시된 엔티티 인덱스
    const suppressed = new Set<number>(); // 억제된 인덱스

    for (let i = 0; i < activeEntities.length; i++) {
      if (suppressed.has(i)) continue;
      const a = activeEntities[i];
      const aTier = a.tier ?? 5;

      for (let j = i + 1; j < activeEntities.length; j++) {
        if (suppressed.has(j)) continue;
        const b = activeEntities[j];
        const bTier = b.tier ?? 5;

        const dLat = Math.abs(a.lat - b.lat);
        const dLon = Math.abs(a.lon - b.lon);
        if (dLat > DEG_THRESHOLD || dLon > DEG_THRESHOLD) continue;

        // 더 낮은 tier(숫자 큰 쪽) 억제
        if (aTier <= bTier) {
          suppressed.add(j);
        } else {
          suppressed.add(i);
          break; // i가 억제됐으므로 i 루프 탈출
        }
      }
    }

    // [cl] 라벨 렌더링 (억제되지 않은 엔티티만)
    for (let i = 0; i < activeEntities.length; i++) {
      if (suppressed.has(i)) continue;
      const entity = activeEntities[i];

      // [mk] 티어 필터: 비활성 티어는 라벨 숨김 (기본: 전체 표시)
      const entityTier = entity.tier ?? 3;
      if (!visibleTiersRef.current.includes(entityTier)) continue;

      const position = Cartesian3.fromDegrees(entity.lon, entity.lat);

      // ── 라벨 텍스트: 한글명 우선, 없으면 영문 ──
      const koName = entity.name_ko || entity.name_en;
      const enName = entity.name_en;
      let labelText = koName;
      if (koName !== enName && !/^[A-Za-z\s\-'().]+$/.test(koName)) {
        labelText += `\n${enName}`;
      }

      const style = getLabelStyle(entity.tier);

      // [cl] 원형(ellipse) 제거 — 라벨만 표시 (진형 결정 2026-03-02)
      ds.entities.add({
        position,
        label: {
          text: labelText,
          font: style.font,
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 4,
          style: 2, // FILL_AND_OUTLINE
          pixelOffset: new Cartesian2(0, 0),
          scaleByDistance: style.scale,
          translucencyByDistance: style.translucency,
        },
      });
    }

    viewer.dataSources.add(ds);
    circleDsRef.current = ds;
  }

  // [cl] ★ OHM 인덱스 로드 (1회)
  async function loadOhmIndex(): Promise<OhmEntity[]> {
    if (ohmIndexRef.current) return ohmIndexRef.current;
    const res = await fetch("/geo/borders/ohm_index.json");
    const data: OhmEntity[] = await res.json();
    ohmIndexRef.current = data;
    // [cl] OHM 매칭된 QID + name_en 목록 (원형 렌더링 시 이 엔티티 원형 제외)
    const qids = new Set<string>();
    const names = new Set<string>();
    for (const e of data) {
      qids.add(e.qid);
      if (e.name_en) names.add(e.name_en.toLowerCase());
    }
    ohmQidsRef.current = qids;
    ohmNamesRef.current = names;
    return data;
  }

  // [cl] ★ CShapes QID 인덱스 로드 (1회) — 1886+ 현대국가 폴리곤 매핑
  async function loadCshapesQidIndex(): Promise<CshapesQidEntry[]> {
    if (cshapesQidIndexRef.current) return cshapesQidIndexRef.current;
    const res = await fetch("/geo/borders/cshapes_qid_index.json");
    const data: CshapesQidEntry[] = await res.json();
    cshapesQidIndexRef.current = data;
    // [cl] CShapes 매칭 QID도 ohmQidsRef에 추가 → 원형 렌더링에서 제외 (폴리곤으로 대체)
    for (const e of data) {
      ohmQidsRef.current.add(e.qid);
    }
    return data;
  }

  // [cl] CShapes 연도별 GeoJSON에서 특정 국가 feature 추출 (폴리곤만, 라벨 절대 없음)
  async function fetchCshapesFeature(year: number, cshapesName: string): Promise<unknown | null> {
    // [cl] 캐시 확인
    if (!cshapesGeojsonCacheRef.current.has(year)) {
      try {
        const res = await fetch(`/geo/borders/cshapes_${year}.geojson`);
        if (!res.ok) return null;
        const geojson = await res.json();
        cshapesGeojsonCacheRef.current.set(year, geojson);
      } catch { return null; }
    }
    const geojson = cshapesGeojsonCacheRef.current.get(year) as { features?: Array<{ properties?: { NAME?: string }; geometry: unknown }> } | undefined;
    if (!geojson?.features) return null;
    // [cl] NAME 매칭으로 해당 국가 feature 찾기
    const feature = geojson.features.find(f => f.properties?.NAME === cshapesName);
    return feature || null;
  }

  // [cl] ★ OHM 폴리곤 렌더링 — 특정 연도에 존재하는 엔티티의 실제 국경선
  // 전략: 각 엔티티별 "가장 적합한 스냅샷" 1개 선택 → fetch → polyline 렌더링
  async function renderOhmForYear(targetYear: number) {
    if (!viewer || viewer.isDestroyed() || !ohmIndexRef.current) return;

    // [cl] OHM은 전 구간 렌더링 (CShapes 구간에서도 OHM 폴리곤 있으면 표시)

    // [cl] 같은 연도면 재렌더 스킵
    if (currentOhmYearRef.current === targetYear && ohmDsRef.current) return;

    // [cl] 재렌더 시 T1/T2 엔티티 목록 초기화 (DataSource 새로 생성되므로)
    t1BorderEntitiesRef.current = [];
    t2BorderEntitiesRef.current = [];

    // [cl] 해당 연도에 활성화된 엔티티 + 최적 스냅샷 선택
    const activeEntities: { entity: OhmEntity; rid: number }[] = [];
    for (const entity of ohmIndexRef.current) {
      const sy = entity.start_year ?? -10000;
      const ey = entity.end_year ?? 2025;
      if (sy > targetYear || ey < targetYear) continue;

      // [mk] 티어 필터: 비활성 티어는 OHM 폴리곤도 숨김
      if (!visibleTiersRef.current.includes(entity.tier ?? 3)) continue;

      // [cl] 가장 적합한 스냅샷: targetYear를 포함하는 스냅샷 중 가장 좁은 범위
      let best: OhmSnapshot | null = null;
      let bestSpan = Infinity;
      for (const snap of entity.snapshots) {
        const ss = snap.start ?? -10000;
        const se = snap.end ?? 2025;
        if (ss > targetYear || se < targetYear) continue;
        const span = se - ss;
        if (span < bestSpan) {
          bestSpan = span;
          best = snap;
        }
      }
      if (best) {
        activeEntities.push({ entity, rid: best.rid });
      }
    }

    // [cl] 필요한 GeoJSON들 병렬 fetch (캐시 미스만)
    const ridsToFetch = activeEntities
      .map(a => a.rid)
      .filter(rid => !ohmGeojsonCacheRef.current.has(rid));

    if (ridsToFetch.length > 0) {
      // [cl] 동시 최대 10개씩 fetch (브라우저 연결 제한 고려)
      const BATCH = 10;
      for (let i = 0; i < ridsToFetch.length; i += BATCH) {
        const batch = ridsToFetch.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (rid) => {
            const res = await fetch(`/geo/borders/ohm/ohm_${rid}.geojson`);
            if (!res.ok) return;
            const geojson = await res.json();
            ohmGeojsonCacheRef.current.set(rid, geojson);
          })
        );
        // [cl] 뷰어 파괴 체크 (비동기 중간에 언마운트 될 수 있음)
        if (viewer.isDestroyed()) return;
      }
    }

    // [cl] 기존 OHM DataSource 제거
    if (ohmDsRef.current) {
      viewer.dataSources.remove(ohmDsRef.current, true);
      ohmDsRef.current = null;
    }

    const ds = new CustomDataSource("ohm-borders");

    // [cl] 엔티티별 폴리곤 렌더링 (BP=1 스타일: 반투명 filled polygon)
    for (const { entity, rid } of activeEntities) {
      const geojson = ohmGeojsonCacheRef.current.get(rid) as { features?: Array<{ geometry: unknown; properties?: Record<string, unknown> }> } | undefined;
      if (!geojson?.features) continue;

      // [cl] 엔티티 색상 결정: wikidata_circles의 공간해싱 색상 재사용
      const circleEntry = wikidataCirclesRef.current?.find(c => c.qid === entity.qid);
      // [cl] 매칭 없으면 QID 숫자로 간단한 hue 생성
      const fallbackHue = (parseInt(entity.qid.replace("Q", ""), 10) || 0) * 137 % 360;
      const baseColor = circleEntry
        ? circleEntry.color
        : `hsl(${fallbackHue}, 55%, 55%)`;

      // [mk] T1 경계선: 현재 고도 기준 초기 width (이후 preRender 이벤트로 실시간 갱신)
      const entityTier = entity.tier ?? 3;

      for (const feature of geojson.features) {
        // [cl] 외곽선 — T1/T2만 표시, T3/T4는 국경선 없음
        // T1: width 6, 선명 글로우 | T2: width 5, 연한 글로우
        // extractOuterRings: 내부 hole 링 제외, 국경(외곽)만 그림
        if (showBorderRef.current && entityTier <= 2) {
          const outerRings = extractOuterRings(feature.geometry);
          for (const positions of outerRings) {
            if (positions.length < 2) continue;
            ds.entities.add({
              polyline: {
                positions,
                width: entityTier === 1 ? 6 : 5,
                material: new PolylineGlowMaterialProperty({
                  glowPower: entityTier === 1 ? 0.5 : 0.7,
                  color: Color.WHITE.withAlpha(entityTier === 1 ? 0.6 : 0.35),
                }),
              },
            });
          }
        }
      }

      // [cl] OHM 라벨 제거 — 라벨은 renderCirclesForYear()에서 wikidata_circles.json 기반으로 통합 렌더링
      // OHM은 폴리곤(국경선)만 담당, 라벨 이중 표시 방지 (2026-03-02)
    }

    // [cl] ★ CShapes 폴리곤 렌더링 — 1886+ 현대국가 중 OHM 없는 T1/T2 (폴리곤만, 라벨 절대 없음!)
    if (targetYear >= 1886 && cshapesQidIndexRef.current) {
      // [cl] OHM에서 이미 렌더링된 QID 수집 (CShapes와 중복 방지)
      const ohmRenderedQids = new Set(activeEntities.map(a => a.entity.qid));

      // [cl] 해당 연도에 활성인 CShapes 매칭 엔티티 필터링
      const csActive = cshapesQidIndexRef.current.filter(e => {
        if (ohmRenderedQids.has(e.qid)) return false; // OHM이 이미 커버
        if (e.start_year > targetYear || e.end_year < targetYear) return false;
        if (!visibleTiersRef.current.includes(e.tier)) return false;
        return true;
      });

      // [cl] 각 엔티티별 최적 CShapes 연도 선택 (targetYear 이하 중 가장 가까운 연도)
      for (const csEntity of csActive) {
        const availableYears = csEntity.cshapes_years.filter(y => y <= targetYear);
        if (availableYears.length === 0) {
          // [cl] targetYear 이전 연도 없으면 이후 가장 가까운 것
          const futureYears = csEntity.cshapes_years.filter(y => y > targetYear);
          if (futureYears.length === 0) continue;
          availableYears.push(futureYears[0]);
        }
        const bestYear = availableYears[availableYears.length - 1]; // 가장 가까운 연도

        const feature = await fetchCshapesFeature(bestYear, csEntity.cshapes_name);
        if (!feature || !(feature as { geometry?: unknown }).geometry) continue;
        if (viewer.isDestroyed()) return;

        const feat = feature as { geometry: unknown; properties?: Record<string, unknown> };

        // [cl] 색상: wikidata_circles의 공간해싱 색상 재사용
        const circleEntry = wikidataCirclesRef.current?.find(c => c.qid === csEntity.qid);
        const fallbackHue = (parseInt(csEntity.qid.replace("Q", ""), 10) || 0) * 137 % 360;
        const baseColor = circleEntry
          ? circleEntry.color
          : `hsl(${fallbackHue}, 55%, 55%)`;

        const entityTier = csEntity.tier;

        // [cl] CShapes 외곽선 — T1/T2만 (OHM과 동일 글로우 스타일)
        // extractOuterRings: 내부 hole 링 제외
        if (showBorderRef.current && entityTier <= 2) {
          const outerRings = extractOuterRings(feat.geometry);
          for (const positions of outerRings) {
            if (positions.length < 2) continue;
            ds.entities.add({
              polyline: {
                positions,
                width: entityTier === 1 ? 6 : 5,
                material: new PolylineGlowMaterialProperty({
                  glowPower: entityTier === 1 ? 0.5 : 0.7,
                  color: Color.WHITE.withAlpha(entityTier === 1 ? 0.6 : 0.35),
                }),
              },
            });
          }
        }

        // [cl] ★ CShapes 라벨 절대 없음! 라벨은 renderCirclesForYear() 전담
      }
    }

    if (!viewer.isDestroyed()) {
      viewer.dataSources.add(ds);
      ohmDsRef.current = ds;
      currentOhmYearRef.current = targetYear;
    }
  }

  // [cl] 인덱스 로드 (1회) + 즉시 첫 국경 로드
  // StrictMode 이중 실행 + HMR stale 캐시 방지를 위해 cancelled 플래그 + cleanup 사용
  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    // [cl] HMR/StrictMode 리마운트 시 stale 메타데이터 캐시 방지
    metadataCacheRef.current = {};

    // [cl] ★ CShapes 비활성화 — OHM + 원형으로 통일 (진형 결정 2026-03-02)
    // CShapes 국경선 로드를 스킵. OHM 폴리곤이 없는 나라는 원형으로 표시.
    // 나중에 CShapes 복원 시 이 블록 주석 해제.
    // loadBorderIndex().then(async (idx) => { ... }).catch(() => {});

    // [cl] ★ 고도 반응형 경계선 비활성화 — T1=1.5px 실선, T2=1px 점선 고정 (2026-03-03)
    // 복원 시 아래 주석 해제
    // const onPreRender = () => {
    //   if (viewer.isDestroyed()) return;
    //   const altKm = viewer.camera.positionCartographic.height / 1000;
    //   const newWidth = Math.min(3, Math.max(1, 1 + 2 * (altKm - 5000) / 10000));
    //   const newT2Vis = altKm >= 15000;
    //   const widthChanged = Math.abs(newWidth - lastT1WidthRef.current) > 0.05;
    //   const t2VisChanged = newT2Vis !== lastT2VisibleRef.current;
    //   if (!widthChanged && !t2VisChanged) return;
    //   if (widthChanged) {
    //     lastT1WidthRef.current = newWidth;
    //     for (const ent of t1BorderEntitiesRef.current) {
    //       if (ent.polyline?.width) (ent.polyline.width as ConstantProperty).setValue(newWidth);
    //     }
    //     for (const ent of t2BorderEntitiesRef.current) {
    //       if (ent.polyline?.width) (ent.polyline.width as ConstantProperty).setValue(newWidth);
    //     }
    //   }
    //   if (t2VisChanged) {
    //     lastT2VisibleRef.current = newT2Vis;
    //     for (const ent of t2BorderEntitiesRef.current) {
    //       ent.show = newT2Vis;
    //     }
    //   }
    // };
    // viewer.scene.preRender.addEventListener(onPreRender);

    // [cl] ★ OHM + CShapes 인덱스 먼저 로드 → 원형 데이터 로드 (QID 제외를 위해 순서 중요)
    // CShapes 인덱스도 병렬 로드하여 ohmQidsRef에 CShapes 매칭 QID도 추가
    Promise.all([
      loadOhmIndex().catch(() => null),
      loadCshapesQidIndex().catch(() => null),
    ]).then(() => {
      if (cancelled || viewer.isDestroyed()) return;
      // [cl] OHM + CShapes 인덱스 로드 후 원형 데이터 로드 (ohmQidsRef 세팅 완료 후)
      loadWikidataCircles().then(() => {
        if (cancelled || viewer.isDestroyed()) return;
        renderCirclesForYear(currentYear);
      }).catch(() => {});
      // [cl] OHM + CShapes 폴리곤 첫 렌더링
      renderOhmForYear(currentYear).catch(() => {});
    });

    // [cl] 클린업: StrictMode 첫 번째 실행의 비동기 취소 + 데이터소스 정리
    return () => {
      cancelled = true;
      // [cl] preRender 비활성화 중 — 복원 시 주석 해제
      // if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(onPreRender);
      if (borderDsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(borderDsRef.current, true);
        borderDsRef.current = null;
        currentBorderFileRef.current = null;
      }
      // [cl] 원형 DataSource도 정리
      if (circleDsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(circleDsRef.current, true);
        circleDsRef.current = null;
      }
      // [cl] OHM DataSource 정리
      if (ohmDsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ohmDsRef.current, true);
        ohmDsRef.current = null;
      }
      currentOhmYearRef.current = null;
      borderLoadingRef.current = false;
    };
  }, [viewer]);

  // [cl] ★ CShapes 비활성화 — 연도 변경 시 CShapes 스왑 스킵 (진형 결정 2026-03-02)
  // OHM + 원형으로 전 구간 통일. CShapes 복원 시 이 블록 교체.
  // useEffect(() => { ... CShapes swap logic ... }, [viewer, currentYear]);

  // [cl] ★ 연도 변경 시 원형+라벨 업데이트 (국경선 스왑과 독립, 매 연도 반응)
  useEffect(() => {
    if (!viewer || !wikidataCirclesRef.current) return;
    renderCirclesForYear(currentYear);
  }, [currentYear]);

  // [cl] ★ 연도 변경 시 OHM 폴리곤 업데이트 (원형/CShapes와 독립)
  useEffect(() => {
    if (!viewer || !ohmIndexRef.current) return;
    renderOhmForYear(currentYear);
  }, [currentYear]);

  // [mk] ★ visibleTiers 변경 시 라벨 + OHM 폴리곤 재렌더링
  useEffect(() => {
    visibleTiersRef.current = visibleTiers ?? [1, 2, 3, 4];
    if (!viewer) return;
    if (wikidataCirclesRef.current) renderCirclesForYear(currentYear);
    // [mk] OHM도 tier 필터 적용 — 캐시 무효화 후 재렌더
    if (ohmIndexRef.current) {
      if (ohmDsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ohmDsRef.current, true);
        ohmDsRef.current = null;
      }
      currentOhmYearRef.current = null;
      renderOhmForYear(currentYear);
    }
  }, [visibleTiers]);

  // [mk] ★ showBorder 변경 시 OHM 재렌더링 (캐시 무효화 후)
  useEffect(() => {
    showBorderRef.current = showBorder ?? true;
    if (!viewer || !ohmIndexRef.current) return;
    if (ohmDsRef.current && !viewer.isDestroyed()) {
      viewer.dataSources.remove(ohmDsRef.current, true);
      ohmDsRef.current = null;
    }
    currentOhmYearRef.current = null;
    renderOhmForYear(currentYear);
  }, [showBorder]);

  return null;
}

// [cl] CesiumGlobe props: orbit + marker + 글로벌 자전 제어 + 워프 단계 + 국경선
interface CesiumGlobeProps {
  orbitActive?: boolean;
  orbitPaused?: boolean;
  globePaused?: boolean;
  globeDirection?: "left" | "right";
  markerMode?: boolean;
  events?: MockEvent[];
  onStackClick?: (events: MockEvent[], pos: { x: number; y: number }) => void;
  warpPhase?: WarpPhase;
  onSpinWarp?: (direction: "past" | "future") => void;
  currentYear?: number; // [cl] 역사 국경선 표시용
  visibleTiers?: number[];    // [mk] 표시할 티어 목록 (기본: [1,2,3,4])
  showBorder?: boolean;       // [mk] OHM 국경선 표시 여부 (기본: true)
  popupOpen?: boolean;        // [cl] 캐러셀/팝업 열림 상태 → 툴팁 숨김용
}

// [cl] ★ 모듈 레벨 상수: 렌더링마다 새 객체 생성 방지 → Viewer 재생성 차단
const VIEWER_CONTEXT_OPTIONS = { webgl: { alpha: true } } as const;

export default function CesiumGlobe({
  orbitActive = false,
  orbitPaused = false,
  globePaused = false,
  globeDirection = "left",
  markerMode = false,
  events = [],
  onStackClick,
  warpPhase = "idle",
  onSpinWarp,
  currentYear = 1875,
  visibleTiers,
  showBorder,
  popupOpen = false,
}: CesiumGlobeProps) {
  return (
    <Viewer
      full
      // [cl] alpha:true → 스카이박스 OFF 시 우주 영역 투명 → 뒤의 LightSpeed 비침
      contextOptions={VIEWER_CONTEXT_OPTIONS}
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
        orbitPaused={orbitPaused}
        globePaused={globePaused}
        globeDirection={globeDirection}
        markerMode={markerMode}
        events={events}
        onStackClick={onStackClick}
        warpPhase={warpPhase}
        onSpinWarp={onSpinWarp}
        currentYear={currentYear}
        visibleTiers={visibleTiers}
        showBorder={showBorder}
        popupOpen={popupOpen}
      />
      {/* [cl] BlurStage 비활성화 — PostProcessStage는 화면 전체(지구본+라벨+배경)에
          적용되므로 개별 폴리곤 엣지 블러 불가. CesiumJS 기본 API 한계.
          BP=1 시각화는 filled polygon(반투명, 경계선 없음)만으로 처리.
          향후 커스텀 Primitive + GLSL shader로 엣지 페이드아웃 구현 시 대체 가능. */}
    </Viewer>
  );
}
