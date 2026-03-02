// [cl] 덤프 데이터 브라우징 API — 1차 파싱 결과 조회
// jinserver의 /mnt/data2/wikidata/output/ 에서 직접 읽음
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

const DUMP_DIR = "/mnt/data2/wikidata/output";

// [cl] 카테고리별 파일명 매핑
const CATEGORY_FILES: Record<string, string> = {
  events: "events_final.json",
  hist: "hist_entities_final.json",
  persons: "persons_browse.json",   // 사전필터링된 요약본
  places: "places_browse.json",     // 사전필터링된 요약본
  korean: "korean_all.jsonl",       // [cl] 한국어 전량 (JSONL)
};

// [cl] 메모리 캐시 — 프로세스 살아있는 동안 유지
const cache: Record<string, any[]> = {};
const statsCache: Record<string, any> = {};
let koreanLoadedAt = 0; // [cl] korean 캐시 타임스탬프 — 파싱 중 갱신용

function loadCategory(category: string): any[] | null {
  // [cl] korean은 JSONL 전용 로더 사용
  if (category === "korean") return loadKorean();

  if (cache[category]) return cache[category];

  const filename = CATEGORY_FILES[category];
  if (!filename) return null;

  const filepath = path.join(DUMP_DIR, filename);
  if (!fs.existsSync(filepath)) return null;

  try {
    const raw = fs.readFileSync(filepath, "utf-8");
    const data = JSON.parse(raw);
    cache[category] = data;
    return data;
  } catch (e) {
    console.error(`[dump-browse] Failed to load ${filepath}:`, e);
    return null;
  }
}

// [cl] JSONL 로더 — 파싱 진행 중에도 현재까지 결과를 읽을 수 있음
// 파일이 변경되면 캐시 무효화 (5분 간격 체크)
function loadKorean(): any[] | null {
  const filepath = path.join(DUMP_DIR, "korean_all.jsonl");
  if (!fs.existsSync(filepath)) return null;

  const now = Date.now();
  const stat = fs.statSync(filepath);
  const fileModified = stat.mtimeMs;

  // 캐시 있고, 파일 수정 후 5분 안 지났으면 캐시 반환
  if (cache["korean"] && (now - koreanLoadedAt < 300_000) && koreanLoadedAt > fileModified) {
    return cache["korean"];
  }

  try {
    console.log(`[dump-browse] Loading korean_all.jsonl (${(stat.size / 1e6).toFixed(0)}MB)...`);
    const raw = fs.readFileSync(filepath, "utf-8");
    const lines = raw.split("\n");
    const data: any[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        data.push(JSON.parse(trimmed));
      } catch {
        // 파싱 중일 때 마지막 줄이 불완전할 수 있음 — 스킵
      }
    }
    cache["korean"] = data;
    delete statsCache["korean"]; // 통계도 재생성
    koreanLoadedAt = now;
    console.log(`[dump-browse] korean_all.jsonl loaded: ${data.length.toLocaleString()} entries`);
    return data;
  } catch (e) {
    console.error(`[dump-browse] Failed to load korean_all.jsonl:`, e);
    return null;
  }
}

// [cl] 카테고리별 통계 생성
function getStats(category: string, data: any[]): any {
  if (statsCache[category]) return statsCache[category];

  const stats: any = {
    total: data.length,
    hasKo: 0,
    hasCoord: 0,
    kinds: {} as Record<string, number>,
    slDistribution: { s0: 0, s1_5: 0, s6_20: 0, s21_50: 0, s51_100: 0, s100plus: 0 },
  };

  for (const e of data) {
    if (e.name_ko) stats.hasKo++;
    // [cl] 좌표 체크 — direct_coord/coord 배열 형태도 지원
    if (e.lat != null || (Array.isArray(e.direct_coord) && e.direct_coord.length >= 2) || (Array.isArray(e.coord) && e.coord.length >= 2)) stats.hasCoord++;

    // [cl] kind 필드 — korean은 p31 배열의 첫 번째 QID 사용
    let kind: string;
    if (category === "korean") {
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
  }

  statsCache[category] = stats;
  return stats;
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

  // [cl] 사용 가능한 카테고리 목록 반환
  if (category === "_categories") {
    const available: string[] = [];
    for (const [cat, file] of Object.entries(CATEGORY_FILES)) {
      const filepath = path.join(DUMP_DIR, file);
      if (fs.existsSync(filepath)) available.push(cat);
    }
    return NextResponse.json({ available, dumpDir: DUMP_DIR });
  }

  // [cl] 데이터 로드
  const data = loadCategory(category);
  if (!data) {
    return NextResponse.json(
      {
        error: `카테고리 '${category}' 데이터를 찾을 수 없습니다.`,
        hint: `${DUMP_DIR}/${CATEGORY_FILES[category] || "?"} 파일이 필요합니다.`,
        available: Object.keys(CATEGORY_FILES),
      },
      { status: 404 }
    );
  }

  const stats = getStats(category, data);

  // [cl] 필터링
  let filtered = data;

  // [cl] kind 필터 — korean은 p31 배열에서 매칭
  if (kind !== "all") {
    filtered = filtered.filter((e) => {
      if (category === "korean") {
        return Array.isArray(e.p31) && e.p31.includes(kind);
      }
      const k = e.event_kind || e.entity_kind || e.occupation || e.type || "unknown";
      return k === kind;
    });
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
