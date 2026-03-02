#!/usr/bin/env python3
"""
[mk] 나무위키 JSON 덤프 → SQLite 변환 스크립트
- 표제어(title), 분류(categories), 본문(text) 저장
- /mnt/data2/namuwiki/namuwiki_20210301.json → namuwiki.db
- 실행: python3 scripts/wikidata/buildNamuwikiSqlite.py
"""

import json
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

    print("[mk] JSON 로딩 중...")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"[mk] 총 {len(data):,}개 항목 로드 완료 ({time.time()-t0:.1f}s)")

    conn = sqlite3.connect(OUTPUT_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=100000")
    init_db(conn)
    c = conn.cursor()

    total = len(data)
    art_rows = []
    cat_rows = []
    inserted = 0
    redirect_count = 0
    cat_count = 0

    print("[mk] 데이터 처리 중...")
    for i, item in enumerate(data):
        title    = item.get("title", "").strip()
        text     = item.get("text", "")
        ns       = item.get("namespace", 0)
        redirect = extract_redirect(text)
        cats     = extract_categories(text)

        if redirect:
            redirect_count += 1

        art_rows.append((title, text, redirect, ns))
        # categories는 article_id 필요 → 배치 insert 후 처리
        cat_rows.append(cats)

        if len(art_rows) >= batch_size or i == total - 1:
            c.executemany(
                "INSERT INTO articles(title, text, redirect, namespace) VALUES(?,?,?,?)",
                art_rows
            )
            # 방금 insert된 id 범위
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
            pct = inserted / total * 100
            speed = inserted / elapsed if elapsed > 0 else 0
            eta = (total - inserted) / speed if speed > 0 else 0
            print(f"  [{pct:5.1f}%] {inserted:,}/{total:,} | 분류 {cat_count:,}개 | {speed:.0f}/s | ETA {eta:.0f}s")

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
