"use client";

// [cl] 이벤트 큐레이션 페이지 — 큐레이션 카드 + 데이터 현황 대시보드
// 탭 전환: "큐레이션" (카드 스와이프) / "데이터 현황" (통계 대시보드)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  BarChart3,
  ImageOff,
  FileText,
  AlertTriangle,
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

// [cl] 통계용 경량 타입 (전체 이벤트 fetch 시 최소 컬럼만)
type StatsRow = {
  category: string;
  event_kind: string | null;
  is_battle: boolean;
  is_curated_visible: boolean | null;
  image_url: string | null;
  summary: { ko?: string; en?: string } | null;
  external_link: string | null;
  start_year: number;
};

type CurationStatus = "pending" | "approved" | "rejected" | "all";
type ViewTab = "curate" | "stats";

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

function pct(n: number, total: number) {
  if (total === 0) return "0";
  return ((n / total) * 100).toFixed(1);
}

// ─── Stats Dashboard Component ───────────────────────
function StatsDashboard({
  data,
  loading,
  onRefresh,
}: {
  data: StatsRow[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const stats = useMemo(() => {
    const total = data.length;
    if (total === 0) return null;

    // [cl] 큐레이션 상태
    let pending = 0, approved = 0, rejected = 0;
    // [cl] 데이터 누락
    let noSummary = 0, noSummaryKo = 0, noImage = 0, noLink = 0;
    // [cl] 전투
    let battleCount = 0;
    // [cl] 카테고리별
    const byCat: Record<string, { total: number; pending: number; approved: number; noSummary: number; noImage: number }> = {};
    // [cl] event_kind별
    const byKind: Record<string, number> = {};
    // [cl] 연도 구간별 (500년 단위)
    const byEra: Record<string, number> = {};

    for (const row of data) {
      // 큐레이션
      if (row.is_curated_visible === null) pending++;
      else if (row.is_curated_visible === true) approved++;
      else rejected++;

      // 누락
      const hasSummary = row.summary && (row.summary.ko || row.summary.en);
      const hasSummaryKo = row.summary?.ko;
      if (!hasSummary) noSummary++;
      if (!hasSummaryKo) noSummaryKo++;
      if (!row.image_url) noImage++;
      if (!row.external_link) noLink++;

      // 전투
      if (row.is_battle) battleCount++;

      // 카테고리
      const cat = row.category || "(없음)";
      if (!byCat[cat]) byCat[cat] = { total: 0, pending: 0, approved: 0, noSummary: 0, noImage: 0 };
      byCat[cat].total++;
      if (row.is_curated_visible === null) byCat[cat].pending++;
      if (row.is_curated_visible === true) byCat[cat].approved++;
      if (!hasSummary) byCat[cat].noSummary++;
      if (!row.image_url) byCat[cat].noImage++;

      // event_kind
      const kind = row.event_kind || "unknown";
      byKind[kind] = (byKind[kind] || 0) + 1;

      // 연도 구간
      const y = row.start_year;
      let era: string;
      if (y < 0) era = `BC ${Math.abs(Math.ceil(y / 500) * 500)}~`;
      else if (y < 500) era = "0~499";
      else if (y < 1000) era = "500~999";
      else if (y < 1500) era = "1000~1499";
      else if (y < 1800) era = "1500~1799";
      else if (y < 1900) era = "1800~1899";
      else if (y < 1950) era = "1900~1949";
      else if (y < 2000) era = "1950~1999";
      else era = "2000~";
      byEra[era] = (byEra[era] || 0) + 1;
    }

    return { total, pending, approved, rejected, noSummary, noSummaryKo, noImage, noLink, battleCount, byCat, byKind, byEra };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/50">
        <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mr-3" />
        통계 로딩 중...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <p className="mb-3">데이터를 불러와주세요.</p>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-5 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors"
        >
          전체 데이터 로드
        </button>
      </div>
    );
  }

  const catEntries = Object.entries(stats.byCat).sort((a, b) => b[1].total - a[1].total);
  const kindEntries = Object.entries(stats.byKind).sort((a, b) => b[1] - a[1]);
  // [cl] 연도 정렬: 시간순
  const eraOrder = ["BC 3000~", "BC 2500~", "BC 2000~", "BC 1500~", "BC 1000~", "BC 500~", "0~499", "500~999", "1000~1499", "1500~1799", "1800~1899", "1900~1949", "1950~1999", "2000~"];
  const eraEntries = eraOrder.filter((e) => stats.byEra[e]).map((e) => [e, stats.byEra[e]] as [string, number]);

  const maxEra = Math.max(...eraEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-5">
      {/* ── 총괄 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="전체" value={stats.total} color="text-white" />
        <StatCard label="미처리" value={stats.pending} sub={`${pct(stats.pending, stats.total)}%`} color="text-amber-300" />
        <StatCard label="승인" value={stats.approved} sub={`${pct(stats.approved, stats.total)}%`} color="text-emerald-300" />
        <StatCard label="거부" value={stats.rejected} sub={`${pct(stats.rejected, stats.total)}%`} color="text-red-300" />
      </div>

      {/* ── 데이터 품질 ── */}
      <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(18,18,20,0.6)" }}>
        <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          데이터 품질
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QualityItem icon={FileText} label="요약 없음 (전체)" count={stats.noSummary} total={stats.total} color="text-amber-400" />
          <QualityItem icon={FileText} label="한국어 요약 없음" count={stats.noSummaryKo} total={stats.total} color="text-orange-400" />
          <QualityItem icon={ImageOff} label="이미지 없음" count={stats.noImage} total={stats.total} color="text-red-400" />
          <QualityItem icon={Swords} label="전투 이벤트" count={stats.battleCount} total={stats.total} color="text-red-300" />
        </div>
      </div>

      {/* ── 카테고리별 ── */}
      <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(18,18,20,0.6)" }}>
        <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-cyan-400" />
          카테고리별 현황
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/8">
                <th className="text-left py-2 pr-3">카테고리</th>
                <th className="text-right py-2 px-2">전체</th>
                <th className="text-right py-2 px-2">미처리</th>
                <th className="text-right py-2 px-2">승인</th>
                <th className="text-right py-2 px-2">요약없음</th>
                <th className="text-right py-2 pl-2">이미지없음</th>
              </tr>
            </thead>
            <tbody>
              {catEntries.map(([cat, d]) => {
                const cfg = categoryConfig[cat];
                const Icon = cfg?.icon || Sparkles;
                return (
                  <tr key={cat} className="border-b border-white/5 hover:bg-white/3">
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1.5 ${cfg?.color || "text-white/60"}`}>
                        <Icon size={12} />
                        {cat}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 text-white/70 font-mono">{d.total}</td>
                    <td className="text-right py-2 px-2 text-amber-300/70 font-mono">{d.pending}</td>
                    <td className="text-right py-2 px-2 text-emerald-300/70 font-mono">{d.approved}</td>
                    <td className="text-right py-2 px-2 text-amber-400/60 font-mono">
                      {d.noSummary > 0 ? d.noSummary : <span className="text-white/15">0</span>}
                    </td>
                    <td className="text-right py-2 pl-2 text-red-400/60 font-mono">
                      {d.noImage > 0 ? d.noImage : <span className="text-white/15">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 연도 분포 (간이 히스토그램) ── */}
      <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(18,18,20,0.6)" }}>
        <h3 className="text-sm font-semibold text-white/80 mb-3">연도 분포</h3>
        <div className="space-y-1.5">
          {eraEntries.map(([era, count]) => (
            <div key={era} className="flex items-center gap-2">
              <span className="w-24 text-right text-xs text-white/40 font-mono shrink-0">{era}</span>
              <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                <div
                  className="h-full rounded bg-cyan-500/30"
                  style={{ width: `${(count / maxEra) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right text-xs text-white/50 font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── event_kind 분포 ── */}
      <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(18,18,20,0.6)" }}>
        <h3 className="text-sm font-semibold text-white/80 mb-3">event_kind 분포</h3>
        <div className="flex flex-wrap gap-2">
          {kindEntries.map(([kind, count]) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/8 px-3 py-1 text-xs text-white/60"
            >
              {kind}
              <span className="text-white/30 font-mono">{count}</span>
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onRefresh}
        className="w-full rounded-lg border border-white/10 bg-white/3 py-2 text-sm text-white/40 hover:bg-white/5 hover:text-white/60 transition-colors"
      >
        새로고침
      </button>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div
      className="rounded-xl border border-white/10 px-4 py-3"
      style={{ background: "rgba(18,18,20,0.6)" }}
    >
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function QualityItem({ icon: Icon, label, count, total, color }: { icon: React.ElementType; label: string; count: number; total: number; color: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-white/50">{label}</p>
        <p className={`text-lg font-bold font-mono ${color}`}>{count.toLocaleString()}</p>
        <p className="text-xs text-white/25">{pct(count, total)}%</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────
export default function CurationPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("stats");
  const [items, setItems] = useState<EventItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processedCount, setProcessedCount] = useState(0);

  // [cl] 통계 데이터 (경량 전체 fetch)
  const [statsData, setStatsData] = useState<StatsRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

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

  // ─── Stats Fetch (경량 전체) ──────────────────────
  const fetchStats = useCallback(async () => {
    if (!ready) return;
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({
        select: "category,event_kind,is_battle,is_curated_visible,image_url,summary,external_link,start_year",
        limit: "20000",
        order: "start_year.asc",
      });
      const url = `${supabaseUrl}/rest/v1/events?${params.toString()}`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatsRow[];
      setStatsData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatsLoading(false);
    }
  }, [ready, supabaseUrl, anonKey]);

  // ─── Curate Fetch ─────────────────────────────────
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

      if (curationStatus === "pending") params.set("is_curated_visible", "is.null");
      else if (curationStatus === "approved") params.set("is_curated_visible", "is.true");
      else if (curationStatus === "rejected") params.set("is_curated_visible", "is.false");

      if (categoryFilter !== "전체") params.set("category", `eq.${categoryFilter}`);

      if (yearFrom) params.set("start_year", `gte.${yearFrom}`);
      if (yearTo) {
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

  // [cl] 탭 전환 시 데이터 로드
  useEffect(() => {
    if (!ready) return;
    if (activeTab === "stats" && statsData.length === 0) fetchStats();
    if (activeTab === "curate" && items.length === 0) fetchEvents();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || animatingRef.current) return;
    const last = undoStack[undoStack.length - 1];
    try {
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

  // ─── Keyboard (큐레이션 탭에서만) ─────────────────
  useEffect(() => {
    if (activeTab !== "curate") return;
    const onKey = (e: KeyboardEvent) => {
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
  }, [activeTab, handleApprove, handleReject, handleSkip, handleUndo]);

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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-tight">이벤트 큐레이션</h1>
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
          >
            홈으로
          </Link>
        </div>

        {/* ── 탭 전환 ── */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/5 border border-white/8">
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "stats"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <BarChart3 size={15} />
            데이터 현황
          </button>
          <button
            onClick={() => setActiveTab("curate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "curate"
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Check size={15} />
            큐레이션
          </button>
        </div>

        {/* ── 에러 표시 ── */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-300 hover:text-red-100">
              <X size={14} />
            </button>
          </div>
        )}

        {!ready && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            환경변수 없음: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.
          </div>
        )}

        {/* ═══════ 데이터 현황 탭 ═══════ */}
        {activeTab === "stats" && (
          <StatsDashboard data={statsData} loading={statsLoading} onRefresh={fetchStats} />
        )}

        {/* ═══════ 큐레이션 탭 ═══════ */}
        {activeTab === "curate" && (
          <>
            {/* 안내 */}
            <p className="text-xs text-white/40 mb-3">
              A=거부 &middot; S=건너뛰기 &middot; D=승인 &middot; Ctrl+Z=되돌리기
            </p>

            {/* 필터 바 */}
            <div className="flex flex-wrap gap-2 mb-5">
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

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <input
                type="number"
                placeholder="from"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-white/30 self-center text-sm">~</span>
              <input
                type="number"
                placeholder="to"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white/80 outline-none focus:border-cyan-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />

              <button
                onClick={() => fetchEvents()}
                className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors"
              >
                검색
              </button>
            </div>

            {/* 진행률 */}
            {items.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span>{processedCount} / {items.length} 처리</span>
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

            {/* 로딩 */}
            {loading && (
              <div className="flex items-center justify-center py-20 text-white/50">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mr-3" />
                불러오는 중...
              </div>
            )}

            {/* 배치 소진 */}
            {exhausted && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-white/50">
                <p className="text-lg mb-3">{items.length}건 모두 처리 완료!</p>
                <button
                  onClick={() => fetchEvents()}
                  className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-5 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  다음 배치 불러오기
                </button>
              </div>
            )}

            {/* 결과 없음 */}
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
                      background: "linear-gradient(160deg, rgba(18,18,20,0.95) 0%, rgba(26,26,32,0.92) 100%)",
                      boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
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
                              background: "linear-gradient(to top, rgba(18,18,20,0.95) 0%, rgba(18,18,20,0.3) 50%, transparent 100%)",
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-white/15">
                          <Globe size={48} />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-0.5 text-xs text-white/60">
                        {currentIdx + 1} / {items.length}
                      </div>
                      {current.is_curated_visible !== null && (
                        <div
                          className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs backdrop-blur-md ${
                            current.is_curated_visible ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {current.is_curated_visible ? "승인됨" : "거부됨"}
                        </div>
                      )}
                    </div>

                    {/* 콘텐츠 */}
                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <h2 className="text-lg font-semibold leading-snug">{titleText(current.title)}</h2>
                        <p className="mt-1 text-white/45" style={{ fontSize: 13, fontFamily: "var(--font-geist-mono), monospace" }}>
                          {yearLabel(current)}
                        </p>
                      </div>

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

                      {current.modern_country?.ko && (
                        <div className="flex items-center gap-1.5 text-white/45" style={{ fontSize: 13 }}>
                          <Globe size={12} />
                          {current.modern_country.ko}
                          <span className="text-white/20 ml-1" style={{ fontSize: 11 }}>
                            ({current.location_lat.toFixed(2)}, {current.location_lng.toFixed(2)})
                          </span>
                        </div>
                      )}

                      <div className="h-px bg-white/8" />

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

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-3 px-5 pb-5 pt-2">
                      <button
                        onClick={handleReject}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-400/20 bg-red-500/8 text-red-300 hover:bg-red-500/20 hover:border-red-400/40 transition-all active:scale-95 cursor-pointer"
                      >
                        <X size={18} />
                        <span className="text-sm font-medium">거부</span>
                        <kbd className="ml-1 text-[10px] text-red-400/40 bg-red-500/10 px-1.5 py-0.5 rounded">A</kbd>
                      </button>
                      <button
                        onClick={handleSkip}
                        className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-white/12 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronDown size={16} />
                        <kbd className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">S</kbd>
                      </button>
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
          </>
        )}
      </div>
    </main>
  );
}
