"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

type CardItem = {
  id: string;
  title: { ko?: string; en?: string };
  start_year: number;
  end_year?: number | null;
  category: string;
  location_lat: number;
  location_lng: number;
  historical_region?: { ko?: string; en?: string };
  modern_country?: { ko?: string; en?: string };
  summary?: { ko?: string; en?: string };
  description?: { ko?: string; en?: string };
  image_url?: string;
  external_link?: string;
  era_id?: string;
  [key: string]: unknown;
};

const CATEGORIES = [
  "persons",
  "events",
  "artworks",
  "places",
  "films",
  "inventions",
  "nations",
  "items",
] as const;

const REGIONS = [
  "전체",
  "유럽",
  "북미",
  "동아시아",
  "한국",
  "일본",
  "중동",
  "남아시아",
  "동남아시아",
  "중남미",
  "아프리카",
  "중앙아시아",
  "오세아니아",
];

const ERAS = [
  { label: "전체", min: -Infinity, max: Infinity },
  { label: "선사 (~-3000)", min: -Infinity, max: -3000 },
  { label: "고대 (-3000~-500)", min: -3000, max: -500 },
  { label: "고전 (-500~500)", min: -500, max: 500 },
  { label: "중세 (500~1500)", min: 500, max: 1500 },
  { label: "근세 (1500~1800)", min: 1500, max: 1800 },
  { label: "근대 (1800~1945)", min: 1800, max: 1945 },
  { label: "현대 (1945~)", min: 1945, max: Infinity },
];

type SortKey = "year_asc" | "year_desc" | "title_asc" | "title_desc" | "region" | "category";

const PAGE_SIZE = 100;

function titleText(t: CardItem["title"]) {
  return t?.ko || t?.en || "(no title)";
}

function regionText(r: CardItem["historical_region"]) {
  return r?.ko || r?.en || "-";
}

export default function DataReviewPage() {
  const [datasetKey, setDatasetKey] = useState<(typeof CATEGORIES)[number]>("events");
  const [allData, setAllData] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionFilter, setRegionFilter] = useState("전체");
  const [eraIdx, setEraIdx] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [searchText, setSearchText] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all" | "new" | "old">("all");
  const [sortKey, setSortKey] = useState<SortKey>("year_asc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadDataset = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/data/${key}_cards.json`);
      const json = await res.json();
      setAllData(json);
      setPage(0);
      setSelectedId(null);
    } catch {
      setAllData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataset(datasetKey);
  }, [datasetKey, loadDataset]);

  // 카테고리(주제) 목록 추출
  const subCategories = useMemo(() => {
    const cats = new Set<string>();
    allData.forEach((d) => d.category && cats.add(d.category));
    return ["전체", ...Array.from(cats).sort()];
  }, [allData]);

  // 필터링
  const filtered = useMemo(() => {
    let result = allData;

    if (regionFilter !== "전체") {
      result = result.filter((d) => regionText(d.historical_region) === regionFilter);
    }

    const era = ERAS[eraIdx];
    if (era.label !== "전체") {
      result = result.filter(
        (d) => d.start_year >= era.min && d.start_year < era.max
      );
    }

    if (categoryFilter !== "전체") {
      result = result.filter((d) => d.category === categoryFilter);
    }

    if (qualityFilter !== "all") {
      result = result.filter((d) => {
        const same = d.summary?.ko && d.description?.ko && d.summary.ko === d.description.ko;
        return qualityFilter === "new" ? !same : same;
      });
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (d) =>
          titleText(d.title).toLowerCase().includes(q) ||
          (d.title?.en || "").toLowerCase().includes(q) ||
          (d.summary?.ko || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [allData, regionFilter, eraIdx, categoryFilter, qualityFilter, searchText]);

  // 정렬
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "year_asc":
        arr.sort((a, b) => a.start_year - b.start_year);
        break;
      case "year_desc":
        arr.sort((a, b) => b.start_year - a.start_year);
        break;
      case "title_asc":
        arr.sort((a, b) => titleText(a.title).localeCompare(titleText(b.title)));
        break;
      case "title_desc":
        arr.sort((a, b) => titleText(b.title).localeCompare(titleText(a.title)));
        break;
      case "region":
        arr.sort((a, b) => regionText(a.historical_region).localeCompare(regionText(b.historical_region)));
        break;
      case "category":
        arr.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
        break;
    }
    return arr;
  }, [filtered, sortKey]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = selectedId ? allData.find((d) => d.id === selectedId) : null;

  // 지역별 통계
  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    allData.forEach((d) => {
      const r = regionText(d.historical_region);
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [allData]);

  return (
    <main className="min-h-screen bg-[#0b0f1a] text-white p-4">
      <div className="mx-auto max-w-[1600px]">
        {/* 헤더 */}
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-bold">TimeGlobe 데이터 리뷰</h1>
          <Link
            href="/"
            className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
          >
            홈
          </Link>
        </div>

        {/* 카테고리 선택 탭 */}
        <div className="mt-3 flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setDatasetKey(cat);
                setRegionFilter("전체");
                setEraIdx(0);
                setCategoryFilter("전체");
                setSearchText("");
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                datasetKey === cat
                  ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 통계 바 */}
        <div className="mt-3 flex gap-3 flex-wrap text-xs">
          <span className="text-white/60">
            전체 <span className="text-cyan-300 font-bold">{allData.length.toLocaleString()}</span>건
          </span>
          <span className="text-white/40">|</span>
          <span className="text-white/60">
            필터 결과 <span className="text-emerald-300 font-bold">{filtered.length.toLocaleString()}</span>건
          </span>
          <span className="text-white/40">|</span>
          {regionStats.slice(0, 6).map(([r, c]) => (
            <span key={r} className="text-white/50">
              {r}:{c}
            </span>
          ))}
        </div>

        {/* 필터 + 검색 */}
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <select
            value={regionFilter}
            onChange={(e) => { setRegionFilter(e.target.value); setPage(0); }}
            className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r} className="bg-gray-900">
                {r}
              </option>
            ))}
          </select>

          <select
            value={eraIdx}
            onChange={(e) => { setEraIdx(Number(e.target.value)); setPage(0); }}
            className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
          >
            {ERAS.map((era, i) => (
              <option key={i} value={i} className="bg-gray-900">
                {era.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
          >
            {subCategories.map((c) => (
              <option key={c} value={c} className="bg-gray-900">
                {c}
              </option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
          >
            <option value="year_asc" className="bg-gray-900">연도 ↑</option>
            <option value="year_desc" className="bg-gray-900">연도 ↓</option>
            <option value="title_asc" className="bg-gray-900">제목 ↑</option>
            <option value="title_desc" className="bg-gray-900">제목 ↓</option>
            <option value="region" className="bg-gray-900">지역순</option>
            <option value="category" className="bg-gray-900">카테고리순</option>
          </select>

          <select
            value={qualityFilter}
            onChange={(e) => { setQualityFilter(e.target.value as "all" | "new" | "old"); setPage(0); }}
            className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
          >
            <option value="all" className="bg-gray-900">전체 데이터</option>
            <option value="new" className="bg-gray-900">신규 (민철)</option>
            <option value="old" className="bg-gray-900">기존 데이터</option>
          </select>

          <input
            type="text"
            placeholder="검색 (제목/요약)"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
            className="rounded bg-white/10 border border-white/20 px-3 py-1.5 text-xs w-48 placeholder:text-white/40"
          />
        </div>

        {loading && <p className="mt-4 text-sm text-white/60">로딩 중...</p>}

        {/* 메인 영역 */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* 테이블 */}
          <div className="rounded border border-white/15 bg-black/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/60">
                    <th className="px-2 py-2 text-left w-12">#</th>
                    <th className="px-2 py-2 text-left">연도</th>
                    <th className="px-2 py-2 text-left min-w-[200px]">제목</th>
                    <th className="px-2 py-2 text-left">카테고리</th>
                    <th className="px-2 py-2 text-left">지역</th>
                    <th className="px-2 py-2 text-left">좌표</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <tr
                      key={`${item.id}_${page * PAGE_SIZE + i}`}
                      onClick={() => setSelectedId(item.id)}
                      className={`border-b border-white/5 cursor-pointer transition hover:bg-white/5 ${
                        selectedId === item.id ? "bg-cyan-500/10" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5 text-white/40">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-2 py-1.5 font-mono">
                        {item.start_year}
                        {item.end_year && item.end_year !== item.start_year ? `~${item.end_year}` : ""}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium truncate max-w-[300px]">{titleText(item.title)}</div>
                        {item.title?.en && (
                          <div className="text-white/40 truncate max-w-[300px]">{item.title.en}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-white/70">{item.category || "-"}</td>
                      <td className="px-2 py-1.5 text-white/70">{regionText(item.historical_region)}</td>
                      <td className="px-2 py-1.5 text-white/40 font-mono text-[10px]">
                        {item.location_lat?.toFixed(1)},{item.location_lng?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 text-xs">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded border border-white/20 px-2 py-1 disabled:opacity-30 hover:bg-white/10"
                >
                  ← 이전
                </button>
                <span className="text-white/60">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded border border-white/20 px-2 py-1 disabled:opacity-30 hover:bg-white/10"
                >
                  다음 →
                </button>
                <span className="text-white/40 ml-2">
                  ({page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, sorted.length)} / {sorted.length})
                </span>
              </div>
            )}
          </div>

          {/* 상세 패널 */}
          <div className="rounded border border-white/15 bg-black/30 p-3 max-h-[80vh] overflow-y-auto sticky top-4">
            {!selected ? (
              <p className="text-sm text-white/50">테이블에서 항목을 클릭하면 상세 정보가 표시됩니다.</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold">{titleText(selected.title)}</h2>
                      {selected.title?.en && (
                        <p className="text-white/50 mt-0.5">{selected.title.en}</p>
                      )}
                      <p className="text-white/40 mt-1 font-mono text-[10px]">ID: {selected.id}</p>
                    </div>
                    <button
                      onClick={() => {
                        const text = `[${datasetKey}] ${titleText(selected.title)} (ID: ${selected.id})`;
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(text);
                        } else {
                          const ta = document.createElement("textarea");
                          ta.value = text;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                        }
                      }}
                      className="shrink-0 rounded border border-white/20 px-2 py-1 text-[10px] text-white/60 hover:bg-white/10 hover:text-white active:bg-cyan-500/20 active:text-cyan-300 transition"
                      title="제목+ID 복사"
                    >
                      복사
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-white/5 px-2 py-1.5">
                    <div className="text-white/40">연도</div>
                    <div>
                      {selected.start_year}
                      {selected.end_year && selected.end_year !== selected.start_year
                        ? ` ~ ${selected.end_year}`
                        : ""}
                    </div>
                  </div>
                  <div className="rounded bg-white/5 px-2 py-1.5">
                    <div className="text-white/40">카테고리</div>
                    <div>{selected.category || "-"}</div>
                  </div>
                  <div className="rounded bg-white/5 px-2 py-1.5">
                    <div className="text-white/40">지역</div>
                    <div>{regionText(selected.historical_region)}</div>
                  </div>
                  <div className="rounded bg-white/5 px-2 py-1.5">
                    <div className="text-white/40">좌표</div>
                    <div className="font-mono">
                      {selected.location_lat?.toFixed(4)}, {selected.location_lng?.toFixed(4)}
                    </div>
                  </div>
                  {selected.era_id && (
                    <div className="rounded bg-white/5 px-2 py-1.5">
                      <div className="text-white/40">시대 ID</div>
                      <div>{selected.era_id}</div>
                    </div>
                  )}
                  {selected.modern_country?.ko && (
                    <div className="rounded bg-white/5 px-2 py-1.5">
                      <div className="text-white/40">국가</div>
                      <div>{selected.modern_country.ko}</div>
                    </div>
                  )}
                </div>

                {selected.summary?.ko && (
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-white/40 mb-1">요약</div>
                    <div className="text-white/90 leading-relaxed">{selected.summary.ko}</div>
                  </div>
                )}

                {selected.description?.ko && (
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-white/40 mb-1">설명</div>
                    <div className="text-white/80 leading-relaxed">{selected.description.ko}</div>
                  </div>
                )}

                {selected.image_url && (
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-white/40 mb-1">이미지</div>
                    <div className="text-cyan-300 break-all">{selected.image_url}</div>
                  </div>
                )}

                <details className="rounded bg-white/5 p-2">
                  <summary className="text-white/40 cursor-pointer hover:text-white/60">
                    Raw JSON
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-[10px] text-white/60">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
