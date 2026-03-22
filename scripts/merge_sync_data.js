#!/usr/bin/env node
/**
 * jinserver_sync/ 데이터를 프로덕션 카드에 병합
 * [cl] 민철 — 2026-03-22
 */
const fs = require('fs');
const path = require('path');

const SYNC_DIR = path.join(__dirname, '..', 'public', 'data', 'jinserver_sync');
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

function getEraId(year) {
  if (year <= -3000) return 'era-prehistoric';
  if (year <= -500) return 'era-ancient';
  if (year <= 500) return 'era-classical';
  if (year <= 1500) return 'era-medieval';
  if (year <= 1800) return 'era-early-modern';
  if (year <= 1945) return 'era-modern';
  return 'era-contemporary';
}

function loadJsonFiles(dir, prefix) {
  const files = fs.readdirSync(dir).filter(f =>
    f.startsWith(prefix) && f.endsWith('.json')
  );
  let all = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (Array.isArray(data)) {
        all = all.concat(data);
        console.log(`  ${f}: ${data.length}개`);
      }
    } catch (e) {
      console.error(`  SKIP ${f}: ${e.message}`);
    }
  }
  return all;
}

// ===== PERSONS 병합 =====
function mergePersons() {
  console.log('\n=== PERSONS 병합 ===');
  const prod = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'persons_cards.json'), 'utf8'));
  console.log(`기존: ${prod.length}개`);

  const newData = loadJsonFiles(SYNC_DIR, 'persons_');
  console.log(`신규 후보: ${newData.length}개`);

  const existingIds = new Set(prod.map(p => p.id));
  const existingTitles = new Set(prod.map(p =>
    typeof p.title === 'object' ? p.title.ko : p.title
  ));

  let added = 0, skipped = 0;
  for (const p of newData) {
    const titleKo = typeof p.title === 'object' ? p.title.ko : p.title;
    if (existingIds.has(p.id) || existingTitles.has(titleKo)) { skipped++; continue; }

    prod.push({
      id: p.id,
      era_id: p.era_id || getEraId(p.start_year),
      title: typeof p.title === 'object' ? p.title : { ko: p.title, en: '' },
      start_year: p.start_year,
      end_year: p.end_year,
      category: p.category || '인물/기타',
      location_lat: p.location_lat || 0,
      location_lng: p.location_lng || 0,
      is_fog_region: p.is_fog_region ?? false,
      historical_region: p.historical_region || { ko: '', en: '' },
      modern_country: p.modern_country || { ko: '', en: '' },
      image_url: p.image_url || '',
      summary: typeof p.summary === 'object' ? p.summary : { ko: p.summary || '', en: '' },
      description: typeof p.description === 'object' ? p.description : { ko: p.description || '', en: '' },
      external_link: p.external_link || '',
    });
    existingIds.add(p.id);
    existingTitles.add(titleKo);
    added++;
  }

  console.log(`추가: ${added}, 중복스킵: ${skipped}, 최종: ${prod.length}개`);
  fs.writeFileSync(path.join(DATA_DIR, 'persons_cards.json'), JSON.stringify(prod, null, 2), 'utf8');
  return { added, skipped, total: prod.length };
}

// ===== EVENTS 병합 =====
function mergeEvents() {
  console.log('\n=== EVENTS 병합 ===');
  const prod = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events_cards.json'), 'utf8'));
  console.log(`기존: ${prod.length}개`);

  const newData = loadJsonFiles(SYNC_DIR, 'events_');
  console.log(`신규 후보: ${newData.length}개`);

  const existingTitles = new Set(prod.map(e =>
    typeof e.title === 'object' ? e.title.ko : e.title
  ));

  let added = 0, skipped = 0, idCounter = prod.length + 1;
  for (const e of newData) {
    const titleKo = e.name_ko || (typeof e.title === 'object' ? e.title?.ko : e.title) || '';
    if (!titleKo || existingTitles.has(titleKo)) { skipped++; continue; }

    const year = e.year ?? e.start_year;
    const region = e.region || '';

    prod.push({
      id: e.id || `EVT_SYNC_${String(idCounter++).padStart(5, '0')}`,
      era_id: e.era_id || getEraId(year),
      title: { ko: e.name_ko || '', en: e.name_en || '' },
      start_year: year,
      end_year: e.end_year || year,
      category: e.category || '정치/사건',
      location_lat: e.lat ?? e.location_lat ?? 0,
      location_lng: e.lng ?? e.location_lng ?? 0,
      is_fog_region: false,
      historical_region: { ko: region, en: region },
      modern_country: { ko: region, en: region },
      image_url: '',
      summary: { ko: e.summary_ko || '', en: e.summary_en || '' },
      description: { ko: e.summary_ko || '', en: e.summary_en || '' },
      external_link: '',
    });
    existingTitles.add(titleKo);
    added++;
  }

  console.log(`추가: ${added}, 중복스킵: ${skipped}, 최종: ${prod.length}개`);
  fs.writeFileSync(path.join(DATA_DIR, 'events_cards.json'), JSON.stringify(prod, null, 2), 'utf8');
  return { added, skipped, total: prod.length };
}

// ===== 실행 =====
console.log('TimeGlobe 데이터 병합 시작...');
const p = mergePersons();
const e = mergeEvents();
console.log('\n=== 완료 ===');
console.log(`persons: +${p.added} → 총 ${p.total}개`);
console.log(`events:  +${e.added} → 총 ${e.total}개`);
