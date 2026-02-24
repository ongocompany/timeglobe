"use client";

// [cl] 3D 캐러셀: 역사 이벤트 카드를 3D 원형 궤도로 보여주는 오버레이
// 지구본에 완전 종속: 회전(heading)/기울기(pitch)/줌 자동 추종
// ★ displayCount는 열릴 때 한번만 계산 → 줌 중 React re-render 없음
// ★ 컨테이너 rotateY(-heading) + rotateX(tilt) → 지구 자전축 추종

import { useEffect, useRef, useCallback, useState, useMemo } from "react";

export interface CarouselCard {
  title: string;
  desc: string;
  image: string;
}

interface Carousel3DProps {
  items: CarouselCard[];
  isOpen: boolean;
  onClose: () => void;
}

interface ItemState {
  gray: number;
  brightness: number;
  opacity: number;
  currentX: number;
}

// [cl] 기준값
const BASE_GLOBE_DIAMETER = 800;
const BASE_ICON_SIZE = 80;
const ICON_GAP = 5;
const P = 1200;
const MARGIN = 50;

export default function Carousel3D({ items, isOpen, onClose }: Carousel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const itemStatesRef = useRef<ItemState[]>([]);
  const frameIdRef = useRef<number>(0);

  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  const hoveredIndexRef = useRef(-1);

  // [cl] displayCount: 열릴 때 한번만 계산 (줌 중 재렌더 방지)
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // [cl] 캐러셀 열릴 때: 현재 지구 크기로 displayCount 계산 (1.5배 버퍼)
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeScreenR = (window as any).__timeglobe_screenRadius || 300;
      const G = Math.min(globeScreenR, P - MARGIN - 100);
      const orbitR = (G + MARGIN) * P / (P - G - MARGIN);
      const iconSz = Math.max(16, Math.round(BASE_ICON_SIZE * (globeScreenR * 2 / BASE_GLOBE_DIAMETER)));
      const circumference = 2 * Math.PI * orbitR;
      const slots = Math.ceil(circumference / (iconSz + ICON_GAP));
      // [cl] 1.5배 버퍼로 줌 범위 커버 (최대 200개)
      const count = Math.max(items.length, Math.min(Math.ceil(slots * 1.5), 200));
      setDisplayCount(count);
      setActiveIndex(-1);
      hoveredIndexRef.current = -1;
    } else {
      setDisplayCount(0);
    }
  }, [isOpen, items.length]);

  // [cl] displayCount 변할 때 itemStates 초기화
  useEffect(() => {
    if (displayCount > 0) {
      itemStatesRef.current = Array.from({ length: displayCount }, () => ({
        gray: 0, brightness: 100, opacity: 1, currentX: 0,
      }));
    }
  }, [displayCount]);

  // [cl] 반복 매핑된 표시용 아이템 배열
  const displayItems = useMemo(() => {
    if (items.length === 0 || displayCount === 0) return [];
    return Array.from({ length: displayCount }, (_, i) => ({
      ...items[i % items.length],
      originalIndex: i % items.length,
    }));
  }, [items, displayCount]);

  const lerp = (start: number, end: number, factor: number) =>
    start + (end - start) * factor;

  const openModal = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const closeModal = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  // [cl] 렌더링 루프 + hover 이벤트
  useEffect(() => {
    if (!isOpen || !containerRef.current || displayCount === 0) return;

    const container = containerRef.current;
    const angleStep = (2 * Math.PI) / displayCount;

    // [cl] hover 감지: 이벤트 위임
    const handleMouseOver = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest("[data-card-index]");
      if (card) hoveredIndexRef.current = parseInt(card.getAttribute("data-card-index")!);
    };
    const handleMouseOut = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest("[data-card-index]");
      if (card) {
        const idx = parseInt(card.getAttribute("data-card-index")!);
        if (hoveredIndexRef.current === idx) hoveredIndexRef.current = -1;
      }
    };
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    // [cl] 보간 변수 (클로저에서 프레임 간 유지)
    let currentTilt = 0;
    let currentOffX = 0;
    let currentOffY = 0;
    let currentHeading = 0;
    let frozenHeading = 0;

    const render = () => {
      // [cl] 지구 상태 읽기 (CesiumGlobe rAF에서 매 프레임 갱신)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeScreenR = (window as any).__timeglobe_screenRadius || 300;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeCenter = (window as any).__timeglobe_center as { x: number; y: number } | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cameraPitch = (window as any).__timeglobe_cameraPitch ?? (-Math.PI / 2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cameraHeading = (window as any).__timeglobe_cameraHeading ?? 0;

      const ai = activeIndexRef.current;
      const hi = hoveredIndexRef.current;

      // [cl] 아이콘 크기 CSS 변수 (React 없이 직접 갱신)
      const currentIconSize = Math.max(16, Math.round(BASE_ICON_SIZE * (globeScreenR * 2 / BASE_GLOBE_DIAMETER)));
      container.style.setProperty("--orbit-icon-size", `${currentIconSize}px`);

      // [cl] perspective 보정 궤도 반지름
      const G = Math.min(globeScreenR, P - MARGIN - 100);
      const ORBIT_R = (G + MARGIN) * P / (P - G - MARGIN);

      // ──── 컨테이너 transform: 위치 + 기울기 + 회전 ────

      // [cl] heading 동기화 (모달 시 freeze)
      if (ai === -1) frozenHeading = cameraHeading;
      const targetHeading = ai !== -1 ? frozenHeading : cameraHeading;
      // [cl] 각도 보간 (2π 래핑)
      let headingDiff = targetHeading - currentHeading;
      while (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
      while (headingDiff < -Math.PI) headingDiff += 2 * Math.PI;
      currentHeading += headingDiff * 0.1;

      // [cl] pitch → tilt (모달 시 0으로 복원)
      const rawTilt = (cameraPitch + Math.PI / 2) * (180 / Math.PI);
      const targetTilt = ai !== -1 ? 0 : rawTilt;
      currentTilt = lerp(currentTilt, targetTilt, 0.06);

      // [cl] 위치 오프셋 (모달 시 화면 중앙)
      let targetOffX = 0;
      let targetOffY = 0;
      if (globeCenter && ai === -1) {
        targetOffX = globeCenter.x - window.innerWidth / 2;
        targetOffY = globeCenter.y - window.innerHeight / 2;
      }
      currentOffX = lerp(currentOffX, targetOffX, 0.06);
      currentOffY = lerp(currentOffY, targetOffY, 0.06);

      const headingDeg = currentHeading * (180 / Math.PI);

      // [cl] ★ rotateY(-heading): 지구 자전축 추종, rotateX(tilt): 기울기
      container.style.transform =
        `translate3d(${currentOffX}px, ${currentOffY}px, 0) rotateX(${currentTilt}deg) rotateY(${-headingDeg}deg)`;

      // ──── 카드별 위치/효과 ────

      itemElsRef.current.forEach((el, i) => {
        if (!el) return;
        const state = itemStatesRef.current[i];
        if (!state) return;

        // [cl] 물리적 각도 (링 내 고정 위치)
        const physicalAngle = i * angleStep;

        // [cl] 카메라 기준 시각적 각도 (heading에 의해 어떤 카드가 정면인지 결정)
        let visualAngle = physicalAngle - currentHeading;
        while (visualAngle > Math.PI) visualAngle -= 2 * Math.PI;
        while (visualAngle < -Math.PI) visualAngle += 2 * Math.PI;

        // [cl] 물리적 위치 (링 내, 컨테이너 rotateY가 시각 위치 처리)
        let targetX = ORBIT_R * Math.sin(physicalAngle);
        const z_base = ORBIT_R * (Math.cos(physicalAngle) - 1);
        let z = z_base;
        const cardRotateY = physicalAngle * (180 / Math.PI);

        // [cl] 시각적 각도 기반 효과 (정면 밝고, 후면 소멸)
        const cosVisual = Math.cos(visualAngle);
        let targetGray = Math.max(0, (1 - cosVisual) * 50);
        let targetBrightness = 100 - targetGray * 0.4;
        let targetOpacity = cosVisual > -0.2
          ? Math.max(0, (cosVisual + 0.2) / 1.2)
          : 0;

        // [cl] hover 팝아웃
        if (hi === i && ai === -1) z += 30;

        // [cl] 모달 활성 시
        if (ai !== -1) {
          if (ai === i) {
            targetGray = 0;
            targetBrightness = 100;
            targetOpacity = 1;
            z = 50;
            targetX = 0;
          } else {
            targetGray = 100;
            targetBrightness = 40;
            targetOpacity = 0.3;
          }
        }

        // [cl] x 보간 (모달 전환 시 부드러운 이동)
        state.currentX = lerp(state.currentX, targetX, 0.08);
        state.gray = lerp(state.gray, targetGray, 0.08);
        state.brightness = lerp(state.brightness, targetBrightness, 0.08);
        state.opacity = lerp(state.opacity, targetOpacity, 0.08);

        el.style.transform = `translate3d(calc(-50% + ${state.currentX}px), -50%, ${z}px) rotateY(${cardRotateY}deg)`;
        el.style.filter = `grayscale(${state.gray}%) brightness(${state.brightness}%)`;
        el.style.opacity = state.opacity.toString();
        el.style.zIndex =
          ai === i ? "200"
            : hi === i ? "190"
              : Math.round(100 + cosVisual * 100).toString();

        el.style.pointerEvents = state.opacity < 0.1 ? "none" : "";
      });

      frameIdRef.current = requestAnimationFrame(render);
    };

    frameIdRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [isOpen, displayCount]);

  if (!isOpen || displayCount === 0) return null;

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none"
      style={{ perspective: "1200px" }}
    >
      {/* [cl] 배경 (모달 시에만 클릭 가능) */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-500 ${
          activeIndex !== -1 ? "pointer-events-auto bg-black/60" : ""
        }`}
        onClick={activeIndex !== -1 ? closeModal : undefined}
      />

      {/* [cl] 비네트 */}
      <div
        className="absolute inset-0 z-[150]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* [cl] 3D 컨테이너 — transform은 rAF에서 설정 */}
      <div
        ref={containerRef}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {displayItems.map((item, i) => (
          <div
            key={i}
            ref={(el) => { itemElsRef.current[i] = el; }}
            className="orbit-card"
            data-card-index={i}
            data-active={activeIndex === i ? "" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (activeIndex === i) { closeModal(); return; }
              openModal(i);
            }}
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover pointer-events-none"
              loading="lazy"
            />

            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none transition-opacity duration-600"
              style={{
                height: "60%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                opacity: activeIndex === i ? 1 : 0,
              }}
            />

            <div
              className="absolute bottom-10 left-10 right-10 z-10 text-white transition-all duration-600"
              style={{
                opacity: activeIndex === i ? 1 : 0,
                transform:
                  activeIndex === i ? "translateX(0)" : "translateX(80px)",
                transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                transitionDelay: activeIndex === i ? "0.3s" : "0s",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: "4rem",
                  letterSpacing: "1px",
                  lineHeight: 1.1,
                  marginBottom: "4px",
                  textShadow: "0 4px 12px rgba(0,0,0,0.5)",
                }}
              >
                {item.title}
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-noto-sans), sans-serif",
                  fontSize: "1.1rem",
                  letterSpacing: "0.5px",
                  opacity: 0.9,
                }}
              >
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
