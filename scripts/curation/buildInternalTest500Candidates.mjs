#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PERSONS_FILE = path.join(ROOT, "public/data/persons_cards.json");
const EVENTS_FILE = path.join(ROOT, "data/dump_samples/events_raw.jsonl");
const PLACES_FILE = path.join(ROOT, "data/dump_samples/places_sample.jsonl");
const OUTPUT_DIR = path.join(ROOT, "data/curation/quiz_candidates");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "internal_test_500_candidates.json");

const CURATED_SEEDS = [
  path.join(ROOT, "data/curation/quiz_batches/internal_test_batch_01.json"),
  path.join(ROOT, "data/curation/quiz_batches/internal_test_batch_02.json"),
  path.join(ROOT, "data/curation/quiz_batches/internal_test_batch_03.json"),
];

const TARGET_COUNTS = {
  person: 90,
  polity: 180,
  place: 120,
  battle_disaster: 110,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function toRegionString(parts) {
  return parts.map((value) => `${value}`).filter(Boolean).join(", ");
}

function personPriority(card) {
  const category = card.category || "";
  const region = card.historical_region?.ko || "";
  let score = 0;
  if (category === "정치/전쟁") score += 40;
  else if (category === "과학/발명") score += 35;
  else if (category === "건축/유물") score += 25;
  else if (category === "인물/문화") score += 15;

  if (/조선|대한민국|한국/.test(region)) score += 18;
  else if (/중국|일본|아테네|알렉산드리아|이집트|몽골|말리|인도|아프리카/.test(region)) score += 10;

  if (card.image_url) score += 5;
  if (card.summary?.ko) score += Math.min(10, Math.floor(card.summary.ko.length / 80));
  if (typeof card.start_year === "number") score += 5;
  return score;
}

function eventPriority(row) {
  const kind = row.event_kind || "";
  const sitelinks = Number(row.sitelinks || 0);
  let score = sitelinks;
  if (kind === "event") score += 30;
  if (["battle", "disaster", "siege", "treaty"].includes(kind)) score += 20;
  if (row.direct_coord) score += 15;
  if (row.name_ko) score += 5;
  return score;
}

function placePriority(row) {
  const sitelinks = Number(row.sitelinks || 0);
  let score = sitelinks;
  if (row.direct_coord) score += 20;
  if (typeof row.inception === "number") score += 10;
  if (row.name_ko) score += 5;
  return score;
}

function buildPersonCandidate(card) {
  const title = card.title?.ko || card.title?.en;
  return {
    answer_entity_id: card.id,
    canonical_answer: title,
    entity_type: "person",
    candidate_bucket: "person",
    anchor_year: card.start_year,
    present_day_region: toRegionString([
      card.historical_region?.ko,
      card.modern_country?.ko,
    ]),
    short_context:
      card.description?.ko?.slice(0, 120) ||
      card.summary?.ko?.slice(0, 120) ||
      card.category,
    priority_source: "auto",
    source_file: "public/data/persons_cards.json",
  };
}

function buildEventCandidate(row, bucket) {
  const title = row.name_ko || row.name_en;
  return {
    answer_entity_id: row.qid,
    canonical_answer: title,
    entity_type: "event",
    candidate_bucket: bucket,
    anchor_year: row.anchor_year,
    present_day_region: row.direct_coord
      ? `lat ${row.direct_coord[0]}, lng ${row.direct_coord[1]}`
      : (row.name_ko || row.name_en),
    short_context:
      row.desc_ko?.slice(0, 120) ||
      row.desc_en?.slice(0, 120) ||
      `${row.event_kind || "event"} with strong historical anchor`,
    priority_source: "auto",
    source_file: "data/dump_samples/events_raw.jsonl",
  };
}

function buildPlaceCandidate(row) {
  const title = row.name_ko || row.name_en;
  return {
    answer_entity_id: row.qid,
    canonical_answer: title,
    entity_type: "place",
    candidate_bucket: "place",
    anchor_year: row.inception ?? null,
    present_day_region: title,
    short_context:
      row.desc_ko?.slice(0, 120) ||
      row.desc_en?.slice(0, 120) ||
      "historically important city or place",
    priority_source: "auto",
    source_file: "data/dump_samples/places_sample.jsonl",
  };
}

function dedupePush(target, item, seen) {
  const key = item.answer_entity_id || item.canonical_answer;
  if (!key || seen.has(key)) return false;
  seen.add(key);
  target.push(item);
  return true;
}

function main() {
  ensureDir(OUTPUT_DIR);

  const candidates = [];
  const seen = new Set();

  for (const seedFile of CURATED_SEEDS) {
    const seedItems = readJson(seedFile);
    for (const item of seedItems) {
      dedupePush(
        candidates,
        {
          answer_entity_id: item.canonical_answer,
          canonical_answer: item.canonical_answer,
          entity_type: item.entity_type,
          candidate_bucket: item.entity_type === "person" ? "person" : item.entity_type === "place" ? "place" : "seed_event",
          anchor_year: item.anchor_year,
          present_day_region: item.present_day_region,
          short_context: item.short_context,
          priority_source: "curated_seed",
          source_file: path.relative(ROOT, seedFile),
        },
        seen
      );
    }
  }

  const personCards = readJson(PERSONS_FILE)
    .filter(
      (card) =>
        card.start_year !== null &&
        card.location_lat !== null &&
        (card.summary?.ko || card.description?.ko)
    )
    .sort((a, b) => personPriority(b) - personPriority(a));

  for (const card of personCards) {
    if (candidates.filter((x) => x.candidate_bucket === "person").length >= TARGET_COUNTS.person) break;
    dedupePush(candidates, buildPersonCandidate(card), seen);
  }

  const eventRows = readJsonLines(EVENTS_FILE);

  const polityRows = eventRows
    .filter(
      (row) =>
        row.type === "event" &&
        row.event_kind === "event" &&
        row.anchor_year !== null &&
        row.direct_coord &&
        Number(row.sitelinks || 0) >= 60
    )
    .sort((a, b) => eventPriority(b) - eventPriority(a));

  for (const row of polityRows) {
    if (candidates.filter((x) => x.candidate_bucket === "polity").length >= TARGET_COUNTS.polity) break;
    dedupePush(candidates, buildEventCandidate(row, "polity"), seen);
  }

  const battleRows = eventRows
    .filter(
      (row) =>
        row.type === "event" &&
        ["battle", "disaster", "siege", "treaty", "pandemic"].includes(row.event_kind) &&
        row.anchor_year !== null &&
        row.direct_coord &&
        Number(row.sitelinks || 0) >= 45
    )
    .sort((a, b) => eventPriority(b) - eventPriority(a));

  for (const row of battleRows) {
    if (
      candidates.filter((x) => x.candidate_bucket === "battle_disaster").length >=
      TARGET_COUNTS.battle_disaster
    )
      break;
    dedupePush(candidates, buildEventCandidate(row, "battle_disaster"), seen);
  }

  const placeRows = readJsonLines(PLACES_FILE)
    .filter((row) => row.type === "place" && row.direct_coord && Number(row.sitelinks || 0) >= 80)
    .sort((a, b) => placePriority(b) - placePriority(a));

  for (const row of placeRows) {
    if (candidates.filter((x) => x.candidate_bucket === "place").length >= TARGET_COUNTS.place) break;
    dedupePush(candidates, buildPlaceCandidate(row), seen);
  }

  const relaxedPolityRows = eventRows
    .filter(
      (row) =>
        row.type === "event" &&
        ["event", "revolution"].includes(row.event_kind) &&
        row.anchor_year !== null &&
        Number(row.sitelinks || 0) >= 25
    )
    .sort((a, b) => eventPriority(b) - eventPriority(a));

  for (const row of relaxedPolityRows) {
    if (candidates.length >= 500) break;
    dedupePush(candidates, buildEventCandidate(row, "polity"), seen);
  }

  const relaxedBattleRows = eventRows
    .filter(
      (row) =>
        row.type === "event" &&
        ["battle", "war", "disaster", "pandemic", "siege", "treaty", "military_operation", "expedition", "genocide", "terrorist_attack"].includes(row.event_kind) &&
        row.anchor_year !== null &&
        Number(row.sitelinks || 0) >= 20
    )
    .sort((a, b) => eventPriority(b) - eventPriority(a));

  for (const row of relaxedBattleRows) {
    if (candidates.length >= 500) break;
    dedupePush(candidates, buildEventCandidate(row, "battle_disaster"), seen);
  }

  const finalCandidates = candidates.slice(0, 500).map((item, index) => ({
    queue_index: index,
    ...item,
  }));

  const summary = finalCandidates.reduce((acc, item) => {
    acc[item.candidate_bucket] = (acc[item.candidate_bucket] || 0) + 1;
    return acc;
  }, {});

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ summary, candidates: finalCandidates }, null, 2));
  console.log(JSON.stringify({ output: OUTPUT_FILE, total: finalCandidates.length, summary }, null, 2));
}

main();
