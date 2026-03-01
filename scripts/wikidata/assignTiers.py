#!/usr/bin/env python3
"""
Region 자동 분류 + Tier 스코어링 할당 스크립트 v2
- 좌표 기반 11개 권역 분류
- 3요소 스코어링: sitelinks + 존속기간 + 동시대 경쟁도
- 한국사 수동 오버라이드 (진형 지시)
- 결과: raw JSON에 region, tier, score 필드 업데이트

사용법: python3 scripts/wikidata/assignTiers.py
"""

import json
import math
import os
from collections import defaultdict

RAW_PATH = os.path.join(os.path.dirname(__file__), "../../public/geo/borders/wikidata_entities_raw.json")
RAW_PATH = os.path.abspath(RAW_PATH)

# ============================================================
# 11개 권역 정의 (lat/lon 바운딩 박스)
# 순서 중요: 좁은 범위가 넓은 범위보다 먼저
# ============================================================
REGIONS = [
    ("southeast_asia",  -10, 25,   90, 140),
    ("south_asia",        5, 40,   60, 100),
    ("east_asia",        18, 55,  100, 150),
    ("central_asia",     30, 55,   45, 100),
    ("middle_east",      10, 42,   25,  65),
    ("europe",           35, 72,  -25,  45),   # 유럽을 북아프리카보다 먼저 (아테네 등)
    ("north_africa",     15, 38,  -18,  40),
    ("sub_saharan",     -35, 15,  -18,  52),
    ("north_america",    15, 85, -170, -50),
    ("latin_america",   -60, 15, -120, -30),
    ("oceania",         -50,  0,  110, 180),
]

REGION_NAMES_KO = {
    "east_asia": "동아시아",
    "southeast_asia": "동남아시아",
    "south_asia": "남아시아",
    "central_asia": "중앙아시아",
    "middle_east": "중동",
    "north_africa": "북아프리카",
    "sub_saharan": "사하라이남",
    "europe": "유럽",
    "north_america": "북아메리카",
    "latin_america": "중남아메리카",
    "oceania": "오세아니아",
    "unknown": "미분류",
}


def classify_region(lat, lon) -> str:
    if lat is None or lon is None:
        return "unknown"
    for name, lat_min, lat_max, lon_min, lon_max in REGIONS:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return name
    return "unknown"


# ============================================================
# 한국사 수동 오버라이드 (진형 지시: 국가체계 = T1, 부족연맹 = T2)
# ============================================================
KOREA_TIER1 = {
    "Q28405",    # 고조선
    "Q28370",    # 고구려
    "Q28428",    # 백제
    "Q28456",    # 신라
    "Q715257",   # 통일신라
    "Q28208",    # 고려
    "Q28179",    # 조선
    "Q28233",    # 대한제국
    "Q28322",    # 발해
}

KOREA_TIER2 = {
    "Q487879",   # 부여
    "Q489868",   # 옥저
    "Q713397",   # 동예
    "Q704278",   # 마한
    "Q1378584",  # 변한
    "Q1157054",  # 대가야
    "Q715210",   # 금관가야
    "Q28057",    # 탐라
    "Q703340",   # 위만조선
    "Q698239",   # 후백제
    "Q703195",   # 후발해
    "Q28278",    # 대한민국 임시정부
}


# ============================================================
# 날짜 파서
# ============================================================
def parse_year(s: str) -> int | None:
    if not s:
        return None
    s = s.strip()
    if s.lower() in ("present", "현재"):
        return 2025
    s = s.replace("c. ", "").replace("c.", "")
    # 괄호 제거: "BC 2025 (Old Assyrian)" → "BC 2025"
    if "(" in s:
        s = s[:s.index("(")].strip()
    if s.upper().startswith("BC ") or s.upper().startswith("BC"):
        num = s.upper().replace("BC", "").strip()
        try:
            return -int(num)
        except ValueError:
            return None
    if s.upper().startswith("AD ") or s.upper().startswith("AD"):
        num = s.upper().replace("AD", "").strip()
        try:
            return int(num)
        except ValueError:
            return None
    try:
        return int(s)
    except ValueError:
        return None


# ============================================================
# 스코어링 함수
# ============================================================
def compute_scores(raw: list[dict]) -> None:
    """
    3요소 스코어링:
    1. sitelinks_score: log(sitelinks+1)*12  (0~75 범위)
    2. duration_score:  min(duration/50, 20)  (0~20 범위, 1000년=20점)
    3. dominance_score: 해당 지역×세기에서 sitelinks 순위 기반 (0~30 범위)

    총점 = sitelinks_score + duration_score + dominance_score
    """

    # 1단계: 기본 점수 계산
    for e in raw:
        sl = e.get("sitelinks", 0)
        e["_sl_score"] = math.log(sl + 1) * 12  # 0~75

        start = parse_year(e.get("start", ""))
        end = parse_year(e.get("end", ""))
        if start is not None and end is not None and end > start:
            duration = end - start
            e["_dur_score"] = min(duration / 50, 20)  # 0~20
            e["_start"] = start
            e["_end"] = end
        else:
            e["_dur_score"] = 0
            e["_start"] = None
            e["_end"] = None

    # 2단계: 동시대 경쟁도 (region × century)
    # 각 (region, century)에 존재하는 엔티티들 중 sitelinks 순위
    century_map = defaultdict(list)  # (region, century) → [(idx, sitelinks)]

    for i, e in enumerate(raw):
        if e["_start"] is None or e["_end"] is None:
            continue
        region = e.get("region", "unknown")
        # 이 엔티티가 존재했던 모든 세기
        start_c = e["_start"] // 100
        end_c = e["_end"] // 100
        for c in range(start_c, end_c + 1):
            century_map[(region, c)].append((i, e.get("sitelinks", 0)))

    # 각 엔티티의 최고 순위 (가장 경쟁자 적었던 세기에서의 순위)
    best_rank = [0.0] * len(raw)
    for (region, century), entries in century_map.items():
        # sitelinks 내림차순 정렬
        entries.sort(key=lambda x: -x[1])
        total = len(entries)
        for rank, (idx, _) in enumerate(entries):
            if total <= 1:
                percentile = 1.0
            else:
                percentile = 1.0 - (rank / (total - 1))
            # 이 엔티티의 최고 percentile 기록
            if percentile > best_rank[idx]:
                best_rank[idx] = percentile

    for i, e in enumerate(raw):
        # dominance_score: 0~30
        # percentile 1.0 (1등) → 30점, 0.0 (꼴등) → 0점
        e["_dom_score"] = best_rank[i] * 30

    # 3단계: 총점
    for e in raw:
        e["score"] = round(e["_sl_score"] + e["_dur_score"] + e["_dom_score"], 1)

    # 임시 필드 제거
    for e in raw:
        for k in ["_sl_score", "_dur_score", "_dom_score", "_start", "_end"]:
            e.pop(k, None)


def assign_tiers(raw: list[dict]) -> None:
    """
    스코어 기반 Tier 할당 (region별 상대 배분)
    한국사 오버라이드 우선 적용
    """
    # 1. 한국사 오버라이드
    for e in raw:
        qid = e.get("qid", "")
        if qid in KOREA_TIER1:
            e["tier"] = 1
            e["tier_reason"] = "korea_t1"
        elif qid in KOREA_TIER2:
            e["tier"] = 2
            e["tier_reason"] = "korea_t2"
        else:
            e["tier"] = None  # 아직 미할당
            e["tier_reason"] = None

    # 2. region별 score 기반 Tier 할당
    regions = set(e.get("region", "unknown") for e in raw)

    for region in regions:
        # 해당 region에서 아직 tier 미할당인 엔티티
        candidates = [e for e in raw if e.get("region") == region and e["tier"] is None]
        if not candidates:
            continue

        # score 내림차순 정렬
        candidates.sort(key=lambda e: e.get("score", 0), reverse=True)
        n = len(candidates)

        for rank, e in enumerate(candidates):
            pct = rank / n if n > 0 else 0

            # 각 region에서:
            # 상위 8%  → Tier 1 (세계사 급)
            # 8~25%   → Tier 2 (지역 핵심)
            # 25~55%  → Tier 3 (보조)
            # 55~100% → Tier 4 (기록용)
            if pct < 0.08:
                e["tier"] = 1
                e["tier_reason"] = "score_top8"
            elif pct < 0.25:
                e["tier"] = 2
                e["tier_reason"] = "score_top25"
            elif pct < 0.55:
                e["tier"] = 3
                e["tier_reason"] = "score_top55"
            else:
                e["tier"] = 4
                e["tier_reason"] = "score_rest"

    # 미분류(unknown region) 중 tier 없는 것 → Tier 4
    for e in raw:
        if e["tier"] is None:
            e["tier"] = 4
            e["tier_reason"] = "no_region"


def main():
    with open(RAW_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    print(f"총 엔티티: {len(raw)}개")

    # 1. Region 분류
    for e in raw:
        lat = float(e["lat"]) if e.get("lat") else None
        lon = float(e["lon"]) if e.get("lon") else None
        e["region"] = classify_region(lat, lon)

    region_counts = defaultdict(int)
    for e in raw:
        region_counts[e["region"]] += 1

    print("\n=== Region 분류 ===")
    for r, count in sorted(region_counts.items(), key=lambda x: -x[1]):
        print(f"  {REGION_NAMES_KO.get(r, r):15} : {count}개")

    # 2. 스코어 계산
    compute_scores(raw)

    # 3. Tier 할당
    assign_tiers(raw)

    # 4. 결과 출력
    tier_counts = defaultdict(int)
    for e in raw:
        tier_counts[e["tier"]] += 1

    print(f"\n=== Tier 결과 ===")
    for t in [1, 2, 3, 4]:
        print(f"  Tier {t}: {tier_counts[t]}개")

    # Region × Tier 교차표
    print(f"\n=== Region × Tier ===")
    print(f"{'Region':20} | {'T1':>4} | {'T2':>4} | {'T3':>4} | {'T4':>4} | {'계':>5}")
    print("-" * 62)
    for region in sorted(set(e["region"] for e in raw)):
        rs = [e for e in raw if e["region"] == region]
        ts = {t: sum(1 for e in rs if e["tier"] == t) for t in [1, 2, 3, 4]}
        name = REGION_NAMES_KO.get(region, region)
        print(f"{name:20} | {ts[1]:4} | {ts[2]:4} | {ts[3]:4} | {ts[4]:4} | {sum(ts.values()):5}")

    # Tier 1 목록
    t1 = sorted([e for e in raw if e["tier"] == 1], key=lambda e: e.get("score", 0), reverse=True)
    print(f"\n=== Tier 1 전체 ({len(t1)}개) ===")
    for e in t1:
        ko = e.get("name_ko") or "(없음)"
        rgn = REGION_NAMES_KO.get(e["region"], e["region"])
        reason = e.get("tier_reason", "?")
        flag = ""
        if reason == "korea_t1":
            flag = " 🇰🇷"
        elif reason.startswith("score"):
            flag = ""
        print(f"  {e.get('score',0):5.1f}점 | sl={e.get('sitelinks',0):3} | {rgn:10} | {ko:15} | {e['name_en']}{flag}")

    # Tier 2에서 주목할 만한 엔티티 (스코어 높은데 T2인 것)
    t2_notable = sorted([e for e in raw if e["tier"] == 2], key=lambda e: e.get("score", 0), reverse=True)[:20]
    print(f"\n=== Tier 2 상위 20개 (승격 후보) ===")
    for e in t2_notable:
        ko = e.get("name_ko") or "(없음)"
        rgn = REGION_NAMES_KO.get(e["region"], e["region"])
        print(f"  {e.get('score',0):5.1f}점 | sl={e.get('sitelinks',0):3} | {rgn:10} | {ko:15} | {e['name_en']}")

    # 5. 저장
    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)

    print(f"\n저장 완료: {RAW_PATH}")


if __name__ == "__main__":
    main()
