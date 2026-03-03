#!/usr/bin/env python3
"""
[mk] korean_curated.jsonl → 12개 카테고리별 JSONL 분류
- 매칭된 항목: /mnt/data2/wikidata/output/categories/{카테고리}.jsonl
- 미매칭 항목: /mnt/data2/wikidata/output/categories/unmatched.jsonl
"""
import json, sys, time
from pathlib import Path
from collections import Counter

INPUT = Path("/mnt/data2/wikidata/output/korean_curated.jsonl")
OUT_DIR = Path("/mnt/data2/wikidata/output/categories")

# ── 12개 카테고리 → P31 매핑 ──────────────────────────────
CATEGORIES = {
    "01_nation": {          # 국가/정치체
        "Q3624078",    # sovereign state
        "Q6256",       # country
        "Q3024240",    # historical country
        "Q28171280",   # ancient civilization
        "Q1637706",    # city-state
        "Q170156",     # vassal state
        "Q123480",     # confederation
        "Q417175",     # protectorate
        "Q1790360",    # puppet state
        "Q1520223",    # personal union
        "Q1371849",    # political entity
        "Q1048835",    # political power
        "Q133311",     # tribe
        "Q18534049",   # abolished municipality
        "Q18663566",   # dissolved municipality
    },
    "02_event": {           # 역사적 사건
        "Q198",        # war
        "Q8465",       # armed conflict
        "Q10931",      # revolution
        "Q124734",     # rebellion
        "Q131569",     # treaty
        "Q93288",      # civil war
        "Q25906438",   # military offensive
        "Q645883",     # military operation
        "Q124757",     # riot
        "Q900406",     # reform
        "Q1656682",    # event
        "Q13418847",   # historical event
        "Q166231",     # coup d'etat
        "Q47566",      # massacre
        "Q3199915",    # genocide
        "Q7283",       # terrorism
        "Q849798",     # political crisis
    },
    "03_person": {          # 역사적 인물
        "Q5",          # human
    },
    "04_place": {           # 역사적 장소/도시
        "Q515",        # city
        "Q1549591",    # big city
        "Q3957",       # town
        "Q486972",     # human settlement
        "Q532",        # village
        "Q839954",     # archaeological site
        "Q23790",      # cave
        "Q34442",      # road
        "Q55488",      # railway station
        "Q164142",     # parish
        "Q5119",       # capital
        "Q1357964",    # port settlement
        "Q747074",     # commune (France etc)
        "Q1115575",    # civil parish
        "Q12813115",   # neighborhood
    },
    "05_building": {        # 역사적 건축물/모뉴먼트
        "Q41176",      # building
        "Q12518",      # tower
        "Q32815",      # mosque
        "Q16970",      # church building
        "Q44539",      # temple
        "Q57831",      # fortress
        "Q23413",      # castle
        "Q35112",      # dam
        "Q12280",      # bridge
        "Q162875",     # mausoleum/tomb
        "Q751876",     # château
        "Q24354",      # theater
        "Q1081138",    # seowon/academy
        "Q483110",     # stadium
        "Q811979",     # architectural structure
        "Q570116",     # tourist attraction
        "Q35509",      # cave temple
        "Q13442814",   # scholarly article → skip, wiki noise
        "Q16560",      # palace
        "Q34627",      # synagogue
        "Q33506",      # museum
        "Q174782",     # square/plaza
        "Q44613",      # monastery
        "Q5107",       # continent → skip
        "Q23397",      # lake → nature
        "Q4022",       # river → nature
    },
    "06_heritage": {        # 문화유산
        "Q210272",     # cultural heritage
        "Q9259",       # UNESCO World Heritage Site
        "Q43501",      # national monument
    },
    "07_invention": {       # 발명/발견
        "Q39546",      # tool
        "Q28640",      # profession → skip
        "Q11019",      # machine
        "Q16686022",   # device
    },
    "08_disaster": {        # 자연재해
        "Q8065",       # natural disaster
        "Q7944",       # earthquake
        "Q168247",     # volcanic eruption
        "Q8076",       # flood
        "Q8081",       # tornado
        "Q8092",       # tsunami
        "Q182925",     # cyclone
        "Q168983",     # typhoon
    },
    "09_exploration": {     # 탐험/항해
        "Q2401485",    # expedition
        "Q852446",     # exploration
    },
    "10_battle": {          # 전투
        "Q178561",     # battle
        "Q188055",     # siege
    },
    "11_pandemic": {        # 전염병
        "Q12184",      # pandemic
        "Q44512",      # epidemic
    },
    "12_artwork": {         # 예술작품
        "Q11424",      # film
        "Q7725634",    # literary work
        "Q482994",     # album
        "Q134556",     # single
        "Q5398426",    # TV series
        "Q15416",      # TV program
        "Q3305213",    # painting
        "Q860861",     # sculpture
        "Q105543609",  # musical work
        "Q7889",       # video game
        "Q47461344",   # written work
        "Q215380",     # musical group
        "Q202866",     # animated film
        "Q1004",       # comic book/manga
        "Q49084",      # short story
        "Q8274",       # manga
        "Q11446",      # ship → skip
        "Q5185279",    # poem
        "Q17537576",   # creative work
    },
}

# ─────────────────────────────────────────────────────────

# P31 → 카테고리 역매핑 (우선순위: 먼저 정의된 카테고리가 우선)
p31_to_cat = {}
for cat in sorted(CATEGORIES.keys()):
    for q in CATEGORIES[cat]:
        if q not in p31_to_cat:
            p31_to_cat[q] = cat

def main():
    if not INPUT.exists():
        print(f"ERROR: {INPUT} 없음")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    total = 0
    cat_counts = Counter()

    # 파일 핸들 열기
    handles = {}
    for cat in CATEGORIES:
        handles[cat] = open(OUT_DIR / f"{cat}.jsonl", "w")
    handles["unmatched"] = open(OUT_DIR / "unmatched.jsonl", "w")

    with open(INPUT) as fin:
        for line in fin:
            total += 1
            try:
                d = json.loads(line)
            except:
                continue

            p31s = d.get("p31") or []
            found_cat = None
            for p in p31s:
                if p in p31_to_cat:
                    found_cat = p31_to_cat[p]
                    break

            if found_cat:
                # category 필드 추가
                d["_category"] = found_cat
                handles[found_cat].write(json.dumps(d, ensure_ascii=False) + "\n")
                cat_counts[found_cat] += 1
            else:
                handles["unmatched"].write(line)
                cat_counts["unmatched"] += 1

            if total % 200_000 == 0:
                matched = total - cat_counts["unmatched"]
                print(f"  ... {total:,} | matched {matched:,} | unmatched {cat_counts['unmatched']:,}")

    # 닫기
    for h in handles.values():
        h.close()

    elapsed = time.time() - t0
    matched_total = total - cat_counts.get("unmatched", 0)

    print(f"\n{'='*55}")
    print(f"분류 완료 ({elapsed:.1f}초)")
    print(f"{'='*55}")
    print(f"입력: {total:,}건")
    print(f"매칭: {matched_total:,}건 ({matched_total/total*100:.1f}%)")
    print(f"미매칭: {cat_counts.get('unmatched',0):,}건")
    print(f"\n카테고리별:")
    for cat in sorted(CATEGORIES.keys()):
        cnt = cat_counts.get(cat, 0)
        print(f"  {cat:25s} {cnt:8,}건  → {OUT_DIR / cat}.jsonl")
    print(f"  {'unmatched':25s} {cat_counts.get('unmatched',0):8,}건  → {OUT_DIR / 'unmatched'}.jsonl")

if __name__ == "__main__":
    main()
