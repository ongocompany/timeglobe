"use client";

// [cl] Leaflet 지도 SSR-safe 래퍼 (GlobeLoader.tsx 패턴)
import dynamic from "next/dynamic";

export interface MapCircleEntity {
  name_en: string;
  name_ko: string;
  lon: number;
  lat: number;
  qid: string;
  tier: number;
  color: string;
}

export interface TierReviewMapProps {
  selectedEntities: MapCircleEntity[];
  ohmPolygons: Map<string, GeoJSON.FeatureCollection>;
  onMarkerClick: (qid: string) => void;
}

const TierReviewMapInner = dynamic(
  () => import("./TierReviewMapInner"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: "35vh",
        background: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontSize: 14,
      }}>
        Loading map...
      </div>
    ),
  }
);

export default function TierReviewMap(props: TierReviewMapProps) {
  return <TierReviewMapInner {...props} />;
}
