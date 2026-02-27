#!/usr/bin/env node

// [cl] Gemini 기반 AI 좌표 매핑 스크립트
// 좌표 없는(location_lat IS NULL) 이벤트에 대략적인 위치를 AI로 추정
//
// 사용법:
//   node scripts/curation/aiGeocoder.mjs                    # 좌표 없는 이벤트 처리
//   node scripts/curation/aiGeocoder.mjs --dry-run          # DB 업데이트 없이 판정만
//   node scripts/curation/aiGeocoder.mjs --model gemini-2.5-pro
//   node scripts/curation/aiGeocoder.mjs --limit 200

import fs from "node:fs";
import path from "node:path";
import { logInfo, logWarn, logError } from "../wikidata/logger.mjs";

// ─── ENV ─────────────────────────────────────────────
const cwd = process.cwd();
for (const name of [".env", ".env.local"]) {
  const p = path.join(cwd, name);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  logError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  process.exit(1);
}
if (!GEMINI_KEY) {
  logError("GEMINI_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}

// ─── CLI Args ────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(getArg("--limit", "500"));
const GEMINI_MODEL = getArg("--model", "gemini-2.5-flash");
const BATCH_SIZE = 10;
const DELAY_MS = 4000;
const MAX_RETRIES = 5;

// ─── Log file ────────────────────────────────────────
const logDir = path.join(cwd, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `ai-geocoder-${Date.now()}.jsonl`);

function appendLog(record) {
  fs.appendFileSync(logFile, JSON.stringify(record) + "\n");
}

// ─── PostgREST helpers ───────────────────────────────
async function pgGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pgPatch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${id}: ${res.status} ${await res.text()}`);
}

// ─── Gemini API ──────────────────────────────────────
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

async function callGemini(prompt) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (res.status === 429) {
      const wait = Math.min(10000 * Math.pow(2, attempt), 120000);
      logWarn(`Rate limit (429) — ${Math.round(wait / 1000)}초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let raw = "";
    for (const part of parts) {
      if (part.text) raw = part.text;
    }
    return raw;
  }
  throw new Error("Rate limit 재시도 초과 (429)");
}

// ─── Prompt ──────────────────────────────────────────
function buildPrompt(events) {
  const items = events.map((e, i) => {
    const title = e.title?.ko || e.title?.en || "(제목없음)";
    const summary = e.summary?.ko || e.summary?.en || "(요약없음)";
    const country = e.modern_country?.ko || e.modern_country?.en || "?";
    return `[${i}] 제목: ${title}
연도: ${e.start_year}
유형: ${e.event_kind || "unknown"}
국가(있으면): ${country}
요약: ${summary.slice(0, 400)}`;
  });

  return `너는 역사 지리 전문가야.
아래 ${events.length}개 역사적 이벤트의 **대략적인 위도/경도**를 추정해줘.

## 규칙
- 전쟁(war)은 주요 교전 지역 또는 발발 지역의 좌표를 사용
- 조약(treaty)은 체결 장소의 좌표를 사용
- 재해(disaster)는 발생 장소의 좌표를 사용
- 정확한 좌표를 모르면 해당 국가/도시의 대략적인 중심 좌표라도 OK
- 전혀 추정 불가하면 lat: null, lng: null

## 이벤트 목록
${items.join("\n\n")}

## 응답 형식
JSON 배열로 응답해:
[
  { "index": 0, "lat": 35.6762, "lng": 139.6503, "location_name": "도쿄, 일본", "confidence": "high|medium|low" },
  ...
]

confidence:
- high: 정확한 위치를 알고 있음 (특정 전장, 도시)
- medium: 대략적인 지역은 알지만 정확하지 않음
- low: 국가 수준의 추정만 가능`;
}

// ─── Main ────────────────────────────────────────────
async function main() {
  logInfo("=== AI 좌표 매핑 시작 ===", {
    model: GEMINI_MODEL,
    dryRun: DRY_RUN,
    limit: LIMIT,
  });

  // 1) 좌표 없는 이벤트 fetch
  const events = await pgGet(
    `events?select=id,title,start_year,category,event_kind,modern_country,summary&location_lat=is.null&order=start_year.asc&limit=${LIMIT}`,
  );
  logInfo(`좌표 미보유 이벤트 ${events.length}건 로드 완료`);

  if (events.length === 0) {
    logInfo("처리할 이벤트가 없습니다.");
    return;
  }

  // 2) 배치 처리
  let geocoded = 0, skipped = 0, errors = 0;
  const confidenceCounts = { high: 0, medium: 0, low: 0 };

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(events.length / BATCH_SIZE);

    logInfo(`배치 ${batchNum}/${totalBatches} (${batch.length}건) 처리 중...`);

    try {
      const prompt = buildPrompt(batch);
      const raw = await callGemini(prompt);

      let results;
      try {
        results = JSON.parse(raw);
      } catch {
        logError(`Gemini 응답 파싱 실패 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += batch.length;
        continue;
      }

      if (!Array.isArray(results)) {
        logError(`Gemini 응답이 배열이 아님 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += batch.length;
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const r = results.find((x) => x.index === j) || results[j];
        const title = event.title?.ko || event.title?.en || event.id;

        if (!r || r.lat == null || r.lng == null) {
          logWarn(`좌표 추정 불가: ${title}`);
          skipped++;
          continue;
        }

        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          logWarn(`좌표 범위 초과: ${title} (${r.lat}, ${r.lng})`);
          skipped++;
          continue;
        }

        const logRecord = {
          id: event.id,
          title,
          start_year: event.start_year,
          event_kind: event.event_kind,
          lat,
          lng,
          location_name: r.location_name,
          confidence: r.confidence,
        };
        appendLog(logRecord);

        const conf = r.confidence || "medium";
        confidenceCounts[conf] = (confidenceCounts[conf] || 0) + 1;

        const icon = conf === "high" ? "\x1b[32m\u25CF\x1b[0m" : conf === "medium" ? "\x1b[33m\u25CF\x1b[0m" : "\x1b[31m\u25CF\x1b[0m";
        console.log(
          `  ${icon} [${conf}] ${event.start_year} AD | ${title} → ${r.location_name} (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
        );

        if (!DRY_RUN) {
          try {
            const patch = { location_lat: lat, location_lng: lng };
            // [cl] country 정보도 location_name에서 추출 가능하면 업데이트
            if (r.location_name && (!event.modern_country?.ko && !event.modern_country?.en)) {
              patch.modern_country = { ko: r.location_name, en: r.location_name };
            }
            await pgPatch(event.id, patch);
          } catch (err) {
            logError(`DB 업데이트 실패: ${title}`, { error: String(err) });
            errors++;
            continue;
          }
        }

        geocoded++;
      }
    } catch (err) {
      logError(`배치 ${batchNum} 실패`, { error: String(err) });
      errors += batch.length;
    }

    if (i + BATCH_SIZE < events.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 3) 결과 요약
  console.log("\n" + "═".repeat(55));
  logInfo("=== AI 좌표 매핑 완료 ===", {
    model: GEMINI_MODEL,
    total: events.length,
    geocoded,
    skipped,
    errors,
    dryRun: DRY_RUN,
    logFile,
  });
  console.log(`\n  좌표 매핑: ${geocoded}건 | 추정불가: ${skipped}건 | 오류: ${errors}건`);
  console.log(`  신뢰도: high=${confidenceCounts.high} | medium=${confidenceCounts.medium} | low=${confidenceCounts.low}`);
  console.log(`  판정 로그: ${logFile}`);
  if (DRY_RUN) console.log("  (DRY RUN — DB 변경 없음)");
}

main().catch((err) => {
  logError("치명적 오류", { error: String(err) });
  process.exit(1);
});
