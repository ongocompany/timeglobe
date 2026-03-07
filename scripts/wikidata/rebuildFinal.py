#!/usr/bin/env python3
"""
rebuildFinal.py — categories/*.jsonl → final/*.jsonl 재구축
sitelinks + 날짜 + kowiki 기반 필터링으로 카드 생성 후보 추출

Usage:
  python3 rebuildFinal.py                # 전체 카테고리 재구축
  python3 rebuildFinal.py --dry-run      # 통계만 출력 (파일 안 씀)
  python3 rebuildFinal.py --category persons  # 특정 카테고리만
"""
import json, argparse
from pathlib import Path
from collections import Counter

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
CAT_DIR = OUTPUT_DIR / "categories"
FINAL_DIR = OUTPUT_DIR / "final"
KOWIKI_PATH = Path("/mnt/data2/kowiki/qid_pagelen.json")

# ── 카테고리별 소스 매핑 + 필터 기준 ─────────────────
# source: categories/ 파일명
# sl_min: 최소 sitelinks 수
# need_date: 날짜 필수 여부
# date_fields: 날짜로 쓸 필드 목록 (하나라도 있으면 OK)
CATEGORY_CONFIG = {
    "persons": {
        "sources": ["03_person.jsonl"],
        "sl_min": 20,
        "need_date": True,
        "date_fields": ["birth_year", "death_year"],
    },
    "events": {
        "sources": ["02_event.jsonl", "08_disaster.jsonl", "10_battle.jsonl", "11_pandemic.jsonl"],
        "sl_min": 10,
        "need_date": True,
        "date_fields": ["start_year", "end_year", "year", "birth_year"],
    },
    "artworks": {
        "sources": ["12_artwork.jsonl"],
        "sl_min": 10,
        "need_date": True,
        "date_fields": ["year", "birth_year", "start_year"],
    },
    "inventions": {
        "sources": ["07_invention.jsonl"],
        "sl_min": 10,
        "need_date": False,  # parseDump에서 날짜 추출 안 됨
        "date_fields": ["year", "birth_year", "start_year"],
    },
    "items": {
        "sources": ["06_heritage.jsonl", "09_exploration.jsonl"],
        "sl_min": 10,
        "need_date": False,  # heritage는 날짜 거의 없음
        "date_fields": ["year", "birth_year", "start_year"],
    },
}


def load_kowiki():
    """kowiki QID → page_length 매핑 로드"""
    if not KOWIKI_PATH.exists():
        print(f"⚠️ kowiki 파일 없음: {KOWIKI_PATH}")
        return {}
    return json.loads(KOWIKI_PATH.read_text())


def has_date(item, date_fields):
    """날짜 필드 중 하나라도 유효한 값이 있는지"""
    for f in date_fields:
        v = item.get(f)
        if v is not None and v != "" and v != 0:
            return True
    return False


def rebuild_category(cat_name, config, kowiki, dry_run=False):
    """단일 카테고리 재구축"""
    print(f"\n{'='*60}")
    print(f"카테고리: {cat_name}")
    print(f"{'='*60}")

    # 소스 파일 로드
    all_items = []
    for src in config["sources"]:
        src_path = CAT_DIR / src
        if not src_path.exists():
            print(f"  ⚠️ 소스 없음: {src}")
            continue
        count = 0
        with open(src_path) as f:
            for line in f:
                try:
                    d = json.loads(line.strip())
                    all_items.append(d)
                    count += 1
                except Exception:
                    continue
        print(f"  📂 {src}: {count:,}건")

    print(f"  총 소스: {len(all_items):,}건")

    # 필터링
    sl_min = config["sl_min"]
    need_date = config["need_date"]
    date_fields = config["date_fields"]

    stats = Counter()
    passed = []
    seen_qids = set()

    for item in all_items:
        qid = item.get("qid", "")
        if not qid or not qid.startswith("Q"):
            stats["no_qid"] += 1
            continue

        # 중복 제거
        if qid in seen_qids:
            stats["duplicate"] += 1
            continue
        seen_qids.add(qid)

        # sitelinks 체크
        sl = item.get("sitelinks", 0)
        if sl < sl_min:
            stats["low_sl"] += 1
            continue

        # 날짜 체크
        if need_date and not has_date(item, date_fields):
            stats["no_date"] += 1
            continue

        # kowiki 체크
        if qid not in kowiki:
            stats["no_kowiki"] += 1
            continue

        # 통과!
        stats["passed"] += 1
        passed.append(item)

    # 통계 출력
    print(f"\n  필터링 결과:")
    print(f"    ✅ 통과: {stats['passed']:,}")
    print(f"    ❌ sl<{sl_min}: {stats['low_sl']:,}")
    if need_date:
        print(f"    ❌ 날짜없음: {stats['no_date']:,}")
    print(f"    ❌ kowiki없음: {stats['no_kowiki']:,}")
    print(f"    ❌ 중복: {stats['duplicate']:,}")
    print(f"    ❌ QID없음: {stats['no_qid']:,}")

    # sl 분포
    sl_ranges = Counter()
    for item in passed:
        sl = item.get("sitelinks", 0)
        if sl >= 100:
            sl_ranges["100+"] += 1
        elif sl >= 50:
            sl_ranges["50-99"] += 1
        elif sl >= 30:
            sl_ranges["30-49"] += 1
        elif sl >= 20:
            sl_ranges["20-29"] += 1
        else:
            sl_ranges[f"10-19"] += 1
    print(f"\n  sl 분포: {dict(sorted(sl_ranges.items()))}")

    # kowiki page_len 분포
    small = sum(1 for it in passed if kowiki.get(it["qid"], 99999) <= 9000)
    large = len(passed) - small
    print(f"  kowiki ≤9KB (AI 스킵 가능): {small:,}")
    print(f"  kowiki >9KB (요약 필요): {large:,}")

    if dry_run:
        print(f"\n  🔍 dry-run 모드 — 파일 미생성")
        return stats["passed"]

    # 파일 쓰기
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = FINAL_DIR / f"{cat_name}.jsonl"

    # 기존 파일 백업
    if out_path.exists():
        bak = FINAL_DIR / f"{cat_name}.jsonl.bak_rebuild"
        out_path.rename(bak)
        print(f"\n  💾 기존 파일 백업: {bak.name}")

    with open(out_path, "w") as f:
        for item in passed:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"  ✅ 저장: {out_path} ({len(passed):,}건)")
    return stats["passed"]


def main():
    parser = argparse.ArgumentParser(description="final/ 재구축 (sitelinks + 날짜 + kowiki 필터)")
    parser.add_argument("--dry-run", action="store_true", help="통계만 출력, 파일 안 씀")
    parser.add_argument("--category", choices=list(CATEGORY_CONFIG.keys()) + ["all"], default="all")
    args = parser.parse_args()

    print("🔄 kowiki 로딩...")
    kowiki = load_kowiki()
    print(f"   {len(kowiki):,} QIDs 로드")

    total = 0
    cats = list(CATEGORY_CONFIG.keys()) if args.category == "all" else [args.category]

    for cat in cats:
        count = rebuild_category(cat, CATEGORY_CONFIG[cat], kowiki, dry_run=args.dry_run)
        total += count

    print(f"\n{'='*60}")
    print(f"전체 합계: {total:,}건")
    if args.dry_run:
        print("(dry-run — 실제 파일 미생성)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
