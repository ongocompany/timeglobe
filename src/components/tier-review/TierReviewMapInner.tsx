"use client";

// [cl] Leaflet 2D 지도 — 선택된 엔티티만 마커/폴리곤 표시
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  GeoJSON,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TierReviewMapProps } from "./TierReviewMap";

// [cl] 티어별 색상 (page.tsx의 TIER_COLORS와 동일)
const TIER_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
  4: "#6b7280",
};

// [cl] 선택된 엔티티 변경 시 지도 범위 자동 조정
function FitBounds({
  entities,
}: {
  entities: TierReviewMapProps["selectedEntities"];
}) {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    // 엔티티가 새로 추가될 때만 fitBounds (제거 시에는 안 함)
    if (entities.length > 0 && entities.length > prevCountRef.current) {
      if (entities.length === 1) {
        map.flyTo([entities[0].lat, entities[0].lon], 5, { duration: 0.6 });
      } else {
        const bounds = entities.map(
          (e) => [e.lat, e.lon] as [number, number]
        );
        map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6 });
      }
    }
    prevCountRef.current = entities.length;
  }, [entities, map]);

  return null;
}

export default function TierReviewMapInner({
  selectedEntities,
  ohmPolygons,
  onMarkerClick,
}: TierReviewMapProps) {
  // [cl] GeoJSON key를 강제 변경해서 react-leaflet이 re-render 하도록
  const polygonKey = useMemo(
    () =>
      Array.from(ohmPolygons.keys())
        .sort()
        .join(","),
    [ohmPolygons]
  );

  return (
    <div style={{ height: "35vh", width: "100%", position: "relative" }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%", background: "#1a1a1a" }}
        zoomControl={true}
        attributionControl={false}
      >
        {/* [cl] CartoDB Dark Matter 타일 — 다크 UI와 일치 */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        {/* [cl] 선택된 엔티티 마커 */}
        {selectedEntities.map((entity) => (
          <CircleMarker
            key={entity.qid}
            center={[entity.lat, entity.lon]}
            radius={entity.tier === 1 ? 8 : entity.tier === 2 ? 6 : 4}
            pathOptions={{
              fillColor: TIER_COLORS[entity.tier] || "#6b7280",
              color: "#06b6d4",
              weight: 2,
              fillOpacity: 0.8,
            }}
            eventHandlers={{
              click: () => onMarkerClick(entity.qid),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span style={{ fontWeight: 600 }}>
                {entity.name_ko || entity.name_en}
              </span>
              <br />
              <span style={{ fontSize: 11, color: "#888" }}>
                {entity.qid}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* [cl] OHM 폴리곤 렌더링 */}
        {Array.from(ohmPolygons.entries()).map(([qid, geojson]) => (
          <GeoJSON
            key={`poly_${qid}_${polygonKey}`}
            data={geojson}
            style={{
              color: "#06b6d4",
              weight: 2,
              fillColor: "#06b6d4",
              fillOpacity: 0.15,
            }}
          />
        ))}

        <FitBounds entities={selectedEntities} />
      </MapContainer>

      {/* [cl] 선택 카운트 오버레이 */}
      {selectedEntities.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,0.7)",
            color: "#06b6d4",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {selectedEntities.length}개 선택됨
        </div>
      )}
    </div>
  );
}
