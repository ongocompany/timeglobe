"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

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
  t1_start?: number;
  t1_end?: number;
  t1_sources?: number;
}

interface SnapshotEntity {
  name_en: string;
  name_ko: string;
  sources: number;
  region: string;
  t1_start: number;
  t1_end: number;
}

interface Snapshot {
  year: number;
  label: string;
  count: number;
  entities: SnapshotEntity[];
}

type ViewTab = "list" | "timeline";
type TierFilter = "all" | "1" | "2" | "3";

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

const SOURCE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  4: { bg: "#dc262620", border: "#ef4444", text: "#fca5a5" },
  3: { bg: "#f59e0b15", border: "#f59e0b", text: "#fcd34d" },
  2: { bg: "#3b82f615", border: "#3b82f6", text: "#93c5fd" },
  1: { bg: "#6b728015", border: "#6b7280", text: "#9ca3af" },
};

const ALL_REGIONS = Object.keys(REGION_KO);

// [cl] 타임라인 스냅샷 시점
const SNAPSHOT_YEARS = [
  -3000, -2500, -2000, -1500, -1200, -1000,
  -800, -600, -500, -400, -300, -200, -100,
  1, 100, 200, 300, 400, 500, 600, 700, 800, 900,
  1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800,
];

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
// [cl] 시기별 보기 (Timeline View) — 전체 티어 통합
// ═══════════════════════════════════════════════════
function TimelineView() {
  const [circles, setCircles] = useState<CircleEntity[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterRegion, setFilterRegion] = useState("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [t3Expanded, setT3Expanded] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/geo/borders/wikidata_circles.json").then((r) => r.json()),
      fetch("/geo/borders/tier_snapshots.json").then((r) => r.json()),
    ])
      .then(([circlesData, snapshotsData]) => {
        setCircles(circlesData);
        setSnapshots(snapshotsData);
        const defaultIdx = SNAPSHOT_YEARS.indexOf(800);
        if (defaultIdx >= 0) setSelectedIdx(defaultIdx);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentYear = SNAPSHOT_YEARS[selectedIdx] ?? 800;

  // [cl] 현재 연도에 활성인 엔티티들
  const activeEntities = useMemo(() => {
    return circles.filter(
      (c) => c.start_year <= currentYear && c.end_year >= currentYear
    );
  }, [circles, currentYear]);

  // [cl] T1 스냅샷 데이터 (sources 정보 포함)
  const t1Snapshot = useMemo(() => {
    const snap = snapshots.find((s) => s.year === currentYear);
    return snap?.entities || [];
  }, [snapshots, currentYear]);

  // [cl] 티어별 + 필터별 분류
  const grouped = useMemo(() => {
    let pool = activeEntities;

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
          e.name_en.toLowerCase().includes(q)
      );
    }

    const t1 = pool.filter((e) => e.tier === 1);
    const t2 = pool.filter((e) => e.tier === 2);
    const t3 = pool.filter((e) => e.tier === 3);

    return { t1, t2, t3, total: pool.length };
  }, [activeEntities, filterRegion, search]);

  // [cl] 권역별 통계 (전체)
  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    activeEntities.forEach((e) => {
      map[e.region] = (map[e.region] || 0) + 1;
    });
    return map;
  }, [activeEntities]);

  // [cl] T3를 권역별로 그룹핑
  const t3ByRegion = useMemo(() => {
    const map: Record<string, CircleEntity[]> = {};
    grouped.t3.forEach((e) => {
      const r = e.region || "unknown";
      if (!map[r]) map[r] = [];
      map[r].push(e);
    });
    // 권역별 정렬 (개수 내림차순)
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [grouped.t3]);

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#888", textAlign: "center" }}>
        데이터 로딩 중...
      </div>
    );
  }

  const showT1 = tierFilter === "all" || tierFilter === "1";
  const showT2 = tierFilter === "all" || tierFilter === "2";
  const showT3 = tierFilter === "all" || tierFilter === "3";

  return (
    <div>
      {/* ── 타임라인 슬라이더 ── */}
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          padding: "16px 20px",
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
          {SNAPSHOT_YEARS.filter((_, i) => i % 4 === 0).map((y) => (
            <span key={y}>{yearLabel(y)}</span>
          ))}
        </div>
      </div>

      {/* ── 티어 필터 + 검색 바 ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* 티어 필터 버튼 */}
        {(["all", "1", "2", "3"] as TierFilter[]).map((tf) => {
          const count =
            tf === "all"
              ? grouped.total
              : tf === "1"
                ? grouped.t1.length
                : tf === "2"
                  ? grouped.t2.length
                  : grouped.t3.length;
          const label =
            tf === "all"
              ? "전체"
              : `T${tf}`;
          const color =
            tf === "all"
              ? "#06b6d4"
              : TIER_COLORS[parseInt(tf)];
          const isActive = tierFilter === tf;

          return (
            <button
              key={tf}
              onClick={() => setTierFilter(tf)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `2px solid ${color}`,
                background: isActive ? color : "transparent",
                color: isActive ? "#fff" : color,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {label} ({count})
            </button>
          );
        })}

        <div style={{ width: 1, height: 24, background: "#333", margin: "0 4px" }} />

        {/* 권역 필터 */}
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

        {/* 검색 */}
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 13,
            width: 160,
          }}
        />

        <span style={{ fontSize: 13, color: "#888", marginLeft: "auto" }}>
          T1:{grouped.t1.length} T2:{grouped.t2.length} T3:{grouped.t3.length}
        </span>
      </div>

      {/* ── 권역 분포 미니 바 ── */}
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          marginBottom: 20,
          background: "#222",
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

      {/* ═══ T1 섹션 ═══ */}
      {showT1 && grouped.t1.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                background: TIER_COLORS[1],
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              T1
            </span>
            <span style={{ color: "#ef4444", fontWeight: 600, fontSize: 14 }}>
              주요 국가 · {grouped.t1.length}개
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#ef444440",
                marginLeft: 8,
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 8,
            }}
          >
            {grouped.t1.map((entity) => {
              // T1 스냅샷에서 sources 정보 가져오기
              const snapInfo = t1Snapshot.find(
                (s) => s.name_en === entity.name_en
              );
              const sources = snapInfo?.sources ?? entity.t1_sources ?? 1;
              const sc = SOURCE_COLORS[sources] || SOURCE_COLORS[1];
              const regionColor = REGION_COLORS[entity.region] || "#666";

              return (
                <div
                  key={entity.qid || entity.name_en}
                  style={{
                    background: sc.bg,
                    border: `1px solid ${sc.border}40`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    borderLeft: `4px solid ${regionColor}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 4,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {entity.name_ko}
                      </div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {entity.name_en}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: n <= sources ? sc.border : "#333",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 8px",
                        borderRadius: 10,
                        background: `${regionColor}20`,
                        color: regionColor,
                        border: `1px solid ${regionColor}40`,
                      }}
                    >
                      {REGION_KO[entity.region] || entity.region}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#666",
                        fontFamily: "monospace",
                      }}
                    >
                      {entity.start_year <= 0
                        ? `BC${Math.abs(entity.start_year)}`
                        : entity.start_year}
                      ~
                      {entity.end_year <= 0
                        ? `BC${Math.abs(entity.end_year)}`
                        : entity.end_year}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ T2 섹션 ═══ */}
      {showT2 && grouped.t2.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                background: TIER_COLORS[2],
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              T2
            </span>
            <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 14 }}>
              지역 주요 · {grouped.t2.length}개
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#f59e0b40",
                marginLeft: 8,
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 6,
            }}
          >
            {grouped.t2.map((entity) => {
              const regionColor = REGION_COLORS[entity.region] || "#666";
              return (
                <div
                  key={entity.qid || entity.name_en}
                  style={{
                    background: "#1a1a1a",
                    border: `1px solid #f59e0b30`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    borderLeft: `3px solid ${regionColor}`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {entity.name_ko}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 3,
                    }}
                  >
                    <span style={{ fontSize: 10, color: regionColor }}>
                      {REGION_KO[entity.region] || entity.region}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "#555",
                        fontFamily: "monospace",
                      }}
                    >
                      {entity.start_year}~{entity.end_year}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ T3 섹션 ═══ */}
      {showT3 && grouped.t3.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              cursor: "pointer",
            }}
            onClick={() => setT3Expanded(!t3Expanded)}
          >
            <span
              style={{
                background: TIER_COLORS[3],
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              T3
            </span>
            <span style={{ color: "#3b82f6", fontWeight: 600, fontSize: 14 }}>
              기타 · {grouped.t3.length}개
            </span>
            <span style={{ fontSize: 12, color: "#555" }}>
              {t3Expanded ? "▼ 접기" : "▶ 펼치기"}
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#3b82f640",
                marginLeft: 8,
              }}
            />
          </div>

          {t3Expanded && (
            <div
              style={{
                background: "#141418",
                borderRadius: 8,
                padding: "12px 16px",
                border: "1px solid #222",
              }}
            >
              {t3ByRegion.map(([region, entities]) => (
                <div key={region} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: REGION_COLORS[region] || "#666",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: REGION_COLORS[region] || "#666",
                      }}
                    >
                      {REGION_KO[region] || region} ({entities.length})
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      paddingLeft: 16,
                    }}
                  >
                    {entities.map((e) => (
                      <span
                        key={e.qid || e.name_en}
                        title={`${e.name_en} (${e.start_year}~${e.end_year})`}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#1e1e24",
                          color: "#aaa",
                          border: "1px solid #2a2a30",
                          cursor: "default",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.name_ko || e.name_en}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {grouped.total === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
          해당 조건에 맞는 엔티티가 없습니다.
        </div>
      )}

      {/* ── 범례 ── */}
      <div
        style={{
          marginTop: 20,
          padding: "12px 16px",
          background: "#1a1a1a",
          borderRadius: 8,
          border: "1px solid #2a2a2a",
        }}
      >
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#666" }}>티어:</div>
          {[1, 2, 3].map((t) => (
            <div key={t} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: TIER_COLORS[t],
                }}
              />
              <span style={{ color: "#aaa" }}>
                T{t}{" "}
                {t === 1
                  ? "(최대 줌아웃)"
                  : t === 2
                    ? "(지역 줌)"
                    : "(근접 줌)"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
          T1 합의도 (4개 AI: GPT · Claude · Gemini · Qwen)
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
          {[4, 3, 2, 1].map((n) => {
            const sc = SOURCE_COLORS[n];
            return (
              <div
                key={n}
                style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}
              >
                <div style={{ display: "flex", gap: 2 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: i <= n ? sc.border : "#333",
                      }}
                    />
                  ))}
                </div>
                <span style={{ color: sc.text }}>
                  {n}/4{" "}
                  {n === 4
                    ? "(전원)"
                    : n === 3
                      ? "(강력)"
                      : n === 2
                        ? "(권장)"
                        : "(단일)"}
                </span>
              </div>
            );
          })}
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
                style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}
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
  const [filterFlag, setFilterFlag] = useState<"all" | "flagged" | "commented">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "sitelinks" | "name_ko" | "name_en" | "tier">("score");
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

    if (filterRegion !== "all") result = result.filter((e) => e.region === filterRegion);
    if (filterTier !== "all") result = result.filter((e) => e.tier === parseInt(filterTier));
    if (filterFlag === "flagged") result = result.filter((e) => flagged.has(e._idx));
    else if (filterFlag === "commented") result = result.filter((e) => comments[e._idx]);
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
      if (sortBy === "score") { va = a.score ?? 0; vb = b.score ?? 0; }
      else if (sortBy === "sitelinks") { va = a.sitelinks ?? 0; vb = b.sitelinks ?? 0; }
      else if (sortBy === "tier") { va = a.tier ?? 99; vb = b.tier ?? 99; }
      else if (sortBy === "name_ko") { va = a.name_ko ?? "zzz"; vb = b.name_ko ?? "zzz"; }
      else { va = a.name_en; vb = b.name_en; }
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });

    return result;
  }, [entities, filterRegion, filterTier, filterFlag, search, sortBy, sortDesc, flagged, comments]);

  const toggleFlag = useCallback((idx: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const saveComment = useCallback((idx: number) => {
    if (commentDraft.trim()) {
      setComments((prev) => ({ ...prev, [idx]: commentDraft.trim() }));
      setFlagged((prev) => new Set(prev).add(idx));
    } else {
      setComments((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    }
    setEditingComment(null);
    setCommentDraft("");
  }, [commentDraft]);

  const changeTier = useCallback((idx: number, newTier: number) => {
    setEntities((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tier: newTier };
      return next;
    });
    setDirty((prev) => new Set(prev).add(idx));
  }, [setEntities]);

  const changeRegion = useCallback((idx: number, newRegion: string) => {
    setEntities((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], region: newRegion };
      return next;
    });
    setDirty((prev) => new Set(prev).add(idx));
  }, [setEntities]);

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
    entities.forEach((e) => { byTier[e.tier ?? 4] = (byTier[e.tier ?? 4] || 0) + 1; });
    return byTier;
  }, [entities]);

  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    entities.forEach((e) => { map[e.region ?? "unknown"] = (map[e.region ?? "unknown"] || 0) + 1; });
    return map;
  }, [entities]);

  const flagCount = flagged.size;
  const commentCount = Object.keys(comments).length;

  return (
    <div>
      {/* 통계 바 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map((t) => (
          <div
            key={t}
            onClick={() => setFilterTier(filterTier === String(t) ? "all" : String(t))}
            style={{
              padding: "6px 16px", borderRadius: 6,
              background: filterTier === String(t) ? TIER_COLORS[t] : "#222",
              border: `2px solid ${TIER_COLORS[t]}`,
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Tier {t}: {stats[t] ?? 0}개
          </div>
        ))}
        <div
          onClick={() => setFilterTier("all")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterTier === "all" ? "#444" : "#222",
            border: "2px solid #555", cursor: "pointer",
          }}
        >
          전체
        </div>
        <div
          onClick={() => setFilterFlag(filterFlag === "flagged" ? "all" : "flagged")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterFlag === "flagged" ? "#a855f7" : "#222",
            border: "2px solid #a855f7", cursor: "pointer", fontWeight: 600,
          }}
        >
          체크됨: {flagCount}개
        </div>
        <div
          onClick={() => setFilterFlag(filterFlag === "commented" ? "all" : "commented")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterFlag === "commented" ? "#ec4899" : "#222",
            border: "2px solid #ec4899", cursor: "pointer", fontWeight: 600,
          }}
        >
          코멘트: {commentCount}개
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4 }}
        >
          <option value="all">모든 권역</option>
          {ALL_REGIONS.map((r) => (
            <option key={r} value={r}>{REGION_KO[r]} ({regionStats[r] ?? 0})</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="검색 (한글/영문/QID)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4, width: 250 }}
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4 }}
        >
          <option value="score">스코어순</option>
          <option value="sitelinks">Sitelinks순</option>
          <option value="tier">Tier순</option>
          <option value="name_ko">한국어명순</option>
          <option value="name_en">영문명순</option>
        </select>

        <button
          onClick={() => setSortDesc(!sortDesc)}
          style={{ padding: "6px 12px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 4, cursor: "pointer" }}
        >
          {sortDesc ? "▼ 내림" : "▲ 오름"}
        </button>

        <span style={{ color: "#888" }}>{filtered.length}개 표시</span>

        <button
          onClick={saveCommentsToServer}
          disabled={commentSaving || (flagCount === 0 && commentCount === 0)}
          style={{
            padding: "6px 16px",
            background: (flagCount > 0 || commentCount > 0) ? "#a855f7" : "#333",
            color: "#fff", border: "none", borderRadius: 6,
            cursor: (flagCount > 0 || commentCount > 0) ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          {commentSaving ? "저장 중..." : `코멘트 저장 (${commentCount}개)`}
        </button>
        {commentSaveMsg && <span style={{ color: "#a855f7", fontWeight: 600 }}>{commentSaveMsg}</span>}

        <button
          onClick={save}
          disabled={dirty.size === 0 || saving}
          style={{
            marginLeft: "auto", padding: "8px 24px",
            background: dirty.size > 0 ? "#22c55e" : "#333",
            color: "#fff", border: "none", borderRadius: 6,
            cursor: dirty.size > 0 ? "pointer" : "default",
            fontWeight: 700, fontSize: 15,
          }}
        >
          {saving ? "저장 중..." : `Tier 저장 (${dirty.size}개 변경)`}
        </button>
        {saveMsg && <span style={{ color: "#22c55e", fontWeight: 600 }}>{saveMsg}</span>}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                    background: isFlagged ? "#2a1a2a" : isDirty ? "#1a2a1a" : i % 2 === 0 ? "#161616" : "#111",
                  }}
                >
                  <td style={{ padding: "4px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isFlagged}
                      onChange={() => toggleFlag(e._idx)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#a855f7" }}
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
                            width: 26, height: 24, border: "none", borderRadius: 3,
                            cursor: "pointer", fontWeight: 700, fontSize: 11,
                            background: e.tier === t ? TIER_COLORS[t] : "#2a2a2a",
                            color: e.tier === t ? "#fff" : "#555",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "4px", color: "#888", fontSize: 11 }}>{e.score?.toFixed(1) ?? "—"}</td>
                  <td style={{ padding: "4px", color: "#aaa", fontSize: 12 }}>{e.sitelinks ?? 0}</td>
                  <td style={{ padding: "4px", fontWeight: e.name_ko ? 600 : 400, color: e.name_ko ? "#fff" : "#555" }}>
                    {e.name_ko || "—"}
                  </td>
                  <td style={{ padding: "4px" }}>{e.name_en}</td>
                  <td style={{ padding: "4px", color: "#888", fontSize: 11 }}>
                    {e.start ?? "?"} ~ {e.end ?? "?"}
                  </td>
                  <td style={{ padding: "4px" }}>
                    <select
                      value={e.region ?? "unknown"}
                      onChange={(ev) => changeRegion(e._idx, ev.target.value)}
                      style={{
                        padding: "2px 4px", background: "#222", color: "#ccc",
                        border: "1px solid #444", borderRadius: 3, fontSize: 11, width: "100%",
                      }}
                    >
                      {ALL_REGIONS.map((r) => (
                        <option key={r} value={r}>{REGION_KO[r]}</option>
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
                            if (ev.key === "Escape") { setEditingComment(null); setCommentDraft(""); }
                          }}
                          autoFocus
                          placeholder="코멘트 입력 (Enter 저장)"
                          style={{
                            flex: 1, padding: "3px 6px", background: "#1a1a2a", color: "#fff",
                            border: "1px solid #a855f7", borderRadius: 3, fontSize: 12,
                          }}
                        />
                        <button
                          onClick={() => saveComment(e._idx)}
                          style={{
                            padding: "3px 8px", background: "#a855f7", color: "#fff",
                            border: "none", borderRadius: 3, cursor: "pointer", fontSize: 11,
                          }}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditingComment(e._idx); setCommentDraft(comments[e._idx] || ""); }}
                        style={{
                          padding: "3px 6px", minHeight: 24, cursor: "text", borderRadius: 3, fontSize: 12,
                          background: hasComment ? "#1a1a2a" : "transparent",
                          border: hasComment ? "1px solid #a855f766" : "1px solid transparent",
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
      <div style={{ padding: 40, color: "#fff", background: "#111", minHeight: "100vh" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 30px",
        color: "#e0e0e0",
        background: "#111",
        minHeight: "100vh",
        fontFamily: "'Pretendard', sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>
          Tier Review — {entities.length}개 엔티티
        </h1>
      </div>

      {/* ── 탭 전환 ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("timeline")}
          style={{
            padding: "10px 24px", borderRadius: 8,
            background: activeTab === "timeline" ? "#06b6d4" : "#222",
            color: activeTab === "timeline" ? "#fff" : "#888",
            border: activeTab === "timeline" ? "2px solid #06b6d4" : "2px solid #333",
            cursor: "pointer", fontWeight: 700, fontSize: 14,
          }}
        >
          시기별 보기
        </button>
        <button
          onClick={() => setActiveTab("list")}
          style={{
            padding: "10px 24px", borderRadius: 8,
            background: activeTab === "list" ? "#06b6d4" : "#222",
            color: activeTab === "list" ? "#fff" : "#888",
            border: activeTab === "list" ? "2px solid #06b6d4" : "2px solid #333",
            cursor: "pointer", fontWeight: 700, fontSize: 14,
          }}
        >
          전체 리스트
        </button>
      </div>

      {/* ── 탭 컨텐츠 ── */}
      {activeTab === "timeline" && <TimelineView />}
      {activeTab === "list" && <ListView entities={entities} setEntities={setEntities} />}
    </div>
  );
}
