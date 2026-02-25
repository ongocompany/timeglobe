"use client";

import { useState } from "react";
import Link from "next/link";

type EventItem = {
  id: string;
  title: { ko?: string; en?: string } | null;
  start_year: number;
  category: string;
  location_lat: number;
  location_lng: number;
  external_link: string | null;
};

const LIMIT = 50;

function titleText(title: EventItem["title"]) {
  if (!title) return "(no title)";
  if (title.ko) return title.ko;
  if (title.en) return title.en;
  return "(no title)";
}

export default function DataCheckPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const ready = Boolean(supabaseUrl && anonKey);

  async function loadData() {
    if (!ready) return;

    setLoading(true);
    setError("");

    try {
      const url =
        `${supabaseUrl}/rest/v1/events` +
        `?select=id,title,start_year,category,location_lat,location_lng,external_link` +
        `&order=start_year.desc&limit=${LIMIT}`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const json = (await response.json()) as EventItem[];
      setItems(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f1a] text-white p-6">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold">TimeGlobe 데이터 확인</h1>
        <p className="mt-2 text-sm text-white/70">
          Supabase `events` 테이블에서 최근 {LIMIT}건을 가져와서 보여줍니다.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void loadData()}
            className="rounded border border-white/40 px-3 py-2 text-sm hover:bg-white/10"
          >
            데이터 불러오기
          </button>
          <Link href="/" className="rounded border border-white/30 px-3 py-2 text-sm hover:bg-white/10">
            홈으로
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

        <div className="mt-6 overflow-x-auto rounded border border-white/20">
          <table className="min-w-full text-sm">
            <thead className="bg-white/10 text-left text-white/90">
              <tr>
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">연도</th>
                <th className="px-3 py-2">카테고리</th>
                <th className="px-3 py-2">위치</th>
                <th className="px-3 py-2">링크</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-3 py-2">{titleText(item.title)}</td>
                  <td className="px-3 py-2">{item.start_year}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2 text-white/70">
                    {item.location_lat.toFixed(2)}, {item.location_lng.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {item.external_link ? (
                      <a href={item.external_link} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                        source
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && items.length === 0 && ready && (
            <p className="px-3 py-4 text-sm text-white/70">
              아직 표시할 데이터가 없습니다. `데이터 불러오기` 버튼을 눌러보세요.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
