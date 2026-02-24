"use client";

// [cl] 3D 캐러셀: 역사 이벤트 카드를 3D 원형 궤도로 보여주는 오버레이
// 지구본을 감싸는 원형 띠 형태, 드래그로 회전, 클릭으로 모달 확장
// 기본: 작은 아이콘(지구 비례), hover: 180×180 확대, 카드 반복으로 궤도 채움

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

// [cl] 기준값: 지구 지름 800px일 때 아이콘 30px, 간격 5px
const BASE_GLOBE_DIAMETER = 800;
const BASE_ICON_SIZE = 30;
const ICON_GAP = 5;
const HOVER_SIZE = 180;
const P = 1200; // perspective 값
const MARGIN = 50; // 지구 가장자리로부터 여유 (px)

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

  const [activeIndex, setActiveIndex] = useState(-1);
  const activeIndexRef = useRef(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const hoveredIndexRef = useRef(-1);

  // [cl] 지구 화면 반지름 → 아이콘 크기 + 반복 개수 계산용 상태
  const [globeRadius, setGlobeRadius] = useState(300);

  // [cl] activeIndex / hoveredIndex를 ref에 동기화 (rAF 루프 접근용)
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
  useEffect(() => { hoveredIndexRef.current = hoveredIndex; }, [hoveredIndex]);

  // [cl] 아이콘 크기: 지구 지름에 비례 (800px 기준 30px)
  const iconSize = useMemo(() => {
    const globeDiameter = globeRadius * 2;
    return Math.max(16, Math.round(BASE_ICON_SIZE * (globeDiameter / BASE_GLOBE_DIAMETER)));
  }, [globeRadius]);

  // [cl] 궤도 반지름 (perspective 보정)
  const orbitRadius = useMemo(() => {
    const G = Math.min(globeRadius, P - MARGIN - 100);
    return (G + MARGIN) * P / (P - G - MARGIN);
  }, [globeRadius]);

  // [cl] 궤도 둘레를 채우기 위한 반복 개수 계산
  const displayCount = useMemo(() => {
    if (items.length === 0) return 0;
    const circumference = 2 * Math.PI * orbitRadius;
    const slotSize = iconSize + ICON_GAP;
    const needed = Math.ceil(circumference / slotSize);
    // [cl] 최소한 원본 개수, 최대 200개로 제한
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
      setHoveredIndex(-1);
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
    let diff = targetAngle - (currentXRef.current % (2 * Math.PI));
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
      targetXRef.current = startScrollXRef.current - deltaX * 2.5;
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

    // [cl] 드래그만 지원 (스크롤 제거됨)
    container.addEventListener("mousedown", handleDragStart);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    container.addEventListener("touchstart", handleDragStart);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);

    const render = () => {
      currentXRef.current +=
        (targetXRef.current - currentXRef.current) * 0.07;

      // [cl] 지구 화면 반지름 읽기 (CesiumGlobe rAF에서 매 프레임 갱신됨)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globeScreenR = (window as any).__timeglobe_screenRadius || 300;

      // [cl] 상태 업데이트는 30fps 정도로 throttle (React 렌더 비용 줄임)
      if (Math.abs(globeScreenR - globeRadius) > 5) {
        setGlobeRadius(globeScreenR);
      }

      // [cl] perspective 보정된 궤도 반지름
      const G = Math.min(globeScreenR, P - MARGIN - 100);
      const ORBIT_R = (G + MARGIN) * P / (P - G - MARGIN);

      // [cl] 스크롤 오프셋 → 궤도 각도 변환
      const scrollAngle = currentXRef.current;

      const hi = hoveredIndexRef.current;
      const ai = activeIndexRef.current;

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

        // [cl] hover된 카드: 앞으로 살짝 팝아웃
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

      {/* [cl] 3D 캐러셀 컨테이너 */}
      <div
        ref={containerRef}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d", cursor: "grab" }}
      >
        {displayItems.map((item, i) => {
          const isActive = activeIndex === i;
          const isHovered = hoveredIndex === i && activeIndex === -1;

          return (
            <div
              key={i}
              ref={(el) => { itemElsRef.current[i] = el; }}
              className={`absolute top-1/2 left-1/2 overflow-hidden will-change-transform ${
                isActive ? "cursor-default" : "cursor-grab"
              }`}
              style={{
                width: isActive
                  ? "min(800px, 90vw)"
                  : isHovered
                    ? `${HOVER_SIZE}px`
                    : `${iconSize}px`,
                height: isActive
                  ? "auto"
                  : isHovered
                    ? `${HOVER_SIZE}px`
                    : `${iconSize}px`,
                aspectRatio: isActive ? "3/4" : undefined,
                maxHeight: isActive ? "85vh" : undefined,
                transformOrigin: "center center",
                backgroundColor: "#222",
                borderRadius: isActive ? "24px" : isHovered ? "8px" : "4px",
                transition:
                  "width 0.3s cubic-bezier(0.25,1,0.5,1), height 0.3s cubic-bezier(0.25,1,0.5,1), border-radius 0.3s ease",
              }}
              onMouseEnter={() => {
                if (activeIndex === -1) setHoveredIndex(i);
              }}
              onMouseLeave={() => {
                if (hoveredIndex === i) setHoveredIndex(-1);
              }}
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
                  opacity: isActive ? 1 : 0,
                }}
              />

              {/* [cl] 모달 텍스트: 우측에서 슬라이드 인 */}
              <div
                className="absolute bottom-10 left-10 right-10 z-10 text-white transition-all duration-600"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "translateX(0)" : "translateX(80px)",
                  transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                  transitionDelay: isActive ? "0.3s" : "0s",
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
          );
        })}
      </div>
    </div>
  );
}
