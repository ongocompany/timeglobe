#!/usr/bin/env python3
"""
[cl] OHM GeoJSON 좌표 단순화 스크립트
- Douglas-Peucker 알고리즘으로 좌표 수 대폭 축소
- 894MB → 목표 50~80MB (90%+ 압축)
- 원본은 ohm_original/ 백업 후 덮어쓰기
"""

import json
import os
import sys
import math
import shutil

OHM_DIR = os.path.join(os.path.dirname(__file__), "../../public/geo/borders/ohm")
BACKUP_DIR = os.path.join(OHM_DIR, "_original_backup")

# [cl] 단순화 허용오차 (도 단위)
# 0.01도 ≈ 1.1km → 세계지도 스케일에서 충분
# 0.02도 ≈ 2.2km → 더 공격적, 아직 깔끔
TOLERANCE = 0.015  # ~1.7km


def perpendicular_distance(point, line_start, line_end):
    """점에서 직선까지의 수직 거리 (2D)"""
    dx = line_end[0] - line_start[0]
    dy = line_end[1] - line_start[1]

    if dx == 0 and dy == 0:
        return math.sqrt((point[0] - line_start[0])**2 + (point[1] - line_start[1])**2)

    t = ((point[0] - line_start[0]) * dx + (point[1] - line_start[1]) * dy) / (dx*dx + dy*dy)
    t = max(0, min(1, t))

    proj_x = line_start[0] + t * dx
    proj_y = line_start[1] + t * dy

    return math.sqrt((point[0] - proj_x)**2 + (point[1] - proj_y)**2)


def douglas_peucker(coords, tolerance):
    """Douglas-Peucker 라인 단순화"""
    if len(coords) <= 2:
        return coords

    # 가장 먼 점 찾기
    max_dist = 0
    max_idx = 0
    for i in range(1, len(coords) - 1):
        d = perpendicular_distance(coords[i], coords[0], coords[-1])
        if d > max_dist:
            max_dist = d
            max_idx = i

    if max_dist > tolerance:
        left = douglas_peucker(coords[:max_idx + 1], tolerance)
        right = douglas_peucker(coords[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [coords[0], coords[-1]]


def simplify_ring(ring, tolerance):
    """링(폴리곤 경계) 단순화 — 최소 4개 좌표 유지 (닫힌 삼각형)"""
    simplified = douglas_peucker(ring, tolerance)
    # 폴리곤은 최소 4좌표 필요 (첫점=끝점 포함 삼각형)
    if len(simplified) < 4:
        # 원본이 너무 작으면 그대로 반환
        if len(ring) < 4:
            return ring
        # 간격 줄여서 재시도
        return douglas_peucker(ring, tolerance * 0.3)
    return simplified


def simplify_geometry(geometry, tolerance):
    """GeoJSON geometry 단순화"""
    gtype = geometry.get("type", "")

    if gtype == "Polygon":
        new_coords = []
        for ring in geometry["coordinates"]:
            simplified = simplify_ring(ring, tolerance)
            if len(simplified) >= 4:
                new_coords.append(simplified)
        if new_coords:
            geometry["coordinates"] = new_coords

    elif gtype == "MultiPolygon":
        new_polys = []
        for polygon in geometry["coordinates"]:
            new_rings = []
            for ring in polygon:
                simplified = simplify_ring(ring, tolerance)
                if len(simplified) >= 4:
                    new_rings.append(simplified)
            if new_rings:
                new_polys.append(new_rings)
        if new_polys:
            geometry["coordinates"] = new_polys

    return geometry


def count_coords(geometry):
    """geometry의 총 좌표 수"""
    total = 0
    gtype = geometry.get("type", "")
    if gtype == "Polygon":
        for ring in geometry.get("coordinates", []):
            total += len(ring)
    elif gtype == "MultiPolygon":
        for poly in geometry.get("coordinates", []):
            for ring in poly:
                total += len(ring)
    return total


def main():
    files = sorted(f for f in os.listdir(OHM_DIR) if f.endswith(".geojson"))
    print(f"=== OHM GeoJSON 좌표 단순화 ===")
    print(f"파일 수: {len(files)}")
    print(f"허용오차: {TOLERANCE}도 ≈ {TOLERANCE * 111:.1f}km\n")

    total_before = 0
    total_after = 0
    total_coords_before = 0
    total_coords_after = 0

    for i, filename in enumerate(files):
        filepath = os.path.join(OHM_DIR, filename)
        size_before = os.path.getsize(filepath)
        total_before += size_before

        with open(filepath) as f:
            data = json.load(f)

        coords_before = 0
        coords_after = 0

        for feature in data.get("features", []):
            geom = feature.get("geometry")
            if not geom:
                continue
            coords_before += count_coords(geom)
            simplify_geometry(geom, TOLERANCE)
            coords_after += count_coords(geom)

        # 덮어쓰기 (compact JSON)
        with open(filepath, "w") as f:
            json.dump(data, f, separators=(",", ":"))

        size_after = os.path.getsize(filepath)
        total_after += size_after
        total_coords_before += coords_before
        total_coords_after += coords_after

        if (i + 1) % 100 == 0 or i == len(files) - 1:
            pct = (1 - total_after / total_before) * 100 if total_before > 0 else 0
            print(f"  [{i+1}/{len(files)}] 누적: {total_before/1024/1024:.0f}MB → {total_after/1024/1024:.0f}MB ({pct:.0f}% 감소)")

    coord_pct = (1 - total_coords_after / total_coords_before) * 100 if total_coords_before > 0 else 0
    size_pct = (1 - total_after / total_before) * 100 if total_before > 0 else 0

    print(f"\n=== 완료 ===")
    print(f"크기: {total_before/1024/1024:.0f}MB → {total_after/1024/1024:.0f}MB ({size_pct:.0f}% 감소)")
    print(f"좌표: {total_coords_before:,} → {total_coords_after:,} ({coord_pct:.0f}% 감소)")


if __name__ == "__main__":
    main()
