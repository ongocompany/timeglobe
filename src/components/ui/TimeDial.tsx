"use client";
import { useRef, useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

// [cl] 타임 다이얼: 대시보드 하단 표시 전용 (드래그 없음, 디스플레이 + 애니메이션 용도)
// 구조: 틱마크(먼저) → 수평 점선(위에 겹침) → 중앙 Glass 렌즈 / 좌우 페이드
// 워프 중: 틱 스크롤(과거→오른쪽, 미래→왼쪽) + 글래스 숫자 스크램블(NumberFlow)

const TICK_PX = 14;       // [cl] 픽셀/틱
const MAJOR_EVERY = 5;    // [cl] 5틱마다 주요 틱 + 연도 라벨
const MIN_YEAR = -3000;
const MAX_YEAR = 2100;
const DIAL_WIDTH = 480;   // [cl] 대시보드 min-width에 맞춤
const SCROLL_PX = TICK_PX * MAJOR_EVERY; // [cl] 70px — 심리스 루프 단위

interface TimeDialProps {
  defaultYear?: number;
  warping?: boolean;
  warpDirection?: "past" | "future";
}

export default function TimeDial({
  defaultYear = 1875,
  warping = false,
  warpDirection = "future",
}: TimeDialProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const tickContainerRef = useRef<HTMLDivElement>(null);
  const scrollAccumRef = useRef(0);
  const dialSpeedRef = useRef(0); // [cl] 현재 스크롤 속도 (지수 가감속용, 프레임 간 유지)
  const [barWidth, setBarWidth] = useState(DIAL_WIDTH);
  const [scrambleYear, setScrambleYear] = useState(defaultYear);

  // [cl] 바 폭 측정 (resize 대응)
  useEffect(() => {
    const measure = () => {
      if (barRef.current) setBarWidth(barRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // [cl] 워프 중 틱 스크롤: rAF + 지수 가감속 (re-render 없이 성능 최적)
  // 출발: 지수 접근 — 부드럽게 가속 (0 → PEAK)
  // 정지: 지수 감쇠 — 관성 있게 서서히 멈춤 (PEAK → 0)
  useEffect(() => {
    const direction = warpDirection === "past" ? 1 : -1;
    const PEAK = 280; // px/sec 최고 속도
    let lastTime = performance.now();
    let frameId = 0;

    const scroll = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // [cl] dt 상한: 탭 전환 복귀 시 점프 방지
      lastTime = now;

      if (warping) {
        // [cl] 지수 접근: speed += (목표-현재) × 0.06/frame → 부드러운 가속
        dialSpeedRef.current += (PEAK - dialSpeedRef.current) * (1 - Math.pow(0.94, dt * 60));
      } else {
        // [cl] 지수 감쇠: speed × 0.96/frame → 관성 있는 감속 (꼬리가 길게)
        dialSpeedRef.current *= Math.pow(0.96, dt * 60);
      }

      if (dialSpeedRef.current > 0.5) {
        scrollAccumRef.current += direction * dialSpeedRef.current * dt;
        // [cl] SCROLL_PX(70px) 단위 래핑 → 틱 패턴 반복이라 심리스 루프
        scrollAccumRef.current = ((scrollAccumRef.current % SCROLL_PX) + SCROLL_PX) % SCROLL_PX;
        if (tickContainerRef.current) {
          tickContainerRef.current.style.transform = `translateX(${scrollAccumRef.current}px)`;
        }
        frameId = requestAnimationFrame(scroll);
      } else {
        // [cl] 완전 정지 — 깨끗하게 리셋
        dialSpeedRef.current = 0;
        scrollAccumRef.current = 0;
        if (tickContainerRef.current) tickContainerRef.current.style.transform = "";
      }
    };

    // [cl] warping=true이거나, 아직 감속 중(speed>0)이면 루프 시작
    if (warping || dialSpeedRef.current > 0.5) {
      frameId = requestAnimationFrame(scroll);
    } else {
      if (tickContainerRef.current) tickContainerRef.current.style.transform = "";
      scrollAccumRef.current = 0;
    }

    return () => cancelAnimationFrame(frameId);
  }, [warping, warpDirection]);

  // [cl] 워프 중 숫자 스크램블: 80ms마다 랜덤 연도
  useEffect(() => {
    if (!warping) {
      setScrambleYear(defaultYear);
      return;
    }

    const interval = setInterval(() => {
      setScrambleYear(Math.floor(Math.random() * 3000) + 100);
    }, 80);

    return () => clearInterval(interval);
  }, [warping, defaultYear]);

  const displayYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(defaultYear)));
  const shownYear = warping ? scrambleYear : displayYear;

  // [cl] 워프 중 버퍼 틱 추가 (스크롤 시 빈 공간 방지)
  const extraTicks = warping ? 8 : 2;
  const halfTicks = Math.ceil(barWidth / 2 / TICK_PX) + extraTicks;
  const ticks: { year: number; xPx: number; isMajor: boolean }[] = [];
  for (let i = -halfTicks; i <= halfTicks; i++) {
    const y = displayYear + i;
    if (y < MIN_YEAR || y > MAX_YEAR) continue;
    ticks.push({
      year: y,
      xPx: i * TICK_PX,
      isMajor: y % MAJOR_EVERY === 0,
    });
  }

  const fmt = (y: number) =>
    y < 0 ? `${Math.abs(y)} BC` : `${y} AD`;

  return (
    <div
      ref={barRef}
      className="absolute left-1/2 -translate-x-1/2 z-20 select-none pointer-events-none overflow-hidden"
      style={{ top: 96, height: 76, width: DIAL_WIDTH }}
    >
      {/* [cl] 틱마크 + 기준선 — 좌우 페이드 마스크 적용, 워프 시 스크롤 */}
      <div
        ref={tickContainerRef}
        className="absolute inset-0"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)",
        }}
      >
        {/* [cl] 틱마크 — 점선 아래에 위치하도록 먼저 렌더 */}
        {ticks.map(({ year: y, xPx, isMajor }) => (
          <div
            key={y}
            className="absolute"
            style={{
              left: `calc(50% + ${xPx}px)`,
              top: 7,
              transform: "translateX(-50%)",
            }}
          >
            <div
              style={{
                width: isMajor ? 1.5 : 1,
                height: isMajor ? 20 : 10,
                background: isMajor
                  ? "rgba(255,255,255,0.82)"
                  : "rgba(255,255,255,0.36)",
                borderRadius: 1,
                margin: "0 auto",
              }}
            />
            {/* [cl] 연도 라벨: 주요 틱에만 표시 */}
            {isMajor && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 9,
                  fontFamily: "var(--font-geist-mono), monospace",
                  color: "rgba(255,255,255,0.48)",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  letterSpacing: "0.03em",
                  userSelect: "none",
                }}
              >
                {fmt(y)}
              </p>
            )}
          </div>
        ))}

        {/* [cl] 수평 점선 기준선 — 슬라이더 상단 */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: 2,
            height: 1,
            zIndex: 2,
            background:
              "repeating-linear-gradient(to right, rgba(255,255,255,0.28) 0px, rgba(255,255,255,0.28) 3px, transparent 3px, transparent 7px)",
          }}
        />
      </div>

      {/* [cl] 중앙 Glass 렌즈 — NumberFlow로 숫자 애니메이션 */}
      <div
        className="absolute left-1/2 flex items-center justify-center"
        style={{
          top: 24,
          height: 28,
          width: 96,
          transform: "translateX(-50%)",
          borderRadius: 10,
          background:
            "linear-gradient(180deg, rgba(220,218,215,0.22) 0%, rgba(130,128,126,0.10) 50%, rgba(210,208,205,0.22) 100%)",
          border: "1px solid rgba(255,255,255,0.28)",
          boxShadow:
            "0 0 24px rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.28)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 10,
          overflow: "hidden",
        }}
      >
        <NumberFlow
          value={Math.abs(shownYear)}
          trend={warping ? (warpDirection === "future" ? 1 : -1) : 0}
          format={{ useGrouping: false }}
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "var(--font-geist-mono), monospace",
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "0.05em",
            textShadow: "0 0 12px rgba(255,255,255,0.28)",
            userSelect: "none",
          }}
        />
        {/* [cl] AD/BC 접미사 */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            fontFamily: "var(--font-geist-mono), monospace",
            color: "rgba(255,255,255,0.65)",
            marginLeft: 3,
            userSelect: "none",
          }}
        >
          {shownYear < 0 ? "BC" : "AD"}
        </span>
      </div>

      {/* [cl] 렌즈 좌우 화살 인디케이터 */}
      <div
        className="absolute"
        style={{ left: "calc(50% - 60px)", top: 38, transform: "translate(-50%, -50%)" }}
      >
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M5 1L1 5L5 9" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        className="absolute"
        style={{ left: "calc(50% + 60px)", top: 38, transform: "translate(-50%, -50%)" }}
      >
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1L5 5L1 9" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* [cl] 렌즈 중앙 수직 가이드선 */}
      <div
        className="absolute left-1/2 top-0 bottom-0"
        style={{
          width: 1,
          transform: "translateX(-0.5px)",
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.12) 25%, rgba(255,255,255,0.12) 75%, transparent 100%)",
          zIndex: 5,
        }}
      />
    </div>
  );
}
