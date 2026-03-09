import fs from "node:fs/promises";
import path from "node:path";
import { config, requireDbEnv } from "./config.mjs";
import { runSparql } from "./wdqsClient.mjs";
import { logError, logInfo } from "./logger.mjs";
import { buildPersonCandidateQuery, assertPersonCandidateOptions } from "./personCandidateQuery.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    limit: 200,
    offset: 0,
    minSitelinks: 20,
    maxSitelinks: null,
    sourceLang: "both",
    dryRun: false,
    reportFile: path.join(
      process.cwd(),
      ".cache",
      `person-candidates-${Date.now()}.json`,
    ),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit") parsed.limit = Number(args[i + 1]);
    if (arg === "--offset") parsed.offset = Number(args[i + 1]);
    if (arg === "--min-sitelinks") parsed.minSitelinks = Number(args[i + 1]);
    if (arg === "--max-sitelinks") parsed.maxSitelinks = Number(args[i + 1]);
    if (arg === "--source-lang") parsed.sourceLang = args[i + 1];
    if (arg === "--dry-run") parsed.dryRun = true;
    if (arg === "--report-file") parsed.reportFile = args[i + 1];
  }

  assertPersonCandidateOptions(parsed);
  return parsed;
}

function read(binding, key) {
  return binding[key]?.value?.trim() || "";
}

function yearFromRaw(raw) {
  if (!raw) return null;
  const match = raw.match(/^([+-]?\d{1,6})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isNaN(year) ? null : year;
}

function parseCoordValue(value) {
  if (!value) return null;
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function buildJsonb(ko, en, fallback = "") {
  return {
    ko: ko || en || fallback,
    en: en || ko || fallback,
  };
}

function buildExternalLink(koTitle, enTitle, qid) {
  if (koTitle) return `https://ko.wikipedia.org/wiki/${encodeURIComponent(koTitle)}`;
  if (enTitle) return `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`;
  if (qid) return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
  return "";
}

function resolveAnchor(detail) {
  const candidates = [
    ["birth", detail.birthYear],
    ["death", detail.deathYear],
    ["floruit_start", detail.floruitStartYear],
    ["floruit_end", detail.floruitEndYear],
  ];

  for (const [type, year] of candidates) {
    if (typeof year === "number") {
      return { type, year };
    }
  }

  return { type: null, year: null };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWikidataEntities(ids, props = "labels|descriptions|claims|sitelinks") {
  if (!ids.length) return {};
  const url =
    "https://www.wikidata.org/w/api.php" +
    `?action=wbgetentities&format=json&ids=${encodeURIComponent(ids.join("|"))}` +
    `&props=${encodeURIComponent(props)}` +
    "&languages=ko|en";

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`wbgetentities ${response.status}: ${text.slice(0, 320)}`);
  }
  const json = await response.json();
  return json.entities ?? {};
}

function pickTimeClaimYear(entity, property) {
  const claims = entity?.claims?.[property];
  if (!Array.isArray(claims)) return null;
  for (const claim of claims) {
    const raw = claim?.mainsnak?.datavalue?.value?.time;
    const year = yearFromRaw(raw);
    if (typeof year === "number") return year;
  }
  return null;
}

function pickEntityClaimId(entity, property) {
  const claims = entity?.claims?.[property];
  if (!Array.isArray(claims)) return null;
  for (const claim of claims) {
    const id = claim?.mainsnak?.datavalue?.value?.id;
    if (id) return id;
  }
  return null;
}

function pickCoordClaim(entity, property = "P625") {
  const claims = entity?.claims?.[property];
  if (!Array.isArray(claims)) return null;
  for (const claim of claims) {
    const value = claim?.mainsnak?.datavalue?.value;
    const coord = parseCoordValue(value);
    if (coord) return coord;
  }
  return null;
}

function extractPersonDetail(qid, entity) {
  return {
    qid,
    labelKo: entity?.labels?.ko?.value ?? null,
    labelEn: entity?.labels?.en?.value ?? null,
    descKo: entity?.descriptions?.ko?.value ?? null,
    descEn: entity?.descriptions?.en?.value ?? null,
    koWikiTitle: entity?.sitelinks?.kowiki?.title ?? null,
    enWikiTitle: entity?.sitelinks?.enwiki?.title ?? null,
    sitelinksCount: Object.keys(entity?.sitelinks ?? {}).length,
    birthYear: pickTimeClaimYear(entity, "P569"),
    deathYear: pickTimeClaimYear(entity, "P570"),
    floruitStartYear: pickTimeClaimYear(entity, "P2031"),
    floruitEndYear: pickTimeClaimYear(entity, "P2032"),
    coord: pickCoordClaim(entity),
    birthPlaceQid: pickEntityClaimId(entity, "P19"),
    countryQid: pickEntityClaimId(entity, "P27"),
  };
}

function extractPlaceOrCountryDetail(qid, entity) {
  return {
    qid,
    labelKo: entity?.labels?.ko?.value ?? null,
    labelEn: entity?.labels?.en?.value ?? null,
    coord: pickCoordClaim(entity),
    countryQid: pickEntityClaimId(entity, "P17"),
  };
}

function resolveCoord(detail, birthPlace, birthCountry, country) {
  const candidates = [
    ["coord", detail.coord],
    ["birthPlaceCoord", birthPlace?.coord ?? null],
    ["birthCountryCoord", birthCountry?.coord ?? null],
    ["countryCoord", country?.coord ?? null],
  ];

  for (const [source, coord] of candidates) {
    if (coord) return { coord, source };
  }

  return { coord: null, source: null };
}

function normalizeRow(binding, detail, placesByQid, countriesByQid) {
  const qid = detail?.qid || read(binding, "qid");
  if (!qid) return null;

  const koWikiTitle = detail?.koWikiTitle || read(binding, "koWikiTitle");
  const enWikiTitle = detail?.enWikiTitle || read(binding, "enWikiTitle");
  const titleKo = detail?.labelKo || read(binding, "itemLabel_ko") || koWikiTitle;
  const titleEn = detail?.labelEn || read(binding, "itemLabel_en") || enWikiTitle;
  const fallbackTitle = koWikiTitle || enWikiTitle || qid;
  if (!titleKo && !titleEn && !fallbackTitle) return null;

  const birthPlace = detail?.birthPlaceQid ? placesByQid.get(detail.birthPlaceQid) : null;
  const birthCountry = birthPlace?.countryQid ? countriesByQid.get(birthPlace.countryQid) : null;
  const country = detail?.countryQid ? countriesByQid.get(detail.countryQid) : null;
  const { coord, source: coordSource } = resolveCoord(detail, birthPlace, birthCountry, country);
  const anchor = resolveAnchor(detail);

  return {
    qid,
    title: buildJsonb(titleKo, titleEn, fallbackTitle),
    description: buildJsonb(detail?.descKo ?? "", detail?.descEn ?? ""),
    birth_year: detail?.birthYear ?? null,
    death_year: detail?.deathYear ?? null,
    floruit_start_year: detail?.floruitStartYear ?? null,
    floruit_end_year: detail?.floruitEndYear ?? null,
    anchor_year: anchor.year,
    anchor_type: anchor.type,
    location_lat: coord?.lat ?? null,
    location_lng: coord?.lng ?? null,
    modern_country: buildJsonb(
      country?.labelKo || birthCountry?.labelKo || "",
      country?.labelEn || birthCountry?.labelEn || "",
    ),
    external_link: buildExternalLink(koWikiTitle, enWikiTitle, qid) || null,
    ko_wiki_title: koWikiTitle || null,
    en_wiki_title: enWikiTitle || null,
    sitelinks_count: detail?.sitelinksCount || Number(read(binding, "sitelinks") || 0),
    source_payload: {
      coord_source: coordSource,
      has_ko_wiki: Boolean(koWikiTitle),
      has_en_wiki: Boolean(enWikiTitle),
      birth_place_qid: detail?.birthPlaceQid ?? null,
      country_qid: detail?.countryQid ?? null,
      time_signals: {
        birth: detail?.birthYear ?? null,
        death: detail?.deathYear ?? null,
        floruit_start: detail?.floruitStartYear ?? null,
        floruit_end: detail?.floruitEndYear ?? null,
      },
    },
    updated_at: new Date().toISOString(),
  };
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

async function upsertCandidates(rows) {
  for (const part of chunk(rows, 100)) {
    await postgrest("person_candidates?on_conflict=qid", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: part,
    });
  }
}

async function main() {
  const options = parseArgs();
  const query = buildPersonCandidateQuery(options);

  logInfo("Person candidate collection started", {
    dryRun: options.dryRun,
    limit: options.limit,
    offset: options.offset,
    minSitelinks: options.minSitelinks,
    maxSitelinks: options.maxSitelinks,
    sourceLang: options.sourceLang,
  });

  const rows = await runSparql(query);
  const qids = [...new Set(rows.map((row) => read(row, "qid")).filter(Boolean))];
  const detailByQid = new Map();

  for (const part of chunk(qids, 40)) {
    const entities = await fetchWikidataEntities(part);
    for (const qid of part) {
      const entity = entities[qid];
      if (!entity || entity.missing === "") continue;
      detailByQid.set(qid, extractPersonDetail(qid, entity));
    }
    await sleep(200);
  }

  const birthPlaceQids = [...new Set(
    [...detailByQid.values()].map((detail) => detail.birthPlaceQid).filter(Boolean),
  )];
  const placeByQid = new Map();

  for (const part of chunk(birthPlaceQids, 40)) {
    const entities = await fetchWikidataEntities(part, "labels|claims");
    for (const qid of part) {
      const entity = entities[qid];
      if (!entity || entity.missing === "") continue;
      placeByQid.set(qid, extractPlaceOrCountryDetail(qid, entity));
    }
    await sleep(200);
  }

  const countryQids = [...new Set([
    ...[...detailByQid.values()].map((detail) => detail.countryQid),
    ...[...placeByQid.values()].map((place) => place.countryQid),
  ].filter(Boolean))];
  const countryByQid = new Map();

  for (const part of chunk(countryQids, 40)) {
    const entities = await fetchWikidataEntities(part, "labels|claims");
    for (const qid of part) {
      const entity = entities[qid];
      if (!entity || entity.missing === "") continue;
      countryByQid.set(qid, extractPlaceOrCountryDetail(qid, entity));
    }
    await sleep(200);
  }

  const normalized = rows.map((row) => {
    const qid = read(row, "qid");
    return normalizeRow(row, detailByQid.get(qid), placeByQid, countryByQid);
  }).filter(Boolean);

  if (!options.dryRun) {
    requireDbEnv();
    await upsertCandidates(normalized);
  }

  const summary = {
    fetchedRows: rows.length,
    normalizedRows: normalized.length,
    withAnchor: normalized.filter((row) => typeof row.anchor_year === "number").length,
    withoutAnchor: normalized.filter((row) => typeof row.anchor_year !== "number").length,
    withCoord: normalized.filter((row) => row.location_lat !== null).length,
    maxSitelinks: normalized.reduce((max, row) => Math.max(max, row.sitelinks_count), 0),
    reportSample: normalized.slice(0, 20).map((row) => ({
      qid: row.qid,
      title: row.title,
      anchor_year: row.anchor_year,
      anchor_type: row.anchor_type,
      sitelinks_count: row.sitelinks_count,
      external_link: row.external_link,
    })),
  };

  await fs.writeFile(
    options.reportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        options,
        summary,
      },
      null,
      2,
    ),
    "utf8",
  );

  logInfo("Person candidate collection finished", {
    ...summary,
    reportFile: options.reportFile,
  });
}

main().catch((error) => {
  logError("collectPersonCandidates failed", { error: String(error) });
  process.exit(1);
});
