#!/usr/bin/env node
/**
 * [cl] Basemaps 폴리곤 추출 스크립트
 * historical-basemaps world_*.geojson에서 특정 엔티티 폴리곤을 추출하여
 * OHM 포맷 GeoJSON으로 변환
 */

const fs = require('fs');
const path = require('path');

const BASEMAPS_DIR = path.join(__dirname, '../public/geo/borders/_backup_hb');
const OHM_DIR = path.join(__dirname, '../public/geo/borders/ohm');
const INDEX_PATH = path.join(__dirname, '../public/geo/borders/ohm_index.json');

// rid 시작 번호
let nextRid = 9100501;

// ============================================================
// 1단계: basemaps에서 좋은 품질로 추출 가능한 10개
// ============================================================
const EXTRACT_TARGETS = [
  // --- 저품질 → 교체 (basemaps 품질 좋은 것들) ---
  {
    qid: 'Q28405', name_en: 'Gojoseon', name_ko: '고조선', tier: 1,
    old_rid: 9000008,
    searches: [
      { file: 'world_bc400.geojson', name: 'Gojoseon', start: -2332, end: -107, start_date: '-2332', end_date: '-0107' },
    ]
  },
  {
    qid: 'Q11768', name_en: 'Ancient Egypt', name_ko: '고대 이집트', tier: 1,
    old_rid: 9000053,
    searches: [
      { file: 'world_bc3000.geojson', name: 'Egypt', start: -3100, end: -2000, start_date: '-3100', end_date: '-2000' },
      { file: 'world_bc2000.geojson', name: 'Egypt', start: -2000, end: -1500, start_date: '-2000', end_date: '-1500' },
      { file: 'world_bc1500.geojson', name: 'Egypt', start: -1500, end: -1000, start_date: '-1500', end_date: '-1000' },
      { file: 'world_bc1000.geojson', name: 'Egypt', start: -1000, end: -700, start_date: '-1000', end_date: '-0700' },
      { file: 'world_bc700.geojson', name: 'Egypt', start: -700, end: -30, start_date: '-0700', end_date: '-0030' },
    ]
  },
  {
    qid: 'Q83958', name_en: 'Ancient Macedonia', name_ko: '마케도니아 왕국', tier: 1,
    old_rid: 9000067,
    searches: [
      { file: 'world_bc323.geojson', name: 'Macedon', start: -808, end: -310, start_date: '-0808', end_date: '-0310' },
      { file: 'world_bc200.geojson', name: 'Macedon', start: -310, end: -168, start_date: '-0310', end_date: '-0168' },
    ]
  },
  {
    qid: 'Q153080', name_en: 'East Francia', name_ko: '동프랑크 왕국', tier: 2,
    old_rid: 9000083,
    searches: [
      { file: 'world_900.geojson', name: 'East Francia', start: 843, end: 962, start_date: '0843', end_date: '0962' },
    ]
  },
  {
    qid: 'Q148540', name_en: 'Republic of Florence', name_ko: '피렌체 공화국', tier: 2,
    old_rid: 9000089,
    searches: [
      { file: 'world_1530.geojson', name: 'Florence', start: 1115, end: 1532, start_date: '1115', end_date: '1532' },
    ]
  },
  {
    qid: 'Q135364', name_en: 'Olmec civilization', name_ko: '올멕 문명', tier: 1,
    old_rid: 9000104,
    searches: [
      { file: 'world_bc1500.geojson', name: 'Olmec', start: -1500, end: -1000, start_date: '-1500', end_date: '-1000' },
      { file: 'world_bc1000.geojson', name: 'Olmec', start: -1000, end: -400, start_date: '-1000', end_date: '-0400' },
    ]
  },
  // --- 중품질 → 교체 (basemaps 품질 훨씬 좋은 것들) ---
  {
    qid: 'Q389688', name_en: 'Achaemenid Empire', name_ko: '아케메네스 왕조', tier: 1,
    old_rid: 9000055,
    searches: [
      { file: 'world_bc500.geojson', name: 'Achaemenid', start: -550, end: -400, start_date: '-0550', end_date: '-0400' },
      { file: 'world_bc400.geojson', name: 'Achaemenid', start: -400, end: -330, start_date: '-0400', end_date: '-0330' },
    ]
  },
  {
    qid: 'Q185682', name_en: 'French Indochina', name_ko: '프랑스령 인도차이나', tier: 1,
    old_rid: 9000050,
    searches: [
      { file: 'world_1900.geojson', name: 'French Indochina', start: 1887, end: 1914, start_date: '1887', end_date: '1914' },
      { file: 'world_1914.geojson', name: 'French Indochina', start: 1914, end: 1954, start_date: '1914', end_date: '1954' },
    ]
  },
  {
    qid: 'Q107091', name_en: 'Almoravid dynasty', name_ko: '무라비트 왕조', tier: 1,
    old_rid: 9000098,
    searches: [
      { file: 'world_1100.geojson', name: 'Almoravid', start: 1040, end: 1147, start_date: '1040', end_date: '1147' },
    ]
  },
  {
    qid: 'Q205466', name_en: 'Gokturks', name_ko: '돌궐', tier: 2,
    old_rid: 9000023,
    searches: [
      { file: 'world_600.geojson', name: 'Gökturk', start: 552, end: 650, start_date: '0552', end_date: '0650' },
      { file: 'world_700.geojson', name: 'Gökturk', start: 650, end: 745, start_date: '0650', end_date: '0745' },
    ]
  },
];

// ============================================================
// 유틸리티
// ============================================================

function countPoints(geometry) {
  let count = 0;
  function traverse(arr) {
    if (typeof arr[0] === 'number') { count++; return; }
    for (const item of arr) traverse(item);
  }
  traverse(geometry.coordinates);
  return count;
}

function findFeature(geojson, searchName) {
  // 부분 매칭 (대소문자 무시) — 빈 이름 제외!
  const lower = searchName.toLowerCase();
  return geojson.features.find(f => {
    const name = (f.properties.NAME || f.properties.name || '').toLowerCase();
    if (!name || name.length < 2) return false; // 빈 이름/짧은 이름 제외
    return name.includes(lower) || (lower.includes(name) && name.length >= 3);
  });
}

// ============================================================
// 메인 실행
// ============================================================

function main() {
  console.log('=== Basemaps 폴리곤 추출 시작 ===\n');
  
  // ohm_index 로드
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  
  const results = [];
  const indexUpdates = []; // { qid, old_rid, new_snapshots }
  
  for (const target of EXTRACT_TARGETS) {
    console.log(`\n--- ${target.name_ko} (${target.name_en}) [${target.qid}] ---`);
    
    const newSnapshots = [];
    
    for (const search of target.searches) {
      const filePath = path.join(BASEMAPS_DIR, search.file);
      if (!fs.existsSync(filePath)) {
        console.log(`  ❌ 파일 없음: ${search.file}`);
        continue;
      }
      
      const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const feature = findFeature(geojson, search.name);
      
      if (!feature) {
        // 이름 목록 출력
        const names = geojson.features.map(f => f.properties.NAME || f.properties.name).filter(Boolean);
        console.log(`  ❌ "${search.name}" 못 찾음 in ${search.file}`);
        // 유사한 이름 찾기
        const similar = names.filter(n => n.toLowerCase().includes(search.name.substring(0, 3).toLowerCase()));
        if (similar.length > 0) console.log(`     유사: ${similar.join(', ')}`);
        continue;
      }
      
      const pts = countPoints(feature.geometry);
      const rid = nextRid++;
      const outFilename = `ohm_${rid}.geojson`;
      
      // OHM 포맷 GeoJSON 생성
      const ohmFeature = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            ohm_id: `basemaps_${rid}`,
            name: feature.properties.NAME || target.name_en,
            name_en: target.name_en,
            name_ko: target.name_ko,
            start_date: search.start_date,
            end_date: search.end_date,
            wikidata: target.qid,
            admin_level: '2',
            source: 'historical-basemaps',
            source_year: search.file.replace('world_', '').replace('.geojson', ''),
            our_name_en: target.name_en,
            our_name_ko: target.name_ko,
            our_tier: target.tier,
          },
          geometry: feature.geometry,
        }]
      };
      
      // 파일 쓰기
      const outPath = path.join(OHM_DIR, outFilename);
      fs.writeFileSync(outPath, JSON.stringify(ohmFeature));
      
      newSnapshots.push({
        rid,
        start: search.start,
        end: search.end,
        file: outFilename,
      });
      
      console.log(`  ✅ ${search.file} → ${outFilename} (${pts}pts, ${search.start}~${search.end})`);
    }
    
    if (newSnapshots.length > 0) {
      indexUpdates.push({
        qid: target.qid,
        old_rid: target.old_rid,
        name_en: target.name_en,
        name_ko: target.name_ko,
        tier: target.tier,
        newSnapshots,
      });
      
      results.push({
        entity: target.name_ko,
        qid: target.qid,
        snapshots: newSnapshots.length,
        rids: newSnapshots.map(s => s.rid),
      });
    }
  }
  
  // ============================================================
  // ohm_index.json 업데이트
  // ============================================================
  console.log('\n\n=== ohm_index.json 업데이트 ===\n');
  
  for (const update of indexUpdates) {
    // 기존 엔티티 찾기
    const entityIdx = index.findIndex(e => e.qid === update.qid);
    
    if (entityIdx >= 0) {
      const entity = index[entityIdx];
      // 기존 9000xxx 스냅샷 제거
      const oldSnapshots = entity.snapshots.filter(s => s.rid >= 9000000 && s.rid < 9100000);
      const keptSnapshots = entity.snapshots.filter(s => !(s.rid >= 9000000 && s.rid < 9100000));
      
      // 새 스냅샷 추가
      entity.snapshots = [...keptSnapshots, ...update.newSnapshots];
      // 시간순 정렬
      entity.snapshots.sort((a, b) => a.start - b.start);
      
      console.log(`  ✅ ${update.name_ko}: 9000xxx ${oldSnapshots.length}개 제거, 9100xxx ${update.newSnapshots.length}개 추가`);
    } else {
      console.log(`  ⚠️ ${update.name_ko} (${update.qid}) 인덱스에 없음 — 기존 엔티티 검색...`);
      // MANUAL_ prefix로도 찾아보기
      const manualIdx = index.findIndex(e => e.qid === `MANUAL_${update.qid}` || e.qid.includes(update.qid));
      if (manualIdx >= 0) {
        const entity = index[manualIdx];
        const oldSnapshots = entity.snapshots.filter(s => s.rid >= 9000000 && s.rid < 9100000);
        const keptSnapshots = entity.snapshots.filter(s => !(s.rid >= 9000000 && s.rid < 9100000));
        entity.snapshots = [...keptSnapshots, ...update.newSnapshots];
        entity.snapshots.sort((a, b) => a.start - b.start);
        console.log(`  ✅ ${update.name_ko} (MANUAL prefix): ${oldSnapshots.length}개 제거, ${update.newSnapshots.length}개 추가`);
      } else {
        console.log(`  ❌ ${update.name_ko} (${update.qid}) 인덱스에서 완전히 못 찾음`);
      }
    }
  }
  
  // 인덱스 저장
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`\n  💾 ohm_index.json 저장 완료 (${index.length} entities)`);
  
  // ============================================================
  // 결과 요약
  // ============================================================
  console.log('\n\n=== 결과 요약 ===');
  console.log(`총 ${results.length}개 엔티티, ${results.reduce((s, r) => s + r.snapshots, 0)}개 스냅샷 생성`);
  console.log(`rid 범위: 9100501 ~ ${nextRid - 1}`);
  console.log('\n엔티티별:');
  for (const r of results) {
    console.log(`  ${r.entity} (${r.qid}): ${r.snapshots}개 스냅샷 [${r.rids.join(', ')}]`);
  }
}

main();
