'use client';
// [mk] dump-review — Wikidata 덤프 파싱 데이터 큐레이션 관리 UI
// 4개 타입(hist_entity / event / place / person) 검토 + include/exclude/skip 결정

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── 타입 ───────────────────────────────────────────────────────────────────

type EntityType = 'hist_entity' | 'event' | 'place' | 'person' | 'artwork' | 'invention';
type Decision   = 'include' | 'exclude' | 'skip' | null;
type StatusFilter = 'all' | 'pending' | 'include' | 'exclude' | 'skip';

interface ParsedItem {
  qid: string;
  name_ko?: string;
  name_en?: string;
  desc_ko?: string;
  desc_en?: string;
  sitelinks?: number;
  // hist_entity
  start_year?: number;
  end_year?: number;
  entity_kind?: string;
  direct_coord?: [number, number] | null;
  capital_qid?: string;
  // event
  anchor_year?: number;
  event_kind?: string;
  location_qid?: string;
  // place
  inception?: number;
  country_qid?: string;
  // person
  birth_year?: number;
  death_year?: number;
  occupation_qid?: string;
  // artwork [mk]
  artwork_kind?: string;
  creator_qid?: string;
  genre_qid?: string;
  movement_qid?: string;
  // invention [mk]
  inventor_qid?: string;
  // injected by API
  _decision: Decision;
}

interface TypeStats {
  total: number;
  include: number;
  exclude: number;
  skip: number;
  pending: number;
}

interface StatsData {
  hist_entity: TypeStats;
  event:       TypeStats;
  place:       TypeStats;
  person:      TypeStats;
  artwork:     TypeStats;
  invention:   TypeStats;
}

interface Filters {
  search: string;
  sitelinkMin: number;
  yearFrom: string;
  yearTo: string;
  status: StatusFilter;
}

const TYPE_LABELS: Record<EntityType, string> = {
  hist_entity: '🏛️ 역사 국가/정권',
  event:       '⚔️ 사건/전쟁',
  place:       '📍 장소/도시',
  person:      '👤 인물',
  artwork:     '🎨 문화/예술',
  invention:   '⚙️ 발명/기술',
};

const TYPE_KEYS: EntityType[] = ['hist_entity', 'event', 'place', 'person', 'artwork', 'invention'];

const DECISION_META = {
  include: { label: '포함', color: 'bg-emerald-500 hover:bg-emerald-600', textColor: 'text-emerald-400', icon: '✅', key: 'KeyD' },
  exclude: { label: '제외', color: 'bg-red-500 hover:bg-red-600',     textColor: 'text-red-400',     icon: '❌', key: 'KeyA' },
  skip:    { label: '건너뜀', color: 'bg-zinc-600 hover:bg-zinc-500', textColor: 'text-zinc-400',    icon: '⏭️', key: 'KeyS' },
} as const;

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export default function DumpReviewPage() {
  const [activeType,  setActiveType]  = useState<EntityType>('hist_entity');
  const [items,       setItems]       = useState<ParsedItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [stats,       setStats]       = useState<StatsData | null>(null);
  const [selectedQid, setSelectedQid] = useState<string | null>(null);
  const [focusedIdx,  setFocusedIdx]  = useState<number>(0);
  const [filters, setFilters] = useState<Filters>({
    search: '', sitelinkMin: 0, yearFrom: '', yearTo: '', status: 'all',
  });
  // 로컬 decisions 캐시 (즉시 UI 반영용)
  const decCache = useRef<Record<EntityType, Record<string, Decision>>>({
    hist_entity: {}, event: {}, place: {}, person: {},
  });

  const LIMIT = 50;

  // ── 데이터 로드 ──
  const fetchItems = useCallback(async (type: EntityType, off: number, f: Filters) => {
    setLoading(true);
    const params = new URLSearchParams({
      type,
      offset:       String(off),
      limit:        String(LIMIT),
      search:       f.search,
      sitelinks_min: String(f.sitelinkMin),
      status:       f.status,
    });
    if (f.yearFrom) params.set('year_from', f.yearFrom);
    if (f.yearTo)   params.set('year_to',   f.yearTo);

    try {
      const res = await fetch(`/api/dump-curation?${params}`);
      const data = await res.json();
      // 로컬 캐시 적용 (서버보다 최신)
      const merged = (data.items as ParsedItem[]).map((item: ParsedItem) => ({
        ...item,
        _decision: decCache.current[type][item.qid] ?? item._decision,
      }));
      setItems(merged);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/dump-curation?stats=1');
    setStats(await res.json());
  }, []);

  // ── 초기 + 탭/필터 변경 시 로드 ──
  useEffect(() => {
    setItems([]);       // 탭 전환 시 이전 데이터 즉시 클리어
    setTotal(0);
    setOffset(0);
    setFocusedIdx(0);
    setSelectedQid(null);
    fetchItems(activeType, 0, filters);
  }, [activeType, filters, fetchItems]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── 결정 저장 ──
  const saveDecision = useCallback(async (qid: string, type: EntityType, decision: Decision) => {
    if (!decision) return;
    // 로컬 캐시 업데이트
    decCache.current[type][qid] = decision;
    // UI 즉시 반영
    setItems(prev => prev.map(it => it.qid === qid ? { ...it, _decision: decision } : it));
    // API POST
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
      if (it._decision === 'include') return false; // 이미 포함 결정은 건드리지 않음
      if (reason === 'low_sitelinks') return (it.sitelinks ?? 0) < 10;
      if (reason === 'no_coord')      return !it.direct_coord && !it.birth_year;
      return false;
    });
    if (targets.length === 0) return;
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    const params = new URLSearchParams({
      type:         activeType,
      offset:       String(newOffset),
      limit:        String(LIMIT),
      search:       filters.search,
      sitelinks_min: String(filters.sitelinkMin),
      status:       filters.status,
    });
    if (filters.yearFrom) params.set('year_from', filters.yearFrom);
    if (filters.yearTo)   params.set('year_to',   filters.yearTo);
    const res = await fetch(`/api/dump-curation?${params}`);
    const data = await res.json();
    const merged = (data.items as ParsedItem[]).map((item: ParsedItem) => ({
      ...item,
      _decision: decCache.current[activeType][item.qid] ?? item._decision,
    }));
    setItems(prev => [...prev, ...merged]);
  };

  // ── 선택된 아이템 ──
  const selectedItem = items.find(it => it.qid === selectedQid) ?? null;

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── 헤더 ── */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-white">📦 Wikidata 덤프 큐레이션</h1>
        <span className="text-xs text-zinc-500">파싱 데이터 검토 · include / exclude / skip</span>
        <div className="ml-auto text-xs text-zinc-500">
          키보드: <kbd className="bg-zinc-800 px-1 rounded">D</kbd>포함&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">A</kbd>제외&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">S</kbd>건너뜀&nbsp;
          <kbd className="bg-zinc-800 px-1 rounded">↑↓</kbd>이동
        </div>
      </header>

      {/* ── 탭 + 통계바 ── */}
      <div className="border-b border-zinc-800 px-2 flex items-center gap-0 flex-shrink-0 overflow-x-auto scrollbar-none">
        {TYPE_KEYS.map(type => {
          const s = stats?.[type];
          const pct = s && s.total > 0 ? Math.round(((s.include + s.exclude + s.skip) / s.total) * 100) : 0;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeType === type
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {TYPE_LABELS[type]}
              {s && (
                <span className="ml-2 text-xs text-zinc-500">
                  {s.total.toLocaleString()}건
                  <span className="ml-1 text-zinc-600">({pct}%완료)</span>
                </span>
              )}
            </button>
          );
        })}

        {/* 통계 요약 */}
        {stats && (
          <div className="ml-auto flex items-center gap-3 text-xs pl-4">
            {(['include','exclude','skip','pending'] as const).map(k => {
              const s = stats[activeType];
              const v = s[k];
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
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">🔍 검색</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="이름, QID..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

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
              좌표/연도 없는 것 제외
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
                  type={activeType}
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
                      더 보기 ({total - items.length}건 남음)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── 우측 상세 패널 ── */}
        {selectedItem && (
          <aside className="w-72 border-l border-zinc-800 overflow-y-auto flex-shrink-0">
            <DetailPanel item={selectedItem} type={activeType} onDecide={(dec) => saveDecision(selectedItem.qid, activeType, dec)} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── ItemCard ────────────────────────────────────────────────────────────────

function ItemCard({
  item, type, isFocused, isSelected, onClick, onDecide,
}: {
  item: ParsedItem;
  type: EntityType;
  isFocused: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDecide: (d: Decision) => void;
}) {
  const dec = item._decision;
  const decBg = dec === 'include' ? 'border-l-emerald-500' : dec === 'exclude' ? 'border-l-red-500' : dec === 'skip' ? 'border-l-zinc-600' : 'border-l-transparent';

  const yearStr = (() => {
    const fmtY = (y: number) => y < 0 ? `BC${Math.abs(y)}` : String(y);
    if (type === 'hist_entity') {
      const s = item.start_year != null ? fmtY(item.start_year) : '?';
      const e = item.end_year   != null ? fmtY(item.end_year)   : '현재';
      return `${s} ~ ${e}`;
    }
    if (type === 'event') {
      const a = item.anchor_year;
      return a != null ? fmtY(a) : '?';
    }
    if (type === 'place')     return item.inception != null ? String(item.inception) : '-';
    if (type === 'person') {
      const b = item.birth_year; const d = item.death_year;
      if (b && d) return `${b} ~ ${d}`;
      if (b)      return `${b} ~`;
      return '-';
    }
    if (type === 'artwork')   return item.inception != null ? fmtY(item.inception) : '-';
    if (type === 'invention') return item.inception != null ? fmtY(item.inception) : '-';
    return '-';
  })();

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
            {item.entity_kind  && <span className="text-xs text-zinc-600 bg-zinc-800 px-1 rounded">{item.entity_kind}</span>}
            {item.event_kind   && <span className="text-xs text-zinc-600 bg-zinc-800 px-1 rounded">{item.event_kind}</span>}
            {item.artwork_kind && <span className="text-xs text-zinc-600 bg-zinc-800 px-1 rounded">{item.artwork_kind}</span>}
            {!item.direct_coord && type !== 'person' && type !== 'event' && (
              <span className="text-xs text-orange-700">좌표없음</span>
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
  type: EntityType;
  onDecide: (d: Decision) => void;
}) {
  const dec = item._decision;
  const wikiUrl = `https://www.wikidata.org/wiki/${item.qid}`;
  const koWikiUrl = item.name_ko ? `https://ko.wikipedia.org/wiki/${encodeURIComponent(item.name_ko)}` : null;

  const fields: Array<[string, string | number | null | undefined]> = [
    ['QID', item.qid],
    ['한국어', item.name_ko],
    ['English', item.name_en],
    ['설명', item.desc_ko ?? item.desc_en],
    ['sitelinks', item.sitelinks],
    ...(type === 'hist_entity' ? [
      ['종류', item.entity_kind],
      ['시작', item.start_year],
      ['종료', item.end_year ?? '현재'],
      ['좌표', item.direct_coord ? `${item.direct_coord[0]}, ${item.direct_coord[1]}` : '없음'],
    ] as Array<[string, string | number | null | undefined]> : []),
    ...(type === 'event' ? [
      ['종류', item.event_kind],
      ['기준연도', item.anchor_year],
      ['위치QID', item.location_qid],
    ] as Array<[string, string | number | null | undefined]> : []),
    ...(type === 'place' ? [
      ['창설', item.inception],
      ['나라QID', item.country_qid],
      ['좌표', item.direct_coord ? `${item.direct_coord[0]}, ${item.direct_coord[1]}` : '없음'],
    ] as Array<[string, string | number | null | undefined]> : []),
    ...(type === 'person' ? [
      ['출생', item.birth_year],
      ['사망', item.death_year ?? '생존'],
      ['직업QID', item.occupation_qid],
    ] as Array<[string, string | number | null | undefined]> : []),
    ...(type === 'artwork' ? [
      ['종류', item.artwork_kind],
      ['제작연도', item.inception],
      ['제작자QID', item.creator_qid],
      ['장르QID', item.genre_qid],
      ['사조QID', item.movement_qid],
      ['좌표', item.direct_coord ? `${item.direct_coord[0]}, ${item.direct_coord[1]}` : '없음'],
    ] as Array<[string, string | number | null | undefined]> : []),
    ...(type === 'invention' ? [
      ['발명연도', item.inception],
      ['발명가QID', item.inventor_qid],
      ['좌표', item.direct_coord ? `${item.direct_coord[0]}, ${item.direct_coord[1]}` : '없음'],
    ] as Array<[string, string | number | null | undefined]> : []),
  ];

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
