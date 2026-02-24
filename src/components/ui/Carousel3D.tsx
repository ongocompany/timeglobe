"use client";

// [cl] 3D 캐러셀: 역사 이벤트 카드를 3D 원근감으로 보여주는 오버레이
// 지구본 위에 띄워지며, 드래그/스크롤로 탐색, 클릭으로 모달 확장
// 원본: docs/interactiontest.html (바닐라 JS) → React 변환

import { useEffect, useRef, useCallback, useState } from "react";

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
  currentX: number;
  gray: number;
  brightness: number;
  opacity: number;
}

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

  // [cl] activeIndex를 ref에도 동기화 (rAF 루프에서 최신값 접근용)
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // [cl] 캐러셀 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      targetXRef.current = 0;
      currentXRef.current = 0;
      setActiveIndex(-1);
      itemStatesRef.current = items.map(() => ({
        currentX: 0,
        gray: 0,
        brightness: 100,
        opacity: 1,
      }));
    }
  }, [isOpen, items]);

  const lerp = (start: number, end: number, factor: number) =>
    start + (end - start) * factor;

  // [cl] 모달 열기: 클릭된 카드를 궤도 전면(angle=0)으로 최단 경로 회전
  const openModal = useCallback((index: number) => {
    setActiveIndex(index);
    const itemWidth = window.innerWidth * 0.12;
    const totalWidth = itemWidth * items.length;
    const target = index * itemWidth;
    let diff = target - targetXRef.current;
    // [cl] 원형 최단 경로: 반 바퀴 이내로 회전
    while (diff > totalWidth / 2) diff -= totalWidth;
    while (diff < -totalWidth / 2) diff += totalWidth;
    targetXRef.current += diff;
  }, [items.length]);

  // [cl] 모달 닫기
  const closeModal = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  // [cl] 스크롤 핸들러 (캐러셀 내부에서만)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (activeIndexRef.current !== -1) return;
    e.preventDefault();
    targetXRef.current += e.deltaY * 1.5 + e.deltaX * 1.5;
  }, []);

  // [cl] 드래그 핸들러
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
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const numItems = items.length;
    const itemWidth = window.innerWidth * 0.12;
    const totalWidth = itemWidth * numItems;
    // [cl] 원형 궤도 파라미터
    const ORBIT_RADIUS = 450; // px (나중에 지구 screenRadius에 맞출 예정)
    const angleStep = (2 * Math.PI) / numItems;

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("mousedown", handleDragStart);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    container.addEventListener("touchstart", handleDragStart);
    window.addEventListener("touchmove", handleDragMove);
    window.addEventListener("touchend", handleDragEnd);

    const render = () => {
      currentXRef.current +=
        (targetXRef.current - currentXRef.current) * 0.07;

      // [cl] 스크롤 오프셋 → 궤도 각도 변환
      const scrollAngle = (currentXRef.current / totalWidth) * 2 * Math.PI;

      itemElsRef.current.forEach((el, i) => {
        if (!el) return;
        const state = itemStatesRef.current[i];
        if (!state) return;

        // [cl] 원형 궤도 위 각도 (정면=0, 좌=-π, 우=+π)
        let angle = i * angleStep - scrollAngle;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;

        // [cl] 원형 궤도 3D 좌표: x=좌우, z=앞뒤 (정면 z=0, 뒤 z=-2R)
        const x = ORBIT_RADIUS * Math.sin(angle);
        let z = ORBIT_RADIUS * (Math.cos(angle) - 1);
        let cardRotateY = angle * (180 / Math.PI);

        state.currentX = x;

        // [cl] 각도 기반 시각 효과: 정면 밝고, 측면 흐리고, 후면 소멸
        const cosAngle = Math.cos(angle);
        let targetGray = Math.max(0, (1 - cosAngle) * 50);
        let targetBrightness = 100 - targetGray * 0.4;
        let targetOpacity = cosAngle > -0.2
          ? Math.max(0, (cosAngle + 0.2) / 1.2)
          : 0;

        const ai = activeIndexRef.current;
        if (ai !== -1) {
          if (ai === i) {
            targetGray = 0;
            targetBrightness = 100;
            targetOpacity = 1;
            z = 50; // [cl] 모달: 카메라 앞으로 팝아웃
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
            : Math.round(100 + cosAngle * 100).toString();
      });

      frameIdRef.current = requestAnimationFrame(render);
    };

    frameIdRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousedown", handleDragStart);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      container.removeEventListener("touchstart", handleDragStart);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isOpen, items, handleWheel, handleDragStart, handleDragMove, handleDragEnd]);

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
        {items.map((item, i) => (
          <div
            key={i}
            ref={(el) => { itemElsRef.current[i] = el; }}
            className={`absolute top-1/2 left-1/2 overflow-hidden will-change-transform ${
              activeIndex === i ? "cursor-default" : "cursor-grab"
            }`}
            style={{
              width: activeIndex === i ? "min(800px, 90vw)" : "11vw",
              height: activeIndex === i ? "auto" : "30vh",
              aspectRatio: activeIndex === i ? "3/4" : undefined,
              maxHeight: activeIndex === i ? "85vh" : undefined,
              minWidth: "120px",
              transformOrigin: "center center",
              backgroundColor: "#222",
              borderRadius: activeIndex === i ? "24px" : "0px",
              transition:
                "width 0.7s cubic-bezier(0.25,1,0.5,1), height 0.7s cubic-bezier(0.25,1,0.5,1), border-radius 0.7s ease",
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
