// [mk] dump-curation API
// Wikidata 덤프 파싱 결과 큐레이션 관리 API
// GET  /api/dump-curation?type=hist_entity&offset=0&limit=50&search=&sitelinks_min=0&year_from=&year_to=&status=all
// POST /api/dump-curation  { decisions: [{qid, type, decision}] }
// GET  /api/dump-curation?stats=1  — 타입별 통계

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SAMPLES_DIR = path.join(process.cwd(), 'data', 'dump_samples');
const DECISIONS_FILE = path.join(process.cwd(), 'data', 'curation_decisions.json');

const FILE_MAP: Record<string, string> = {
  hist_entity: 'hist_entities_raw.jsonl',
  event:       'events_raw.jsonl',
  place:       'places_sample.jsonl',
  person:      'persons_sample.jsonl',
};

type Decision = 'include' | 'exclude' | 'skip';

interface Decisions {
  hist_entity: Record<string, Decision>;
  event:       Record<string, Decision>;
  place:       Record<string, Decision>;
  person:      Record<string, Decision>;
}

// --- helpers ---

function loadDecisions(): Decisions {
  try {
    return JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
  } catch {
    return { hist_entity: {}, event: {}, place: {}, person: {} };
  }
}

function saveDecisions(d: Decisions) {
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(d, null, 2), 'utf-8');
}

// JSONL 파일을 라인 단위로 스트리밍 파싱
async function readJsonl(filePath: string): Promise<Record<string, unknown>[]> {
  if (!fs.existsSync(filePath)) return [];
  const results: Record<string, unknown>[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) {
      try { results.push(JSON.parse(trimmed)); } catch { /* skip malformed */ }
    }
  }
  return results;
}

function getAnchorYear(item: Record<string, unknown>): number | null {
  const candidates = ['anchor_year', 'start_year', 'birth_year', 'inception'];
  for (const k of candidates) {
    const v = item[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '') {
      const n = parseInt(v, 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

// --- GET ---

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const isStats = searchParams.get('stats') === '1';
  const type = (searchParams.get('type') ?? 'hist_entity') as keyof Decisions;

  const decisions = loadDecisions();

  // ── 통계 모드 ──
  if (isStats) {
    const stats: Record<string, { total: number; include: number; exclude: number; skip: number; pending: number }> = {};
    for (const t of Object.keys(FILE_MAP) as Array<keyof typeof FILE_MAP>) {
      const fp = path.join(SAMPLES_DIR, FILE_MAP[t]);
      const items = await readJsonl(fp);
      const dec = decisions[t as keyof Decisions] ?? {};
      const include = Object.values(dec).filter(v => v === 'include').length;
      const exclude = Object.values(dec).filter(v => v === 'exclude').length;
      const skip    = Object.values(dec).filter(v => v === 'skip').length;
      stats[t] = { total: items.length, include, exclude, skip, pending: items.length - include - exclude - skip };
    }
    return NextResponse.json(stats);
  }

  // ── 데이터 목록 모드 ──
  const offset      = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit       = parseInt(searchParams.get('limit') ?? '50', 10);
  const search      = (searchParams.get('search') ?? '').toLowerCase();
  const sitelinkMin = parseInt(searchParams.get('sitelinks_min') ?? '0', 10);
  const yearFrom    = searchParams.get('year_from') ? parseInt(searchParams.get('year_from')!, 10) : null;
  const yearTo      = searchParams.get('year_to')   ? parseInt(searchParams.get('year_to')!,   10) : null;
  const status      = searchParams.get('status') ?? 'all'; // all | pending | include | exclude | skip

  if (!FILE_MAP[type]) {
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }

  const fp = path.join(SAMPLES_DIR, FILE_MAP[type]);
  const allItems = await readJsonl(fp);
  const typeDec  = decisions[type] ?? {};

  // 필터
  const filtered = allItems.filter(item => {
    const qid = item.qid as string;
    const sitelinks = (item.sitelinks as number) ?? 0;
    const nameKo = ((item.name_ko as string) ?? '').toLowerCase();
    const nameEn = ((item.name_en as string) ?? '').toLowerCase();
    const anchorYear = getAnchorYear(item);
    const dec = typeDec[qid] ?? null;

    if (sitelinks < sitelinkMin) return false;
    if (search && !nameKo.includes(search) && !nameEn.includes(search) && !qid.toLowerCase().includes(search)) return false;
    if (yearFrom !== null && anchorYear !== null && anchorYear < yearFrom) return false;
    if (yearTo   !== null && anchorYear !== null && anchorYear > yearTo)   return false;
    if (status !== 'all') {
      if (status === 'pending' && dec !== null)      return false;
      if (status === 'include' && dec !== 'include') return false;
      if (status === 'exclude' && dec !== 'exclude') return false;
      if (status === 'skip'    && dec !== 'skip')    return false;
    }
    return true;
  });

  // 페이지네이션
  const page = filtered.slice(offset, offset + limit).map(item => ({
    ...item,
    _decision: typeDec[(item.qid as string)] ?? null,
  }));

  return NextResponse.json({
    type,
    total: filtered.length,
    offset,
    limit,
    items: page,
  });
}

// --- POST ---

export async function POST(req: NextRequest) {
  let body: { decisions: Array<{ qid: string; type: string; decision: Decision }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const decisions = loadDecisions();
  let saved = 0;

  for (const { qid, type, decision } of body.decisions ?? []) {
    if (!qid || !type || !decision) continue;
    if (!(type in decisions)) continue;
    (decisions[type as keyof Decisions])[qid] = decision;
    saved++;
  }

  saveDecisions(decisions);

  const totalDecisions = Object.values(decisions).reduce(
    (sum, d) => sum + Object.keys(d).length, 0
  );

  return NextResponse.json({ saved, total_decisions: totalDecisions });
}
