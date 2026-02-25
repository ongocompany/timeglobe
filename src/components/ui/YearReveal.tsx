"use client";

// [cl] 워프 완료 후 연도 타이포 리빌 + 파티클 dissolve 효과
// Phase 1: 텍스트 등장 (scale + blur reveal, 500ms)
// Phase 2: 텍스트 유지 (500ms)
// Phase 3: 파티클 분해 (텍스트 → ~1000개 입자 → 산란 소멸, ~1000ms)

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
  const textRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const [phase, setPhase] = useState<"text" | "dissolve" | "done">("text");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // [cl] 텍스트에서 파티클 생성: offscreen canvas에 렌더 → 픽셀 샘플링
  const createParticles = useCallback(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    const rect = textEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // [cl] offscreen canvas에 동일 텍스트 렌더
    const offscreen = document.createElement("canvas");
    const ow = Math.ceil(rect.width * dpr);
    const oh = Math.ceil(rect.height * dpr);
    offscreen.width = ow;
    offscreen.height = oh;
    const octx = offscreen.getContext("2d")!;
    octx.scale(dpr, dpr);

    // [cl] 폰트 스타일 복제
    const style = getComputedStyle(textEl);
    octx.font = style.font;
    octx.fillStyle = "white";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(String(year), rect.width / 2, rect.height / 2);

    // [cl] 픽셀 데이터에서 밝은 점 샘플링
    const imageData = octx.getImageData(0, 0, ow, oh);
    const pixels = imageData.data;
    const candidates: Array<{ x: number; y: number }> = [];

    // [cl] 3px 간격으로 스캔하여 후보 수집
    for (let py = 0; py < oh; py += 3) {
      for (let px = 0; px < ow; px += 3) {
        const i = (py * ow + px) * 4;
        if (pixels[i + 3] > 128) {
          candidates.push({ x: px / dpr, y: py / dpr });
        }
      }
    }

    // [cl] ~1000개 파티클로 균등 샘플링
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

        // [cl] 물리 업데이트
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.025;          // 약한 중력
        p.opacity -= 0.014;     // ~71프레임 ≈ 1.2초에 소멸
        p.size *= 0.996;        // 서서히 축소

        if (p.opacity <= 0) continue;
        alive++;

        // [cl] 렌더: 원형 파티클 + glow
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

  // [cl] done → onComplete 콜백
  useEffect(() => {
    if (phase === "done") {
      onCompleteRef.current();
    }
  }, [phase]);

  // [cl] 타이밍: 등장(0) → 1000ms 후 dissolve 시작
  useEffect(() => {
    if (!visible) return;
    setPhase("text");

    const timer = setTimeout(() => {
      createParticles();
      setPhase("dissolve");
    }, 1000);

    return () => clearTimeout(timer);
  }, [visible, createParticles]);

  if (!visible || phase === "done") return null;

  return (
    <div className="relative" style={{ width: 520, height: 200 }}>
      {/* [cl] Phase 1-2: 텍스트 (등장 애니메이션 + 유지) */}
      <div
        ref={textRef}
        className="absolute inset-0 flex items-center justify-center select-none"
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "clamp(100px, 15vw, 180px)",
          fontWeight: 700,
          color: "white",
          letterSpacing: "0.05em",
          textShadow:
            "0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.25), 0 0 120px rgba(255,255,255,0.1)",
          opacity: phase === "text" ? 1 : 0,
          transform: phase === "text" ? "scale(1)" : "scale(1.02)",
          filter: phase === "text" ? "blur(0px)" : "blur(4px)",
          transition: phase === "dissolve"
            ? "opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease"
            : "none",
          animation: phase === "text" ? "yearRevealIn 0.5s cubic-bezier(0.25,1,0.5,1) both" : "none",
        }}
      >
        {year}
      </div>

      {/* [cl] Phase 3: 파티클 캔버스 (텍스트 위치와 동일) */}
      {phase === "dissolve" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      {/* [cl] 등장 키프레임 */}
      <style jsx>{`
        @keyframes yearRevealIn {
          0% {
            opacity: 0;
            transform: scale(0.85);
            filter: blur(12px) brightness(1.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px) brightness(1);
          }
        }
      `}</style>
    </div>
  );
}
