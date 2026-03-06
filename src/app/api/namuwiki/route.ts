/**
 * [mk] 나무위키 SQLite API
 * GET /api/namuwiki?q=검색어&page=0&limit=50         → 표제어 검색
 * GET /api/namuwiki?title=정확한제목&mode=article    → 본문 조회
 */

import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = "/mnt/data2/namuwiki/namuwiki.db";

function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

// 나무위키 마크업 → 간단한 HTML 변환 [mk]
function markupToHtml(text: string): string {
  if (!text) return "";
  let html = text;

  // redirect
  if (/^#redirect\s+/i.test(html.trim())) {
    const target = html.trim().replace(/^#redirect\s+/i, "").trim();
    return `<p class="redirect">→ <a href="?title=${encodeURIComponent(target)}&mode=article">${target}</a> 로 이동</p>`;
  }

  // 분류 태그 제거 (하단에 따로 표시)
  html = html.replace(/\[\[분류:[^\]]+\]\]\n?/g, "");

  // 헤딩 (== h2 ==, === h3 ===)
  html = html.replace(/^======\s*(.+?)\s*======$/gm, "<h6>$1</h6>");
  html = html.replace(/^=====\s*(.+?)\s*=====$/gm, "<h5>$1</h5>");
  html = html.replace(/^====\s*(.+?)\s*====$/gm, "<h4>$1</h4>");
  html = html.replace(/^===\s*(.+?)\s*===$/gm, "<h3>$1</h3>");
  html = html.replace(/^==\s*(.+?)\s*==$/gm, "<h2>$1</h2>");

  // 굵게, 기울임
  html = html.replace(/'''(.+?)'''/g, "<strong>$1</strong>");
  html = html.replace(/''(.+?)''/g, "<em>$1</em>");

  // 링크 [[표제어|표시]]  [[표제어]]
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) =>
    `<a href="?title=${encodeURIComponent(target)}&mode=article" class="wiki-link">${label}</a>`
  );
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, target) =>
    `<a href="?title=${encodeURIComponent(target)}&mode=article" class="wiki-link">${target}</a>`
  );

  // [목차] 제거
  html = html.replace(/\[목차\]\n?/g, "");

  // 파일/이미지 태그 제거
  html = html.replace(/\[\[파일:[^\]]+\]\]/g, "");

  // include 틀 표시
  html = html.replace(/\[include\(([^)]+)\)\]/g, '<span class="include-tpl">[틀: $1]</span>');

  // 유튜브 embed 제거
  html = html.replace(/\[YouTube\([^)]+\)\]/g, "");

  // 각주 [* 내용] → <sup>
  html = html.replace(/\[\*\s*([^\]]+)\]/g, '<sup class="footnote">[$1]</sup>');

  // {{{+N 텍스트}}} (글자 크기)
  html = html.replace(/\{\{\{[+\-]\d\s*(.+?)\}\}\}/g, "$1");

  // {{{ 텍스트 }}} (코드/노포맷)
  html = html.replace(/\{\{\{([\s\S]+?)\}\}\}/g, "<code>$1</code>");

  // 줄바꿈 → <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

// [mk] FTS5 특수문자 이스케이프 — 검색어에 FTS 구문이 섞이면 에러남
function sanitizeFtsQuery(q: string): string {
  // FTS5 메타 문자 제거 (", *, ^, :, OR, AND, NOT, NEAR, 괄호 등)
  return q.replace(/["""*^():]/g, " ").replace(/\b(OR|AND|NOT|NEAR)\b/gi, "").trim();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode     = searchParams.get("mode") || "search";
  const q        = searchParams.get("q") || "";
  const title    = searchParams.get("title") || "";
  const page     = parseInt(searchParams.get("page") || "0");
  const limit    = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset   = page * limit;

  let db;
  try {
    db = getDb();
  } catch (e) {
    return NextResponse.json({ error: "DB not ready. SQLite 빌드 완료 후 사용 가능합니다." }, { status: 503 });
  }

  try {
    // === 본문 조회 ===
    if (mode === "article" && title) {
      const row = db.prepare(
        "SELECT id, title, text, redirect, namespace FROM articles WHERE title = ? LIMIT 1"
      ).get(title) as any;

      if (!row) {
        // 대소문자 무시 재시도
        const row2 = db.prepare(
          "SELECT id, title, text, redirect, namespace FROM articles WHERE title LIKE ? LIMIT 1"
        ).get(title) as any;
        if (!row2) return NextResponse.json({ error: "문서 없음" }, { status: 404 });
        const cats = (db.prepare("SELECT category FROM categories WHERE article_id = ?").all(row2.id) as any[]).map(r => r.category);
        return NextResponse.json({ ...row2, html: markupToHtml(row2.text), categories: cats });
      }

      const cats = (db.prepare("SELECT category FROM categories WHERE article_id = ?").all(row.id) as any[]).map(r => r.category);
      return NextResponse.json({ ...row, html: markupToHtml(row.text), categories: cats });
    }

    // === 표제어 검색 (기본) [mk] ===
    let rows: any[] = [];
    let total = 0;

    if (q) {
      const cleaned = sanitizeFtsQuery(q);
      let useFts = cleaned.length > 0;

      if (useFts) {
        try {
          // FTS5 prefix 검색
          const ftsQ = cleaned + "*";
          total = (db.prepare(
            "SELECT COUNT(*) as cnt FROM articles_fts WHERE title MATCH ?"
          ).get(ftsQ) as any)?.cnt || 0;
          rows = db.prepare(`
            SELECT a.id, a.title, a.redirect
            FROM articles_fts f JOIN articles a ON f.rowid = a.id
            WHERE f.title MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
          `).all(ftsQ, limit, offset) as any[];
        } catch {
          // FTS 실패 시 LIKE fallback
          useFts = false;
          total = 0;
          rows = [];
        }
      }

      // FTS 결과 없거나 실패 → LIKE fallback
      if (!useFts || (total === 0 && rows.length === 0)) {
        total = (db.prepare(
          "SELECT COUNT(*) as cnt FROM articles WHERE title LIKE ?"
        ).get(`%${q}%`) as any).cnt;
        rows = db.prepare(
          "SELECT id, title, redirect FROM articles WHERE title LIKE ? ORDER BY length(title) LIMIT ? OFFSET ?"
        ).all(`%${q}%`, limit, offset) as any[];
      }
    } else {
      total = (db.prepare("SELECT COUNT(*) as cnt FROM articles").get() as any).cnt;
      rows = db.prepare(
        "SELECT id, title, redirect FROM articles ORDER BY title LIMIT ? OFFSET ?"
      ).all(limit, offset) as any[];
    }

    return NextResponse.json({ total, page, limit, items: rows });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    db.close();
  }
}
