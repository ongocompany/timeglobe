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

  // [cl] 모달 열기: 해당 카드를 중앙으로 이동 + 확장
  const openModal = useCallback((index: number) => {
    setActiveIndex(index);
    const state = itemStatesRef.current[index];
    if (state) {
      targetXRef.current += state.currentX;
    }
  }, []);

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

      itemElsRef.current.forEach((el, i) => {
        if (!el) return;
        const state = itemStatesRef.current[i];
        if (!state) return;

        let x = i * itemWidth - currentXRef.current;

        // [cl] 무한 스크롤
        while (x > totalWidth / 2) x -= totalWidth;
        while (x < -totalWidth / 2) x += totalWidth;

        state.currentX = x;

        const distanceRatio = x / (window.innerWidth / 2);
        let z = -Math.abs(distanceRatio) * 600;
        let rotateY = distanceRatio * 40;

        let targetGray = Math.min(Math.abs(distanceRatio) * 100, 100);
        let targetBrightness = 100 - targetGray * 0.4;
        let targetOpacity = 1;

        const ai = activeIndexRef.current;
        if (ai !== -1) {
          if (ai === i) {
            targetGray = 0;
            targetBrightness = 100;
            targetOpacity = 1;
            z += 50;
            rotateY = 0;
          } else {
            targetGray = 100;
            targetBrightness = 40;
            targetOpacity = 0.3;
          }
        }

        state.gray = lerp(state.gray, targetGray, 0.08);
        state.brightness = lerp(state.brightness, targetBrightness, 0.08);
        state.opacity = lerp(state.opacity, targetOpacity, 0.08);

        el.style.transform = `translate3d(calc(-50% + ${x}px), -50%, ${z}px) rotateY(${rotateY}deg)`;
        el.style.filter = `grayscale(${state.gray}%) brightness(${state.brightness}%)`;
        el.style.opacity = state.opacity.toString();
        el.style.zIndex =
          ai === i
            ? "200"
            : Math.round(100 - Math.abs(distanceRatio) * 100).toString();
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

      {/* [cl] 양끝 페이드 오버레이 (3D 보호) */}
      <div
        className="absolute inset-0 pointer-events-none z-[150]"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {/* [cl] 하단 가이드 텍스트 */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-sm uppercase tracking-widest text-white/50 z-[160] transition-opacity duration-400"
        style={{
          fontFamily: "var(--font-noto-sans), sans-serif",
          opacity: activeIndex !== -1 ? 0 : 1,
        }}
      >
        Drag or Scroll to Explore
      </div>

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
