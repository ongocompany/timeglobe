import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RAW_PATH = path.join(
  process.cwd(),
  "public/geo/borders/wikidata_entities_raw.json"
);

// [cl] GET: raw 데이터 로드 (CSHAPES 제외 — 폴리곤 데이터 소스일 뿐)
export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));
    const filtered = data.filter(
      (e: any) => !String(e.qid || "").startsWith("CSHAPES")
    );
    return NextResponse.json(filtered);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load data" },
      { status: 500 }
    );
  }
}

// [cl] POST: tier/region 변경사항 저장
export async function POST(req: Request) {
  try {
    const updates: { qid?: string; name_en: string; tier: number; region: string }[] =
      await req.json();

    const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));

    let updated = 0;
    for (const u of updates) {
      const entity = raw.find(
        (e: any) =>
          (u.qid && e.qid === u.qid) || e.name_en === u.name_en
      );
      if (entity) {
        entity.tier = u.tier;
        entity.region = u.region;
        updated++;
      }
    }

    fs.writeFileSync(RAW_PATH, JSON.stringify(raw, null, 2), "utf-8");

    return NextResponse.json({ updated, total: raw.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}
