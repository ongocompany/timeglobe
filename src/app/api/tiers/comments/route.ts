import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// [cl] 코멘트 저장 경로 (서버 파일 기반)
const COMMENTS_PATH = path.join(process.cwd(), "data/tier_review_comments.json");

// [cl] 디렉토리 없으면 생성
function ensureDir() {
  const dir = path.dirname(COMMENTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// [cl] GET: 저장된 코멘트+플래그 로드
export async function GET() {
  try {
    if (!fs.existsSync(COMMENTS_PATH)) {
      return NextResponse.json({ flagged: [], comments: {} });
    }
    const data = JSON.parse(fs.readFileSync(COMMENTS_PATH, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ flagged: [], comments: {} });
  }
}

// [cl] POST: 코멘트+플래그 저장
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // body: { flagged: number[], comments: Record<string, string> }
    ensureDir();
    fs.writeFileSync(COMMENTS_PATH, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true, saved: Object.keys(body.comments || {}).length });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
