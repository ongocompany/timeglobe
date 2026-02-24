"use client";

// [cl] CesiumGlobe를 SSR 없이 로딩하는 클라이언트 래퍼
import dynamic from "next/dynamic";

const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
      Loading Globe...
    </div>
  ),
});

export default function GlobeLoader({ orbitActive = false }: { orbitActive?: boolean }) {
  return <CesiumGlobe orbitActive={orbitActive} />;
}
