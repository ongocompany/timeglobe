#!/usr/bin/env python3
"""
[cl] AI 기반 역사 사건 선정 스크립트

Gemini API를 사용하여 시대별 주요 역사 사건/전투 리스트를 생성하고,
Wikidata event+battle 데이터와 QID 매칭.

하이브리드 모델 전략:
  - 고대 (-3000~500):  100년 청크, 10개, Gemini 2.5 Pro (정밀 선정)
  - 중세 (500~1500):   25년 청크, 15개, Gemini 2.5 Flash
  - 근세 (1500~1800):  10년 청크, 20개, Gemini 2.5 Flash
  - 근현대 (1800~2025): 5년 청크, 25개, Gemini 2.5 Flash

사용법:
  python3 scoreEvents.py                    # 전체 실행
  python3 scoreEvents.py --resume           # 이어서 실행
  python3 scoreEvents.py --test             # 테스트 (1900~1920만)
  python3 scoreEvents.py --match            # Wikidata 매칭만 실행
  python3 scoreEvents.py --stats            # 결과 통계

환경변수 (.env.local 또는 환경변수):
  GEMINI_API_KEY — Google Generative AI API 키
"""

import json
import os
import sys
import time
import re
import unicodedata
from pathlib import Path

# ── 설정 ──────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
EVENT_JSONL = OUTPUT_DIR / "categories" / "02_event.jsonl"
BATTLE_JSONL = OUTPUT_DIR / "categories" / "10_battle.jsonl"
DISASTER_JSONL = OUTPUT_DIR / "categories" / "08_disaster.jsonl"
PANDEMIC_JSONL = OUTPUT_DIR / "categories" / "11_pandemic.jsonl"

# 출력 파일
AI_EVENTS_DIR = OUTPUT_DIR / "ai_events"
AI_RAW_OUTPUT = AI_EVENTS_DIR / "ai_events_raw.jsonl"
AI_MATCHED_OUTPUT = AI_EVENTS_DIR / "ai_events_matched.jsonl"
PROGRESS_FILE = AI_EVENTS_DIR / "progress.json"

# ── .env.local 로드 ────────────────────────────────────
def load_dotenv():
    for env_file in [PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"]:
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY", "")
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# ── 적응형 청크 정의 ──────────────────────────────────
# (시작년, 끝년, 청크크기, 이벤트수, 모델)
CHUNKS_CONFIG = [
    (-3000, -500, 200, 20, "gemini-2.5-pro"),    # 고대: 250개
    ( -500,  500, 100, 25, "gemini-2.5-pro"),    # 고전기: 250개
    (  500, 1500,  25, 30, "gemini-2.5-flash"),  # 중세: 1,200개
    ( 1500, 1800,  10, 40, "gemini-2.5-flash"),  # 근세: 1,200개
    ( 1800, 1900,   2, 50, "gemini-2.5-flash"),  # 19세기: 2,500개
    ( 1900, 2000,   1, 60, "gemini-2.5-flash"),  # 20세기: 6,000개
    ( 2000, 2025,   1, 40, "gemini-2.5-flash"),  # 21세기: 1,000개
]

def generate_chunks():
    chunks = []
    for start, end, step, count, model in CHUNKS_CONFIG:
        y = start
        while y < end:
            chunk_end = min(y + step, end)
            chunks.append((y, chunk_end, count, model))
            y += step
    return chunks


# ── 프롬프트 생성 ──────────────────────────────────────
def build_prompt(year_from, year_to, count):
    if year_from < 0:
        if year_to < 0:
            period_str = f"기원전 {abs(year_from)}년 ~ 기원전 {abs(year_to)}년"
        else:
            period_str = f"기원전 {abs(year_from)}년 ~ 서기 {year_to}년"
    else:
        period_str = f"서기 {year_from}년 ~ {year_to}년"

    if year_to - year_from <= 5:
        time_context = f"{period_str} 사이에 발생했거나 진행 중이던"
    else:
        time_context = f"{period_str} 사이에 발생한"

    return f"""당신은 세계사 전문 학자입니다.
{time_context} 역사적으로 중요한 사건/전투/혁명/조약/재난을 정확히 {count}개 선정해주세요.

## 선정 기준 (다양한 유형에서 균형있게):
- 전쟁/전투: 주요 군사 충돌, 포위전, 해전, 공성전
- 혁명/반란: 정치적 격변, 쿠데타, 독립 운동, 민주화 운동
- 조약/회의: 주요 평화 조약, 국제 회의, 합의
- 재난/역병: 대지진, 화산 폭발, 대역병, 대기근
- 탐험/발견: 항해, 신대륙 발견, 과학적 발견
- 문화/종교: 종교개혁, 문화운동, 올림픽 등 주요 행사
- 정치/외교: 건국, 멸망, 합병, 분열, 중요 법령/선언

## 지역 균형:
동아시아(한국/중국/일본), 유럽, 중동, 남아시아, 동남아시아, 중앙아시아, 북아프리카, 사하라이남 아프리카, 북미, 남미, 오세아니아 — 해당 시대에 존재하는 문명권에서 고루 선정.

## 필수 응답 형식 (JSON 배열만, 다른 텍스트 없이):
[
  {{
    "name_en": "영어 이름 (가장 널리 알려진 표기)",
    "name_ko": "한국어 이름",
    "start_year": 시작연도(정수, BC는 음수),
    "end_year": 종료연도(정수, 같은 해면 start_year와 동일, null이면 생략),
    "location": "발생 장소 (도시/지역, 국가 — 한국어)",
    "participants": "주요 참여국/세력 (한국어, 쉼표 구분)",
    "type": "유형 (war/battle/revolution/treaty/disaster/exploration/cultural/political)",
    "field": "분야 (military/political/diplomatic/natural_disaster/cultural/religious/scientific/economic)",
    "region": "발생 지역 (east_asia/europe/middle_east/south_asia/southeast_asia/central_asia/north_africa/sub_saharan/north_america/latin_america/oceania/global)",
    "significance": "한 줄 역사적 의의 (한국어, 40자 이내)"
  }}
]

중요: 반드시 JSON 배열만 출력하세요. 설명이나 마크다운 없이 순수 JSON만."""


# ── API 호출 ──────────────────────────────────────────
def call_gemini(prompt, model="gemini-2.5-flash", max_retries=3):
    import urllib.request
    import urllib.error

    url = f"{API_BASE}/{model}:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    is_pro = "pro" in model
    gen_config = {
        "temperature": 0.7,
        "maxOutputTokens": 65536 if is_pro else 32768,
    }
    if not is_pro:
        gen_config["thinkingConfig"] = {"thinkingBudget": 0}

    body = json.dumps({
        "contents": [{
            "parts": [
                {"text": "You are a world history expert. Always respond with valid JSON only."},
                {"text": prompt},
            ]
        }],
        "generationConfig": gen_config,
    }).encode("utf-8")

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            timeout = 180 if is_pro else 120
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                candidates = result.get("candidates", [])
                if not candidates:
                    print(f"  [Empty candidates] attempt {attempt+1}")
                    time.sleep(5)
                    continue

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    print(f"  [No parts] attempt {attempt+1}")
                    time.sleep(5)
                    continue

                content = ""
                for part in parts:
                    if not part.get("thought", False) and "text" in part:
                        content = part["text"]

                if not content or not content.strip():
                    print(f"  [Empty content] attempt {attempt+1}")
                    time.sleep(10)
                    continue

                return content
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            print(f"  [HTTP {e.code}] {error_body[:200]}")
            if e.code == 429:
                wait = (attempt + 1) * 15
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            elif e.code >= 500:
                time.sleep(10)
            else:
                raise
        except Exception as e:
            print(f"  [Error] {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
            else:
                raise

    return None


def parse_json_response(text):
    if not text:
        return []
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()

    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1:
        return []

    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        print(f"  [JSON parse error] {e}")
        recovered = []
        for m in re.finditer(r'\{[^}]+\}', text[start:end + 1]):
            try:
                obj = json.loads(m.group())
                if "name_en" in obj:
                    recovered.append(obj)
            except:
                continue
        if recovered:
            print(f"  [Recovered] {len(recovered)} items from malformed JSON")
        return recovered


# ── 진행 상황 관리 ─────────────────────────────────────
def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed_chunks": [], "total_events": 0, "last_updated": None}

def save_progress(progress):
    progress["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


# ── 메인 실행 ──────────────────────────────────────────
def run_scoring(resume=False, test_mode=False):
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    AI_EVENTS_DIR.mkdir(parents=True, exist_ok=True)

    chunks = generate_chunks()
    models_used = set(c[3] for c in chunks)
    print(f"[cl] AI 역사 사건 선정 시작 (하이브리드)")
    print(f"  모델: {', '.join(models_used)}")
    print(f"  총 청크: {len(chunks)}개")
    print(f"  예상 사건: ~{sum(c[2] for c in chunks):,}개")

    if test_mode:
        chunks = [
            (-500, -400, 10, "gemini-2.5-pro"),
            (1900, 1905, 15, "gemini-2.5-flash"),
            (1905, 1910, 15, "gemini-2.5-flash"),
            (1910, 1915, 15, "gemini-2.5-flash"),
        ]
        print(f"  [TEST MODE] {len(chunks)}개 청크 (Pro 1 + Flash 3)")

    progress = load_progress() if resume else {"completed_chunks": [], "total_events": 0}
    completed_set = set(tuple(c[:3]) for c in progress.get("completed_chunks", []))

    mode = "a" if resume and AI_RAW_OUTPUT.exists() else "w"
    t0 = time.time()
    session_events = 0
    errors = 0

    with open(AI_RAW_OUTPUT, mode, encoding="utf-8") as out_f:
        for i, (year_from, year_to, count, model) in enumerate(chunks):
            chunk_key = (year_from, year_to, count)
            if chunk_key in completed_set:
                continue

            model_tag = "P" if "pro" in model else "F"
            if year_from < 0:
                if year_to < 0:
                    label = f"BC{abs(year_from)}~BC{abs(year_to)}"
                else:
                    label = f"BC{abs(year_from)}~{year_to}"
            else:
                label = f"{year_from}~{year_to}"
            print(f"  [{i+1}/{len(chunks)}] {label} ({count}개)[{model_tag}] ... ", end="", flush=True)

            prompt = build_prompt(year_from, year_to, count)
            events = []
            for retry in range(3):
                try:
                    raw_response = call_gemini(prompt, model=model)
                    events = parse_json_response(raw_response)
                except Exception as e:
                    print(f"FAIL ({e})")
                    errors += 1
                    if errors > 30:
                        print("\n[ABORT] 에러 30회 초과 — --resume로 재시작 가능")
                        break
                    break

                if len(events) > 0:
                    break
                if retry < 2:
                    print(f"0개(재시도 {retry+1}/2) ", end="", flush=True)
                    time.sleep(15 if "pro" in model else 5)

            if errors > 30:
                break

            if len(events) == 0:
                print(f"SKIP (3회 시도 후 0개)")
                errors += 1
                continue

            for ev in events:
                ev["_chunk"] = f"{year_from}~{year_to}"
                ev["_requested_count"] = count
                ev["_model"] = model_tag
                out_f.write(json.dumps(ev, ensure_ascii=False) + "\n")

            session_events += len(events)
            progress["total_events"] = progress.get("total_events", 0) + len(events)
            progress["completed_chunks"].append(list(chunk_key))
            completed_set.add(chunk_key)

            print(f"OK ({len(events)}개, 누적 {session_events:,})")

            if (i + 1) % 10 == 0:
                save_progress(progress)

            delay = 30 if "pro" in model else 4
            time.sleep(delay)

    save_progress(progress)

    elapsed = time.time() - t0
    total = progress.get("total_events", 0)
    print(f"\n{'='*55}")
    print(f"AI 사건 선정 완료 ({elapsed/60:.1f}분)")
    print(f"  이번 세션: {session_events:,}개")
    print(f"  누적 총: {total:,}개")
    print(f"  에러: {errors}회")
    print(f"  출력: {AI_RAW_OUTPUT}")


# ── Wikidata 매칭 ──────────────────────────────────────
def run_matching():
    if not AI_RAW_OUTPUT.exists():
        print(f"ERROR: {AI_RAW_OUTPUT} 없음. 먼저 scoreEvents.py 실행하세요.")
        sys.exit(1)

    print("[cl] Wikidata 사건 매칭 시작...")

    # 1) Wikidata event+battle 로드
    print("  Wikidata 사건 로딩...")
    wd_by_name_ko = {}
    wd_by_name_en = {}
    wd_by_name_en_norm = {}
    wd_count = 0

    def _accent_normalize(s):
        nfkd = unicodedata.normalize('NFKD', s)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    for src_file in [EVENT_JSONL, BATTLE_JSONL, DISASTER_JSONL, PANDEMIC_JSONL]:
        if not src_file.exists():
            print(f"  [WARN] {src_file} 없음, 스킵")
            continue
        with open(src_file) as f:
            for line in f:
                try:
                    item = json.loads(line.strip())
                except:
                    continue
                wd_count += 1
                nk = item.get("name_ko", "")
                ne = item.get("name_en", "")
                if nk:
                    wd_by_name_ko.setdefault(nk, []).append(item)
                if ne:
                    ne_lower = ne.lower()
                    wd_by_name_en.setdefault(ne_lower, []).append(item)
                    ne_norm = _accent_normalize(ne_lower)
                    if ne_norm != ne_lower:
                        wd_by_name_en_norm.setdefault(ne_norm, []).append(item)

    print(f"  Wikidata: {wd_count:,}개 로드 (ko={len(wd_by_name_ko):,}, en={len(wd_by_name_en):,}, norm={len(wd_by_name_en_norm):,})")

    # 2) AI 사건 로드
    print("  AI 사건 로딩...")
    ai_events = []
    with open(AI_RAW_OUTPUT) as f:
        for line in f:
            try:
                ai_events.append(json.loads(line.strip()))
            except:
                continue
    print(f"  AI 사건: {len(ai_events):,}개")

    # 부분문자열 검색 인덱스 (3단계용)
    # ko: 3글자 이상 단어 → [items]
    wd_ko_substr = {}
    for nk, items in wd_by_name_ko.items():
        # 핵심 키워드 추출 (조사/접미 제거)
        words = re.sub(r'[의에서]$', '', nk).strip()
        if len(words) >= 3:
            wd_ko_substr.setdefault(words, items)
        # 공백 제거 버전
        no_sp = nk.replace(" ", "")
        if no_sp != nk and len(no_sp) >= 3:
            wd_ko_substr.setdefault(no_sp, items)

    # 이름 변형 생성
    def get_en_variants(name):
        variants = {name.lower()}
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        variants.add(no_paren.lower())
        # 괄호 안 이름
        for p in re.findall(r'\(([^)]+)\)', name):
            variants.add(p.lower())
        # "Battle of X" ↔ "X" 변환
        m = re.match(r'^(?:battle|siege|fall|sack|treaty|peace|congress|war) of (.+)$', no_paren, re.I)
        if m:
            variants.add(m.group(1).lower())
        # 반대로: "X" → "Battle of X" etc.
        for prefix in ["battle of", "siege of", "treaty of", "peace of"]:
            variants.add(f"{prefix} {no_paren.lower()}")
        # "begins/starts/breaks out" 제거
        no_suffix = re.sub(r'\s+(begins?|starts?|breaks?\s*out|commences?|ends?|erupts?)$', '', no_paren, flags=re.I).strip()
        if no_suffix != no_paren:
            variants.add(no_suffix.lower())
        # "Outbreak of X" → "X"
        m2 = re.match(r'^(?:outbreak|start|beginning|end|fall|rise) of (.+)$', no_paren, re.I)
        if m2:
            variants.add(m2.group(1).lower())
        # "Assassination of X" → 이건 유지 (중요)
        # 악센트 정규화
        ascii_name = _accent_normalize(no_paren)
        if ascii_name.lower() != no_paren.lower():
            variants.add(ascii_name.lower())
        # "the" 제거/추가
        no_the = re.sub(r'^the\s+', '', no_paren, flags=re.I).strip()
        variants.add(no_the.lower())
        variants.add(f"the {no_the.lower()}")
        # 하이픈/대시: "Russo-Japanese War" → "russo japanese war"
        variants.add(no_paren.lower().replace("-", " ").replace("–", " "))
        # 연도 추가/제거: "Revolution of 1905" ↔ "Revolution"
        year_m = re.search(r'\b(\d{3,4})\b', no_paren)
        if year_m:
            no_year = re.sub(r'\s*\b\d{3,4}\b\s*', ' ', no_paren).strip()
            no_year = re.sub(r'\s*(of|in)\s*$', '', no_year, flags=re.I).strip()
            if len(no_year) >= 5:
                variants.add(no_year.lower())
        return variants

    def get_ko_variants(name):
        variants = {name}
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        variants.add(no_paren)
        for p in re.findall(r'\(([^)]+)\)', name):
            if len(p) >= 2:
                variants.add(p)
        # "제N차" 변형: "제1차 세계 대전" → "1차 세계대전", "세계대전"
        m = re.match(r'^제?(\d+)차\s+(.+)$', no_paren)
        if m:
            variants.add(f"{m.group(1)}차 {m.group(2)}")
            variants.add(m.group(2))
        # "~시작/발발/종결" 제거
        no_suffix = re.sub(r'\s*(시작|발발|종결|종전|발생|개시|개전)$', '', no_paren).strip()
        if no_suffix != no_paren and len(no_suffix) >= 3:
            variants.add(no_suffix)
        # 공백 제거 변형: "세계 대전" → "세계대전"
        no_space = no_paren.replace(" ", "")
        if no_space != no_paren:
            variants.add(no_space)
        # 연도 제거: "1905년 러시아 혁명" → "러시아 혁명"
        no_year = re.sub(r'^\d{3,4}년?\s*', '', no_paren).strip()
        if no_year != no_paren and len(no_year) >= 3:
            variants.add(no_year)
        return variants

    # 3) 매칭
    print("  매칭 중...")
    matched = 0
    unmatched_count = 0
    fuzzy_matched = 0
    substr_matched = 0
    multi_match = 0

    with open(AI_MATCHED_OUTPUT, "w", encoding="utf-8") as out_f:
        for ev in ai_events:
            name_ko = ev.get("name_ko", "")
            name_en = ev.get("name_en", "")
            start_year = ev.get("start_year")

            candidates = []
            match_method = "exact"

            # ── 1단계: 정확 매칭 ──
            if name_ko and name_ko in wd_by_name_ko:
                candidates.extend(wd_by_name_ko[name_ko])
            if name_en and name_en.lower() in wd_by_name_en:
                for c in wd_by_name_en[name_en.lower()]:
                    if c not in candidates:
                        candidates.append(c)

            # ── 2단계: 퍼지 매칭 ──
            if not candidates:
                match_method = "fuzzy"
                if name_en:
                    for variant in get_en_variants(name_en):
                        if variant in wd_by_name_en:
                            candidates.extend(wd_by_name_en[variant])
                    if not candidates:
                        for variant in get_en_variants(name_en):
                            norm_v = _accent_normalize(variant)
                            if norm_v in wd_by_name_en:
                                candidates.extend(wd_by_name_en[norm_v])
                            elif norm_v in wd_by_name_en_norm:
                                candidates.extend(wd_by_name_en_norm[norm_v])
                if not candidates and name_ko:
                    for ko_var in get_ko_variants(name_ko):
                        if ko_var != name_ko and ko_var in wd_by_name_ko:
                            candidates.extend(wd_by_name_ko[ko_var])

            # ── 3단계: 부분문자열 매칭 ──
            if not candidates:
                match_method = "substr"
                # 한국어: AI 이벤트 이름의 핵심 키워드가 WD 이름에 포함되는지
                if name_ko and len(name_ko) >= 3:
                    ko_vars = get_ko_variants(name_ko)
                    for kv in ko_vars:
                        if len(kv) < 3:
                            continue
                        for wd_nk, wd_items_list in wd_by_name_ko.items():
                            if kv in wd_nk or wd_nk in kv:
                                if kv != wd_nk:  # 정확 매칭은 이미 했으므로
                                    candidates.extend(wd_items_list)
                        if candidates:
                            break
                # 영어: 핵심 키워드 매칭
                if not candidates and name_en:
                    en_vars = get_en_variants(name_en)
                    for ev_var in en_vars:
                        if len(ev_var) < 6:
                            continue
                        for wd_ne, wd_items_list in wd_by_name_en.items():
                            if ev_var in wd_ne or wd_ne in ev_var:
                                if ev_var != wd_ne:
                                    candidates.extend(wd_items_list)
                        if candidates:
                            break

            if not candidates:
                unmatched_count += 1
                result = {**ev, "_match": "none", "_qid": None}
                out_f.write(json.dumps(result, ensure_ascii=False) + "\n")
                continue

            # 연도 필터 (start_year ±20)
            if start_year and len(candidates) > 1:
                year_matched = []
                for c in candidates:
                    wd_year = c.get("start_year") or c.get("point_in_time")
                    if wd_year and abs(wd_year - start_year) <= 20:
                        year_matched.append(c)
                if year_matched:
                    candidates = year_matched

            # QID 중복 제거
            seen_qids = set()
            deduped = []
            for c in candidates:
                qid = c.get("qid", "")
                if qid and qid not in seen_qids:
                    seen_qids.add(qid)
                    deduped.append(c)
                elif not qid:
                    deduped.append(c)
            candidates = deduped if deduped else candidates

            if len(candidates) == 1:
                best = candidates[0]
                matched += 1
                if match_method == "fuzzy":
                    fuzzy_matched += 1
                elif match_method == "substr":
                    substr_matched += 1
                result = {
                    **ev,
                    "_match": match_method,
                    "_qid": best.get("qid"),
                    "_sitelinks": best.get("sitelinks", 0),
                    "_wd_name_ko": best.get("name_ko"),
                    "_wd_name_en": best.get("name_en"),
                    "_wd_start": best.get("start_year") or best.get("point_in_time"),
                    "_wd_coord": best.get("coord"),
                    "_wd_category": best.get("_category"),
                }
            else:
                best = max(candidates, key=lambda x: x.get("sitelinks", 0))
                multi_match += 1
                matched += 1
                if match_method == "fuzzy":
                    fuzzy_matched += 1
                elif match_method == "substr":
                    substr_matched += 1
                result = {
                    **ev,
                    "_match": f"multi_{match_method}",
                    "_candidates": len(candidates),
                    "_qid": best.get("qid"),
                    "_sitelinks": best.get("sitelinks", 0),
                    "_wd_name_ko": best.get("name_ko"),
                    "_wd_name_en": best.get("name_en"),
                    "_wd_start": best.get("start_year") or best.get("point_in_time"),
                    "_wd_coord": best.get("coord"),
                    "_wd_category": best.get("_category"),
                }

            out_f.write(json.dumps(result, ensure_ascii=False) + "\n")

    total = len(ai_events)
    print(f"\n{'='*55}")
    print(f"매칭 완료")
    print(f"  총 AI 사건: {total:,}")
    print(f"  매칭 성공: {matched:,} ({matched/total*100:.1f}%)")
    exact = matched - multi_match - fuzzy_matched - substr_matched
    print(f"    - 정확 매칭: {exact:,}")
    print(f"    - 퍼지 매칭: {fuzzy_matched:,}")
    print(f"    - 부분문자열: {substr_matched:,}")
    print(f"    - 복수 후보: {multi_match:,}")
    print(f"  매칭 실패: {unmatched_count:,} ({unmatched_count/total*100:.1f}%)")
    print(f"  출력: {AI_MATCHED_OUTPUT}")


# ── 통계 ──────────────────────────────────────────────
def show_stats():
    if AI_RAW_OUTPUT.exists():
        count = sum(1 for _ in open(AI_RAW_OUTPUT))
        print(f"AI 선정 사건: {count:,}개 ({AI_RAW_OUTPUT})")

        types = {}
        fields = {}
        regions = {}
        with open(AI_RAW_OUTPUT) as f:
            for line in f:
                try:
                    ev = json.loads(line.strip())
                    t = ev.get("type", "unknown")
                    field = ev.get("field", "unknown")
                    region = ev.get("region", "unknown")
                    types[t] = types.get(t, 0) + 1
                    fields[field] = fields.get(field, 0) + 1
                    regions[region] = regions.get(region, 0) + 1
                except:
                    continue

        print("\n유형별:")
        for k, v in sorted(types.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

        print("\n분야별:")
        for k, v in sorted(fields.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

        print("\n지역별:")
        for k, v in sorted(regions.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

    if AI_MATCHED_OUTPUT.exists():
        total = matched = unmatched = 0
        with open(AI_MATCHED_OUTPUT) as f:
            for line in f:
                try:
                    ev = json.loads(line.strip())
                    total += 1
                    if ev.get("_match") != "none":
                        matched += 1
                    else:
                        unmatched += 1
                except:
                    continue
        print(f"\n매칭 결과: {matched:,}/{total:,} ({matched/total*100:.1f}%)")

    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            prog = json.load(f)
        print(f"\n진행: {len(prog.get('completed_chunks', []))} 청크 완료")
        print(f"마지막 업데이트: {prog.get('last_updated', 'N/A')}")


# ── CLI ───────────────────────────────────────────────
if __name__ == "__main__":
    if "--stats" in sys.argv:
        show_stats()
    elif "--match" in sys.argv:
        run_matching()
    elif "--test" in sys.argv:
        run_scoring(resume=False, test_mode=True)
    elif "--resume" in sys.argv:
        run_scoring(resume=True)
    else:
        run_scoring(resume=False)
