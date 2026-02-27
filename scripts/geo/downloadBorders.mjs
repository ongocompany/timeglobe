#!/usr/bin/env node

// [cl] 역사적 국경선 GeoJSON 다운로드 스크립트
// aourednik/historical-basemaps GitHub 레포에서 53개 스냅샷 다운로드
// 사용법: node scripts/geo/downloadBorders.mjs

import fs from "node:fs";
import path from "node:path";

const BASE_URL =
  "https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson";

// [cl] 연도순 정렬된 스냅샷 목록 (BC = 음수)
const SNAPSHOTS = [
  { year: -123000, file: "world_bc123000.geojson" },
  { year: -10000, file: "world_bc10000.geojson" },
  { year: -8000, file: "world_bc8000.geojson" },
  { year: -5000, file: "world_bc5000.geojson" },
  { year: -4000, file: "world_bc4000.geojson" },
  { year: -3000, file: "world_bc3000.geojson" },
  { year: -2000, file: "world_bc2000.geojson" },
  { year: -1500, file: "world_bc1500.geojson" },
  { year: -1000, file: "world_bc1000.geojson" },
  { year: -700, file: "world_bc700.geojson" },
  { year: -500, file: "world_bc500.geojson" },
  { year: -400, file: "world_bc400.geojson" },
  { year: -323, file: "world_bc323.geojson" },
  { year: -300, file: "world_bc300.geojson" },
  { year: -200, file: "world_bc200.geojson" },
  { year: -100, file: "world_bc100.geojson" },
  { year: -1, file: "world_bc1.geojson" },
  { year: 100, file: "world_100.geojson" },
  { year: 200, file: "world_200.geojson" },
  { year: 300, file: "world_300.geojson" },
  { year: 400, file: "world_400.geojson" },
  { year: 500, file: "world_500.geojson" },
  { year: 600, file: "world_600.geojson" },
  { year: 700, file: "world_700.geojson" },
  { year: 800, file: "world_800.geojson" },
  { year: 900, file: "world_900.geojson" },
  { year: 1000, file: "world_1000.geojson" },
  { year: 1100, file: "world_1100.geojson" },
  { year: 1200, file: "world_1200.geojson" },
  { year: 1279, file: "world_1279.geojson" },
  { year: 1300, file: "world_1300.geojson" },
  { year: 1400, file: "world_1400.geojson" },
  { year: 1492, file: "world_1492.geojson" },
  { year: 1500, file: "world_1500.geojson" },
  { year: 1530, file: "world_1530.geojson" },
  { year: 1600, file: "world_1600.geojson" },
  { year: 1650, file: "world_1650.geojson" },
  { year: 1700, file: "world_1700.geojson" },
  { year: 1715, file: "world_1715.geojson" },
  { year: 1783, file: "world_1783.geojson" },
  { year: 1800, file: "world_1800.geojson" },
  { year: 1815, file: "world_1815.geojson" },
  { year: 1880, file: "world_1880.geojson" },
  { year: 1900, file: "world_1900.geojson" },
  { year: 1914, file: "world_1914.geojson" },
  { year: 1920, file: "world_1920.geojson" },
  { year: 1930, file: "world_1930.geojson" },
  { year: 1938, file: "world_1938.geojson" },
  { year: 1945, file: "world_1945.geojson" },
  { year: 1960, file: "world_1960.geojson" },
  { year: 1994, file: "world_1994.geojson" },
  { year: 2000, file: "world_2000.geojson" },
  { year: 2010, file: "world_2010.geojson" },
];

const OUTPUT_DIR = path.join(process.cwd(), "public", "geo", "borders");

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const snap of SNAPSHOTS) {
    const outPath = path.join(OUTPUT_DIR, snap.file);

    if (fs.existsSync(outPath)) {
      skipped++;
      continue;
    }

    const url = `${BASE_URL}/${snap.file}`;
    process.stdout.write(`  [${snap.year}] ${snap.file}...`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(` FAIL (${res.status})`);
        failed++;
        continue;
      }
      const text = await res.text();
      fs.writeFileSync(outPath, text);
      const sizeKB = Math.round(text.length / 1024);
      console.log(` OK (${sizeKB}KB)`);
      downloaded++;
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
      failed++;
    }

    // [cl] rate limit 방지
    await new Promise((r) => setTimeout(r, 150));
  }

  // [cl] 인덱스 파일 생성
  const index = SNAPSHOTS.map((s) => ({ year: s.year, file: s.file }));
  const indexPath = path.join(OUTPUT_DIR, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index));
  console.log(`\n  index.json 생성 완료 (${index.length}개 항목)`);

  console.log(
    `\n완료: 다운로드 ${downloaded} | 스킵 ${skipped} | 실패 ${failed}`,
  );
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
