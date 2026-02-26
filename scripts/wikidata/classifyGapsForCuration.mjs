import fs from "node:fs/promises";
import path from "node:path";
import { config, requireDbEnv } from "./config.mjs";
import { logError, logInfo, logWarn } from "./logger.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    yearFrom: null,
    yearTo: null,
    dryRun: false,
    applyExclude: true,
    reportFile: path.join(process.cwd(), ".cache", "event-gap-cases.json"),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--year-from") parsed.yearFrom = Number(args[i + 1]);
    if (arg === "--year-to") parsed.yearTo = Number(args[i + 1]);
    if (arg === "--dry-run") parsed.dryRun = true;
    if (arg === "--no-apply-exclude") parsed.applyExclude = false;
    if (arg === "--report-file") parsed.reportFile = args[i + 1];
  }
  return parsed;
}

function isEmptyBilingual(value) {
  if (!value || typeof value !== "object") return true;
  const ko = String(value.ko ?? "").trim();
  const en = String(value.en ?? "").trim();
  return !ko && !en;
}

function titleText(value) {
  if (!value || typeof value !== "object") return "";
  return String(value.ko ?? value.en ?? "").trim();
}

function buildReasons(event, source) {
  const reasons = [];

  if (isEmptyBilingual(event.summary)) reasons.push("missing_summary");
  if (!event.image_url) reasons.push("missing_image");
  if (isEmptyBilingual(event.modern_country)) reasons.push("missing_modern_country");
  if (!event.external_link) reasons.push("missing_external_link");

  if (!source) {
    reasons.push("missing_source_record");
    return reasons;
  }

  if (!source.ko_wiki_title && !source.en_wiki_title) reasons.push("missing_wiki_title");
  if (isEmptyBilingual(source.description)) reasons.push("missing_source_description");
  if (!source.qid) reasons.push("missing_qid");

  return reasons;
}

function buildInFilter(ids) {
  return `in.(${ids.join(",")})`;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function postgrest(pathWithQuery, options = {}) {
  requireDbEnv();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${pathWithQuery}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST ${response.status} ${pathWithQuery}: ${text.slice(0, 320)}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function fetchAll(pathWithQuery, pageSize = 500) {
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await postgrest(
      `${pathWithQuery}&limit=${pageSize}&offset=${offset}`,
      { method: "GET" },
    );
    if (!rows?.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function main() {
  requireDbEnv();
  const options = parseArgs();

  const events = await fetchAll(
    "events?select=id,title,start_year,summary,image_url,modern_country,external_link,is_curated_visible",
  );
  const sources = await fetchAll(
    "event_sources?select=event_id,qid,ko_wiki_title,en_wiki_title,description",
  );

  const sourceByEventId = new Map(sources.map((row) => [row.event_id, row]));

  const scoped = events.filter((event) => {
    if (typeof options.yearFrom === "number" && !Number.isNaN(options.yearFrom)) {
      if (event.start_year < options.yearFrom) return false;
    }
    if (typeof options.yearTo === "number" && !Number.isNaN(options.yearTo)) {
      if (event.start_year > options.yearTo) return false;
    }
    return true;
  });

  const reasonStats = {};
  const gapCases = [];

  for (const event of scoped) {
    const source = sourceByEventId.get(event.id) ?? null;
    const reasons = buildReasons(event, source);
    if (!reasons.length) continue;

    for (const reason of reasons) {
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    }

    gapCases.push({
      event_id: event.id,
      start_year: event.start_year,
      title: titleText(event.title),
      reasons,
      missing_score: reasons.length,
      qid: source?.qid ?? null,
      ko_wiki_title: source?.ko_wiki_title ?? null,
      en_wiki_title: source?.en_wiki_title ?? null,
    });
  }

  gapCases.sort((a, b) => b.missing_score - a.missing_score || b.start_year - a.start_year);
  const gapEventIds = gapCases.map((row) => row.event_id);
  const gapCaseRows = gapCases.map((row) => ({
    event_id: row.event_id,
    reasons: row.reasons,
    missing_score: row.missing_score,
    is_excluded: true,
    updated_at: new Date().toISOString(),
  }));

  let gapTableUpserted = 0;
  let excludedUpdated = 0;

  if (!options.dryRun) {
    if (gapCaseRows.length) {
      try {
        for (const part of chunk(gapCaseRows, 100)) {
          await postgrest("event_gap_cases?on_conflict=event_id", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: part,
          });
          gapTableUpserted += part.length;
        }
      } catch (error) {
        logWarn("event_gap_cases upsert skipped. Apply migration first.", {
          error: String(error),
        });
      }
    }

    if (options.applyExclude && gapEventIds.length) {
      for (const ids of chunk(gapEventIds, 100)) {
        await postgrest(`events?id=${buildInFilter(ids)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: { is_curated_visible: false },
        });
        excludedUpdated += ids.length;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    yearFrom: options.yearFrom,
    yearTo: options.yearTo,
    dryRun: options.dryRun,
    applyExclude: options.applyExclude,
    totals: {
      scopedEvents: scoped.length,
      gapCases: gapCases.length,
      gapTableUpserted,
      excludedUpdated,
    },
    reasonStats,
    gapCases,
  };

  await fs.writeFile(options.reportFile, JSON.stringify(report, null, 2), "utf8");
  logInfo("Gap classification complete", {
    scopedEvents: scoped.length,
    gapCases: gapCases.length,
    gapTableUpserted,
    excludedUpdated,
    reportFile: options.reportFile,
  });
}

main().catch((error) => {
  logError("classifyGapsForCuration failed", { error: String(error) });
  process.exit(1);
});
