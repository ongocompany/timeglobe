#!/usr/bin/env python3
"""
syncToMockEvent.py — jinserver_sync 데이터를 MockEvent 스키마로 변환
기존 cards.json과 중복 제거 후 병합

Usage:
  python3 syncToMockEvent.py --check          # 스키마 검증 + 통계만
  python3 syncToMockEvent.py --convert        # 변환 + 병합
  python3 syncToMockEvent.py --convert --category artworks  # 특정 카테고리만
"""
import json, re, argparse
from pathlib import Path
from collections import Counter

BASE = Path(__file__).resolve().parent.parent.parent
SYNC_DIR = BASE / "public" / "data" / "jinserver_sync"
DATA_DIR = BASE / "public" / "data"

# ── era_id 매핑 (cardsToMockEvent.py와 동일) ──────────────
def get_era_id(year):
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


# ── 국가 좌표 로드 ────────────────────────────────────
def load_country_coords():
    p = SYNC_DIR / "country_coords.json"
    if not p.exists():
        p2 = DATA_DIR / "jinserver_sync" / "country_coords.json"
        if not p2.exists():
            return {}
        p = p2
    return json.loads(p.read_text())


# ── 기존 cards.json 로드 ──────────────────────────────
def load_existing_cards(filename):
    p = DATA_DIR / filename
    if not p.exists():
        return [], set()
    data = json.loads(p.read_text())
    ids = {item["id"] for item in data}
    return data, ids


# ── JSONL 로드 ────────────────────────────────────────
def load_jsonl(path):
    items = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    items.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return items


# ── 공통 MockEvent 생성 ──────────────────────────────
def make_mock_event(*, id, era_id, title_ko, title_en, start_year, end_year,
                    category, lat, lng, summary_ko, summary_en,
                    desc_ko, desc_en, image_url="", external_link="",
                    historical_region_ko="", historical_region_en=""):
    return {
        "id": id,
        "era_id": era_id,
        "title": {"ko": title_ko, "en": title_en},
        "start_year": start_year,
        "end_year": end_year,
        "category": category,
        "location_lat": round(lat, 4) if lat else 0,
        "location_lng": round(lng, 4) if lng else 0,
        "is_fog_region": False,
        "historical_region": {"ko": historical_region_ko, "en": historical_region_en},
        "modern_country": {"ko": "", "en": ""},
        "image_url": image_url or "",
        "summary": {"ko": summary_ko, "en": summary_en},
        "description": {"ko": desc_ko, "en": desc_en},
        "external_link": external_link or "",
    }


# ═══════════════════════════════════════════════════════
# 카테고리별 변환 함수
# ═══════════════════════════════════════════════════════

def convert_artworks_enriched():
    """artworks_enriched.jsonl → MockEvent (artworks_cards.json에 병합)"""
    items = load_jsonl(SYNC_DIR / "artworks_enriched.jsonl")
    existing, existing_ids = load_existing_cards("artworks_cards.json")

    new_cards = []
    stats = Counter()
    for item in items:
        qid = item.get("qid", "")
        if qid in existing_ids:
            stats["duplicate"] += 1
            continue

        lat = item.get("lat")
        lng = item.get("lng")
        if not lat or not lng:
            stats["no_coords"] += 1
            continue

        year = item.get("year")
        if not year:
            stats["no_year"] += 1
            continue

        card = make_mock_event(
            id=qid,
            era_id=get_era_id(year),
            title_ko=item.get("name_ko", ""),
            title_en=item.get("name_en", ""),
            start_year=year,
            end_year=None,
            category=item.get("category", "인물/문화"),
            lat=lat, lng=lng,
            summary_ko=item.get("summary_ko", ""),
            summary_en=item.get("summary_en", ""),
            desc_ko=item.get("summary_ko", ""),
            desc_en=item.get("summary_en", ""),
        )
        new_cards.append(card)
        stats["converted"] += 1

    return "artworks_cards.json", existing, new_cards, stats


def convert_films():
    """generated_films_deduped.jsonl → MockEvent (films_cards.json 신규)"""
    items = load_jsonl(SYNC_DIR / "generated_films_deduped.jsonl")
    existing, existing_ids = load_existing_cards("films_cards.json")

    new_cards = []
    stats = Counter()
    for i, item in enumerate(items):
        year = item.get("year")
        if not year:
            stats["no_year"] += 1
            continue

        # 영화는 QID 없으므로 title+year로 ID 생성
        title_en = item.get("title_en", "")
        film_id = f"film_{year}_{re.sub(r'[^a-zA-Z0-9]', '_', title_en)[:40]}"

        if film_id in existing_ids:
            stats["duplicate"] += 1
            continue

        # setting_location → 좌표 매핑은 별도 필요 (일단 0,0)
        card = make_mock_event(
            id=film_id,
            era_id=get_era_id(year),
            title_ko=item.get("title_ko", ""),
            title_en=title_en,
            start_year=year,
            end_year=None,
            category="영화",
            lat=0, lng=0,  # TODO: setting_location 지오코딩 필요
            summary_ko=item.get("description", "")[:150],
            summary_en=item.get("description", "")[:200] if item.get("description") else "",
            desc_ko=item.get("description", ""),
            desc_en="",
            image_url="",
        )
        # 영화 전용 메타 보존
        card["_setting_location"] = item.get("setting_location", "")
        card["_director"] = item.get("director", "")
        card["_country"] = item.get("country", "")
        card["_genre"] = item.get("genre", "")
        new_cards.append(card)
        stats["converted"] += 1
        stats["needs_geocoding"] += 1

    return "films_cards.json", existing, new_cards, stats


def convert_places_filtered():
    """places_filtered.jsonl → MockEvent (places_cards.json에 병합)"""
    items = load_jsonl(SYNC_DIR / "places_filtered.jsonl")
    existing, existing_ids = load_existing_cards("places_cards.json")

    new_cards = []
    stats = Counter()
    for item in items:
        qid = item.get("qid", "")
        if qid in existing_ids:
            stats["duplicate"] += 1
            continue

        coord = item.get("coord", [])
        if isinstance(coord, list) and len(coord) == 2:
            lat, lng = coord[0], coord[1]
        else:
            lat = item.get("lat")
            lng = item.get("lng") or item.get("lon")

        if not lat or not lng:
            stats["no_coords"] += 1
            continue

        year = item.get("year")
        if not year:
            stats["no_year"] += 1
            continue

        card = make_mock_event(
            id=qid,
            era_id=get_era_id(year),
            title_ko=item.get("name_ko", ""),
            title_en=item.get("name_en", ""),
            start_year=year,
            end_year=None,
            category="건축/유물",
            lat=lat, lng=lng,
            summary_ko=item.get("summary_ko", ""),
            summary_en=item.get("summary_en", ""),
            desc_ko=item.get("summary_ko", ""),
            desc_en=item.get("summary_en", ""),
        )
        new_cards.append(card)
        stats["converted"] += 1

    return "places_cards.json", existing, new_cards, stats


def convert_nations():
    """hist_entities_filtered.jsonl → MockEvent (nations_cards.json에 병합)"""
    items = load_jsonl(SYNC_DIR / "hist_entities_filtered.jsonl")
    existing, existing_ids = load_existing_cards("nations_cards.json")

    new_cards = []
    stats = Counter()
    for item in items:
        qid = item.get("qid", "")
        if qid in existing_ids:
            stats["duplicate"] += 1
            continue

        lat = item.get("lat")
        lng = item.get("lng") or item.get("lon")
        if not lat or not lng:
            stats["no_coords"] += 1
            continue

        start = item.get("start_year")
        end = item.get("end_year")

        card = make_mock_event(
            id=qid,
            era_id=get_era_id(start),
            title_ko=item.get("name_ko", ""),
            title_en=item.get("name_en", ""),
            start_year=start,
            end_year=end,
            category="국가/문명",
            lat=lat, lng=lng,
            summary_ko=item.get("summary_ko", ""),
            summary_en=item.get("summary_en", ""),
            desc_ko=item.get("summary_ko", ""),
            desc_en=item.get("summary_en", ""),
        )
        new_cards.append(card)
        stats["converted"] += 1

    return "nations_cards.json", existing, new_cards, stats


def convert_items():
    """cards_items.jsonl → MockEvent (items_cards.json 신규)"""
    items = load_jsonl(SYNC_DIR / "cards_items.jsonl")
    existing, existing_ids = load_existing_cards("items_cards.json")

    new_cards = []
    stats = Counter()
    for item in items:
        qid = item.get("_qid", "")
        if qid in existing_ids:
            stats["duplicate"] += 1
            continue

        # items 카드는 cardsToMockEvent 형태 — _name_ko, description_ko 등
        lat = item.get("lat") or item.get("location_lat")
        lng = item.get("lng") or item.get("lon") or item.get("location_lng")

        year = item.get("_year")
        # year가 없으면 description에서 추출 시도
        if not year:
            stats["no_year"] += 1
            continue

        if not lat or not lng:
            stats["no_coords"] += 1
            continue

        desc_ko = item.get("description_ko", "")
        desc_en = item.get("description_en", "")
        summary_ko = desc_ko[:150] if desc_ko else ""
        summary_en = desc_en[:200] if desc_en else ""

        card = make_mock_event(
            id=qid,
            era_id=get_era_id(year),
            title_ko=item.get("_name_ko", ""),
            title_en=item.get("_name_en", ""),
            start_year=year,
            end_year=None,
            category="건축/유물",
            lat=lat, lng=lng,
            summary_ko=summary_ko,
            summary_en=summary_en,
            desc_ko=desc_ko,
            desc_en=desc_en,
            image_url=item.get("_thumbnail", ""),
            external_link=item.get("_wiki_url", ""),
        )
        new_cards.append(card)
        stats["converted"] += 1

    return "items_cards.json", existing, new_cards, stats


def convert_persons_curated():
    """persons_curated_yes.jsonl — Wikidata raw 형태, 카드 생성이 아직 안 됨
    여기서는 스키마 체크만 수행. 카드 생성은 별도 Gemini API 필요."""
    items = load_jsonl(SYNC_DIR / "persons_curated_yes.jsonl")
    existing, existing_ids = load_existing_cards("persons_cards.json")

    stats = Counter()
    stats["total"] = len(items)

    for item in items:
        qid = item.get("qid", "")
        if qid in existing_ids:
            stats["already_in_cards"] += 1
        else:
            stats["needs_card_generation"] += 1

        if item.get("birth_year"):
            stats["has_birth_year"] += 1
        if item.get("image"):
            stats["has_image"] += 1

    # persons_curated는 카드 형태가 아니므로 변환하지 않고 통계만 반환
    return "persons_cards.json", [], [], stats


# ═══════════════════════════════════════════════════════
# 메인
# ═══════════════════════════════════════════════════════

CONVERTERS = {
    "artworks": convert_artworks_enriched,
    "films": convert_films,
    "places": convert_places_filtered,
    "nations": convert_nations,
    "items": convert_items,
    "persons": convert_persons_curated,
}

def validate_card(card):
    """MockEvent 스키마 검증"""
    required = ["id", "era_id", "title", "start_year", "category",
                 "location_lat", "location_lng", "summary", "description"]
    errors = []
    for field in required:
        if field not in card:
            errors.append(f"missing '{field}'")
    if "title" in card:
        if not isinstance(card["title"], dict) or "ko" not in card["title"]:
            errors.append("title must be {ko, en}")
    if "summary" in card:
        if not isinstance(card["summary"], dict) or "ko" not in card["summary"]:
            errors.append("summary must be {ko, en}")
    return errors


def main():
    parser = argparse.ArgumentParser(description="jinserver_sync → MockEvent 변환")
    parser.add_argument("--check", action="store_true", help="스키마 검증 + 통계만")
    parser.add_argument("--convert", action="store_true", help="실제 변환 + 파일 저장")
    parser.add_argument("--category", choices=list(CONVERTERS.keys()) + ["all"], default="all")
    args = parser.parse_args()

    if not args.check and not args.convert:
        args.check = True

    cats = list(CONVERTERS.keys()) if args.category == "all" else [args.category]

    results = {}
    for cat in cats:
        print(f"\n{'='*55}")
        print(f"  {cat.upper()}")
        print(f"{'='*55}")

        converter = CONVERTERS[cat]
        target_file, existing, new_cards, stats = converter()

        print(f"  대상 파일: {target_file}")
        print(f"  기존: {len(existing)}건")
        print(f"  신규 변환: {len(new_cards)}건")
        for k, v in stats.items():
            print(f"  {k}: {v}")

        # 스키마 검증
        if new_cards:
            errors_total = 0
            for card in new_cards[:5]:
                errs = validate_card(card)
                if errs:
                    print(f"  ⚠️ {card['id']}: {errs}")
                    errors_total += 1
            if errors_total == 0:
                print(f"  ✅ 스키마 검증 통과 (샘플 {min(5, len(new_cards))}건)")

            # 샘플 출력
            sample = new_cards[0]
            print(f"\n  [샘플] {sample['title']['ko']} ({sample['id']})")
            print(f"    era: {sample['era_id']}, year: {sample['start_year']}")
            print(f"    coords: ({sample['location_lat']}, {sample['location_lng']})")
            print(f"    category: {sample['category']}")

        results[cat] = {
            "target": target_file,
            "existing": existing,
            "new": new_cards,
            "stats": stats,
        }

    # ── 변환 모드: 파일 저장 ──
    if args.convert:
        print(f"\n{'='*55}")
        print("  파일 저장")
        print(f"{'='*55}")

        for cat, res in results.items():
            if not res["new"]:
                print(f"  {cat}: 신규 없음, 스킵")
                continue

            target = res["target"]
            merged = res["existing"] + res["new"]
            out_path = DATA_DIR / target

            with open(out_path, "w") as f:
                json.dump(merged, f, ensure_ascii=False)

            size_mb = out_path.stat().st_size / 1024 / 1024
            print(f"  ✅ {target}: {len(res['existing'])} + {len(res['new'])} = {len(merged)}건 ({size_mb:.1f}MB)")

    # ── 총 요약 ──
    print(f"\n{'='*55}")
    print("  총 요약")
    print(f"{'='*55}")
    total_existing = 0
    total_new = 0
    for cat, res in results.items():
        total_existing += len(res["existing"])
        total_new += len(res["new"])
        print(f"  {cat:12s}: 기존 {len(res['existing']):>6,} + 신규 {len(res['new']):>6,} = {len(res['existing'])+len(res['new']):>6,}")
    print(f"  {'합계':12s}: 기존 {total_existing:>6,} + 신규 {total_new:>6,} = {total_existing+total_new:>6,}")


if __name__ == "__main__":
    main()
