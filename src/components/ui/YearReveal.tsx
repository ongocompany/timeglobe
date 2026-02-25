"use client";

// [cl] 워프 완료 후 "Welcome to XXXX" 블러 리빌 + 역재생 퇴장
// Phase 1 (reveal): 개별 단어 blur→clear 스태거 등장 (~2s)
// Phase 2 (hold): 텍스트 유지 (~1.5s)
// Phase 3 (fadeout): clear→blur 역스태거 퇴장 (연도 먼저 → Welcome 마지막)

import { useEffect, useRef, useState } from "react";

interface YearRevealProps {
  year: number;
  visible: boolean;
  onComplete: () => void;
}

export default function YearReveal({ year, visible, onComplete }: YearRevealProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // [cl] 타이밍:
  //   0ms    → 블러 상태 배치
  //   200ms  → reveal 시작 (blur→clear, 스태거)
  //   3500ms → fadeout 시작 (clear→blur, 역스태거) [기존 2500 + 1000]
  //   5000ms → onComplete
  useEffect(() => {
    if (!visible) return;
    setIsAnimating(false);
    setIsFading(false);

    const revealTimer = setTimeout(() => setIsAnimating(true), 200);

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
      setIsAnimating(false);
    }, 3500);

    // [cl] 퇴장 트랜지션 완료 대기 (가장 긴 delay 0.3s + duration 1.2s = 1.5s)
    const doneTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 5000);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [visible]);

  if (!visible) return null;

  // [cl] 등장/퇴장 단어별 타이밍 정의
  // 등장: Welcome(0s) → to(0.12s) → 연도(0.3s) — 순서대로
  // 퇴장: 연도(0s) → to(0.1s) → Welcome(0.2s) — 역순, 짧은 duration
  const subWords = [
    {
      text: "Welcome",
      revealDelay: 0, revealDuration: 1.8, blur: 14,
      fadeDelay: 0.2, fadeDuration: 1.0,
    },
    {
      text: "to",
      revealDelay: 0.12, revealDuration: 1.8, blur: 12,
      fadeDelay: 0.1, fadeDuration: 1.0,
    },
  ];
  const yearWord = {
    revealDelay: 0.3, revealDuration: 2.2, blur: 18,
    fadeDelay: 0, fadeDuration: 1.2,
  };

  const active = isAnimating && !isFading;

  return (
    <div className="relative" style={{ width: 520, height: 240 }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        {/* [cl] "Welcome to" — 작은 서브 텍스트 */}
        <div
          className="flex gap-[0.35em] mb-2"
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: "clamp(18px, 2.5vw, 26px)",
            fontWeight: 300,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {subWords.map((w, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                color: "white",
                opacity: active ? 1 : 0,
                filter: active
                  ? "blur(0px) brightness(1)"
                  : `blur(${w.blur}px) brightness(0.6)`,
                transform: active
                  ? "translateY(0) scale(1)"
                  : "translateY(12px) scale(0.92)",
                transitionProperty: "opacity, filter, transform",
                transitionDuration: isFading ? `${w.fadeDuration}s` : `${w.revealDuration}s`,
                transitionDelay: isFading ? `${w.fadeDelay}s` : `${w.revealDelay}s`,
                transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                textShadow: active
                  ? "0 2px 8px rgba(255,255,255,0.1)"
                  : "0 0 30px rgba(255,255,255,0.4)",
                willChange: "filter, transform, opacity",
              }}
            >
              {w.text}
            </span>
          ))}
        </div>

        {/* [cl] 연도 — 큰 모노 텍스트 */}
        <span
          className="inline-block"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "clamp(80px, 14vw, 150px)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            lineHeight: 1,
            color: "white",
            opacity: active ? 1 : 0,
            filter: active
              ? "blur(0px) brightness(1)"
              : `blur(${yearWord.blur}px) brightness(0.6)`,
            transform: active
              ? "translateY(0) scale(1) rotateX(0deg)"
              : "translateY(20px) scale(0.9) rotateX(-15deg)",
            transitionProperty: "opacity, filter, transform",
            transitionDuration: isFading ? `${yearWord.fadeDuration}s` : `${yearWord.revealDuration}s`,
            transitionDelay: isFading ? `${yearWord.fadeDelay}s` : `${yearWord.revealDelay}s`,
            transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            textShadow: active
              ? "0 2px 12px rgba(255,255,255,0.15)"
              : "0 0 50px rgba(255,255,255,0.5)",
            willChange: "filter, transform, opacity",
            transformStyle: "preserve-3d",
          }}
        >
          {year}
        </span>
      </div>
    </div>
  );
}
