'use client';
// [cl] dump-review — 큐레이션된 12개 카테고리 + unmatched 데이터 큐레이션 관리 UI
// include / exclude / skip 결정 + SL순·연도순 정렬 + 지역 필터

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── 타입 ───────────────────────────────────────────────────────────────────

type CategoryType =
  | 'nation' | 'event' | 'person' | 'place' | 'building' | 'heritage'
  | 'invention' | 'disaster' | 'exploration' | 'battle' | 'pandemic'
  | 'artwork' | 'unmatched';

type Decision     = 'include' | 'exclude' | 'skip' | null;
type StatusFilter = 'all' | 'pending' | 'include' | 'exclude' | 'skip';

interface ParsedItem {
  qid: string;
  name_ko?: string;
  name_en?: string;
  desc_ko?: string;
  desc_en?: string;
  sitelinks?: number;
  p31?: string[];
  coord?: [number, number];
  direct_coord?: [number, number];
  lat?: number;
  lon?: number;
  start_year?: number;
  end_year?: number;
  birth_year?: number;
  death_year?: number;
  anchor_year?: number;
  inception?: number;
  point_in_time?: number;
  _category?: string;
  _decision: Decision;
  [key: string]: any;
}

interface TypeStats {
  total: number;
  include: number;
  exclude: number;
  skip: number;
  pending: number;
}

type StatsData = Record<string, TypeStats>;

interface Filters {
  search: string;
  sitelinkMin: number;
  yearFrom: string;
  yearTo: string;
  status: StatusFilter;
  sort: string;
  order: string;
  region: string;
}

// ─── 상수 ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CategoryType, string> = {
  nation:      '🏛️ 국가',
  event:       '📜 사건',
  person:      '👤 인물',
  place:       '📍 장소',
  building:    '🏗️ 건축',
  heritage:    '🏺 유산',
  invention:   '⚙️ 발명',
  disaster:    '🌊 재해',
  exploration: '🧭 탐험',
  battle:      '⚔️ 전투',
  pandemic:    '🦠 전염병',
  artwork:     '🎨 예술',
  unmatched:   '❓ 미분류',
};

const CATEGORY_KEYS: CategoryType[] = [
  'nation', 'event', 'person', 'place', 'building', 'heritage',
  'invention', 'disaster', 'exploration', 'battle', 'pandemic',
  'artwork', 'unmatched',
];

const DECISION_META = {
  include: { label: '포함', color: 'bg-emerald-500 hover:bg-emerald-600', textColor: 'text-emerald-400', icon: '✅', key: 'KeyD' },
  exclude: { label: '제외', color: 'bg-red-500 hover:bg-red-600',     textColor: 'text-red-400',     icon: '❌', key: 'KeyA' },
  skip:    { label: '건너뜀', color: 'bg-zinc-600 hover:bg-zinc-500', textColor: 'text-zinc-400',    icon: '⏭️', key: 'KeyS' },
} as const;

const SORT_OPTIONS = [
  { value: 'sitelinks', label: '⭐ SL순' },
  { value: 'year',      label: '📅 연도순' },
  { value: 'name_ko',   label: '가 한국어순' },
];

const REGION_OPTIONS = [
  { value: 'all',            label: '🌍 전체' },
  { value: 'east_asia',     label: '🏯 동아시아' },
  { value: 'southeast_asia', label: '🌴 동남아시아' },
  { value: 'south_asia',    label: '🕌 남아시아' },
  { value: 'central_asia',  label: '🐫 중앙아시아' },
  { value: 'middle_east',   label: '☪️ 중동' },
  { value: 'europe',        label: '🏰 유럽' },
  { value: 'north_africa',  label: '🏜️ 북아프리카' },
  { value: 'sub_saharan',   label: '🌍 사하라이남' },
  { value: 'north_america', label: '🗽 북아메리카' },
  { value: 'latin_america', label: '🌎 중남아메리카' },
  { value: 'oceania',       label: '🏝️ 오세아니아' },
  { value: 'unknown',       label: '❓ 좌표미상' },
];

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

function getYearStr(item: ParsedItem): string {
  const fmtY = (y: number) => y < 0 ? `BC${Math.abs(y)}` : String(y);
  if (item.start_year != null) {
    const s = fmtY(item.start_year);
    const e = item.end_year != null ? fmtY(item.end_year) : '현재';
    return `${s}~${e}`;
  }
  if (item.birth_year != null) {
    const b = fmtY(item.birth_year);
    const d = item.death_year != null ? fmtY(item.death_year) : '~';
    return `${b}~${d}`;
  }
  if (item.anchor_year != null) return fmtY(item.anchor_year);
  if (item.inception != null) return fmtY(item.inception);
  if (item.point_in_time != null) return fmtY(item.point_in_time);
  return '-';
}

function hasCoord(item: ParsedItem): boolean {
  return (item.lat != null && item.lon != null) ||
         (Array.isArray(item.coord) && item.coord.length >= 2) ||
         (Array.isArray(item.direct_coord) && item.direct_coord.length >= 2);
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export default function DumpReviewPage() {
  const [activeType,  setActiveType]  = useState<CategoryType>('nation');
  const [items,       setItems]       = useState<ParsedItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [stats,       setStats]       = useState<StatsData | null>(null);
  const [selectedQid, setSelectedQid] = useState<string | null>(null);
  const [focusedIdx,  setFocusedIdx]  = useState<number>(0);
  const [filters, setFilters] = useState<Filters>({
    search: '', sitelinkMin: 0, yearFrom: '', yearTo: '', status: 'all',
    sort: 'sitelinks', order: 'desc', region: 'all',
  });

  // 로컬 decisions 캐시 (즉시 UI 반영용)
  const decCache = useRef<Record<string, Record<string, Decision>>>({});

  const LIMIT = 50;

  // [cl] 공통 URL 파라미터 빌더
  const buildParams = useCallback((type: CategoryType, off: number, f: Filters) => {
    const params = new URLSearchParams({
      type,
      offset:       String(off),
      limit:        String(LIMIT),
      search:       f.search,
      sitelinks_min: String(f.sitelinkMin),
      status:       f.status,
      sort:         f.sort,
      order:        f.order,
      region:       f.region,
    });
    if (f.yearFrom) params.set('year_from', f.yearFrom);
    if (f.yearTo)   params.set('year_to',   f.yearTo);
    return params;
  }, []);

  // ── 데이터 로드 ──
  const fetchItems = useCallback(async (type: CategoryType, off: number, f: Filters) => {
    setLoading(true);
    const params = buildParams(type, off, f);
    try {
      const res = await fetch(`/api/dump-curation?${params}`);
      const data = await res.json();
      if (!decCache.current[type]) decCache.current[type] = {};
      const merged = (data.items as ParsedItem[]).map((item: ParsedItem) => ({
        ...item,
        _decision: decCache.current[type][item.qid] ?? item._decision,
      }));
      setItems(merged);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/dump-curation?stats=1');
    setStats(await res.json());
  }, []);

  // ── 초기 + 탭/필터 변경 시 로드 ──
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setOffset(0);
    setFocusedIdx(0);
    setSelectedQid(null);
    fetchItems(activeType, 0, filters);
  }, [activeType, filters, fetchItems]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── 결정 저장 ──
  const saveDecision = useCallback(async (qid: string, type: CategoryType, decision: Decision) => {
    if (!decision) return;
    if (!decCache.current[type]) decCache.current[type] = {};
    decCache.current[type][qid] = decision;
    setItems(prev => prev.map(it => it.qid === qid ? { ...it, _decision: decision } : it));
    await fetch('/api/dump-curation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: [{ qid, type, decision }] }),
    });
    fetchStats();
  }, [fetchStats]);

  // ── 일괄 처리 ──
  const bulkExclude = async (reason: 'low_sitelinks' | 'no_coord') => {
    const targets = items.filter(it => {
      if (it._decision === 'include') return false;
      if (reason === 'low_sitelinks') return (it.sitelinks ?? 0) < 10;
      if (reason === 'no_coord') return !hasCoord(it);
      return false;
    });
    if (targets.length === 0) return;
    if (!decCache.current[activeType]) decCache.current[activeType] = {};
    const payload = targets.map(it => ({ qid: it.qid, type: activeType, decision: 'exclude' as Decision }));
    for (const p of payload) decCache.current[activeType][p.qid] = 'exclude';
    setItems(prev => prev.map(it =>
      payload.some(p => p.qid === it.qid) ? { ...it, _decision: 'exclude' } : it
    ));
    await fetch('/api/dump-curation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: payload }),
    });
    fetchStats();
  };

  // ── 키보드 단축키 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const focused = items[focusedIdx];
      if (!focused) return;

      if (e.code === 'KeyD') { saveDecision(focused.qid, activeType, 'include'); advanceFocus(); }
      if (e.code === 'KeyA') { saveDecision(focused.qid, activeType, 'exclude'); advanceFocus(); }
      if (e.code === 'KeyS') { saveDecision(focused.qid, activeType, 'skip');    advanceFocus(); }
      if (e.code === 'ArrowDown')  setFocusedIdx(i => Math.min(i + 1, items.length - 1));
      if (e.code === 'ArrowUp')    setFocusedIdx(i => Math.max(i - 1, 0));
      if (e.code === 'Enter')      setSelectedQid(focused.qid === selectedQid ? null : focused.qid);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, focusedIdx, activeType, selectedQid, saveDecision]);

  const advanceFocus = () => setFocusedIdx(i => Math.min(i + 1, items.length - 1));

  // ── 무한 스크롤 ──
  const loadMore = async () => {
    if (loading || offset + LIMIT >= total) return;
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    const params = buildParams(activeType, newOffset, filters);
    const res = await fetch(`/api/dump-curation?${params}`);
    const data = await res.json();
    if (!decCache.current[activeType]) decCache.current[activeType] = {};
    const merged = (data.items as ParsedItem[]).map((item: ParsedItem) => ({
      ...item,
      _decision: decCache.current[activeType][item.qid] ?? item._decision,
    }));
    setItems(prev => [...prev, ...merged]);
  };

  const selectedItem = items.find(it => it.qid === selectedQid) ?? null;

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── 헤더 ── */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-white">📦 Wikidata 덤프 큐레이션</h1>
        <span className="text-xs text-zinc-500">큐레이션된 12개 카테고리 · include / exclude / skip</span>
        <div className="ml-auto text-xs text-zinc-500">
          키보드: <kbd className="bg-zinc-800 px-1 rounded">D</kbd>포함&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">A</kbd>제외&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">S</kbd>건너뜀&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">↑↓</kbd>이동
        </div>
      </header>

      {/* ── 탭 + 통계바 ── */}
      <div className="border-b border-zinc-800 px-1 flex items-center gap-0 flex-shrink-0 overflow-x-auto scrollbar-none">
        {CATEGORY_KEYS.map(type => {
          const s = stats?.[type];
          const pct = s && s.total > 0 ? Math.round(((s.include + s.exclude + s.skip) / s.total) * 100) : 0;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-2 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeType === type
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {TYPE_LABELS[type]}
              {s && (
                <span className="ml-1 text-zinc-600">
                  {s.total >= 1000 ? `${(s.total / 1000).toFixed(0)}k` : s.total}
                  {pct > 0 && <span className="ml-0.5 text-zinc-700">({pct}%)</span>}
                </span>
              )}
            </button>
          );
        })}

        {/* 통계 요약 */}
        {stats && stats[activeType] && (
          <div className="ml-auto flex items-center gap-3 text-xs pl-4 pr-2">
            {(['include','exclude','skip','pending'] as const).map(k => {
              const s = stats[activeType];
              const v = s?.[k] ?? 0;
              const colors = { include:'text-emerald-400', exclude:'text-red-400', skip:'text-zinc-400', pending:'text-yellow-400' };
              const labels = { include:'포함', exclude:'제외', skip:'건너뜀', pending:'미결정' };
              return (
                <span key={k} className={colors[k]}>
                  {labels[k]} <strong>{v.toLocaleString()}</strong>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 메인 바디 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌측 필터 패널 ── */}
        <aside className="w-56 border-r border-zinc-800 p-3 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">

          {/* [cl] 정렬 */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">📊 정렬</label>
            <div className="flex gap-1">
              <select
                value={filters.sort}
                onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setFilters(f => ({ ...f, order: f.order === 'desc' ? 'asc' : 'desc' }))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm hover:bg-zinc-700 transition-colors"
                title={filters.order === 'desc' ? '내림차순' : '오름차순'}
              >
                {filters.order === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          {/* [cl] 지역 필터 */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">🌏 지역</label>
            <select
              value={filters.region}
              onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              {REGION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 검색 */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">🔍 검색</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="이름, QID, 설명..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* sitelinks */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              ⭐ sitelinks 최소: <strong className="text-zinc-300">{filters.sitelinkMin}</strong>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={filters.sitelinkMin}
              onChange={e => setFilters(f => ({ ...f, sitelinkMin: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-zinc-600"><span>0</span><span>50</span><span>100</span></div>
          </div>

          {/* 연도 범위 */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">📅 연도 범위</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={filters.yearFrom}
                onChange={e => setFilters(f => ({ ...f, yearFrom: e.target.value }))}
                placeholder="From"
                className="w-1/2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={filters.yearTo}
                onChange={e => setFilters(f => ({ ...f, yearTo: e.target.value }))}
                placeholder="To"
                className="w-1/2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 결정 상태 */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">🔘 결정 상태</label>
            <div className="flex flex-col gap-1">
              {(['all','pending','include','exclude','skip'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setFilters(f => ({ ...f, status: s }))}
                  className={`text-left text-xs px-2 py-1 rounded transition-colors ${
                    filters.status === s
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {{ all:'전체', pending:'미결정', include:'포함', exclude:'제외', skip:'건너뜀' }[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 일괄 처리 */}
          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500 mb-2">⚡ 일괄 처리</p>
            <button
              onClick={() => bulkExclude('low_sitelinks')}
              className="w-full text-xs bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-800 rounded px-2 py-1.5 mb-1 transition-colors"
            >
              sitelinks &lt; 10 모두 제외
            </button>
            <button
              onClick={() => bulkExclude('no_coord')}
              className="w-full text-xs bg-orange-900/40 hover:bg-orange-900/70 text-orange-300 border border-orange-800 rounded px-2 py-1.5 transition-colors"
            >
              좌표 없는 것 제외
            </button>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">
              필터 결과: <strong className="text-zinc-300">{total.toLocaleString()}</strong>건
            </p>
          </div>
        </aside>

        {/* ── 카드 목록 ── */}
        <main className="flex-1 overflow-y-auto" onScroll={e => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) loadMore();
        }}>
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-zinc-500">
              해당하는 항목이 없어요
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {items.map((item, idx) => (
                <ItemCard
                  key={item.qid}
                  item={item}
                  isFocused={idx === focusedIdx}
                  isSelected={item.qid === selectedQid}
                  onClick={() => {
                    setFocusedIdx(idx);
                    setSelectedQid(prev => prev === item.qid ? null : item.qid);
                  }}
                  onDecide={(dec) => saveDecision(item.qid, activeType, dec)}
                />
              ))}
              {offset + LIMIT < total && (
                <div className="py-4 text-center text-zinc-500 text-sm">
                  {loading ? '불러오는 중...' : (
                    <button onClick={loadMore} className="hover:text-zinc-300 transition-colors">
                      더 보기 ({(total - items.length).toLocaleString()}건 남음)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── 우측 상세 패널 ── */}
        {selectedItem && (
          <aside className="w-80 border-l border-zinc-800 overflow-y-auto flex-shrink-0">
            <DetailPanel item={selectedItem} type={activeType} onDecide={(dec) => saveDecision(selectedItem.qid, activeType, dec)} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── ItemCard ────────────────────────────────────────────────────────────────

function ItemCard({
  item, isFocused, isSelected, onClick, onDecide,
}: {
  item: ParsedItem;
  isFocused: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDecide: (d: Decision) => void;
}) {
  const dec = item._decision;
  const decBg = dec === 'include' ? 'border-l-emerald-500' : dec === 'exclude' ? 'border-l-red-500' : dec === 'skip' ? 'border-l-zinc-600' : 'border-l-transparent';
  const yearStr = getYearStr(item);
  const coordOk = hasCoord(item);

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer border-l-2 transition-colors ${decBg} ${
        isSelected ? 'bg-zinc-800' : isFocused ? 'bg-zinc-900/60' : 'hover:bg-zinc-900/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-zinc-100 truncate">
              {item.name_ko || item.name_en || item.qid}
            </span>
            {item.name_ko && item.name_en && (
              <span className="text-xs text-zinc-500 truncate">{item.name_en}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-zinc-500">{yearStr}</span>
            {item.sitelinks != null && (
              <span className={`text-xs ${item.sitelinks >= 50 ? 'text-yellow-400' : item.sitelinks >= 20 ? 'text-blue-400' : 'text-zinc-500'}`}>
                ⭐{item.sitelinks}
              </span>
            )}
            {!coordOk && (
              <span className="text-xs text-orange-700">좌표없음</span>
            )}
            {item.p31 && item.p31.length > 0 && (
              <span className="text-xs text-zinc-600 bg-zinc-800 px-1 rounded truncate max-w-[100px]">
                {item.p31[0]}
              </span>
            )}
          </div>
          {item.desc_ko && (
            <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{item.desc_ko}</p>
          )}
        </div>

        {/* 결정 버튼 */}
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {(['include','exclude','skip'] as const).map(d => (
            <button
              key={d}
              onClick={() => onDecide(d)}
              title={DECISION_META[d].label}
              className={`w-7 h-7 rounded text-xs transition-all ${
                dec === d
                  ? DECISION_META[d].color + ' text-white scale-110'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
            >
              {DECISION_META[d].icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DetailPanel ─────────────────────────────────────────────────────────────

function DetailPanel({ item, type, onDecide }: {
  item: ParsedItem;
  type: CategoryType;
  onDecide: (d: Decision) => void;
}) {
  const dec = item._decision;
  const wikiUrl = `https://www.wikidata.org/wiki/${item.qid}`;
  const koWikiUrl = item.name_ko ? `https://ko.wikipedia.org/wiki/${encodeURIComponent(item.name_ko)}` : null;

  // [cl] 좌표 문자열
  const coordStr = (() => {
    if (item.lat != null && item.lon != null) return `${item.lat}, ${item.lon}`;
    if (Array.isArray(item.coord) && item.coord.length >= 2) return `${item.coord[0]}, ${item.coord[1]}`;
    if (Array.isArray(item.direct_coord) && item.direct_coord.length >= 2) return `${item.direct_coord[0]}, ${item.direct_coord[1]}`;
    return '없음';
  })();

  const fields: Array<[string, string | number | null | undefined]> = [
    ['QID', item.qid],
    ['한국어', item.name_ko],
    ['English', item.name_en],
    ['설명(ko)', item.desc_ko],
    ['설명(en)', item.desc_en],
    ['sitelinks', item.sitelinks],
    ['좌표', coordStr],
    ['카테고리', item._category],
  ];

  // 연도 필드 (있는 것만)
  if (item.start_year != null) fields.push(['시작연도', item.start_year]);
  if (item.end_year != null) fields.push(['종료연도', item.end_year]);
  if (item.birth_year != null) fields.push(['출생', item.birth_year]);
  if (item.death_year != null) fields.push(['사망', item.death_year]);
  if (item.anchor_year != null) fields.push(['기준연도', item.anchor_year]);
  if (item.inception != null) fields.push(['설립', item.inception]);
  if (item.point_in_time != null) fields.push(['시점', item.point_in_time]);

  // P31 값
  if (item.p31 && item.p31.length > 0) {
    fields.push(['P31', item.p31.join(', ')]);
  }

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-zinc-100 mb-1">
        {item.name_ko || item.name_en || item.qid}
      </h2>
      {item.name_en && item.name_ko && (
        <p className="text-xs text-zinc-500 mb-3">{item.name_en}</p>
      )}

      {/* 결정 버튼 */}
      <div className="flex gap-2 mb-4">
        {(['include','exclude','skip'] as const).map(d => (
          <button
            key={d}
            onClick={() => onDecide(d)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              dec === d
                ? DECISION_META[d].color + ' text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            {DECISION_META[d].icon} {DECISION_META[d].label}
          </button>
        ))}
      </div>

      {/* 필드 목록 */}
      <div className="space-y-1.5">
        {fields.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="text-xs text-zinc-500 w-16 flex-shrink-0">{label}</span>
            <span className="text-xs text-zinc-300 break-all">{String(value)}</span>
          </div>
        ))}
      </div>

      {/* 링크 */}
      <div className="mt-4 flex flex-col gap-1">
        <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          → Wikidata {item.qid}
        </a>
        {koWikiUrl && (
          <a href={koWikiUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            → 한국어 위키백과
          </a>
        )}
      </div>
    </div>
  );
}
