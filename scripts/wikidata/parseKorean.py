#!/usr/bin/env python3
"""
[cl] Wikidata dump → 한국어 label 있는 엔티티 전량 추출 (v2 — 고속화)

v2 개선점:
  1. 문자열 프리필터: '"ko"' 가 라인에 없으면 json.loads() 자체를 안 함 (99%+ 스킵)
  2. 라인카운트 resume: progress.json에 scanned 수 저장 → resume 시 빠르게 건너뜀
  3. orjson 지원: 설치되어 있으면 json 대신 사용 (5~10배 빠름)
  4. IO 버퍼 최적화: gzip 읽기 버퍼 확대

카테고리 분류 없이, 한국어 표제어(labels.ko)가 존재하는 엔티티를
**전부** 1-pass로 추출한다. 분류는 추출 후 별도 스크립트로.

예상 규모: ~74만건 (Wikidata 한국어 표제어 기준)
출력 형식: JSONL (한 줄 = 1 엔티티)

사용법:
  python3 parseKorean.py              # 전체 실행 (기존 결과 덮어씀)
  python3 parseKorean.py --resume     # 라인카운트 기반 이어쓰기
  python3 parseKorean.py --stats      # 결과 통계만

출력 (/mnt/data2/wikidata/output/):
  korean_all.jsonl      → 한국어 label 있는 전체 엔티티
  korean_progress.json  → 실시간 진행 상황 + resume 포인트
"""

import gzip
import json
import sys
import os
import time

# [cl] orjson이 있으면 사용 (pip install orjson — 5~10x 빠름)
try:
    import orjson
    json_loads = orjson.loads
    def json_dumps(obj):
        return orjson.dumps(obj, option=orjson.OPT_APPEND_NEWLINE).decode("utf-8")
    JSON_ENGINE = "orjson"
except ImportError:
    json_loads = json.loads
    def json_dumps(obj):
        return json.dumps(obj, ensure_ascii=False) + "\n"
    JSON_ENGINE = "json"

# ── 설정 ──────────────────────────────────────────────
DUMP_PATH = "/mnt/data2/wikidata/latest-all.json.gz"
OUTPUT_DIR = "/mnt/data2/wikidata/output"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "korean_all.jsonl")
PROGRESS_PATH = os.path.join(OUTPUT_DIR, "korean_progress.json")

# [cl] gzip 읽기 버퍼 (기본 8KB → 4MB로 확대)
GZ_BUFFER_SIZE = 4 * 1024 * 1024

# [cl] 프리필터 키워드 — Wikidata labels.ko 구조: "ko":{"language":"ko","value":"..."}
# 라인에 이 문자열이 없으면 한국어 label 자체가 없으므로 JSON 파싱 불필요
PREFILTER_KO = b'"ko"'

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


def load_resume_point():
    """[cl] progress.json에서 resume 포인트 (스캔한 줄 수) 로드"""
    if not os.path.exists(PROGRESS_PATH):
        return 0
    try:
        with open(PROGRESS_PATH, "r") as f:
            prog = json.load(f)
        return prog.get("scanned", 0)
    except (json.JSONDecodeError, KeyError):
        return 0


def run_parse(resume=False):
    """메인 파싱 루프 (v2 — 고속화)"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"[cl] JSON 엔진: {JSON_ENGINE}")

    # ── resume: 라인카운트 기반 빠른 건너뛰기 ──
    skip_lines = 0
    if resume:
        skip_lines = load_resume_point()
        if skip_lines > 0:
            print(f"[resume] {skip_lines:,}줄 건너뛰기 예정 (이전 진행분)")
            mode = "a"
        else:
            print("[resume] 이전 진행 기록 없음 → 처음부터 시작")
            mode = "w"
    else:
        mode = "w"

    total_scanned = 0
    total_korean = 0
    total_prefilter_skip = 0
    start_time = time.time()
    last_report = start_time

    # [cl] 바이너리 모드로 읽어서 프리필터 성능 극대화
    # 바이너리에서 문자열 검색 → 매칭된 것만 디코딩+파싱
    with open(OUTPUT_PATH, mode, encoding="utf-8") as out_f:
        with gzip.open(DUMP_PATH, "rb") as gz:
            line_no = 0

            for raw_line in gz:
                line_no += 1

                # ── resume 건너뛰기 (바이너리 상태에서 빠르게) ──
                if line_no <= skip_lines:
                    # 100M줄마다 진행 표시
                    if line_no % 100_000_000 == 0:
                        elapsed = time.time() - start_time
                        print(f"  [skip] {line_no/1e6:.0f}M줄 건너뜀 "
                              f"({elapsed:.0f}초)")
                    continue

                # [cl] 배열 구분자 스킵 (바이너리)
                stripped = raw_line.strip()
                if stripped in (b"[", b"]", b""):
                    continue

                total_scanned += 1

                # ★★★ 핵심 개선 1: 프리필터 ★★★
                # 바이너리 상태에서 "ko" 존재 여부만 체크
                # 한국어 label이 없는 99%+ 엔티티는 여기서 탈락 → json.loads 안 함
                if PREFILTER_KO not in raw_line:
                    total_prefilter_skip += 1
                    continue

                # ── 프리필터 통과 → 디코딩 + JSON 파싱 ──
                try:
                    line = stripped.decode("utf-8")
                except UnicodeDecodeError:
                    continue

                if line.endswith(","):
                    line = line[:-1]

                try:
                    entity = json_loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue

                # property(P로 시작)는 스킵
                eid = entity.get("id", "")
                if not eid.startswith("Q"):
                    continue

                # 한국어 label 재확인 (프리필터는 false positive 가능)
                labels = entity.get("labels", {})
                if "ko" not in labels:
                    continue

                # 추출
                extracted = extract_entity(entity)
                out_f.write(json_dumps(extracted))
                total_korean += 1

                # 10초마다 진행 보고
                now = time.time()
                if now - last_report >= 10:
                    elapsed = now - start_time
                    rate = total_scanned / elapsed if elapsed > 0 else 0
                    pct_skipped = (total_prefilter_skip / total_scanned * 100
                                   if total_scanned > 0 else 0)

                    progress = {
                        "scanned": total_scanned + skip_lines,
                        "scanned_this_run": total_scanned,
                        "korean": total_korean,
                        "prefilter_skip_pct": round(pct_skipped, 1),
                        "elapsed_sec": int(elapsed),
                        "rate_per_sec": int(rate),
                        "last_qid": eid,
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "json_engine": JSON_ENGINE,
                    }
                    with open(PROGRESS_PATH, "w") as pf:
                        json.dump(progress, pf, indent=2)

                    if total_scanned % 1_000_000 < 10_000:
                        print(f"  [{(total_scanned + skip_lines)/1e6:.0f}M scanned] "
                              f"korean={total_korean:,} "
                              f"prefilter={pct_skipped:.1f}% "
                              f"rate={rate:.0f}/s "
                              f"elapsed={elapsed/3600:.1f}h")

                    last_report = now

    elapsed = time.time() - start_time
    grand_total = total_scanned + skip_lines
    pct = (total_prefilter_skip / total_scanned * 100
           if total_scanned > 0 else 0)
    print(f"\n{'='*60}")
    print(f"완료! total_lines={grand_total:,} this_run={total_scanned:,}")
    print(f"korean={total_korean:,} prefilter_skip={pct:.1f}%")
    print(f"elapsed={elapsed/3600:.1f}h json_engine={JSON_ENGINE}")
    print(f"출력: {OUTPUT_PATH}")

    # 최종 progress 기록 (resume 포인트로 사용됨)
    with open(PROGRESS_PATH, "w") as pf:
        json.dump({
            "status": "done",
            "scanned": grand_total,
            "korean": total_korean,
            "prefilter_skip_pct": round(pct, 1),
            "elapsed_sec": int(elapsed),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "json_engine": JSON_ENGINE,
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
                e = json_loads(line.strip())
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
