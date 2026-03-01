"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

// [cl] Tier 리뷰 페이지 — 체크박스 + 코멘트 기능 추가

interface Entity {
  qid?: string;
  name_en: string;
  name_ko?: string;
  start?: string;
  end?: string;
  lat?: string;
  lon?: string;
  sitelinks?: number;
  tier?: number;
  region?: string;
  score?: number;
  tier_reason?: string;
}

const REGION_KO: Record<string, string> = {
  east_asia: "동아시아",
  southeast_asia: "동남아시아",
  south_asia: "남아시아",
  central_asia: "중앙아시아",
  middle_east: "중동",
  north_africa: "북아프리카",
  sub_saharan: "사하라이남",
  europe: "유럽",
  north_america: "북아메리카",
  latin_america: "중남아메리카",
  oceania: "오세아니아",
  unknown: "미분류",
};

const TIER_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
  4: "#6b7280",
};

const ALL_REGIONS = Object.keys(REGION_KO);

interface ReviewComment {
  idx: number;
  name_en: string;
  name_ko?: string;
  tier: number;
  region: string;
  comment: string;
}

export default function TierReviewPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  // 필터
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<"all" | "flagged" | "commented">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "sitelinks" | "name_ko" | "name_en" | "tier">("score");
  const [sortDesc, setSortDesc] = useState(true);

  // 체크(플래그) + 코멘트
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [comments, setComments] = useState<Record<number, string>>({});
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  // [cl] 코멘트 저장 상태
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSaveMsg, setCommentSaveMsg] = useState("");

  // 로드: 엔티티 + 서버 코멘트 동시 fetch
  useEffect(() => {
    Promise.all([
      fetch("/api/tiers").then((r) => r.json()),
      fetch("/api/tiers/comments").then((r) => r.json()),
    ])
      .then(([entityData, commentData]) => {
        setEntities(entityData);
        setFlagged(new Set(commentData.flagged || []));
        setComments(commentData.comments || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // [cl] 코멘트 서버 저장
  const saveCommentsToServer = useCallback(async () => {
    setCommentSaving(true);
    try {
      const res = await fetch("/api/tiers/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagged: Array.from(flagged),
          comments,
        }),
      });
      const result = await res.json();
      setCommentSaveMsg(`코멘트 ${result.saved}개 저장 완료!`);
    } catch {
      setCommentSaveMsg("코멘트 저장 실패!");
    }
    setCommentSaving(false);
    setTimeout(() => setCommentSaveMsg(""), 3000);
  }, [flagged, comments]);

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    let result = entities.map((e, i) => ({ ...e, _idx: i }));

    if (filterRegion !== "all") {
      result = result.filter((e) => e.region === filterRegion);
    }
    if (filterTier !== "all") {
      result = result.filter((e) => e.tier === parseInt(filterTier));
    }
    if (filterFlag === "flagged") {
      result = result.filter((e) => flagged.has(e._idx));
    } else if (filterFlag === "commented") {
      result = result.filter((e) => comments[e._idx]);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          (e.name_ko && e.name_ko.toLowerCase().includes(q)) ||
          e.name_en.toLowerCase().includes(q) ||
          (e.qid && e.qid.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "score") {
        va = a.score ?? 0;
        vb = b.score ?? 0;
      } else if (sortBy === "sitelinks") {
        va = a.sitelinks ?? 0;
        vb = b.sitelinks ?? 0;
      } else if (sortBy === "tier") {
        va = a.tier ?? 99;
        vb = b.tier ?? 99;
      } else if (sortBy === "name_ko") {
        va = a.name_ko ?? "zzz";
        vb = b.name_ko ?? "zzz";
      } else {
        va = a.name_en;
        vb = b.name_en;
      }
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });

    return result;
  }, [entities, filterRegion, filterTier, filterFlag, search, sortBy, sortDesc, flagged, comments]);

  // 플래그 토글
  const toggleFlag = useCallback((idx: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // 코멘트 저장
  const saveComment = useCallback((idx: number) => {
    if (commentDraft.trim()) {
      setComments((prev) => ({ ...prev, [idx]: commentDraft.trim() }));
      // 코멘트 달면 자동으로 플래그도
      setFlagged((prev) => new Set(prev).add(idx));
    } else {
      setComments((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
    setEditingComment(null);
    setCommentDraft("");
  }, [commentDraft]);

  // Tier 변경
  const changeTier = useCallback((idx: number, newTier: number) => {
    setEntities((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], tier: newTier };
      return next;
    });
    setDirty((prev) => new Set(prev).add(idx));
  }, []);

  // Region 변경
  const changeRegion = useCallback((idx: number, newRegion: string) => {
    setEntities((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], region: newRegion };
      return next;
    });
    setDirty((prev) => new Set(prev).add(idx));
  }, []);

  // Tier+Region 저장
  const save = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    const updates = Array.from(dirty).map((idx) => ({
      qid: entities[idx].qid,
      name_en: entities[idx].name_en,
      tier: entities[idx].tier ?? 4,
      region: entities[idx].region ?? "unknown",
    }));
    try {
      const res = await fetch("/api/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      setSaveMsg(`${result.updated}개 저장 완료!`);
      setDirty(new Set());
    } catch {
      setSaveMsg("저장 실패!");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  // 코멘트 내보내기 (민철에게 전달용)
  const exportComments = useCallback(() => {
    const items: ReviewComment[] = [];
    for (const [idxStr, comment] of Object.entries(comments)) {
      const idx = parseInt(idxStr);
      const e = entities[idx];
      if (!e) continue;
      items.push({
        idx,
        name_en: e.name_en,
        name_ko: e.name_ko,
        tier: e.tier ?? 4,
        region: e.region ?? "unknown",
        comment,
      });
    }
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tier_review_comments.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [comments, entities]);

  // 통계
  const stats = useMemo(() => {
    const byTier: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    entities.forEach((e) => { byTier[e.tier ?? 4] = (byTier[e.tier ?? 4] || 0) + 1; });
    return byTier;
  }, [entities]);

  const regionStats = useMemo(() => {
    const map: Record<string, number> = {};
    entities.forEach((e) => { map[e.region ?? "unknown"] = (map[e.region ?? "unknown"] || 0) + 1; });
    return map;
  }, [entities]);

  const flagCount = flagged.size;
  const commentCount = Object.keys(comments).length;

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#fff", background: "#111", minHeight: "100vh" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 30px",
        color: "#e0e0e0",
        background: "#111",
        minHeight: "100vh",
        fontFamily: "'Pretendard', sans-serif",
      }}
    >
      <h1 style={{ margin: "0 0 10px", fontSize: 24 }}>
        Tier Review — {entities.length}개 엔티티
      </h1>

      {/* 통계 바 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map((t) => (
          <div
            key={t}
            onClick={() => setFilterTier(filterTier === String(t) ? "all" : String(t))}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              background: filterTier === String(t) ? TIER_COLORS[t] : "#222",
              border: `2px solid ${TIER_COLORS[t]}`,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Tier {t}: {stats[t] ?? 0}개
          </div>
        ))}
        <div
          onClick={() => setFilterTier("all")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterTier === "all" ? "#444" : "#222",
            border: "2px solid #555", cursor: "pointer",
          }}
        >
          전체
        </div>
        {/* 플래그/코멘트 필터 */}
        <div
          onClick={() => setFilterFlag(filterFlag === "flagged" ? "all" : "flagged")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterFlag === "flagged" ? "#a855f7" : "#222",
            border: "2px solid #a855f7", cursor: "pointer", fontWeight: 600,
          }}
        >
          체크됨: {flagCount}개
        </div>
        <div
          onClick={() => setFilterFlag(filterFlag === "commented" ? "all" : "commented")}
          style={{
            padding: "6px 16px", borderRadius: 6,
            background: filterFlag === "commented" ? "#ec4899" : "#222",
            border: "2px solid #ec4899", cursor: "pointer", fontWeight: 600,
          }}
        >
          코멘트: {commentCount}개
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4 }}
        >
          <option value="all">모든 권역</option>
          {ALL_REGIONS.map((r) => (
            <option key={r} value={r}>{REGION_KO[r]} ({regionStats[r] ?? 0})</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="검색 (한글/영문/QID)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4, width: 250 }}
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 4 }}
        >
          <option value="score">스코어순</option>
          <option value="sitelinks">Sitelinks순</option>
          <option value="tier">Tier순</option>
          <option value="name_ko">한국어명순</option>
          <option value="name_en">영문명순</option>
        </select>

        <button
          onClick={() => setSortDesc(!sortDesc)}
          style={{ padding: "6px 12px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: 4, cursor: "pointer" }}
        >
          {sortDesc ? "▼ 내림" : "▲ 오름"}
        </button>

        <span style={{ color: "#888" }}>{filtered.length}개 표시</span>

        {/* 코멘트 서버 저장 */}
        <button
          onClick={saveCommentsToServer}
          disabled={commentSaving || (flagCount === 0 && commentCount === 0)}
          style={{
            padding: "6px 16px",
            background: (flagCount > 0 || commentCount > 0) ? "#a855f7" : "#333",
            color: "#fff", border: "none", borderRadius: 6,
            cursor: (flagCount > 0 || commentCount > 0) ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          {commentSaving ? "저장 중..." : `코멘트 저장 (${commentCount}개)`}
        </button>
        {commentSaveMsg && <span style={{ color: "#a855f7", fontWeight: 600 }}>{commentSaveMsg}</span>}

        {/* Tier/Region 변경 저장 */}
        <button
          onClick={save}
          disabled={dirty.size === 0 || saving}
          style={{
            marginLeft: "auto", padding: "8px 24px",
            background: dirty.size > 0 ? "#22c55e" : "#333",
            color: "#fff", border: "none", borderRadius: 6,
            cursor: dirty.size > 0 ? "pointer" : "default",
            fontWeight: 700, fontSize: 15,
          }}
        >
          {saving ? "저장 중..." : `Tier 저장 (${dirty.size}개 변경)`}
        </button>
        {saveMsg && <span style={{ color: "#22c55e", fontWeight: 600 }}>{saveMsg}</span>}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
              <th style={{ padding: "8px 4px", width: 30 }}>V</th>
              <th style={{ padding: "8px 4px", width: 35 }}>#</th>
              <th style={{ padding: "8px 4px", width: 70 }}>Tier</th>
              <th style={{ padding: "8px 4px", width: 50 }}>점수</th>
              <th style={{ padding: "8px 4px", width: 40 }}>SL</th>
              <th style={{ padding: "8px 4px", width: 140 }}>한국어명</th>
              <th style={{ padding: "8px 4px" }}>영문명</th>
              <th style={{ padding: "8px 4px", width: 100 }}>존속기간</th>
              <th style={{ padding: "8px 4px", width: 110 }}>권역</th>
              <th style={{ padding: "8px 4px", width: 200 }}>코멘트</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const isDirty = dirty.has(e._idx);
              const isFlagged = flagged.has(e._idx);
              const hasComment = !!comments[e._idx];
              const isEditing = editingComment === e._idx;

              return (
                <tr
                  key={e._idx}
                  style={{
                    borderBottom: "1px solid #222",
                    background: isFlagged
                      ? "#2a1a2a"
                      : isDirty
                        ? "#1a2a1a"
                        : i % 2 === 0 ? "#161616" : "#111",
                  }}
                >
                  {/* 체크박스 */}
                  <td style={{ padding: "4px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isFlagged}
                      onChange={() => toggleFlag(e._idx)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#a855f7" }}
                    />
                  </td>
                  <td style={{ padding: "4px", color: "#666" }}>{i + 1}</td>
                  <td style={{ padding: "4px" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1, 2, 3, 4].map((t) => (
                        <button
                          key={t}
                          onClick={() => changeTier(e._idx, t)}
                          style={{
                            width: 26, height: 24, border: "none", borderRadius: 3,
                            cursor: "pointer", fontWeight: 700, fontSize: 11,
                            background: e.tier === t ? TIER_COLORS[t] : "#2a2a2a",
                            color: e.tier === t ? "#fff" : "#555",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "4px", color: "#888", fontSize: 11 }}>{e.score?.toFixed(1) ?? "—"}</td>
                  <td style={{ padding: "4px", color: "#aaa", fontSize: 12 }}>{e.sitelinks ?? 0}</td>
                  <td style={{ padding: "4px", fontWeight: e.name_ko ? 600 : 400, color: e.name_ko ? "#fff" : "#555" }}>
                    {e.name_ko || "—"}
                  </td>
                  <td style={{ padding: "4px" }}>{e.name_en}</td>
                  <td style={{ padding: "4px", color: "#888", fontSize: 11 }}>
                    {e.start ?? "?"} ~ {e.end ?? "?"}
                  </td>
                  <td style={{ padding: "4px" }}>
                    <select
                      value={e.region ?? "unknown"}
                      onChange={(ev) => changeRegion(e._idx, ev.target.value)}
                      style={{
                        padding: "2px 4px", background: "#222", color: "#ccc",
                        border: "1px solid #444", borderRadius: 3, fontSize: 11, width: "100%",
                      }}
                    >
                      {ALL_REGIONS.map((r) => (
                        <option key={r} value={r}>{REGION_KO[r]}</option>
                      ))}
                    </select>
                  </td>
                  {/* 코멘트 */}
                  <td style={{ padding: "4px" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          type="text"
                          value={commentDraft}
                          onChange={(ev) => setCommentDraft(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") saveComment(e._idx);
                            if (ev.key === "Escape") { setEditingComment(null); setCommentDraft(""); }
                          }}
                          autoFocus
                          placeholder="코멘트 입력 (Enter 저장)"
                          style={{
                            flex: 1, padding: "3px 6px", background: "#1a1a2a", color: "#fff",
                            border: "1px solid #a855f7", borderRadius: 3, fontSize: 12,
                          }}
                        />
                        <button
                          onClick={() => saveComment(e._idx)}
                          style={{
                            padding: "3px 8px", background: "#a855f7", color: "#fff",
                            border: "none", borderRadius: 3, cursor: "pointer", fontSize: 11,
                          }}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingComment(e._idx);
                          setCommentDraft(comments[e._idx] || "");
                        }}
                        style={{
                          padding: "3px 6px", minHeight: 24, cursor: "text",
                          borderRadius: 3, fontSize: 12,
                          background: hasComment ? "#1a1a2a" : "transparent",
                          border: hasComment ? "1px solid #a855f766" : "1px solid transparent",
                          color: hasComment ? "#d8b4fe" : "#444",
                        }}
                      >
                        {comments[e._idx] || "클릭하여 코멘트 추가"}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#555" }}>
          해당 조건에 맞는 엔티티가 없습니다.
        </div>
      )}
    </div>
  );
}
