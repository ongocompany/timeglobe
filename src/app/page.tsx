"use client";

// [cl] TimeGlobe 메인 페이지 - Phase 0
import { useState, useRef } from "react";
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
import { MOCK_EVENTS } from "@/data/mockEvents";
import type { MockEvent } from "@/data/mockEvents";

// [cl] MOCK_EVENTS → CarouselCard 변환 (오빗 카드용)
const EVENT_CARDS: CarouselCard[] = MOCK_EVENTS.map((ev) => ({
  title: ev.title.ko,
  desc: ev.summary.ko,
  image: ev.image_url,
}));

// [cl] 뷰 모드: orbit=캐러셀, marker=마커 탐색, null=기본
type ViewMode = "orbit" | "marker" | null;

// [cl] 마커 카테고리 정의 (CesiumGlobe 색상과 동일)
const MARKER_CATEGORIES = [
  { name: "정치/전쟁",   color: "#ae2012", desc: "전쟁·혁명·조약" },
  { name: "인물/문화",   color: "#0a9396", desc: "인물·예술·종교" },
  { name: "과학/발명",   color: "#6a4c93", desc: "발명·탐험·의학" },
  { name: "건축/유물",   color: "#ee9b00", desc: "건축·유적·유물" },
  { name: "자연재해/지질", color: "#ca6702", desc: "화산·지진·재해" },
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scattering, setScattering] = useState(false);
  // [cl] 흩어질 방향 벡터: 마운트 시 1회 생성
  const scatterVecsRef = useState<Array<{ tx: number; ty: number; rot: number }>>(() =>
    events.map(() => ({
      tx: (Math.random() - 0.5) * 500,
      ty: -(Math.random() * 300 + 80),
      rot: (Math.random() - 0.5) * 60,
    }))
  )[0];

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

  const scatter = () => {
    if (scattering) return;
    setScattering(true);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_flyBack?.();
      onClose();
    }, 420);
  };

  return (
    <>
      {/* [cl] 전체화면 투명 오버레이: 밖 클릭 → scatter / 확장 카드 → 축소 */}
      <div
        className="fixed inset-0 z-[84]"
        onClick={activeId ? () => setActiveId(null) : scatter}
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
          transition: "left 0.5s cubic-bezier(0.25,1,0.5,1), top 0.5s cubic-bezier(0.25,1,0.5,1), transform 0.5s cubic-bezier(0.25,1,0.5,1), gap 0.5s cubic-bezier(0.25,1,0.5,1)",
        }}
      >
        {events.map((ev, i) => {
          const isActive = activeId === ev.id;
          const isHidden = !!activeId && !isActive;
          const isHovered = hoveredId === ev.id && !isActive && !scattering;
          const vec = scatterVecsRef[i];

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
                opacity: isHidden || scattering ? 0 : 1,
                pointerEvents: scattering ? "none" : "auto",
                boxShadow: isActive
                  ? "0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)"
                  : isHovered
                  ? "0 12px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)"
                  : "0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
                transform: scattering
                  ? `translate(${vec.tx}px, ${vec.ty}px) rotate(${vec.rot}deg)`
                  : isHovered
                  ? "scale(1.08) translateY(-4px)"
                  : "none",
                transition: scattering
                  ? "transform 0.4s cubic-bezier(0.4,0,1,1), opacity 0.3s ease"
                  : "width 0.5s cubic-bezier(0.25,1,0.5,1), height 0.5s cubic-bezier(0.25,1,0.5,1), opacity 0.3s ease, border-radius 0.5s ease, box-shadow 0.3s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
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
                    relatedEvents={MOCK_EVENTS.filter((e) => e.id !== ev.id).slice(0, 4)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Home() {
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
  // [cl] 워프 속도 ref: sine 이징 애니메이션에서 매 프레임 LightSpeed에 주입
  const warpSpeedRef = useRef<number>(0);
  const warpingRef = useRef(false); // [cl] 중복 실행 방지 (state 클로저 우회)
  // [cl] 워프 마스크: 지구 반지름 기준 라디얼 그라디언트 — 지구 위는 투명, 우주만 워프
  const [warpMask, setWarpMask] = useState("");
  // [cl] 마커 카테고리 다중 선택 (기본: 전체 선택)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    MARKER_CATEGORIES.map((c) => c.name)
  );
  const toggleCategory = (name: string) =>
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  const carouselOpen = viewMode === "orbit";

  // [cl] 시네마틱 워프 시퀀스 (총 5초):
  //   0s    → zoomout: 카메라 70,000km 후퇴 + LightSpeed 서서히 등장
  //   1.5s  → hold:    역방향 고속 자전 + LightSpeed 피크
  //   2.5s  → 연도 전환 (가장 깊은 워프 순간)
  //   3.5s  → zoomin:  카메라 복귀 + LightSpeed 서서히 소멸 + 별 등장
  //   5s    → idle:    완전 복귀
  const handleWarp = (targetYear: number) => {
    if (warpingRef.current || targetYear === currentYear) return;
    warpingRef.current = true;

    const TOTAL = 5000;
    // [cl] 지구 반지름으로 마스크 계산: 지구 표면 보호, 우주만 워프
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (window as any).__timeglobe_screenRadius || 300;
    setWarpMask(
      `radial-gradient(circle at 50% 50%, transparent 0px, transparent ${Math.round(r * 0.88)}px, black ${Math.round(r * 1.12)}px)`
    );

    // [cl] 단계 전환 (setTimeout → 정확한 타이밍)
    setWarpPhase("zoomout");
    setWarpActive(true);
    setTimeout(() => setWarpPhase("hold"), 1500);
    setTimeout(() => setCurrentYear(targetYear), 2500);
    setTimeout(() => setWarpPhase("zoomin"), 3500);
    setTimeout(() => {
      warpSpeedRef.current = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_setWarpSpinMult?.(0);
      setWarpPhase("idle");
      setWarpActive(false);
      warpingRef.current = false;
    }, TOTAL);

    // [cl] rAF 루프: LightSpeed 속도(sine 벨 곡선) + 스핀 배율 연속 업데이트
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / TOTAL, 1);

      // [cl] LightSpeed: sin(0→π) 벨 곡선 — 느리게 시작 → 피크 → 느리게 종료
      warpSpeedRef.current = Math.sin(progress * Math.PI) * 5;

      // [cl] 역자전 배율: hold 진입(1.5s)부터 500ms 가속 → 3.5s까지 유지 → 500ms 감속
      let spinMult = 0;
      if (elapsed >= 1500 && elapsed < 2000) {
        spinMult = ((elapsed - 1500) / 500) * 3;           // 0 → 3
      } else if (elapsed >= 2000 && elapsed < 3500) {
        spinMult = 3;                                        // 유지
      } else if (elapsed >= 3500 && elapsed < 4000) {
        spinMult = (1 - (elapsed - 3500) / 500) * 3;       // 3 → 0
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__timeglobe_setWarpSpinMult?.(spinMult);

      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
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
      <Dashboard events={MOCK_EVENTS} />
      <DateDisplay />
      <TimeDial defaultYear={currentYear} />

      {/* [cl] 지구본: orbit/marker/글로벌 자전 제어 + 워프 단계 전달 */}
      <GlobeLoader
        orbitActive={carouselOpen}
        orbitPaused={orbitMotion === "stop"}
        globePaused={globePaused}
        globeDirection={globeDirection}
        markerMode={viewMode === "marker"}
        events={MOCK_EVENTS}
        onStackClick={(evs, pos) => setStackState({ events: evs, pos })}
        warpPhase={warpPhase}
      />

      {/* [cl] 워프 비네트: 우주 공간을 서서히 어둡게 (지구 구체는 마스크로 보호) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          opacity: warpActive ? 0.72 : 0,
          zIndex: 99,
          background: "black",
          transition: "opacity 1.2s ease",
          WebkitMaskImage: warpMask,
          maskImage: warpMask,
        }}
      />

      {/* [cl] 워프 오버레이: mix-blend-mode screen → 검정=투명, 빛줄기만 우주에 합성 */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: warpActive ? 1 : 0,
          zIndex: 100,
          mixBlendMode: "screen",
          WebkitMaskImage: warpMask,
          maskImage: warpMask,
        }}
      >
        <LightSpeed speedRef={warpSpeedRef} className="w-full h-full" />
      </div>

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
            style={{ maxHeight: viewMode === "marker" ? "200px" : "0px", opacity: viewMode === "marker" ? 1 : 0 }}
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
                    {/* [cl] 컬러 도트 — 선택 시 글로우 */}
                    <span
                      className="w-2.5 h-2.5 rounded-full border flex-shrink-0 transition-all duration-200"
                      style={{
                        backgroundColor: selected ? cat.color : "transparent",
                        borderColor: selected ? cat.color : "rgba(255,255,255,0.22)",
                        boxShadow: selected ? `0 0 6px ${cat.color}90` : "none",
                      }}
                    />
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

      </div>

      {/* [cl] 하단 컨트롤 바: 타임입력 + 자전제어 + 방향 + 리셋 */}
      <ControlBar
        year={currentYear}
        paused={globePaused}
        direction={globeDirection}
        warping={warpActive}
        onYearCommit={handleWarp}
        onPauseToggle={() => setGlobePaused((v) => !v)}
        onDirectionToggle={() => setGlobeDirection((v) => (v === "left" ? "right" : "left"))}
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
        items={EVENT_CARDS}
        isOpen={carouselOpen}
        onClose={() => setViewMode(null)}
        renderDetail={(originalIndex) => {
          const ev = MOCK_EVENTS[originalIndex];
          return (
            <EventDetailContent
              event={ev}
              theme="light"
              relatedEvents={MOCK_EVENTS.filter((e) => e.id !== ev.id).slice(0, 4)}
            />
          );
        }}
      />
    </main>
  );
}
