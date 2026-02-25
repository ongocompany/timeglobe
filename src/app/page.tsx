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

// [cl] 스택 마커 캐러셀: 카드 클릭 시 해당 카드가 위로 직접 커지면서 모달로 변신 (오빗 패턴)
function StackCarousel({ events, onClose }: { events: MockEvent[]; onClose: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // [cl] 확장 카드 크기: 화면에 맞게 계산
  const CARD_W = typeof window !== "undefined" ? Math.min(520, Math.round(window.innerWidth * 0.88)) : 480;
  const MAX_H = typeof window !== "undefined" ? window.innerHeight - 112 - 48 : 600;
  const CARD_H = Math.min(Math.round(CARD_W * (4 / 3)), MAX_H);

  return (
    <>
      {/* [cl] 배경 딤: 카드 확장 시에만 등장 */}
      {activeId && (
        <div
          className="fixed inset-0 z-[84] bg-black/65 backdrop-blur-sm"
          onClick={() => setActiveId(null)}
        />
      )}

      {/* [cl] 캐러셀 컨테이너: bottom 고정 → 카드가 위로 자람 */}
      <div
        className="fixed z-[85] pointer-events-auto"
        style={{
          bottom: "7rem",
          left: "50%",
          animation: "stack-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <div
          className="relative flex rounded-2xl border"
          style={{
            background: activeId ? "transparent" : "rgba(0,0,0,0.65)",
            backdropFilter: "blur(12px)",
            borderColor: activeId ? "transparent" : "rgba(255,255,255,0.1)",
            gap: activeId ? 0 : 12,
            padding: activeId ? 0 : 12,
            transition:
              "background 0.4s ease, border-color 0.4s ease, gap 0.5s cubic-bezier(0.25,1,0.5,1), padding 0.5s cubic-bezier(0.25,1,0.5,1)",
          }}
        >
          {/* [cl] 닫기 버튼: 캐러셀 상태에서만 표시 */}
          {!activeId && (
            <button
              className="absolute -top-3 -right-3 z-10 w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 text-white/70 text-sm flex items-center justify-center transition-colors"
              onClick={onClose}
            >
              ✕
            </button>
          )}

          {events.map((ev) => {
            const isActive = activeId === ev.id;
            const isHidden = !!activeId && !isActive;

            return (
              <div
                key={ev.id}
                style={{
                  width: isActive ? CARD_W : isHidden ? 0 : 90,
                  height: isActive ? CARD_H : isHidden ? 0 : 120,
                  flexShrink: 0,
                  borderRadius: isActive ? 16 : 12,
                  overflow: "hidden",
                  position: "relative",
                  cursor: isActive ? "default" : "pointer",
                  opacity: isHidden ? 0 : 1,
                  transition:
                    "width 0.5s cubic-bezier(0.25, 1, 0.5, 1), height 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease, border-radius 0.5s ease",
                }}
                onClick={!isActive ? () => setActiveId(ev.id) : undefined}
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

                {/* [cl] 확장 콘텐츠: 카드가 다 커진 뒤 페이드인 */}
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
      </div>
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
