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
  markerMode?: boolean;
  events?: MockEvent[];
  onStackClick?: (events: MockEvent[], pos: { x: number; y: number }) => void;
}

export default function GlobeLoader({
  orbitActive = false,
  markerMode = false,
  events = [],
  onStackClick,
}: GlobeLoaderProps) {
  return (
    <CesiumGlobe
      orbitActive={orbitActive}
      markerMode={markerMode}
      events={events}
      onStackClick={onStackClick}
    />
  );
}
