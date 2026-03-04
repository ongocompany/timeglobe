#!/usr/bin/env node
/**
 * [cl] 수동 폴리곤 전면 재구축 + 인덱스 정리
 * 1. basemaps에서 올바른 폴리곤 추출 (매칭 버그 수정)
 * 2. 역사지리 기반 수동 폴리곤 생성
 * 3. ohm_index.json 중복/겹침 정리
 */

const fs = require('fs');
const path = require('path');

const BASEMAPS_DIR = path.join(__dirname, '../public/geo/borders/_backup_hb');
const OHM_DIR = path.join(__dirname, '../public/geo/borders/ohm');
const INDEX_PATH = path.join(__dirname, '../public/geo/borders/ohm_index.json');

let nextRid = 9100501;
const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
const results = [];

// ============================================================
// 유틸리티
// ============================================================

function countPts(geom) {
  let c = 0;
  function t(a) { if (typeof a[0] === 'number') { c++; return; } for (const i of a) t(i); }
  t(geom.coordinates); return c;
}

function findFeature(geojson, searchName) {
  const lower = searchName.toLowerCase();
  // 정확 매칭 우선
  let match = geojson.features.find(f => {
    const name = (f.properties.NAME || '').toLowerCase();
    return name === lower;
  });
  if (match) return match;
  // 부분 매칭 (빈 이름 제외)
  return geojson.features.find(f => {
    const name = (f.properties.NAME || '').toLowerCase();
    if (!name || name.length < 2) return false;
    return name.includes(lower) || (name.length >= 3 && lower.includes(name));
  });
}

function findFeatureByExact(geojson, exactNames) {
  // 여러 이름 중 하나라도 정확히 매칭
  for (const en of exactNames) {
    const match = geojson.features.find(f => (f.properties.NAME || '') === en);
    if (match) return match;
  }
  return null;
}

function writeBasemapsOhm(rid, feat, meta) {
  const outFile = `ohm_${rid}.geojson`;
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature',
    properties: { ohm_id: `basemaps_${rid}`, name: feat.properties.NAME || meta.name_en,
      name_en: meta.name_en, name_ko: meta.name_ko,
      start_date: String(meta.start_date), end_date: String(meta.end_date),
      wikidata: meta.qid, admin_level: '2', source: 'historical-basemaps',
      source_year: meta.source_year,
      our_name_en: meta.name_en, our_name_ko: meta.name_ko, our_tier: meta.tier },
    geometry: feat.geometry }] };
  fs.writeFileSync(path.join(OHM_DIR, outFile), JSON.stringify(gj));
  return { rid, pts: countPts(feat.geometry), file: outFile };
}

function writeManualOhm(rid, coords, meta, geoType = 'Polygon') {
  const outFile = `ohm_${rid}.geojson`;
  const geometry = geoType === 'MultiPolygon'
    ? { type: 'MultiPolygon', coordinates: coords }
    : { type: 'Polygon', coordinates: [coords] };
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature',
    properties: { ohm_id: `manual_${rid}`, name: meta.name_en,
      name_en: meta.name_en, name_ko: meta.name_ko,
      start_date: String(meta.start_date), end_date: String(meta.end_date),
      wikidata: meta.qid, admin_level: '2', source: 'manual_cl_improved',
      our_name_en: meta.name_en, our_name_ko: meta.name_ko, our_tier: meta.tier,
      border_precision: 2 },
    geometry }] };
  fs.writeFileSync(path.join(OHM_DIR, outFile), JSON.stringify(gj));
  const ptCount = geoType === 'MultiPolygon' ? coords.flat(Infinity).length / 2 : coords.length;
  return { rid, pts: ptCount, file: outFile };
}

function updateEntity(qid, newSnapshots, opts = {}) {
  let ei = idx.findIndex(e => e.qid === qid);
  if (ei < 0) ei = idx.findIndex(e => e.qid === `MANUAL_${qid}`);

  if (ei >= 0) {
    const entity = idx[ei];
    // 기존 9000xxx + 이전 잘못된 9100500+ 스냅샷 제거
    entity.snapshots = entity.snapshots.filter(s =>
      !(s.rid >= 9000000 && s.rid < 9100000) && !(s.rid >= 9100500)
    );
    entity.snapshots.push(...newSnapshots);
    entity.snapshots.sort((a, b) => a.start - b.start);
    if (opts.tier) entity.tier = opts.tier;
    console.log(`  ✅ ${entity.name_ko} (${qid}): ${newSnapshots.length}개 스냅샷`);
    return true;
  }
  console.log(`  ⚠️ ${qid} 인덱스 없음`);
  return false;
}

function addEntity(data, snapshots) {
  // 기존 엔티티 있으면 업데이트, 없으면 추가
  const ei = idx.findIndex(e => e.qid === data.qid);
  if (ei >= 0) {
    idx[ei].snapshots = snapshots;
    idx[ei].snapshots.sort((a, b) => a.start - b.start);
    console.log(`  ✅ ${data.name_ko} (${data.qid}): 업데이트`);
  } else {
    idx.push({ ...data, snapshots });
    console.log(`  ✅ ${data.name_ko} (${data.qid}): 신규 추가`);
  }
}

function loadBasemaps(file) {
  return JSON.parse(fs.readFileSync(path.join(BASEMAPS_DIR, file), 'utf-8'));
}

// ============================================================
// STEP 1: BASEMAPS 추출
// ============================================================
console.log('\n========== STEP 1: BASEMAPS 추출 ==========');

// 고조선
console.log('\n--- 고조선 ---');
{
  const gj = loadBasemaps('world_bc400.geojson');
  const feat = findFeatureByExact(gj, ['Gojoseon']);
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Gojoseon', name_ko:'고조선', qid:'Q28405', tier:1, start_date:'-2332', end_date:'-0107', source_year:'bc400' });
    updateEntity('Q28405', [{ rid: r.rid, start: -2332, end: -107, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

// 고대 이집트 — 고왕국(Q177819)과 중복 해결: 고왕국이 OHM 고퀄이면 고대이집트 스냅샷은 고왕국 시기(-2686~-2181) 제외
console.log('\n--- 고대 이집트 (고왕국 중복 제외) ---');
{
  const snaps = [];
  // -3100~-2686 (고왕국 이전)
  {
    const gj = loadBasemaps('world_bc3000.geojson');
    const feat = findFeatureByExact(gj, ['Egypt']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Ancient Egypt', name_ko:'고대 이집트', qid:'Q11768', tier:1, start_date:'-3100', end_date:'-2686', source_year:'bc3000' }); snaps.push({ rid: r.rid, start: -3100, end: -2686, file: r.file }); console.log(`    pre-Old Kingdom: ${r.pts}pts`); }
  }
  // -2181~-1000 (고왕국 이후 ~ 신왕국)
  {
    const gj = loadBasemaps('world_bc1500.geojson');
    const feat = findFeatureByExact(gj, ['Egypt']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Ancient Egypt', name_ko:'고대 이집트', qid:'Q11768', tier:1, start_date:'-2181', end_date:'-1000', source_year:'bc1500' }); snaps.push({ rid: r.rid, start: -2181, end: -1000, file: r.file }); console.log(`    post-Old Kingdom: ${r.pts}pts`); }
  }
  // -1000~-30 (후기)
  {
    const gj = loadBasemaps('world_bc700.geojson');
    const feat = findFeatureByExact(gj, ['Egypt']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Ancient Egypt', name_ko:'고대 이집트', qid:'Q11768', tier:1, start_date:'-1000', end_date:'-0030', source_year:'bc700' }); snaps.push({ rid: r.rid, start: -1000, end: -30, file: r.file }); console.log(`    late period: ${r.pts}pts`); }
  }
  updateEntity('Q11768', snaps);
}

// 마케도니아 — bc200에서만 가능
console.log('\n--- 마케도니아 ---');
{
  const gj = loadBasemaps('world_bc200.geojson');
  const feat = gj.features.find(f => (f.properties.NAME || '').includes('Macedon'));
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Ancient Macedonia', name_ko:'마케도니아 왕국', qid:'Q83958', tier:1, start_date:'-0808', end_date:'-0168', source_year:'bc200' });
    updateEntity('Q83958', [{ rid: r.rid, start: -808, end: -168, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

// 동프랑크
console.log('\n--- 동프랑크 ---');
{
  const gj = loadBasemaps('world_900.geojson');
  const feat = findFeatureByExact(gj, ['East Francia']);
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'East Francia', name_ko:'동프랑크 왕국', qid:'Q153080', tier:2, start_date:'0843', end_date:'0962', source_year:'900' });
    updateEntity('Q153080', [{ rid: r.rid, start: 843, end: 962, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

// 피렌체
console.log('\n--- 피렌체 ---');
{
  const gj = loadBasemaps('world_1530.geojson');
  const feat = findFeatureByExact(gj, ['Florence']);
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Republic of Florence', name_ko:'피렌체 공화국', qid:'Q148540', tier:2, start_date:'1115', end_date:'1532', source_year:'1530' });
    updateEntity('Q148540', [{ rid: r.rid, start: 1115, end: 1532, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

// 올멕
console.log('\n--- 올멕 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_bc1500.geojson','bc1500',-1500,-1000],['world_bc1000.geojson','bc1000',-1000,-400]]) {
    const gj = loadBasemaps(file);
    const feat = findFeatureByExact(gj, ['Olmec']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Olmec civilization', name_ko:'올멕 문명', qid:'Q135364', tier:1, start_date:String(s), end_date:String(e), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q135364', snaps);
}

// 아케메네스
console.log('\n--- 아케메네스 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_bc500.geojson','bc500',-550,-400],['world_bc400.geojson','bc400',-400,-330]]) {
    const gj = loadBasemaps(file);
    const feat = gj.features.find(f => (f.properties.NAME || '').includes('Achaemenid'));
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Achaemenid Empire', name_ko:'아케메네스 왕조', qid:'Q389688', tier:1, start_date:String(s), end_date:String(e), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q389688', snaps);
}

// 프랑스령 인도차이나 — tier를 2로 올림 (국경+라벨 가시성)
console.log('\n--- 프랑스령 인도차이나 (tier 2로 승격) ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_1900.geojson','1900',1887,1914],['world_1914.geojson','1914',1914,1954]]) {
    const gj = loadBasemaps(file);
    const feat = findFeatureByExact(gj, ['French Indochina']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'French Indochina', name_ko:'프랑스령 인도차이나', qid:'Q185682', tier:2, start_date:String(s), end_date:String(e), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q185682', snaps, { tier: 2 });
}

// 무라비트 (Q75613)
console.log('\n--- 무라비트 ---');
{
  const gj = loadBasemaps('world_1100.geojson');
  const feat = gj.features.find(f => (f.properties.NAME || '').includes('Almoravid'));
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Almoravid dynasty', name_ko:'무라비트 왕조', qid:'Q75613', tier:1, start_date:'1040', end_date:'1147', source_year:'1100' });
    addEntity({ qid:'Q75613', name_en:'Almoravid dynasty', name_ko:'무라비트 왕조', tier:1, start_year:1040, end_year:1147 },
      [{ rid: r.rid, start: 1040, end: 1147, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

// 돌궐
console.log('\n--- 돌궐 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_600.geojson','600',552,650],['world_700.geojson','700',650,745]]) {
    const gj = loadBasemaps(file);
    const feat = gj.features.find(f => (f.properties.NAME || '').includes('ktürk'));
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Gokturks', name_ko:'돌궐', qid:'Q205466', tier:2, start_date:String(s).padStart(4,'0'), end_date:String(e).padStart(4,'0'), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q205466', snaps);
}

// 웨식스
console.log('\n--- 웨식스 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_800.geojson','800',519,800],['world_900.geojson','900',800,927]]) {
    const gj = loadBasemaps(file);
    const feat = findFeatureByExact(gj, ['Wessex']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Kingdom of Wessex', name_ko:'웨식스 왕국', qid:'Q105313', tier:2, start_date:String(s).padStart(4,'0'), end_date:String(e).padStart(4,'0'), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q105313', snaps);
}

// 신나라 (Han 재활용)
console.log('\n--- 신나라 ---');
{
  const gj = loadBasemaps('world_bc1.geojson');
  const feat = gj.features.find(f => (f.properties.NAME || '').startsWith('Han'));
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Xin dynasty', name_ko:'신나라', qid:'Q129864', tier:2, start_date:'0009', end_date:'0023', source_year:'bc1' });
    updateEntity('Q129864', [{ rid: r.rid, start: 9, end: 23, file: r.file }]);
    console.log(`    ${r.pts}pts (Han polygon reused)`);
  }
}

// 아시리아
console.log('\n--- 아시리아 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_bc1500.geojson','bc1500',-2500,-1000],['world_bc1000.geojson','bc1000',-1000,-700],['world_bc700.geojson','bc700',-700,-609]]) {
    const gj = loadBasemaps(file);
    const feat = findFeatureByExact(gj, ['Assyria']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Assyrian Empire', name_ko:'아시리아', qid:'Q41137', tier:1, start_date:String(s), end_date:String(e), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q41137', snaps);
}

// 유연
console.log('\n--- 유연 ---');
{
  const snaps = [];
  for (const [file, sy, s, e] of [['world_400.geojson','400',330,450],['world_500.geojson','500',450,555]]) {
    const gj = loadBasemaps(file);
    const feat = findFeatureByExact(gj, ['Ruanruan']);
    if (feat) { const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Rouran Khaganate', name_ko:'유연', qid:'Q155361', tier:2, start_date:String(s).padStart(4,'0'), end_date:String(e).padStart(4,'0'), source_year:sy }); snaps.push({ rid: r.rid, start: s, end: e, file: r.file }); console.log(`    ${file}: ${r.pts}pts`); }
  }
  updateEntity('Q155361', snaps);
}

// 진나라
console.log('\n--- 진나라 ---');
{
  const gj = loadBasemaps('world_bc300.geojson');
  const feat = findFeatureByExact(gj, ['Qin']);
  if (feat) {
    const r = writeBasemapsOhm(nextRid++, feat, { name_en:'Qin dynasty', name_ko:'진나라', qid:'Q7183', tier:2, start_date:'-0221', end_date:'-0206', source_year:'bc300' });
    updateEntity('Q7183', [{ rid: r.rid, start: -221, end: -206, file: r.file }]);
    console.log(`    ${r.pts}pts`);
  }
}

console.log('\nSTEP 1 완료. 다음 rid:', nextRid);

// ============================================================
// STEP 2: 수동 개선 폴리곤 (improveManualPolygons.js의 내용)
// ============================================================
console.log('\n========== STEP 2: 수동 개선 ==========');

// 동녕국 (대만 해안선)
console.log('\n--- 동녕국 ---');
{
  const taiwan = [[121.52,25.28],[121.58,25.20],[121.74,25.13],[121.83,25.02],[121.87,24.83],[121.75,24.48],[121.60,24.10],[121.52,23.98],[121.42,23.75],[121.30,23.50],[121.15,23.20],[121.03,22.95],[120.90,22.72],[120.85,22.52],[120.77,21.92],[120.58,22.30],[120.38,22.52],[120.30,22.62],[120.25,22.75],[120.22,22.95],[120.20,23.15],[120.18,23.35],[120.22,23.55],[120.32,23.75],[120.42,24.00],[120.52,24.18],[120.62,24.35],[120.78,24.58],[120.92,24.78],[121.05,24.95],[121.28,25.02],[121.42,25.12],[121.52,25.28]];
  const penghu = [[119.48,23.72],[119.65,23.68],[119.72,23.55],[119.63,23.45],[119.50,23.42],[119.42,23.52],[119.42,23.65],[119.48,23.72]];
  const r = writeManualOhm(nextRid++, [[taiwan],[penghu]], { name_en:'Kingdom of Tungning', name_ko:'동녕국', qid:'Q152855', tier:2, start_date:'1661', end_date:'1683' }, 'MultiPolygon');
  updateEntity('Q152855', [{ rid: r.rid, start: 1661, end: 1683, file: r.file }]);
}

// 금나라
console.log('\n--- 금나라 ---');
{
  const jinEarly = [[108.0,40.0],[110.5,41.0],[114.0,43.0],[117.0,45.0],[120.0,47.0],[123.0,48.5],[126.0,49.5],[128.5,50.0],[131.0,49.0],[133.0,47.5],[134.0,45.0],[131.5,43.0],[129.0,41.5],[127.0,39.0],[126.0,37.0],[124.0,35.5],[121.0,36.5],[119.0,36.0],[117.0,35.5],[115.0,35.0],[112.0,35.5],[110.0,37.0],[108.0,40.0]];
  const jinPeak = [[105.5,37.0],[106.5,38.5],[108.0,40.0],[110.5,41.5],[111.5,43.0],[114.0,44.5],[117.0,46.0],[120.0,47.5],[122.0,48.5],[124.0,49.0],[126.0,50.0],[128.0,50.5],[130.0,49.5],[132.0,48.5],[133.5,47.0],[134.0,45.0],[131.5,43.0],[129.5,42.0],[128.5,40.5],[127.5,39.5],[126.5,38.5],[126.0,37.5],[124.0,36.5],[121.5,35.5],[120.5,34.5],[119.5,34.0],[118.5,33.5],[117.0,33.0],[115.5,32.5],[114.0,32.8],[112.5,33.0],[110.5,34.0],[108.5,35.0],[106.5,35.5],[105.5,37.0]];
  const r1 = writeManualOhm(nextRid++, jinEarly, { name_en:'Jin dynasty', name_ko:'금나라', qid:'Q4970', tier:1, start_date:'1115', end_date:'1141' });
  const r2 = writeManualOhm(nextRid++, jinPeak, { name_en:'Jin dynasty', name_ko:'금나라', qid:'Q4970', tier:1, start_date:'1141', end_date:'1234' });
  updateEntity('Q4970', [
    { rid: r1.rid, start: 1115, end: 1141, file: r1.file },
    { rid: r2.rid, start: 1141, end: 1234, file: r2.file },
  ]);
}

// 연나라
console.log('\n--- 연 ---');
{
  const yan = [[114.8,40.5],[115.5,41.5],[117.0,42.0],[118.5,41.5],[120.0,41.0],[121.5,41.0],[123.0,41.5],[124.5,41.5],[125.5,41.0],[125.0,40.0],[123.5,39.5],[121.5,39.0],[121.0,39.5],[121.5,40.0],[120.5,40.0],[119.5,39.5],[118.5,39.0],[117.5,39.0],[117.0,38.5],[115.5,39.0],[114.5,39.5],[114.8,40.5]];
  const r = writeManualOhm(nextRid++, yan, { name_en:'Yan (state)', name_ko:'연(燕)나라', qid:'Q230547', tier:2, start_date:'-1030', end_date:'-0222' });
  updateEntity('Q230547', [{ rid: r.rid, start: -1030, end: -222, file: r.file }]);
}

// 선비
console.log('\n--- 선비 ---');
{
  const xianbei = [[87.0,47.0],[90.0,49.5],[93.0,50.5],[96.0,51.0],[100.0,51.5],[104.0,52.0],[108.0,52.5],[112.0,51.5],[116.0,50.5],[120.0,49.0],[123.0,48.0],[126.0,46.0],[128.0,44.5],[129.0,43.0],[127.0,42.0],[125.0,41.5],[123.0,41.0],[120.0,40.5],[117.0,41.0],[114.0,41.5],[112.0,41.0],[110.0,41.5],[108.0,42.0],[105.0,43.0],[100.0,44.0],[96.0,45.0],[93.0,46.0],[90.0,46.5],[87.0,47.0]];
  const r = writeManualOhm(nextRid++, xianbei, { name_en:'Xianbei', name_ko:'선비', qid:'Q131748', tier:1, start_date:'0093', end_date:'0234' });
  updateEntity('Q131748', [{ rid: r.rid, start: 93, end: 234, file: r.file }]);
}

// 부여
console.log('\n--- 부여 ---');
{
  const buyeo = [[123.5,46.0],[124.0,47.0],[125.0,48.0],[126.5,48.5],[128.0,48.0],[129.5,47.0],[130.0,45.5],[129.0,44.0],[128.5,43.0],[127.5,42.5],[126.0,42.0],[124.5,42.5],[123.5,43.5],[123.0,45.0],[123.5,46.0]];
  const r = writeManualOhm(nextRid++, buyeo, { name_en:'Buyeo kingdom', name_ko:'부여', qid:'Q487879', tier:2, start_date:'-0200', end_date:'0494' });
  updateEntity('Q487879', [{ rid: r.rid, start: -200, end: 494, file: r.file }]);
}

// 제
console.log('\n--- 제 ---');
{
  const qi = [[115.5,36.0],[115.8,37.0],[117.0,37.5],[118.5,37.8],[119.5,37.5],[120.0,37.8],[120.8,37.5],[121.2,37.3],[121.8,37.0],[122.2,37.3],[122.4,37.0],[122.0,36.5],[121.0,36.2],[120.3,36.0],[119.5,35.5],[118.5,35.0],[117.5,34.8],[116.5,35.0],[115.5,35.5],[115.5,36.0]];
  const r = writeManualOhm(nextRid++, qi, { name_en:'Qi (state)', name_ko:'제', qid:'Q837855', tier:2, start_date:'-1046', end_date:'-0221' });
  updateEntity('Q837855', [{ rid: r.rid, start: -1046, end: -221, file: r.file }]);
}

// 초
console.log('\n--- 초 ---');
{
  const chu = [[107.5,33.5],[108.5,34.0],[110.0,34.0],[112.0,34.0],[113.5,34.0],[115.0,34.5],[116.5,34.0],[117.5,34.5],[118.5,33.5],[119.0,33.0],[120.0,32.0],[121.0,31.5],[121.5,30.5],[121.0,29.5],[120.5,28.5],[119.5,27.5],[118.0,27.0],[116.5,26.5],[114.5,26.0],[112.5,26.0],[110.5,26.5],[109.0,27.5],[108.0,28.5],[107.0,29.5],[107.5,31.0],[107.5,33.5]];
  const r = writeManualOhm(nextRid++, chu, { name_en:'Chu (state)', name_ko:'초', qid:'Q504759', tier:1, start_date:'-1030', end_date:'-0223' });
  updateEntity('Q504759', [{ rid: r.rid, start: -1030, end: -223, file: r.file }]);
}

// 대리국
console.log('\n--- 대리국 ---');
{
  const dali = [[97.5,25.0],[97.8,26.5],[98.0,28.0],[98.5,28.5],[100.0,28.5],[101.5,28.0],[102.5,27.5],[104.0,27.0],[104.5,26.0],[104.5,24.5],[104.0,23.5],[103.0,22.5],[102.0,22.0],[100.5,21.5],[99.0,22.0],[98.5,23.0],[97.5,24.0],[97.5,25.0]];
  const r = writeManualOhm(nextRid++, dali, { name_en:'Dali Kingdom', name_ko:'대리국', qid:'Q26472', tier:2, start_date:'0937', end_date:'1253' });
  updateEntity('Q26472', [{ rid: r.rid, start: 937, end: 1253, file: r.file }]);
}

// 고촉
console.log('\n--- 고촉 ---');
{
  const shu = [[103.0,31.5],[103.5,32.5],[104.5,33.0],[105.5,33.0],[106.5,32.5],[107.0,31.5],[107.5,30.5],[107.0,29.5],[106.0,29.0],[104.5,28.5],[103.5,29.0],[103.0,29.5],[102.5,30.5],[103.0,31.5]];
  const r = writeManualOhm(nextRid++, shu, { name_en:'Shu (ancient state)', name_ko:'고촉', qid:'Q1193806', tier:2, start_date:'-0316', end_date:'-0280' });
  updateEntity('Q1193806', [{ rid: r.rid, start: -316, end: -280, file: r.file }]);
}

// 하왕조
console.log('\n--- 하왕조 ---');
{
  const xia = [[110.5,35.0],[111.0,36.0],[111.5,36.5],[112.5,36.0],[113.5,36.0],[114.0,35.5],[114.5,35.0],[114.0,34.5],[113.5,34.0],[112.5,34.0],[112.0,34.5],[111.0,34.5],[110.0,34.0],[110.0,34.5],[110.5,35.0]];
  const r = writeManualOhm(nextRid++, xia, { name_en:'Xia dynasty', name_ko:'하 왕조', qid:'Q35765', tier:1, start_date:'-2070', end_date:'-1600' });
  updateEntity('Q35765', [{ rid: r.rid, start: -2070, end: -1600, file: r.file }]);
}

// 위만조선
console.log('\n--- 위만조선 ---');
{
  const wiman = [[122.5,40.5],[123.5,41.0],[124.5,41.0],[125.0,40.5],[126.0,40.0],[126.5,39.5],[127.0,39.0],[127.0,38.5],[126.5,38.0],[125.5,37.5],[124.0,38.0],[123.0,39.0],[122.0,40.0],[122.5,40.5]];
  const r = writeManualOhm(nextRid++, wiman, { name_en:'Wiman Joseon', name_ko:'위만조선', qid:'Q703340', tier:2, start_date:'-0194', end_date:'-0107' });
  updateEntity('Q703340', [{ rid: r.rid, start: -194, end: -107, file: r.file }]);
}

// ============================================================
// STEP 3: 인덱스 정리 — 중복/겹침 해결
// ============================================================
console.log('\n========== STEP 3: 인덱스 정리 ==========');

// 3-1. 동주(Q215765) 폴리곤 제거 — 개별 전국시대 국가로 대체됨
console.log('\n--- 동주 폴리곤 제거 (전국시대 개별국가로 대체) ---');
{
  const ei = idx.findIndex(e => e.qid === 'Q215765');
  if (ei >= 0) {
    const old = idx[ei].snapshots.length;
    idx[ei].snapshots = idx[ei].snapshots.filter(s => s.rid < 9100000); // OHM 원본만 유지
    console.log(`  동주: ${old} → ${idx[ei].snapshots.length} 스냅샷 (9100xxx 제거)`);
  }
}

// 3-2. 청나라 1644-1689 스냅샷 → 1683-1689로 조정 (동녕국 기간 제외는 어렵지만, 끝기간을 분할)
// 실제로는 OHM 원본 데이터(rid=2694501)의 파일을 수정할 수 없으니,
// 동녕국 시기(1661-1683)에는 청나라 스냅샷의 시작을 1683으로 바꾸고,
// 1644-1661은 별도 스냅샷으로 분리
console.log('\n--- 청나라-동녕국 시간 분리 ---');
{
  const ei = idx.findIndex(e => e.qid === 'Q8733');
  if (ei >= 0) {
    const snap = idx[ei].snapshots.find(s => s.rid === 2694501);
    if (snap) {
      console.log(`  기존: rid=2694501 [${snap.start}~${snap.end}]`);
      // 1644-1661 (동녕국 이전) + 1683-1689 (동녕국 이후)로 분할
      // 같은 파일을 두 번 참조 (렌더링은 targetYear 기반이니 문제 없음)
      snap.start = 1644;
      snap.end = 1661; // 동녕국 건국 이전까지만
      // 1683 이후 스냅샷 추가 (같은 파일)
      idx[ei].snapshots.push({ rid: 2694501, start: 1683, end: 1689, file: snap.file });
      idx[ei].snapshots.sort((a, b) => a.start - b.start);
      console.log(`  수정: [1644~1661] + [1683~1689]`);
    }
  }
}

// ============================================================
// 저장
// ============================================================
fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2));

console.log('\n\n========== 최종 결과 ==========');
console.log('총 엔티티:', idx.length);
const totalSnaps = idx.reduce((s, e) => s + (e.snapshots ? e.snapshots.length : 0), 0);
console.log('총 스냅샷:', totalSnaps);
console.log('rid 범위: 9100501 ~', nextRid - 1);

// 9000xxx 잔여 확인
const remaining = idx.filter(e => e.snapshots && e.snapshots.some(s => s.rid >= 9000000 && s.rid < 9100000));
console.log('9000xxx 잔여:', remaining.length, remaining.map(e => e.name_ko).join(', '));
