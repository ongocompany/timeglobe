#!/usr/bin/env python3
"""
persons 기계적 사전 필터 (Step 1)
- 52,229건 → ~15,000~20,000건 목표
- occupation 필터 + 연대별 sl 차등
- 기존 카드 보유자 자동 통과

Usage:
  python3 scripts/wikidata/filterPersons.py --dry-run   # 통계만 출력
  python3 scripts/wikidata/filterPersons.py              # 실제 필터링 실행

jinserver에서 실행:
  python3 filterPersons.py --dry-run
"""

import json
import sys
import os
from collections import Counter, defaultdict

# ── 경로 설정 ──
BASE = "/mnt/data2/wikidata/output"
PERSONS_FILE = f"{BASE}/final/persons.jsonl"
CARDS_FILE = f"{BASE}/cards/persons/cards_persons.jsonl"
OUTPUT_FILE = f"{BASE}/final/persons_filtered.jsonl"
REJECTED_FILE = f"{BASE}/final/persons_rejected.jsonl"

# ── 제외 occupation QID (스포츠) ──
SPORTS_QIDS = {
    "Q937857",   # 축구 선수
    "Q628099",   # 축구 감독
    "Q3665646",  # 농구 선수
    "Q5137571",  # 농구 감독
    "Q11513337", # 육상 선수
    "Q13474373", # 프로 레슬링 선수
    "Q10843402", # 수영 선수
    "Q10833314", # 테니스 선수
    "Q6665249",  # 유도 선수
    "Q12369333", # 아마추어 레슬링
    "Q11338576", # 권투 선수
    "Q11774891", # 아이스하키 선수
    "Q4009406",  # 단거리 선수
    "Q13381863", # 펜싱 선수
    "Q4144610",  # 알파인 스키
    "Q10349745", # 레이싱 드라이버
    "Q13219587", # 피겨 스케이팅
    "Q4439155",  # 장거리 달리기
    "Q13381572", # 체조 선수
    "Q12840545", # 핸드볼 선수
    "Q13381753", # 중거리 달리기
    "Q10866633", # 스피드 스케이팅
    "Q2309784",  # 사이클 선수
    "Q13382608", # 크로스컨트리 스키
    "Q11607585", # 종합 격투기
    "Q2066131",  # athlete (일반)
    "Q2986228",  # 스포츠캐스터
}

# ── 제외 occupation QID (연예/하위문화) ──
ENTERTAINMENT_QIDS = {
    "Q33999",    # 배우
    "Q10800557", # 영화 배우
    "Q10798782", # 텔레비전 배우
    "Q2259451",  # 연극 배우
    "Q2405480",  # 성우
    "Q622807",   # 성우 (일본)
    "Q11481802", # 더빙 성우
    "Q4610556",  # 모델
    "Q245068",   # 코미디언
    "Q947873",   # TV 사회자
    "Q578109",   # TV 프로듀서
    "Q183945",   # 음악 프로듀서
    "Q55960555", # recording artist
    "Q2252262",  # 래퍼
    "Q2722764",  # 라디오 DJ
    "Q130857",   # 디스크자키
    "Q948329",   # character actor
    "Q970153",   # 아역 배우
    "Q488111",   # 포르노 배우
    "Q465501",   # 스턴트 배우
    "Q18581305", # beauty pageant
    "Q17125263", # 유튜버
    "Q15077007", # 팟캐스터
    "Q8246794",  # 블로거
    "Q13590141", # 진행자
    "Q5716684",  # 무용가
    "Q1053574",  # 총괄 프로듀서
    "Q47541952", # producer (일반)
    "Q3282637",  # 영화 프로듀서
}

EXCLUDE_QIDS = SPORTS_QIDS | ENTERTAINMENT_QIDS

# ── "가치 있는" occupation (이것 중 하나라도 있으면 제외 대상에서 보호) ──
VALUABLE_QIDS = {
    "Q82955",    # 정치인
    "Q116",      # 군주
    "Q2304859",  # 통치자 (sovereign)
    "Q1097498",  # 통치자 (ruler)
    "Q372436",   # statesperson
    "Q83307",    # 장관
    "Q189290",   # 장교
    "Q47064",    # 군인
    "Q1402561",  # military leader
    "Q4991371",  # 병사
    "Q36180",    # 작가
    "Q6625963",  # 소설가
    "Q49757",    # 시인
    "Q214917",   # 극작가
    "Q18844224", # SF 작가
    "Q4853732",  # 아동 문학가
    "Q15980158", # 논픽션 작가
    "Q864380",   # 전기 작가
    "Q15949613", # 단편 소설가
    "Q482980",   # 저자
    "Q1622272",  # 대학 교수
    "Q121594",   # 교수
    "Q1650915",  # 연구원
    "Q901",      # 과학자
    "Q170790",   # 수학자
    "Q169470",   # 물리학자
    "Q19350898", # 이론물리학자
    "Q593644",   # 화학자
    "Q864503",   # 생물학자
    "Q2919046",  # 생화학자
    "Q11063",    # 천문학자
    "Q82594",    # 컴퓨터 과학자
    "Q350979",   # 동물학자
    "Q2374149",  # 식물학자
    "Q2055046",  # 생리학자
    "Q18805",    # 자연과학자
    "Q4773904",  # 인류학자
    "Q212980",   # 심리학자
    "Q188094",   # 경제학자
    "Q2306091",  # 사회학자
    "Q1238570",  # 정치학자
    "Q14467526", # 언어학자
    "Q901402",   # 지리학자
    "Q4964182",  # 철학자
    "Q1234713",  # 신학자
    "Q185351",   # 법학자
    "Q201788",   # 역사가
    "Q1792450",  # 미술사학자
    "Q205375",   # 발명가
    "Q42973",    # 건축가
    "Q81096",    # 기술자
    "Q39631",    # 의사
    "Q16533",    # 판사
    "Q40348",    # 변호사
    "Q193391",   # 외교관
    "Q11631",    # 우주비행사
    "Q11900058", # 탐험가
    "Q3242115",  # 혁명가
    "Q15253558", # 운동가 (activist)
    "Q1476215",  # 인권운동가
    "Q28692502", # 여성인권운동가
    "Q15627169", # 노동운동가
    "Q250867",   # 신부
    "Q611644",   # 주교
    "Q2095549",  # 비행사
    "Q37226",    # 교사
    "Q1231865",  # 교육학자
    "Q212238",   # 공무원
    "Q2478141",  # 귀족
    "Q5784340",  # consort
    "Q1028181",  # 화가
    "Q1281618",  # 조각가
    "Q644687",   # 삽화가
    "Q158852",   # 지휘자 (클래식)
    "Q36834",    # 작곡가 (클래식 포함)
}


def get_era(birth_year):
    """출생연도 → 시대 분류"""
    if birth_year is None:
        return "unknown"
    if birth_year < 1800:
        return "ancient_premodern"  # 고대~근세
    elif birth_year < 1900:
        return "modern_early"       # 근대
    elif birth_year < 1950:
        return "modern_mid"         # 현대초
    elif birth_year < 1980:
        return "contemporary"       # 현대
    else:
        return "recent"             # 동시대


def get_sl_threshold(birth_year, is_exclude_only):
    """
    연대별 sl 기준치 반환.
    is_exclude_only: occupation이 전부 EXCLUDE 카테고리인 경우 더 높은 기준 적용
    """
    if birth_year is None:
        birth_year = 1900  # 날짜 없으면 중간값

    if is_exclude_only:
        # 스포츠/연예 전용 인물은 더 높은 기준
        if birth_year >= 1980:
            return 200   # 사실상 거의 통과 불가
        elif birth_year >= 1950:
            return 150   # 초유명만 통과 (펠레, 무하마드 알리 등)
        elif birth_year >= 1900:
            return 80    # 역사적 스포츠/연예인은 좀 더 관대
        else:
            return 40    # 고대~근대 배우/운동선수는 거의 다 역사적
    else:
        # 일반 인물 연대별 sl 차등
        if birth_year >= 1980:
            return 80
        elif birth_year >= 1950:
            return 50
        elif birth_year >= 1900:
            return 30
        else:
            return 20    # 고대~근대는 전부 유지


def main():
    dry_run = "--dry-run" in sys.argv

    # 1. 기존 카드 QID 로드
    card_qids = set()
    if os.path.exists(CARDS_FILE):
        with open(CARDS_FILE) as f:
            for line in f:
                d = json.loads(line)
                qid = d.get("_qid") or d.get("qid")
                if qid:
                    card_qids.add(qid)
    print(f"기존 카드 보유: {len(card_qids)}명 (자동 통과)")

    # 2. persons 로드 및 필터링
    total = 0
    passed = 0
    rejected = 0
    pass_reasons = Counter()
    reject_reasons = Counter()
    era_stats = defaultdict(lambda: {"total": 0, "passed": 0, "rejected": 0})
    occ_reject_stats = Counter()

    passed_records = []
    rejected_records = []

    with open(PERSONS_FILE) as f:
        for line in f:
            d = json.loads(line)
            total += 1
            qid = d["qid"]
            sl = d.get("sitelinks", 0)
            birth_year = d.get("birth_year")
            occs = set(d.get("occupation_qids") or [])
            era = get_era(birth_year)
            era_stats[era]["total"] += 1

            # 자동 통과: 기존 카드 보유
            if qid in card_qids:
                passed += 1
                pass_reasons["card_exists"] += 1
                era_stats[era]["passed"] += 1
                passed_records.append(d)
                continue

            # occupation 분류
            has_valuable = bool(occs & VALUABLE_QIDS)
            has_exclude = bool(occs & EXCLUDE_QIDS)
            non_exclude = occs - EXCLUDE_QIDS
            is_exclude_only = has_exclude and len(non_exclude) == 0

            # 특수 케이스: occupation 정보 없음 → 일반 기준 적용
            if not occs:
                is_exclude_only = False

            # sl 기준치 결정
            threshold = get_sl_threshold(birth_year, is_exclude_only)

            if sl >= threshold:
                passed += 1
                if has_valuable:
                    pass_reasons["valuable_occ"] += 1
                elif is_exclude_only:
                    pass_reasons["high_sl_entertainment"] += 1
                else:
                    pass_reasons["sl_threshold"] += 1
                era_stats[era]["passed"] += 1
                passed_records.append(d)
            else:
                rejected += 1
                if is_exclude_only:
                    reject_reasons["exclude_occ_low_sl"] += 1
                    for occ in (occs & EXCLUDE_QIDS):
                        occ_reject_stats[occ] += 1
                else:
                    reject_reasons["below_sl_threshold"] += 1
                era_stats[era]["rejected"] += 1
                rejected_records.append(d)

    # 3. 결과 출력
    print(f"\n{'='*60}")
    print(f"총 인원: {total:,}")
    print(f"통과: {passed:,} ({passed/total*100:.1f}%)")
    print(f"제외: {rejected:,} ({rejected/total*100:.1f}%)")
    print(f"{'='*60}")

    print(f"\n통과 사유:")
    for reason, cnt in pass_reasons.most_common():
        print(f"  {reason}: {cnt:,}")

    print(f"\n제외 사유:")
    for reason, cnt in reject_reasons.most_common():
        print(f"  {reason}: {cnt:,}")

    print(f"\n연대별 분포:")
    era_order = ["ancient_premodern", "modern_early", "modern_mid", "contemporary", "recent", "unknown"]
    era_labels = {
        "ancient_premodern": "고대~근세 (~1800)",
        "modern_early": "근대 (1800~1900)",
        "modern_mid": "현대초 (1900~1950)",
        "contemporary": "현대 (1950~1980)",
        "recent": "동시대 (1980~)",
        "unknown": "날짜 미상",
    }
    for era in era_order:
        s = era_stats[era]
        if s["total"] == 0:
            continue
        pct = s["passed"] / s["total"] * 100 if s["total"] > 0 else 0
        print(f"  {era_labels[era]:20s}: {s['total']:>6,} → 통과 {s['passed']:>6,} ({pct:.0f}%) / 제외 {s['rejected']:>6,}")

    # 통과자 sl 분포
    sl_buckets = Counter()
    for d in passed_records:
        sl = d.get("sitelinks", 0)
        if sl >= 200: sl_buckets["200+"] += 1
        elif sl >= 100: sl_buckets["100-199"] += 1
        elif sl >= 50: sl_buckets["50-99"] += 1
        elif sl >= 30: sl_buckets["30-49"] += 1
        else: sl_buckets["20-29"] += 1
    print(f"\n통과자 sl 분포:")
    for bucket in ["200+", "100-199", "50-99", "30-49", "20-29"]:
        print(f"  sl {bucket}: {sl_buckets.get(bucket, 0):,}")

    if not dry_run:
        # 4. 파일 저장
        with open(OUTPUT_FILE, "w") as f:
            for d in passed_records:
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
        print(f"\n✓ 통과 목록 저장: {OUTPUT_FILE} ({len(passed_records):,}건)")

        with open(REJECTED_FILE, "w") as f:
            for d in rejected_records:
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
        print(f"✓ 제외 목록 저장: {REJECTED_FILE} ({len(rejected_records):,}건)")
    else:
        print(f"\n[dry-run] 파일 저장 생략. 실행하려면 --dry-run 없이 실행하세요.")


if __name__ == "__main__":
    main()
