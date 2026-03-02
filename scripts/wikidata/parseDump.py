#!/usr/bin/env python3
"""
Wikidata JSON dump → TimeGlobe 전체 데이터 추출 스크립트 (cl/mk)

1-pass gz 스트리밍으로 person, event, place, historical entity,
artwork(문화/예술), invention(발명/기술) 전부 추출.
기존 WDQS API 5건씩 긁던 것을 dump 한방으로 대체.

사용법:
  python3 parseDump.py                # 전체 실행 (pass1 + pass2)
  python3 parseDump.py --resolve-only # SQLite maps 있을 때 pass2만
  python3 parseDump.py --stats-only   # 결과 파일 통계만

[mk v2] SQLite coord/label maps + 재시작 스킵 지원:
  - coord_map/label_map: 인메모리 dict 대신 SQLite (WAL, batch 50K)
  - 기존 .jsonl 파일의 QID는 스킵 (오버라이트 없이 이어쓰기)
  - 프로세스 재시작 시 이전 진행분 보존

출력 (모두 /mnt/data2/wikidata/output/):
  persons_raw.jsonl        → pass1: person 원본
  events_raw.jsonl         → pass1: event 원본 (전쟁/혁명/재해/탐험/발견)
  places_raw.jsonl         → pass1: place 원본 (도시/건물/유적)
  hist_entities_raw.jsonl  → pass1: 역사 국가/왕조/제국 원본
  artworks_raw.jsonl       → pass1: 문화/예술 작품 원본 [NEW]
  inventions_raw.jsonl     → pass1: 발명/기술 원본 [NEW]
  maps.db                  → SQLite: coords + labels 맵 (coord_map.json/label_map.json 대체)
  persons_final.json       → pass2 완료
  events_final.json        → pass2 완료
  places_final.json        → pass2 완료
  hist_entities_final.json → pass2 완료
  artworks_final.json      → pass2 완료 [NEW]
  inventions_final.json    → pass2 완료 [NEW]
  progress.json            → 실시간 진행 상황
"""

import gzip
import json
import sys
import os
import time
import sqlite3

# ── 설정 ──────────────────────────────────────────────
DUMP_PATH = "/mnt/data2/wikidata/latest-all.json.gz"
OUTPUT_DIR = "/mnt/data2/wikidata/output"

# SQLite DB (coord/label 맵 저장, 인메모리 dict 대체) [mk v2]
DB_PATH = os.path.join(OUTPUT_DIR, "maps.db")
BATCH_SIZE = 50000  # SQLite INSERT 배치 크기

# 출력 파일 경로 (레거시 JSON 맵은 더 이상 사용 안 함)
COORD_MAP_PATH = os.path.join(OUTPUT_DIR, "coord_map.json")
LABEL_MAP_PATH = os.path.join(OUTPUT_DIR, "label_map.json")
PROGRESS_PATH = os.path.join(OUTPUT_DIR, "progress.json")

RAW_PATHS = {
    "person":   os.path.join(OUTPUT_DIR, "persons_raw.jsonl"),
    "event":    os.path.join(OUTPUT_DIR, "events_raw.jsonl"),
    "place":    os.path.join(OUTPUT_DIR, "places_raw.jsonl"),
    "hist":     os.path.join(OUTPUT_DIR, "hist_entities_raw.jsonl"),
    "artwork":  os.path.join(OUTPUT_DIR, "artworks_raw.jsonl"),    # [mk]
    "invention":os.path.join(OUTPUT_DIR, "inventions_raw.jsonl"),  # [mk]
}
FINAL_PATHS = {
    "person":   os.path.join(OUTPUT_DIR, "persons_final.json"),
    "event":    os.path.join(OUTPUT_DIR, "events_final.json"),
    "place":    os.path.join(OUTPUT_DIR, "places_final.json"),
    "hist":     os.path.join(OUTPUT_DIR, "hist_entities_final.json"),
    "artwork":  os.path.join(OUTPUT_DIR, "artworks_final.json"),   # [mk]
    "invention":os.path.join(OUTPUT_DIR, "inventions_final.json"), # [mk]
}

# ── Wikidata Property IDs ─────────────────────────────
P_INSTANCE_OF = "P31"
P_SUBCLASS_OF = "P279"
P_COORD = "P625"
P_COUNTRY = "P17"          # 소속 국가
P_BIRTH_DATE = "P569"
P_DEATH_DATE = "P570"
P_BIRTH_PLACE = "P19"
P_DEATH_PLACE = "P20"
P_CITIZENSHIP = "P27"
P_OCCUPATION = "P106"
P_FLORUIT_START = "P2031"
P_FLORUIT_END = "P2032"
P_START_TIME = "P580"       # 시작 시점
P_END_TIME = "P582"         # 종료 시점
P_POINT_IN_TIME = "P585"    # 시점 (이벤트용)
P_INCEPTION = "P571"        # 설립일
P_DISSOLVED = "P576"        # 해체일
P_LOCATION = "P276"         # 위치 (이벤트)
P_CAPITAL = "P36"           # 수도
P_CONFLICT = "P607"         # 관련 분쟁
P_PART_OF = "P361"          # ~의 일부
P_CREATOR = "P170"          # creator (제작자/예술가)
P_AUTHOR = "P50"            # author (저자)
P_COMPOSER = "P86"          # composer (작곡가)
P_DIRECTOR = "P57"          # director (감독)
P_GENRE = "P136"            # genre (장르)
P_MOVEMENT = "P135"         # movement (예술 운동/사조)
P_MATERIAL = "P186"         # material used (재료)
P_INVENTOR = "P61"          # discoverer or inventor (발명가)

# ── 엔티티 분류용 Q-ID 집합 ──────────────────────────

# Person
Q_HUMAN = "Q5"

# Event 계열
Q_EVENTS = {
    "Q178561",    # battle (전투)
    "Q645883",    # military operation (군사 작전)
    "Q198",       # war (전쟁)
    "Q831663",    # military campaign (군사 원정)
    "Q3839081",   # natural disaster (자연재해)
    "Q8065",      # natural disaster (자연재해, 대체)
    "Q7278",      # political revolution (정치 혁명)
    "Q12876",     # treaty (조약)
    "Q93288",     # civil war (내전)
    "Q1261499",   # naval battle (해전)
    "Q2001676",   # siege (포위전)
    "Q124757",    # riot (폭동/봉기)
    "Q1656682",   # historical event (역사적 사건)
    "Q3024240",   # historical event (역사적 사건, 대체)
    "Q1071027",   # genocide (집단학살)
    "Q7864918",   # terrorist attack (테러 공격)
    "Q192909",    # expedition (탐험)
    "Q625994",    # peace treaty (강화조약)
    "Q209715",    # coup d'état (쿠데타)
    "Q8161",      # famine (기근)
    "Q3199915",   # pandemic (팬데믹)
    "Q7892",      # epidemic (전염병)
    "Q2223653",   # massacre (대학살)
    "Q107390",    # discovery (발견)
    "Q11023",     # engineering (공학) — 대규모 건축물/프로젝트
    "Q12136",     # disease (질병, 역사적 전염병)
    "Q476300",    # armistice (정전)
    "Q47566",     # slave rebellion (노예 반란)
    "Q1318976",   # space mission (우주 임무)
    # [cl] 누락 보완 — 주요 혁명/반란/전쟁이 빠져있었음 (2026-03-03)
    "Q10931",     # revolution (혁명) — 러시아혁명, 프랑스혁명, 산업혁명 등
    "Q124734",    # rebellion (반란) — 안사의 난, 동학농민혁명 등
    "Q900406",    # reform (개혁) — 메이지 유신 등
    "Q11514315",  # historical period (역사적 시대) — 산업혁명, 르네상스 등
    "Q103495",    # world war (세계 대전) — WW1, WW2
    "Q13427116",  # peasant revolt (농민 봉기) — 동학농민혁명 등
}

# Place 계열
Q_PLACES = {
    "Q515",       # city (도시)
    "Q1549591",   # big city (대도시)
    "Q486972",    # human settlement (인간 거주지)
    "Q3957",      # town (마을)
    "Q532",       # village (촌락)
    "Q8502",      # mountain (산)
    "Q23442",     # island (섬)
    "Q4022",      # river (강)
    "Q23397",     # lake (호수)
    "Q35509",     # cave (동굴)
    "Q46831",     # mountain pass (고개)
    "Q34763",     # peninsula (반도)
    "Q39816",     # valley (계곡)
    "Q355304",    # watercourse (수로)
    "Q12280",     # bridge (다리)
    "Q174782",    # square (광장)
    "Q83405",     # factory (공장)
    "Q57821",     # fortification (요새)
    "Q16970",     # church (교회)
    "Q34627",     # mosque (모스크)
    "Q44613",     # monastery (수도원)
    "Q570116",    # tourist attraction (관광지)
    "Q33506",     # museum (박물관)
    "Q3947",      # house (주택) — 역사적 건물
    "Q811979",    # architectural structure (건축구조물)
    "Q41176",     # building (건물)
    "Q839954",    # archaeological site (고고학 유적)
    "Q9842",      # UNESCO World Heritage Site
}

# Artwork 계열 (문화/예술 작품) [mk 추가]
Q_ARTWORKS = {
    "Q838948",    # work of art (예술 작품) — 핵심
    "Q3305213",   # painting (회화/그림)
    "Q860861",    # sculpture (조각)
    "Q4502142",   # visual artwork (시각 예술 작품)
    "Q47461344",  # written work (문서 작품)
    "Q7725634",   # literary work (문학 작품)
    "Q207628",    # musical work/composition (음악 작품)
    "Q11424",     # film (영화)
    "Q8274",      # manuscript (필사본/고문서)
    "Q6882426",   # opera (오페라)
    "Q179700",    # statue (동상)
    "Q17537576",  # creative work (창작물)
    "Q134307",    # symphony (교향곡)
    "Q105543609", # musical work (음악 창작물, 대체)
}

# Invention 계열 (발명/기술) [mk 추가]
Q_INVENTIONS = {
    "Q20937557",  # invention (발명) — 핵심
    "Q11019",     # machine (기계)
    "Q39546",     # tool (도구)
    "Q327333",    # technology (기술적 창작물)
}

# Historical entity (국가/왕조/제국) 계열
Q_HIST_ENTITIES = {
    "Q6256",      # country (국가)
    "Q3624078",   # sovereign state (주권국가)
    "Q7275",      # state (국가)
    "Q417175",    # historical country (역사적 국가)
    "Q3024240",   # historical country (대체)
    "Q164142",    # dynasty (왕조)
    "Q35657",     # state (나라, 구분)
    "Q1520223",   # ancient civilization (고대 문명)
    "Q839954",    # archaeological culture (고고학 문화)
    "Q28171280",  # ancient state (고대 국가)
    "Q1250464",   # empire (제국)
    "Q484652",    # international organization (국제기구)
    "Q1496967",   # territorial entity (영토 실체)
    "Q171558",    # caliphate (칼리프국)
    "Q133311",    # tribe (부족)
    "Q748149",    # confederation of tribes (부족 연맹)
    "Q1307214",   # city-state (도시국가)
    "Q185441",    # principality (공국)
    "Q208164",    # kingdom (왕국)
    "Q5765685",   # khanate (칸국)
    "Q183366",    # grand duchy (대공국)
    "Q107390",    # colony (식민지)
    "Q170156",    # confederation (연맹)
    "Q30062429",  # federal state (연방 주)
}


# ── SQLite 유틸리티 [mk v2] ────────────────────────────

def init_db():
    """SQLite DB 초기화 (coord/label 맵 저장용)"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS coords (
            qid TEXT PRIMARY KEY,
            lat REAL NOT NULL,
            lon REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS labels (
            qid TEXT PRIMARY KEY,
            ko TEXT,
            en TEXT
        )
    """)
    conn.commit()
    return conn


def load_existing_qids():
    """기존 .jsonl 파일에서 QID 집합 로딩 (재시작 스킵용)"""
    existing = {}
    for key, path in RAW_PATHS.items():
        qids = set()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                        qid = rec.get("qid")
                        if qid:
                            qids.add(qid)
                    except json.JSONDecodeError:
                        pass
        existing[key] = qids
        print(f"  [{key}] 기존 QID: {len(qids):,}")
    return existing


def load_maps_for_pass2():
    """
    pass2용 coord/label 맵 로딩 [mk v2]
    - 출력 .jsonl 파일에서 참조된 QID만 선별해서 SQLite에서 가져옴
    - 전체 7천만+ 라벨 대신 필요한 것만 로드 → 메모리 절약
    """
    print("[pass2 prep] 참조된 QID 수집 중...")

    # 타입별로 참조 QID 필드 정의
    qid_fields = {
        "person":    ["birth_place_qid", "death_place_qid", "citizenship_qid", "occupation_qid"],
        "event":     ["location_qid", "country_qid", "conflict_qid", "part_of_qid"],
        "place":     ["country_qid"],
        "hist":      ["capital_qid", "country_qid"],
        "artwork":   ["creator_qid", "location_qid", "country_qid", "genre_qid", "movement_qid"],
        "invention": ["inventor_qid", "location_qid", "country_qid"],
    }

    needed_qids = set()
    for type_key, fields in qid_fields.items():
        path = RAW_PATHS[type_key]
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    for field in fields:
                        qid = rec.get(field)
                        if qid:
                            needed_qids.add(qid)
                except json.JSONDecodeError:
                    pass

    print(f"  참조 QID 수: {len(needed_qids):,}")

    if not os.path.exists(DB_PATH):
        print(f"  [WARN] {DB_PATH} 없음 — 빈 맵으로 진행")
        return {}, {}

    print("[pass2 prep] SQLite에서 coord/label 로딩...")
    conn = sqlite3.connect(DB_PATH)

    coord_map = {}
    label_map = {}

    # 청크 단위로 SELECT (SQLite parameter limit 대비)
    CHUNK = 9000
    needed_list = list(needed_qids)
    for i in range(0, len(needed_list), CHUNK):
        chunk = needed_list[i:i + CHUNK]
        placeholders = ",".join("?" * len(chunk))

        for row in conn.execute(
            f"SELECT qid, lat, lon FROM coords WHERE qid IN ({placeholders})", chunk
        ):
            coord_map[row[0]] = (row[1], row[2])

        for row in conn.execute(
            f"SELECT qid, ko, en FROM labels WHERE qid IN ({placeholders})", chunk
        ):
            label_map[row[0]] = {"ko": row[1], "en": row[2]}

    conn.close()
    print(f"  로딩된 coords: {len(coord_map):,}")
    print(f"  로딩된 labels: {len(label_map):,}")
    return coord_map, label_map


# ── 유틸리티 함수들 ───────────────────────────────────

def get_claim_values(claims, prop):
    """클레임에서 특정 프로퍼티의 값 목록 추출"""
    if prop not in claims:
        return []
    values = []
    for statement in claims[prop]:
        ms = statement.get("mainsnak", {})
        if ms.get("snaktype") != "value":
            continue
        dv = ms.get("datavalue", {})
        values.append(dv)
    return values


def get_entity_id(datavalue):
    """datavalue에서 엔티티 QID 추출"""
    if datavalue.get("type") == "wikibase-entityid":
        return datavalue.get("value", {}).get("id")
    return None


def get_coord(datavalue):
    """datavalue에서 좌표(lat, lon) 추출"""
    if datavalue.get("type") == "globecoordinate":
        v = datavalue.get("value", {})
        return (v.get("latitude"), v.get("longitude"))
    return None


def get_time_year(datavalue):
    """datavalue에서 연도 추출 (+1809-02-12T00:00:00Z → 1809)"""
    if datavalue.get("type") != "time":
        return None
    time_str = datavalue.get("value", {}).get("time", "")
    try:
        if time_str.startswith("+"):
            return int(time_str[1:].split("-")[0])
        elif time_str.startswith("-"):
            return -int(time_str[1:].split("-")[0])
    except (ValueError, IndexError):
        pass
    return None


def first_year(claims, prop):
    """클레임에서 첫 번째 연도 추출"""
    for dv in get_claim_values(claims, prop):
        y = get_time_year(dv)
        if y is not None:
            return y
    return None


def first_coord(claims):
    """P625에서 첫 번째 좌표 추출"""
    for dv in get_claim_values(claims, P_COORD):
        c = get_coord(dv)
        if c and c[0] is not None:
            return c
    return None


def first_entity_id(claims, prop):
    """클레임에서 첫 번째 엔티티 QID 추출"""
    for dv in get_claim_values(claims, prop):
        eid = get_entity_id(dv)
        if eid:
            return eid
    return None


def get_label(entity, lang):
    """엔티티에서 특정 언어 라벨"""
    return entity.get("labels", {}).get(lang, {}).get("value")


def get_description(entity, lang):
    """엔티티에서 특정 언어 설명"""
    return entity.get("descriptions", {}).get(lang, {}).get("value")


def get_sitelink(entity, site):
    """엔티티에서 특정 사이트 링크 제목"""
    return entity.get("sitelinks", {}).get(site, {}).get("title")


def count_sitelinks(entity):
    return len(entity.get("sitelinks", {}))


def get_p31_ids(claims):
    """P31 (instance of) 의 모든 QID 집합"""
    ids = set()
    for dv in get_claim_values(claims, P_INSTANCE_OF):
        eid = get_entity_id(dv)
        if eid:
            ids.add(eid)
    return ids


def common_fields(entity):
    """모든 타입 공통 필드"""
    return {
        "qid": entity.get("id", ""),
        "name_ko": get_label(entity, "ko"),
        "name_en": get_label(entity, "en"),
        "name_ja": get_label(entity, "ja"),
        "name_zh": get_label(entity, "zh"),
        "desc_ko": get_description(entity, "ko"),
        "desc_en": get_description(entity, "en"),
        "ko_wiki": get_sitelink(entity, "kowiki"),
        "en_wiki": get_sitelink(entity, "enwiki"),
        "sitelinks": count_sitelinks(entity),
    }


# ── 타입별 추출 함수 ─────────────────────────────────

def extract_person(entity, claims):
    """person 엔티티 추출"""
    birth_year = first_year(claims, P_BIRTH_DATE)
    death_year = first_year(claims, P_DEATH_DATE)
    floruit_start = first_year(claims, P_FLORUIT_START)
    floruit_end = first_year(claims, P_FLORUIT_END)
    anchor_year = birth_year or death_year or floruit_start or floruit_end

    return {
        **common_fields(entity),
        "type": "person",
        "birth_year": birth_year,
        "death_year": death_year,
        "floruit_start": floruit_start,
        "floruit_end": floruit_end,
        "anchor_year": anchor_year,
        "direct_coord": first_coord(claims),
        "birth_place_qid": first_entity_id(claims, P_BIRTH_PLACE),
        "death_place_qid": first_entity_id(claims, P_DEATH_PLACE),
        "citizenship_qid": first_entity_id(claims, P_CITIZENSHIP),
        "occupation_qid": first_entity_id(claims, P_OCCUPATION),
    }


def extract_event(entity, claims, p31_ids):
    """event 엔티티 추출"""
    # 이벤트 시점: P585(시점) > P580(시작) > P571(설립)
    point_in_time = first_year(claims, P_POINT_IN_TIME)
    start_time = first_year(claims, P_START_TIME)
    end_time = first_year(claims, P_END_TIME)
    inception = first_year(claims, P_INCEPTION)

    anchor_year = point_in_time or start_time or inception

    # 이벤트 서브타입 판별
    event_kind = "event"
    kind_map = {
        "Q178561": "battle", "Q1261499": "battle", "Q2001676": "siege",
        "Q198": "war", "Q93288": "war", "Q831663": "war",
        "Q645883": "military_operation",
        "Q12876": "treaty", "Q625994": "treaty", "Q476300": "treaty",
        "Q3839081": "disaster", "Q8065": "disaster", "Q8161": "disaster",
        "Q7278": "revolution", "Q124757": "revolution", "Q209715": "revolution",
        "Q1071027": "genocide", "Q2223653": "genocide",
        "Q192909": "expedition",
        "Q3199915": "pandemic", "Q7892": "pandemic", "Q12136": "pandemic",
        "Q1318976": "space_mission",
        "Q7864918": "terrorist_attack",
        "Q107390": "discovery",
        # [cl] 누락 보완 (2026-03-03)
        "Q10931": "revolution",          # revolution (혁명)
        "Q124734": "rebellion",          # rebellion (반란)
        "Q13427116": "rebellion",        # peasant revolt (농민 봉기)
        "Q47566": "rebellion",           # slave rebellion (기존 Q_EVENTS에 있었으나 kind_map 누락)
        "Q900406": "reform",             # reform (개혁)
        "Q11514315": "historical_period", # historical period (역사적 시대)
        "Q103495": "war",                # world war (세계 대전)
    }
    for qid in p31_ids:
        if qid in kind_map:
            event_kind = kind_map[qid]
            break

    return {
        **common_fields(entity),
        "type": "event",
        "event_kind": event_kind,
        "point_in_time": point_in_time,
        "start_year": start_time or inception,
        "end_year": end_time,
        "anchor_year": anchor_year,
        "direct_coord": first_coord(claims),
        "location_qid": first_entity_id(claims, P_LOCATION),
        "country_qid": first_entity_id(claims, P_COUNTRY),
        "conflict_qid": first_entity_id(claims, P_CONFLICT),
        "part_of_qid": first_entity_id(claims, P_PART_OF),
    }


def extract_place(entity, claims):
    """place 엔티티 추출"""
    return {
        **common_fields(entity),
        "type": "place",
        "direct_coord": first_coord(claims),
        "country_qid": first_entity_id(claims, P_COUNTRY),
        "inception": first_year(claims, P_INCEPTION),
    }


def extract_artwork(entity, claims, p31_ids):
    """artwork(문화/예술 작품) 엔티티 추출 [mk]"""
    inception = first_year(claims, P_INCEPTION)

    # 서브타입
    artwork_kind = "artwork"
    kind_map = {
        "Q3305213": "painting",
        "Q860861": "sculpture",
        "Q179700": "sculpture",
        "Q47461344": "written_work",
        "Q7725634": "literary_work",
        "Q207628": "musical_work",
        "Q134307": "musical_work",
        "Q105543609": "musical_work",
        "Q6882426": "opera",
        "Q11424": "film",
        "Q8274": "manuscript",
    }
    for qid in p31_ids:
        if qid in kind_map:
            artwork_kind = kind_map[qid]
            break

    # 창작자: P170(creator) > P50(author) > P86(composer) > P57(director)
    creator_qid = None
    for p in [P_CREATOR, P_AUTHOR, P_COMPOSER, P_DIRECTOR]:
        creator_qid = first_entity_id(claims, p)
        if creator_qid:
            break

    return {
        **common_fields(entity),
        "type": "artwork",
        "artwork_kind": artwork_kind,
        "inception": inception,
        "anchor_year": inception,
        "direct_coord": first_coord(claims),
        "creator_qid": creator_qid,
        "location_qid": first_entity_id(claims, P_LOCATION),
        "country_qid": first_entity_id(claims, P_COUNTRY),
        "genre_qid": first_entity_id(claims, P_GENRE),
        "movement_qid": first_entity_id(claims, P_MOVEMENT),
    }


def extract_invention(entity, claims, p31_ids):
    """invention(발명/기술) 엔티티 추출 [mk]"""
    inception = first_year(claims, P_INCEPTION)
    start_time = first_year(claims, P_START_TIME)
    point_in_time = first_year(claims, P_POINT_IN_TIME)
    anchor_year = inception or point_in_time or start_time

    return {
        **common_fields(entity),
        "type": "invention",
        "inception": inception,
        "anchor_year": anchor_year,
        "direct_coord": first_coord(claims),
        "inventor_qid": first_entity_id(claims, P_INVENTOR),
        "country_qid": first_entity_id(claims, P_COUNTRY),
        "location_qid": first_entity_id(claims, P_LOCATION),
    }


def extract_hist_entity(entity, claims, p31_ids):
    """historical entity (국가/왕조/제국) 추출"""
    inception = first_year(claims, P_INCEPTION)
    dissolved = first_year(claims, P_DISSOLVED)
    start_time = first_year(claims, P_START_TIME)
    end_time = first_year(claims, P_END_TIME)

    start_year = inception or start_time
    end_year = dissolved or end_time

    # 서브타입
    entity_kind = "state"
    kind_map = {
        "Q1250464": "empire", "Q164142": "dynasty",
        "Q171558": "caliphate", "Q1307214": "city_state",
        "Q185441": "principality", "Q208164": "kingdom",
        "Q5765685": "khanate", "Q183366": "grand_duchy",
        "Q1520223": "civilization", "Q133311": "tribe",
        "Q748149": "tribal_confederation",
        "Q170156": "confederation", "Q484652": "intl_org",
    }
    for qid in p31_ids:
        if qid in kind_map:
            entity_kind = kind_map[qid]
            break

    return {
        **common_fields(entity),
        "type": "hist_entity",
        "entity_kind": entity_kind,
        "start_year": start_year,
        "end_year": end_year,
        "direct_coord": first_coord(claims),
        "capital_qid": first_entity_id(claims, P_CAPITAL),
        "country_qid": first_entity_id(claims, P_COUNTRY),
    }


# ── pass1: 스트리밍 추출 ─────────────────────────────
# [mk v2] SQLite + 재시작 스킵 지원

def pass1_stream(dump_path):
    """1-pass gz 스트리밍으로 모든 타입 동시 추출 (SQLite 맵 + 스킵 지원)"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 기존 QID 로딩 (재시작 스킵용)
    print(f"[pass1] 기존 QID 로딩...")
    existing_qids = load_existing_qids()
    total_existing = sum(len(v) for v in existing_qids.values())
    print(f"  기존 레코드 합계: {total_existing:,}")

    # SQLite 초기화
    print(f"[pass1] SQLite DB 초기화: {DB_PATH}")
    conn = init_db()
    coord_count_before = conn.execute("SELECT COUNT(*) FROM coords").fetchone()[0]
    label_count_before = conn.execute("SELECT COUNT(*) FROM labels").fetchone()[0]
    print(f"  SQLite 기존 - coords: {coord_count_before:,}, labels: {label_count_before:,}")

    counts = {"person": 0, "event": 0, "place": 0, "hist": 0, "artwork": 0, "invention": 0}
    entity_count = 0
    skipped_count = 0
    start_time = time.time()
    last_report = start_time

    # SQLite 배치 버퍼
    coord_batch = []   # [(qid, lat, lon), ...]
    label_batch = []   # [(qid, ko, en), ...]

    print(f"[pass1] 스트리밍 시작 (APPEND 모드): {dump_path}")

    # 출력 파일: APPEND 모드로 열기 (기존 데이터 보존) [mk v2]
    out_files = {k: open(v, "a", encoding="utf-8") for k, v in RAW_PATHS.items()}

    try:
        with gzip.open(dump_path, "rt", encoding="utf-8") as gz:
            for line in gz:
                line = line.strip().rstrip(",")
                if line in ("[", "]", ""):
                    continue

                try:
                    entity = json.loads(line)
                except json.JSONDecodeError:
                    continue

                entity_count += 1
                qid = entity.get("id", "")
                claims = entity.get("claims", {})

                # ── 모든 엔티티: 좌표 수집 → SQLite batch ──
                coord = first_coord(claims)
                if coord and coord[0] is not None:
                    coord_batch.append((qid, coord[0], coord[1]))

                # ── 모든 엔티티: 라벨 수집 → SQLite batch ──
                ko = get_label(entity, "ko")
                en = get_label(entity, "en")
                if ko or en:
                    label_batch.append((qid, ko, en))

                # SQLite 배치 flush (50K마다)
                if len(coord_batch) >= BATCH_SIZE:
                    conn.executemany(
                        "INSERT OR IGNORE INTO coords VALUES (?,?,?)", coord_batch
                    )
                    conn.commit()
                    coord_batch = []

                if len(label_batch) >= BATCH_SIZE:
                    conn.executemany(
                        "INSERT OR IGNORE INTO labels VALUES (?,?,?)", label_batch
                    )
                    conn.commit()
                    label_batch = []

                # ── 진행 리포트 (30초마다, 전체 엔티티 기준) ── [mk v2 fix]
                now = time.time()
                if now - last_report >= 30:
                    elapsed = now - start_time
                    speed = entity_count / elapsed
                    print(
                        f"[pass1] {entity_count:,} ent | skip:{skipped_count:,} | "
                        f"new: P:{counts['person']:,} E:{counts['event']:,} "
                        f"Pl:{counts['place']:,} H:{counts['hist']:,} "
                        f"Art:{counts['artwork']:,} Inv:{counts['invention']:,} | "
                        f"cb:{len(coord_batch):,} lb:{len(label_batch):,} | "
                        f"{speed:.0f}/s | {elapsed/60:.1f}m",
                        flush=True
                    )
                    last_report = now

                    with open(PROGRESS_PATH, "w") as pf:
                        json.dump({
                            "phase": "pass1",
                            "entities_processed": entity_count,
                            "skipped_existing": skipped_count,
                            "new_counts": counts,
                            "elapsed_min": round(elapsed / 60, 1),
                            "speed_per_sec": round(speed),
                        }, pf)

                # ── P31 분류 ──
                p31_ids = get_p31_ids(claims)

                # 타입 판별
                if Q_HUMAN in p31_ids:
                    type_key = "person"
                elif p31_ids & Q_EVENTS:
                    type_key = "event"
                elif p31_ids & Q_HIST_ENTITIES:
                    type_key = "hist"
                elif p31_ids & Q_ARTWORKS:
                    type_key = "artwork"
                elif p31_ids & Q_INVENTIONS:
                    type_key = "invention"
                elif p31_ids & Q_PLACES:
                    type_key = "place"
                else:
                    continue  # 해당 없는 타입

                # ── 기존 QID면 스킵 (이미 출력 파일에 있음) ── [mk v2]
                if qid in existing_qids[type_key]:
                    skipped_count += 1
                    continue

                # 추출 및 저장
                if type_key == "person":
                    rec = extract_person(entity, claims)
                elif type_key == "event":
                    rec = extract_event(entity, claims, p31_ids)
                elif type_key == "hist":
                    rec = extract_hist_entity(entity, claims, p31_ids)
                elif type_key == "artwork":
                    rec = extract_artwork(entity, claims, p31_ids)
                elif type_key == "invention":
                    rec = extract_invention(entity, claims, p31_ids)
                else:  # place
                    rec = extract_place(entity, claims)

                out_files[type_key].write(json.dumps(rec, ensure_ascii=False) + "\n")
                counts[type_key] += 1

    finally:
        # 남은 배치 flush
        if coord_batch:
            conn.executemany(
                "INSERT OR IGNORE INTO coords VALUES (?,?,?)", coord_batch
            )
        if label_batch:
            conn.executemany(
                "INSERT OR IGNORE INTO labels VALUES (?,?,?)", label_batch
            )
        conn.commit()
        conn.close()
        for f in out_files.values():
            f.close()

    elapsed = time.time() - start_time
    print(f"\n[pass1 완료] {elapsed/60:.1f}분")
    print(f"  총 엔티티 스캔: {entity_count:,}")
    print(f"  스킵 (기존): {skipped_count:,}")
    for k, v in counts.items():
        print(f"  {k} 신규 추가: {v:,}")

    # 최종 SQLite 크기 확인
    conn2 = sqlite3.connect(DB_PATH)
    coord_total = conn2.execute("SELECT COUNT(*) FROM coords").fetchone()[0]
    label_total = conn2.execute("SELECT COUNT(*) FROM labels").fetchone()[0]
    conn2.close()
    print(f"  SQLite coords: {coord_total:,}")
    print(f"  SQLite labels: {label_total:,}")

    return counts


# ── pass2: 좌표 resolve + 최종 정리 ──────────────────

def resolve_coord(rec, coord_map, fallback_keys):
    """레코드에 좌표를 resolve해서 lat/lon/coord_source 추가"""
    lat, lon, source = None, None, None

    if rec.get("direct_coord"):
        lat, lon = rec["direct_coord"]
        source = "direct"
    else:
        for key in fallback_keys:
            qid = rec.get(key)
            if qid and qid in coord_map:
                lat, lon = coord_map[qid]
                source = key.replace("_qid", "")
                break

    rec["lat"] = round(lat, 4) if lat is not None else None
    rec["lon"] = round(lon, 4) if lon is not None else None
    rec["coord_source"] = source
    rec.pop("direct_coord", None)
    return rec


def resolve_label(rec, label_map, qid_key, out_key):
    """QID를 사람이 읽을 수 있는 라벨로 변환"""
    qid = rec.get(qid_key)
    if qid and qid in label_map:
        labels = label_map[qid]
        rec[out_key] = labels.get("ko") or labels.get("en")
    else:
        rec[out_key] = None
    return rec


def pass2_resolve(coord_map, label_map):
    """pass2: 좌표 resolve + 라벨 resolve + 최종 JSON 출력"""
    print(f"\n[pass2] 좌표/라벨 resolve 시작")

    # ── Person ──
    print("[pass2] person 처리 중...")
    persons = []
    with open(RAW_PATHS["person"], "r", encoding="utf-8") as f:
        for line in f:
            p = json.loads(line)
            p = resolve_coord(p, coord_map, [
                "birth_place_qid", "death_place_qid", "citizenship_qid"
            ])
            p = resolve_label(p, label_map, "birth_place_qid", "birth_place")
            p = resolve_label(p, label_map, "citizenship_qid", "citizenship")
            p = resolve_label(p, label_map, "occupation_qid", "occupation")
            persons.append(p)

    persons.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["person"], "w", encoding="utf-8") as f:
        json.dump(persons, f, ensure_ascii=False, indent=1)
    print_stats("person", persons, anchor_key="anchor_year")

    # ── Event ──
    print("[pass2] event 처리 중...")
    events = []
    with open(RAW_PATHS["event"], "r", encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            e = resolve_coord(e, coord_map, [
                "location_qid", "country_qid"
            ])
            e = resolve_label(e, label_map, "location_qid", "location")
            e = resolve_label(e, label_map, "country_qid", "country")
            e = resolve_label(e, label_map, "conflict_qid", "conflict")
            events.append(e)

    events.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["event"], "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=1)
    print_stats("event", events, anchor_key="anchor_year")

    # ── Place ──
    print("[pass2] place 처리 중...")
    places = []
    with open(RAW_PATHS["place"], "r", encoding="utf-8") as f:
        for line in f:
            pl = json.loads(line)
            pl = resolve_coord(pl, coord_map, ["country_qid"])
            pl = resolve_label(pl, label_map, "country_qid", "country")
            places.append(pl)

    places.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["place"], "w", encoding="utf-8") as f:
        json.dump(places, f, ensure_ascii=False, indent=1)
    print_stats("place", places, anchor_key="inception")

    # ── Historical Entity ──
    print("[pass2] hist_entity 처리 중...")
    hists = []
    with open(RAW_PATHS["hist"], "r", encoding="utf-8") as f:
        for line in f:
            h = json.loads(line)
            h = resolve_coord(h, coord_map, ["capital_qid", "country_qid"])
            h = resolve_label(h, label_map, "capital_qid", "capital")
            hists.append(h)

    hists.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["hist"], "w", encoding="utf-8") as f:
        json.dump(hists, f, ensure_ascii=False, indent=1)
    print_stats("hist_entity", hists, anchor_key="start_year")

    # ── Artwork [mk] ──
    print("[pass2] artwork 처리 중...")
    artworks = []
    with open(RAW_PATHS["artwork"], "r", encoding="utf-8") as f:
        for line in f:
            a = json.loads(line)
            a = resolve_coord(a, coord_map, ["location_qid", "country_qid"])
            a = resolve_label(a, label_map, "creator_qid", "creator")
            a = resolve_label(a, label_map, "location_qid", "location")
            a = resolve_label(a, label_map, "country_qid", "country")
            a = resolve_label(a, label_map, "genre_qid", "genre")
            a = resolve_label(a, label_map, "movement_qid", "movement")
            artworks.append(a)

    artworks.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["artwork"], "w", encoding="utf-8") as f:
        json.dump(artworks, f, ensure_ascii=False, indent=1)
    print_stats("artwork", artworks, anchor_key="inception")

    # ── Invention [mk] ──
    print("[pass2] invention 처리 중...")
    inventions = []
    with open(RAW_PATHS["invention"], "r", encoding="utf-8") as f:
        for line in f:
            inv = json.loads(line)
            inv = resolve_coord(inv, coord_map, ["location_qid", "country_qid"])
            inv = resolve_label(inv, label_map, "inventor_qid", "inventor")
            inv = resolve_label(inv, label_map, "location_qid", "location")
            inv = resolve_label(inv, label_map, "country_qid", "country")
            inventions.append(inv)

    inventions.sort(key=lambda x: x["sitelinks"], reverse=True)
    with open(FINAL_PATHS["invention"], "w", encoding="utf-8") as f:
        json.dump(inventions, f, ensure_ascii=False, indent=1)
    print_stats("invention", inventions, anchor_key="inception")

    print(f"\n[pass2 완료] 모든 파일 저장됨: {OUTPUT_DIR}/")


def print_stats(type_name, records, anchor_key):
    """타입별 통계 출력"""
    has_ko = sum(1 for r in records if r.get("name_ko"))
    has_anchor = sum(1 for r in records if r.get(anchor_key) is not None)
    has_coord = sum(1 for r in records if r.get("lat") is not None)
    usable = sum(
        1 for r in records
        if r.get("name_ko") and r.get(anchor_key) is not None and r.get("lat") is not None
    )
    type_key = type_name.replace("hist_entity", "hist")
    size_mb = 0
    if type_key in FINAL_PATHS and os.path.exists(FINAL_PATHS[type_key]):
        size_mb = os.path.getsize(FINAL_PATHS[type_key]) / (1024 * 1024)

    print(f"\n  === {type_name} 통계 ===")
    print(f"    총: {len(records):,}")
    print(f"    한국어명: {has_ko:,}")
    print(f"    연도 있음: {has_anchor:,}")
    print(f"    좌표 있음: {has_coord:,}")
    print(f"    바로 사용 가능 (ko+연도+좌표): {usable:,}")
    print(f"    파일 크기: {size_mb:.1f}MB")

    # 상위 10개
    print(f"    상위 10 (sitelinks):")
    for r in records[:10]:
        name = r.get("name_ko") or r.get("name_en") or r.get("qid")
        year = r.get(anchor_key)
        has_c = "O" if r.get("lat") else "X"
        print(f"      {r['sitelinks']:>4} | {name} | {year or '?'} | coord:{has_c}")


# ── main ──────────────────────────────────────────────

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--resolve-only":
        print("[resolve-only] SQLite에서 coord/label 로딩...")
        coord_map, label_map = load_maps_for_pass2()
        print(f"  coord_map: {len(coord_map):,} | label_map: {len(label_map):,}")
        pass2_resolve(coord_map, label_map)
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--stats-only":
        anchor_key_map = {
            "person":   "anchor_year",
            "event":    "anchor_year",
            "place":    "inception",
            "hist":     "start_year",
            "artwork":  "inception",
            "invention":"inception",
        }
        for type_name, path in FINAL_PATHS.items():
            if os.path.exists(path):
                with open(path, "r") as f:
                    data = json.load(f)
                print_stats(type_name, data, anchor_key_map.get(type_name, "anchor_year"))
        return

    if not os.path.exists(DUMP_PATH):
        print(f"[ERROR] dump 파일 없음: {DUMP_PATH}")
        print(f"  wget -c https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.gz -O {DUMP_PATH}")
        sys.exit(1)

    # pass1: 스트리밍 추출 (SQLite + 스킵)
    pass1_stream(DUMP_PATH)

    # pass2: 참조 QID만 SQLite에서 로드 후 resolve
    coord_map, label_map = load_maps_for_pass2()
    pass2_resolve(coord_map, label_map)


if __name__ == "__main__":
    main()
