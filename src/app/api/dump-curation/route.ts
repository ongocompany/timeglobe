// [cl] dump-curation API — 큐레이션된 12개 카테고리 + unmatched JSONL 관리
// GET  /api/dump-curation?type=nation&offset=0&limit=50&sort=sitelinks&order=desc&region=all&...
// POST /api/dump-curation  { decisions: [{qid, type, decision}] }
// GET  /api/dump-curation?stats=1  — 카테고리별 통계
// GET  /api/dump-curation?categories=1  — 사용 가능한 카테고리 목록

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAT_DIR = "/mnt/data2/wikidata/output/categories";
const DECISIONS_FILE = path.join(process.cwd(), 'data', 'curation_decisions.json');

// [cl] 12개 큐레이션 카테고리 + unmatched — classifyKorean.py 출력 매핑
const FILE_MAP: Record<string, string> = {
  nation:      `${CAT_DIR}/01_nation.jsonl`,
  event:       `${CAT_DIR}/02_event.jsonl`,
  person:      `${CAT_DIR}/03_person.jsonl`,
  place:       `${CAT_DIR}/04_place.jsonl`,
  building:    `${CAT_DIR}/05_building.jsonl`,
  heritage:    `${CAT_DIR}/06_heritage.jsonl`,
  invention:   `${CAT_DIR}/07_invention.jsonl`,
  disaster:    `${CAT_DIR}/08_disaster.jsonl`,
  exploration: `${CAT_DIR}/09_exploration.jsonl`,
  battle:      `${CAT_DIR}/10_battle.jsonl`,
  pandemic:    `${CAT_DIR}/11_pandemic.jsonl`,
  artwork:     `${CAT_DIR}/12_artwork.jsonl`,
  unmatched:   `${CAT_DIR}/unmatched.jsonl`,
};

const CATEGORY_KEYS = Object.keys(FILE_MAP);
type Decision = 'include' | 'exclude' | 'skip';
type Decisions = Record<string, Record<string, Decision>>;

// [cl] 메모리 캐시 — 대용량 JSONL 반복 로드 방지 (5분 TTL)
const cache: Record<string, any[]> = {};
const cacheTimestamps: Record<string, number> = {};

function loadCategory(category: string): any[] | null {
  const filepath = FILE_MAP[category];
  if (!filepath) return null;
  if (!fs.existsSync(filepath)) return null;

  const now = Date.now();
  const stat = fs.statSync(filepath);

  if (cache[category] && cacheTimestamps[category] &&
      (now - cacheTimestamps[category] < 300_000) &&
      cacheTimestamps[category] > stat.mtimeMs) {
    return cache[category];
  }

  try {
    console.log(`[dump-curation] Loading ${category} (${(stat.size / 1e6).toFixed(0)}MB)...`);
    const raw = fs.readFileSync(filepath, "utf-8");
    const data: any[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { data.push(JSON.parse(trimmed)); } catch { /* skip malformed */ }
    }
    cache[category] = data;
    cacheTimestamps[category] = now;
    console.log(`[dump-curation] ${category}: ${data.length.toLocaleString()} entries`);
    return data;
  } catch (e) {
    console.error(`[dump-curation] Failed to load ${filepath}:`, e);
    return null;
  }
}

// [cl] 좌표 기반 지역 분류 — 11개 권역 (dump-browse와 동일)
function classifyRegion(e: any): string {
  let lat: number | null = null;
  let lon: number | null = null;
  if (e.lat != null && e.lon != null) { lat = Number(e.lat); lon = Number(e.lon); }
  else if (Array.isArray(e.coord) && e.coord.length >= 2) { lat = e.coord[0]; lon = e.coord[1]; }
  else if (Array.isArray(e.direct_coord) && e.direct_coord.length >= 2) { lat = e.direct_coord[0]; lon = e.direct_coord[1]; }
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return "unknown";

  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 40) return "europe";
  if (lat >= 18 && lat <= 55 && lon >= 100 && lon <= 150) return "east_asia";
  if (lat >= -12 && lat < 18 && lon >= 90 && lon <= 150) return "southeast_asia";
  if (lat >= 5 && lat <= 40 && lon >= 60 && lon < 100) return "south_asia";
  if (lat >= 30 && lat <= 55 && lon >= 40 && lon < 100) return "central_asia";
  if (lat >= 12 && lat < 40 && lon >= 25 && lon < 60) return "middle_east";
  if (lat >= 15 && lat < 35 && lon >= -20 && lon < 40) return "north_africa";
  if (lat < 15 && lon >= -20 && lon <= 55) return "sub_saharan";
  if (lat >= 15 && lon >= -170 && lon <= -50) return "north_america";
  if (lat < 15 && lon >= -120 && lon <= -30) return "latin_america";
  if (lat < -10 && lon >= 100) return "oceania";
  return "unknown";
}

function getAnchorYear(item: any): number | null {
  for (const k of ['start_year', 'birth_year', 'anchor_year', 'inception', 'point_in_time']) {
    const v = item[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '') { const n = parseInt(v, 10); if (!isNaN(n)) return n; }
  }
  return null;
}

function loadDecisions(): Decisions {
  try {
    return JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
  } catch {
    const d: Decisions = {};
    for (const k of CATEGORY_KEYS) d[k] = {};
    return d;
  }
}

function saveDecisions(d: Decisions) {
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(d, null, 2), 'utf-8');
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const decisions = loadDecisions();

  // [cl] 카테고리 목록
  if (searchParams.get('categories') === '1') {
    const available = CATEGORY_KEYS.filter(k => fs.existsSync(FILE_MAP[k]));
    return NextResponse.json({ available });
  }

  // [cl] 통계 모드
  if (searchParams.get('stats') === '1') {
    const stats: Record<string, { total: number; include: number; exclude: number; skip: number; pending: number }> = {};
    for (const t of CATEGORY_KEYS) {
      const data = loadCategory(t);
      const total = data ? data.length : 0;
      const dec = decisions[t] ?? {};
      const incl = Object.values(dec).filter(v => v === 'include').length;
      const excl = Object.values(dec).filter(v => v === 'exclude').length;
      const skip = Object.values(dec).filter(v => v === 'skip').length;
      stats[t] = { total, include: incl, exclude: excl, skip, pending: total - incl - excl - skip };
    }
    return NextResponse.json(stats);
  }

  // [cl] 데이터 목록 모드
  const type = searchParams.get('type') ?? 'nation';
  if (!FILE_MAP[type]) {
    return NextResponse.json({ error: `Unknown type: ${type}`, available: CATEGORY_KEYS }, { status: 400 });
  }

  const data = loadCategory(type);
  if (!data) {
    return NextResponse.json({ error: `데이터 로드 실패: ${type}`, path: FILE_MAP[type] }, { status: 404 });
  }

  const offset      = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit       = parseInt(searchParams.get('limit') ?? '50', 10);
  const search      = (searchParams.get('search') ?? '').toLowerCase();
  const sitelinkMin = parseInt(searchParams.get('sitelinks_min') ?? '0', 10);
  const yearFrom    = searchParams.get('year_from') ? parseInt(searchParams.get('year_from')!, 10) : null;
  const yearTo      = searchParams.get('year_to') ? parseInt(searchParams.get('year_to')!, 10) : null;
  const status      = searchParams.get('status') ?? 'all';
  const sort        = searchParams.get('sort') ?? 'sitelinks';
  const order       = searchParams.get('order') ?? 'desc';
  const region      = searchParams.get('region') ?? 'all';

  const typeDec = decisions[type] ?? {};

  // [cl] 필터링
  let filtered = data.filter(item => {
    const qid = item.qid as string;
    const sitelinks = (item.sitelinks as number) ?? 0;
    const nameKo = ((item.name_ko as string) ?? '').toLowerCase();
    const nameEn = ((item.name_en as string) ?? '').toLowerCase();
    const descKo = ((item.desc_ko as string) ?? '').toLowerCase();
    const anchorYear = getAnchorYear(item);
    const dec = typeDec[qid] ?? null;

    if (sitelinks < sitelinkMin) return false;
    if (search && !nameKo.includes(search) && !nameEn.includes(search) && !qid.toLowerCase().includes(search) && !descKo.includes(search)) return false;
    if (yearFrom !== null && anchorYear !== null && anchorYear < yearFrom) return false;
    if (yearTo !== null && anchorYear !== null && anchorYear > yearTo) return false;
    if (region !== 'all' && classifyRegion(item) !== region) return false;
    if (status !== 'all') {
      if (status === 'pending' && dec !== null) return false;
      if (status === 'include' && dec !== 'include') return false;
      if (status === 'exclude' && dec !== 'exclude') return false;
      if (status === 'skip' && dec !== 'skip') return false;
    }
    return true;
  });

  // [cl] 정렬
  filtered.sort((a: any, b: any) => {
    let va: any, vb: any;
    switch (sort) {
      case 'sitelinks': va = a.sitelinks || 0; vb = b.sitelinks || 0; break;
      case 'year': va = getAnchorYear(a) ?? 9999; vb = getAnchorYear(b) ?? 9999; break;
      case 'name_ko': va = a.name_ko || '\uffff'; vb = b.name_ko || '\uffff'; break;
      default: va = a.sitelinks || 0; vb = b.sitelinks || 0;
    }
    if (va < vb) return order === 'desc' ? 1 : -1;
    if (va > vb) return order === 'desc' ? -1 : 1;
    return 0;
  });

  // [cl] 페이지네이션
  const page = filtered.slice(offset, offset + limit).map(item => ({
    ...item,
    _decision: typeDec[(item.qid as string)] ?? null,
  }));

  return NextResponse.json({ type, total: filtered.length, offset, limit, items: page });
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { decisions: Array<{ qid: string; type: string; decision: Decision }> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const decisions = loadDecisions();
  let saved = 0;

  for (const { qid, type, decision } of body.decisions ?? []) {
    if (!qid || !type || !decision) continue;
    if (!decisions[type]) decisions[type] = {};
    decisions[type][qid] = decision;
    saved++;
  }

  saveDecisions(decisions);
  const totalDecisions = Object.values(decisions).reduce((sum, d) => sum + Object.keys(d).length, 0);
  return NextResponse.json({ saved, total_decisions: totalDecisions });
}
