"use client";

// [cl] 헤더: 로딩 시 중앙 대형 타이틀 → globe ready 후 좌상단 컴팩트 로고 전환
import { useState, useEffect } from "react";

export default function Header() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onReady = () => setCompact(true);
    window.addEventListener("timeglobe:globeReady", onReady);
    return () => window.removeEventListener("timeglobe:globeReady", onReady);
  }, []);

  return (
    <>
      {/* [cl] 컴팩트 로고 — globe ready 후 좌상단에 나타남 */}
      <div
        className={`absolute top-5 left-6 z-20 pointer-events-none transition-all duration-1000 flex items-center gap-2 ${
          compact ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* [cl] 스탑워치 아이콘 — SVG animateTransform으로 초침 회전 */}
        <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
          <rect x="5.5" y="0" width="5" height="2.5" rx="1" fill="rgba(255,255,255,0.65)" />
          <circle cx="8" cy="12" r="7.5" stroke="rgba(255,255,255,0.70)" strokeWidth="1.2" />
          <line x1="8" y1="12" x2="8" y2="6" stroke="rgba(255,255,255,0.90)" strokeWidth="1.3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="360 8 12" to="0 8 12" dur="3s" repeatCount="indefinite" />
          </line>
          <circle cx="8" cy="12" r="1" fill="rgba(255,255,255,0.90)" />
        </svg>
        <span
          className="uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-noto-sans), sans-serif",
            fontWeight: 800,
            fontSize: "1.2rem",
            color: "rgba(255,255,255,0.90)",
            textShadow: "0 0 12px rgba(255,255,255,0.25)",
          }}
        >
          Time Globe
        </span>
      </div>

      {/* [cl] 초기 대형 타이틀 — globe ready 후 블러 아웃 */}
      <div
        className={`absolute top-0 left-0 w-full pt-16 pb-32 text-center z-10 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-all duration-1000 ${
          compact ? "opacity-0 blur-md" : "opacity-100 blur-none"
        }`}
      >
        <h1
          className="uppercase tracking-widest animate-blur-reveal"
          style={{
            fontFamily: "var(--font-noto-sans), sans-serif",
            fontWeight: 800,
            fontSize: "4.875rem",
            color: "transparent",
            WebkitTextStroke: "2px rgba(255, 255, 255, 0.95)",
            textShadow:
              "0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15), 0 4px 32px rgba(255, 255, 255, 0.2)",
            animationDelay: "0.2s",
          }}
        >
          Time Globe
        </h1>
        <p
          className="mt-4 tracking-wide text-white/90 drop-shadow-md animate-blur-reveal"
          style={{
            fontFamily: "var(--font-noto-sans), sans-serif",
            fontWeight: 220,
            fontSize: "1.25rem",
            animationDelay: "0.5s",
          }}
        >
          Travel through time, see what happened.
        </p>
      </div>
    </>
  );
}
