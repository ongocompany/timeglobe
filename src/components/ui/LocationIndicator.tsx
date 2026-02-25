"use client";

// [cl] 이정표 컴포넌트: 카메라 위치 + 줌 레벨에 따라 지역 브레드크럼 표시
// 위치: 상단 중앙 (초기 타이틀이 있던 자리)
// 데이터: 정적 바운딩박스 계층 + 이벤트 데이터 기반 역사적 지역명 매칭

import { useState, useEffect, useRef } from "react";
import type { MockEvent } from "@/data/mockEvents";

// ─── 지역 계층 데이터 ────────────────────────────────────────────────────────

interface Region {
  ko: string;
  en: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

// [cl] Level 0: 대륙/권역 (카메라 높이 > 5,000km)
const CONTINENTS: Region[] = [
  { ko: "유럽",        en: "Europe",          latMin: 35,  latMax: 72,  lngMin: -25, lngMax: 45  },
  { ko: "중동",        en: "Middle East",      latMin: 12,  latMax: 42,  lngMin: 28,  lngMax: 63  },
  { ko: "중앙아시아",  en: "Central Asia",     latMin: 35,  latMax: 56,  lngMin: 46,  lngMax: 90  },
  { ko: "남아시아",    en: "South Asia",       latMin: 5,   latMax: 38,  lngMin: 60,  lngMax: 92  },
  { ko: "동남아시아",  en: "Southeast Asia",   latMin: -10, latMax: 25,  lngMin: 92,  lngMax: 145 },
  { ko: "동아시아",    en: "East Asia",        latMin: 18,  latMax: 55,  lngMin: 73,  lngMax: 155 },
  { ko: "아프리카",    en: "Africa",           latMin: -35, latMax: 38,  lngMin: -20, lngMax: 52  },
  { ko: "북아메리카",  en: "North America",    latMin: 15,  latMax: 85,  lngMin: -170,lngMax: -50 },
  { ko: "중남아메리카",en: "Latin America",    latMin: -58, latMax: 18,  lngMin: -120,lngMax: -30 },
  { ko: "오세아니아",  en: "Oceania",          latMin: -50, latMax: 10,  lngMin: 110, lngMax: 182 },
];

// [cl] Level 1: 소지역 (카메라 높이 1,500~5,000km)
const SUB_REGIONS: Region[] = [
  { ko: "서유럽",           en: "Western Europe",     latMin: 36,  latMax: 58, lngMin: -10, lngMax: 10  },
  { ko: "중부유럽",         en: "Central Europe",     latMin: 46,  latMax: 58, lngMin: 9,   lngMax: 28  },
  { ko: "동유럽",           en: "Eastern Europe",     latMin: 45,  latMax: 70, lngMin: 22,  lngMax: 45  },
  { ko: "북유럽",           en: "Northern Europe",    latMin: 55,  latMax: 72, lngMin: -10, lngMax: 32  },
  { ko: "남유럽·지중해",   en: "Mediterranean",      latMin: 35,  latMax: 47, lngMin: -9,  lngMax: 36  },
  { ko: "한반도·일본",     en: "Korea & Japan",      latMin: 30,  latMax: 46, lngMin: 124, lngMax: 146 },
  { ko: "중국 북부",        en: "Northern China",     latMin: 35,  latMax: 55, lngMin: 73,  lngMax: 125 },
  { ko: "중국 남부",        en: "Southern China",     latMin: 18,  latMax: 35, lngMin: 97,  lngMax: 125 },
  { ko: "인도아대륙",       en: "Indian Subcontinent",latMin: 5,   latMax: 36, lngMin: 65,  lngMax: 92  },
  { ko: "인도차이나",       en: "Indochina",          latMin: 10,  latMax: 28, lngMin: 97,  lngMax: 120 },
  { ko: "아라비아반도",     en: "Arabian Peninsula",  latMin: 12,  latMax: 32, lngMin: 35,  lngMax: 60  },
  { ko: "이란·메소포타미아",en: "Iran & Mesopotamia", latMin: 28,  latMax: 42, lngMin: 42,  lngMax: 65  },
  { ko: "북아프리카",       en: "North Africa",       latMin: 15,  latMax: 38, lngMin: -10, lngMax: 40  },
  { ko: "서아프리카",       en: "West Africa",        latMin: 4,   latMax: 25, lngMin: -20, lngMax: 20  },
  { ko: "동아프리카",       en: "East Africa",        latMin: -12, latMax: 18, lngMin: 28,  lngMax: 52  },
  { ko: "북아메리카 동부",  en: "Eastern N. America", latMin: 25,  latMax: 55, lngMin: -90, lngMax: -50 },
  { ko: "북아메리카 서부",  en: "Western N. America", latMin: 25,  latMax: 70, lngMin: -170,lngMax: -90 },
  { ko: "카리브·중앙아메리카", en: "Caribbean & C. America", latMin: 8, latMax: 25, lngMin: -100, lngMax: -60 },
  { ko: "남아메리카 북부",  en: "Northern S. America",latMin: -10, latMax: 12, lngMin: -85, lngMax: -35 },
  { ko: "남아메리카 남부",  en: "Southern S. America",latMin: -58, latMax: 0,  lngMin: -80, lngMax: -35 },
  { ko: "호주·뉴질랜드",   en: "Australia & NZ",     latMin: -50, latMax: -10,lngMin: 110, lngMax: 180 },
];

// ─── 유틸리티 함수 ────────────────────────────────────────────────────────────

function inBounds(lat: number, lng: number, r: Region): boolean {
  return lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax;
}

function findRegion(lat: number, lng: number, list: Region[]): Region | null {
  return list.find((r) => inBounds(lat, lng, r)) ?? null;
}

// [cl] Haversine 거리 (km)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// [cl] 가장 가까운 이벤트 (maxKm 반경 이내)
function findNearestEvent(
  lat: number,
  lng: number,
  events: MockEvent[],
  maxKm: number
): MockEvent | null {
  let nearest: MockEvent | null = null;
  let minDist = maxKm;
  for (const ev of events) {
    const dist = haversineKm(lat, lng, ev.location_lat, ev.location_lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = ev;
    }
  }
  return nearest;
}

// [cl] 카메라 높이 + 위치 → 브레드크럼 배열 생성
function getBreadcrumb(lat: number, lng: number, height: number, events: MockEvent[]): string[] {
  const result: string[] = [];

  // Level 0: 대륙 (항상 포함)
  const continent = findRegion(lat, lng, CONTINENTS);
  if (!continent) return []; // 바다 한가운데 등 → 표시 안 함

  result.push(continent.ko);

  // Level 1: 소지역 (높이 < 5,500km)
  if (height < 5_500_000) {
    const sub = findRegion(lat, lng, SUB_REGIONS);
    if (sub) result.push(sub.ko);
  }

  // Level 2: 역사적 국가/지역 (높이 < 2,000km, 가까운 이벤트 historical_region)
  if (height < 2_000_000) {
    const ev = findNearestEvent(lat, lng, events, 2500);
    if (ev) result.push(ev.historical_region.ko);
  }

  // Level 3: 도시/장소 근처 (높이 < 600km, 가까운 이벤트 modern_country + '근처')
  if (height < 600_000) {
    const ev = findNearestEvent(lat, lng, events, 400);
    if (ev) {
      // Level 2와 중복 방지: historical_region이 이미 추가된 경우 modern_country만
      const lastAdded = result[result.length - 1];
      const cityLabel = ev.modern_country.ko + " 근처";
      if (lastAdded !== cityLabel) result.push(cityLabel);
    }
  }

  return result;
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

interface LocationIndicatorProps {
  events: MockEvent[];
}

export default function LocationIndicator({ events }: LocationIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const prevBreadcrumb = useRef<string[]>([]);

  // [cl] globe ready 이벤트 수신 → 표시 전환
  useEffect(() => {
    const onReady = () => setVisible(true);
    window.addEventListener("timeglobe:globeReady", onReady);
    return () => window.removeEventListener("timeglobe:globeReady", onReady);
  }, []);

  // [cl] 카메라 위치 폴링 (500ms 간격)
  useEffect(() => {
    if (!visible) return;

    const poll = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      // [cl] 라디안 → 도 변환
      const lat = (w.__timeglobe_cameraLatitude ?? 0) * (180 / Math.PI);
      const lng = (w.__timeglobe_cameraLongitude ?? 0) * (180 / Math.PI);
      const height = w.__timeglobe_cameraHeight ?? 10_000_000;

      const next = getBreadcrumb(lat, lng, height, events);

      // 변화가 있을 때만 setState (불필요한 리렌더 방지)
      const prev = prevBreadcrumb.current;
      if (
        next.length !== prev.length ||
        next.some((v, i) => v !== prev[i])
      ) {
        prevBreadcrumb.current = next;
        setBreadcrumb(next);
      }
    };

    poll(); // 즉시 1회 실행
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [visible, events]);

  return (
    <div
      className={`absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-1000 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-white/70 text-sm tracking-wide">
          {breadcrumb.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-white/25 mx-0.5 text-xs">›</span>
              )}
              <span
                className={
                  i === breadcrumb.length - 1
                    ? "text-white font-medium drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                    : "text-white/45"
                }
                style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
              >
                {part}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
