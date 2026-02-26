import { config, requireDbEnv } from "./config.mjs";
import { loadCheckpoint, saveCheckpoint, ensureTaskState } from "./checkpoint.mjs";
import { buildTasks } from "./planner.mjs";
import { buildQuery } from "./sparqlTemplates.mjs";
import { runSparql } from "./wdqsClient.mjs";
import { normalizeBinding } from "./normalizer.mjs";
import { enrichWithWikipedia } from "./wikiEnricher.mjs";
import { patchEventById, upsertEvents, upsertSourceMeta } from "./supabaseLoader.mjs";
import { logError, logInfo } from "./logger.mjs";
import fs from "node:fs/promises";

const FALLBACK_LABEL_LANG_PRIORITY = [
  "ko",
  "en",
  "de",
  "fr",
  "es",
  "ja",
  "zh",
  "ru",
  "it",
  "pt",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    mode: "bootstrap",
    types: ["event", "person", "place"],
    dryRun: false,
    yearFrom: null,
    yearTo: null,
    reportFile: "",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--mode") parsed.mode = args[i + 1];
    if (arg === "--types") parsed.types = args[i + 1].split(",").map((v) => v.trim());
    if (arg === "--dry-run") parsed.dryRun = true;
    if (arg === "--year-from") parsed.yearFrom = Number(args[i + 1]);
    if (arg === "--year-to") parsed.yearTo = Number(args[i + 1]);
    if (arg === "--report-file") parsed.reportFile = args[i + 1];
  }

  if (!["bootstrap", "incremental", "backfill", "probe"].includes(parsed.mode)) {
    throw new Error(`Invalid mode: ${parsed.mode}`);
  }
  return parsed;
}

function resolveYearRange(mode, parsed) {
  if (
    typeof parsed.yearFrom === "number" &&
    !Number.isNaN(parsed.yearFrom) &&
    typeof parsed.yearTo === "number" &&
    !Number.isNaN(parsed.yearTo)
  ) {
    return { from: parsed.yearFrom, to: parsed.yearTo };
  }
  if (mode === "incremental") {
    const current = new Date().getUTCFullYear();
    return { from: current - 5, to: current + 1 };
  }
  return { from: config.yearFrom, to: config.yearTo };
}

function initTaskStats() {
  return {
    rows: 0,
    normalized: 0,
    withKoLabel: 0,
    withEnLabel: 0,
    withKoWiki: 0,
    withEnWiki: 0,
    bilingualTitle: 0,
    detailKept: 0,
    detailSkipped: 0,
  };
}

function accumulateStats(stats, row, normalized) {
  stats.rows += 1;
  if (row.itemLabel_ko?.value) stats.withKoLabel += 1;
  if (row.itemLabel_en?.value) stats.withEnLabel += 1;
  if (row.koWikiTitle?.value) stats.withKoWiki += 1;
  if (row.enWikiTitle?.value) stats.withEnWiki += 1;

  if (normalized) {
    stats.normalized += 1;
    const hasKo = Boolean(normalized.eventRecord.title?.ko);
    const hasEn = Boolean(normalized.eventRecord.title?.en);
    if (hasKo && hasEn) stats.bilingualTitle += 1;
  }
}

function ratio(a, b) {
  if (!b) return 0;
  return Number(((a / b) * 100).toFixed(2));
}

function dedupeBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function isEmptyBilingual(value) {
  if (!value || typeof value !== "object") return true;
  const ko = String(value.ko ?? "").trim();
  const en = String(value.en ?? "").trim();
  return !ko && !en;
}

function detailScoreOf(item, wikiPatch) {
  const source = item.sourceMeta;
  const event = item.eventRecord;

  const hasWikiTitle = Boolean(source.ko_wiki_title || source.en_wiki_title);
  const hasSourceDescription = !isEmptyBilingual(source.description);
  const hasCountry = !isEmptyBilingual(event.modern_country);
  const hasSummary =
    !isEmptyBilingual(event.summary) ||
    (wikiPatch ? !isEmptyBilingual(wikiPatch.summary) : false);
  const hasImage = Boolean(event.image_url || (wikiPatch ? wikiPatch.image_url : null));

  return [hasWikiTitle, hasSourceDescription, hasCountry, hasSummary, hasImage]
    .filter(Boolean).length;
}

function hasSummaryOf(item, wikiPatch) {
  const hasEventSummary = !isEmptyBilingual(item.eventRecord.summary);
  const hasWikiSummary = wikiPatch ? !isEmptyBilingual(wikiPatch.summary) : false;
  return hasEventSummary || hasWikiSummary;
}

function buildFallbackLabelQuery(qids) {
  const validQids = qids.filter((qid) => /^Q\d+$/.test(qid));
  if (!validQids.length) return "";
  const values = validQids.map((qid) => `wd:${qid}`).join(" ");
  const langs = FALLBACK_LABEL_LANG_PRIORITY.map((lang) => `"${lang}"`).join(", ");

  return `
    SELECT DISTINCT
      (STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
      ?label
      (LANG(?label) AS ?lang)
    WHERE {
      VALUES ?item { ${values} }
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN (${langs}))
    }
  `;
}

function pickFallbackLabels(labelRows) {
  const rank = new Map(
    FALLBACK_LABEL_LANG_PRIORITY.map((lang, index) => [lang, index]),
  );
  const picked = new Map();

  for (const row of labelRows) {
    const qid = row.qid?.value?.trim();
    const label = row.label?.value?.trim();
    const lang = row.lang?.value?.trim();
    if (!qid || !label || !lang) continue;
    if (!rank.has(lang)) continue;

    const existing = picked.get(qid);
    const next = { label, lang, rank: rank.get(lang) };
    if (!existing || next.rank < existing.rank) {
      picked.set(qid, next);
    }
  }

  return picked;
}

async function attachFallbackLabels(rows) {
  const targetQids = [...new Set(
    rows
      .filter((row) => !row.itemLabel_ko?.value && !row.itemLabel_en?.value)
      .map((row) => row.qid?.value?.trim())
      .filter(Boolean),
  )];

  if (!targetQids.length) return rows;

  const query = buildFallbackLabelQuery(targetQids);
  if (!query) return rows;

  const labelRows = await runSparql(query);
  const fallbackMap = pickFallbackLabels(labelRows);
  if (!fallbackMap.size) return rows;

  let applied = 0;
  const mapped = rows.map((row) => {
    if (row.itemLabel_ko?.value || row.itemLabel_en?.value) return row;
    const qid = row.qid?.value?.trim();
    const fallback = qid ? fallbackMap.get(qid) : null;
    if (!fallback) return row;
    applied += 1;
    return {
      ...row,
      itemLabel_fallback: {
        type: "literal",
        value: fallback.label,
      },
    };
  });

  if (applied > 0) {
    logInfo("Applied fallback labels", { targets: targetQids.length, applied });
  }

  return mapped;
}

async function applyDetailGate(items) {
  const shouldTryWiki =
    config.fetchWikipediaSummary || config.requireDetail || config.requireSummary;
  const minScore = Math.max(1, config.minDetailScore || 1);

  const kept = [];
  const patches = [];
  let skipped = 0;

  for (const item of items) {
    let wikiPatch = null;
    let score = detailScoreOf(item, wikiPatch);
    let hasSummary = hasSummaryOf(item, wikiPatch);

    if (
      shouldTryWiki &&
      (config.fetchWikipediaSummary ||
        score < minScore ||
        (config.requireSummary && !hasSummary))
    ) {
      wikiPatch = await enrichWithWikipedia(item.sourceMeta);
      score = detailScoreOf(item, wikiPatch);
      hasSummary = hasSummaryOf(item, wikiPatch);
    }

    if (config.requireSummary && !hasSummary) {
      skipped += 1;
      continue;
    }

    if (config.requireDetail && score < minScore) {
      skipped += 1;
      continue;
    }

    kept.push(item);
    if (wikiPatch) {
      patches.push({ eventId: item.sourceMeta.event_id, patch: wikiPatch });
    }
  }

  return { kept, patches, skipped };
}

function summarizeTaskStats(stats) {
  return {
    rows: stats.rows,
    normalized: stats.normalized,
    withKoLabel: stats.withKoLabel,
    withEnLabel: stats.withEnLabel,
    withKoWiki: stats.withKoWiki,
    withEnWiki: stats.withEnWiki,
    bilingualTitle: stats.bilingualTitle,
    normalizeRate: ratio(stats.normalized, stats.rows),
    koLabelRate: ratio(stats.withKoLabel, stats.rows),
    enLabelRate: ratio(stats.withEnLabel, stats.rows),
    koWikiRate: ratio(stats.withKoWiki, stats.rows),
    enWikiRate: ratio(stats.withEnWiki, stats.rows),
    bilingualTitleRate: ratio(stats.bilingualTitle, stats.normalized),
    detailKept: stats.detailKept,
    detailSkipped: stats.detailSkipped,
    detailKeepRate: ratio(stats.detailKept, stats.detailKept + stats.detailSkipped),
  };
}

async function runTask(task, checkpointState, mode, options) {
  const taskState = ensureTaskState(checkpointState, task.id);
  if (taskState.status === "success" && mode !== "backfill") {
    logInfo("Skip completed task", { taskId: task.id });
    return { taskId: task.id, summary: null };
  }

  taskState.status = "running";
  taskState.startedAt = new Date().toISOString();
  taskState.error = null;
  taskState.mode = mode;
  await saveCheckpoint(config.checkpointPath, checkpointState);

  let offset = 0;
  let totalRows = 0;
  let pageCount = 0;
  const stats = initTaskStats();

  while (true) {
    const query = buildQuery({
      entityType: task.type,
      yearFrom: task.yearFrom,
      yearTo: task.yearTo,
      limit: config.pageSize,
      offset,
    });
    const rows = await runSparql(query);
    if (!rows.length) break;

    const rowsWithFallback = await attachFallbackLabels(rows);
    const normalized = rowsWithFallback.map((row) => {
      const n = normalizeBinding(row, task.type);
      accumulateStats(stats, row, n);
      return n;
    }).filter(Boolean);

    const deduped = dedupeBy(normalized, (item) => item.eventRecord.id);
    const detailResult = await applyDetailGate(deduped);
    const events = detailResult.kept.map((item) => item.eventRecord);
    const sources = detailResult.kept.map((item) => item.sourceMeta);
    stats.detailKept += events.length;
    stats.detailSkipped += detailResult.skipped;

    if (!options.dryRun) {
      await upsertEvents(events);
      await upsertSourceMeta(sources);

      for (const prepared of detailResult.patches) {
        await patchEventById(prepared.eventId, prepared.patch);
      }
    }

    totalRows += events.length;
    pageCount += 1;
    offset += config.pageSize;

    logInfo("Task page complete", {
      taskId: task.id,
      page: pageCount,
      pageRows: events.length,
      totalRows,
      detailSkipped: detailResult.skipped,
    });

    if (rows.length < config.pageSize) break;
  }

  taskState.status = "success";
  taskState.finishedAt = new Date().toISOString();
  taskState.records = totalRows;
  taskState.pages = pageCount;
  await saveCheckpoint(config.checkpointPath, checkpointState);
  const summary = summarizeTaskStats(stats);
  logInfo("Task summary", { taskId: task.id, ...summary });
  return { taskId: task.id, summary };
}

function mergeTaskSummaries(results) {
  const merged = {
    rows: 0,
    normalized: 0,
    withKoLabel: 0,
    withEnLabel: 0,
    withKoWiki: 0,
    withEnWiki: 0,
    bilingualTitle: 0,
    detailKept: 0,
    detailSkipped: 0,
  };

  for (const result of results) {
    if (!result?.summary) continue;
    merged.rows += result.summary.rows;
    merged.normalized += result.summary.normalized;
    merged.withKoLabel += result.summary.withKoLabel;
    merged.withEnLabel += result.summary.withEnLabel;
    merged.withKoWiki += result.summary.withKoWiki;
    merged.withEnWiki += result.summary.withEnWiki;
    merged.bilingualTitle += result.summary.bilingualTitle;
    merged.detailKept += result.summary.detailKept ?? 0;
    merged.detailSkipped += result.summary.detailSkipped ?? 0;
  }

  return {
    rows: merged.rows,
    normalized: merged.normalized,
    normalizeRate: ratio(merged.normalized, merged.rows),
    koLabelRate: ratio(merged.withKoLabel, merged.rows),
    enLabelRate: ratio(merged.withEnLabel, merged.rows),
    koWikiRate: ratio(merged.withKoWiki, merged.rows),
    enWikiRate: ratio(merged.withEnWiki, merged.rows),
    bilingualTitleRate: ratio(merged.bilingualTitle, merged.normalized),
    detailKept: merged.detailKept,
    detailSkipped: merged.detailSkipped,
    detailKeepRate: ratio(merged.detailKept, merged.detailKept + merged.detailSkipped),
  };
}

async function main() {
  const parsed = parseArgs();
  const { mode, types, dryRun, reportFile } = parsed;

  if (!dryRun && mode !== "probe") {
    requireDbEnv();
  }

  const years = resolveYearRange(mode, parsed);
  const tasks = buildTasks({
    types,
    yearFrom: years.from,
    yearTo: years.to,
    chunkYears: config.chunkYears,
    mode,
  });

  const checkpointState = await loadCheckpoint(config.checkpointPath);
  logInfo("Pipeline started", {
    mode,
    dryRun,
    yearFrom: years.from,
    yearTo: years.to,
    requireDetail: config.requireDetail,
    requireSummary: config.requireSummary,
    minDetailScore: config.minDetailScore,
    fetchWikipediaSummary: config.fetchWikipediaSummary,
    tasks: tasks.length,
    checkpoint: config.checkpointPath,
  });

  const taskResults = [];
  for (const task of tasks) {
    try {
      const result = await runTask(task, checkpointState, mode, { dryRun });
      taskResults.push(result);
    } catch (error) {
      const taskState = ensureTaskState(checkpointState, task.id);
      taskState.status = "failed";
      taskState.retries += 1;
      taskState.error = String(error);
      taskState.finishedAt = new Date().toISOString();
      await saveCheckpoint(config.checkpointPath, checkpointState);
      logError("Task failed", { taskId: task.id, error: String(error) });
    }
  }

  const summary = Object.values(checkpointState.tasks).reduce(
    (acc, task) => {
      acc.total += 1;
      if (task.status === "success") acc.success += 1;
      if (task.status === "failed") acc.failed += 1;
      return acc;
    },
    { total: 0, success: 0, failed: 0 },
  );

  const quality = mergeTaskSummaries(taskResults);
  const report = {
    mode,
    dryRun,
    period: { from: years.from, to: years.to },
    types,
    summary,
    quality,
    generatedAt: new Date().toISOString(),
  };

  if (reportFile) {
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), "utf8");
    logInfo("Report written", { reportFile });
  }

  if (dryRun || mode === "probe") {
    logInfo("Probe quality", quality);
  }

  logInfo("Pipeline finished", summary);
}

main().catch((error) => {
  logError("Fatal pipeline error", { error: String(error) });
  process.exit(1);
});
