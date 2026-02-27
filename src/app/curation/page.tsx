"use client";

// [cl] 이벤트 큐레이션 페이지 — Tinder-스와이프 스타일 카드 브라우저
// 승인(D) / 거부(A) / 건너뛰기(S) 키보드 단축키로 빠르게 큐레이션

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Check,
  X,
  ChevronDown,
  Swords,
  User,
  Lightbulb,
  Landmark,
  Mountain,
  Palette,
  BookOpen,
  Sparkles,
  Globe,
  ExternalLink,
  Undo2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
type EventItem = {
  id: string;
  era_id: string | null;
  title: { ko?: string; en?: string } | null;
  start_year: number;
  end_year: number | null;
  created_at: string;
  category: string;
  event_kind: string | null;
  is_battle: boolean;
  is_curated_visible: boolean | null;
  location_lat: number;
  location_lng: number;
  is_fog_region: boolean;
  modern_country: { ko?: string; en?: string } | null;
  image_url: string | null;
  summary: { ko?: string; en?: string } | null;
  external_link: string | null;
};

type CurationStatus = "pending" | "approved" | "rejected" | "all";

// ─── Constants ───────────────────────────────────────
const BATCH_SIZE = 50;

const CATEGORIES = [
  "전체",
  "정치/전쟁",
  "인물/문화",
  "과학/발명",
  "건축/유물",
  "자연재해/지질",
  "문화",
  "지적유산",
] as const;

// [cl] 카테고리별 아이콘 & 색상 (HistoryEventModal과 동일 매핑)
const categoryConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "정치/전쟁": { icon: Swords, color: "text-red-400", bg: "bg-red-500/20" },
  "인물/문화": { icon: User, color: "text-blue-400", bg: "bg-blue-500/20" },
  "과학/발명": { icon: Lightbulb, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  "건축/유물": { icon: Landmark, color: "text-amber-400", bg: "bg-amber-500/20" },
  "자연재해/지질": { icon: Mountain, color: "text-orange-400", bg: "bg-orange-500/20" },
  문화: { icon: Palette, color: "text-purple-400", bg: "bg-purple-500/20" },
  지적유산: { icon: BookOpen, color: "text-indigo-400", bg: "bg-indigo-500/20" },
};

// ─── Helpers ─────────────────────────────────────────
function titleText(title: EventItem["title"]) {
  if (!title) return "(제목 없음)";
  return title.ko || title.en || "(제목 없음)";
}

function yearLabel(item: EventItem) {
  const fmt = (y: number) => (y < 0 ? `BC ${Math.abs(y)}` : `${y} AD`);
  if (item.end_year && item.end_year !== item.start_year) {
    return `${fmt(item.start_year)} ~ ${fmt(item.end_year)}`;
  }
  return fmt(item.start_year);
}

function CategoryBadge({ category }: { category: string }) {
  const config = categoryConfig[category];
  const color = config?.color || "text-white/60";
  const bg = config?.bg || "bg-white/10";
  const Icon = config?.icon || Sparkles;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${bg} ${color}`} style={{ fontSize: 12 }}>
      <Icon size={11} />
      {category}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────
export default function CurationPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processedCount, setProcessedCount] = useState(0);

  // [cl] 필터 상태
  const [curationStatus, setCurationStatus] = useState<CurationStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  // [cl] 되돌리기 히스토리
  const [undoStack, setUndoStack] = useState<{ item: EventItem; prevValue: boolean | null }[]>([]);

  // [cl] 카드 날아가는 방향 (애니메이션용)
  const [exitDir, setExitDir] = useState<"left" | "right" | "down" | null>(null);
  const animatingRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const ready = Boolean(supabaseUrl && anonKey);

  // ─── Fetch ─────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        select:
          "id,era_id,title,start_year,end_year,created_at,category,event_kind,is_battle,is_curated_visible,location_lat,location_lng,is_fog_region,modern_country,image_url,summary,external_link",
        order: "start_year.asc",
        limit: String(BATCH_SIZE),
      });

      // [cl] 큐레이션 상태 필터
      if (curationStatus === "pending") params.set("is_curated_visible", "is.null");
      else if (curationStatus === "approved") params.set("is_curated_visible", "is.true");
      else if (curationStatus === "rejected") params.set("is_curated_visible", "is.false");

      // [cl] 카테고리 필터
      if (categoryFilter !== "전체") params.set("category", `eq.${categoryFilter}`);

      // [cl] 연도 범위
      if (yearFrom) params.set("start_year", `gte.${yearFrom}`);
      if (yearTo) {
        // yearFrom과 start_year 파라미터가 이미 있으면 and 조건으로 합침
        const existing = params.get("start_year");
        if (existing) {
          params.delete("start_year");
          params.set("and", `(start_year.gte.${yearFrom},start_year.lte.${yearTo})`);
        } else {
          params.set("start_year", `lte.${yearTo}`);
        }
      }

      const url = `${supabaseUrl}/rest/v1/events?${params.toString()}`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as EventItem[];
      setItems(json);
      setCurrentIdx(0);
      setProcessedCount(0);
      setUndoStack([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ready, supabaseUrl, anonKey, curationStatus, categoryFilter, yearFrom, yearTo]);

  // [cl] 페이지 최초 로드 시 자동 fetch
  useEffect(() => {
    if (ready) fetchEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PATCH ─────────────────────────────────────────
  const patchVisibility = useCallback(
    async (id: string, value: boolean) => {
      const url = `${supabaseUrl}/rest/v1/events?id=eq.${id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ is_curated_visible: value }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PATCH 실패: ${res.status} ${text.slice(0, 200)}`);
      }
    },
    [supabaseUrl, anonKey],
  );

  // ─── Actions ───────────────────────────────────────
  const current = items[currentIdx] ?? null;

  const advance = useCallback(() => {
    setProcessedCount((c) => c + 1);
    // [cl] 다음 카드 자연스럽게 등장하도록 약간 딜레이
    setTimeout(() => {
      setCurrentIdx((i) => i + 1);
      animatingRef.current = false;
    }, 200);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!current || animatingRef.current) return;
    animatingRef.current = true;
    setExitDir("right");
    try {
      await patchVisibility(current.id, true);
      setUndoStack((s) => [...s, { item: current, prevValue: current.is_curated_visible }]);
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      animatingRef.current = false;
      setExitDir(null);
    }
  }, [current, patchVisibility, advance]);

  const handleReject = useCallback(async () => {
    if (!current || animatingRef.current) return;
    animatingRef.current = true;
    setExitDir("left");
    try {
      await patchVisibility(current.id, false);
      setUndoStack((s) => [...s, { item: current, prevValue: current.is_curated_visible }]);
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      animatingRef.current = false;
      setExitDir(null);
    }
  }, [current, patchVisibility, advance]);

  const handleSkip = useCallback(() => {
    if (!current || animatingRef.current) return;
    animatingRef.current = true;
    setExitDir("down");
    advance();
  }, [current, advance]);

  // [cl] 되돌리기: 마지막 액션 취소
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || animatingRef.current) return;
    const last = undoStack[undoStack.length - 1];
    try {
      // [cl] 원래 값으로 복원 (null이면 PATCH로 null 보냄)
      const url = `${supabaseUrl}/rest/v1/events?id=eq.${last.item.id}`;
      await fetch(url, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ is_curated_visible: last.prevValue }),
      });
      setUndoStack((s) => s.slice(0, -1));
      setCurrentIdx((i) => Math.max(0, i - 1));
      setProcessedCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [undoStack, supabaseUrl, anonKey]);

  // ─── Keyboard ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // [cl] input에 포커스 중이면 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key.toLowerCase()) {
        case "d":
        case "arrowright":
          e.preventDefault();
          handleApprove();
          break;
        case "a":
        case "arrowleft":
          e.preventDefault();
          handleReject();
          break;
        case "s":
        case "arrowdown":
          e.preventDefault();
          handleSkip();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleUndo();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleApprove, handleReject, handleSkip, handleUndo]);

  // ─── 배치 소진 → 자동 로드 ────────────────────────
  const exhausted = items.length > 0 && currentIdx >= items.length;

  // ─── Render ────────────────────────────────────────
  return (
    <main
      className="min-h-screen text-white"
      style={{
        background: "linear-gradient(180deg, #0b0f1a 0%, #0d1117 50%, #0b0f1a 100%)",
        fontFamily: "var(--font-noto-sans), var(--font-geist-sans), sans-serif",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">이벤트 큐레이션</h1>
            <p className="mt-1 text-xs text-white/50">
              A=거부 &middot; S=건너뛰기 &middot; D=승인 &middot; Ctrl+Z=되돌리기
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
          >
            홈으로
          </Link>
        </div>

        {/* ── 필터 바 ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* 큐레이션 상태 */}
          <select
            value={curationStatus}
            onChange={(e) => setCurationStatus(e.target.value as CurationStatus)}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50"
          >
            <option value="pending">미처리</option>
            <option value="approved">승인됨</option>
            <option value="rejected">거부됨</option>
            <option value="all">전체</option>
          </select>

          {/* 카테고리 */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* 연도 범위 */}
          <input
            type="number"
            placeholder="연도 from"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className="w-24 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white/30 self-center text-sm">~</span>
          <input
            type="number"
            placeholder="연도 to"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className="w-24 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            onClick={() => fetchEvents()}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            검색
          </button>
        </div>

        {/* ── 진행률 바 ── */}
        {items.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>
                {processedCount} / {items.length} 처리
              </span>
              <span>{Math.round((processedCount / items.length) * 100)}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400/60 transition-all duration-300"
                style={{ width: `${(processedCount / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── 에러 표시 ── */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-300 hover:text-red-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── 환경변수 없음 ── */}
        {!ready && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            환경변수 없음: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.
          </div>
        )}

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-white/50">
            <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mr-3" />
            불러오는 중...
          </div>
        )}

        {/* ── 배치 소진 ── */}
        {exhausted && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-white/50">
            <p className="text-lg mb-3">
              {items.length}건 모두 처리 완료!
            </p>
            <button
              onClick={() => fetchEvents()}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-5 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              다음 배치 불러오기
            </button>
          </div>
        )}

        {/* ── 결과 없음 ── */}
        {!loading && items.length === 0 && ready && (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <p>조건에 맞는 이벤트가 없습니다.</p>
          </div>
        )}

        {/* ── 카드 영역 ── */}
        {current && !exhausted && !loading && (
          <div className="relative" style={{ minHeight: 480 }}>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={current.id}
                className="rounded-2xl overflow-hidden border border-white/12"
                style={{
                  background:
                    "linear-gradient(160deg, rgba(18,18,20,0.95) 0%, rgba(26,26,32,0.92) 100%)",
                  boxShadow:
                    "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  x: exitDir === "left" ? -300 : exitDir === "right" ? 300 : 0,
                  y: exitDir === "down" ? 200 : 0,
                  scale: 0.9,
                  rotate: exitDir === "left" ? -8 : exitDir === "right" ? 8 : 0,
                }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* 이미지 영역 */}
                <div className="relative h-48 bg-gradient-to-br from-white/5 to-white/2 overflow-hidden">
                  {current.image_url ? (
                    <>
                      <img
                        src={current.image_url}
                        alt={titleText(current.title)}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(18,18,20,0.95) 0%, rgba(18,18,20,0.3) 50%, transparent 100%)",
                        }}
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/15">
                      <Globe size={48} />
                    </div>
                  )}

                  {/* 인덱스 카운터 (카드 위) */}
                  <div className="absolute top-3 right-3 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-0.5 text-xs text-white/60">
                    {currentIdx + 1} / {items.length}
                  </div>

                  {/* 큐레이션 상태 뱃지 */}
                  {current.is_curated_visible !== null && (
                    <div
                      className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs backdrop-blur-md ${
                        current.is_curated_visible
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {current.is_curated_visible ? "승인됨" : "거부됨"}
                    </div>
                  )}
                </div>

                {/* 콘텐츠 영역 */}
                <div className="px-5 py-4 space-y-3">
                  {/* 제목 + 연도 */}
                  <div>
                    <h2 className="text-lg font-semibold leading-snug">{titleText(current.title)}</h2>
                    <p
                      className="mt-1 text-white/45"
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {yearLabel(current)}
                    </p>
                  </div>

                  {/* 뱃지 행: 카테고리 + event_kind + battle */}
                  <div className="flex flex-wrap gap-1.5">
                    <CategoryBadge category={current.category} />
                    {current.event_kind && current.event_kind !== "historical_event" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/8 text-white/50 text-xs">
                        {current.event_kind}
                      </span>
                    )}
                    {current.is_battle && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs">
                        <Swords size={10} />
                        전투
                      </span>
                    )}
                  </div>

                  {/* 위치 */}
                  {current.modern_country?.ko && (
                    <div className="flex items-center gap-1.5 text-white/45" style={{ fontSize: 13 }}>
                      <Globe size={12} />
                      {current.modern_country.ko}
                      <span className="text-white/20 ml-1" style={{ fontSize: 11 }}>
                        ({current.location_lat.toFixed(2)}, {current.location_lng.toFixed(2)})
                      </span>
                    </div>
                  )}

                  {/* 구분선 */}
                  <div className="h-px bg-white/8" />

                  {/* 요약 */}
                  <div className="min-h-[60px]">
                    {current.summary?.ko ? (
                      <p className="text-white/70 leading-relaxed" style={{ fontSize: 14 }}>
                        {current.summary.ko}
                      </p>
                    ) : (
                      <p className="text-white/25 italic" style={{ fontSize: 14 }}>
                        요약 없음
                      </p>
                    )}
                  </div>

                  {/* 외부 링크 */}
                  {current.external_link && (
                    <a
                      href={current.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400/70 hover:text-cyan-300 transition-colors"
                      style={{ fontSize: 12 }}
                    >
                      <ExternalLink size={11} />
                      외부 링크
                    </a>
                  )}
                </div>

                {/* ── 액션 버튼 ── */}
                <div className="flex items-center gap-3 px-5 pb-5 pt-2">
                  {/* 거부 */}
                  <button
                    onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-400/20 bg-red-500/8 text-red-300 hover:bg-red-500/20 hover:border-red-400/40 transition-all active:scale-95 cursor-pointer"
                  >
                    <X size={18} />
                    <span className="text-sm font-medium">거부</span>
                    <kbd className="ml-1 text-[10px] text-red-400/40 bg-red-500/10 px-1.5 py-0.5 rounded">A</kbd>
                  </button>

                  {/* 건너뛰기 */}
                  <button
                    onClick={handleSkip}
                    className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-white/12 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95 cursor-pointer"
                  >
                    <ChevronDown size={16} />
                    <kbd className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">S</kbd>
                  </button>

                  {/* 승인 */}
                  <button
                    onClick={handleApprove}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-400/20 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/40 transition-all active:scale-95 cursor-pointer"
                  >
                    <Check size={18} />
                    <span className="text-sm font-medium">승인</span>
                    <kbd className="ml-1 text-[10px] text-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 rounded">D</kbd>
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── 되돌리기 버튼 ── */}
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="mt-3 flex items-center gap-1.5 mx-auto text-white/30 hover:text-white/60 transition-colors text-sm cursor-pointer"
              >
                <Undo2 size={14} />
                되돌리기 (Ctrl+Z)
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
