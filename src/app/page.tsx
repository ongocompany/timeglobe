"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Timeline from "@/components/ui/Timeline";
import Carousel3D, { type CarouselCard } from "@/components/ui/Carousel3D";
import { EventDetailContent } from "@/components/ui/HistoryEventModal";
import { MOCK_EVENTS } from "@/data/mockEvents";

// [cl] MOCK_EVENTS → CarouselCard 변환 (오빗 카드용)
const EVENT_CARDS: CarouselCard[] = MOCK_EVENTS.map((ev) => ({
  title: ev.title.ko,
  desc: ev.summary.ko,
  image: ev.image_url,
}));

// [cl] 뷰 모드: orbit=캐러셀, marker=마커 탐색, null=기본
type ViewMode = "orbit" | "marker" | null;

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const carouselOpen = viewMode === "orbit";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Header />
      <DateDisplay />
      <Timeline />

      {/* [cl] 지구본: 원래 크기 유지 (카드가 궤도 위에서 감싸는 형태) */}
      <GlobeLoader orbitActive={carouselOpen} />

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
            const reset = (window as any).__timeglobe_resetToDefault;
            if (reset) reset();
          }}
          className="px-5 py-2.5 rounded-full backdrop-blur-md border text-sm uppercase tracking-widest transition-all duration-300 bg-white/10 border-white/20 text-white/60 hover:bg-white/15"
          style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
        >
          Reset View
        </button>
      </div>

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
