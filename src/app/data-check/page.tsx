"use client";

import { useState } from "react";
import Link from "next/link";

type EventItem = {
  id: string;
  era_id: string | null;
  title: { ko?: string; en?: string } | null;
  start_year: number;
  end_year: number | null;
  created_at: string;
  category: string;
  event_kind: string | null;
  is_battle: boolean;
  is_curated_visible: boolean | null;
  location_lat: number;
  location_lng: number;
  is_fog_region: boolean;
  modern_country: { ko?: string; en?: string } | null;
  image_url: string | null;
  summary: { ko?: string; en?: string } | null;
  external_link: string | null;
};

const LIMIT = 50;

function titleText(title: EventItem["title"]) {
  if (!title) return "(no title)";
  if (title.ko) return title.ko;
  if (title.en) return title.en;
  return "(no title)";
}

function visibilityText(item: EventItem) {
  if (item.is_curated_visible === true) return "수동 노출";
  if (item.is_curated_visible === false) return "수동 숨김";
  if (item.is_battle) return "기본 숨김(전투)";
  return "기본 노출";
}

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

function shortId(id: string) {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function yearText(item: EventItem) {
  if (item.end_year === null || item.end_year === item.start_year) return `${item.start_year}`;
  return `${item.start_year} ~ ${item.end_year}`;
}

export default function DataCheckPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [battleOnly, setBattleOnly] = useState(false);
  const [orderByCreatedAt, setOrderByCreatedAt] = useState(true);
  const [recentOnly, setRecentOnly] = useState(true);
  const [selectedId, setSelectedId] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const ready = Boolean(supabaseUrl && anonKey);

  async function loadData() {
    if (!ready) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        select:
          "id,era_id,title,start_year,end_year,created_at,category,event_kind,is_battle,is_curated_visible,location_lat,location_lng,is_fog_region,modern_country,image_url,summary,external_link",
        order: orderByCreatedAt ? "created_at.desc" : "start_year.desc",
        limit: String(LIMIT),
      });

      if (!showAll) {
        params.set(
          "or",
          "(is_curated_visible.is.true,and(is_curated_visible.is.null,is_battle.is.false))",
        );
      }

      if (battleOnly) {
        params.set("is_battle", "is.true");
      }

      if (recentOnly) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        params.set("created_at", `gte.${since}`);
      }

      const url = `${supabaseUrl}/rest/v1/events?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        if (
          text.includes("event_kind") ||
          text.includes("is_battle") ||
          text.includes("is_curated_visible")
        ) {
          throw new Error(
            "새 curation 마이그레이션이 필요합니다. `20260225181500_event_curation_fields.sql`를 SQL Editor에서 실행하세요.",
          );
        }
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const json = (await response.json()) as EventItem[];
      setItems(json);
      setSelectedId((prev) => {
        if (json.some((item) => item.id === prev)) return prev;
        return json[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <main className="min-h-screen bg-[#0b0f1a] text-white p-6">
      <section className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold">TimeGlobe 데이터 확인</h1>
        <p className="mt-2 text-sm text-white/70">
          Supabase `events` 테이블에서 최근 {LIMIT}건을 가져와서 보여줍니다.
        </p>
        <p className="mt-1 text-xs text-white/60">
          기본 모드에서는 전투(`is_battle=true`)를 숨기고, `is_curated_visible=true`로 수동 승인한 항목만 노출됩니다.
        </p>
        <p className="mt-1 text-xs text-white/60">
          `최근 추가만 ON`이면 `created_at` 기준 최근 24시간 항목만 조회합니다.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void loadData()}
            className="rounded border border-white/40 px-3 py-2 text-sm hover:bg-white/10"
          >
            데이터 불러오기
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`rounded border px-3 py-2 text-sm ${
              showAll ? "border-cyan-300/80 text-cyan-200" : "border-white/30 text-white/80"
            } hover:bg-white/10`}
          >
            {showAll ? "전체 보기 ON" : "전체 보기 OFF"}
          </button>
          <button
            onClick={() => {
              setBattleOnly((v) => !v);
              setShowAll(true);
            }}
            className={`rounded border px-3 py-2 text-sm ${
              battleOnly ? "border-amber-300/80 text-amber-200" : "border-white/30 text-white/80"
            } hover:bg-white/10`}
          >
            {battleOnly ? "전투만 보기 ON" : "전투만 보기 OFF"}
          </button>
          <button
            onClick={() => setOrderByCreatedAt((v) => !v)}
            className={`rounded border px-3 py-2 text-sm ${
              orderByCreatedAt ? "border-emerald-300/80 text-emerald-200" : "border-white/30 text-white/80"
            } hover:bg-white/10`}
          >
            {orderByCreatedAt ? "정렬: 추가시각" : "정렬: 연도"}
          </button>
          <button
            onClick={() => setRecentOnly((v) => !v)}
            className={`rounded border px-3 py-2 text-sm ${
              recentOnly ? "border-fuchsia-300/80 text-fuchsia-200" : "border-white/30 text-white/80"
            } hover:bg-white/10`}
          >
            {recentOnly ? "최근 추가만 ON" : "최근 추가만 OFF"}
          </button>
          <Link href="/" className="rounded border border-white/30 px-3 py-2 text-sm hover:bg-white/10">
            홈으로
          </Link>
          <Link href="/ops" className="rounded border border-cyan-300/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-300/10">
            배치 모니터
          </Link>
        </div>

        {!ready && (
          <div className="mt-4 rounded border border-amber-300/50 bg-amber-500/10 p-3 text-sm text-amber-100">
            환경변수 없음: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 먼저 입력하세요.
          </div>
        )}

        {loading && (
          <p className="mt-4 text-sm text-white/80">불러오는 중...</p>
        )}

        {error && (
          <div className="mt-4 rounded border border-red-300/50 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-3 text-xs text-white/60">
          현재 목록 {items.length}건
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded border border-white/20 bg-black/20">
            <div className="border-b border-white/10 px-3 py-2 text-xs text-white/70">
              목록 (제목 / 연도 / ID)
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full border-b border-white/10 px-3 py-3 text-left hover:bg-white/5 ${
                    selected?.id === item.id ? "bg-cyan-400/10" : ""
                  }`}
                >
                  <div className="truncate text-sm font-medium">{titleText(item.title)}</div>
                  <div className="mt-1 text-xs text-white/70">
                    {yearText(item)} · {shortId(item.id)}
                  </div>
                </button>
              ))}

              {!loading && items.length === 0 && ready && (
                <p className="px-3 py-4 text-sm text-white/70">
                  아직 표시할 데이터가 없습니다. `데이터 불러오기` 버튼을 눌러보세요.
                </p>
              )}
            </div>
          </div>

          <div className="rounded border border-white/20 bg-black/20 p-4">
            {!selected ? (
              <p className="text-sm text-white/70">왼쪽 목록에서 항목을 선택하세요.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <h2 className="text-lg font-semibold">{titleText(selected.title)}</h2>
                  <p className="mt-1 text-xs text-white/60">
                    {yearText(selected)} · {selected.id}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Category</div>
                    <div>{selected.category}</div>
                  </div>
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Event Kind</div>
                    <div>{selected.event_kind ?? "-"}</div>
                  </div>
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Visibility</div>
                    <div>{visibilityText(selected)}</div>
                  </div>
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Created At</div>
                    <div>{formatDateTime(selected.created_at)}</div>
                  </div>
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Location</div>
                    <div>{selected.location_lat.toFixed(5)}, {selected.location_lng.toFixed(5)}</div>
                  </div>
                  <div className="rounded border border-white/10 px-3 py-2">
                    <div className="text-xs text-white/60">Era ID</div>
                    <div>{selected.era_id ?? "-"}</div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-white/10 p-3">
                    <div className="mb-1 text-xs text-white/60">title (json)</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/85">
                      {jsonText(selected.title)}
                    </pre>
                  </div>
                  <div className="rounded border border-white/10 p-3">
                    <div className="mb-1 text-xs text-white/60">modern_country (json)</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/85">
                      {jsonText(selected.modern_country)}
                    </pre>
                  </div>
                  <div className="rounded border border-white/10 p-3 sm:col-span-2">
                    <div className="mb-1 text-xs text-white/60">summary (json)</div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/85">
                      {jsonText(selected.summary)}
                    </pre>
                  </div>
                </div>

                <div className="rounded border border-white/10 p-3">
                  <div className="mb-1 text-xs text-white/60">링크 / 미디어</div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-white/60">external_link:</span>{" "}
                      {selected.external_link ? (
                        <a
                          href={selected.external_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:underline"
                        >
                          {selected.external_link}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                    <div>
                      <span className="text-white/60">image_url:</span> {selected.image_url ?? "-"}
                    </div>
                  </div>
                </div>

                <div className="rounded border border-white/10 p-3">
                  <div className="mb-1 text-xs text-white/60">Raw Row JSON</div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-white/80">
                    {jsonText(selected)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
