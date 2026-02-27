#!/usr/bin/env node

// [cl] Gemini Flash 기반 AI 큐레이션 스크립트
// 이벤트를 배치로 읽어 Gemini에게 판정 요청 → is_curated_visible 업데이트
//
// 사용법:
//   node scripts/curation/aiCurator.mjs                    # 미처리(null) 이벤트 큐레이션
//   node scripts/curation/aiCurator.mjs --dry-run          # DB 업데이트 없이 판정만
//   node scripts/curation/aiCurator.mjs --kind place       # place만 대상
//   node scripts/curation/aiCurator.mjs --limit 100        # 최대 100건
//   node scripts/curation/aiCurator.mjs --year-from 0 --year-to 500

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
  logError("GEMINI_API_KEY 환경변수가 없습니다. Google AI Studio에서 발급하세요.");
  process.exit(1);
}

// ─── CLI Args ────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
const DRY_RUN = args.includes("--dry-run");
const KIND_FILTER = getArg("--kind", null);
const LIMIT = Number(getArg("--limit", "500"));
const YEAR_FROM = getArg("--year-from", null);
const YEAR_TO = getArg("--year-to", null);
const BATCH_SIZE = 10; // [cl] Gemini에 한번에 보내는 이벤트 수
const DELAY_MS = 4000; // [cl] API 호출 간 딜레이 (free tier 10 RPM 대비)
const MAX_RETRIES = 5; // [cl] 429 rate limit 시 재시도 횟수

// ─── Log file ────────────────────────────────────────
const logDir = path.join(cwd, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `ai-curation-${Date.now()}.jsonl`);

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
const GEMINI_MODEL = "gemini-2.5-flash";
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

    // [cl] 429 rate limit → 지수 백오프 후 재시도
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
    // [cl] 2.5 모델은 parts가 여러 개일 수 있음 (thinking + response)
    const parts = data.candidates?.[0]?.content?.parts || [];
    let raw = "";
    for (const part of parts) {
      if (part.text) raw = part.text; // 마지막 text part가 실제 응답
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
카테고리: ${e.category}
유형: ${e.event_kind || "unknown"}
전투여부: ${e.is_battle}
위치: ${country}
요약: ${summary.slice(0, 400)}`;
  });

  return `너는 "TimeGlobe"라는 역사 3D 지구본 프로젝트의 데이터 큐레이터야.
아래 ${events.length}개 이벤트를 평가해서 지구본에 표시할 가치가 있는지 판정해줘.

## 승인(approve) 기준
- 구체적인 역사적 사건(전투, 건국, 조약, 발명, 재해, 문화적 사건 등)을 설명함
- start_year(연도)가 실제 사건과 일치하거나 합리적임
- 요약이 해당 연도의 사건을 뒷받침함

## 거부(reject) 기준
- 단순한 지리적 장소 엔트리로, 특정 역사적 사건이 아님
- 연도가 사건과 무관함 (예: 도시 엔트리인데 start_year=1)
- 요약이 연도와 전혀 관련 없는 일반적 설명임
- 정보가 너무 부족해서 역사적 의미를 판단할 수 없음

## 이벤트 목록
${items.join("\n\n")}

## 응답 형식
JSON 배열로 응답해. 각 항목은 위 이벤트의 인덱스 순서대로:
[
  { "index": 0, "verdict": "approve" 또는 "reject", "confidence": 0~100, "reason": "한국어로 간단한 이유" },
  ...
]`;
}

// ─── Main ────────────────────────────────────────────
async function main() {
  logInfo("=== AI 큐레이션 시작 ===", {
    dryRun: DRY_RUN,
    kind: KIND_FILTER,
    limit: LIMIT,
    yearFrom: YEAR_FROM,
    yearTo: YEAR_TO,
  });

  // 1) 미처리 이벤트 fetch
  const params = new URLSearchParams({
    select: "id,title,start_year,end_year,category,event_kind,is_battle,is_curated_visible,modern_country,summary,image_url,external_link",
    is_curated_visible: "is.null",
    order: "start_year.asc",
    limit: String(LIMIT),
  });

  if (KIND_FILTER) params.set("event_kind", `eq.${KIND_FILTER}`);
  if (YEAR_FROM) params.set("start_year", `gte.${YEAR_FROM}`);
  if (YEAR_TO) {
    if (YEAR_FROM) {
      params.delete("start_year");
      params.set("and", `(start_year.gte.${YEAR_FROM},start_year.lte.${YEAR_TO})`);
    } else {
      params.set("start_year", `lte.${YEAR_TO}`);
    }
  }

  const events = await pgGet(`events?${params.toString()}`);
  logInfo(`미처리 이벤트 ${events.length}건 로드 완료`);

  if (events.length === 0) {
    logInfo("처리할 이벤트가 없습니다.");
    return;
  }

  // 2) 배치 처리
  let approved = 0, rejected = 0, errors = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(events.length / BATCH_SIZE);

    logInfo(`배치 ${batchNum}/${totalBatches} (${batch.length}건) 처리 중...`);

    try {
      const prompt = buildPrompt(batch);
      const raw = await callGemini(prompt);

      let verdicts;
      try {
        verdicts = JSON.parse(raw);
      } catch {
        logError(`Gemini 응답 파싱 실패 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += batch.length;
        continue;
      }

      if (!Array.isArray(verdicts)) {
        logError(`Gemini 응답이 배열이 아님 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += batch.length;
        continue;
      }

      // 3) 판정 적용
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const v = verdicts.find((x) => x.index === j) || verdicts[j];
        if (!v || !v.verdict) {
          logWarn(`판정 누락: ${event.title?.ko || event.id}`, { index: j });
          errors++;
          continue;
        }

        const isApproved = v.verdict === "approve";
        const title = event.title?.ko || event.title?.en || event.id;

        const logRecord = {
          id: event.id,
          title,
          start_year: event.start_year,
          event_kind: event.event_kind,
          verdict: v.verdict,
          confidence: v.confidence,
          reason: v.reason,
        };
        appendLog(logRecord);

        const mark = isApproved ? "✓" : "✗";
        const color = isApproved ? "\x1b[32m" : "\x1b[31m";
        console.log(
          `  ${color}${mark}\x1b[0m [${v.confidence}%] ${event.start_year} AD | ${title} — ${v.reason}`,
        );

        if (!DRY_RUN) {
          try {
            await pgPatch(event.id, { is_curated_visible: isApproved });
          } catch (err) {
            logError(`DB 업데이트 실패: ${title}`, { error: String(err) });
            errors++;
            continue;
          }
        }

        if (isApproved) approved++;
        else rejected++;
      }
    } catch (err) {
      logError(`배치 ${batchNum} 실패`, { error: String(err) });
      errors += batch.length;
    }

    // [cl] rate limit 대비 딜레이
    if (i + BATCH_SIZE < events.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 4) 결과 요약
  console.log("\n" + "═".repeat(50));
  logInfo("=== AI 큐레이션 완료 ===", {
    total: events.length,
    approved,
    rejected,
    errors,
    dryRun: DRY_RUN,
    logFile,
  });
  console.log(`  승인: ${approved}건 | 거부: ${rejected}건 | 오류: ${errors}건`);
  console.log(`  판정 로그: ${logFile}`);
  if (DRY_RUN) console.log("  (DRY RUN — DB 변경 없음)");
}

main().catch((err) => {
  logError("치명적 오류", { error: String(err) });
  process.exit(1);
});
