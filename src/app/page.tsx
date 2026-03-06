"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState, useRef, useEffect } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import Header from "@/components/ui/Header";
import DateDisplay from "@/components/ui/DateDisplay";
import Carousel3D, { type CarouselCard } from "@/components/ui/Carousel3D";
import { EventDetailContent } from "@/components/ui/HistoryEventModal";
import Dashboard from "@/components/ui/Dashboard";
import TimeDial from "@/components/ui/TimeDial";
import ControlBar from "@/components/ui/ControlBar";
import HelpCard from "@/components/ui/HelpCard";
import LightSpeed from "@/components/ui/LightSpeed";
import YearReveal from "@/components/ui/YearReveal";
import type { MockEvent } from "@/data/mockEvents";

// [cl] 뷰 모드: orbit=캐러셀, marker=마커 탐색, null=기본
type ViewMode = "orbit" | "marker" | null;

// [cl] 마커 카테고리 정의 (CesiumGlobe 색상/도형과 동일)
type ShapeType = "circle" | "square" | "diamond" | "triangle" | "star" | "hexagon" | "cross" | "compass";

// [cl] 토글 메뉴용 SVG 도형 아이콘 (CesiumGlobe 마커와 동일 모양)
function ShapeIcon({ shape, color }: { shape: ShapeType; color: string }) {
  const props = { fill: color, stroke: "rgba(255,255,255,0.85)", strokeWidth: 0.8 };
  switch (shape) {
    case "circle":   return <circle cx="6" cy="6" r="4" {...props} />;
    case "square":   return <rect x="2.5" y="2.5" width="7" height="7" {...props} />;
    case "diamond":  return <polygon points="6,1.5 10,6 6,10.5 2,6" {...props} />;
    case "triangle": return <polygon points="6,1.5 10.5,9.5 1.5,9.5" {...props} />;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 4.5 : 2;
        const a = (Math.PI * i / 5) - Math.PI / 2;
        return `${6 + Math.cos(a) * r},${6 + Math.sin(a) * r}`;
      }).join(" ");
      return <polygon points={pts} {...props} />;
    }
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * i / 3) - Math.PI / 6;
        return `${6 + Math.cos(a) * 4.5},${6 + Math.sin(a) * 4.5}`;
      }).join(" ");
      return <polygon points={pts} {...props} />;
    }
    case "cross":
      return <><rect x="4" y="1.5" width="4" height="9" rx="0.5" {...props} /><rect x="1.5" y="4" width="9" height="4" rx="0.5" {...props} /></>;
    case "compass":
      return <><polygon points="6,1.5 7.5,6 6,10.5 4.5,6" {...props} /><polygon points="1.5,6 6,4.5 10.5,6 6,7.5" {...props} /></>;
  }
}
const MARKER_CATEGORIES: { name: string; color: string; desc: string; shape: ShapeType }[] = [
  { name: "정치/전쟁",    color: "#ae2012", desc: "전쟁·혁명·조약",  shape: "diamond" },
  { name: "인물/문화",    color: "#0a9396", desc: "인물·예술·종교",  shape: "star" },
  { name: "과학/발명",    color: "#6a4c93", desc: "발명·의학",       shape: "triangle" },
  { name: "건축/유물",    color: "#ee9b00", desc: "건축·유적·유물",  shape: "square" },
  { name: "자연재해/지질", color: "#ca6702", desc: "화산·지진·재해",  shape: "hexagon" },
  { name: "탐험/발견",    color: "#2a9d8f", desc: "탐험·항해·발견",  shape: "compass" },
];

// [cl] 스택/단독 마커 캐러셀: 커서 위치에 카드 배열, 클릭한 카드가 직접 확장
// 밖 클릭 시 카드들이 랜덤 방향으로 흩어지며 사라짐, 배경 컨테이너 없이 개별 그림자
function StackCarousel({
  events,
  position,
  onClose,
}: {
  events: MockEvent[];
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const isSingle = events.length === 1;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scattering, setScattering] = useState(false);
  // [cl] 단독 마커: 슬라이드 상태 (mount → "in", 닫기 → "out" → onClose)
  const [slidePhase, setSlidePhase] = useState<"in" | "out">("in");
  // [cl] 확장 카드 크기: 화면에 맞게 계산
  const CARD_W = typeof window !== "undefined" ? Math.min(500, Math.round(window.innerWidth * 0.88)) : 460;
  const MAX_H = typeof window !== "undefined" ? window.innerHeight - 80 : 600;
  const CARD_H = Math.min(Math.round(CARD_W * (4 / 3)), MAX_H);

  // [cl] 커서 위 배치: 뷰포트 경계 클램핑
  const MINI_W = events.length * 90 + Math.max(0, events.length - 1) * 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const clampedLeft = Math.max(16, Math.min(position.x - MINI_W / 2, vw - MINI_W - 16));
  const clampedTop = Math.max(16, Math.min(position.y - 140, vh - 180));

  // [cl] 닫기: 단독=슬라이드아웃 / 스택=전체 페이드아웃
  const dismiss = () => {
    if (isSingle) {
      setSlidePhase("out");
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_flyBack?.();
        onClose();
      }, 350);
    } else {
      if (scattering) return;
      setScattering(true);
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__timeglobe_flyBack?.();
        onClose();
      }, 300);
    }
  };

  // [cl] ── 단독 마커: 커서 위치에 미니 카드 + 슬라이드업 등장 ──
  if (isSingle) {
    const ev = events[0];
    const isActive = activeId === ev.id;
    return (
      <>
        {/* [cl] 오버레이: 밖 클릭 → 닫기 */}
        <div className="fixed inset-0 z-[84]" onClick={isActive ? () => setActiveId(null) : dismiss} />
        {isActive && (
          <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm pointer-events-none" />
        )}

        {/* [cl] 커서 위치 미니 카드 (슬라이드업 애니메이션) */}
        <div
          className="fixed z-[86] pointer-events-none"
          style={{
            left: isActive ? "50%" : clampedLeft - 24,
            top: isActive ? "50%" : clampedTop - 24,
            transform: isActive
              ? "translate(-50%, -50%)"
              : slidePhase === "out"
              ? "translateY(30px)"
              : "none",
            transition: "left 0.5s cubic-bezier(0.25,1,0.5,1), top 0.5s cubic-bezier(0.25,1,0.5,1), transform 0.5s cubic-bezier(0.25,1,0.5,1)",
            animation: slidePhase === "in" && !isActive ? "slideUpIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : undefined,
          }}
        >
          {/* [cl] 호버 영역: 카드 주변 24px 여유 패딩 */}
          <div
            style={{
              padding: isActive ? 0 : 24,
              pointerEvents: isActive ? "none" : "auto",
            }}
          >
          <div
            style={{
              width: isActive ? CARD_W : 90,
              height: isActive ? CARD_H : 120,
              flexShrink: 0,
              borderRadius: isActive ? 20 : 12,
              overflow: "hidden",
              position: "relative",
              cursor: isActive || scattering ? "default" : "pointer",
              opacity: slidePhase === "out" && !isActive ? 0 : 1,
              pointerEvents: "auto",
              // [cl] 글래스 보더 + inset 하이라이트 → 플라스틱 카드 질감
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: isActive
                ? "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)"
                : "0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
              transition: "width 0.5s cubic-bezier(0.25,1,0.5,1), height 0.5s cubic-bezier(0.25,1,0.5,1), border-radius 0.5s ease, box-shadow 0.3s ease, opacity 0.3s ease",
            }}
            onClick={!isActive ? () => setActiveId(ev.id) : undefined}
          >
            {/* [cl] 미니 카드 */}
            <div
              className="absolute inset-0"
              style={{
                opacity: isActive ? 0 : 1,
                transition: "opacity 0.2s ease",
                pointerEvents: isActive ? "none" : "auto",
              }}
            >
              <img src={ev.image_url} alt={ev.title.ko} className="w-full h-full object-cover" />
              <div
                className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
              >
                <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ev.title.ko}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{ev.start_year}</p>
              </div>
            </div>

            {/* [cl] 확장 콘텐츠 */}
            {isActive && (
              <div
                className="absolute inset-0 overflow-y-auto bg-white"
                style={{ animation: "fadeIn 0.3s 0.25s both" }}
              >
                <button
                  className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black/60 text-lg leading-none"
                  onClick={(e) => { e.stopPropagation(); setActiveId(null); }}
                >
                  ✕
                </button>
                <EventDetailContent
                  event={ev}
                  theme="light"
                  relatedEvents={events.filter((e) => e.id !== ev.id).slice(0, 4)}
                />
              </div>
            )}
          </div>
          </div>
        </div>

        {/* [cl] 슬라이드업 키프레임: 커서 위치에서 30px 아래→원위치 */}
        <style>{`
          @keyframes slideUpIn {
            0%   { opacity: 0; transform: translateY(30px); }
            60%  { opacity: 1; transform: translateY(-6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </>
    );
  }

  // [cl] ── 스택(2개 이상): 순차 슬라이드인 + 전체 페이드아웃 ──
  return (
    <>
      {/* [cl] 전체화면 투명 오버레이: 밖 클릭 → 페이드아웃 / 확장 카드 → 축소 */}
      <div
        className="fixed inset-0 z-[84]"
        onClick={activeId ? () => setActiveId(null) : dismiss}
      />

      {/* [cl] 확장 카드용 딤 레이어 */}
      {activeId && (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm pointer-events-none" />
      )}

      {/* [cl] 카드들: 커서 위치에 플로팅, 확장 시 화면 중앙으로 이동 */}
      <div
        className="fixed z-[86] pointer-events-none"
        style={{
          left: activeId ? "50%" : clampedLeft,
          top: activeId ? "50%" : clampedTop,
          transform: activeId ? "translate(-50%, -50%)" : "none",
          display: "flex",
          gap: activeId ? 0 : 10,
          opacity: scattering && !activeId ? 0 : 1,
          transition: "left 0.5s cubic-bezier(0.25,1,0.5,1), top 0.5s cubic-bezier(0.25,1,0.5,1), transform 0.5s cubic-bezier(0.25,1,0.5,1), gap 0.5s cubic-bezier(0.25,1,0.5,1), opacity 0.25s ease",
        }}
      >
        {events.map((ev, i) => {
          const isActive = activeId === ev.id;
          const isHidden = !!activeId && !isActive;
          const isHovered = hoveredId === ev.id && !isActive && !scattering;
          // [cl] 등장 애니메이션 활성 여부
          const animating = !scattering && !activeId;

          return (
            <div
              key={ev.id}
              style={{
                width: isActive ? CARD_W : isHidden ? 0 : 90,
                height: isActive ? CARD_H : isHidden ? 0 : 120,
                flexShrink: 0,
                borderRadius: isActive ? 20 : 12,
                overflow: "hidden",
                position: "relative",
                cursor: isActive || scattering ? "default" : "pointer",
                opacity: isHidden ? 0 : 1,
                pointerEvents: scattering ? "none" : "auto",
                // [cl] 글래스 보더 + inset 하이라이트 → 플라스틱 카드 질감
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: isActive
                  ? "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)"
                  : isHovered
                  ? "0 12px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
                  : "0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
                transform: isHovered ? "scale(1.08) translateY(-4px)" : "none",
                // [cl] 등장 중에는 opacity/transform transition 제거 (animation 충돌 방지)
                transition: animating
                  ? "width 0.5s cubic-bezier(0.25,1,0.5,1), height 0.5s cubic-bezier(0.25,1,0.5,1), border-radius 0.5s ease, box-shadow 0.3s ease"
                  : "width 0.5s cubic-bezier(0.25,1,0.5,1), height 0.5s cubic-bezier(0.25,1,0.5,1), opacity 0.3s ease, border-radius 0.5s ease, box-shadow 0.3s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                // [cl] 순차 슬라이드업 + 탄성: 왼→오 100ms 시차
                animation: animating ? `stackBounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 100}ms both` : undefined,
              }}
              onMouseEnter={() => !isActive && setHoveredId(ev.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={!isActive && !scattering ? () => setActiveId(ev.id) : undefined}
            >
              {/* [cl] 미니 카드: 확장 시 페이드아웃 */}
              <div
                className="absolute inset-0"
                style={{
                  opacity: isActive ? 0 : 1,
                  transition: "opacity 0.2s ease",
                  pointerEvents: isActive ? "none" : "auto",
                }}
              >
                <img src={ev.image_url} alt={ev.title.ko} className="w-full h-full object-cover" />
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
                >
                  <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2">{ev.title.ko}</p>
                  <p className="text-white/50 text-[9px] mt-0.5">{ev.start_year}</p>
                </div>
              </div>

              {/* [cl] 확장 콘텐츠: 카드 커진 뒤 페이드인 */}
              {isActive && (
                <div
                  className="absolute inset-0 overflow-y-auto bg-white"
                  style={{ animation: "fadeIn 0.3s 0.25s both" }}
                >
                  <button
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black/60 text-lg leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveId(null);
                    }}
                  >
                    ✕
                  </button>
                  <EventDetailContent
                    event={ev}
                    theme="light"
                    relatedEvents={events.filter((e) => e.id !== ev.id).slice(0, 4)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* [cl] 스택 슬라이드업 + 탄성 키프레임: 아래→위 + 살짝 오버슈트 */}
      <style>{`
        @keyframes stackBounceIn {
          0%   { opacity: 0; transform: translateY(30px); }
          60%  { opacity: 1; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

export default function Home() {
  // [cl] 로딩 오버레이: 지구 타일 로드 완료까지 렌더링 과정 차단
  const [globeReady, setGlobeReady] = useState(false);
  useEffect(() => {
    const onReady = () => setGlobeReady(true);
    window.addEventListener("timeglobe:globeReady", onReady);
    return () => window.removeEventListener("timeglobe:globeReady", onReady);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [stackState, setStackState] = useState<{ events: MockEvent[]; pos: { x: number; y: number } } | null>(null);
  // [cl] Orbit 캐러셀 전용 자전 제어: rotate(기본) / stop
  const [orbitMotion, setOrbitMotion] = useState<"rotate" | "stop">("rotate");
  // [cl] 글로벌 자전 제어 (컨트롤 바)
  const [currentYear, setCurrentYear] = useState(1875);
  const [globePaused, setGlobePaused] = useState(false);
  const [globeDirection, setGlobeDirection] = useState<"left" | "right">("left");
  const [warpActive, setWarpActive] = useState(false);
  const [warpPhase, setWarpPhase] = useState<"idle" | "zoomout" | "hold" | "zoomin">("idle");
  const [warpYearReveal, setWarpYearReveal] = useState(false);
  // [cl] 워프 방향: TimeDial 틱 스크롤 방향 결정 (과거→오른쪽, 미래→왼쪽)
  const [warpDirection, setWarpDirection] = useState<"past" | "future">("future");
  // [cl] 워프 속도 ref: sine 이징 애니메이션에서 매 프레임 LightSpeed에 주입
  const warpSpeedRef = useRef<number>(0);
  const warpingRef = useRef(false); // [cl] 중복 실행 방지 (state 클로저 우회)
  // [cl] 마커 카테고리 다중 선택 (기본: 전체 선택)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    MARKER_CATEGORIES.map((c) => c.name)
  );
  const toggleCategory = (name: string) =>
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  // [cl] 지도 표시 설정 (viewMode와 독립 — 설정 패널이므로 다른 모드와 공존 가능)
  const [mapDisplayOpen, setMapDisplayOpen] = useState(false);
  const [visibleTiers, setVisibleTiers] = useState<number[]>([1, 2, 3, 4]);
  const toggleTier = (tier: number) =>
    setVisibleTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier].sort()
    );
  const [showBorder, setShowBorder] = useState(true);
  // [cl] 카드 데이터 동적 로드 (persons_cards.json)
  const [allEvents, setAllEvents] = useState<MockEvent[]>([]);
  useEffect(() => {
    fetch("/data/persons_cards.json")
      .then((r) => r.json())
      .then((data: MockEvent[]) => setAllEvents(data))
      .catch(() => console.warn("카드 데이터 로드 실패"));
  }, []);
  const carouselOpen = viewMode === "orbit";

  // [cl] 시네마틱 워프 시퀀스 (~5.2초):
  //   0ms    → 스카이박스 OFF(검정 배경) + LightSpeed 페이드인
  //   500ms  → 배경 투명 + 줌아웃 + 회전 시작 (sin ease-in 가속)
  //   1500ms → hold: 고속 역자전 피크 (2.5초 지속)
  //   2000ms → 연도 전환
  //   3200ms → zoomin: cos ease-out 감속 + 카메라 복귀
  //   4200ms → LightSpeed fade-out
  //   4700ms → 스카이박스 ON + idle 복귀
  const handleWarp = (targetYear: number) => {
    // [cl] ★ 이펙트 임시 비활성화: 즉시 연도 전환만 수행 (데이터 검증용)
    // 복원 시 아래 early return 2줄 삭제하면 원래대로 동작
    if (targetYear === currentYear) return;
    setCurrentYear(targetYear);
    return; // ← [cl] 임시: 아래 이펙트 전체 스킵

    // eslint-disable-next-line no-unreachable
    if (warpingRef.current || targetYear === currentYear) return;
    warpingRef.current = true;
    // [cl] 워프 방향 캡처: currentYear 변경 전에 결정 (TimeDial 스크롤 방향용)
    setWarpDirection(targetYear < currentYear ? "past" : "future");

    // [cl] 워프 전 디폴트 상태로 리셋 — orbit/marker/modal 닫고 카메라 원위치
    setViewMode(null);
    setStackState(null);
    setGlobePaused(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_markerFocused = false;
    // [cl] 즉시 setView 리셋 (flyTo 아님) → 자전 중단 없음, 검정 배경이 가림
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_warpResetCamera?.();

    const TOTAL = 5200;

    // [cl] 0ms: 스카이박스 OFF + 검정 배경 (별만 제거, 지구 유지) + LightSpeed 시작
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_setWarpBackground?.("black");
    setWarpActive(true);

    // [cl] 500ms: 배경 투명 + 줌아웃 (회전도 이 시점부터 시작)
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_setWarpBackground?.("transparent");
      setWarpPhase("zoomout");
    }, 500);

    // [cl] 1500ms: hold (고속 역자전, 줌아웃 완료 시점)
    setTimeout(() => setWarpPhase("hold"), 1500);

    // [cl] 2000ms: 연도 전환 (회전 한참 진행 중)
    setTimeout(() => setCurrentYear(targetYear), 2000);

    // [cl] 3200ms: 줌인 복귀 + 감속 시작
    setTimeout(() => setWarpPhase("zoomin"), 3200);

    // [cl] 4200ms: LightSpeed 페이드아웃 시작
    setTimeout(() => setWarpActive(false), 4200);

    // [cl] 4700ms: 스카이박스 복원 + idle + 연도 리빌 시작
    //   warpingRef는 YearReveal 완료 후 해제 (중복 워프 방지)
    setTimeout(() => {
      warpSpeedRef.current = 0;
      // [cl] spinMult 강제 0 제거 — rAF가 1(정상 속도)을 유지하다가
      //   idle 전환 시 정상 자전이 바로 이어받음 (끊김 없음)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_setWarpBackground?.("normal");
      setWarpPhase("idle");
      setWarpYearReveal(true);
    }, 4700);

    // [cl] rAF 루프: LightSpeed 속도(sine 벨 곡선) + 스핀 배율 연속 업데이트
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / TOTAL, 1);

      // [cl] LightSpeed: sin(0→π) 벨 곡선 — 느리게 시작 → 피크 → 느리게 종료
      warpSpeedRef.current = Math.sin(progress * Math.PI) * 5;

      // [cl] 자전 배율: 바닥=1(정상 자전) → sin 가속 → 피크 160 → cos 감속 → 바닥=1
      // 감속 1500ms = 고도 줌인 1500ms와 동기화 → 회전+확대가 동시에 완료
      let spinMult = 1;
      if (elapsed >= 500 && elapsed < 700) {
        // [cl] 가속: 1 + sin(0→π/2) × 159 = 1→160 (200ms)
        const t = (elapsed - 500) / 200;
        spinMult = 1 + Math.sin(t * Math.PI / 2) * 159;
      } else if (elapsed >= 700 && elapsed < 3200) {
        spinMult = 160;                                       // 피크 유지 (2.5초)
      } else if (elapsed >= 3200 && elapsed < 4700) {
        // [cl] 감속: 1 + cos(0→π/2) × 159 = 160→1 (1500ms, 줌인과 동기화)
        const t = (elapsed - 3200) / 1500;
        spinMult = 1 + Math.cos(t * Math.PI / 2) * 159;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_setWarpSpinMult?.(spinMult);

      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  // [cl] 빠른 flick → 랜덤 타임워프
  const handleSpinWarp = () => {
    const randomYear = Math.floor(Math.random() * 5101) - 3000; // -3000 ~ 2100
    handleWarp(randomYear);
  };

  // [cl] 리셋 핸들러 (컨트롤 바용)
  const handleReset = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__timeglobe_markerFocused = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reset = (window as any).__timeglobe_resetToDefault;
    if (reset) reset();
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Header />
      <Dashboard events={allEvents} />
      <DateDisplay />
      <TimeDial defaultYear={currentYear} warping={warpPhase !== "idle"} warpDirection={warpDirection} />

      {/* [cl] LightSpeed 지구 뒤 (z:1) — 스카이박스 OFF 시 투명 우주를 통해 비침 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          opacity: warpActive ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        <LightSpeed speedRef={warpSpeedRef} className="w-full h-full" />
      </div>

      {/* [cl] 지구본 (z:2) — alpha:true → 스카이박스 OFF 시 우주 영역 투명 */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        <GlobeLoader
          orbitActive={carouselOpen}
          orbitPaused={orbitMotion === "stop"}
          globePaused={globePaused}
          globeDirection={globeDirection}
          markerMode={viewMode === "marker"}
          events={allEvents}
          onStackClick={(evs, pos) => setStackState({ events: evs, pos })}
          warpPhase={warpPhase}
          // onSpinWarp={handleSpinWarp} // [cl] 랜덤 타임머신 임시 비활성화 (리뷰 중 오작동 방지)
          currentYear={currentYear}
          visibleTiers={visibleTiers}
          showBorder={showBorder}
          popupOpen={!!stackState}
        />
      </div>

      {/* [cl] 연도 리빌 + 파티클 dissolve (z:3, 지구 바로 위) */}
      {warpYearReveal && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          style={{ zIndex: 3 }}
        >
          <YearReveal
            year={currentYear}
            visible={warpYearReveal}
            onComplete={() => {
              setWarpYearReveal(false);
              warpingRef.current = false;
            }}
          />
        </div>
      )}

      {/* [cl] 좌상단 메뉴 — 로고 하단 세로 배치 */}
      <div
        className="absolute left-6 z-[60] flex flex-col gap-0.5 pointer-events-auto"
        style={{ top: 52, fontFamily: "var(--font-noto-sans), sans-serif" }}
      >
        {/* Event Orbit (단순 토글, 아코디언 없음 — 자전 제어는 하단 ControlBar) */}
        <button
          onClick={() => {
            setViewMode((v) => (v === "orbit" ? null : "orbit"));
            setOrbitMotion("rotate");
          }}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs uppercase tracking-wider transition-all duration-200 group w-full"
        >
          <svg
            width="7" height="8" viewBox="0 0 7 8" fill="currentColor"
            className={`flex-shrink-0 transition-all duration-300 ease-in-out ${viewMode === "orbit" ? "text-white/90" : "text-white/30 group-hover:text-white/60"}`}
            style={{ transform: viewMode === "orbit" ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path d="M1 1L6.5 4L1 7Z" />
          </svg>
          <span className={`transition-colors duration-200 ${viewMode === "orbit" ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>Event Orbit</span>
        </button>

        {/* Event Marker + 아코디언 */}
        <div>
          <button
            onClick={() => setViewMode((v) => (v === "marker" ? null : "marker"))}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs uppercase tracking-wider transition-all duration-200 group w-full"
          >
            {/* [cl] 삼각형 인디케이터: 비선택=▶, 선택=▼ (90도 회전) */}
            <svg
              width="7" height="8" viewBox="0 0 7 8" fill="currentColor"
              className={`flex-shrink-0 transition-all duration-300 ease-in-out ${viewMode === "marker" ? "text-white/90" : "text-white/30 group-hover:text-white/60"}`}
              style={{ transform: viewMode === "marker" ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M1 1L6.5 4L1 7Z" />
            </svg>
            <span className={`transition-colors duration-200 ${viewMode === "marker" ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>Event Marker</span>
          </button>

          {/* [cl] 아코디언: 카테고리 다중 선택 */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: viewMode === "marker" ? "240px" : "0px", opacity: viewMode === "marker" ? 1 : 0 }}
          >
            <div className="pl-5 pt-1 pb-1 flex flex-col gap-2">
              {MARKER_CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className="flex items-center gap-2 group text-left"
                  >
                    {/* [cl] 카테고리 도형 마커 — CesiumGlobe과 동일 */}
                    <svg width="12" height="12" viewBox="0 0 12 12" className="flex-shrink-0 transition-all duration-200" style={{ filter: selected ? `drop-shadow(0 0 4px ${cat.color}90)` : "none" }}>
                      <ShapeIcon shape={cat.shape} color={selected ? cat.color : "rgba(255,255,255,0.22)"} />
                    </svg>
                    <span className={`text-xs transition-colors duration-200 ${selected ? "text-white/85" : "text-white/38 group-hover:text-white/65"}`}>
                      {cat.name}
                    </span>
                    <span className={`text-[10px] transition-colors duration-200 ${selected ? "text-white/35" : "text-white/18"}`}>
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* [cl] Map Display — 지도 표시 설정 (viewMode와 독립, 다른 모드와 공존 가능) */}
        <div>
          <button
            onClick={() => setMapDisplayOpen((v) => !v)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs uppercase tracking-wider transition-all duration-200 group w-full"
          >
            <svg
              width="7" height="8" viewBox="0 0 7 8" fill="currentColor"
              className={`flex-shrink-0 transition-all duration-300 ease-in-out ${mapDisplayOpen ? "text-white/90" : "text-white/30 group-hover:text-white/60"}`}
              style={{ transform: mapDisplayOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M1 1L6.5 4L1 7Z" />
            </svg>
            <span className={`transition-colors duration-200 ${mapDisplayOpen ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>Map Display</span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: mapDisplayOpen ? "200px" : "0px", opacity: mapDisplayOpen ? 1 : 0 }}
          >
            <div className="pl-5 pt-2 pb-1 flex flex-col gap-3">
              {/* [cl] 국명 티어 — T1~T4 개별 토글 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">국명 티어</span>
                <div className="flex gap-1.5">
                  {([1, 2, 3, 4] as const).map((tier) => {
                    const active = visibleTiers.includes(tier);
                    const tierColors: Record<number, string> = { 1: "text-amber-300", 2: "text-sky-300", 3: "text-emerald-300", 4: "text-white/50" };
                    return (
                      <button
                        key={tier}
                        onClick={() => toggleTier(tier)}
                        className={`w-7 h-6 rounded text-[10px] font-bold transition-all duration-200 border ${active ? "bg-white/15 border-white/30 " + tierColors[tier] : "bg-transparent border-white/10 text-white/20 hover:text-white/45 hover:border-white/20"}`}
                      >
                        T{tier}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* [cl] 국경선 토글 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">국경선</span>
                <button
                  onClick={() => setShowBorder((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200 border ${showBorder ? "bg-white/15 border-white/30 text-white/85" : "bg-transparent border-white/10 text-white/20 hover:text-white/45 hover:border-white/20"}`}
                >
                  {showBorder ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* [cl] 하단 컨트롤 바: 타임입력 + 자전제어 + 방향 + 리셋 */}
      <ControlBar
        year={currentYear}
        paused={globePaused}
        direction={globeDirection}
        warping={warpActive}
        onYearCommit={handleWarp}
        onPauseToggle={() => setGlobePaused((v) => !v)}
        onDirectionChange={(dir) => setGlobeDirection(dir)}
        onReset={handleReset}
      />

      {/* [cl] 우측 하단 유저가이드 */}
      <HelpCard />

      {/* [cl] 마커 클릭: 단독/스택 모두 StackCarousel로 통합 처리 */}
      {stackState && (
        <StackCarousel
          events={stackState.events}
          position={stackState.pos}
          onClose={() => setStackState(null)}
        />
      )}

      {/* [cl] 오빗 캐러셀 + 카드 클릭 시 인라인 상세 콘텐츠 */}
      <Carousel3D
        items={allEvents.map((ev) => ({ title: ev.title.ko, desc: ev.summary.ko, image: ev.image_url }))}
        isOpen={carouselOpen}
        onClose={() => setViewMode(null)}
        renderDetail={(originalIndex) => {
          const ev = allEvents[originalIndex];
          return (
            <EventDetailContent
              event={ev}
              theme="light"
              relatedEvents={allEvents.filter((e) => e.id !== ev.id).slice(0, 4)}
            />
          );
        }}
      />

      {/* [cl] 로딩 오버레이: 지구 렌더링 과정을 가리고 타일 로드 완료 후 페이드아웃 */}
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black"
        style={{
          opacity: globeReady ? 0 : 1,
          transition: "opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: globeReady ? "none" : "auto",
        }}
      >
        {/* [cl] 스탑워치 아이콘 + 회전 초침 */}
        <svg width="48" height="60" viewBox="0 0 16 20" fill="none" className="mb-6">
          <rect x="5.5" y="0" width="5" height="2.5" rx="1" fill="rgba(255,255,255,0.5)" />
          <circle cx="8" cy="12" r="7.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
          <line x1="8" y1="12" x2="8" y2="6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 8 12" to="360 8 12" dur="2s" repeatCount="indefinite" />
          </line>
          <circle cx="8" cy="12" r="1" fill="rgba(255,255,255,0.7)" />
        </svg>
        <h2
          className="uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-noto-sans), sans-serif",
            fontWeight: 800,
            fontSize: "2rem",
            color: "transparent",
            WebkitTextStroke: "1.2px rgba(255, 255, 255, 0.6)",
            textShadow: "0 0 20px rgba(255, 255, 255, 0.2)",
          }}
        >
          Time Globe
        </h2>
        <p
          className="mt-3 tracking-wide animate-pulse"
          style={{
            fontFamily: "var(--font-noto-sans), sans-serif",
            fontWeight: 300,
            fontSize: "0.85rem",
            color: "rgba(255, 255, 255, 0.35)",
          }}
        >
          Loading...
        </p>
      </div>
    </main>
  );
}
