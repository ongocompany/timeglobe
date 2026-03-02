#!/usr/bin/env python3
"""
[cl] Wikidata dump → 한국어 label 있는 엔티티 전량 추출

카테고리 분류 없이, 한국어 표제어(labels.ko)가 존재하는 엔티티를
**전부** 1-pass로 추출한다. 분류는 추출 후 별도 스크립트로.

예상 규모: ~74만건 (Wikidata 한국어 표제어 기준)
출력 형식: JSONL (한 줄 = 1 엔티티)
예상 시간: 8~12시간 (118M 엔티티 gz 스트리밍)

사용법:
  python3 parseKorean.py              # 전체 실행
  python3 parseKorean.py --resume     # 이전 진행분 이어서 (QID 스킵)
  python3 parseKorean.py --stats      # 결과 통계만

출력 (/mnt/data2/wikidata/output/):
  korean_all.jsonl      → 한국어 label 있는 전체 엔티티
  korean_progress.json  → 실시간 진행 상황
"""

import gzip
import json
import sys
import os
import time

# ── 설정 ──────────────────────────────────────────────
DUMP_PATH = "/mnt/data2/wikidata/latest-all.json.gz"
OUTPUT_DIR = "/mnt/data2/wikidata/output"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "korean_all.jsonl")
PROGRESS_PATH = os.path.join(OUTPUT_DIR, "korean_progress.json")

# ── Wikidata Property IDs ─────────────────────────────
P_INSTANCE_OF = "P31"
P_COORD = "P625"
P_COUNTRY = "P17"
P_BIRTH_DATE = "P569"
P_DEATH_DATE = "P570"
P_BIRTH_PLACE = "P19"
P_DEATH_PLACE = "P20"
P_CITIZENSHIP = "P27"
P_OCCUPATION = "P106"
P_START_TIME = "P580"
P_END_TIME = "P582"
P_POINT_IN_TIME = "P585"
P_INCEPTION = "P571"
P_DISSOLVED = "P576"
P_LOCATION = "P276"
P_CAPITAL = "P36"
P_IMAGE = "P18"
P_PART_OF = "P361"
P_CONFLICT = "P607"
P_CREATOR = "P170"
P_AUTHOR = "P50"
P_GENRE = "P136"
P_MOVEMENT = "P135"
P_INVENTOR = "P61"


def first_entity_id(claims, prop):
    """클레임에서 첫 번째 엔티티 QID 추출"""
    cl = claims.get(prop)
    if not cl:
        return None
    for c in cl:
        ms = c.get("mainsnak", {})
        dv = ms.get("datavalue", {})
        if dv.get("type") == "wikibase-entityid":
            return "Q" + str(dv["value"].get("numeric-id", ""))
    return None


def all_entity_ids(claims, prop):
    """클레임에서 모든 엔티티 QID 리스트 추출"""
    cl = claims.get(prop)
    if not cl:
        return []
    result = []
    for c in cl:
        ms = c.get("mainsnak", {})
        dv = ms.get("datavalue", {})
        if dv.get("type") == "wikibase-entityid":
            result.append("Q" + str(dv["value"].get("numeric-id", "")))
    return result


def first_coord(claims):
    """P625 좌표 추출 → [lat, lon]"""
    cl = claims.get(P_COORD)
    if not cl:
        return None
    ms = cl[0].get("mainsnak", {})
    dv = ms.get("datavalue", {})
    if dv.get("type") == "globecoordinate":
        v = dv["value"]
        return [round(v.get("latitude", 0), 4), round(v.get("longitude", 0), 4)]
    return None


def first_year(claims, prop):
    """시간 클레임에서 연도(int) 추출. BC도 음수로."""
    cl = claims.get(prop)
    if not cl:
        return None
    ms = cl[0].get("mainsnak", {})
    dv = ms.get("datavalue", {})
    if dv.get("type") != "time":
        return None
    tv = dv["value"].get("time", "")
    try:
        # "+2023-01-01T00:00:00Z" or "-0500-01-01T00:00:00Z"
        if tv.startswith("+"):
            return int(tv[1:5])
        elif tv.startswith("-"):
            return -int(tv[1:5])
    except (ValueError, IndexError):
        pass
    return None


def count_sitelinks(entity):
    """sitelinks 개수"""
    sl = entity.get("sitelinks")
    if not sl:
        return 0
    return len(sl)


def get_label(entity, lang):
    """특정 언어 label 추출"""
    labels = entity.get("labels", {})
    l = labels.get(lang)
    if l:
        return l.get("value")
    return None


def get_desc(entity, lang):
    """특정 언어 description 추출"""
    descs = entity.get("descriptions", {})
    d = descs.get(lang)
    if d:
        return d.get("value")
    return None


def extract_entity(entity):
    """한국어 label이 있는 엔티티에서 필요한 필드 추출"""
    qid = entity.get("id", "")
    claims = entity.get("claims", {})

    # P31 (instance of) — 전체 리스트 (나중에 분류용)
    p31_ids = all_entity_ids(claims, P_INSTANCE_OF)

    # 라벨 (ko 필수, en/ja/zh 보조)
    name_ko = get_label(entity, "ko")
    name_en = get_label(entity, "en")
    name_ja = get_label(entity, "ja")
    name_zh = get_label(entity, "zh")

    # 설명
    desc_ko = get_desc(entity, "ko")
    desc_en = get_desc(entity, "en")

    # 시간 정보 — 가능한 모든 날짜 필드
    birth_year = first_year(claims, P_BIRTH_DATE)
    death_year = first_year(claims, P_DEATH_DATE)
    start_year = first_year(claims, P_START_TIME)
    end_year = first_year(claims, P_END_TIME)
    point_in_time = first_year(claims, P_POINT_IN_TIME)
    inception = first_year(claims, P_INCEPTION)
    dissolved = first_year(claims, P_DISSOLVED)

    # 좌표
    coord = first_coord(claims)

    # 관련 엔티티 QID
    country_qid = first_entity_id(claims, P_COUNTRY)
    location_qid = first_entity_id(claims, P_LOCATION)
    birth_place_qid = first_entity_id(claims, P_BIRTH_PLACE)
    capital_qid = first_entity_id(claims, P_CAPITAL)
    part_of_qid = first_entity_id(claims, P_PART_OF)

    # 직업 (인물용) — 전체 리스트
    occupation_qids = all_entity_ids(claims, P_OCCUPATION)
    citizenship_qid = first_entity_id(claims, P_CITIZENSHIP)

    # 이미지
    image_cl = claims.get(P_IMAGE)
    image = None
    if image_cl:
        ms = image_cl[0].get("mainsnak", {})
        dv = ms.get("datavalue", {})
        if dv.get("type") == "string":
            image = dv.get("value")

    # sitelinks
    sl_count = count_sitelinks(entity)

    result = {
        "qid": qid,
        "name_ko": name_ko,
        "name_en": name_en,
        "sitelinks": sl_count,
        "p31": p31_ids,
        "desc_ko": desc_ko,
        "desc_en": desc_en,
    }

    # 선택적 필드 — None이 아닌 것만 포함 (파일 크기 절약)
    if name_ja: result["name_ja"] = name_ja
    if name_zh: result["name_zh"] = name_zh
    if coord: result["coord"] = coord
    if birth_year is not None: result["birth_year"] = birth_year
    if death_year is not None: result["death_year"] = death_year
    if start_year is not None: result["start_year"] = start_year
    if end_year is not None: result["end_year"] = end_year
    if point_in_time is not None: result["point_in_time"] = point_in_time
    if inception is not None: result["inception"] = inception
    if dissolved is not None: result["dissolved"] = dissolved
    if country_qid: result["country_qid"] = country_qid
    if location_qid: result["location_qid"] = location_qid
    if birth_place_qid: result["birth_place_qid"] = birth_place_qid
    if capital_qid: result["capital_qid"] = capital_qid
    if part_of_qid: result["part_of_qid"] = part_of_qid
    if occupation_qids: result["occupation_qids"] = occupation_qids
    if citizenship_qid: result["citizenship_qid"] = citizenship_qid
    if image: result["image"] = image

    return result


def run_parse(resume=False):
    """메인 파싱 루프"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 이어쓰기 모드: 기존 QID 수집
    existing_qids = set()
    if resume and os.path.exists(OUTPUT_PATH):
        print("[resume] 기존 파일에서 QID 수집 중...")
        with open(OUTPUT_PATH, "r") as f:
            for line in f:
                try:
                    e = json.loads(line.strip())
                    existing_qids.add(e.get("qid", ""))
                except:
                    pass
        print(f"[resume] 기존 {len(existing_qids):,}건 스킵 예정")
        mode = "a"
    else:
        mode = "w"

    total_scanned = 0
    total_korean = 0
    total_skipped = 0
    start_time = time.time()
    last_report = start_time

    with open(OUTPUT_PATH, mode, encoding="utf-8") as out_f:
        with gzip.open(DUMP_PATH, "rt", encoding="utf-8") as gz:
            for line in gz:
                # Wikidata dump: 첫줄 "[", 마지막줄 "]", 그 사이 JSON 객체+콤마
                line = line.strip()
                if line in ("[", "]", ""):
                    continue
                if line.endswith(","):
                    line = line[:-1]

                total_scanned += 1

                try:
                    entity = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # property(P로 시작)는 스킵
                eid = entity.get("id", "")
                if not eid.startswith("Q"):
                    continue

                # ★ 핵심 필터: 한국어 label 존재 여부
                labels = entity.get("labels", {})
                if "ko" not in labels:
                    continue

                # 이어쓰기: 이미 있으면 스킵
                if resume and eid in existing_qids:
                    total_skipped += 1
                    continue

                # 추출
                extracted = extract_entity(entity)
                out_f.write(json.dumps(extracted, ensure_ascii=False) + "\n")
                total_korean += 1

                # 10초마다 진행 보고
                now = time.time()
                if now - last_report >= 10:
                    elapsed = now - start_time
                    rate = total_scanned / elapsed if elapsed > 0 else 0
                    progress = {
                        "scanned": total_scanned,
                        "korean": total_korean,
                        "skipped": total_skipped,
                        "elapsed_sec": int(elapsed),
                        "rate_per_sec": int(rate),
                        "last_qid": eid,
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                    with open(PROGRESS_PATH, "w") as pf:
                        json.dump(progress, pf, indent=2)

                    if total_scanned % 1_000_000 == 0:
                        print(f"  [{total_scanned/1e6:.0f}M scanned] "
                              f"korean={total_korean:,} "
                              f"rate={rate:.0f}/s "
                              f"elapsed={elapsed/3600:.1f}h")

                    last_report = now

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"완료! scanned={total_scanned:,} korean={total_korean:,}")
    print(f"skipped={total_skipped:,} elapsed={elapsed/3600:.1f}h")
    print(f"출력: {OUTPUT_PATH}")

    # 최종 progress 기록
    with open(PROGRESS_PATH, "w") as pf:
        json.dump({
            "status": "done",
            "scanned": total_scanned,
            "korean": total_korean,
            "skipped": total_skipped,
            "elapsed_sec": int(elapsed),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }, pf, indent=2)


def show_stats():
    """결과 파일 통계"""
    if not os.path.exists(OUTPUT_PATH):
        print(f"파일 없음: {OUTPUT_PATH}")
        return

    total = 0
    has_coord = 0
    has_desc_ko = 0
    sl_dist = {"s0": 0, "s1_10": 0, "s11_30": 0, "s31_100": 0, "s100+": 0}
    p31_counter = {}

    with open(OUTPUT_PATH, "r") as f:
        for line in f:
            try:
                e = json.loads(line.strip())
            except:
                continue
            total += 1
            if e.get("coord"):
                has_coord += 1
            if e.get("desc_ko"):
                has_desc_ko += 1

            sl = e.get("sitelinks", 0)
            if sl == 0: sl_dist["s0"] += 1
            elif sl <= 10: sl_dist["s1_10"] += 1
            elif sl <= 30: sl_dist["s11_30"] += 1
            elif sl <= 100: sl_dist["s31_100"] += 1
            else: sl_dist["s100+"] += 1

            for p in e.get("p31", []):
                p31_counter[p] = p31_counter.get(p, 0) + 1

    print(f"총 엔티티: {total:,}")
    print(f"좌표 있음: {has_coord:,} ({has_coord/total*100:.1f}%)")
    print(f"한국어 설명: {has_desc_ko:,} ({has_desc_ko/total*100:.1f}%)")
    print(f"\nSitelinks 분포:")
    for k, v in sl_dist.items():
        print(f"  {k}: {v:,}")

    # P31 상위 30개
    print(f"\nP31 (instance of) 상위 30:")
    for qid, cnt in sorted(p31_counter.items(), key=lambda x: -x[1])[:30]:
        print(f"  {qid}: {cnt:,}")


if __name__ == "__main__":
    if "--stats" in sys.argv:
        show_stats()
    elif "--resume" in sys.argv:
        run_parse(resume=True)
    else:
        run_parse(resume=False)
