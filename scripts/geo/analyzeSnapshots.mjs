import fs from "node:fs";

const files = [
  { year: -3000, file: "world_bc3000.geojson" },
  { year: -500, file: "world_bc500.geojson" },
  { year: 100, file: "world_100.geojson" },
  { year: 1000, file: "world_1000.geojson" },
  { year: 1492, file: "world_1492.geojson" },
  { year: 1815, file: "world_1815.geojson" },
  { year: 1880, file: "world_1880.geojson" },
  { year: 1914, file: "world_1914.geojson" },
  { year: 1945, file: "world_1945.geojson" },
  { year: 2010, file: "world_2010.geojson" },
];

for (const { year, file } of files) {
  const fpath = "public/geo/borders/" + file;
  if (!fs.existsSync(fpath)) { console.log(year, "MISSING"); continue; }
  const data = JSON.parse(fs.readFileSync(fpath, "utf-8"));
  const precisions = {};
  let hasName = 0;
  let noName = 0;
  for (const f of data.features) {
    const bp = f.properties?.BORDERPRECISION || "none";
    precisions[bp] = (precisions[bp] || 0) + 1;
    if (f.properties?.NAME) hasName++;
    else noName++;
  }
  console.log(`${year}: ${data.features.length} features | named:${hasName} unnamed:${noName} | precision:${JSON.stringify(precisions)}`);
}
