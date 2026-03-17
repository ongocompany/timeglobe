#!/usr/bin/env python3
"""
mergeNewEvents.py — 신규 생성 이벤트를 기존 events_cards.json에 병합
중복 제거 (name_ko + year 기준) + MockEvent 스키마 변환
"""
import json, re, glob
from pathlib import Path
from collections import Counter

BASE = Path(__file__).resolve().parent.parent.parent
SYNC_DIR = BASE / "public" / "data" / "jinserver_sync"
DATA_DIR = BASE / "public" / "data"

# ── era_id 매핑 ──
def get_era_id(year):
    if year is None: return "era-unknown"
    if year < -3000: return "era-prehistoric"
    if year < -800: return "era-ancient-early"
    if year < -200: return "era-classical"
    if year < 500: return "era-roman"
    if year < 1000: return "era-medieval-early"
    if year < 1300: return "era-medieval-high"
    if year < 1500: return "era-medieval-late"
    if year < 1650: return "era-early-modern"
    if year < 1800: return "era-enlightenment"
    if year < 1900: return "era-industrial"
    if year < 1950: return "era-world-wars"
    if year < 2000: return "era-cold-war"
    return "era-contemporary"

# ── 카테고리 매핑 ──
CATEGORY_MAP = {
    "정치": "정치/사건", "정치/사건": "정치/사건", "정치 변혁": "정치/사건",
    "왕조 건국": "정치/사건", "왕조 건국·멸망": "정치/사건",
    "전쟁": "정치/전쟁", "전쟁/외교": "정치/전쟁",
    "외교": "정치/사건", "외교/조약": "정치/사건", "외교·조약": "정치/사건",
    "종교": "종교/철학", "종교/사상": "종교/철학", "종교·사상": "종교/철학",
    "불교": "종교/철학",
    "문화": "인물/문화", "문화/학문": "인물/문화", "문화·학문": "인물/문화",
    "문화/예술": "인물/문화", "교육/학문": "인물/문화",
    "과학": "과학/발명", "과학/기술": "과학/발명", "경제·기술": "과학/발명",
    "기술": "과학/발명",
    "법률/제도": "정치/사건", "법률·제도": "정치/사건", "제도": "정치/사건",
    "건축": "건축/유물", "건축/토목": "건축/유물",
    "경제": "정치/사건", "경제/사회": "정치/사건",
    "사회": "정치/사건", "사회운동": "정치/사건",
    "탐험/발견": "탐험/발견", "탐험": "탐험/발견",
    "역병/재해": "정치/사건", "재해": "정치/사건",
}

def normalize_category(cat):
    return CATEGORY_MAP.get(cat, "정치/사건")

# ── 신규 이벤트 → MockEvent 변환 ──
def to_mock_event(item, idx):
    year = item.get("year")
    name_ko = item.get("name_ko", "")
    name_en = item.get("name_en", "")

    # ID 생성 (QID 없으므로 이름 기반)
    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', name_en)[:40] if name_en else f"evt_{idx}"
    evt_id = f"evt_{year or 0}_{safe_name}"

    lat = item.get("lat", 0)
    lng = item.get("lng", 0)

    summary_ko = item.get("summary_ko", "")
    summary_en = item.get("summary_en", "")

    return {
        "id": evt_id,
        "era_id": get_era_id(year),
        "title": {"ko": name_ko, "en": name_en},
        "start_year": year,
        "end_year": item.get("end_year"),
        "category": normalize_category(item.get("category", "")),
        "location_lat": round(lat, 4) if lat else 0,
        "location_lng": round(lng, 4) if lng else 0,
        "is_fog_region": False,
        "historical_region": {"ko": item.get("region", ""), "en": item.get("region", "")},
        "modern_country": {"ko": "", "en": ""},
        "image_url": "",
        "summary": {"ko": summary_ko, "en": summary_en},
        "description": {"ko": summary_ko, "en": summary_en},
        "external_link": "",
    }

def main():
    # 1) 기존 events_cards.json 로드
    existing_path = DATA_DIR / "events_cards.json"
    existing = json.loads(existing_path.read_text())
    existing_keys = set()
    for e in existing:
        key = (e.get("title", {}).get("ko", ""), e.get("start_year"))
        existing_keys.add(key)
    print(f"기존 events_cards.json: {len(existing)}건")

    # 2) 신규 이벤트 파일 전부 로드
    all_new = []
    event_files = sorted(SYNC_DIR.glob("events_*.json"))
    for f in event_files:
        try:
            items = json.loads(f.read_text())
            if isinstance(items, list):
                all_new.extend(items)
                print(f"  {f.name}: {len(items)}건")
        except Exception as e:
            print(f"  {f.name}: 로드 실패 ({e})")

    print(f"\n신규 이벤트 총계 (중복 포함): {len(all_new)}건")

    # 3) 중복 제거 (name_ko + year 기준)
    seen = set()
    deduped = []
    for item in all_new:
        key = (item.get("name_ko", ""), item.get("year"))
        if key in seen or key in existing_keys:
            continue
        if not item.get("name_ko") or not item.get("year"):
            continue
        seen.add(key)
        deduped.append(item)

    print(f"중복 제거 후: {len(deduped)}건 (신규)")

    # 4) 지역별 통계
    regions = Counter(item.get("region", "불명") for item in deduped)
    print(f"\n지역별 분포:")
    for r, c in regions.most_common():
        print(f"  {r}: {c}건")

    # 5) MockEvent 변환
    new_events = []
    for i, item in enumerate(deduped):
        evt = to_mock_event(item, i)
        if evt["location_lat"] == 0 and evt["location_lng"] == 0:
            continue  # 좌표 없는 건 스킵
        new_events.append(evt)

    print(f"\nMockEvent 변환 완료: {len(new_events)}건 (좌표 있는 것만)")

    # 6) 병합 + 저장
    merged = existing + new_events
    with open(existing_path, "w") as f:
        json.dump(merged, f, ensure_ascii=False)

    import os
    size_mb = os.path.getsize(existing_path) / 1024 / 1024
    print(f"\n✅ events_cards.json 저장: {len(merged)}건 ({size_mb:.1f}MB)")
    print(f"   기존: {len(existing)} + 신규: {len(new_events)} = {len(merged)}")

if __name__ == "__main__":
    main()
