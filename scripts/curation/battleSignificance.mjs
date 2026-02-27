#!/usr/bin/env node

// [cl] Gemini 기반 전투/이벤트 역사적 중요도 스코어링 스크립트
// 승인된(is_curated_visible=true) 이벤트에 1~10 significance_score를 부여
//
// 사용법:
//   node scripts/curation/battleSignificance.mjs                      # 미평가 전투 스코어링
//   node scripts/curation/battleSignificance.mjs --dry-run            # DB 업데이트 없이 판정만
//   node scripts/curation/battleSignificance.mjs --model gemini-2.5-pro   # 모델 선택
//   node scripts/curation/battleSignificance.mjs --kind battle        # 특정 event_kind만
//   node scripts/curation/battleSignificance.mjs --all-kinds          # 전투 외 모든 이벤트
//   node scripts/curation/battleSignificance.mjs --limit 200
//   node scripts/curation/battleSignificance.mjs --rescore            # 이미 점수 있는 것도 재평가

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
const RESCORE = args.includes("--rescore");
const ALL_KINDS = args.includes("--all-kinds");
const KIND_FILTER = getArg("--kind", null);
const LIMIT = Number(getArg("--limit", "500"));
const GEMINI_MODEL = getArg("--model", "gemini-2.5-pro");
const BATCH_SIZE = 10; // [cl] Gemini에 한번에 보내는 이벤트 수
const DELAY_MS = 4000; // [cl] API 호출 간 딜레이
const MAX_RETRIES = 5;

// ─── Log file ────────────────────────────────────────
const logDir = path.join(cwd, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `battle-significance-${Date.now()}.jsonl`);

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
전투여부: ${e.is_battle}
위치: ${country}
요약: ${summary.slice(0, 500)}`;
  });

  return `너는 세계사 전문가이자 "TimeGlobe"라는 역사 3D 지구본 프로젝트의 데이터 큐레이터야.
아래 ${events.length}개 역사적 이벤트의 **역사적 중요도**를 1~10 점수로 평가해줘.

## 점수 기준

### 10점 — 세계사의 흐름을 바꾼 사건
- 예: 적벽 대전(208), 워털루 전투(1815), 스탈린그라드 전투(1942), 밀비우스 다리 전투(312)
- 제국의 흥망, 종교 전파, 세계 질서 변화에 직접 영향

### 8~9점 — 주요 문명/제국의 전환점
- 예: 카탈라우눔 전투(451), 아드리아노폴리스 전투(378), 비수 대전(383)
- 대규모 전쟁의 결정적 전투, 왕조 교체, 영토 대변동

### 6~7점 — 지역 역사에서 중요한 사건
- 예: 관도 대전(200), 이릉 대전(221)
- 해당 문명/국가의 역사에서 교과서에 실릴 수준

### 4~5점 — 기록할 가치는 있으나 영향력 제한적
- 소규모 왕국 간 분쟁, 지역적 세력 다툼
- 전문 역사학자만 아는 수준

### 2~3점 — 마이너한 충돌/사건
- 소규모 국지전, 기록이 불확실한 전투
- 역사적 영향 미미

### 1점 — 거의 알려지지 않은 사건
- 문헌 기록 극소, 역사적 의미 불명확

## 이벤트 목록
${items.join("\n\n")}

## 응답 형식
JSON 배열로 응답해. 각 항목은 위 이벤트의 인덱스 순서대로:
[
  { "index": 0, "score": 1~10, "reason": "한국어로 간단한 이유 (20자 이내)" },
  ...
]`;
}

// ─── Score bar visualization ─────────────────────────
function scoreBar(score) {
  const colors = [
    "", // 0 unused
    "\x1b[90m", // 1 gray
    "\x1b[90m", // 2 gray
    "\x1b[33m", // 3 yellow
    "\x1b[33m", // 4 yellow
    "\x1b[33m", // 5 yellow
    "\x1b[36m", // 6 cyan
    "\x1b[36m", // 7 cyan
    "\x1b[32m", // 8 green
    "\x1b[32m", // 9 green
    "\x1b[35m", // 10 magenta (특급)
  ];
  const filled = "█".repeat(score);
  const empty = "░".repeat(10 - score);
  return `${colors[score]}${filled}${empty}\x1b[0m`;
}

// ─── Main ────────────────────────────────────────────
async function main() {
  logInfo("=== 전투 중요도 스코어링 시작 ===", {
    model: GEMINI_MODEL,
    dryRun: DRY_RUN,
    rescore: RESCORE,
    allKinds: ALL_KINDS,
    kind: KIND_FILTER,
    limit: LIMIT,
  });

  // 1) 이벤트 fetch — 기본: 승인된 전투 중 미평가
  const params = new URLSearchParams({
    select: "id,title,start_year,end_year,category,event_kind,is_battle,modern_country,summary,significance_score",
    is_curated_visible: "eq.true",
    order: "start_year.asc",
    limit: String(LIMIT),
  });

  // [cl] 기본은 전투만, --all-kinds면 전체
  if (!ALL_KINDS) {
    if (KIND_FILTER) {
      params.set("event_kind", `eq.${KIND_FILTER}`);
    } else {
      params.set("is_battle", "eq.true");
    }
  }

  // [cl] --rescore 없으면 미평가(null)만
  if (!RESCORE) {
    params.set("significance_score", "is.null");
  }

  const events = await pgGet(`events?${params.toString()}`);
  logInfo(`대상 이벤트 ${events.length}건 로드 완료`);

  if (events.length === 0) {
    logInfo("처리할 이벤트가 없습니다.");
    return;
  }

  // 2) 배치 처리
  const scoreCounts = new Array(11).fill(0); // index 0~10
  let errors = 0;

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

      // 3) 점수 적용
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const r = results.find((x) => x.index === j) || results[j];
        if (!r || typeof r.score !== "number") {
          logWarn(`점수 누락: ${event.title?.ko || event.id}`, { index: j });
          errors++;
          continue;
        }

        const score = Math.max(1, Math.min(10, Math.round(r.score)));
        const title = event.title?.ko || event.title?.en || event.id;

        const logRecord = {
          id: event.id,
          title,
          start_year: event.start_year,
          event_kind: event.event_kind,
          score,
          reason: r.reason,
        };
        appendLog(logRecord);

        console.log(
          `  ${scoreBar(score)} ${score}/10 | ${event.start_year} AD | ${title} — ${r.reason}`,
        );

        scoreCounts[score]++;

        if (!DRY_RUN) {
          try {
            await pgPatch(event.id, { significance_score: score });
          } catch (err) {
            logError(`DB 업데이트 실패: ${title}`, { error: String(err) });
            errors++;
            continue;
          }
        }
      }
    } catch (err) {
      logError(`배치 ${batchNum} 실패`, { error: String(err) });
      errors += batch.length;
    }

    if (i + BATCH_SIZE < events.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 4) 결과 요약
  console.log("\n" + "═".repeat(55));
  logInfo("=== 전투 중요도 스코어링 완료 ===", {
    model: GEMINI_MODEL,
    total: events.length,
    errors,
    dryRun: DRY_RUN,
    logFile,
  });

  console.log("\n  점수 분포:");
  for (let s = 10; s >= 1; s--) {
    if (scoreCounts[s] > 0) {
      const bar = "▓".repeat(scoreCounts[s]);
      console.log(`  ${s.toString().padStart(2)}점: ${bar} (${scoreCounts[s]}건)`);
    }
  }
  console.log(`\n  오류: ${errors}건`);
  console.log(`  판정 로그: ${logFile}`);
  if (DRY_RUN) console.log("  (DRY RUN — DB 변경 없음)");
}

main().catch((err) => {
  logError("치명적 오류", { error: String(err) });
  process.exit(1);
});
