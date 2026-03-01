import crypto from "node:crypto";

const categoryMap = {
  event: "정치/전쟁",
  person: "인물/문화",
  place: "건축/유물",
};

const EVENT_KIND_BY_CLASS_QID = {
  Q13418847: "historical_event",
  Q198: "war",
  Q178561: "battle",
  Q178706: "treaty",
  Q2380335: "disaster",
};

function read(binding, key) {
  return binding[key]?.value?.trim() || "";
}

function yearFromRaw(raw) {
  if (!raw) return null;
  const match = raw.match(/^([+-]?\d{1,6})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (Number.isNaN(year)) return null;
  return year;
}

function parseCoord(raw) {
  if (!raw) return null;
  const match = raw.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
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

function firstNonEmpty(binding, keys) {
  for (const key of keys) {
    const value = read(binding, key);
    if (value) return value;
  }
  return "";
}

function resolveCoord(binding, entityType) {
  const byPriority = {
    event: ["coord", "locationCoord", "countryCoord"],
    person: ["coord", "birthPlaceCoord", "birthCountryCoord", "countryCoord"],
    place: ["coord"],
  };

  for (const key of byPriority[entityType] ?? []) {
    const coord = parseCoord(read(binding, key));
    if (coord) return coord;
  }

  return null;
}

function resolveModernCountry(binding, entityType) {
  if (entityType === "person") {
    return buildJsonb(
      firstNonEmpty(binding, ["countryLabel_ko", "birthCountryLabel_ko"]),
      firstNonEmpty(binding, ["countryLabel_en", "birthCountryLabel_en"]),
    );
  }

  return buildJsonb(
    read(binding, "countryLabel_ko"),
    read(binding, "countryLabel_en"),
  );
}

function pickYear(binding, entityType) {
  const byPriority = {
    event: [
      yearFromRaw(read(binding, "startRaw")),
      yearFromRaw(read(binding, "pointInTimeRaw")),
      yearFromRaw(read(binding, "inceptionRaw")),
    ],
    person: [
      yearFromRaw(read(binding, "birthRaw")),
      yearFromRaw(read(binding, "deathRaw")),
      yearFromRaw(read(binding, "floruitStartRaw")),
      yearFromRaw(read(binding, "floruitEndRaw")),
    ],
    place: [
      yearFromRaw(read(binding, "inceptionRaw")),
      yearFromRaw(read(binding, "pointInTimeRaw")),
    ],
  };
  return byPriority[entityType]?.find((year) => typeof year === "number") ?? null;
}

function pickEndYear(binding, entityType) {
  const byPriority = {
    event: [yearFromRaw(read(binding, "endRaw"))],
    person: [yearFromRaw(read(binding, "deathRaw"))],
    place: [null],
  };
  return byPriority[entityType]?.find((year) => typeof year === "number") ?? null;
}

function buildJsonb(ko, en) {
  return {
    ko: ko || en || "",
    en: en || ko || "",
  };
}

function deterministicUuid(input) {
  const hash = crypto.createHash("sha1").update(input).digest("hex").slice(0, 32);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

function buildExternalLink(koTitle, enTitle, qid) {
  if (koTitle) {
    return `https://ko.wikipedia.org/wiki/${encodeURIComponent(koTitle)}`;
  }
  if (enTitle) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`;
  }
  if (qid) {
    return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
  }
  return "";
}

function resolveEventKind(binding, entityType) {
  if (entityType === "person") return "person";
  if (entityType === "place") return "place";
  if (entityType !== "event") return "historical_event";
  const classQid = read(binding, "classQid");
  return EVENT_KIND_BY_CLASS_QID[classQid] ?? "historical_event";
}

export function normalizeBinding(binding, entityType) {
  const qid = read(binding, "qid");
  if (!qid) return null;

  const titleKo = read(binding, "itemLabel_ko");
  const titleEn = read(binding, "itemLabel_en");
  const titleFallback = read(binding, "itemLabel_fallback");
  if (!titleKo && !titleEn && !titleFallback) return null;

  const year = pickYear(binding, entityType);
  if (year === null) return null;

  // [cl] event는 좌표 없어도 허용 (AI Geocoder가 나중에 채움)
  // person/place는 fallback 체인 포함 좌표를 확보해야 적재
  const coord = resolveCoord(binding, entityType);
  if (!coord && entityType !== "event") return null;

  const endYear = pickEndYear(binding, entityType);
  const koTitle = read(binding, "koWikiTitle");
  const enTitle = read(binding, "enWikiTitle");
  const eventKind = resolveEventKind(binding, entityType);

  const eventRecord = {
    id: deterministicUuid(`wd:${qid}`),
    title: buildJsonb(titleKo || titleFallback, titleEn || titleFallback),
    start_year: year,
    end_year: endYear,
    category: categoryMap[entityType] ?? "인물/문화",
    location_lat: coord?.lat ?? null,
    location_lng: coord?.lng ?? null,
    is_fog_region: false,
    modern_country: resolveModernCountry(binding, entityType),
    image_url: null,
    summary: null,
    external_link: buildExternalLink(koTitle, enTitle, qid) || null,
    event_kind: eventKind,
    is_battle: eventKind === "battle",
  };

  const sourceMeta = {
    event_id: eventRecord.id,
    qid,
    entity_type: entityType,
    class_qid: read(binding, "classQid") || null,
    event_kind: eventKind,
    ko_wiki_title: koTitle || null,
    en_wiki_title: enTitle || null,
    description: buildJsonb(read(binding, "itemDesc_ko"), read(binding, "itemDesc_en")),
    updated_at: new Date().toISOString(),
  };

  return { eventRecord, sourceMeta };
}
