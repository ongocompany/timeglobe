import fs from "node:fs/promises";
import path from "node:path";
import { config, requireDbEnv } from "./config.mjs";
import { logError, logInfo } from "./logger.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    yearFrom: null,
    yearTo: null,
    dryRun: false,
    deleteFromMain: true,
    reportFile: path.join(process.cwd(), ".cache", "archive-missing-summary-report.json"),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--year-from") parsed.yearFrom = Number(args[i + 1]);
    if (arg === "--year-to") parsed.yearTo = Number(args[i + 1]);
    if (arg === "--dry-run") parsed.dryRun = true;
    if (arg === "--no-delete") parsed.deleteFromMain = false;
    if (arg === "--report-file") parsed.reportFile = args[i + 1];
  }

  return parsed;
}

function isMissingSummary(summary) {
  if (!summary || typeof summary !== "object") return true;
  const ko = String(summary.ko ?? "").trim();
  const en = String(summary.en ?? "").trim();
  return !ko && !en;
}

function titleText(value) {
  if (!value || typeof value !== "object") return "";
  return String(value.ko ?? value.en ?? "").trim();
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

async function ensureArchiveTableAvailable() {
  try {
    await postgrest("event_summary_archive?select=event_id&limit=1");
  } catch (error) {
    throw new Error(
      `event_summary_archive table not available. Apply migration first. Original error: ${String(error)}`,
    );
  }
}

async function main() {
  requireDbEnv();
  const options = parseArgs();

  if (!options.dryRun) {
    await ensureArchiveTableAvailable();
  }

  const events = await fetchAll(
    "events?select=id,era_id,title,start_year,end_year,category,event_kind,is_battle,is_curated_visible,location_lat,location_lng,is_fog_region,modern_country,image_url,summary,external_link,created_at",
  );

  const scoped = events.filter((event) => {
    if (typeof options.yearFrom === "number" && !Number.isNaN(options.yearFrom)) {
      if (event.start_year < options.yearFrom) return false;
    }
    if (typeof options.yearTo === "number" && !Number.isNaN(options.yearTo)) {
      if (event.start_year > options.yearTo) return false;
    }
    return true;
  });

  const missingSummaryEvents = scoped.filter((event) => isMissingSummary(event.summary));
  const missingIds = missingSummaryEvents.map((event) => event.id);

  const sourceRows = [];
  for (const ids of chunk(missingIds, 100)) {
    if (!ids.length) continue;
    const rows = await postgrest(
      `event_sources?select=event_id,qid,entity_type,ko_wiki_title,en_wiki_title,description,class_qid,event_kind,updated_at,created_at&event_id=${buildInFilter(ids)}`,
    );
    if (rows?.length) sourceRows.push(...rows);
  }

  const sourceByEventId = new Map(sourceRows.map((row) => [row.event_id, row]));
  const archiveRows = missingSummaryEvents.map((event) => {
    const source = sourceByEventId.get(event.id) ?? null;
    return {
      event_id: event.id,
      qid: source?.qid ?? null,
      title: event.title,
      start_year: event.start_year,
      event_kind: event.event_kind ?? null,
      is_battle: event.is_battle ?? null,
      archived_reason: "missing_summary",
      event_payload: event,
      source_payload: source,
      archived_at: new Date().toISOString(),
    };
  });

  let archivedUpserted = 0;
  let deletedFromEvents = 0;

  if (!options.dryRun && archiveRows.length) {
    for (const part of chunk(archiveRows, 100)) {
      await postgrest("event_summary_archive?on_conflict=event_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: part,
      });
      archivedUpserted += part.length;
    }
  }

  if (!options.dryRun && options.deleteFromMain && missingIds.length) {
    for (const ids of chunk(missingIds, 100)) {
      await postgrest(`events?id=${buildInFilter(ids)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      deletedFromEvents += ids.length;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    yearFrom: options.yearFrom,
    yearTo: options.yearTo,
    dryRun: options.dryRun,
    deleteFromMain: options.deleteFromMain,
    totals: {
      eventsTotal: events.length,
      scopedEvents: scoped.length,
      missingSummaryEvents: missingSummaryEvents.length,
      archivedUpserted,
      deletedFromEvents,
    },
    samples: missingSummaryEvents.slice(0, 30).map((event) => ({
      event_id: event.id,
      start_year: event.start_year,
      event_kind: event.event_kind ?? null,
      is_battle: event.is_battle ?? null,
      title: titleText(event.title),
    })),
  };

  await fs.writeFile(options.reportFile, JSON.stringify(report, null, 2), "utf8");
  logInfo("Archive missing summary complete", {
    eventsTotal: events.length,
    scopedEvents: scoped.length,
    missingSummaryEvents: missingSummaryEvents.length,
    archivedUpserted,
    deletedFromEvents,
    reportFile: options.reportFile,
  });
}

main().catch((error) => {
  logError("archiveMissingSummaryEvents failed", { error: String(error) });
  process.exit(1);
});

