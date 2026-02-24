"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Timeline from "@/components/ui/Timeline";
import Carousel3D, { type CarouselCard } from "@/components/ui/Carousel3D";

// [cl] 테스트용 샘플 데이터 (나중에 역사 이벤트 DB에서 가져올 예정)
const SAMPLE_CARDS: CarouselCard[] = [
  { title: "PEAK", desc: "Reach the highest point of nature", image: "https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=800&q=80" },
  { title: "VALLEY", desc: "Discover the hidden depths", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80" },
  { title: "FOREST", desc: "Embrace the profound green silence", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80" },
  { title: "OCEAN", desc: "Listen to the deep blue whispers", image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80" },
  { title: "DESERT", desc: "Feel the warmth of golden sands", image: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=80" },
  { title: "WINTER", desc: "Experience the pure white snow", image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80" },
  { title: "CANYON", desc: "Witness the ancient rock formations", image: "https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?auto=format&fit=crop&w=800&q=80" },
  { title: "NIGHT", desc: "Gaze at the endless bright stars", image: "https://images.unsplash.com/photo-1520208422220-d12a3c588e6c?auto=format&fit=crop&w=800&q=80" },
  { title: "RIVER", desc: "Flow with the endless stream", image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80" },
  { title: "VOLCANO", desc: "Feel the earth's fiery core", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80" },
];

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
      </div>

      <Carousel3D
        items={SAMPLE_CARDS}
        isOpen={carouselOpen}
        onClose={() => setViewMode(null)}
      />
    </main>
  );
}
