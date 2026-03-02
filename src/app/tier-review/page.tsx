"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import TierReviewMap from "@/components/tier-review/TierReviewMap";
import type { MapCircleEntity } from "@/components/tier-review/TierReviewMap";

// [cl] Tier 리뷰 페이지 — 시기별 전체 티어 + 리스트 뷰

interface Entity {
  qid?: string;
  name_en: string;
  name_ko?: string;
  start?: string;
  end?: string;
  lat?: string;
  lon?: string;
  sitelinks?: number;
  tier?: number;
  region?: string;
  score?: number;
  tier_reason?: string;
}

interface CircleEntity {
  name_en: string;
  name_ko: string;
  start_year: number;
  end_year: number;
  tier: number;
  region: string;
  qid: string;
  color: string;
  lon: number;
  lat: number;
  sitelinks: number;
  t1_start?: number;
  t1_end?: number;
}

// [cl] OHM 인덱스 엔트리
interface OhmSnapshot {
  rid: number;
  start: number;
  end: number;
  file: string;
}

interface OhmIndexEntry {
  qid: string;
  name_en: string;
  name_ko: string;
  tier: number;
  start_year: number;
  end_year: number;
  snapshots: OhmSnapshot[];
}

// [cl] 인라인 편집 로그
interface EditLogEntry {
  qid: string;
  field: string;
  old_value: string;
  new_value: string;
  year_context: number;
  timestamp: string;
}

// [cl] 노트
interface Note {
  id: string;
  qids: string[];
  year: number;
  text: string;
  created_at: string;
}

type ViewTab = "list" | "timeline";

const REGION_KO: Record<string, string> = {
  east_asia: "동아시아",
  southeast_asia: "동남아시아",
  south_asia: "남아시아",
  central_asia: "중앙아시아",
  middle_east: "중동",
  north_africa: "북아프리카",
  sub_saharan: "사하라이남",
  europe: "유럽",
  north_america: "북아메리카",
  latin_america: "중남아메리카",
  oceania: "오세아니아",
  unknown: "미분류",
};

const REGION_COLORS: Record<string, string> = {
  east_asia: "#ef4444",
  southeast_asia: "#f97316",
  south_asia: "#eab308",
  central_asia: "#84cc16",
  middle_east: "#06b6d4",
  north_africa: "#8b5cf6",
  sub_saharan: "#d946ef",
  europe: "#3b82f6",
  north_america: "#14b8a6",
  latin_america: "#f43f5e",
  oceania: "#6366f1",
  unknown: "#6b7280",
};

const TIER_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
  4: "#6b7280",
};

const TIER_LABELS: Record<number, string> = {
  1: "주요 국가",
  2: "지역 주요",
  3: "일반",
  4: "기타",
};

const ALL_REGIONS = Object.keys(REGION_KO);

// [cl] 타임라인 스냅샷 시점 (676개)
// BC3000~BC1000: 100년 단위, BC999~AD500: 50년 단위
// AD500~AD1500: 10년 단위, AD1500~2025: 1년 단위
const SNAPSHOT_YEARS: number[] = (() => {
  const years: number[] = [];
  for (let y = -3000; y <= -1000; y += 100) years.push(y);
  for (let y = -950; y <= 500; y += 50) years.push(y);
  for (let y = 510; y <= 1500; y += 10) years.push(y);
  for (let y = 1501; y <= 2025; y += 1) years.push(y);
  return years;
})();

function yearLabel(y: number): string {
  if (y < 0) return `BC ${Math.abs(y)}`;
  if (y === 1) return "AD 1";
  return `AD ${y}`;
}

interface ReviewComment {
  idx: number;
  name_en: string;
  name_ko?: string;
  tier: number;
  region: string;
  comment: string;
}

// ═══════════════════════════════════════════════════
// [cl] 시기별 보기 (Timeline View) — v2 리팩토링
// 토글 필터 + 카드 토글 선택 + 소팅 + 지도 연동
// ═══════════════════════════════════════════════════
function TimelineView() {
  const [circles, setCircles] = useState<CircleEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterRegion, setFilterRegion] = useState("all");
  const [search, setSearch] = useState("");

  // [cl] 티어 필터 — Set 기반 독립 토글 (복수 선택)
  const [activeTiers, setActiveTiers] = useState<Set<number>>(
    new Set([1, 2, 3])
  );

  // [cl] 카드 토글 선택 (QID 기반)
  const [selectedQids, setSelectedQids] = useState<Set<string>>(new Set());

  // [cl] 소팅
  const [sortBy, setSortBy] = useState<"year" | "name" | "sitelinks">("year");

  // [cl] OHM 폴리곤
  const [ohmIndex, setOhmIndex] = useState<OhmIndexEntry[] | null>(null);
  const [ohmPolygons, setOhmPolygons] = useState<Map<string, any>>(new Map());

  // [cl] 인라인 편집
  const [editingField, setEditingField] = useState<{
    qid: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLog, setEditLog] = useState<EditLogEntry[]>([]);

  // [cl] 노트
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState("");

  // [cl] 리사이즈 핸들 — 카드/지도 영역 높이 조절
  const [cardHeight, setCardHeight] = useState(45); // vh
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    y: number;
    cardH: number;
  } | null>(null);

  // [cl] 리사이즈 드래그 핸들러 — cardHeight만 변경, 지도는 나머지 공간 자동
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        y: e.clientY,
        cardH: cardHeight,
      };
    },
    [cardHeight]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = e.clientY - dragStartRef.current.y;
      const vh = window.innerHeight / 100;
      const deltaVh = delta / vh;
      const newCardH = Math.max(10, Math.min(75, dragStartRef.current.cardH + deltaVh));
      setCardHeight(newCardH);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);


  // [cl] circles 데이터 로드
  useEffect(() => {
    fetch("/geo/borders/wikidata_circles.json")
      .then((r) => r.json())
      .then((data) => {
        setCircles(data);
        const defaultIdx = SNAPSHOT_YEARS.indexOf(800);
        if (defaultIdx >= 0) setSelectedIdx(defaultIdx);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // [cl] OHM index 로드
  useEffect(() => {
    fetch("/geo/borders/ohm_index.json")
      .then((r) => r.json())
      .then((data) => setOhmIndex(data))
      .catch(() => {});
  }, []);

  const currentYear = SNAPSHOT_YEARS[selectedIdx] ?? 800;

  // [cl] 현재 연도에 활성인 엔티티들
  const activeEntities = useMemo(() => {
    return circles.filter(
      (c) => c.start_year <= currentYear && c.end_year >= currentYear
    );
  }, [circles, currentYear]);

  // [cl] OHM 폴리곤 fetch 함수
  const fetchOhmPolygon = useCallback(
    (qid: string) => {
      if (!ohmIndex) return;
      // [cl] MANUAL_ 접두어 매칭도 시도
      const entry =
        ohmIndex.find((e) => e.qid === qid) ||
        ohmIndex.find((e) => e.qid === `MANUAL_${qid}`);
      if (!entry || !entry.snapshots || entry.snapshots.length === 0) return;

      // 현재 연도에 포함되는 스냅샷 중 가장 적합한 것
      let best: OhmSnapshot | null = null;
      for (const s of entry.snapshots) {
        if (s.start <= currentYear && s.end >= currentYear) {
          if (!best || s.start > best.start) best = s;
        }
      }
      // 없으면 가장 가까운 것
      if (!best) {
        best = entry.snapshots.reduce((closest, s) => {
          const distS = Math.min(
            Math.abs(s.start - currentYear),
            Math.abs(s.end - currentYear)
          );
          const distC = closest
            ? Math.min(
                Math.abs(closest.start - currentYear),
                Math.abs(closest.end - currentYear)
              )
            : Infinity;
          return distS < distC ? s : closest;
        }, null as OhmSnapshot | null);
      }

      if (!best) return;

      const url = `/geo/borders/ohm/ohm_${best.rid}.geojson`;
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then((geojson) => {
          setOhmPolygons((old) => {
            const m = new Map(old);
            m.set(qid, geojson);
            return m;
          });
        })
        .catch(() => {});
    },
    [ohmIndex, currentYear]
  );

  // [cl] 필터링 + 소팅
  const filtered = useMemo(() => {
    let pool = activeEntities;

    // 티어 필터 (Set 기반)
    pool = pool.filter((e) => activeTiers.has(e.tier));

    // 권역 필터
    if (filterRegion !== "all") {
      pool = pool.filter((e) => e.region === filterRegion);
    }

    // 검색 필터
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      pool = pool.filter(
        (e) =>
          e.name_ko?.toLowerCase().includes(q) ||
          e.name_en.toLowerCase().includes(q) ||
          e.qid?.toLowerCase().includes(q)
      );
    }

    // 소팅
    const sorted = [...pool];
    switch (sortBy) {
      case "year":
        sorted.sort((a, b) => a.start_year - b.start_year);
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.name_ko || "").localeCompare(b.name_ko || "")
        );
        break;
      case "sitelinks":
        sorted.sort((a, b) => (b.sitelinks || 0) - (a.sitelinks || 0));
        break;
    }

    return sorted;
  }, [activeEntities, activeTiers, filterRegion, search, sortBy]);

  // [cl] 권역별 통계
  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    activeEntities.forEach((e) => {
      map[e.region] = (map[e.region] || 0) + 1;
    });
    return map;
  }, [activeEntities]);

  // [cl] 티어별 카운트 (티어 이외 필터 적용 후)
  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let pool = activeEntities;
    if (filterRegion !== "all")
      pool = pool.filter((e) => e.region === filterRegion);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      pool = pool.filter(
        (e) =>
          e.name_ko?.toLowerCase().includes(q) ||
          e.name_en.toLowerCase().includes(q) ||
          e.qid?.toLowerCase().includes(q)
      );
    }
    pool.forEach((e) => {
      counts[e.tier] = (counts[e.tier] || 0) + 1;
    });
    return counts;
  }, [activeEntities, filterRegion, search]);

  // [cl] 카드 토글
  const toggleCard = useCallback(
    (qid: string) => {
      setSelectedQids((prev) => {
        const next = new Set(prev);
        if (next.has(qid)) {
          next.delete(qid);
          setOhmPolygons((old) => {
            const m = new Map(old);
            m.delete(qid);
            return m;
          });
        } else {
          next.add(qid);
          fetchOhmPolygon(qid);
        }
        return next;
      });
    },
    [fetchOhmPolygon]
  );

  // [cl] 전체 선택
  const selectAll = useCallback(() => {
    const qids = new Set(
      filtered.map((e) => e.qid).filter(Boolean) as string[]
    );
    setSelectedQids(qids);
    qids.forEach((qid) => fetchOhmPolygon(qid));
  }, [filtered, fetchOhmPolygon]);

  // [cl] 전체 해제
  const deselectAll = useCallback(() => {
    setSelectedQids(new Set());
    setOhmPolygons(new Map());
  }, []);

  // [cl] 티어 토글
  const toggleTier = useCallback((tier: number) => {
    setActiveTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  // [cl] 선택된 엔티티들 (지도 전달용)
  const mapEntities: MapCircleEntity[] = useMemo(() => {
    return circles
      .filter((c) => selectedQids.has(c.qid))
      .map((c) => ({
        name_en: c.name_en,
        name_ko: c.name_ko,
        lon: c.lon,
        lat: c.lat,
        qid: c.qid,
        tier: c.tier,
        color: c.color,
      }));
  }, [circles, selectedQids]);

  // [cl] 인라인 편집 시작
  const startEdit = useCallback(
    (qid: string, field: string, currentValue: string) => {
      setEditingField({ qid, field });
      setEditValue(currentValue);
    },
    []
  );

  // [cl] 인라인 편집 저장
  const saveEdit = useCallback(() => {
    if (!editingField) return;
    const { qid, field } = editingField;
    const entity = circles.find((c) => c.qid === qid);
    if (!entity) {
      setEditingField(null);
      return;
    }

    const oldValue = String((entity as any)[field] ?? "");
    if (editValue.trim() === oldValue) {
      setEditingField(null);
      return;
    }

    // circles 상태 업데이트
    setCircles((prev) =>
      prev.map((c) => {
        if (c.qid !== qid) return c;
        if (field === "start_year" || field === "end_year") {
          const num = parseInt(editValue);
          if (isNaN(num)) return c;
          return { ...c, [field]: num };
        }
        return { ...c, [field]: editValue.trim() };
      })
    );

    // 수정 로그
    setEditLog((prev) => [
      ...prev,
      {
        qid,
        field,
        old_value: oldValue,
        new_value: editValue.trim(),
        year_context: currentYear,
        timestamp: new Date().toISOString(),
      },
    ]);

    setEditingField(null);
  }, [editingField, editValue, circles, currentYear]);

  // [cl] 노트 저장
  const saveNote = useCallback(() => {
    if (!noteDraft.trim() || selectedQids.size === 0) return;
    const newNote: Note = {
      id: String(Date.now()),
      qids: Array.from(selectedQids),
      year: currentYear,
      text: noteDraft.trim(),
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, newNote]);
    setNoteDraft("");
  }, [noteDraft, selectedQids, currentYear]);

  // [cl] 지도 마커 클릭 → 카드 토글 해제
  const handleMarkerClick = useCallback(
    (qid: string) => {
      toggleCard(qid);
    },
    [toggleCard]
  );

  // [cl] 수정된 QID 목록 (편집 표시용)
  const editedQids = useMemo(() => {
    return new Set(editLog.map((e) => e.qid));
  }, [editLog]);

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#888", textAlign: "center" }}>
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* ── 타임라인 슬라이더 ── */}
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #333",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: "#888" }}>시기 선택</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "monospace",
            }}
          >
            {yearLabel(currentYear)}
          </span>
          <span style={{ fontSize: 13, color: "#888" }}>
            {activeEntities.length}개 활성
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={SNAPSHOT_YEARS.length - 1}
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(parseInt(e.target.value))}
          style={{
            width: "100%",
            height: 6,
            accentColor: "#06b6d4",
            cursor: "pointer",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontSize: 10,
            color: "#555",
          }}
        >
          {[-3000, -2000, -1000, -500, 0, 500, 1000, 1500, 1800, 2025].map(
            (y) => (
              <span key={y}>{yearLabel(y === 0 ? 1 : y)}</span>
            )
          )}
        </div>
      </div>

      {/* ── 필터 바: 티어 토글 + 권역 + 소팅 + 전체 선택/해제 ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexShrink: 0,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* [cl] 티어 독립 토글 버튼 */}
        {[1, 2, 3, 4].map((tier) => {
          const isActive = activeTiers.has(tier);
          const color = TIER_COLORS[tier];
          const count = tierCounts[tier] || 0;

          return (
            <button
              key={tier}
              onClick={() => toggleTier(tier)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `2px solid ${color}`,
                background: isActive ? color : "transparent",
                color: isActive ? "#fff" : color,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                opacity: isActive ? 1 : 0.6,
                transition: "all 0.15s",
              }}
            >
              T{tier} ({count})
            </button>
          );
        })}

        <div
          style={{
            width: 1,
            height: 24,
            background: "#333",
            margin: "0 4px",
          }}
        />

        {/* [cl] 권역 필터 */}
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          <option value="all">모든 권역</option>
          {Object.entries(regionStats)
            .sort((a, b) => b[1] - a[1])
            .map(([r, count]) => (
              <option key={r} value={r}>
                {REGION_KO[r] || r} ({count})
              </option>
            ))}
        </select>

        {/* [cl] 소팅 드롭다운 */}
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "year" | "name" | "sitelinks")
          }
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          <option value="year">연도순</option>
          <option value="name">국명순</option>
          <option value="sitelinks">중요도순</option>
        </select>

        <div
          style={{
            width: 1,
            height: 24,
            background: "#333",
            margin: "0 4px",
          }}
        />

        {/* [cl] 전체 선택 / 해제 */}
        <button
          onClick={selectAll}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            border: "1px solid #06b6d4",
            background: "transparent",
            color: "#06b6d4",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          전체 선택
        </button>
        <button
          onClick={deselectAll}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            border: "1px solid #666",
            background: "transparent",
            color: "#888",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          전체 해제
        </button>

        {/* [cl] 검색 */}
        <input
          type="text"
          placeholder="검색 (한글/영문/QID)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 13,
            width: 180,
          }}
        />

        {/* [cl] 카운트 요약 */}
        <span style={{ fontSize: 12, color: "#888", marginLeft: "auto" }}>
          {filtered.length}개 표시
          {selectedQids.size > 0 && (
            <span style={{ color: "#06b6d4", marginLeft: 8 }}>
              {selectedQids.size}개 선택
            </span>
          )}
        </span>
      </div>

      {/* ── 권역 분포 미니 바 ── */}
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 16,
          background: "#222",
          flexShrink: 0,
        }}
      >
        {Object.entries(regionStats)
          .sort((a, b) => b[1] - a[1])
          .map(([region, count]) => (
            <div
              key={region}
              title={`${REGION_KO[region]}: ${count}`}
              style={{
                width: `${(count / activeEntities.length) * 100}%`,
                background: REGION_COLORS[region] || "#666",
                minWidth: 3,
              }}
            />
          ))}
      </div>

      {/* ═══ 카드 그리드 (스크롤) ═══ */}
      <div
        style={{
          height: `${cardHeight}vh`,
          overflowY: "auto",
          padding: "4px 0",
          flexShrink: 0,
        }}
      >
        {filtered.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {filtered.map((entity) => {
              const isSelected = selectedQids.has(entity.qid);
              const regionColor = REGION_COLORS[entity.region] || "#666";
              const tierColor = TIER_COLORS[entity.tier] || "#666";
              const isEdited = editedQids.has(entity.qid);
              const isEditingThis = editingField?.qid === entity.qid;

              return (
                <div
                  key={entity.qid || entity.name_en}
                  onClick={() => {
                    if (!isEditingThis) toggleCard(entity.qid);
                  }}
                  style={{
                    background: "#1a1a1a",
                    border: isSelected
                      ? "2px solid #06b6d4"
                      : `1px solid ${tierColor}30`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    borderLeft: `4px solid ${regionColor}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: isSelected
                      ? "0 0 12px rgba(6,182,212,0.2)"
                      : "none",
                    position: "relative",
                  }}
                >
                  {/* [cl] 티어 배지 + 수정 표시 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: tierColor,
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      T{entity.tier}
                    </span>
                    {isEdited && (
                      <span
                        style={{ fontSize: 12, color: "#f59e0b" }}
                        title="수정됨"
                      >
                        ✎
                      </span>
                    )}
                  </div>

                  {/* [cl] name_ko — 더블클릭으로 편집 */}
                  {editingField?.qid === entity.qid &&
                  editingField.field === "name_ko" ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingField(null);
                      }}
                      onBlur={saveEdit}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "2px 4px",
                        background: "#0a0a0a",
                        color: "#fff",
                        border: "1px solid #06b6d4",
                        borderRadius: 3,
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(entity.qid, "name_ko", entity.name_ko);
                      }}
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        marginBottom: 2,
                      }}
                      title="더블클릭으로 편집"
                    >
                      {entity.name_ko || entity.name_en}
                    </div>
                  )}

                  {/* [cl] name_en — 더블클릭으로 편집 */}
                  {editingField?.qid === entity.qid &&
                  editingField.field === "name_en" ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingField(null);
                      }}
                      onBlur={saveEdit}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "1px 4px",
                        background: "#0a0a0a",
                        color: "#888",
                        border: "1px solid #06b6d4",
                        borderRadius: 3,
                        fontSize: 11,
                        marginBottom: 2,
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(entity.qid, "name_en", entity.name_en);
                      }}
                      style={{ fontSize: 11, color: "#888", marginBottom: 2 }}
                      title="더블클릭으로 편집"
                    >
                      {entity.name_en}
                    </div>
                  )}

                  {/* [cl] QID */}
                  <div
                    style={{
                      fontSize: 10,
                      color: "#555",
                      marginBottom: 4,
                      fontFamily: "monospace",
                    }}
                  >
                    {entity.qid}
                  </div>

                  {/* [cl] 기간 + 권역 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: `${regionColor}20`,
                        color: regionColor,
                        border: `1px solid ${regionColor}40`,
                      }}
                    >
                      {REGION_KO[entity.region] || entity.region}
                    </span>

                    {/* [cl] 기간 — 더블클릭 편집 */}
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(
                          entity.qid,
                          "start_year",
                          String(entity.start_year)
                        );
                      }}
                      style={{
                        fontSize: 10,
                        color: "#666",
                        fontFamily: "monospace",
                        cursor: "text",
                      }}
                      title="더블클릭으로 시작연도 편집"
                    >
                      {editingField?.qid === entity.qid &&
                      editingField.field === "start_year" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingField(null);
                          }}
                          onBlur={saveEdit}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            width: 50,
                            padding: "0 2px",
                            background: "#0a0a0a",
                            color: "#fff",
                            border: "1px solid #06b6d4",
                            borderRadius: 2,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                        />
                      ) : (
                        yearLabel(entity.start_year)
                      )}
                      ~
                      {editingField?.qid === entity.qid &&
                      editingField.field === "end_year" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingField(null);
                          }}
                          onBlur={saveEdit}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            width: 50,
                            padding: "0 2px",
                            background: "#0a0a0a",
                            color: "#fff",
                            border: "1px solid #06b6d4",
                            borderRadius: 2,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEdit(
                              entity.qid,
                              "end_year",
                              String(entity.end_year)
                            );
                          }}
                          title="더블클릭으로 종료연도 편집"
                        >
                          {yearLabel(entity.end_year)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* [cl] sitelinks (중요도 참고용) */}
                  {entity.sitelinks > 0 && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "#444",
                        marginTop: 3,
                        textAlign: "right",
                      }}
                    >
                      SL:{entity.sitelinks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
            해당 조건에 맞는 엔티티가 없습니다.
          </div>
        )}
      </div>

      {/* ═══ 노트 영역 (선택된 카드 있을 때만) ═══ */}
      {selectedQids.size > 0 && (
        <div
          style={{
            background: "#1a1a1a",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            border: "1px solid #333",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, color: "#06b6d4", fontWeight: 600 }}>
              {selectedQids.size === 1
                ? `${circles.find((c) => c.qid === Array.from(selectedQids)[0])?.name_ko || ""} 노트`
                : `${selectedQids.size}개 선택 · ${yearLabel(currentYear)}`}
            </span>
            <span style={{ fontSize: 10, color: "#555" }}>
              {Array.from(selectedQids).join(", ")}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
              }}
              placeholder="노트 입력 (Enter로 저장)..."
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "#0a0a0a",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 6,
                fontSize: 13,
              }}
            />
            <button
              onClick={saveNote}
              disabled={!noteDraft.trim()}
              style={{
                padding: "8px 16px",
                background: noteDraft.trim() ? "#06b6d4" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: noteDraft.trim() ? "pointer" : "default",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              저장
            </button>
          </div>

          {/* [cl] 기존 노트 표시 */}
          {notes.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {notes
                .filter((n) =>
                  n.qids.some((qid) => selectedQids.has(qid))
                )
                .slice(-5)
                .map((note) => (
                  <div
                    key={note.id}
                    style={{
                      padding: "6px 10px",
                      background: "#0f0f0f",
                      borderRadius: 4,
                      marginBottom: 4,
                      fontSize: 12,
                      border: "1px solid #222",
                    }}
                  >
                    <span style={{ color: "#06b6d4" }}>
                      [{yearLabel(note.year)}]
                    </span>{" "}
                    <span style={{ color: "#ccc" }}>{note.text}</span>
                    <span style={{ color: "#444", marginLeft: 8, fontSize: 10 }}>
                      {note.qids.join(", ")}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 리사이즈 핸들 ═══ */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          height: 10,
          flexShrink: 0,
          background: isDragging ? "#06b6d4" : "#262626",
          cursor: "row-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          margin: "4px 0",
          transition: isDragging ? "none" : "background 0.2s",
          userSelect: "none",
          border: `1px solid ${isDragging ? "#06b6d4" : "#333"}`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 3,
            borderRadius: 2,
            background: isDragging ? "#fff" : "#555",
          }}
        />
      </div>

      {/* ═══ Leaflet 지도 (남은 공간 전부 채움) ═══ */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TierReviewMap
          selectedEntities={mapEntities}
          ohmPolygons={ohmPolygons}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* ── 범례 ── */}
      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "#1a1a1a",
          borderRadius: 8,
          border: "1px solid #2a2a2a",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "#666" }}>티어:</div>
          {[1, 2, 3, 4].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: TIER_COLORS[t],
                }}
              />
              <span style={{ color: "#aaa" }}>
                T{t} ({TIER_LABELS[t]})
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
          권역 색상
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(REGION_KO)
            .filter(([k]) => k !== "unknown")
            .map(([key, label]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                  fontSize: 11,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: REGION_COLORS[key],
                  }}
                />
                <span style={{ color: "#888" }}>{label}</span>
              </div>
            ))}
        </div>

        {/* [cl] 수정 로그 카운트 */}
        {editLog.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#f59e0b" }}>
            ✎ {editLog.length}건 수정됨 (세션 내)
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// [cl] 전체 리스트 뷰 (기존 코드)
// ═══════════════════════════════════════════════════
function ListView({
  entities,
  setEntities,
}: {
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<
    "all" | "flagged" | "commented"
  >("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "score" | "sitelinks" | "name_ko" | "name_en" | "tier"
  >("score");
  const [sortDesc, setSortDesc] = useState(true);

  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [comments, setComments] = useState<Record<number, string>>({});
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSaveMsg, setCommentSaveMsg] = useState("");

  useEffect(() => {
    fetch("/api/tiers/comments")
      .then((r) => r.json())
      .then((data) => {
        setFlagged(new Set(data.flagged || []));
        setComments(data.comments || {});
      })
      .catch(() => {});
  }, []);

  const saveCommentsToServer = useCallback(async () => {
    setCommentSaving(true);
    try {
      const res = await fetch("/api/tiers/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: Array.from(flagged), comments }),
      });
      const result = await res.json();
      setCommentSaveMsg(`코멘트 ${result.saved}개 저장 완료!`);
    } catch {
      setCommentSaveMsg("코멘트 저장 실패!");
    }
    setCommentSaving(false);
    setTimeout(() => setCommentSaveMsg(""), 3000);
  }, [flagged, comments]);

  const filtered = useMemo(() => {
    let result = entities.map((e, i) => ({ ...e, _idx: i }));

    if (filterRegion !== "all")
      result = result.filter((e) => e.region === filterRegion);
    if (filterTier !== "all")
      result = result.filter((e) => e.tier === parseInt(filterTier));
    if (filterFlag === "flagged")
      result = result.filter((e) => flagged.has(e._idx));
    else if (filterFlag === "commented")
      result = result.filter((e) => comments[e._idx]);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          (e.name_ko && e.name_ko.toLowerCase().includes(q)) ||
          e.name_en.toLowerCase().includes(q) ||
          (e.qid && e.qid.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "score") {
        va = a.score ?? 0;
        vb = b.score ?? 0;
      } else if (sortBy === "sitelinks") {
        va = a.sitelinks ?? 0;
        vb = b.sitelinks ?? 0;
      } else if (sortBy === "tier") {
        va = a.tier ?? 99;
        vb = b.tier ?? 99;
      } else if (sortBy === "name_ko") {
        va = a.name_ko ?? "zzz";
        vb = b.name_ko ?? "zzz";
      } else {
        va = a.name_en;
        vb = b.name_en;
      }
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });

    return result;
  }, [
    entities,
    filterRegion,
    filterTier,
    filterFlag,
    search,
    sortBy,
    sortDesc,
    flagged,
    comments,
  ]);

  const toggleFlag = useCallback((idx: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const saveComment = useCallback(
    (idx: number) => {
      if (commentDraft.trim()) {
        setComments((prev) => ({ ...prev, [idx]: commentDraft.trim() }));
        setFlagged((prev) => new Set(prev).add(idx));
      } else {
        setComments((prev) => {
          const next = { ...prev };
          delete next[idx];
          return next;
        });
      }
      setEditingComment(null);
      setCommentDraft("");
    },
    [commentDraft]
  );

  const changeTier = useCallback(
    (idx: number, newTier: number) => {
      setEntities((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], tier: newTier };
        return next;
      });
      setDirty((prev) => new Set(prev).add(idx));
    },
    [setEntities]
  );

  const changeRegion = useCallback(
    (idx: number, newRegion: string) => {
      setEntities((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], region: newRegion };
        return next;
      });
      setDirty((prev) => new Set(prev).add(idx));
    },
    [setEntities]
  );

  const save = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    const updates = Array.from(dirty).map((idx) => ({
      qid: entities[idx].qid,
      name_en: entities[idx].name_en,
      tier: entities[idx].tier ?? 4,
      region: entities[idx].region ?? "unknown",
    }));
    try {
      const res = await fetch("/api/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      setSaveMsg(`${result.updated}개 저장 완료!`);
      setDirty(new Set());
    } catch {
      setSaveMsg("저장 실패!");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const stats = useMemo(() => {
    const byTier: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    entities.forEach((e) => {
      byTier[e.tier ?? 4] = (byTier[e.tier ?? 4] || 0) + 1;
    });
    return byTier;
  }, [entities]);

  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    entities.forEach((e) => {
      map[e.region ?? "unknown"] = (map[e.region ?? "unknown"] || 0) + 1;
    });
    return map;
  }, [entities]);

  const flagCount = flagged.size;
  const commentCount = Object.keys(comments).length;

  return (
    <div>
      {/* 통계 바 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {[1, 2, 3, 4].map((t) => (
          <div
            key={t}
            onClick={() =>
              setFilterTier(filterTier === String(t) ? "all" : String(t))
            }
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              background: filterTier === String(t) ? TIER_COLORS[t] : "#222",
              border: `2px solid ${TIER_COLORS[t]}`,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Tier {t}: {stats[t] ?? 0}개
          </div>
        ))}
        <div
          onClick={() => setFilterTier("all")}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            background: filterTier === "all" ? "#444" : "#222",
            border: "2px solid #555",
            cursor: "pointer",
          }}
        >
          전체
        </div>
        <div
          onClick={() =>
            setFilterFlag(filterFlag === "flagged" ? "all" : "flagged")
          }
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            background: filterFlag === "flagged" ? "#a855f7" : "#222",
            border: "2px solid #a855f7",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          체크됨: {flagCount}개
        </div>
        <div
          onClick={() =>
            setFilterFlag(filterFlag === "commented" ? "all" : "commented")
          }
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            background: filterFlag === "commented" ? "#ec4899" : "#222",
            border: "2px solid #ec4899",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          코멘트: {commentCount}개
        </div>
      </div>

      {/* 필터 바 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
          }}
        >
          <option value="all">모든 권역</option>
          {ALL_REGIONS.map((r) => (
            <option key={r} value={r}>
              {REGION_KO[r]} ({regionStats[r] ?? 0})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="검색 (한글/영문/QID)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            width: 250,
          }}
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
          }}
        >
          <option value="score">스코어순</option>
          <option value="sitelinks">Sitelinks순</option>
          <option value="tier">Tier순</option>
          <option value="name_ko">한국어명순</option>
          <option value="name_en">영문명순</option>
        </select>

        <button
          onClick={() => setSortDesc(!sortDesc)}
          style={{
            padding: "6px 12px",
            background: "#333",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {sortDesc ? "▼ 내림" : "▲ 오름"}
        </button>

        <span style={{ color: "#888" }}>{filtered.length}개 표시</span>

        <button
          onClick={saveCommentsToServer}
          disabled={commentSaving || (flagCount === 0 && commentCount === 0)}
          style={{
            padding: "6px 16px",
            background: flagCount > 0 || commentCount > 0 ? "#a855f7" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor:
              flagCount > 0 || commentCount > 0 ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          {commentSaving ? "저장 중..." : `코멘트 저장 (${commentCount}개)`}
        </button>
        {commentSaveMsg && (
          <span style={{ color: "#a855f7", fontWeight: 600 }}>
            {commentSaveMsg}
          </span>
        )}

        <button
          onClick={save}
          disabled={dirty.size === 0 || saving}
          style={{
            marginLeft: "auto",
            padding: "8px 24px",
            background: dirty.size > 0 ? "#22c55e" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: dirty.size > 0 ? "pointer" : "default",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {saving ? "저장 중..." : `Tier 저장 (${dirty.size}개 변경)`}
        </button>
        {saveMsg && (
          <span style={{ color: "#22c55e", fontWeight: 600 }}>{saveMsg}</span>
        )}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
              <th style={{ padding: "8px 4px", width: 30 }}>V</th>
              <th style={{ padding: "8px 4px", width: 35 }}>#</th>
              <th style={{ padding: "8px 4px", width: 70 }}>Tier</th>
              <th style={{ padding: "8px 4px", width: 50 }}>점수</th>
              <th style={{ padding: "8px 4px", width: 40 }}>SL</th>
              <th style={{ padding: "8px 4px", width: 140 }}>한국어명</th>
              <th style={{ padding: "8px 4px" }}>영문명</th>
              <th style={{ padding: "8px 4px", width: 100 }}>존속기간</th>
              <th style={{ padding: "8px 4px", width: 110 }}>권역</th>
              <th style={{ padding: "8px 4px", width: 200 }}>코멘트</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const isDirty = dirty.has(e._idx);
              const isFlagged = flagged.has(e._idx);
              const hasComment = !!comments[e._idx];
              const isEditing = editingComment === e._idx;

              return (
                <tr
                  key={e._idx}
                  style={{
                    borderBottom: "1px solid #222",
                    background: isFlagged
                      ? "#2a1a2a"
                      : isDirty
                        ? "#1a2a1a"
                        : i % 2 === 0
                          ? "#161616"
                          : "#111",
                  }}
                >
                  <td style={{ padding: "4px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isFlagged}
                      onChange={() => toggleFlag(e._idx)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        accentColor: "#a855f7",
                      }}
                    />
                  </td>
                  <td style={{ padding: "4px", color: "#666" }}>{i + 1}</td>
                  <td style={{ padding: "4px" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1, 2, 3, 4].map((t) => (
                        <button
                          key={t}
                          onClick={() => changeTier(e._idx, t)}
                          style={{
                            width: 26,
                            height: 24,
                            border: "none",
                            borderRadius: 3,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 11,
                            background:
                              e.tier === t ? TIER_COLORS[t] : "#2a2a2a",
                            color: e.tier === t ? "#fff" : "#555",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td
                    style={{ padding: "4px", color: "#888", fontSize: 11 }}
                  >
                    {e.score?.toFixed(1) ?? "—"}
                  </td>
                  <td
                    style={{ padding: "4px", color: "#aaa", fontSize: 12 }}
                  >
                    {e.sitelinks ?? 0}
                  </td>
                  <td
                    style={{
                      padding: "4px",
                      fontWeight: e.name_ko ? 600 : 400,
                      color: e.name_ko ? "#fff" : "#555",
                    }}
                  >
                    {e.name_ko || "—"}
                  </td>
                  <td style={{ padding: "4px" }}>{e.name_en}</td>
                  <td
                    style={{ padding: "4px", color: "#888", fontSize: 11 }}
                  >
                    {e.start ?? "?"} ~ {e.end ?? "?"}
                  </td>
                  <td style={{ padding: "4px" }}>
                    <select
                      value={e.region ?? "unknown"}
                      onChange={(ev) => changeRegion(e._idx, ev.target.value)}
                      style={{
                        padding: "2px 4px",
                        background: "#222",
                        color: "#ccc",
                        border: "1px solid #444",
                        borderRadius: 3,
                        fontSize: 11,
                        width: "100%",
                      }}
                    >
                      {ALL_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {REGION_KO[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "4px" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          type="text"
                          value={commentDraft}
                          onChange={(ev) => setCommentDraft(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") saveComment(e._idx);
                            if (ev.key === "Escape") {
                              setEditingComment(null);
                              setCommentDraft("");
                            }
                          }}
                          autoFocus
                          placeholder="코멘트 입력 (Enter 저장)"
                          style={{
                            flex: 1,
                            padding: "3px 6px",
                            background: "#1a1a2a",
                            color: "#fff",
                            border: "1px solid #a855f7",
                            borderRadius: 3,
                            fontSize: 12,
                          }}
                        />
                        <button
                          onClick={() => saveComment(e._idx)}
                          style={{
                            padding: "3px 8px",
                            background: "#a855f7",
                            color: "#fff",
                            border: "none",
                            borderRadius: 3,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingComment(e._idx);
                          setCommentDraft(comments[e._idx] || "");
                        }}
                        style={{
                          padding: "3px 6px",
                          minHeight: 24,
                          cursor: "text",
                          borderRadius: 3,
                          fontSize: 12,
                          background: hasComment ? "#1a1a2a" : "transparent",
                          border: hasComment
                            ? "1px solid #a855f766"
                            : "1px solid transparent",
                          color: hasComment ? "#d8b4fe" : "#444",
                        }}
                      >
                        {comments[e._idx] || "클릭하여 코멘트 추가"}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
          해당 조건에 맞는 엔티티가 없습니다.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// [cl] 메인 페이지 — 탭 전환
// ═══════════════════════════════════════════════════
export default function TierReviewPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>("timeline");

  useEffect(() => {
    fetch("/api/tiers")
      .then((r) => r.json())
      .then((data) => {
        setEntities(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          color: "#fff",
          background: "#111",
          minHeight: "100vh",
        }}
      >
        로딩 중...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 30px 0 30px",
        color: "#e0e0e0",
        background: "#111",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Pretendard', sans-serif",
        display: "flex",
        flexDirection: "column" as const,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>
          Tier Review — {entities.length}개 엔티티
        </h1>
      </div>

      {/* ── 탭 전환 ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab("timeline")}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            background: activeTab === "timeline" ? "#06b6d4" : "#222",
            color: activeTab === "timeline" ? "#fff" : "#888",
            border:
              activeTab === "timeline"
                ? "2px solid #06b6d4"
                : "2px solid #333",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          시기별 보기
        </button>
        <button
          onClick={() => setActiveTab("list")}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            background: activeTab === "list" ? "#06b6d4" : "#222",
            color: activeTab === "list" ? "#fff" : "#888",
            border:
              activeTab === "list" ? "2px solid #06b6d4" : "2px solid #333",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          전체 리스트
        </button>
      </div>

      {/* ── 탭 컨텐츠 (flex: 1로 남은 공간 전부 차지) ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
        {activeTab === "timeline" && <TimelineView />}
        {activeTab === "list" && (
          <ListView entities={entities} setEntities={setEntities} />
        )}
      </div>
    </div>
  );
}
