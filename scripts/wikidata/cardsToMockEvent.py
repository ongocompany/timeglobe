#!/usr/bin/env python3
"""
cardsToMockEvent.py — cards JSONL → MockEvent JSON 변환
마크업 태그 자동 제거 + 좌표 매핑 + era_id 매핑

Usage:
  python3 cardsToMockEvent.py                          # persons만 (기본)
  python3 cardsToMockEvent.py --category all           # 전체 카테고리
  python3 cardsToMockEvent.py --category persons --dry-run  # 통계만
"""
import json, re, argparse
from pathlib import Path

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
CARD_DIR = OUTPUT_DIR / "cards"
PUBLIC_DIR = Path("/home/jinwoo/timeglobe/public/data")
CATEGORIES = ["persons", "events", "artworks", "inventions", "items"]

# ── 마크업 제거 ──────────────────────────────────────

def clean_wiki_markup(text):
    """위키피디아 마크업 태그 제거"""
    if not text:
        return ""

    # == 섹션 헤더 == 제거 (같이 보기, 각주, 참고 문헌, 외부 링크 등)
    text = re.sub(r'\n*={2,}\s*.+?\s*={2,}\n*', '\n', text)

    # 섹션 이후 내용 제거 (각주, 참고 문헌, 외부 링크, 같이 보기 뒤의 잔여)
    for marker in ["각주", "참고 문헌", "외부 링크", "같이 보기", "참조", "출처", "References", "See also", "External links"]:
        idx = text.find(marker)
        if idx > 0:
            text = text[:idx]

    # 위키 링크 [[텍스트|표시]] → 표시, [[텍스트]] → 텍스트
    text = re.sub(r'\[\[([^|\]]*\|)?([^\]]+)\]\]', r'\2', text)

    # HTML 태그 제거
    text = re.sub(r'<[^>]+>', '', text)

    # 각주 번호 [1], [2] 등 제거
    text = re.sub(r'\[\d+\]', '', text)

    # 연속 줄바꿈 → 단일 줄바꿈
    text = re.sub(r'\n{2,}', '\n', text)

    # 앞뒤 공백 정리
    text = text.strip()

    return text


# ── era_id 매핑 ──────────────────────────────────────

def get_era_id(year):
    """연도 → era_id 매핑"""
    if year is None:
        return "era-unknown"
    if year < -3000:
        return "era-prehistoric"
    if year < -800:
        return "era-ancient-early"
    if year < -200:
        return "era-classical"
    if year < 500:
        return "era-roman"
    if year < 1000:
        return "era-medieval-early"
    if year < 1300:
        return "era-medieval-high"
    if year < 1500:
        return "era-medieval-late"
    if year < 1650:
        return "era-early-modern"
    if year < 1800:
        return "era-enlightenment"
    if year < 1900:
        return "era-industrial"
    if year < 1950:
        return "era-world-wars"
    if year < 2000:
        return "era-cold-war"
    return "era-contemporary"


# ── 카테고리 매핑 ────────────────────────────────────

ROLE_TO_CATEGORY = {
    "politician": "정치/전쟁",
    "military": "정치/전쟁",
    "general": "정치/전쟁",
    "emperor": "정치/전쟁",
    "king": "정치/전쟁",
    "monarch": "정치/전쟁",
    "ruler": "정치/전쟁",
    "revolutionary": "정치/전쟁",
    "diplomat": "정치/전쟁",
    "scientist": "과학/발명",
    "physicist": "과학/발명",
    "chemist": "과학/발명",
    "mathematician": "과학/발명",
    "biologist": "과학/발명",
    "astronomer": "과학/발명",
    "engineer": "과학/발명",
    "inventor": "과학/발명",
    "physician": "과학/발명",
    "philosopher": "인물/문화",
    "writer": "인물/문화",
    "poet": "인물/문화",
    "playwright": "인물/문화",
    "composer": "인물/문화",
    "painter": "인물/문화",
    "sculptor": "인물/문화",
    "musician": "인물/문화",
    "artist": "인물/문화",
    "architect": "건축/유물",
    "explorer": "탐험/발견",
    "navigator": "탐험/발견",
}

def get_category(card_cat, role="", field=""):
    """카드 카테고리 + role/field → MockEvent 카테고리"""
    if card_cat == "events":
        return "정치/전쟁"
    if card_cat == "artworks":
        return "인물/문화"
    if card_cat == "inventions":
        return "과학/발명"
    if card_cat == "items":
        return "건축/유물"

    # persons — role 기반 분류
    role_lower = role.lower() if role else ""
    for key, cat in ROLE_TO_CATEGORY.items():
        if key in role_lower:
            return cat

    # field 기반 fallback
    field_lower = field.lower() if field else ""
    if any(k in field_lower for k in ["politic", "military", "war", "govern"]):
        return "정치/전쟁"
    if any(k in field_lower for k in ["science", "physics", "math", "medic", "engineer"]):
        return "과학/발명"
    if any(k in field_lower for k in ["explor", "navigat", "discover"]):
        return "탐험/발견"

    return "인물/문화"  # default for persons


# ── 좌표: citizenship_qid → 국가 좌표 ────────────────

# 주요 국가/지역 QID → 대표 좌표 (수도 또는 중심지)
COUNTRY_COORDS = {}
COORDS_PATH = Path("/mnt/data2/wikidata/output/country_coords.json")

def load_country_coords():
    """국가 좌표 매핑 로드 (없으면 빈 dict)"""
    global COUNTRY_COORDS
    if COORDS_PATH.exists():
        COUNTRY_COORDS = json.loads(COORDS_PATH.read_text())
        return

    # 기본 좌표 매핑 (주요 국가만)
    COUNTRY_COORDS = {
        # 유럽
        "Q142": [48.86, 2.35],    # 프랑스 (파리)
        "Q145": [51.51, -0.13],   # 영국 (런던)
        "Q183": [52.52, 13.41],   # 독일 (베를린)
        "Q38": [41.90, 12.50],    # 이탈리아 (로마)
        "Q29": [40.42, -3.70],    # 스페인 (마드리드)
        "Q159": [55.75, 37.62],   # 러시아 (모스크바)
        "Q36": [52.23, 21.01],    # 폴란드 (바르샤바)
        "Q55": [52.37, 4.90],     # 네덜란드 (암스테르담)
        "Q31": [50.85, 4.35],     # 벨기에 (브뤼셀)
        "Q40": [48.21, 16.37],    # 오스트리아 (빈)
        "Q39": [46.95, 7.45],     # 스위스 (베른)
        "Q34": [55.68, 12.57],    # 덴마크 (코펜하겐)
        "Q35": [59.33, 18.07],    # 스웨덴 (스톡홀름)
        "Q20": [59.91, 10.75],    # 노르웨이 (오슬로)
        "Q33": [60.17, 24.94],    # 핀란드 (헬싱키)
        "Q41": [37.98, 23.73],    # 그리스 (아테네)
        "Q218": [44.43, 26.10],   # 루마니아 (부쿠레슈티)
        "Q219": [42.70, 23.32],   # 불가리아 (소피아)
        "Q28": [40.42, -3.70],    # 헝가리 (부다페스트)
        "Q213": [50.08, 14.44],   # 체코 (프라하)
        "Q214": [48.15, 17.11],   # 슬로바키아 (브라티슬라바)
        "Q45": [51.50, -0.13],    # 포르투갈 (리스본) — 수정 필요
        "Q45": [38.72, -9.14],    # 포르투갈 (리스본)
        "Q27": [53.35, -6.26],    # 아일랜드 (더블린)
        # 아시아
        "Q148": [39.91, 116.40],  # 중국 (베이징)
        "Q17": [35.68, 139.69],   # 일본 (도쿄)
        "Q884": [37.57, 126.98],  # 한국 (서울)
        "Q668": [28.61, 77.21],   # 인도 (뉴델리)
        "Q43": [33.89, 35.50],    # 터키 (앙카라) — 수정 필요
        "Q43": [39.93, 32.86],    # 터키 (앙카라)
        "Q794": [33.89, 35.50],   # 이란 (테헤란) — 수정 필요
        "Q794": [35.69, 51.39],   # 이란 (테헤란)
        "Q851": [24.47, 54.37],   # 사우디아라비아
        "Q252": [4.18, 103.00],   # 인도네시아 (자카르타)
        "Q869": [13.75, 100.52],  # 태국 (방콕)
        "Q928": [21.03, 105.85],  # 베트남 (하노이)
        # 아메리카
        "Q30": [38.91, -77.04],   # 미국 (워싱턴DC)
        "Q16": [45.42, -75.70],   # 캐나다 (오타와)
        "Q96": [19.43, -99.13],   # 멕시코 (멕시코시티)
        "Q155": [-15.79, -47.88], # 브라질 (브라질리아)
        "Q414": [-34.60, -58.38], # 아르헨티나 (부에노스아이레스)
        # 아프리카
        "Q79": [30.04, 31.24],    # 이집트 (카이로)
        "Q258": [-33.93, 18.42],  # 남아프리카 (케이프타운)
        # 오세아니아
        "Q408": [-33.87, 151.21], # 호주 (시드니)
        # 고대
        "Q11772": [37.97, 23.72], # 아테네
        "Q220": [41.90, 12.50],   # 로마 제국
        "Q12544": [41.01, 29.00], # 비잔틴 제국 (콘스탄티노폴리스)
        "Q12560": [33.51, 36.29], # 우마이야 왕조 (다마스쿠스)
        "Q8575586": [39.91, 116.40], # 청나라
        "Q9683": [35.01, 135.77], # 에도 막부 (교토)
        "Q28929": [37.57, 126.98], # 조선
    }


def get_coords(card, final_item=None):
    """카드에서 좌표 가져오기 (citizenship_qid → 국가 좌표 fallback)"""
    # 1) 카드 자체에 좌표가 있는 경우 (SPARQL 보강분)
    lat = card.get("location_lat") or card.get("lat")
    lng = card.get("location_lng") or card.get("lng") or card.get("lon")
    if lat and lng and lat != 0 and lng != 0:
        return float(lat), float(lng)

    # 2) final 항목의 citizenship_qid → 국가 좌표
    cit_qid = None
    if final_item:
        cit_qid = final_item.get("citizenship_qid", "")
    if not cit_qid:
        cit_qid = card.get("_citizenship_qid", "")

    if cit_qid and cit_qid in COUNTRY_COORDS:
        coords = COUNTRY_COORDS[cit_qid]
        return coords[0], coords[1]

    # 3) 기존 persons_cards.json에서 좌표 가져오기 (QID 매칭)
    return None, None


# ── 변환 ─────────────────────────────────────────────

def card_to_mock_event(card, category, existing_coords=None):
    """단일 카드 → MockEvent 변환"""
    qid = card.get("_qid", "")

    # 이름
    name_ko = card.get("_name_ko", "")
    name_en = card.get("_name_en", "")

    # 연도
    if category == "persons":
        start = card.get("_birth_year")
        end = card.get("_death_year")
    elif category == "events":
        start = card.get("_start_year")
        end = card.get("_end_year")
    else:
        start = card.get("_year")
        end = None

    # 좌표 — 기존 데이터에서 재활용 우선
    lat, lng = None, None
    if existing_coords and qid in existing_coords:
        lat, lng = existing_coords[qid]
    if not lat or not lng:
        lat, lng = get_coords(card)
    if not lat or not lng:
        return None  # 좌표 없으면 스킵

    # description 클리닝
    desc_ko = clean_wiki_markup(card.get("description_ko", ""))
    desc_en = card.get("description_en", "")

    # summary = description 앞 2문장
    sentences = re.split(r'(?<=[.다])\s', desc_ko)
    summary_ko = " ".join(sentences[:2]) if sentences else desc_ko[:100]
    if len(summary_ko) > 150:
        cut = summary_ko[:150].rfind(".")
        summary_ko = summary_ko[:cut+1] if cut > 50 else summary_ko[:150]

    summary_en = desc_en
    if len(summary_en) > 200:
        cut = summary_en[:200].rfind(".")
        summary_en = summary_en[:cut+1] if cut > 50 else summary_en[:200]

    return {
        "id": qid,
        "era_id": get_era_id(start),
        "title": {"ko": name_ko, "en": name_en},
        "start_year": start,
        "end_year": end,
        "category": get_category(category, card.get("_role", ""), card.get("_field", "")),
        "location_lat": round(lat, 4),
        "location_lng": round(lng, 4),
        "is_fog_region": False,
        "historical_region": {"ko": card.get("_region", ""), "en": card.get("_region", "")},
        "modern_country": {"ko": "", "en": ""},
        "image_url": card.get("_thumbnail", ""),
        "summary": {"ko": summary_ko, "en": summary_en},
        "description": {"ko": desc_ko, "en": desc_en},
        "external_link": card.get("_wiki_url", ""),
    }


def load_existing_coords():
    """기존 persons_cards.json에서 QID→좌표 매핑 추출"""
    coords = {}
    existing_path = PUBLIC_DIR / "persons_cards.json"
    if existing_path.exists():
        data = json.loads(existing_path.read_text())
        for item in data:
            qid = item.get("id", "")
            lat = item.get("location_lat")
            lng = item.get("location_lng")
            if qid and lat and lng:
                coords[qid] = (lat, lng)
    return coords


def process_category(category, dry_run=False):
    """카테고리 JSONL → MockEvent JSON"""
    card_path = CARD_DIR / category / f"cards_{category}.jsonl"
    if not card_path.exists():
        print(f"  ⚠️ 카드 없음: {card_path}")
        return []

    # 카드 로드
    cards = []
    with open(card_path) as f:
        for line in f:
            try:
                cards.append(json.loads(line.strip()))
            except:
                continue

    # QID 중복 제거 (마지막 것 유지)
    seen = {}
    for c in cards:
        qid = c.get("_qid", "")
        if qid:
            seen[qid] = c
    cards = list(seen.values())

    print(f"\n  카드: {len(cards)}건 (중복 제거 후)")

    # 기존 좌표 로드
    existing_coords = load_existing_coords()
    print(f"  기존 좌표: {len(existing_coords)}건")

    # 변환
    events = []
    stats = {"success": 0, "no_coords": 0, "no_year": 0, "markup_cleaned": 0}

    for card in cards:
        # 연도 없으면 스킵
        if category == "persons" and not card.get("_birth_year"):
            stats["no_year"] += 1
            continue
        if category == "events" and not card.get("_start_year"):
            stats["no_year"] += 1
            continue

        ev = card_to_mock_event(card, category, existing_coords)
        if ev:
            # 마크업 클리닝 여부 체크
            orig_desc = card.get("description_ko", "")
            if orig_desc != ev["description"]["ko"]:
                stats["markup_cleaned"] += 1
            events.append(ev)
            stats["success"] += 1
        else:
            stats["no_coords"] += 1

    print(f"  변환 성공: {stats['success']}")
    print(f"  좌표 없음 (스킵): {stats['no_coords']}")
    print(f"  연도 없음 (스킵): {stats['no_year']}")
    print(f"  마크업 제거: {stats['markup_cleaned']}건")

    return events


def main():
    parser = argparse.ArgumentParser(description="cards JSONL → MockEvent JSON 변환")
    parser.add_argument("--category", choices=CATEGORIES + ["all"], default="persons")
    parser.add_argument("--dry-run", action="store_true", help="통계만 출력")
    parser.add_argument("--output", type=str, default="", help="출력 파일 경로 (기본: public/data/)")
    args = parser.parse_args()

    load_country_coords()

    cats = CATEGORIES if args.category == "all" else [args.category]

    all_events = []
    for cat in cats:
        print(f"\n{'='*50}")
        print(f"카테고리: {cat}")
        print(f"{'='*50}")
        events = process_category(cat, dry_run=args.dry_run)
        all_events.extend(events)

    print(f"\n{'='*50}")
    print(f"전체 MockEvent: {len(all_events)}건")

    if args.dry_run:
        print("(dry-run — 파일 미생성)")
        return

    # 출력
    if args.category == "all":
        out_path = PUBLIC_DIR / "all_cards.json"
    else:
        out_path = PUBLIC_DIR / f"{args.category}_cards.json"

    if args.output:
        out_path = Path(args.output)

    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 기존 파일 백업
    if out_path.exists():
        bak = out_path.with_suffix(".json.bak")
        out_path.rename(bak)
        print(f"기존 파일 백업: {bak.name}")

    with open(out_path, "w") as f:
        json.dump(all_events, f, ensure_ascii=False, indent=None)

    print(f"✅ 저장: {out_path} ({len(all_events)}건)")
    print(f"   파일 크기: {out_path.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
