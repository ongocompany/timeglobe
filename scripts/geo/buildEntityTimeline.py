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
from collections import defaultdict

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


# ─── 중복 엔티티 제거 목록 ─────────────────────────────────────
# [cl] HB 데이터에 같은 나라가 다른 ID로 등록된 경우, 하나만 남기고 제거
DEDUP_REMOVE = {
    "Manchu Empire",          # → Qing Empire (청나라 중복)
    "United States",          # → United States of America
    "United Kingdom of Great Britain and Ireland",  # → United Kingdom
    "Ainus",                  # → Ainu
    "M?ori",                  # → Maori (ā가 ?로 깨진 인코딩 문제)
    "Khoiasan",               # → Khoisan (오타)
    "Bantou",                 # → Bantu (프랑스어 표기)
    "Bukara Khanate",         # → Bokhara Khanate (오타)
    "Sultinate of Zanzibar",  # → Zanzibar (오타+중복)
    "Barbados (UK)",          # → Barbados와 시기 겹침
    "Saint Kitts and Nevis (UK)",  # → Saint Kitts and Nevis와 시기 겹침
    "Mysore (Indian princely state)",  # → Mysore와 중복
    "Imperial Japan",         # → Japan이 660~2025 전체 커버 (name_ko도 '일본'으로 동일)
    # ── 호주 식민지 (end_year=2025 잘못된 데이터, __forced__australia가 1901+ 커버) ──
    "New South Wales (UK)",
    "Victoria (UK)",
    "South Australia (UK)",
    "Queensland (UK)",
    "Western Australia (UK)",
    "Northern Territory (UK)",
    "Tasmania (UK)",
    # ── 같은 나라 다른 이름 (중복) ──
    "India",                  # → British Raj(1757~1947) + __forced__republic_of_india(1947+)
    "Ceylon (Dutch)",         # → Ceylon이 같은 기간 커버
    "Rajputana",              # → Rajastan과 동일 엔티티
}

# ─── 한국어 이름 충돌 해소 ─────────────────────────────────────
# [cl] 서로 다른 엔티티인데 번역이 같아진 경우 구별
NAME_KO_OVERRIDES = {
    "Imperial Japan": "일본",               # "대일본제국" → "일본" (한국인 정서 고려)
    "Imperial Hungary": "헝가리 (오스트리아-헝가리)",
    "Swedes and Goths": "스웨덴 (중세)",
    "Dahomey": "다호메이 왕국",
    "Burmese": "버마족",
    "Imerina": "이메리나 왕국",
    "Angola (Portugal)": "앙골라 (포르투갈령)",
    "Senegal (FR)": "세네갈 (프랑스령)",
    "Guyana (Netherlands)": "가이아나 (네덜란드령)",
    "Aché": "아체족 (파라과이)",
}

# ─── 식민 본국 이름 정규화 ─────────────────────────────────────
# [cl] "대영제국" 같은 표현 대신 간결한 국명으로 통일
COLONIAL_RULER_FIX = {
    "대영제국": "영국",
}

# ─── 강제 추가 엔티티 ──────────────────────────────────────────
# [cl] HB/Gemini에 없지만 반드시 표시해야 하는 엔티티
FORCED_ENTITIES = [
    # ── 한국 ──
    {
        "id": "__forced__korean_empire",
        "name_en": "Korean Empire",
        "name_ko": "대한제국",
        "name_local": "大韓帝國",
        "start_year": 1897, "end_year": 1910, "tier": 1,
        "fill_color": "#C0392B", "coords": [126.98, 37.57],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__korea_japanese_rule",
        "name_en": "Korea (Japanese Rule)",
        "name_ko": "한국",
        "name_local": "朝鮮",
        "start_year": 1910, "end_year": 1945, "tier": 1,
        "fill_color": "#922B21", "coords": [126.98, 37.57],
        "is_colony": True, "colonial_ruler_ko": "일본",
        "colony_label": "일제강점기", "source": "forced",
    },
    {
        "id": "__forced__south_korea",
        "name_en": "South Korea",
        "name_ko": "대한민국",
        "name_local": "大韓民國",
        "start_year": 1948, "end_year": 2025, "tier": 1,
        "fill_color": "#2E86C1", "coords": [127.77, 36.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__north_korea",
        "name_en": "North Korea",
        "name_ko": "북한",
        "name_local": "朝鮮民主主義人民共和國",
        "start_year": 1948, "end_year": 2025, "tier": 2,
        "fill_color": "#C0392B", "coords": [126.0, 40.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 중국 ──
    {
        "id": "__forced__republic_of_china",
        "name_en": "Republic of China",
        "name_ko": "중화민국",
        "name_local": "中華民國",
        "start_year": 1912, "end_year": 1949, "tier": 1,
        "fill_color": "#E74C3C", "coords": [108.0, 34.0],  # 중국 중부
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__prc",
        "name_en": "People's Republic of China",
        "name_ko": "중국",
        "name_local": "中華人民共和國",
        "start_year": 1949, "end_year": 2025, "tier": 1,
        "fill_color": "#E74C3C", "coords": [103.0, 35.0],  # 중국 중부
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 러시아 ──
    {
        "id": "__forced__soviet_union",
        "name_en": "Soviet Union",
        "name_ko": "소련",
        "name_local": "СССР",
        "start_year": 1922, "end_year": 1991, "tier": 1,
        "fill_color": "#C0392B", "coords": [80.0, 60.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__russian_federation",
        "name_en": "Russian Federation",
        "name_ko": "러시아",
        "name_local": "Российская Федерация",
        "start_year": 1991, "end_year": 2025, "tier": 1,
        "fill_color": "#2980B9", "coords": [80.0, 60.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 인도 ──
    {
        "id": "__forced__republic_of_india",
        "name_en": "India",
        "name_ko": "인도",
        "name_local": "भारत गणराज्य",
        "start_year": 1947, "end_year": 2025, "tier": 1,
        "fill_color": "#F39C12", "coords": [80.0, 22.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 브라질 ──
    {
        "id": "__forced__brazil_republic",
        "name_en": "Brazil",
        "name_ko": "브라질",
        "name_local": "República Federativa do Brasil",
        "start_year": 1889, "end_year": 2025, "tier": 1,
        "fill_color": "#27AE60", "coords": [-50.0, -14.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 호주 ──
    {
        "id": "__forced__australia",
        "name_en": "Australia",
        "name_ko": "호주",
        "name_local": "Commonwealth of Australia",
        "start_year": 1901, "end_year": 2025, "tier": 1,
        "fill_color": "#2E86C1", "coords": [134.0, -25.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    # ── 기타 근현대 주요국 (HB→현대 연결 누락분) ──
    {
        "id": "__forced__mexico",
        "name_en": "Mexico",
        "name_ko": "멕시코",
        "name_local": "Estados Unidos Mexicanos",
        "start_year": 1821, "end_year": 2025, "tier": 1,
        "fill_color": "#27AE60", "coords": [-102.0, 24.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__south_africa",
        "name_en": "South Africa",
        "name_ko": "남아프리카공화국",
        "name_local": "Republic of South Africa",
        "start_year": 1910, "end_year": 2025, "tier": 1,
        "fill_color": "#27AE60", "coords": [25.0, -29.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__pakistan",
        "name_en": "Pakistan",
        "name_ko": "파키스탄",
        "name_local": "اسلامی جمہوریۂ پاکستان",
        "start_year": 1947, "end_year": 2025, "tier": 2,
        "fill_color": "#27AE60", "coords": [69.0, 30.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__indonesia",
        "name_en": "Indonesia",
        "name_ko": "인도네시아",
        "name_local": "Republik Indonesia",
        "start_year": 1945, "end_year": 2025, "tier": 1,
        "fill_color": "#E74C3C", "coords": [118.0, -2.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
    {
        "id": "__forced__egypt_modern",
        "name_en": "Egypt",
        "name_ko": "이집트",
        "name_local": "جمهورية مصر العربية",
        "start_year": 1922, "end_year": 2025, "tier": 1,
        "fill_color": "#F4D03F", "coords": [30.0, 27.0],
        "is_colony": False, "colonial_ruler_ko": None, "source": "forced",
    },
]

# ─── 대국 라벨 좌표: 수도 → 국토 중심 ─────────────────────────
# [cl] 국토가 넓은데 수도가 구석에 있는 나라들의 라벨 위치 보정
LABEL_COORDS_OVERRIDE = {
    # 미국: DC → 미 대륙 중부 (캔자스)
    "United States of America": (-98.5, 39.5),
    # 캐나다: 오타와 → 캐나다 중부 (서스캐처원)
    "Canada": (-96.0, 56.0),
    # 러시아 제국: 모스크바 → 시베리아 방향
    "Russian Empire": (80.0, 60.0),
    # 러시아 차르국
    "Tsardom of Russia": (55.0, 57.0),
    # 청나라: 베이징 → 중국 중부
    "Qing Empire": (103.0, 35.0),
    # 명나라
    "Ming Empire": (108.0, 33.0),
    # 원나라
    "Yuan Dynasty": (108.0, 42.0),
    # 당나라
    "Tang Empire": (105.0, 35.0),
    # 한나라
    "Han Empire": (108.0, 34.0),
    # 몽골 제국
    "Mongol Empire": (100.0, 47.0),
    # 호주 (가장 넓은 식민지)
    "New South Wales (UK)": (147.0, -30.0),
    "Queensland (UK)": (146.0, -22.0),
    "South Australia (UK)": (136.0, -30.0),
    "Western Australia (UK)": (122.0, -26.0),
    "Northern Territory (UK)": (134.0, -20.0),
    "Victoria (UK)": (145.0, -37.0),
    # 브라질 제국
    "Kingdom of Brazil": (-50.0, -14.0),
    "Vice-Royalty of Brazil": (-50.0, -14.0),
    "Viceroyalty of Brazil": (-50.0, -14.0),
    # 영국령 인도
    "British Raj": (80.0, 22.0),
    "British East India Company": (80.0, 22.0),
    # 인도 (무굴 등)
    "Mughal Empire": (80.0, 24.0),
    "India": (80.0, 22.0),
    # 페르시아/이란
    "Achaemenid Empire": (52.0, 32.0),
    "Safavid Empire": (52.0, 33.0),
    "Qajar Empire": (52.0, 33.0),
    # 오스만 제국
    "Ottoman Empire": (33.0, 39.0),
    # 로마 제국
    "Roman Empire": (15.0, 42.0),
    # 아르헨티나
    "Argentina": (-64.0, -34.0),
    # 콩고
    "Belgian Congo": (23.0, -3.0),
    "Congo Free State": (23.0, -3.0),
    # 수단
    "Anglo-Egyptian Sudan": (30.0, 15.0),
    # 알제리
    "Algeria (FR)": (3.0, 28.0),
    # 리비아
    "Italian Libya": (17.0, 27.0),
}

# ─── 티어 수동 보정 ────────────────────────────────────────────
# [cl] HB는 "Kingdom/Empire" 이름 기준으로 Tier를 매겨서
# 하와이 왕국=Tier1, 미국=Tier2 같은 역전이 발생.
# 지정학적 중요도 기준으로 수동 보정.
TIER_OVERRIDES = {
    # ── Tier 2 → Tier 1로 승격 (근현대 열강/대국) ──
    "United States of America": 1,
    "France": 1,
    "Germany": 1,
    "Italy": 1,
    "Austria Hungary": 1,
    "Spain": 1,
    "Canada": 1,
    "Netherlands": 1,
    "Sweden": 1,
    "Sweden–Norway": 1,
    "Japan": 1,
    "Belgium": 1,
    "Switzerland": 1,
    "Poland": 1,
    "Kingdom of Brazil": 1,   # 이미 Tier 1이지만 확인용
    "British Raj": 1,
    "British East India Company": 1,
    # ── 고대/중세 주요국 ──
    "Carthage": 1,
    "Sparta": 1,
    "Athens": 1,
    "Persia": 1,
    "Seleucid Empire": 1,
    "Ptolemaic Egypt": 1,
    # ── Tier 1 → Tier 2로 강등 (소규모 왕국/칸국) ──
    "Kingdom of Hawaii": 2,
    "Bagirmi": 2,
    "Buganda": 2,
    "Bunyoro": 2,
    "Dendi Kingdom": 2,
    "Kong Empire": 2,
    "Kuba": 2,
    "Lozi": 2,
    "Luba": 2,
    "Lunda": 2,
    "Mahra": 2,
    "Mbailundu": 2,
    "Mirambo Unyanyembe Ukimbu": 2,
    "Ndebele": 2,
    "Oyo": 2,
    "Teke": 2,
    "Yaka": 2,
    "Yeke": 2,
    "central Asian khanates": 2,
    "Wadai": 2,
    "Expansionist Kingdom of Merina": 2,
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

    dedup_count = 0
    for key, ls in lifespans.items():
        # 중복 엔티티 제거
        if key in DEDUP_REMOVE:
            dedup_count += 1
            continue

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

        # 좌표 결정: LABEL_COORDS_OVERRIDE > capital_coords > centroid
        coords = None
        if key in LABEL_COORDS_OVERRIDE:
            coords = list(LABEL_COORDS_OVERRIDE[key])
        elif meta.get("capital_coords"):
            coords = meta["capital_coords"]
        elif key in centroids:
            coords = list(centroids[key])
        # __virtual__ 접두사 제거해서도 시도
        elif key.replace("__virtual__", "") in centroids:
            coords = list(centroids[key.replace("__virtual__", "")])

        if not coords:
            # 좌표 없으면 스킵 (렌더링 불가)
            continue

        # 한국어 이름 결정: NAME_KO_OVERRIDES > 메타 > lifespan
        name_ko = NAME_KO_OVERRIDES.get(key) or meta.get("display_name_ko") or ls.get("ko") or ""

        entry = {
            "id": key,
            "name_en": meta.get("display_name_en") or ls.get("en") or key,
            "name_ko": name_ko,
            "name_local": meta.get("display_name_local", ""),
            "start_year": start,
            "end_year": end,
            "tier": TIER_OVERRIDES.get(key) or ls.get("tier") or meta.get("tier") or 3,
            "fill_color": meta.get("fill_color", "#AAAAAA"),
            "coords": coords,
            "is_colony": meta.get("is_colony", False),
            "colonial_ruler_ko": COLONIAL_RULER_FIX.get(
                meta.get("colonial_ruler_ko", ""), meta.get("colonial_ruler_ko")
            ),
            "source": source,
        }
        # 식민지 라벨 생성: [영국 식민지배] 형식
        if entry["is_colony"] and entry["colonial_ruler_ko"]:
            entry["colony_label"] = f"{entry['colonial_ruler_ko']} 식민지배"
        timeline.append(entry)

    print(f"  중복 제거: {dedup_count}개")

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

        coords = LABEL_COORDS_OVERRIDE.get(ename) or MANUAL_COORDS.get(ename)
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

    # ── 4.5. 메타데이터 스캔: HB lifespan에 없지만 메타데이터에 존재하는 엔티티 보강 ──
    print("\n[4.5] 메타데이터 스캔 (누락 엔티티 보강)...")
    existing_names_for_meta = {e["name_en"] for e in timeline} | {e["id"] for e in timeline}

    # 모든 메타데이터 파일에서 엔티티 등장 연도 수집
    meta_appearances: dict[str, dict] = {}
    for fp in sorted(glob.glob(os.path.join(META_DIR, "*.json"))):
        fname = os.path.basename(fp).replace(".json", "")
        # 숫자 연도 파일만 (1800.json, 1966.json 등)
        if not fname.lstrip("-").isdigit():
            continue
        snap_year = int(fname)
        with open(fp, encoding="utf-8") as f:
            snap_data = json.load(f)
        for ename, einfo in snap_data.items():
            if ename not in meta_appearances:
                meta_appearances[ename] = {
                    "first_year": snap_year, "last_year": snap_year,
                    "info": einfo, "count": 0,
                }
            ma = meta_appearances[ename]
            ma["first_year"] = min(ma["first_year"], snap_year)
            ma["last_year"] = max(ma["last_year"], snap_year)
            ma["count"] += 1

    # FORCED_ENTITIES의 name_en도 중복 체크에 포함
    forced_names = {fe["name_en"] for fe in FORCED_ENTITIES}
    # 기존 타임라인 엔티티를 좌표로 인덱싱 (겹침 방지용)
    existing_by_coord: dict[tuple, list] = defaultdict(list)
    for e in timeline:
        gk = (round(e["coords"][0] / 2) * 2, round(e["coords"][1] / 2) * 2)
        existing_by_coord[gk].append(e)

    meta_added = 0
    meta_trimmed = 0
    for ename, ma in meta_appearances.items():
        if ename in existing_names_for_meta or ename in DEDUP_REMOVE:
            continue
        # FORCED_ENTITIES와 이름 중복 방지
        if ename in forced_names:
            continue
        info = ma["info"]
        coords = None
        if ename in LABEL_COORDS_OVERRIDE:
            coords = list(LABEL_COORDS_OVERRIDE[ename])
        elif info.get("capital_coords"):
            coords = info["capital_coords"]
        elif ename in centroids:
            coords = list(centroids[ename])
        if not coords:
            continue

        # 같은 좌표 그리드에 기존 엔티티가 있으면 start_year 조정
        start_year = ma["first_year"]
        end_year = ma["last_year"]
        gk = (round(coords[0] / 2) * 2, round(coords[1] / 2) * 2)
        for existing in existing_by_coord.get(gk, []):
            # 시간 겹침 확인
            if existing["end_year"] >= start_year and existing["start_year"] <= end_year:
                # 기존 엔티티 종료 이후로 시작 조정
                new_start = existing["end_year"] + 1
                if new_start > start_year:
                    start_year = new_start
                    meta_trimmed += 1
        if start_year > end_year:
            continue  # 완전히 덮여서 불필요

        name_ko = NAME_KO_OVERRIDES.get(ename) or info.get("display_name_ko", "")
        ruler_ko = info.get("colonial_ruler_ko")
        if ruler_ko:
            ruler_ko = COLONIAL_RULER_FIX.get(ruler_ko, ruler_ko)

        entry = {
            "id": ename,
            "name_en": info.get("display_name_en") or ename,
            "name_ko": name_ko,
            "name_local": info.get("display_name_local", ""),
            "start_year": start_year,
            "end_year": end_year,
            "tier": TIER_OVERRIDES.get(ename) or info.get("tier") or 3,
            "fill_color": info.get("fill_color", "#AAAAAA"),
            "coords": coords,
            "is_colony": info.get("is_colony", False),
            "colonial_ruler_ko": ruler_ko,
            "source": "metadata_scan",
        }
        if entry["is_colony"] and entry["colonial_ruler_ko"]:
            entry["colony_label"] = f"{entry['colonial_ruler_ko']} 식민지배"
        timeline.append(entry)
        existing_names_for_meta.add(ename)
        meta_added += 1

    print(f"  메타데이터 스캔 추가: {meta_added}개 (시간 조정: {meta_trimmed}개)")

    # ── 5. 강제 추가 엔티티 (대한제국, 일제강점기 등) ──
    print("\n[5] 강제 추가 엔티티...")
    for fe in FORCED_ENTITIES:
        timeline.append(dict(fe))  # 복사해서 추가
    print(f"  강제 추가: {len(FORCED_ENTITIES)}개")

    # ── 5.5. 좌표 기반 자동 중복제거 ──
    # [cl] 같은 위치(2° 이내) + 시간 겹침(50% 이상) → 우선순위 높은 것만 남김
    print("\n[5.5] 좌표 기반 자동 중복제거...")
    SOURCE_RANK = {"forced": 0, "gemini_corrected": 1, "gemini_missing": 2, "metadata_scan": 3, "hb_lifespan": 4}

    coord_grid: dict[tuple, list] = defaultdict(list)
    for e in timeline:
        gkey = (round(e["coords"][0] / 2) * 2, round(e["coords"][1] / 2) * 2)
        coord_grid[gkey].append(e)

    before_dedup = len(timeline)
    deduped_timeline = []
    for gkey, group in coord_grid.items():
        if len(group) == 1:
            deduped_timeline.append(group[0])
            continue

        # 우선순위 정렬: source 좋은 순 → tier 낮은 순(중요) → 비식민지 우선
        group.sort(key=lambda e: (
            SOURCE_RANK.get(e["source"], 5),
            e["tier"],
            0 if not e.get("is_colony") else 1,
        ))

        kept = []
        for entity in group:
            dominated = False
            for k in kept:
                # 시간 겹침 확인
                overlap_start = max(k["start_year"], entity["start_year"])
                overlap_end = min(k["end_year"], entity["end_year"])
                if overlap_start <= overlap_end:
                    overlap = overlap_end - overlap_start
                    entity_span = max(entity["end_year"] - entity["start_year"], 1)
                    if overlap / entity_span > 0.5:
                        dominated = True
                        break
            if not dominated:
                kept.append(entity)
        deduped_timeline.extend(kept)

    removed_count = before_dedup - len(deduped_timeline)
    timeline = deduped_timeline
    print(f"  자동 중복제거: {removed_count}개 제거 → {len(timeline)}개 남음")

    # ── 6. 정렬 및 저장 ──
    timeline.sort(key=lambda e: (e["start_year"], e["name_en"]))

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False)
    file_size = os.path.getsize(OUTPUT_PATH)

    # ── 7. 요약 ──
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
