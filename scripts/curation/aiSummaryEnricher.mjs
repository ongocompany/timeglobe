#!/usr/bin/env node

// [cl] Gemini 기반 AI 요약 보충 스크립트
// summary가 없거나 짧은 이벤트에 대해 Wikipedia 본문을 참조하여 풍부한 요약 생성
//
// 사용법:
//   node scripts/curation/aiSummaryEnricher.mjs --dry-run          # DB 업데이트 없이 미리보기
//   node scripts/curation/aiSummaryEnricher.mjs --min-chars 300    # 300자 미만 대상 (기본값)
//   node scripts/curation/aiSummaryEnricher.mjs --limit 50
//   node scripts/curation/aiSummaryEnricher.mjs --model gemini-2.5-pro

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
const LIMIT = Number(getArg("--limit", "100"));
const MIN_CHARS = Number(getArg("--min-chars", "300"));
const GEMINI_MODEL = getArg("--model", "gemini-2.5-flash");
const BATCH_SIZE = 3; // [cl] 위키 본문 포함 + 긴 요약 생성이라 배치 작게
const DELAY_MS = 4000;
const MAX_RETRIES = 5;
const WIKI_EXTRACT_CHARS = 8000; // [cl] 위키피디아에서 가져올 최대 글자수

// ─── Log file ────────────────────────────────────────
const logDir = path.join(cwd, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `ai-summary-enrich-${Date.now()}.jsonl`);

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

// ─── Wikipedia extract API ───────────────────────────
async function fetchWikiExtract(lang, title) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "extracts",
      explaintext: "1",
      exlimit: "1",
      exchars: String(WIKI_EXTRACT_CHARS),
      format: "json",
      formatversion: "2",
    });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TimeGlobe/1.0 (data enrichment)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;
    return page.extract || null;
  } catch {
    return null;
  }
}

// [cl] ko 위키 우선, 없으면 en 위키
async function getWikiContent(event) {
  // event_sources에서 위키 타이틀 가져오기 시도
  let koTitle = null;
  let enTitle = null;

  try {
    const sources = await pgGet(
      `event_sources?event_id=eq.${event.id}&select=ko_wiki_title,en_wiki_title&limit=1`,
    );
    if (sources.length > 0) {
      koTitle = sources[0].ko_wiki_title;
      enTitle = sources[0].en_wiki_title;
    }
  } catch {
    // event_sources 없으면 external_link에서 추출 시도
  }

  // external_link에서 위키 타이틀 추출 fallback
  if (!koTitle && !enTitle && event.external_link) {
    const koMatch = event.external_link.match(/ko\.wikipedia\.org\/wiki\/([^\s"]+)/);
    const enMatch = event.external_link.match(/en\.wikipedia\.org\/wiki\/([^\s"]+)/);
    if (koMatch) koTitle = decodeURIComponent(koMatch[1]);
    if (enMatch) enTitle = decodeURIComponent(enMatch[1]);
  }

  let koExtract = null;
  let enExtract = null;

  if (koTitle) koExtract = await fetchWikiExtract("ko", koTitle);
  if (enTitle) enExtract = await fetchWikiExtract("en", enTitle);

  return {
    koTitle,
    enTitle,
    koExtract,
    enExtract,
    hasContent: Boolean(koExtract || enExtract),
  };
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
          temperature: 0.3,
          maxOutputTokens: 32768,
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

// ─── Summary length helper ───────────────────────────
function summaryLength(event) {
  const ko = event.summary?.ko || "";
  const en = event.summary?.en || "";
  return Math.max(ko.length, en.length);
}

// ─── Prompt ──────────────────────────────────────────
function buildPrompt(items) {
  const entries = items.map((item, i) => {
    const { event, wiki } = item;
    const title = event.title?.ko || event.title?.en || "(제목없음)";
    const currentSummary = event.summary?.ko || event.summary?.en || "(없음)";
    const wikiText = wiki.koExtract || wiki.enExtract || "(위키 본문 없음)";

    return `[${i}] 제목: ${title}
연도: ${event.start_year}
유형: ${event.event_kind || "unknown"}
국가: ${event.modern_country?.ko || event.modern_country?.en || "?"}
현재 요약 (${currentSummary.length}자): ${currentSummary.slice(0, 200)}
위키피디아 본문:
${wikiText.slice(0, 3000)}`;
  });

  return `너는 역사 교육 콘텐츠 작가야.
아래 ${items.length}개 역사 이벤트에 대해 **한국어 요약**을 작성해줘.

## 규칙
- 위키피디아 본문을 참고하되, 핵심 내용만 간결하게 정리
- 300~500자 사이로 작성 (너무 짧거나 길면 안 됨)
- 문체: "~했다", "~이다" 등 서술형 (백과사전 스타일)
- 연도, 장소, 주요 인물, 결과/영향을 포함
- 위키 본문이 없으면 제목과 기존 정보만으로 최선의 요약 작성
- 영어 요약도 함께 작성 (같은 내용, 200~400자)

## 이벤트 목록
${entries.join("\n\n")}

## 응답 형식
JSON 배열로 응답해:
[
  {
    "index": 0,
    "summary_ko": "한국어 요약...",
    "summary_en": "English summary...",
    "source": "wiki_ko" | "wiki_en" | "ai_only"
  },
  ...
]

source:
- wiki_ko: 한국어 위키피디아 본문을 참고함
- wiki_en: 영어 위키피디아 본문을 참고함
- ai_only: 위키 본문 없이 AI 지식만으로 작성`;
}

// ─── Main ────────────────────────────────────────────
async function main() {
  logInfo("=== AI 요약 보충 시작 ===", {
    model: GEMINI_MODEL,
    dryRun: DRY_RUN,
    minChars: MIN_CHARS,
    limit: LIMIT,
  });

  // 1) 요약이 없거나 짧은 이벤트 fetch
  // [cl] PostgREST로 JSON 필드 길이 필터가 어려우므로 일단 전부 가져와서 코드에서 필터
  const events = await pgGet(
    `events?select=id,title,start_year,category,event_kind,modern_country,summary,external_link&order=start_year.asc&limit=${LIMIT * 3}`,
  );

  const targets = events.filter((e) => summaryLength(e) < MIN_CHARS);
  const limited = targets.slice(0, LIMIT);

  logInfo(`전체 ${events.length}건 중 요약 ${MIN_CHARS}자 미만: ${targets.length}건 → 처리 대상: ${limited.length}건`);

  if (limited.length === 0) {
    logInfo("처리할 이벤트가 없습니다.");
    return;
  }

  // [cl] 현재 요약 길이 분포 표시
  const lengthBuckets = { "없음(0)": 0, "1~99": 0, "100~199": 0, "200~299": 0 };
  if (MIN_CHARS > 300) lengthBuckets[`300~${MIN_CHARS - 1}`] = 0;
  for (const e of limited) {
    const len = summaryLength(e);
    if (len === 0) lengthBuckets["없음(0)"]++;
    else if (len < 100) lengthBuckets["1~99"]++;
    else if (len < 200) lengthBuckets["100~199"]++;
    else if (len < 300) lengthBuckets["200~299"]++;
    else if (MIN_CHARS > 300) lengthBuckets[`300~${MIN_CHARS - 1}`]++;
  }
  console.log("\n  요약 길이 분포:");
  for (const [range, count] of Object.entries(lengthBuckets)) {
    if (count > 0) console.log(`    ${range}자: ${count}건`);
  }
  console.log("");

  // 2) 배치 처리
  let enriched = 0, noWiki = 0, skipped = 0, errors = 0;
  const sourceCounts = { wiki_ko: 0, wiki_en: 0, ai_only: 0 };

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(limited.length / BATCH_SIZE);

    logInfo(`배치 ${batchNum}/${totalBatches} — 위키피디아 본문 수집 중...`);

    // 2a) 배치 내 각 이벤트의 위키 본문 수집
    const batchItems = [];
    for (const event of batch) {
      const wiki = await getWikiContent(event);
      batchItems.push({ event, wiki });

      const title = event.title?.ko || event.title?.en || event.id;
      const currentLen = summaryLength(event);
      const wikiStatus = wiki.koExtract ? "ko" : wiki.enExtract ? "en" : "없음";
      console.log(
        `    \x1b[36m>\x1b[0m ${event.start_year} | ${title} (현재 ${currentLen}자, 위키: ${wikiStatus})`,
      );
    }

    const withContent = batchItems.filter((x) => x.wiki.hasContent);
    const withoutContent = batchItems.filter((x) => !x.wiki.hasContent);

    // [cl] 위키 본문 없는 이벤트도 AI 지식으로 요약 시도
    const toProcess = batchItems; // 전부 처리
    noWiki += withoutContent.length;

    if (toProcess.length === 0) {
      skipped += batch.length;
      continue;
    }

    logInfo(`배치 ${batchNum}/${totalBatches} — Gemini 요약 생성 중... (위키 ${withContent.length}건, AI전용 ${withoutContent.length}건)`);

    try {
      const prompt = buildPrompt(toProcess);
      const raw = await callGemini(prompt);

      let results;
      try {
        results = JSON.parse(raw);
      } catch {
        logError(`Gemini 응답 파싱 실패 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += toProcess.length;
        continue;
      }

      if (!Array.isArray(results)) {
        logError(`Gemini 응답이 배열이 아님 (배치 ${batchNum})`, { raw: raw.slice(0, 500) });
        errors += toProcess.length;
        continue;
      }

      for (let j = 0; j < toProcess.length; j++) {
        const { event } = toProcess[j];
        const r = results.find((x) => x.index === j) || results[j];
        const title = event.title?.ko || event.title?.en || event.id;

        if (!r || !r.summary_ko) {
          logWarn(`요약 생성 실패: ${title}`);
          skipped++;
          continue;
        }

        const oldLen = summaryLength(event);
        const newLen = r.summary_ko.length;
        const source = r.source || "ai_only";
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;

        const logRecord = {
          id: event.id,
          title,
          start_year: event.start_year,
          old_length: oldLen,
          new_length_ko: newLen,
          new_length_en: (r.summary_en || "").length,
          source,
        };
        appendLog(logRecord);

        // [cl] 색상: 녹색=위키ko, 노랑=위키en, 회색=AI전용
        const color = source === "wiki_ko" ? "\x1b[32m" : source === "wiki_en" ? "\x1b[33m" : "\x1b[90m";
        console.log(
          `  ${color}[${source}]\x1b[0m ${event.start_year} | ${title} — ${oldLen}자 → ${newLen}자`,
        );

        // [cl] dry-run이면 요약 미리보기 (첫 150자)
        if (DRY_RUN) {
          console.log(`    \x1b[90m${r.summary_ko.slice(0, 150)}...\x1b[0m`);
        }

        if (!DRY_RUN) {
          try {
            await pgPatch(event.id, {
              summary: {
                ko: r.summary_ko,
                en: r.summary_en || event.summary?.en || "",
              },
            });
          } catch (err) {
            logError(`DB 업데이트 실패: ${title}`, { error: String(err) });
            errors++;
            continue;
          }
        }

        enriched++;
      }
    } catch (err) {
      logError(`배치 ${batchNum} 실패`, { error: String(err) });
      errors += toProcess.length;
    }

    if (i + BATCH_SIZE < limited.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 3) 결과 요약
  console.log("\n" + "═".repeat(55));
  logInfo("=== AI 요약 보충 완료 ===", {
    model: GEMINI_MODEL,
    total: limited.length,
    enriched,
    noWiki,
    skipped,
    errors,
    dryRun: DRY_RUN,
    logFile,
  });
  console.log(`\n  요약 보충: ${enriched}건 | 위키 없음: ${noWiki}건 | 건너뜀: ${skipped}건 | 오류: ${errors}건`);
  console.log(`  참조 소스: wiki_ko=${sourceCounts.wiki_ko} | wiki_en=${sourceCounts.wiki_en} | ai_only=${sourceCounts.ai_only}`);
  console.log(`  판정 로그: ${logFile}`);
  if (DRY_RUN) console.log("  (DRY RUN — DB 변경 없음)");
}

main().catch((err) => {
  logError("치명적 오류", { error: String(err) });
  process.exit(1);
});
