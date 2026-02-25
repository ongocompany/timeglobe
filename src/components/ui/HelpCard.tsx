"use client";

// [cl] 유저가이드 팝업: 우측 하단 ? 버튼 → 위로 슬라이드업 카드
// 바깥 클릭 시 닫힘

import { useState, useRef, useEffect } from "react";

const SECTIONS = [
  {
    title: "마우스 조작",
    items: [
      { icon: "◎", label: "좌클릭 드래그", desc: "지구 회전" },
      { icon: "◉", label: "스크롤", desc: "줌 인/아웃" },
      { icon: "◎", label: "우클릭 드래그", desc: "시점 틸트" },
    ],
  },
  {
    title: "뷰 모드",
    items: [
      { icon: "○", label: "Event Orbit", desc: "이벤트 캐러셀" },
      { icon: "●", label: "Event Marker", desc: "글로우 도트 탐색" },
    ],
  },
  {
    title: "컨트롤 바",
    items: [
      { icon: "⏸", label: "자전 일시정지", desc: "지구 자전 정지/재생" },
      { icon: "←→", label: "방향 전환", desc: "자전 방향 반전" },
      { icon: "↺", label: "연도 입력", desc: "클릭 후 연도 입력" },
    ],
  },
];

export default function HelpCard() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // [cl] 바깥 클릭 감지 → 닫힘
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      ref={cardRef}
      className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2 pointer-events-auto"
      style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
    >
      {/* [cl] 팝업 카드 — 슬라이드업 */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? "340px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            background:
              "linear-gradient(160deg, rgba(18,18,20,0.92) 0%, rgba(30,30,35,0.88) 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "14px 16px",
            minWidth: 220,
          }}
        >
          {/* [cl] 카드 헤더 */}
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.35)",
              fontWeight: 600,
              marginBottom: 10,
            }}
            className="uppercase"
          >
            조작 가이드
          </p>

          {/* [cl] 섹션들 */}
          {SECTIONS.map((sec, si) => (
            <div key={sec.title} style={{ marginBottom: si < SECTIONS.length - 1 ? 10 : 0 }}>
              <p
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.22)",
                  marginBottom: 5,
                  fontWeight: 600,
                }}
                className="uppercase"
              >
                {sec.title}
              </p>
              {sec.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2"
                  style={{ marginBottom: 4 }}
                >
                  <span
                    style={{
                      width: 20,
                      textAlign: "center",
                      fontSize: "0.65rem",
                      color: "rgba(255,255,255,0.38)",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.65)", flexShrink: 0 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.28)" }}>
                    {item.desc}
                  </span>
                </div>
              ))}
              {si < SECTIONS.length - 1 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0 0" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* [cl] ? 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: open
            ? "rgba(255,255,255,0.12)"
            : "linear-gradient(180deg, rgba(220,218,215,0.10) 0%, rgba(80,80,80,0.06) 100%)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0",
          transition: "all 0.2s",
          fontFamily: "var(--font-noto-sans), sans-serif",
        }}
      >
        ?
      </button>
    </div>
  );
}
