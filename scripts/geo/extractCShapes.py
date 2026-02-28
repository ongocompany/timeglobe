#!/usr/bin/env python3
# [cl] CShapes 2.0 → 연도별 GeoJSON 추출 스크립트
# 원본: scripts/geo/cshapes/CShapes-2.0.geojson (ETH ICR, CC-BY-NC-SA 4.0)
# 출력: public/geo/borders/cshapes_YYYY.geojson
#
# CShapes는 이벤트 기반: 각 폴리곤에 시작/종료 연도가 있어서
# 특정 연도에 유효한 폴리곤만 필터링하면 그 해의 국경을 얻을 수 있음

import json
import os
import sys

# ── CShapes cntry_name → 기존 ENTITY_RULES NAME 매핑 ──
# 매핑이 없으면 cntry_name 그대로 사용
CSHAPES_TO_NAME = {
    "United States of America": "United States",
    "United Kingdom": "United Kingdom",
    "Korea": "Korea",
    "Korea, Republic of": "Korea, Republic of",
    "Korea, People's Republic of": "Korea, Democratic People's Republic of",
    "Russia (Soviet Union)": "USSR",
    "German Federal Republic": "West Germany",
    "German Democratic Republic": "East Germany",
    "Burkina Faso (Upper Volta)": "Burkina Faso",
    "Cambodia (Kampuchea)": "Cambodia",
    "Congo, Democratic Republic of (Zaire)": "Zaire",
    "Myanmar (Burma)": "Burma",
    "Yemen (Arab Republic of Yemen)": "Yemen",
    "Yemen, People's Republic of": "Yemen",
    "Sri Lanka (Ceylon)": "Sri Lanka",
    "Tanzania/Tanganyika": "Tanzania, United Republic of",
    "Zimbabwe (Rhodesia)": "Zimbabwe",
    "Iran (Persia)": "Iran",
    "Turkey (Ottoman Empire)": "Turkey",
    "Thailand": "Thailand",
    "Cote D'Ivoire": "Ivory Coast",
    "British Somaliland (Somaliland Republic)": "British Somaliland",
    "Italian Somaliland": "Italian Somaliland",
    "Ruanda": "Rwanda",
    "Gambia": "Gambia, The",
    "Eswatini (Swaziland)": "Swaziland",
    "Timor Leste": "Timor-Leste",
    "Samoa/Western Samoa": "Samoa",
    "Comoros": "Comoros",
    "Surinam": "Suriname",
    "Trinidad and Tobago": "Trinidad",
    "Dominica": "Dominica",
    "Belarus (Byelorussia)": "Byelarus",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Macedonia (Former Yugoslav Republic of)": "Macedonia",
}


def simplify_coords(coords, precision=2):
    """좌표 소수점 축소 (precision=2 → ~1km 정확도, 파일 크기 대폭 감소)"""
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], precision), round(coords[1], precision)]
    return [simplify_coords(c, precision) for c in coords]


def decimate_ring(ring, min_points=4, nth=3):
    """링 좌표를 nth개마다 하나씩 추출 (Douglas-Peucker 대신 간단한 방법)"""
    if len(ring) <= min_points:
        return ring
    decimated = [ring[i] for i in range(0, len(ring), nth)]
    # 폐합 링이면 마지막 점을 첫 점과 동일하게
    if ring[0] != ring[-1] or decimated[-1] != decimated[0]:
        decimated.append(ring[0] if ring[0] == ring[-1] else decimated[0])
    if len(decimated) < min_points:
        return ring
    return decimated


def simplify_geometry(geometry, precision=2, decimate_nth=3):
    """지오메트리 경량화: 좌표 소수점 축소 + 데시메이션"""
    gtype = geometry.get("type", "")
    coords = geometry.get("coordinates", [])

    if gtype == "Polygon":
        new_coords = []
        for ring in coords:
            decimated = decimate_ring(ring, nth=decimate_nth)
            new_coords.append(simplify_coords(decimated, precision))
        return {"type": gtype, "coordinates": new_coords}

    elif gtype == "MultiPolygon":
        new_coords = []
        for polygon in coords:
            new_poly = []
            for ring in polygon:
                decimated = decimate_ring(ring, nth=decimate_nth)
                new_poly.append(simplify_coords(decimated, precision))
            new_coords.append(new_poly)
        return {"type": gtype, "coordinates": new_coords}

    return geometry


def extract_year(features, year):
    """특정 연도에 유효한 피처들 필터링 + NAME 속성 추가"""
    result = []
    for f in features:
        p = f["properties"]
        if p["gwsyear"] <= year and p["gweyear"] >= year:
            name = p["cntry_name"]
            mapped_name = CSHAPES_TO_NAME.get(name, name)

            new_props = {
                "NAME": mapped_name,
                "cshapes_name": name,
                "caplong": p.get("caplong"),
                "caplat": p.get("caplat"),
                "capname": p.get("capname"),
            }

            result.append({
                "type": "Feature",
                "properties": new_props,
                "geometry": simplify_geometry(f["geometry"]),
            })
    return result


def find_transition_years(features):
    """국경 변동이 일어나는 연도 수집"""
    years = set()
    for f in features:
        p = f["properties"]
        years.add(p["gwsyear"])
        # 종료연도+1 = 새 상태 시작
        if p["gweyear"] < 2019:
            years.add(p["gweyear"] + 1)
    return sorted(years)


if __name__ == "__main__":
    INPUT = os.path.join(os.getcwd(), "scripts", "geo", "cshapes", "CShapes-2.0.geojson")
    OUTPUT_DIR = os.path.join(os.getcwd(), "public", "geo", "borders")

    if not os.path.exists(INPUT):
        print(f"ERROR: {INPUT} not found. Run download first.")
        sys.exit(1)

    print("=== CShapes 2.0 → 연도별 GeoJSON 추출 ===\n")

    with open(INPUT, "r", encoding="utf-8") as f:
        cshapes = json.load(f)

    features = cshapes["features"]
    print(f"원본: {len(features)}개 폴리곤 레코드")

    # 변동 연도 추출
    transition_years = find_transition_years(features)
    print(f"국경 변동 연도: {len(transition_years)}개 ({transition_years[0]}~{transition_years[-1]})")

    # 기존 historical-basemaps 스냅샷과 겹치는 연도 확인
    existing_hb = {1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010}
    overlap = existing_hb & set(transition_years)
    print(f"기존 스냅샷과 겹치는 연도: {sorted(overlap)}")

    total_size = 0
    file_count = 0

    for year in transition_years:
        year_features = extract_year(features, year)
        if not year_features:
            continue

        geojson = {
            "type": "FeatureCollection",
            "features": year_features,
        }

        output_path = os.path.join(OUTPUT_DIR, f"cshapes_{year}.geojson")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))

        size_kb = os.path.getsize(output_path) / 1024
        total_size += size_kb
        file_count += 1
        print(f"  cshapes_{year}.geojson: {len(year_features)} features | {size_kb:.0f}KB")

    print(f"\n완료! {file_count}개 파일 | 총 {total_size/1024:.1f}MB")
    print(f"출력: {OUTPUT_DIR}/cshapes_*.geojson")
