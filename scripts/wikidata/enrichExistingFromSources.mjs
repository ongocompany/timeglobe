import { config, requireDbEnv } from "./config.mjs";
import { logError, logInfo, logWarn } from "./logger.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function isEmptyBilingual(value) {
  if (!value || typeof value !== "object") return true;
  const ko = String(value.ko ?? "").trim();
  const en = String(value.en ?? "").trim();
  return !ko && !en;
}

function buildBilingual(ko, en) {
  return {
    ko: ko || en || "",
    en: en || ko || "",
  };
}

function buildExternalLink(koTitle, enTitle, qid) {
  if (koTitle) return `https://ko.wikipedia.org/wiki/${encodeURIComponent(koTitle)}`;
  if (enTitle) return `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`;
  if (qid) return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
  return "";
}

function buildCommonsFileUrl(fileName) {
  if (!fileName) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

async function postgrest(path, options = {}) {
  requireDbEnv();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
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
    throw new Error(`PostgREST ${response.status} ${path}: ${text.slice(0, 320)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function fetchAll(path, pageSize = 500) {
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await postgrest(`${path}&limit=${pageSize}&offset=${offset}`);
    if (!rows?.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

async function patchEvent(eventId, patch) {
  await postgrest(`events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: patch,
  });
}

async function patchEventSource(eventId, patch) {
  await postgrest(`event_sources?event_id=eq.${eventId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: patch,
  });
}

async function fetchWikidataEntities(ids, props = "labels|descriptions|claims|sitelinks") {
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

function pickCountryQid(entity) {
  const claims = entity?.claims?.P17;
  if (!Array.isArray(claims)) return null;
  for (const claim of claims) {
    const id = claim?.mainsnak?.datavalue?.value?.id;
    if (id) return id;
  }
  return null;
}

function pickImageFile(entity) {
  const claims = entity?.claims?.P18;
  if (!Array.isArray(claims)) return null;
  for (const claim of claims) {
    const fileName = claim?.mainsnak?.datavalue?.value;
    if (typeof fileName === "string" && fileName.trim()) return fileName.trim();
  }
  return null;
}

function extractEntityMeta(qid, entity) {
  return {
    qid,
    labelKo: entity?.labels?.ko?.value ?? null,
    labelEn: entity?.labels?.en?.value ?? null,
    descKo: entity?.descriptions?.ko?.value ?? null,
    descEn: entity?.descriptions?.en?.value ?? null,
    koWikiTitle: entity?.sitelinks?.kowiki?.title ?? null,
    enWikiTitle: entity?.sitelinks?.enwiki?.title ?? null,
    countryQid: pickCountryQid(entity),
    imageFile: pickImageFile(entity),
  };
}

function summaryUrl(lang, title) {
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
}

async function fetchSummary(lang, title) {
  const response = await fetch(summaryUrl(lang, title), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    summary: data.extract || null,
    imageUrl: data.thumbnail?.source || null,
  };
}

async function main() {
  requireDbEnv();

  const sourceRows = await fetchAll(
    "event_sources?select=event_id,qid,ko_wiki_title,en_wiki_title,description",
  );
  const eventRows = await fetchAll(
    "events?select=id,era_id,title,start_year,end_year,category,event_kind,is_battle,is_curated_visible,location_lat,location_lng,is_fog_region,modern_country,image_url,summary,external_link,created_at",
  );
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));

  logInfo("Loaded rows", {
    events: eventRows.length,
    eventSources: sourceRows.length,
  });

  const qids = [...new Set(sourceRows.map((row) => row.qid).filter(Boolean))];
  const entityMetaByQid = new Map();

  for (const part of chunk(qids, 40)) {
    const entities = await fetchWikidataEntities(part);
    for (const qid of part) {
      const entity = entities[qid];
      if (!entity || entity.missing === "") continue;
      entityMetaByQid.set(qid, extractEntityMeta(qid, entity));
    }
    await sleep(200);
  }

  const countryQids = [...new Set(
    [...entityMetaByQid.values()].map((meta) => meta.countryQid).filter(Boolean),
  )];
  const countryLabelByQid = new Map();

  for (const part of chunk(countryQids, 40)) {
    const entities = await fetchWikidataEntities(part, "labels");
    for (const qid of part) {
      const entity = entities[qid];
      if (!entity || entity.missing === "") continue;
      countryLabelByQid.set(qid, {
        ko: entity?.labels?.ko?.value ?? null,
        en: entity?.labels?.en?.value ?? null,
      });
    }
    await sleep(200);
  }

  const summaryCache = new Map();
  async function getSummary(lang, title) {
    const key = `${lang}:${title}`;
    if (summaryCache.has(key)) return summaryCache.get(key);
    const value = await fetchSummary(lang, title);
    summaryCache.set(key, value);
    await sleep(120);
    return value;
  }

  let patchedEvents = 0;
  let patchedSources = 0;
  let patchedSummary = 0;
  let patchedImage = 0;
  let patchedExternal = 0;
  let patchedCountry = 0;
  let patchedTitle = 0;

  for (const source of sourceRows) {
    const event = eventsById.get(source.event_id);
    if (!event) continue;
    const meta = entityMetaByQid.get(source.qid);
    if (!meta) continue;

    const koWikiTitle = source.ko_wiki_title || meta.koWikiTitle;
    const enWikiTitle = source.en_wiki_title || meta.enWikiTitle;

    const eventPatch = {};
    const sourcePatch = {};

    if (!source.ko_wiki_title && koWikiTitle) sourcePatch.ko_wiki_title = koWikiTitle;
    if (!source.en_wiki_title && enWikiTitle) sourcePatch.en_wiki_title = enWikiTitle;
    if (isEmptyBilingual(source.description) && (meta.descKo || meta.descEn)) {
      sourcePatch.description = buildBilingual(meta.descKo, meta.descEn);
    }

    if (Object.keys(sourcePatch).length) {
      await patchEventSource(source.event_id, sourcePatch);
      patchedSources += 1;
    }

    if (isEmptyBilingual(event.title) && (meta.labelKo || meta.labelEn)) {
      eventPatch.title = buildBilingual(meta.labelKo, meta.labelEn);
      patchedTitle += 1;
    }

    if (!event.external_link) {
      const link = buildExternalLink(koWikiTitle, enWikiTitle, source.qid);
      if (link) {
        eventPatch.external_link = link;
        patchedExternal += 1;
      }
    }

    if (isEmptyBilingual(event.modern_country) && meta.countryQid) {
      const country = countryLabelByQid.get(meta.countryQid);
      if (country && (country.ko || country.en)) {
        eventPatch.modern_country = buildBilingual(country.ko, country.en);
        patchedCountry += 1;
      }
    }

    const needSummary = isEmptyBilingual(event.summary);
    const needImage = !event.image_url;
    if (needSummary || needImage) {
      const ko = koWikiTitle ? await getSummary("ko", koWikiTitle) : null;
      const en = enWikiTitle ? await getSummary("en", enWikiTitle) : null;

      const summaryKo = ko?.summary ?? null;
      const summaryEn = en?.summary ?? null;
      const imageUrl =
        ko?.imageUrl ?? en?.imageUrl ?? buildCommonsFileUrl(meta.imageFile) ?? null;

      if (needSummary && (summaryKo || summaryEn)) {
        eventPatch.summary = buildBilingual(summaryKo, summaryEn);
        patchedSummary += 1;
      }
      if (needImage && imageUrl) {
        eventPatch.image_url = imageUrl;
        patchedImage += 1;
      }
    }

    if (Object.keys(eventPatch).length) {
      await patchEvent(source.event_id, eventPatch);
      patchedEvents += 1;
    }
  }

  logInfo("Enrichment complete", {
    patchedEvents,
    patchedSources,
    patchedTitle,
    patchedSummary,
    patchedImage,
    patchedExternal,
    patchedCountry,
  });
}

main().catch((error) => {
  logError("enrichExistingFromSources failed", { error: String(error) });
  process.exit(1);
});
