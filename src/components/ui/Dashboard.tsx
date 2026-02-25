"use client";

// [cl] Dashboard: 상단 중앙 정보 박스
// - 지명 브레드크럼 + 시대 연도
// - 화면 중심 좌표 / 마우스 커서 좌표 / 고도
// 위치: 상단 중앙 (초기 타이틀 자리)

import { useState, useEffect, useRef } from "react";
import type { MockEvent } from "@/data/mockEvents";

// ─── 지역 계층 데이터 ────────────────────────────────────────────────────────

interface Region {
  ko: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

const CONTINENTS: Region[] = [
  { ko: "유럽",        latMin: 35,  latMax: 72,  lngMin: -25, lngMax: 45  },
  { ko: "중동",        latMin: 12,  latMax: 42,  lngMin: 28,  lngMax: 63  },
  { ko: "중앙아시아",  latMin: 35,  latMax: 56,  lngMin: 46,  lngMax: 90  },
  { ko: "남아시아",    latMin: 5,   latMax: 38,  lngMin: 60,  lngMax: 92  },
  { ko: "동남아시아",  latMin: -10, latMax: 25,  lngMin: 92,  lngMax: 145 },
  { ko: "동아시아",    latMin: 18,  latMax: 55,  lngMin: 73,  lngMax: 155 },
  { ko: "아프리카",    latMin: -35, latMax: 38,  lngMin: -20, lngMax: 52  },
  { ko: "북아메리카",  latMin: 15,  latMax: 85,  lngMin: -170,lngMax: -50 },
  { ko: "중남아메리카",latMin: -58, latMax: 18,  lngMin: -120,lngMax: -30 },
  { ko: "오세아니아",  latMin: -50, latMax: 10,  lngMin: 110, lngMax: 182 },
];

const SUB_REGIONS: Region[] = [
  { ko: "서유럽",            latMin: 36,  latMax: 58, lngMin: -10, lngMax: 10  },
  { ko: "중부유럽",          latMin: 46,  latMax: 58, lngMin: 9,   lngMax: 28  },
  { ko: "동유럽",            latMin: 45,  latMax: 70, lngMin: 22,  lngMax: 45  },
  { ko: "북유럽",            latMin: 55,  latMax: 72, lngMin: -10, lngMax: 32  },
  { ko: "남유럽·지중해",    latMin: 35,  latMax: 47, lngMin: -9,  lngMax: 36  },
  { ko: "한반도·일본",      latMin: 30,  latMax: 46, lngMin: 124, lngMax: 146 },
  { ko: "중국 북부",         latMin: 35,  latMax: 55, lngMin: 73,  lngMax: 125 },
  { ko: "중국 남부",         latMin: 18,  latMax: 35, lngMin: 97,  lngMax: 125 },
  { ko: "인도아대륙",        latMin: 5,   latMax: 36, lngMin: 65,  lngMax: 92  },
  { ko: "인도차이나",        latMin: 10,  latMax: 28, lngMin: 97,  lngMax: 120 },
  { ko: "아라비아반도",      latMin: 12,  latMax: 32, lngMin: 35,  lngMax: 60  },
  { ko: "이란·메소포타미아", latMin: 28,  latMax: 42, lngMin: 42,  lngMax: 65  },
  { ko: "북아프리카",        latMin: 15,  latMax: 38, lngMin: -10, lngMax: 40  },
  { ko: "서아프리카",        latMin: 4,   latMax: 25, lngMin: -20, lngMax: 20  },
  { ko: "동아프리카",        latMin: -12, latMax: 18, lngMin: 28,  lngMax: 52  },
  { ko: "북아메리카 동부",   latMin: 25,  latMax: 55, lngMin: -90, lngMax: -50 },
  { ko: "북아메리카 서부",   latMin: 25,  latMax: 70, lngMin: -170,lngMax: -90 },
  { ko: "카리브·중앙아메리카",latMin: 8,  latMax: 25, lngMin: -100,lngMax: -60 },
  { ko: "남아메리카 북부",   latMin: -10, latMax: 12, lngMin: -85, lngMax: -35 },
  { ko: "남아메리카 남부",   latMin: -58, latMax: 0,  lngMin: -80, lngMax: -35 },
  { ko: "호주·뉴질랜드",    latMin: -50, latMax: -10,lngMin: 110, lngMax: 180 },
];

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

function inBounds(lat: number, lng: number, r: Region): boolean {
  return lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax;
}

function findRegion(lat: number, lng: number, list: Region[]): Region | null {
  return list.find((r) => inBounds(lat, lng, r)) ?? null;
}

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

function findNearestEvent(
  lat: number, lng: number, events: MockEvent[], maxKm: number
): MockEvent | null {
  let nearest: MockEvent | null = null;
  let minDist = maxKm;
  for (const ev of events) {
    const d = haversineKm(lat, lng, ev.location_lat, ev.location_lng);
    if (d < minDist) { minDist = d; nearest = ev; }
  }
  return nearest;
}

function getBreadcrumb(
  lat: number, lng: number, height: number, events: MockEvent[]
): { parts: string[]; nearestEv: MockEvent | null } {
  const parts: string[] = [];
  const continent = findRegion(lat, lng, CONTINENTS);
  if (!continent) return { parts: [], nearestEv: null };
  parts.push(continent.ko);

  if (height < 5_500_000) {
    const sub = findRegion(lat, lng, SUB_REGIONS);
    if (sub) parts.push(sub.ko);
  }

  let nearestEv: MockEvent | null = null;
  if (height < 2_000_000) {
    nearestEv = findNearestEvent(lat, lng, events, 2500);
    if (nearestEv) parts.push(nearestEv.historical_region.ko);
  }
  if (height < 600_000) {
    const cityEv = findNearestEvent(lat, lng, events, 400);
    if (cityEv) {
      nearestEv = cityEv;
      const cityLabel = cityEv.modern_country.ko + " 근처";
      if (parts[parts.length - 1] !== cityLabel) parts.push(cityLabel);
    }
  }
  return { parts, nearestEv };
}

// [cl] 좌표 포맷: 47.42°N 19.05°E
function fmtCoord(latRad: number | null, lngRad: number | null): string {
  if (latRad === null || lngRad === null) return "---";
  const lat = latRad * (180 / Math.PI);
  const lng = lngRad * (180 / Math.PI);
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return `${latStr}  ${lngStr}`;
}

// [cl] 고도 포맷: 1,243 km / 142.3 km / 8,430 m
function fmtHeight(m: number | null): string {
  if (m === null) return "---";
  if (m >= 1_000_000) return `${Math.round(m / 1000).toLocaleString()} km`;
  if (m >= 10_000)    return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m).toLocaleString()} m`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  events: MockEvent[];
}

interface DashData {
  breadcrumb: string[];
  nearestYear: number | null;
  groundLat: number | null;
  groundLng: number | null;
  cursorLat: number | null;
  cursorLng: number | null;
  heightM: number | null;
}

const EMPTY: DashData = {
  breadcrumb: [], nearestYear: null,
  groundLat: null, groundLng: null,
  cursorLat: null, cursorLng: null,
  heightM: null,
};

export default function Dashboard({ events }: DashboardProps) {
  const [visible, setVisible] = useState(false);
  const [d, setD] = useState<DashData>(EMPTY);
  const prevRef = useRef<DashData>(EMPTY);

  useEffect(() => {
    const onReady = () => setVisible(true);
    window.addEventListener("timeglobe:globeReady", onReady);
    return () => window.removeEventListener("timeglobe:globeReady", onReady);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const poll = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const camLat  = w.__timeglobe_cameraLatitude  ?? 0;
      const camLng  = w.__timeglobe_cameraLongitude ?? 0;
      const height  = w.__timeglobe_cameraHeight    ?? 10_000_000;

      const latDeg = camLat * (180 / Math.PI);
      const lngDeg = camLng * (180 / Math.PI);

      const { parts, nearestEv } = getBreadcrumb(latDeg, lngDeg, height, events);

      const next: DashData = {
        breadcrumb:  parts,
        nearestYear: nearestEv ? nearestEv.start_year : null,
        groundLat:   w.__timeglobe_groundLat  ?? null,
        groundLng:   w.__timeglobe_groundLng  ?? null,
        cursorLat:   w.__timeglobe_cursorLat  ?? null,
        cursorLng:   w.__timeglobe_cursorLng  ?? null,
        heightM:     height,
      };

      // 얕은 비교 — 실제 변경이 있을 때만 setState
      const prev = prevRef.current;
      const changed =
        next.breadcrumb.join() !== prev.breadcrumb.join() ||
        next.nearestYear !== prev.nearestYear ||
        next.groundLat !== prev.groundLat ||
        next.groundLng !== prev.groundLng ||
        next.cursorLat !== prev.cursorLat ||
        next.cursorLng !== prev.cursorLng ||
        Math.abs((next.heightM ?? 0) - (prev.heightM ?? 0)) > 1000;

      if (changed) {
        prevRef.current = next;
        setD(next);
      }
    };

    poll();
    const id = setInterval(poll, 200);
    return () => clearInterval(id);
  }, [visible, events]);

  return (
    <div
      className={`absolute top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none
        transition-all duration-1000
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
    >
      <div
        className="bg-black/40 backdrop-blur-sm rounded-xl px-5 py-3 text-white
          border border-white/30 min-w-[480px] max-w-[720px]"
        style={{ fontFamily: "var(--font-noto-sans), sans-serif", boxShadow: "0 0 7px rgba(255,255,255,0.20)" }}
      >
        {/* ── 행 1: 지명 브레드크럼 + 시대 연도 ── */}
        <div className="flex items-center gap-1.5 text-base font-medium leading-snug flex-wrap">
          {d.breadcrumb.length === 0 ? (
            <span className="text-white/30 text-sm">—</span>
          ) : (
            d.breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white/25 text-sm">›</span>}
                <span className={i === d.breadcrumb.length - 1 ? "text-white" : "text-white/45"}>
                  {part}
                </span>
              </span>
            ))
          )}
          {d.nearestYear !== null && (
            <>
              <span className="text-white/25 mx-1 text-sm">|</span>
              <span className="text-white/80 text-sm font-normal">{d.nearestYear}년</span>
            </>
          )}
        </div>

        {/* ── 행 2: 좌표 + 고도 ── */}
        <div
          className="flex items-center gap-5 mt-1.5 text-sm text-white/55 font-mono"
        >
          <span>
            <span className="text-white/35 mr-1 not-italic" style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}>중심</span>
            <span className="text-white/80">{fmtCoord(d.groundLat, d.groundLng)}</span>
          </span>
          <span>
            <span className="text-white/35 mr-1 not-italic" style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}>커서</span>
            <span className="text-white/80">{fmtCoord(d.cursorLat, d.cursorLng)}</span>
          </span>
          <span>
            <span className="text-white/35 mr-1 not-italic" style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}>고도</span>
            <span className="text-white/80">{fmtHeight(d.heightM)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
