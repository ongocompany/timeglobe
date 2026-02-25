"use client";

// [cl] 워프 완료 후 "Welcome to XXXX" 블러 리빌 + 파티클 dissolve
// Phase 1: 개별 단어 블러 텍스트 등장 (word_effect.txt 패턴 — 스태거 딜레이)
//   - "Welcome" → "to" → 연도 순서로 블러에서 선명하게
// Phase 2: 전체 텍스트 → ~1000개 파티클로 분해 → 산란 소멸

import { useEffect, useRef, useState, useCallback } from "react";

interface YearRevealProps {
  year: number;
  visible: boolean;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
}

export default function YearReveal({ year, visible, onComplete }: YearRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const [phase, setPhase] = useState<"text" | "dissolve" | "done">("text");
  const [isAnimating, setIsAnimating] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // [cl] 텍스트에서 파티클 생성: offscreen canvas에 2줄 렌더 → 픽셀 샘플링
  const createParticles = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const offscreen = document.createElement("canvas");
    const ow = Math.ceil(rect.width * dpr);
    const oh = Math.ceil(rect.height * dpr);
    offscreen.width = ow;
    offscreen.height = oh;
    const octx = offscreen.getContext("2d")!;
    octx.scale(dpr, dpr);
    octx.fillStyle = "white";
    octx.textAlign = "center";

    // [cl] 1줄: "Welcome to" (작은 폰트)
    const smallSize = Math.min(26, Math.max(16, rect.width * 0.042));
    octx.font = `300 ${smallSize}px system-ui, sans-serif`;
    octx.fillText("Welcome to", rect.width / 2, rect.height * 0.28);

    // [cl] 2줄: 연도 (큰 모노 폰트)
    const bigSize = Math.min(150, Math.max(80, rect.width * 0.26));
    octx.font = `700 ${bigSize}px monospace`;
    octx.fillText(String(year), rect.width / 2, rect.height * 0.68);

    // [cl] 픽셀 샘플링
    const imageData = octx.getImageData(0, 0, ow, oh);
    const pixels = imageData.data;
    const candidates: Array<{ x: number; y: number }> = [];

    for (let py = 0; py < oh; py += 3) {
      for (let px = 0; px < ow; px += 3) {
        const i = (py * ow + px) * 4;
        if (pixels[i + 3] > 128) {
          candidates.push({ x: px / dpr, y: py / dpr });
        }
      }
    }

    const TARGET_COUNT = 1000;
    const step = Math.max(1, Math.floor(candidates.length / TARGET_COUNT));
    const particles: Particle[] = [];
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    for (let i = 0; i < candidates.length; i += step) {
      const { x, y } = candidates[i];
      const dx = x - cx;
      const dy = y - cy;
      const spread = 0.5 + Math.random() * 1.5;

      particles.push({
        x,
        y,
        vx: dx * spread * 0.12 + (Math.random() - 0.5) * 0.8,
        vy: dy * spread * 0.12 + (Math.random() - 0.5) * 0.8,
        opacity: 1.0,
        size: 1.5 + Math.random() * 2.0,
      });
    }

    particlesRef.current = particles;
  }, [year]);

  // [cl] 파티클 애니메이션 루프
  useEffect(() => {
    if (phase !== "dissolve") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      let alive = 0;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.opacity <= 0) continue;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025;
        p.opacity -= 0.014;
        p.size *= 0.996;

        if (p.opacity <= 0) continue;
        alive++;

        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
        ctx.shadowBlur = p.size * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (alive > 0) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setPhase("done");
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [phase]);

  // [cl] done → onComplete
  useEffect(() => {
    if (phase === "done") onCompleteRef.current();
  }, [phase]);

  // [cl] 타이밍: 200ms 후 블러 애니메이션 시작 → 2.5초 후 dissolve
  useEffect(() => {
    if (!visible) return;
    setPhase("text");
    setIsAnimating(false);

    const animTimer = setTimeout(() => setIsAnimating(true), 200);
    const dissolveTimer = setTimeout(() => {
      createParticles();
      setPhase("dissolve");
    }, 2500);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(dissolveTimer);
    };
  }, [visible, createParticles]);

  if (!visible || phase === "done") return null;

  // [cl] 블러 리빌 단어 정의: Welcome, to (작은 서브), year (큰 메인)
  const subWords = [
    { text: "Welcome", delay: 0, duration: 1.8, blur: 14 },
    { text: "to", delay: 0.12, duration: 1.8, blur: 12 },
  ];
  const yearWord = { delay: 0.3, duration: 2.2, blur: 18 };

  return (
    <div ref={containerRef} className="relative" style={{ width: 520, height: 240 }}>
      {/* [cl] 블러 텍스트 레이어 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center select-none"
        style={{
          opacity: phase === "text" ? 1 : 0,
          transition: phase === "dissolve" ? "opacity 0.12s ease" : "none",
        }}
      >
        {/* [cl] "Welcome to" — 작은 서브 텍스트, 개별 단어 스태거 블러 */}
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
                opacity: isAnimating ? 1 : 0,
                filter: isAnimating
                  ? "blur(0px) brightness(1)"
                  : `blur(${w.blur}px) brightness(0.6)`,
                transform: isAnimating
                  ? "translateY(0) scale(1)"
                  : "translateY(12px) scale(0.92)",
                transitionProperty: "opacity, filter, transform",
                transitionDuration: `${w.duration}s`,
                transitionDelay: `${w.delay}s`,
                transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                textShadow: isAnimating
                  ? "0 2px 8px rgba(255,255,255,0.1)"
                  : "0 0 30px rgba(255,255,255,0.4)",
                willChange: "filter, transform, opacity",
              }}
            >
              {w.text}
            </span>
          ))}
        </div>

        {/* [cl] 연도 — 큰 모노 텍스트, 블러 리빌 */}
        <span
          className="inline-block"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "clamp(80px, 14vw, 150px)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            lineHeight: 1,
            color: "white",
            opacity: isAnimating ? 1 : 0,
            filter: isAnimating
              ? "blur(0px) brightness(1)"
              : `blur(${yearWord.blur}px) brightness(0.6)`,
            transform: isAnimating
              ? "translateY(0) scale(1) rotateX(0deg)"
              : "translateY(20px) scale(0.9) rotateX(-15deg)",
            transitionProperty: "opacity, filter, transform",
            transitionDuration: `${yearWord.duration}s`,
            transitionDelay: `${yearWord.delay}s`,
            transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            textShadow: isAnimating
              ? "0 2px 12px rgba(255,255,255,0.15)"
              : "0 0 50px rgba(255,255,255,0.5)",
            willChange: "filter, transform, opacity",
            transformStyle: "preserve-3d",
          }}
        >
          {year}
        </span>
      </div>

      {/* [cl] 파티클 캔버스 */}
      {phase === "dissolve" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
