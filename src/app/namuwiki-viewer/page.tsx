"use client";
/**
 * [mk] 나무위키 뷰어 페이지
 * - 표제어 검색 + 목록
 * - 본문 뷰어 (마크업 → HTML 렌더링)
 * URL: /namuwiki-viewer
 */

import { useState, useEffect, useCallback } from "react";

type Article = { id: number; title: string; redirect?: string };
type ArticleDetail = Article & { text: string; html: string; namespace: number; categories: string[] };

type Tab = "search" | "article";

export default function NamuwikiViewer() {
  const [tab, setTab]               = useState<Tab>("search");
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<Article[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(false);
  const [article, setArticle]       = useState<ArticleDetail | null>(null);
  const [dbReady, setDbReady]       = useState(true);
  const [error, setError]           = useState("");

  const LIMIT = 50;

  // 검색
  const search = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/namuwiki?q=${encodeURIComponent(q)}&page=${p}&limit=${LIMIT}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        if (data.error.includes("not ready")) { setDbReady(false); }
        setError(data.error);
      } else {
        setResults(data.items || []);
        setTotal(data.total || 0);
        setPage(p);
      }
    } finally { setLoading(false); }
  }, []);

  // 본문 조회
  const openArticle = useCallback(async (title: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/namuwiki?title=${encodeURIComponent(title)}&mode=article`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setArticle(data);
      setTab("article");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { search("", 0); }, [search]);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto", padding: 20, background: "#0f0f0f", minHeight: "100vh", color: "#e0e0e0" }}>
      <h1 style={{ borderBottom: "2px solid #444", paddingBottom: 10, color: "#f5c542" }}>
        📖 나무위키 뷰어 <span style={{ fontSize: 14, color: "#888", fontWeight: "normal" }}>2021-03 덤프</span>
      </h1>

      {!dbReady && (
        <div style={{ background: "#3a1a00", border: "1px solid #f5a623", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          ⚠️ SQLite DB가 아직 빌드 중입니다. 완료 후 새로고침하세요.<br />
          <code style={{ fontSize: 12 }}>python3 scripts/wikidata/buildNamuwikiSqlite.py</code>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setTab("search"); search(query, 0); }}
          style={{ padding: "8px 18px", background: tab === "search" ? "#f5c542" : "#2a2a2a", color: tab === "search" ? "#000" : "#ccc", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: tab === "search" ? "bold" : "normal" }}>
          🔍 표제어 검색
        </button>
        {article && (
          <button onClick={() => setTab("article")}
            style={{ padding: "8px 18px", background: tab === "article" ? "#f5c542" : "#2a2a2a", color: tab === "article" ? "#000" : "#ccc", border: "none", borderRadius: 6, cursor: "pointer" }}>
            📄 {article.title.slice(0, 20)}{article.title.length > 20 ? "…" : ""}
          </button>
        )}
      </div>

      {error && <div style={{ color: "#ff6b6b", marginBottom: 12 }}>오류: {error}</div>}
      {loading && <div style={{ color: "#888", marginBottom: 8 }}>로딩 중...</div>}

      {/* === 검색 탭 === */}
      {tab === "search" && (
        <div style={{ display: "flex", gap: 16 }}>
          {/* 검색창 + 목록 */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search(query, 0)}
                placeholder="표제어 검색..."
                style={{ flex: 1, padding: "8px 12px", background: "#1e1e1e", border: "1px solid #444", borderRadius: 6, color: "#e0e0e0", fontSize: 14 }}
              />
              <button onClick={() => search(query, 0)}
                style={{ padding: "8px 16px", background: "#f5c542", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
                검색
              </button>
            </div>

            <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
              총 {total.toLocaleString()}개 {query && `"${query}" 검색 결과`}
            </div>

            <div style={{ background: "#1a1a1a", borderRadius: 8, overflow: "hidden" }}>
              {results.map((r, i) => (
                <div key={r.id} onClick={() => openArticle(r.title)}
                  style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a2a", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: i % 2 === 0 ? "#1a1a1a" : "#1e1e1e" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#1a1a1a" : "#1e1e1e")}>
                  <span style={{ color: r.redirect ? "#888" : "#e0e0e0" }}>{r.title}</span>
                  {r.redirect && <span style={{ fontSize: 11, color: "#666" }}>→ {r.redirect}</span>}
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
              <button onClick={() => search(query, page - 1)} disabled={page === 0}
                style={{ padding: "6px 12px", background: "#2a2a2a", color: page === 0 ? "#555" : "#e0e0e0", border: "none", borderRadius: 4, cursor: page === 0 ? "default" : "pointer" }}>
                ◀ 이전
              </button>
              <span style={{ padding: "6px 12px", color: "#888", fontSize: 13 }}>
                {page + 1} / {Math.ceil(total / LIMIT)} 페이지
              </span>
              <button onClick={() => search(query, page + 1)} disabled={(page + 1) * LIMIT >= total}
                style={{ padding: "6px 12px", background: "#2a2a2a", color: (page + 1) * LIMIT >= total ? "#555" : "#e0e0e0", border: "none", borderRadius: 4, cursor: (page + 1) * LIMIT >= total ? "default" : "pointer" }}>
                다음 ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 본문 탭 === */}
      {tab === "article" && article && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => setTab("search")}
              style={{ padding: "6px 12px", background: "#2a2a2a", color: "#e0e0e0", border: "none", borderRadius: 4, cursor: "pointer" }}>
              ← 목록
            </button>
            <h2 style={{ margin: 0, color: "#f5c542" }}>{article.title}</h2>
          </div>

          {/* 분류 태그 (정적 표시) */}
          {article.categories.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {article.categories.map(cat => (
                <span key={cat}
                  style={{ padding: "3px 10px", background: "#1e3a1e", color: "#90d090", border: "1px solid #2a5a2a", borderRadius: 12, fontSize: 12 }}>
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* 본문 */}
          <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 20, lineHeight: 1.8, fontSize: 14 }}
            dangerouslySetInnerHTML={{ __html: article.html }} />

          <style>{`
            .wiki-link { color: #6ab0f5; text-decoration: none; }
            .wiki-link:hover { text-decoration: underline; }
            .redirect { color: #888; font-style: italic; }
            .include-tpl { color: #666; font-size: 12px; }
            .footnote { color: #aaa; font-size: 11px; cursor: help; }
            h2 { color: #f5c542; border-bottom: 1px solid #333; padding-bottom: 4px; margin-top: 24px; }
            h3 { color: #e0a020; margin-top: 18px; }
            h4, h5, h6 { color: #c8901c; }
            code { background: #2a2a2a; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          `}</style>
        </div>
      )}
    </div>
  );
}
