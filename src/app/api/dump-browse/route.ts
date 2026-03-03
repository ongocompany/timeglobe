// [mk] 덤프 데이터 브라우징 API — 큐레이션된 카테고리별 브라우징
// jinserver의 /mnt/data2/wikidata/output/ 에서 직접 읽음
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

const DUMP_DIR = "/mnt/data2/wikidata/output";
const CAT_DIR = "/mnt/data2/wikidata/output/categories";

// [mk] 카테고리별 파일명 매핑 — curated 12개 + unmatched + 원본
const CATEGORY_FILES: Record<string, { path: string; format: "json" | "jsonl" }> = {
  // 큐레이션된 카테고리 (JSONL)
  curated:     { path: `${DUMP_DIR}/korean_curated.jsonl`, format: "jsonl" },
  nation:      { path: `${CAT_DIR}/01_nation.jsonl`, format: "jsonl" },
  event:       { path: `${CAT_DIR}/02_event.jsonl`, format: "jsonl" },
  person:      { path: `${CAT_DIR}/03_person.jsonl`, format: "jsonl" },
  place:       { path: `${CAT_DIR}/04_place.jsonl`, format: "jsonl" },
  building:    { path: `${CAT_DIR}/05_building.jsonl`, format: "jsonl" },
  heritage:    { path: `${CAT_DIR}/06_heritage.jsonl`, format: "jsonl" },
  invention:   { path: `${CAT_DIR}/07_invention.jsonl`, format: "jsonl" },
  disaster:    { path: `${CAT_DIR}/08_disaster.jsonl`, format: "jsonl" },
  exploration: { path: `${CAT_DIR}/09_exploration.jsonl`, format: "jsonl" },
  battle:      { path: `${CAT_DIR}/10_battle.jsonl`, format: "jsonl" },
  pandemic:    { path: `${CAT_DIR}/11_pandemic.jsonl`, format: "jsonl" },
  artwork:     { path: `${CAT_DIR}/12_artwork.jsonl`, format: "jsonl" },
  unmatched:   { path: `${CAT_DIR}/unmatched.jsonl`, format: "jsonl" },
  // 레거시 (1차 파싱)
  korean:      { path: `${DUMP_DIR}/korean_all.jsonl`, format: "jsonl" },
  events:      { path: `${DUMP_DIR}/events_final.json`, format: "json" },
  hist:        { path: `${DUMP_DIR}/hist_entities_final.json`, format: "json" },
  persons:     { path: `${DUMP_DIR}/persons_browse.json`, format: "json" },
  places:      { path: `${DUMP_DIR}/places_browse.json`, format: "json" },
};

// [mk] 메모리 캐시 — 프로세스 살아있는 동안 유지
const cache: Record<string, any[]> = {};
const statsCache: Record<string, any> = {};
const cacheTimestamps: Record<string, number> = {};

function loadCategory(category: string): any[] | null {
  const catInfo = CATEGORY_FILES[category];
  if (!catInfo) return null;

  const { path: filepath, format } = catInfo;
  if (!fs.existsSync(filepath)) return null;

  const now = Date.now();
  const stat = fs.statSync(filepath);
  const fileModified = stat.mtimeMs;

  // 캐시 유효: 있고, 파일 변경 후 5분 안 지남
  if (cache[category] && cacheTimestamps[category] &&
      (now - cacheTimestamps[category] < 300_000) &&
      cacheTimestamps[category] > fileModified) {
    return cache[category];
  }

  try {
    const sizeMB = (stat.size / 1e6).toFixed(0);
    console.log(`[dump-browse] Loading ${category} (${sizeMB}MB, ${format})...`);

    if (format === "json") {
      const raw = fs.readFileSync(filepath, "utf-8");
      cache[category] = JSON.parse(raw);
    } else {
      // JSONL
      const raw = fs.readFileSync(filepath, "utf-8");
      const lines = raw.split("\n");
      const data: any[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { data.push(JSON.parse(trimmed)); } catch { /* incomplete line skip */ }
      }
      cache[category] = data;
    }

    delete statsCache[category];
    cacheTimestamps[category] = now;
    console.log(`[dump-browse] ${category} loaded: ${cache[category].length.toLocaleString()} entries`);
    return cache[category];
  } catch (e) {
    console.error(`[dump-browse] Failed to load ${filepath}:`, e);
    return null;
  }
}

// [mk] 카테고리별 통계 생성 — 지역 분포 추가
function getStats(category: string, data: any[]): any {
  if (statsCache[category]) return statsCache[category];

  // [mk] JSONL 카테고리인지 판별 (큐레이션 데이터)
  const isJsonl = CATEGORY_FILES[category]?.format === "jsonl";

  const stats: any = {
    total: data.length,
    hasKo: 0,
    hasCoord: 0,
    kinds: {} as Record<string, number>,
    slDistribution: { s0: 0, s1_5: 0, s6_20: 0, s21_50: 0, s51_100: 0, s100plus: 0 },
    // [mk] 지역 분포 — coord 기반 11개 권역
    regions: {} as Record<string, number>,
  };

  for (const e of data) {
    if (e.name_ko) stats.hasKo++;
    if (e.lat != null || (Array.isArray(e.direct_coord) && e.direct_coord.length >= 2) || (Array.isArray(e.coord) && e.coord.length >= 2)) stats.hasCoord++;

    // kind 필드
    let kind: string;
    if (isJsonl || category === "korean") {
      kind = (Array.isArray(e.p31) && e.p31.length > 0) ? e.p31[0] : "unknown";
    } else {
      kind = e.event_kind || e.entity_kind || e.occupation || e.type || "unknown";
    }
    stats.kinds[kind] = (stats.kinds[kind] || 0) + 1;

    // sitelinks 분포
    const sl = e.sitelinks || 0;
    if (sl === 0) stats.slDistribution.s0++;
    else if (sl <= 5) stats.slDistribution.s1_5++;
    else if (sl <= 20) stats.slDistribution.s6_20++;
    else if (sl <= 50) stats.slDistribution.s21_50++;
    else if (sl <= 100) stats.slDistribution.s51_100++;
    else stats.slDistribution.s100plus++;

    // [mk] 지역 분류 (좌표 기반)
    const region = classifyRegion(e);
    stats.regions[region] = (stats.regions[region] || 0) + 1;
  }

  statsCache[category] = stats;
  return stats;
}

// [mk] 좌표 기반 지역 분류 — 11개 권역
function classifyRegion(e: any): string {
  let lat: number | null = null;
  let lon: number | null = null;

  if (e.lat != null && e.lon != null) {
    lat = Number(e.lat); lon = Number(e.lon);
  } else if (Array.isArray(e.coord) && e.coord.length >= 2) {
    lat = e.coord[0]; lon = e.coord[1];
  } else if (Array.isArray(e.direct_coord) && e.direct_coord.length >= 2) {
    lat = e.direct_coord[0]; lon = e.direct_coord[1];
  }

  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return "unknown";

  // 유럽
  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 40) return "europe";
  // 동아시아
  if (lat >= 18 && lat <= 55 && lon >= 100 && lon <= 150) return "east_asia";
  // 동남아시아
  if (lat >= -12 && lat < 18 && lon >= 90 && lon <= 150) return "southeast_asia";
  // 남아시아
  if (lat >= 5 && lat <= 40 && lon >= 60 && lon < 100) return "south_asia";
  // 중앙아시아
  if (lat >= 30 && lat <= 55 && lon >= 40 && lon < 100) return "central_asia";
  // 중동
  if (lat >= 12 && lat < 40 && lon >= 25 && lon < 60) return "middle_east";
  // 북아프리카
  if (lat >= 15 && lat < 35 && lon >= -20 && lon < 40) return "north_africa";
  // 사하라이남
  if (lat < 15 && lon >= -20 && lon <= 55) return "sub_saharan";
  // 북아메리카
  if (lat >= 15 && lon >= -170 && lon <= -50) return "north_america";
  // 중남아메리카
  if (lat < 15 && lon >= -120 && lon <= -30) return "latin_america";
  // 오세아니아
  if (lat < -10 && lon >= 100) return "oceania";

  return "unknown";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const category = searchParams.get("category") || "events";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "50")));
  const sort = searchParams.get("sort") || "sitelinks";
  const order = searchParams.get("order") || "desc";
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const kind = searchParams.get("kind") || "all";
  const hasKo = searchParams.get("hasKo") || "all"; // all | yes | no
  const minSl = parseInt(searchParams.get("minSl") || "0");
  const region = searchParams.get("region") || "all"; // [mk] 지역 필터

  // [mk] 사용 가능한 카테고리 목록 반환
  if (category === "_categories") {
    const available: string[] = [];
    for (const [cat, info] of Object.entries(CATEGORY_FILES)) {
      if (fs.existsSync(info.path)) available.push(cat);
    }
    return NextResponse.json({ available, dumpDir: DUMP_DIR });
  }

  // [mk] 데이터 로드
  const data = loadCategory(category);
  if (!data) {
    const catInfo = CATEGORY_FILES[category];
    return NextResponse.json(
      {
        error: `카테고리 '${category}' 데이터를 찾을 수 없습니다.`,
        hint: catInfo ? `${catInfo.path} 파일이 필요합니다.` : "알 수 없는 카테고리",
        available: Object.keys(CATEGORY_FILES),
      },
      { status: 404 }
    );
  }

  const stats = getStats(category, data);

  const isJsonl = CATEGORY_FILES[category]?.format === "jsonl";

  // [mk] 필터링
  let filtered = data;

  // kind 필터 — JSONL은 p31 배열에서 매칭
  if (kind !== "all") {
    filtered = filtered.filter((e) => {
      if (isJsonl || category === "korean") {
        return Array.isArray(e.p31) && e.p31.includes(kind);
      }
      const k = e.event_kind || e.entity_kind || e.occupation || e.type || "unknown";
      return k === kind;
    });
  }

  // [mk] 지역 필터
  if (region !== "all") {
    filtered = filtered.filter((e) => classifyRegion(e) === region);
  }

  // 한국어 이름 필터
  if (hasKo === "yes") {
    filtered = filtered.filter((e) => e.name_ko);
  } else if (hasKo === "no") {
    filtered = filtered.filter((e) => !e.name_ko);
  }

  // sitelinks 최소값 필터
  if (minSl > 0) {
    filtered = filtered.filter((e) => (e.sitelinks || 0) >= minSl);
  }

  // 검색 필터
  if (search) {
    filtered = filtered.filter(
      (e) =>
        (e.name_ko && e.name_ko.toLowerCase().includes(search)) ||
        (e.name_en && e.name_en.toLowerCase().includes(search)) ||
        (e.qid && e.qid.toLowerCase().includes(search)) ||
        (e.desc_ko && e.desc_ko.toLowerCase().includes(search)) ||
        (e.desc_en && e.desc_en.toLowerCase().includes(search))
    );
  }

  // [cl] 정렬
  const sorted = [...filtered].sort((a, b) => {
    let va: any, vb: any;
    switch (sort) {
      case "sitelinks":
        va = a.sitelinks || 0;
        vb = b.sitelinks || 0;
        break;
      case "name_ko":
        va = a.name_ko || "\uffff";
        vb = b.name_ko || "\uffff";
        break;
      case "name_en":
        va = a.name_en || "\uffff";
        vb = b.name_en || "\uffff";
        break;
      case "year":
        va = a.start_year ?? a.birth_year ?? a.anchor_year ?? a.inception ?? a.point_in_time ?? 9999;
        vb = b.start_year ?? b.birth_year ?? b.anchor_year ?? b.inception ?? b.point_in_time ?? 9999;
        break;
      default:
        va = a.sitelinks || 0;
        vb = b.sitelinks || 0;
    }
    if (va < vb) return order === "desc" ? 1 : -1;
    if (va > vb) return order === "desc" ? -1 : 1;
    return 0;
  });

  // [cl] 페이지네이션
  const total = sorted.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const pageData = sorted.slice(offset, offset + limit);

  return NextResponse.json({
    category,
    data: pageData,
    total,
    page,
    limit,
    totalPages,
    stats,
  });
}
