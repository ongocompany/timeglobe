#!/usr/bin/env python3
"""
[cl] OHM(OpenHistoricalMap) 폴리곤 다운로드 스크립트
- 매칭된 relation ID로 Overpass API에서 geometry 다운로드
- OSM relation → GeoJSON 변환
- public/geo/borders/ohm/ 에 저장
"""

import json
import urllib.request
import urllib.parse
import ssl
import time
import os
import sys
import hashlib

# SSL 설정 (macOS)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

OHM_OVERPASS = "https://overpass-api.openhistoricalmap.org/api/interpreter"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../../public/geo/borders/ohm")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, "_progress.json")

# Rate limit: 1 request per 2 seconds
RATE_LIMIT = 2.0
# Batch size for multi-relation queries
BATCH_SIZE = 5


def load_progress():
    """이미 다운로드한 relation ID 목록 로드"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"downloaded": [], "failed": [], "skipped": []}


def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def fetch_relation_geom(relation_id):
    """Overpass API로 relation geometry 다운로드"""
    query = f"""
[out:json];
relation({relation_id});
out geom;
"""
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        OHM_OVERPASS, data=data, headers={"User-Agent": "TimeGlobe/1.0 (historical-borders)"}
    )

    resp = urllib.request.urlopen(req, context=ctx, timeout=60)
    result = json.loads(resp.read())
    return result.get("elements", [])


def osm_relation_to_geojson(element):
    """OSM relation element → GeoJSON Feature 변환"""
    tags = element.get("tags", {})
    members = element.get("members", [])

    # outer/inner rings 분리
    outer_rings = []
    inner_rings = []

    for member in members:
        role = member.get("role", "")
        geom = member.get("geometry", [])
        if not geom:
            continue

        coords = [[pt["lon"], pt["lat"]] for pt in geom]

        if role == "inner":
            inner_rings.append(coords)
        else:
            # outer 또는 빈 role → outer로 취급
            outer_rings.append(coords)

    if not outer_rings:
        return None

    # ring 연결: 끝점과 시작점이 가까운 ring끼리 병합
    merged_outers = merge_rings(outer_rings)
    merged_inners = merge_rings(inner_rings) if inner_rings else []

    # GeoJSON 구성
    if len(merged_outers) == 1 and not merged_inners:
        geometry = {"type": "Polygon", "coordinates": [merged_outers[0]]}
    else:
        # MultiPolygon: 각 outer에 해당 inner 포함
        polygons = []
        for outer in merged_outers:
            polygon = [outer]
            # inner rings는 단순히 추가 (정밀한 containment 체크는 생략)
            polygons.append(polygon)
        if merged_inners:
            # 첫 번째 polygon에 inner 추가 (단순화)
            for inner in merged_inners:
                polygons[0].append(inner)
        geometry = {"type": "MultiPolygon", "coordinates": [p for p in polygons]}

    # properties
    properties = {
        "ohm_id": element.get("id"),
        "name": tags.get("name", ""),
        "name_en": tags.get("name:en", ""),
        "name_ko": tags.get("name:ko", ""),
        "start_date": tags.get("start_date", ""),
        "end_date": tags.get("end_date", ""),
        "wikidata": tags.get("wikidata", ""),
        "admin_level": tags.get("admin_level", ""),
    }

    return {"type": "Feature", "properties": properties, "geometry": geometry}


def merge_rings(rings):
    """끝점-시작점 연결로 ring 병합"""
    if not rings:
        return []

    merged = []
    used = [False] * len(rings)

    for i, ring in enumerate(rings):
        if used[i]:
            continue

        current = list(ring)
        used[i] = True
        changed = True

        while changed:
            changed = False
            for j, other in enumerate(rings):
                if used[j]:
                    continue

                # 현재 끝 == 다른 시작
                if (
                    len(current) > 0
                    and len(other) > 0
                    and abs(current[-1][0] - other[0][0]) < 0.0001
                    and abs(current[-1][1] - other[0][1]) < 0.0001
                ):
                    current.extend(other[1:])
                    used[j] = True
                    changed = True
                # 현재 끝 == 다른 끝 (역순)
                elif (
                    len(current) > 0
                    and len(other) > 0
                    and abs(current[-1][0] - other[-1][0]) < 0.0001
                    and abs(current[-1][1] - other[-1][1]) < 0.0001
                ):
                    current.extend(reversed(other[:-1]))
                    used[j] = True
                    changed = True
                # 현재 시작 == 다른 끝
                elif (
                    len(current) > 0
                    and len(other) > 0
                    and abs(current[0][0] - other[-1][0]) < 0.0001
                    and abs(current[0][1] - other[-1][1]) < 0.0001
                ):
                    current = list(other) + current[1:]
                    used[j] = True
                    changed = True

        # 닫힌 ring인지 확인, 아니면 강제로 닫기
        if len(current) > 2:
            if (
                abs(current[0][0] - current[-1][0]) > 0.0001
                or abs(current[0][1] - current[-1][1]) > 0.0001
            ):
                current.append(current[0])
            merged.append(current)

    return merged


def main():
    # 매칭 데이터 로드
    match_file = "/tmp/ohm_relations_to_download.json"
    if not os.path.exists(match_file):
        print("❌ 매칭 데이터 없음. 먼저 매칭 분석을 실행하세요.")
        sys.exit(1)

    with open(match_file) as f:
        relations = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    progress = load_progress()
    downloaded_ids = set(progress["downloaded"])

    # 중복 제거 (같은 relation ID가 여러 엔티티에 매칭될 수 있음)
    unique_relations = {}
    for r in relations:
        rid = r["ohm_id"]
        if rid not in unique_relations:
            unique_relations[rid] = r

    total = len(unique_relations)
    todo = {k: v for k, v in unique_relations.items() if k not in downloaded_ids}

    print(f"=== OHM 폴리곤 다운로드 ===")
    print(f"전체: {total}개 / 완료: {len(downloaded_ids)}개 / 남음: {len(todo)}개\n")

    success = 0
    fail = 0

    for i, (rid, info) in enumerate(todo.items()):
        name = info.get("our_name_ko", info.get("our_name_en", "?"))
        ohm_name = info.get("ohm_name", "")
        tier = info.get("our_tier", "?")

        # 파일명: ohm_{relation_id}.geojson
        filename = f"ohm_{rid}.geojson"
        filepath = os.path.join(OUTPUT_DIR, filename)

        print(f"[{i+1}/{len(todo)}] T{tier} {name} → {ohm_name} (rid:{rid})...", end=" ", flush=True)

        try:
            elements = fetch_relation_geom(rid)
            if not elements:
                print("⚠️ 데이터 없음")
                progress["skipped"].append(rid)
                save_progress(progress)
                time.sleep(RATE_LIMIT)
                continue

            feature = osm_relation_to_geojson(elements[0])
            if not feature:
                print("⚠️ geometry 변환 실패")
                progress["skipped"].append(rid)
                save_progress(progress)
                time.sleep(RATE_LIMIT)
                continue

            # 우리 데이터 정보 추가
            feature["properties"]["our_name_en"] = info.get("our_name_en", "")
            feature["properties"]["our_name_ko"] = info.get("our_name_ko", "")
            feature["properties"]["our_tier"] = tier

            # GeoJSON FeatureCollection으로 저장
            geojson = {"type": "FeatureCollection", "features": [feature]}

            with open(filepath, "w") as f:
                json.dump(geojson, f)

            size_kb = os.path.getsize(filepath) / 1024
            print(f"✅ {size_kb:.1f}KB")

            progress["downloaded"].append(rid)
            save_progress(progress)
            success += 1

        except Exception as e:
            print(f"❌ {e}")
            progress["failed"].append(rid)
            save_progress(progress)
            fail += 1

        time.sleep(RATE_LIMIT)

    print(f"\n=== 완료 ===")
    print(f"성공: {success} / 실패: {fail} / 전체: {total}")
    print(f"저장 위치: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
