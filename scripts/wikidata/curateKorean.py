#!/usr/bin/env python3
"""
[mk] korean_all.jsonl 큐레이션 스크립트
- 제거할 P31 타입을 REMOVE_P31에 하나씩 추가
- korean_all.jsonl → korean_curated.jsonl 생성
- 제거된 항목은 korean_removed.jsonl에 보관 (복구용)
"""
import json, sys, time
from pathlib import Path

INPUT  = Path("/mnt/data2/wikidata/output/korean_all.jsonl")
OUTPUT = Path("/mnt/data2/wikidata/output/korean_curated.jsonl")
REMOVED = Path("/mnt/data2/wikidata/output/korean_removed.jsonl")

# ── 제거할 P31 목록 (수동 확인 후 하나씩 추가) ──────────────
REMOVE_P31 = {
    "Q4167836",    # Wikimedia category (분류:XXX) — 416,706건
    "Q47150325",   # calendar day of a year (1월 15일 등) — 166,255건
    "Q29654788",   # date in Gregorian calendar (그레고리력 날짜) — 140,088건
    "Q115595777",  # scholarly article identifier (학술 논문 식별자) — 94,995건
    "Q53764732",   # Wikipedia redirect (위키백과 리다이렉트) — 80,242건
    "Q17300291",   # interlanguage link template (언어간 링크 템플릿) — 74,447건
    "Q4167410",    # Wikimedia disambiguation page (동음이의어 문서) — 67,190건
    "Q11266439",   # Wikimedia template (위키미디어 템플릿) — 28,916건
    "Q59541917",   # Wikimedia permanent duplicate (위키미디어 영구 중복) — 9,279건
    # ── 2차 제거 ──
    "Q22808320",   # Wikimedia human name disambiguation (위키 인명 동음이의어) — 8,394건
    "Q13406463",   # Wikimedia list article (위키 목록 문서) — 7,435건
    "Q47018478",   # period of time (기간/시대) — 6,240건
    # Q18663566 — dissolved municipality (폐지된 지자체) — 유지! TV에피소드 아님, 역사적 행정구역
    # ── 3차 제거 ──
    "Q11753321",   # Wikimedia template (위키미디어 템플릿, 2차 누락분) — 6,400건
    "Q101352",     # family name (성씨) — 5,693건
    "Q55809450",   # Hangul syllable (한글 음절) — 2,267건
    "Q109483621",  # redirect (리다이렉트, 2차 누락분) — ~3,500건
}
# ─────────────────────────────────────────────────────────

def main():
    if not INPUT.exists():
        print(f"ERROR: {INPUT} 없음")
        sys.exit(1)

    t0 = time.time()
    total = kept = removed = 0
    removed_by_p31 = {}

    with open(INPUT) as fin, \
         open(OUTPUT, "w") as fout, \
         open(REMOVED, "w") as frem:

        for line in fin:
            total += 1
            try:
                d = json.loads(line)
            except:
                continue

            p31s = set(d.get("p31") or [])
            matched = p31s & REMOVE_P31

            if matched:
                removed += 1
                frem.write(line)
                for p in matched:
                    removed_by_p31[p] = removed_by_p31.get(p, 0) + 1
            else:
                kept += 1
                fout.write(line)

            if total % 200_000 == 0:
                print(f"  ... {total:,} 처리 | 유지 {kept:,} | 제거 {removed:,}")

    elapsed = time.time() - t0

    print(f"\n{'='*50}")
    print(f"큐레이션 완료 ({elapsed:.1f}초)")
    print(f"{'='*50}")
    print(f"입력:  {total:,}건")
    print(f"유지:  {kept:,}건 → {OUTPUT}")
    print(f"제거:  {removed:,}건 → {REMOVED}")
    print(f"\n제거 내역:")
    for p31, cnt in sorted(removed_by_p31.items(), key=lambda x: -x[1]):
        print(f"  {p31}: {cnt:,}건")

if __name__ == "__main__":
    main()
