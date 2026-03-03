#!/usr/bin/env python3
"""
[mk] korean_all.jsonl 큐레이션 스크립트
- 제거할 P31 타입을 REMOVE_P31에 하나씩 추가
- kowiki 리다이렉트 QID도 제거 (redirect_qids.json)
- kowiki page_len 500B 미만 스텁 제거 (qid_pagelen.json)
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
    # ── 4차 제거 (unmatched 분석 후) ──
    "Q16521",      # taxon (생물/종) — 41,755건
    "Q202444",     # given name (여성 이름) — 4,906건
    "Q12308941",   # given name (남성 이름) — 4,484건
    "Q27020041",   # sports season (스포츠 시즌) — 4,166건
    "Q23894233",   # Wikimedia category (위키미디어 분류, 누락분) — 3,476건
    "Q22809413",   # Chinese given name (중국어 이름) — 3,352건
    "Q5633421",    # academic journal (학술 저널) — 2,856건
    "Q6881511",    # enterprise (기업, 중복타입) — 2,756건
    "Q29964144",   # year (연도) — 2,317건
    "Q28920044",   # natural number (자연수) — 2,142건
    # ── 5차 제거 (unmatched 랜덤샘플 분석 후) ──
    "Q9842",       # elementary school (초등학교) — 7,526건
    "Q149566",     # middle school (중학교) — 3,376건
    "Q9826",       # high school (고등학교) — 2,173건
    "Q928830",     # metro station (지하철역) — 3,344건
    "Q22808403",   # metro station (지하철역, 중복타입) — 2,744건
    "Q476028",     # football club (축구 클럽) — 3,255건
    "Q490329",     # administrative dong (행정동) — 2,857건
    "Q26213387",   # sporting event delegation (스포츠 대표단) — 2,606건
    "Q14795564",   # date in lunar calendar (음력 날짜) — 773건
    "Q11879590",   # female given name (여성이름, 추가) — 1,199건
    "Q3409032",    # unisex given name (공용이름) — 1,352건
    "Q25930717",   # Pokémon species (포켓몬) — 85건
    "Q586821",     # go competition (바둑대회) — 32건
    "Q18711811",   # Wikimedia template (위키미디어 틀, 잔여) — 2,553건
    "Q15184295",   # Wikimedia module (위키미디어 모듈) — 1,693건
    "Q106612246",  # Wikimedia category (위키미디어 분류, 잔여) — 607건
    # 프랜차이즈 허구인물 (삼국지/수호전 등 Q15632617은 유지)
    "Q1114461",    # Star Wars character (스타워즈) — 1,977건
    "Q3658341",    # Star Trek character (스타트렉) — 1,942건
    "Q15773317",   # TV series character (TV시리즈 허구인물) — 2,653건
    "Q15773347",   # Dragon Ball character (드래곤볼) — 1,921건
    "Q87576284",   # Dragon Ball character (드래곤볼) — 1,912건
    "Q80447738",   # Dragon Ball character (드래곤볼) — 2,314건
    "Q1569167",    # video game character (게임 허구인물) — 1,810건
}
# ─────────────────────────────────────────────────────────

# ── kowiki 리다이렉트 QID (위키백과 #넘겨주기 페이지) ──
REDIRECT_QIDS_FILE = Path("/mnt/data2/kowiki/redirect_qids.json")
# ── kowiki page_len 인덱스 (QID → 바이트 크기) ──
PAGELEN_FILE = Path("/mnt/data2/kowiki/qid_pagelen.json")
STUB_THRESHOLD = 500  # 이 미만은 스텁으로 제거

def load_redirect_qids():
    if not REDIRECT_QIDS_FILE.exists():
        print(f"WARNING: {REDIRECT_QIDS_FILE} 없음 — 리다이렉트 필터 스킵")
        return set()
    with open(REDIRECT_QIDS_FILE) as f:
        qids = json.load(f)
    print(f"리다이렉트 QID 로드: {len(qids):,}개")
    return set(qids)

def load_pagelen_index():
    if not PAGELEN_FILE.exists():
        print(f"WARNING: {PAGELEN_FILE} 없음 — 스텁 필터 스킵")
        return {}
    with open(PAGELEN_FILE) as f:
        idx = json.load(f)
    print(f"page_len 인덱스 로드: {len(idx):,}개")
    return idx

def main():
    if not INPUT.exists():
        print(f"ERROR: {INPUT} 없음")
        sys.exit(1)

    redirect_qids = load_redirect_qids()
    pagelen_idx = load_pagelen_index()

    t0 = time.time()
    total = kept = removed = removed_redirect = removed_stub = 0
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

            qid = d.get("qid", "")

            # 리다이렉트 QID 제거
            if qid in redirect_qids:
                removed += 1
                removed_redirect += 1
                frem.write(line)
                continue

            # kowiki page_len 500B 미만 스텁 제거
            pl = pagelen_idx.get(qid)
            if pl is not None and pl < STUB_THRESHOLD:
                removed += 1
                removed_stub += 1
                frem.write(line)
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
    print(f"  (리다이렉트: {removed_redirect:,}건)")
    print(f"  (스텁 <{STUB_THRESHOLD}B: {removed_stub:,}건)")
    print(f"\n제거 내역:")
    for p31, cnt in sorted(removed_by_p31.items(), key=lambda x: -x[1]):
        print(f"  {p31}: {cnt:,}건")

if __name__ == "__main__":
    main()
