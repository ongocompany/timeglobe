"use client";

// [cl] 3D 캐러셀: 역사 이벤트 카드를 3D 원형 궤도로 보여주는 오버레이
// 지구본을 감싸는 원형 띠 형태, 드래그로 회전, 클릭으로 모달 확장
// hover 확대는 CSS :hover로 처리 (React re-render 없이 100+개 카드 대응)

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
}

// [cl] 기준값
const BASE_GLOBE_DIAMETER = 800;
const BASE_ICON_SIZE = 80;
const ICON_GAP = 5;
const P = 1200; // perspective 값
const MARGIN = 50; // 지구 가장자리 여유 (px)
const DRAG_SENSITIVITY = 0.008; // [cl] px → radian 변환 (200px 드래그 ≈ 90° 회전)

export default function Carousel3D({ items, isOpen, onClose }: Carousel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const itemStatesRef = useRef<ItemState[]>([]);

  const targetXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isDraggingActionRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollXRef = useRef(0);
  const frameIdRef = useRef<number>(0);
  const hoveredIndexRef = useRef(-1);

  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);

  // [cl] 지구 화면 반지름 → 아이콘 크기 + 반복 개수 계산용
  const [globeRadius, setGlobeRadius] = useState(300);

  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // [cl] 궤도 반지름 (perspective 보정)
  const orbitRadius = useMemo(() => {
    const G = Math.min(globeRadius, P - MARGIN - 100);
    return (G + MARGIN) * P / (P - G - MARGIN);
  }, [globeRadius]);

  // [cl] 아이콘 크기: 지구 지름에 비례
  const iconSize = useMemo(() => {
    const globeDiameter = globeRadius * 2;
    return Math.max(16, Math.round(BASE_ICON_SIZE * (globeDiameter / BASE_GLOBE_DIAMETER)));
  }, [globeRadius]);

  // [cl] 궤도를 채우기 위한 반복 개수
  const displayCount = useMemo(() => {
    if (items.length === 0) return 0;
    const circumference = 2 * Math.PI * orbitRadius;
    const slotSize = iconSize + ICON_GAP;
    const needed = Math.ceil(circumference / slotSize);
    return Math.max(items.length, Math.min(needed, 200));
  }, [items.length, orbitRadius, iconSize]);

  // [cl] 반복 매핑된 표시용 아이템 배열
  const displayItems = useMemo(() => {
    if (items.length === 0) return [];
    return Array.from({ length: displayCount }, (_, i) => ({
      ...items[i % items.length],
      originalIndex: i % items.length,
    }));
  }, [items, displayCount]);

  // [cl] 캐러셀 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      targetXRef.current = 0;
      currentXRef.current = 0;
      setActiveIndex(-1);
      hoveredIndexRef.current = -1;
    }
  }, [isOpen]);

  // [cl] displayCount 변할 때 itemStates 재초기화
  useEffect(() => {
    itemStatesRef.current = Array.from({ length: displayCount }, () => ({
      gray: 0,
      brightness: 100,
      opacity: 1,
    }));
  }, [displayCount]);

  const lerp = (start: number, end: number, factor: number) =>
    start + (end - start) * factor;

  // [cl] 모달 열기: 클릭된 카드를 궤도 전면(angle=0)으로 최단 경로 회전
  const openModal = useCallback((index: number) => {
    setActiveIndex(index);
    const angleStep = (2 * Math.PI) / displayCount;
    const targetAngle = index * angleStep;
    // [cl] 현재 각도를 0~2π로 정규화 후 최단 경로 계산
    const normalizedCurrent = ((currentXRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let diff = targetAngle - normalizedCurrent;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    targetXRef.current += diff;
  }, [displayCount]);

  // [cl] 모달 닫기
  const closeModal = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  // [cl] 드래그 핸들러 (스크롤 제거, 드래그만)
  const handleDragStart = useCallback((e: MouseEvent | TouchEvent) => {
    if (activeIndexRef.current !== -1) return;
    isDraggingRef.current = true;
    isDraggingActionRef.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    startScrollXRef.current = targetXRef.current;
  }, []);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - startXRef.current;
    if (Math.abs(deltaX) > 5) isDraggingActionRef.current = true;
    if (activeIndexRef.current === -1) {
      // [cl] px → radian 변환 (이전: 2.5 → 수정: 0.008)
      targetXRef.current = startScrollXRef.current - deltaX * DRAG_SENSITIVITY;
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // [cl] 렌더링 루프 + 이벤트 바인딩
  useEffect(() => {
    if (!isOpen || !containerRef.current || displayCount === 0) return;

    const container = containerRef.current;
    const angleStep = (2 * Math.PI) / displayCount;

    // [cl] 드래그 이벤트
    container.addEventListener("mousedown", handleDragStart);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    container.addEventListener("touchstart", handleDragStart);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);

    // [cl] hover 감지: 이벤트 위임 (mouseover/mouseleave on container)
    // React re-render 없이 ref만 업데이트 → rAF에서 z-index 처리
    const handleMouseOver = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest("[data-card-index]");
      if (card) {
        hoveredIndexRef.current = parseInt(card.getAttribute("data-card-index")!);
      }
    };
    const handleMouseOut = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest("[data-card-index]");
      if (card) {
        const idx = parseInt(card.getAttribute("data-card-index")!);
        if (hoveredIndexRef.current === idx) {
          hoveredIndexRef.current = -1;
        }
      }
    };
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    // [cl] 지구 종속: 위치 오프셋 + 기울기를 부드럽게 보간
    let currentTilt = 0;
    let currentOffX = 0;
    let currentOffY = 0;

    const render = () => {
      currentXRef.current +=
        (targetXRef.current - currentXRef.current) * 0.07;

      // [cl] 지구 화면 상태 읽기 (CesiumGlobe rAF에서 매 프레임 갱신)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeScreenR = (window as any).__timeglobe_screenRadius || 300;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeCenter = (window as any).__timeglobe_center as { x: number; y: number } | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cameraPitch = (window as any).__timeglobe_cameraPitch ?? (-Math.PI / 2);

      // [cl] 상태 업데이트 throttle (React 렌더 비용 줄임)
      if (Math.abs(globeScreenR - globeRadius) > 5) {
        setGlobeRadius(globeScreenR);
      }

      // [cl] 아이콘 크기를 CSS 변수로 설정 (매 프레임 갱신)
      const currentIconSize = Math.max(16, Math.round(BASE_ICON_SIZE * (globeScreenR * 2 / BASE_GLOBE_DIAMETER)));
      container.style.setProperty("--orbit-icon-size", `${currentIconSize}px`);

      // [cl] perspective 보정 궤도 반지름
      const G = Math.min(globeScreenR, P - MARGIN - 100);
      const ORBIT_R = (G + MARGIN) * P / (P - G - MARGIN);

      const scrollAngle = currentXRef.current;
      const hi = hoveredIndexRef.current;
      const ai = activeIndexRef.current;

      // [cl] 지구 종속: 궤도 위치를 지구 중심에 맞추고, 카메라 pitch에 따라 기울임
      // pitch = -π/2 (위에서 내려다봄) → tilt 0°, pitch = 0 (수평) → tilt 90°
      const rawTilt = (cameraPitch + Math.PI / 2) * (180 / Math.PI);
      // 모달 열림 시 기울기 0으로 복원 (모달이 비스듬히 보이는 것 방지)
      const targetTilt = ai !== -1 ? 0 : rawTilt;
      currentTilt = lerp(currentTilt, targetTilt, 0.06);

      let targetOffX = 0;
      let targetOffY = 0;
      if (globeCenter) {
        targetOffX = globeCenter.x - window.innerWidth / 2;
        targetOffY = globeCenter.y - window.innerHeight / 2;
      }
      // 모달 열림 시 오프셋 0으로 (화면 중앙에 모달 표시)
      if (ai !== -1) { targetOffX = 0; targetOffY = 0; }
      currentOffX = lerp(currentOffX, targetOffX, 0.06);
      currentOffY = lerp(currentOffY, targetOffY, 0.06);

      // [cl] 컨테이너 transform: 지구 중심으로 이동 + pitch 기울기
      container.style.transform = `translate3d(${currentOffX}px, ${currentOffY}px, 0) rotateX(${currentTilt}deg)`;

      itemElsRef.current.forEach((el, i) => {
        if (!el) return;
        const state = itemStatesRef.current[i];
        if (!state) return;

        // [cl] 원형 궤도 위 각도
        let angle = i * angleStep - scrollAngle;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;

        // [cl] 원형 궤도 3D 좌표
        const x = ORBIT_R * Math.sin(angle);
        let z = ORBIT_R * (Math.cos(angle) - 1);
        let cardRotateY = angle * (180 / Math.PI);

        // [cl] 각도 기반 시각 효과
        const cosAngle = Math.cos(angle);
        let targetGray = Math.max(0, (1 - cosAngle) * 50);
        let targetBrightness = 100 - targetGray * 0.4;
        let targetOpacity = cosAngle > -0.2
          ? Math.max(0, (cosAngle + 0.2) / 1.2)
          : 0;

        // [cl] hover 카드: z 앞으로 살짝 팝아웃
        if (hi === i && ai === -1) {
          z += 30;
        }

        // [cl] 모달 활성 시
        if (ai !== -1) {
          if (ai === i) {
            targetGray = 0;
            targetBrightness = 100;
            targetOpacity = 1;
            z = 50;
            cardRotateY = 0;
          } else {
            targetGray = 100;
            targetBrightness = 40;
            targetOpacity = 0.3;
          }
        }

        state.gray = lerp(state.gray, targetGray, 0.08);
        state.brightness = lerp(state.brightness, targetBrightness, 0.08);
        state.opacity = lerp(state.opacity, targetOpacity, 0.08);

        el.style.transform = `translate3d(calc(-50% + ${x}px), -50%, ${z}px) rotateY(${cardRotateY}deg)`;
        el.style.filter = `grayscale(${state.gray}%) brightness(${state.brightness}%)`;
        el.style.opacity = state.opacity.toString();
        el.style.zIndex =
          ai === i
            ? "200"
            : hi === i
              ? "190"
              : Math.round(100 + cosAngle * 100).toString();

        // [cl] 뒤쪽 카드 hover 방지 (투명도 낮으면 pointer-events 차단)
        el.style.pointerEvents = state.opacity < 0.1 ? "none" : "";
      });

      frameIdRef.current = requestAnimationFrame(render);
    };

    frameIdRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      container.removeEventListener("mousedown", handleDragStart);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      container.removeEventListener("touchstart", handleDragStart);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [isOpen, displayCount, handleDragStart, handleDragMove, handleDragEnd, globeRadius]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50"
      style={{ perspective: "1200px" }}
    >
      {/* [cl] 배경 클릭으로 모달 닫기 + 캐러셀 닫기 */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-500"
        onClick={() => {
          if (activeIndex !== -1) {
            closeModal();
          } else {
            onClose();
          }
        }}
      />

      {/* [cl] 부드러운 비네트 (궤도 분위기 연출) */}
      <div
        className="absolute inset-0 pointer-events-none z-[150]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* [cl] 3D 캐러셀 컨테이너 — --orbit-icon-size는 rAF에서 갱신 */}
      <div
        ref={containerRef}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d", cursor: "grab" }}
      >
        {displayItems.map((item, i) => (
          <div
            key={i}
            ref={(el) => { itemElsRef.current[i] = el; }}
            className="orbit-card"
            data-card-index={i}
            data-active={activeIndex === i ? "" : undefined}
            onClick={(e) => {
              if (isDraggingActionRef.current) return;
              if (activeIndex === i) return;
              e.stopPropagation();
              openModal(i);
            }}
          >
            {/* [cl] 카드 이미지 */}
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover pointer-events-none"
              loading="lazy"
            />

            {/* [cl] 모달 시 하단 그라데이션 */}
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none transition-opacity duration-600"
              style={{
                height: "60%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                opacity: activeIndex === i ? 1 : 0,
              }}
            />

            {/* [cl] 모달 텍스트: 우측에서 슬라이드 인 */}
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
