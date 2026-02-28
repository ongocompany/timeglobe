#!/usr/bin/env python3
"""
[cl] entity_timeline.json 빌드 스크립트
Gemini 검증 결과 + HB 존속기간 + 메타데이터를 병합하여
국가명 라벨용 독립 데이터 생성

사용법:
  python3 scripts/geo/buildEntityTimeline.py

출력:
  public/geo/borders/entity_timeline.json
"""

import json
import os
import glob
import re
import sys

BASE_DIR = os.path.join(os.path.dirname(__file__), "../..")
META_DIR = os.path.join(BASE_DIR, "public/geo/borders/metadata")
GEO_DIR = os.path.join(BASE_DIR, "public/geo/borders")
VALIDATION_DIR = os.path.join(os.path.dirname(__file__), "validation")
OUTPUT_PATH = os.path.join(BASE_DIR, "public/geo/borders/entity_timeline.json")


# ─── 날짜 파서 ───────────────────────────────────────────────

def parse_year(s: str) -> int | None:
    """
    Gemini actual_from/actual_until 문자열을 정수 연도로 변환.
    "BC 3000" → -3000, "AD 476" → 476, "c. AD 750" → 750
    파싱 불가 → None
    """
    if not s or not isinstance(s, str):
        return None

    s = s.strip()

    # "Present" / "현재" / "현재까지"
    if s in ("Present", "현재", "현재까지"):
        return 2025
    # "선사 시대부터" 등 한글만
    if re.match(r'^[가-힣\s]+$', s):
        return None

    # "/" 구분자가 있으면 첫번째만 사용
    # "BC 2333 (Gojoseon) / AD 1392 (Joseon Dynasty)" → "BC 2333 (Gojoseon)"
    if " / " in s:
        s = s.split(" / ")[0].strip()

    # 괄호 제거: "BC 2025 (Old Assyrian)" → "BC 2025"
    s = re.sub(r'\s*\(.*?\)', '', s).strip()

    # "c. " 접두사 제거
    s = re.sub(r'^c\.\s*', '', s).strip()

    # "AD 1500s" → "AD 1500"
    s = re.sub(r'(\d+)s$', r'\1', s)

    # "N세기" → 세기 변환
    # "AD 11세기" → AD 1000, "BC 4세기" → BC 300
    m = re.match(r'^(BC |AD )(\d+)세기(\s.*)?$', s)
    if m:
        prefix = m.group(1)
        century = int(m.group(2))
        year = (century - 1) * 100
        if "후반" in (m.group(3) or ""):
            year += 50
        if "중반" in (m.group(3) or ""):
            year += 50
        if prefix == "BC ":
            return -year if year > 0 else -1
        return year if year > 0 else 1

    # 표준: "BC 3000" / "AD 476"
    m = re.match(r'^BC\s+(\d+)$', s)
    if m:
        return -int(m.group(1))
    m = re.match(r'^AD\s+(\d+)$', s)
    if m:
        return int(m.group(1))

    # 숫자만: "476" → AD 476
    m = re.match(r'^(\d+)$', s)
    if m:
        return int(m.group(1))

    return None


# ─── GeoJSON Centroid 계산 ───────────────────────────────────

def calc_centroid(geometry) -> tuple[float, float] | None:
    """GeoJSON geometry에서 centroid(중심점) 계산"""
    coords = []
    gtype = geometry.get("type", "")

    if gtype == "Polygon":
        coords = geometry["coordinates"][0]  # outer ring
    elif gtype == "MultiPolygon":
        # 가장 큰 폴리곤 사용
        best = []
        for poly in geometry["coordinates"]:
            if len(poly[0]) > len(best):
                best = poly[0]
        coords = best

    if not coords:
        return None

    sum_lng = sum(c[0] for c in coords)
    sum_lat = sum(c[1] for c in coords)
    n = len(coords)
    return (round(sum_lng / n, 2), round(sum_lat / n, 2))


def extract_all_centroids() -> dict[str, tuple[float, float]]:
    """모든 HB GeoJSON에서 엔티티별 centroid 추출"""
    centroids: dict[str, tuple[float, float]] = {}

    geo_files = sorted(glob.glob(os.path.join(GEO_DIR, "world_*.geojson")))
    print(f"  GeoJSON 파일에서 centroid 추출 중... ({len(geo_files)}개)")

    for fpath in geo_files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                geo = json.load(f)
        except Exception:
            continue

        for feat in geo.get("features", []):
            name = feat.get("properties", {}).get("NAME")
            if not name or name in centroids:
                continue
            geom = feat.get("geometry")
            if not geom:
                continue
            c = calc_centroid(geom)
            if c:
                centroids[name] = c

    print(f"  → {len(centroids)}개 엔티티 centroid 추출 완료")
    return centroids


# ─── Gemini missing 엔티티 수동 좌표 ───────────────────────

MANUAL_COORDS = {
    # [cl] Gemini가 missing으로 판정한 주요 국가들의 대략적 수도/중심 좌표
    "Akkadian Empire": (44.42, 33.10),         # Akkad, 메소포타미아
    "Sumerian City-States": (45.99, 31.32),    # Ur
    "Xia Dynasty": (112.45, 34.62),            # 뤄양 인근
    "Old Kingdom of Egypt": (31.13, 29.98),    # 멤피스
    "Minoan Civilization": (25.16, 35.30),     # 크노소스
    "Mycenaean Civilization": (22.76, 37.73),  # 미케네
    "New Kingdom of Egypt": (32.66, 25.70),    # 테베
    "Mitanni": (41.0, 37.0),                   # 북메소포타미아
    "Phoenicia": (35.50, 33.89),               # 비블로스/시돈
    "United Monarchy of Israel": (35.22, 31.78), # 예루살렘
    "Neo-Assyrian Empire": (43.15, 36.36),     # 니네베
    "Kingdom of Judah": (35.22, 31.78),        # 예루살렘
    "Median Empire": (48.52, 34.80),           # 엑바타나
    "Roman Kingdom": (12.49, 41.89),           # 로마
    "Etruscan Civilization": (11.25, 42.77),   # 에트루리아
    "Gojoseon": (125.75, 39.02),               # 평양 인근
    "Kingdom of D'mt": (38.93, 13.54),         # 에리트레아
    "Kingdom of Funan": (104.85, 11.56),       # 캄보디아
    "Silla": (129.21, 35.84),                  # 경주
    "Kingdom of Denmark": (12.57, 55.68),      # 코펜하겐
    "Kingdom of Norway": (10.75, 59.91),       # 오슬로
    "Kingdom of Hungary": (19.04, 47.50),      # 부다페스트
    "Cao Wei": (113.65, 34.75),                # 뤄양
    "Shu Han": (104.07, 30.57),                # 청두
    "Eastern Wu": (118.78, 32.06),             # 난징
    "Western Jin Dynasty": (112.45, 34.62),    # 뤄양
    "Northern Dynasties": (114.35, 36.10),     # 업성
    "Southern Dynasties": (118.78, 32.06),     # 난징 (건강)
    "Goryeo": (126.57, 37.97),                 # 개성
    "Kingdom of England": (-0.12, 51.51),      # 런던
    "Kingdom of Scotland": (-3.19, 55.95),     # 에든버러
    "Kievan Rus'": (30.52, 50.45),             # 키이우
    "Jin Dynasty (Jurchen)": (125.32, 43.88),  # 상경회녕부
    "Yuan Dynasty": (116.39, 39.91),           # 대도(베이징)
    "Majapahit Empire": (112.43, -7.46),       # 자바
    "Khwarezmian Empire": (60.63, 41.55),      # 우르겐치
    "Kingdom of Bohemia": (14.42, 50.08),      # 프라하
    "Kingdom of Poland": (21.01, 52.23),       # 바르샤바
    "Kingdom of Portugal": (-9.14, 38.74),     # 리스본
}


# ─── 메인 빌드 로직 ───────────────────────────────────────────

def main():
    print("=" * 60)
    print("[cl] entity_timeline.json 빌드 시작")
    print("=" * 60)

    # ── 1. 데이터 로드 ──
    print("\n[1] 데이터 로드...")

    # 1a. Gemini 검증 결과
    val_path = os.path.join(VALIDATION_DIR, "results/all_validation_results.json")
    with open(val_path, "r", encoding="utf-8") as f:
        validations = json.load(f)
    print(f"  Gemini 검증 결과: {len(validations)}개")

    # 1b. HB 존속기간
    lifespan_path = os.path.join(VALIDATION_DIR, "all_entity_lifespans.json")
    with open(lifespan_path, "r", encoding="utf-8") as f:
        lifespans = json.load(f)
    print(f"  HB 존속기간: {len(lifespans)}개")

    # 1c. 메타데이터 (모든 스냅샷에서 통합)
    meta_all: dict[str, dict] = {}  # entity → 가장 최신 메타데이터
    meta_files = sorted(glob.glob(os.path.join(META_DIR, "*.json")))
    for fpath in meta_files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for key, meta in data.items():
            meta_all[key] = meta  # 이후 스냅샷이 덮어씀 (최신 우선)
    print(f"  메타데이터 통합: {len(meta_all)}개 엔티티")

    # 1d. GeoJSON centroid
    centroids = extract_all_centroids()

    # 1e. CShapes GeoJSON에서도 centroid (caplong/caplat)
    cshapes_files = sorted(glob.glob(os.path.join(GEO_DIR, "cshapes_*.geojson")))
    if cshapes_files:
        print(f"  CShapes에서 좌표 보충 중... ({len(cshapes_files)}개)")
        for fpath in cshapes_files:
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    geo = json.load(f)
                for feat in geo.get("features", []):
                    props = feat.get("properties", {})
                    name = props.get("NAME", props.get("cntry_name"))
                    if not name or name in centroids:
                        continue
                    # CShapes에는 caplong/caplat이 있을 수 있음
                    clng = props.get("caplong")
                    clat = props.get("caplat")
                    if clng and clat:
                        centroids[name] = (round(float(clng), 2), round(float(clat), 2))
                    else:
                        geom = feat.get("geometry")
                        if geom:
                            c = calc_centroid(geom)
                            if c:
                                centroids[name] = c
            except Exception:
                continue

    # ── 2. Gemini 결과 중복제거 및 인덱싱 ──
    print("\n[2] Gemini 결과 처리...")

    # entity name → best validation entry
    gemini_by_name: dict[str, dict] = {}
    gemini_by_ko: dict[str, dict] = {}  # Korean name fallback
    status_priority = {"correct": 0, "wrong_start": 1, "wrong_end": 1,
                       "wrong_both": 2, "gap": 3, "missing": 4, "extra": 5}

    for entry in validations:
        ename = entry.get("entity", "")
        eko = entry.get("entity_ko", "")
        priority = status_priority.get(entry.get("status", ""), 9)

        # entity name 기준 중복제거 (낮은 priority = 더 좋은 결과)
        if ename:
            existing = gemini_by_name.get(ename)
            if not existing or priority < status_priority.get(existing.get("status", ""), 9):
                gemini_by_name[ename] = entry
        if eko:
            existing = gemini_by_ko.get(eko)
            if not existing or priority < status_priority.get(existing.get("status", ""), 9):
                gemini_by_ko[eko] = entry

    print(f"  중복제거 후 Gemini 엔티티: {len(gemini_by_name)}개 (이름), {len(gemini_by_ko)}개 (한국어)")

    # ── 3. 타임라인 엔트리 빌드 ──
    print("\n[3] 타임라인 엔트리 빌드...")
    timeline = []
    matched_gemini = 0
    unmatched = 0

    for key, ls in lifespans.items():
        # 메타데이터 조회
        meta = meta_all.get(key, {})

        # Gemini 매칭 시도: 이름 → 한국어명
        gem = gemini_by_name.get(ls["en"]) or gemini_by_ko.get(ls["ko"])

        # 존속기간 결정
        if gem and gem.get("status") != "extra":
            start = parse_year(gem.get("actual_from")) or ls["first_appearance"]
            end = parse_year(gem.get("actual_until")) or ls["last_appearance"]
            source = "gemini_corrected"
            matched_gemini += 1
        else:
            start = ls["first_appearance"]
            end = ls["last_appearance"]
            source = "hb_lifespan"
            unmatched += 1

        # 좌표 결정: capital_coords > centroid > None
        coords = None
        if meta.get("capital_coords"):
            coords = meta["capital_coords"]
        elif key in centroids:
            coords = list(centroids[key])
        # __virtual__ 접두사 제거해서도 시도
        elif key.replace("__virtual__", "") in centroids:
            coords = list(centroids[key.replace("__virtual__", "")])

        if not coords:
            # 좌표 없으면 스킵 (렌더링 불가)
            continue

        entry = {
            "id": key,
            "name_en": meta.get("display_name_en") or ls.get("en") or key,
            "name_ko": meta.get("display_name_ko") or ls.get("ko") or "",
            "name_local": meta.get("display_name_local", ""),
            "start_year": start,
            "end_year": end,
            "tier": ls.get("tier") or meta.get("tier") or 3,
            "fill_color": meta.get("fill_color", "#AAAAAA"),
            "coords": coords,
            "is_colony": meta.get("is_colony", False),
            "colonial_ruler_ko": meta.get("colonial_ruler_ko"),
            "source": source,
        }
        timeline.append(entry)

    print(f"  Gemini 매칭: {matched_gemini}개, 미매칭(HB 원본): {unmatched}개")

    # ── 4. Missing 엔티티 추가 ──
    print("\n[4] Missing 엔티티 추가...")
    existing_ids = {e["id"] for e in timeline}
    existing_en = {e["name_en"] for e in timeline}
    missing_added = 0

    for entry in validations:
        if entry.get("status") != "missing":
            continue
        ename = entry.get("entity", "")
        if ename in existing_en or ename in existing_ids:
            continue

        start = parse_year(entry.get("actual_from"))
        end = parse_year(entry.get("actual_until"))
        if not start or not end:
            continue

        coords = MANUAL_COORDS.get(ename)
        if not coords:
            continue

        timeline.append({
            "id": ename,
            "name_en": ename,
            "name_ko": entry.get("entity_ko", ""),
            "name_local": "",
            "start_year": start,
            "end_year": end,
            "tier": 1 if any(kw in ename for kw in ("Empire", "Kingdom", "Dynasty")) else 2,
            "fill_color": "#AAAAAA",
            "coords": list(coords),
            "is_colony": False,
            "colonial_ruler_ko": None,
            "source": "gemini_missing",
        })
        missing_added += 1

    print(f"  Missing 엔티티 추가: {missing_added}개")

    # ── 5. 정렬 및 저장 ──
    timeline.sort(key=lambda e: (e["start_year"], e["name_en"]))

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False)
    file_size = os.path.getsize(OUTPUT_PATH)

    # ── 6. 요약 ──
    print("\n" + "=" * 60)
    print("[결과 요약]")
    print(f"  총 엔트리: {len(timeline)}개")
    print(f"  파일 크기: {file_size / 1024:.0f}KB")
    sources = {}
    for e in timeline:
        sources[e["source"]] = sources.get(e["source"], 0) + 1
    for s, c in sorted(sources.items()):
        print(f"    {s}: {c}개")
    tiers = {}
    for e in timeline:
        tiers[e["tier"]] = tiers.get(e["tier"], 0) + 1
    for t in sorted(tiers):
        label = {1: "제국/왕국", 2: "일반국가", 3: "부족/문화"}.get(t, "?")
        print(f"  Tier {t} ({label}): {tiers[t]}개")

    # 좌표 없어서 스킵된 엔티티 수
    skipped = len(lifespans) - (len(timeline) - missing_added)
    if skipped > 0:
        print(f"  좌표 없이 스킵: {skipped}개")

    print(f"\n  출력: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
