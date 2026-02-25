"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState, useRef } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Timeline from "@/components/ui/Timeline";
import Carousel3D, { type CarouselCard } from "@/components/ui/Carousel3D";
import { EventDetailContent } from "@/components/ui/HistoryEventModal";
import Dashboard from "@/components/ui/Dashboard";
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

// [cl] 스택 마커 미니 캐러셀: 하단 카드 나열 → 클릭 시 모달 scale-in (오빗과 동일 패턴)
function StackCarousel({ events, onClose }: { events: MockEvent[]; onClose: () => void }) {
  const [expandedEvent, setExpandedEvent] = useState<MockEvent | null>(null);
  const [expanding, setExpanding] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCard = (ev: MockEvent) => {
    setExpandedEvent(ev);
    // rAF 두 번: DOM 삽입 → 다음 프레임에 클래스 적용 → 트랜지션 발동
    requestAnimationFrame(() => requestAnimationFrame(() => setExpanding(true)));
  };

  const closeCard = () => {
    setExpanding(false);
    closeTimerRef.current = setTimeout(() => setExpandedEvent(null), 420);
  };

  return (
    <>
      {/* [cl] 미니 캐러셀: 카드 확장 시 아래로 페이드아웃 */}
      <div
        className="absolute bottom-28 z-[85] pointer-events-auto"
        style={{
          left: "50%",
          animation: "stack-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          opacity: expanding ? 0 : 1,
          transform: expanding
            ? "translateX(-50%) translateY(12px) scale(0.9)"
            : "translateX(-50%)",
          transition: "opacity 0.22s ease, transform 0.22s ease",
          pointerEvents: expanding ? "none" : "auto",
        }}
      >
        <div className="relative flex gap-3 p-3 bg-black/65 backdrop-blur-md rounded-2xl border border-white/10">
          <button
            className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 text-white/70 text-sm flex items-center justify-center transition-colors"
            onClick={onClose}
          >✕</button>
          {events.map((ev) => (
            <div
              key={ev.id}
              className="relative flex-shrink-0 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200"
              style={{ width: 90, height: 120 }}
              onClick={() => openCard(ev)}
            >
              <img src={ev.image_url} alt={ev.title.ko} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
                <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ev.title.ko}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{ev.start_year}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* [cl] 확장 모달: 아래서 scale-up (스프링 이징) */}
      {expandedEvent && (
        <div
          className="absolute inset-0 z-[86] flex items-center justify-center pointer-events-auto"
          style={{
            background: expanding ? "rgba(0,0,0,0.65)" : "transparent",
            transition: "background 0.38s",
          }}
          onClick={closeCard}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl mx-4 overflow-hidden"
            style={{
              maxHeight: "80vh",
              transform: expanding ? "scale(1) translateY(0)" : "scale(0.82) translateY(50px)",
              opacity: expanding ? 1 : 0,
              transition: "transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), opacity 0.32s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black/60 text-lg leading-none"
              onClick={closeCard}
            >✕</button>
            <div className="overflow-y-auto" style={{ maxHeight: "80vh" }}>
              <EventDetailContent
                event={expandedEvent}
                theme="light"
                relatedEvents={MOCK_EVENTS.filter((e) => e.id !== expandedEvent.id).slice(0, 4)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [selectedEvent, setSelectedEvent] = useState<MockEvent | null>(null);
  const [stackEvents, setStackEvents] = useState<MockEvent[]>([]);
  const carouselOpen = viewMode === "orbit";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Header />
      <Dashboard events={MOCK_EVENTS} />
      <DateDisplay />
      <Timeline />

      {/* [cl] 지구본: orbit/marker 모드 전달 */}
      <GlobeLoader
        orbitActive={carouselOpen}
        markerMode={viewMode === "marker"}
        events={MOCK_EVENTS}
        onMarkerClick={(ev) => setSelectedEvent(ev)}
        onStackClick={(evs) => setStackEvents(evs)}
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

      {/* [cl] 스택 마커 클릭: 미니 캐러셀 → 카드 클릭 시 모달 scale-in */}
      {stackEvents.length > 0 && (
        <StackCarousel events={stackEvents} onClose={() => setStackEvents([])} />
      )}

      {/* [cl] Event Marker 모달: 마커 클릭 시 이벤트 상세 표시, 닫으면 원래 카메라로 복귀 */}
      {selectedEvent && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-auto">
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelectedEvent(null);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (window as any).__timeglobe_flyBack?.();
            }}
          />
          {/* 모달 패널 */}
          <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-2xl mx-4">
            <button
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black/60 text-lg leading-none"
              onClick={() => {
                setSelectedEvent(null);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__timeglobe_flyBack?.();
              }}
            >
              ✕
            </button>
            <EventDetailContent
              event={selectedEvent}
              theme="light"
              relatedEvents={MOCK_EVENTS.filter((e) => e.id !== selectedEvent.id).slice(0, 4)}
            />
          </div>
        </div>
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
