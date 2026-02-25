"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Timeline from "@/components/ui/Timeline";
import Carousel3D, { type CarouselCard } from "@/components/ui/Carousel3D";
import { EventDetailContent } from "@/components/ui/HistoryEventModal";
import Dashboard from "@/components/ui/Dashboard";
import TimeDial from "@/components/ui/TimeDial";
import { MOCK_EVENTS } from "@/data/mockEvents";
import type { MockEvent } from "@/data/mockEvents";

// [cl] MOCK_EVENTS → CarouselCard 변환 (오빗 카드용)
const EVENT_CARDS: CarouselCard[] = MOCK_EVENTS.map((ev) => ({
  title: ev.title.ko,
  desc: ev.summary.ko,
  image: ev.image_url,
}));

// [cl] 뷰 모드: orbit=캐러셀, marker=마커 탐색, null=기본
type ViewMode = "orbit" | "marker" | null;

// [cl] 스택/단독 마커 캐러셀: 커서 위치에 카드 배열, 클릭한 카드가 직접 확장
// 밖 클릭 시 카드들이 랜덤 방향으로 흩어지며 사라짐, 배경 컨테이너 없이 개별 그림자
function StackCarousel({
  events,
  position,
  onClose,
}: {
  events: MockEvent[];
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scattering, setScattering] = useState(false);
  // [cl] 흩어질 방향 벡터: 마운트 시 1회 생성
  const scatterVecsRef = useState<Array<{ tx: number; ty: number; rot: number }>>(() =>
    events.map(() => ({
      tx: (Math.random() - 0.5) * 500,
      ty: -(Math.random() * 300 + 80),
      rot: (Math.random() - 0.5) * 60,
    }))
  )[0];

  // [cl] 확장 카드 크기: 화면에 맞게 계산
  const CARD_W = typeof window !== "undefined" ? Math.min(500, Math.round(window.innerWidth * 0.88)) : 460;
  const MAX_H = typeof window !== "undefined" ? window.innerHeight - 80 : 600;
  const CARD_H = Math.min(Math.round(CARD_W * (4 / 3)), MAX_H);

  // [cl] 커서 위 배치: 뷰포트 경계 클램핑
  const MINI_W = events.length * 90 + Math.max(0, events.length - 1) * 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const clampedLeft = Math.max(16, Math.min(position.x - MINI_W / 2, vw - MINI_W - 16));
  const clampedTop = Math.max(16, Math.min(position.y - 140, vh - 180));

  const scatter = () => {
    if (scattering) return;
    setScattering(true);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_flyBack?.();
      onClose();
    }, 420);
  };

  return (
    <>
      {/* [cl] 전체화면 투명 오버레이: 밖 클릭 → scatter / 확장 카드 → 축소 */}
      <div
        className="fixed inset-0 z-[84]"
        onClick={activeId ? () => setActiveId(null) : scatter}
      />

      {/* [cl] 확장 카드용 딤 레이어 */}
      {activeId && (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm pointer-events-none" />
      )}

      {/* [cl] 카드들: 커서 위치에 플로팅, 확장 시 화면 중앙으로 이동 */}
      <div
        className="fixed z-[86] pointer-events-none"
        style={{
          left: activeId ? "50%" : clampedLeft,
          top: activeId ? "50%" : clampedTop,
          transform: activeId ? "translate(-50%, -50%)" : "none",
          display: "flex",
          gap: activeId ? 0 : 10,
          transition: "left 0.5s cubic-bezier(0.25,1,0.5,1), top 0.5s cubic-bezier(0.25,1,0.5,1), transform 0.5s cubic-bezier(0.25,1,0.5,1), gap 0.5s cubic-bezier(0.25,1,0.5,1)",
        }}
      >
        {events.map((ev, i) => {
          const isActive = activeId === ev.id;
          const isHidden = !!activeId && !isActive;
          const isHovered = hoveredId === ev.id && !isActive && !scattering;
          const vec = scatterVecsRef[i];

          return (
            <div
              key={ev.id}
              style={{
                width: isActive ? CARD_W : isHidden ? 0 : 90,
                height: isActive ? CARD_H : isHidden ? 0 : 120,
                flexShrink: 0,
                borderRadius: isActive ? 20 : 12,
                overflow: "hidden",
                position: "relative",
                cursor: isActive || scattering ? "default" : "pointer",
                opacity: isHidden || scattering ? 0 : 1,
                pointerEvents: scattering ? "none" : "auto",
                boxShadow: isActive
                  ? "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)"
                  : isHovered
                  ? "0 12px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)"
                  : "0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
                transform: scattering
                  ? `translate(${vec.tx}px, ${vec.ty}px) rotate(${vec.rot}deg)`
                  : isHovered
                  ? "scale(1.08) translateY(-4px)"
                  : "none",
                transition: scattering
                  ? "transform 0.4s cubic-bezier(0.4,0,1,1), opacity 0.3s ease"
                  : "width 0.5s cubic-bezier(0.25,1,0.5,1), height 0.5s cubic-bezier(0.25,1,0.5,1), opacity 0.3s ease, border-radius 0.5s ease, box-shadow 0.3s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={() => !isActive && setHoveredId(ev.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={!isActive && !scattering ? () => setActiveId(ev.id) : undefined}
            >
              {/* [cl] 미니 카드: 확장 시 페이드아웃 */}
              <div
                className="absolute inset-0"
                style={{
                  opacity: isActive ? 0 : 1,
                  transition: "opacity 0.2s ease",
                  pointerEvents: isActive ? "none" : "auto",
                }}
              >
                <img src={ev.image_url} alt={ev.title.ko} className="w-full h-full object-cover" />
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
                >
                  <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ev.title.ko}</p>
                  <p className="text-white/50 text-[9px] mt-0.5">{ev.start_year}</p>
                </div>
              </div>

              {/* [cl] 확장 콘텐츠: 카드 커진 뒤 페이드인 */}
              {isActive && (
                <div
                  className="absolute inset-0 overflow-y-auto bg-white"
                  style={{ animation: "fadeIn 0.3s 0.25s both" }}
                >
                  <button
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black/60 text-lg leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveId(null);
                    }}
                  >
                    ✕
                  </button>
                  <EventDetailContent
                    event={ev}
                    theme="light"
                    relatedEvents={MOCK_EVENTS.filter((e) => e.id !== ev.id).slice(0, 4)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  // [cl] 마커 클릭 상태: 단독/스택 모두 StackCarousel로 통합
  const [stackState, setStackState] = useState<{ events: MockEvent[]; pos: { x: number; y: number } } | null>(null);
  const carouselOpen = viewMode === "orbit";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Header />
      <Dashboard events={MOCK_EVENTS} />
      <DateDisplay />
      <Timeline />
      <TimeDial defaultYear={1875} />

      {/* [cl] 지구본: orbit/marker 모드 전달 */}
      <GlobeLoader
        orbitActive={carouselOpen}
        markerMode={viewMode === "marker"}
        events={MOCK_EVENTS}
        onStackClick={(evs, pos) => setStackState({ events: evs, pos })}
      />

      {/* [cl] Event Orbit / Event Marker 토글 버튼 */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[60] flex gap-3 pointer-events-auto">
        <button
          onClick={() => setViewMode((v) => (v === "orbit" ? null : "orbit"))}
          className={`px-5 py-2.5 rounded-full backdrop-blur-md border text-sm uppercase tracking-widest transition-all duration-300 ${
            viewMode === "orbit"
              ? "bg-white/25 border-white/40 text-white"
              : "bg-white/10 border-white/20 text-white/60 hover:bg-white/15"
          }`}
          style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
        >
          Event Orbit
        </button>
        <button
          onClick={() => setViewMode((v) => (v === "marker" ? null : "marker"))}
          className={`px-5 py-2.5 rounded-full backdrop-blur-md border text-sm uppercase tracking-widest transition-all duration-300 ${
            viewMode === "marker"
              ? "bg-white/25 border-white/40 text-white"
              : "bg-white/10 border-white/20 text-white/60 hover:bg-white/15"
          }`}
          style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
        >
          Event Marker
        </button>
        {/* [cl] 카메라 리셋: 적도 기본 뷰로 복귀 (마커 탐색 후 복원 등에 활용) */}
        <button
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__timeglobe_markerFocused = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reset = (window as any).__timeglobe_resetToDefault;
            if (reset) reset();
          }}
          className="px-5 py-2.5 rounded-full backdrop-blur-md border text-sm uppercase tracking-widest transition-all duration-300 bg-white/10 border-white/20 text-white/60 hover:bg-white/15"
          style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
        >
          Reset View
        </button>
      </div>

      {/* [cl] 마커 클릭: 단독/스택 모두 StackCarousel로 통합 처리 */}
      {stackState && (
        <StackCarousel
          events={stackState.events}
          position={stackState.pos}
          onClose={() => setStackState(null)}
        />
      )}

      {/* [cl] 오빗 캐러셀 + 카드 클릭 시 인라인 상세 콘텐츠 */}
      <Carousel3D
        items={EVENT_CARDS}
        isOpen={carouselOpen}
        onClose={() => setViewMode(null)}
        renderDetail={(originalIndex) => {
          const ev = MOCK_EVENTS[originalIndex];
          return (
            <EventDetailContent
              event={ev}
              theme="light"
              relatedEvents={MOCK_EVENTS.filter((e) => e.id !== ev.id).slice(0, 4)}
            />
          );
        }}
      />
    </main>
  );
}
