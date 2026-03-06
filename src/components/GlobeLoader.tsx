"use client";

// [cl] CesiumGlobe를 SSR 없이 로딩하는 클라이언트 래퍼
import dynamic from "next/dynamic";
import type { MockEvent } from "@/data/mockEvents";

const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
      Loading Globe...
    </div>
  ),
});

interface GlobeLoaderProps {
  orbitActive?: boolean;
  orbitPaused?: boolean;
  globePaused?: boolean;
  globeDirection?: "left" | "right";
  markerMode?: boolean;
  events?: MockEvent[];
  onStackClick?: (events: MockEvent[], pos: { x: number; y: number }) => void;
  warpPhase?: "idle" | "zoomout" | "hold" | "zoomin";
  onSpinWarp?: (direction: "past" | "future") => void;
  currentYear?: number; // [cl] 역사 국경선 표시용
  visibleTiers?: number[];   // [mk] 표시할 티어 목록
  showFill?: boolean;        // [mk] OHM 폴리곤 채우기 여부
  showBorder?: boolean;      // [mk] OHM 국경선 표시 여부
  popupOpen?: boolean;       // [cl] 캐러셀 열림 → 툴팁 숨김
}

export default function GlobeLoader({
  orbitActive = false,
  orbitPaused = false,
  globePaused = false,
  globeDirection = "left",
  markerMode = false,
  events = [],
  onStackClick,
  warpPhase = "idle",
  onSpinWarp,
  currentYear = 1875,
  visibleTiers,
  showFill,
  showBorder,
  popupOpen,
}: GlobeLoaderProps) {
  return (
    <CesiumGlobe
      orbitActive={orbitActive}
      orbitPaused={orbitPaused}
      globePaused={globePaused}
      globeDirection={globeDirection}
      markerMode={markerMode}
      events={events}
      onStackClick={onStackClick}
      warpPhase={warpPhase}
      onSpinWarp={onSpinWarp}
      currentYear={currentYear}
      visibleTiers={visibleTiers}
      showFill={showFill}
      showBorder={showBorder}
      popupOpen={popupOpen}
    />
  );
}
