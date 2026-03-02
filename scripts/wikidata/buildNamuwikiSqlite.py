#!/usr/bin/env python3
"""
[mk] 나무위키 JSON 덤프 → SQLite 변환 스크립트
- 표제어(title), 분류(categories), 본문(text) 저장
- /mnt/data2/namuwiki/namuwiki_20210301.json → namuwiki.db
- 실행: python3 scripts/wikidata/buildNamuwikiSqlite.py
"""

import sqlite3
import re
import os
import sys
import time

INPUT_PATH = "/mnt/data2/namuwiki/namuwiki_20210301.json"
OUTPUT_PATH = "/mnt/data2/namuwiki/namuwiki.db"

def extract_categories(text):
    """나무위키 마크업에서 [[분류:xxx]] 추출"""
    return re.findall(r'\[\[분류:([^\]|]+)', text)

def extract_redirect(text):
    """#redirect 대상 추출"""
    m = re.match(r'^#redirect\s+(.+)$', text.strip(), re.IGNORECASE)
    return m.group(1).strip() if m else None

def init_db(conn):
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS articles (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            title    TEXT NOT NULL,
            text     TEXT,
            redirect TEXT,
            namespace INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS categories (
            article_id INTEGER NOT NULL,
            category   TEXT NOT NULL,
            FOREIGN KEY(article_id) REFERENCES articles(id)
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts
            USING fts5(title, content='articles', content_rowid='id');
        CREATE INDEX IF NOT EXISTS idx_title     ON articles(title);
        CREATE INDEX IF NOT EXISTS idx_redirect  ON articles(redirect);
        CREATE INDEX IF NOT EXISTS idx_category  ON categories(category);
        CREATE INDEX IF NOT EXISTS idx_cat_artid ON categories(article_id);
    """)
    conn.commit()

def build(batch_size=5000):
    print(f"[mk] 나무위키 SQLite 빌드 시작")
    print(f"  입력: {INPUT_PATH}")
    print(f"  출력: {OUTPUT_PATH}")

    t0 = time.time()

    import ijson

    conn = sqlite3.connect(OUTPUT_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=50000")
    init_db(conn)
    c = conn.cursor()

    art_rows = []
    cat_rows = []
    inserted = 0
    redirect_count = 0
    cat_count = 0

    print("[mk] 스트리밍 파싱 시작 (ijson)...")
    with open(INPUT_PATH, "rb") as f:
        for item in ijson.items(f, "item"):
            title    = (item.get("title") or "").strip()
            text     = item.get("text") or ""
            ns       = item.get("namespace") or 0
            redirect = extract_redirect(text)
            cats     = extract_categories(text)

            if redirect:
                redirect_count += 1

            art_rows.append((title, text, redirect, ns))
            cat_rows.append(cats)

            if len(art_rows) >= batch_size:
                c.executemany(
                    "INSERT INTO articles(title, text, redirect, namespace) VALUES(?,?,?,?)",
                    art_rows
                )
                last_id = c.lastrowid
                first_id = last_id - len(art_rows) + 1
                for j, cats in enumerate(cat_rows):
                    art_id = first_id + j
                    for cat in cats:
                        cat_count += 1
                        c.execute("INSERT INTO categories(article_id, category) VALUES(?,?)", (art_id, cat.strip()))
                conn.commit()
                inserted += len(art_rows)
                art_rows = []
                cat_rows = []
                elapsed = time.time() - t0
                speed = inserted / elapsed if elapsed > 0 else 0
                print(f"  {inserted:,}건 처리 | 분류 {cat_count:,}개 | {speed:.0f}/s | {elapsed:.0f}s 경과", flush=True)

    # 남은 배치
    if art_rows:
        c.executemany(
            "INSERT INTO articles(title, text, redirect, namespace) VALUES(?,?,?,?)",
            art_rows
        )
        last_id = c.lastrowid
        first_id = last_id - len(art_rows) + 1
        for j, cats in enumerate(cat_rows):
            art_id = first_id + j
            for cat in cats:
                cat_count += 1
                c.execute("INSERT INTO categories(article_id, category) VALUES(?,?)", (art_id, cat.strip()))
        conn.commit()
        inserted += len(art_rows)

    # FTS 인덱스 빌드
    print("[mk] FTS 인덱스 빌드 중...")
    conn.execute("INSERT INTO articles_fts(rowid, title) SELECT id, title FROM articles")
    conn.commit()

    elapsed = time.time() - t0
    print(f"\n[mk] 완료! {elapsed:.1f}s")
    print(f"  articles : {inserted:,}개")
    print(f"  redirects: {redirect_count:,}개")
    print(f"  categories: {cat_count:,}개 (연결)")

    # 분류 종류 통계
    c.execute("SELECT category, COUNT(*) as cnt FROM categories GROUP BY category ORDER BY cnt DESC LIMIT 20")
    print("\n[mk] 분류 Top 20:")
    for row in c.fetchall():
        print(f"  {row[1]:6,}개  {row[0]}")

    conn.close()

if __name__ == "__main__":
    build()
