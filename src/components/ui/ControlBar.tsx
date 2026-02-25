"use client";

// [cl] 지구본 하단 컨트롤 바: 타임입력 + 자전제어 + 방향 + 리셋
// 위치: absolute bottom-6 left-1/2 -translate-x-1/2
// 스타일: TimeDial 글래스 렌즈와 동일한 glassmorphism 필

import { useState, useRef, useEffect, useCallback } from "react";

interface ControlBarProps {
  year: number;
  paused: boolean;
  direction: "left" | "right";
  warping: boolean;
  onYearCommit: (year: number) => void;
  onPauseToggle: () => void;
  onDirectionChange: (dir: "left" | "right") => void;
  onReset: () => void;
}

const fmt = (y: number) => (y < 0 ? `${Math.abs(y)} BC` : `${y}`);

export default function ControlBar({
  year,
  paused,
  direction,
  warping,
  onYearCommit,
  onPauseToggle,
  onDirectionChange,
  onReset,
}: ControlBarProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const yearAreaRef = useRef<HTMLDivElement>(null);
  // [cl] 휠 가속: native 이벤트 리스너 (passive: false) + ref로 최신 값 추적
  const editingRef = useRef(false);
  const yearRef = useRef(year);
  yearRef.current = year;
  const warpingRef = useRef(warping);
  warpingRef.current = warping;
  const wheelCountRef = useRef(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelDirRef = useRef<number>(0); // [cl] 마지막 휠 방향 (1=위, -1=아래)

  const setEditingSync = useCallback((v: boolean) => { setEditing(v); editingRef.current = v; }, []);

  const startEdit = () => {
    if (warping) return;
    setInputVal(String(year));
    setEditingSync(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n)) onYearCommit(Math.max(-3000, Math.min(2100, n)));
    setEditingSync(false);
  };

  // [cl] 연속 휠 틱 수에 따른 가속 단계 (넉넉한 임계값)
  const getWheelStep = (count: number) => {
    if (count < 10) return 1;
    if (count < 25) return 5;
    if (count < 45) return 10;
    if (count < 70) return 50;
    if (count < 100) return 100;
    if (count < 140) return 500;
    return 1000;
  };

  // [cl] native wheel 이벤트: passive:false로 preventDefault 가능 + type="number" 충돌 방지
  useEffect(() => {
    const el = yearAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (warpingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      // [cl] 휠 방향 전환 감지 → 즉시 가속 리셋 (정밀 탐색용)
      const dir = e.deltaY > 0 ? -1 : 1;
      if (dir !== wheelDirRef.current) {
        wheelCountRef.current = 0;
        wheelDirRef.current = dir;
      }
      wheelCountRef.current += 1;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => { wheelCountRef.current = 0; }, 300);

      const step = getWheelStep(wheelCountRef.current);
      const delta = e.deltaY > 0 ? -step : step;

      if (!editingRef.current) {
        setInputVal(String(Math.max(-3000, Math.min(2100, yearRef.current + delta))));
        setEditingSync(true);
      } else {
        setInputVal((prev) => {
          const n = parseInt(prev, 10) || 0;
          return String(Math.max(-3000, Math.min(2100, n + delta)));
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setEditingSync]);

  // [cl] 공통 아이콘 버튼 스타일
  const iconBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "rgba(255,255,255,0.45)",
    transition: "color 0.2s",
    flexShrink: 0,
  };

  // [cl] 수직 구분선
  const Divider = () => (
    <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
  );

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 pointer-events-auto select-none"
      style={{
        padding: "8px 20px",
        borderRadius: 14,
        background:
          "linear-gradient(180deg, rgba(220,218,215,0.10) 0%, rgba(80,80,80,0.06) 100%)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow:
          "0 0 20px rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        fontFamily: "var(--font-noto-sans), sans-serif",
      }}
    >
      {/* [cl] 자전 방향: ← 지구아이콘(회전) → */}
      <div className="flex items-center gap-1">
        {/* ← 왼쪽 방향 */}
        <button
          onClick={() => onDirectionChange("left")}
          title="서→동 자전"
          style={{
            ...iconBtnStyle,
            width: 28,
            height: 28,
            color: direction === "left" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = direction === "left" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)")}
        >
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path d="M12 5H2M2 5L5.5 1.5M2 5L5.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* [cl] 회전 지구 아이콘 — 경도선 3개 scaleX 교차로 끊김 없는 자전 */}
        <div style={{ width: 22, height: 22, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2" />
            <ellipse cx="10" cy="10" rx="8.5" ry="3" stroke="currentColor" strokeWidth="0.8" />
            <ellipse className="ctrl-lon-a" cx="10" cy="10" rx="8.5" ry="8.5" stroke="currentColor" strokeWidth="0.8" />
            <ellipse className="ctrl-lon-b" cx="10" cy="10" rx="8.5" ry="8.5" stroke="currentColor" strokeWidth="0.8" />
            <ellipse className="ctrl-lon-c" cx="10" cy="10" rx="8.5" ry="8.5" stroke="currentColor" strokeWidth="0.8" />
          </svg>
        </div>

        {/* → 오른쪽 방향 */}
        <button
          onClick={() => onDirectionChange("right")}
          title="동→서 자전"
          style={{
            ...iconBtnStyle,
            width: 28,
            height: 28,
            color: direction === "right" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = direction === "right" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)")}
        >
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path d="M1 5H11M11 5L7.5 1.5M11 5L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* [cl] 경도선 3개 scaleX 교차 애니메이션: 1/3 위상차로 항상 보임 */}
      <style>{`
        .ctrl-lon-a, .ctrl-lon-b, .ctrl-lon-c {
          transform-origin: center;
          transform-box: fill-box;
          animation: ctrlLon 3s ease-in-out infinite;
          animation-direction: ${direction === "right" ? "reverse" : "normal"};
          animation-play-state: ${paused ? "paused" : "running"};
        }
        .ctrl-lon-a { animation-delay: 0s; }
        .ctrl-lon-b { animation-delay: -1s; }
        .ctrl-lon-c { animation-delay: -2s; }
        @keyframes ctrlLon {
          0%, 100% { transform: scaleX(0.15); }
          50% { transform: scaleX(1); }
        }
      `}</style>

      <Divider />

      {/* [cl] 자전 일시정지 / 재생 */}
      <button
        onClick={onPauseToggle}
        title={paused ? "자전 재개" : "자전 일시정지"}
        style={{
          ...iconBtnStyle,
          color: paused ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = paused ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)")}
      >
        {paused ? (
          // ▶ 재생
          <svg width="13" height="14" viewBox="0 0 13 14" fill="currentColor">
            <path d="M2 1.5L12 7L2 12.5V1.5Z" />
          </svg>
        ) : (
          // ⏸ 일시정지
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <rect x="1" y="1" width="3.5" height="12" rx="1.2" />
            <rect x="7.5" y="1" width="3.5" height="12" rx="1.2" />
          </svg>
        )}
      </button>

      <Divider />

      {/* [cl] 연도 표시 / 입력 + Go 버튼 (항상 표시) + 휠 가속 */}
      <div
        ref={yearAreaRef}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={() => setEditingSync(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditingSync(false);
            }}
            autoFocus
            className="bg-transparent text-center outline-none"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 19,
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.05em",
              width: 80,
              // [cl] 숫자 input 화살표 제거
              MozAppearance: "textfield",
            }}
          />
        ) : (
          <span
            title="클릭하여 연도 입력"
            onClick={startEdit}
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 19,
              fontWeight: 700,
              color: warping ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.95)",
              letterSpacing: "0.05em",
              textShadow: warping ? "none" : "0 0 12px rgba(255,255,255,0.22)",
              cursor: warping ? "default" : "text",
              userSelect: "none",
              transition: "color 0.3s, text-shadow 0.3s",
            }}
          >
            {fmt(year)}
          </span>
        )}

        {/* [cl] Go 버튼: 항상 표시, 편집 중이면 commit / 아니면 편집 시작 */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            if (editing) commit();
            else startEdit();
          }}
          style={{
            ...iconBtnStyle,
            width: 24,
            height: 24,
            color: editing ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = editing ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)")}
          title="연도 이동 (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 3V8.5C11 9.05 10.55 9.5 10 9.5H3.5M3.5 9.5L6 7M3.5 9.5L6 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <Divider />

      {/* [cl] 리셋 버튼 */}
      <button
        onClick={onReset}
        title="기본 뷰로 복귀"
        className="flex items-center gap-1.5"
        style={{
          ...iconBtnStyle,
          width: "auto",
          borderRadius: 6,
          padding: "0 4px",
          color: "rgba(255,255,255,0.35)",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
      >
        {/* 원형 화살표 (↺) SVG */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1.5 7C1.5 4.01 3.93 1.5 7 1.5C8.86 1.5 10.5 2.44 11.5 3.88"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
          />
          <path
            d="M12.5 7C12.5 9.99 10.07 12.5 7 12.5C5.14 12.5 3.5 11.56 2.5 10.12"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
          />
          <path d="M11.5 1L11.5 4.5L8 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 13V9.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            fontFamily: "var(--font-noto-sans)",
            fontWeight: 600,
          }}
          className="uppercase"
        >
          Reset
        </span>
      </button>
    </div>
  );
}
