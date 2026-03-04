#!/usr/bin/env python3
"""
[cl] AI 기반 역사 인물 선정 스크립트

Gemini API를 사용하여 시대별 주요 역사 인물 리스트를 생성하고,
Wikidata 309k 인물 데이터와 QID 매칭.

하이브리드 모델 전략:
  - 고대 (-1000~500):  50년 청크, 20명, Gemini 2.5 Pro (정밀 선정)
  - 중세 (500~1500):   10년 청크, 20명, Gemini 2.5 Flash
  - 근세 (1500~1800):  5년 청크,  25명, Gemini 2.5 Flash
  - 근현대 (1800~2015): 1년 청크,  25명, Gemini 2.5 Flash

사용법:
  python3 scorePersons.py                    # 전체 실행
  python3 scorePersons.py --resume           # 이어서 실행
  python3 scorePersons.py --test             # 테스트 (1900~1905만)
  python3 scorePersons.py --match            # Wikidata 매칭만 실행
  python3 scorePersons.py --stats            # 결과 통계

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
PERSON_JSONL = OUTPUT_DIR / "categories" / "03_person.jsonl"
NAMUWIKI_DB = Path("/mnt/data2/namuwiki/namuwiki.db")

# 출력 파일
AI_PERSONS_DIR = OUTPUT_DIR / "ai_persons"
AI_RAW_OUTPUT = AI_PERSONS_DIR / "ai_persons_raw.jsonl"      # AI 응답 원본
AI_MATCHED_OUTPUT = AI_PERSONS_DIR / "ai_persons_matched.jsonl"  # Wikidata 매칭 결과
PROGRESS_FILE = AI_PERSONS_DIR / "progress.json"

# ── .env.local 로드 ────────────────────────────────────
def load_dotenv():
    """간단한 .env.local 파서 (python-dotenv 없이)"""
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
# (시작년, 끝년, 청크크기, 인물수, 모델)
# [cl] 하이브리드: 고대=Pro(정밀), 나머지=Flash(속도)
CHUNKS_CONFIG = [
    (-1000,  500, 50, 20, "gemini-2.5-pro"),     # 고대: Pro로 정밀 선정
    (  500, 1500, 10, 20, "gemini-2.5-flash"),   # 중세: Flash
    ( 1500, 1800,  5, 25, "gemini-2.5-flash"),   # 근세: Flash
    ( 1800, 2015,  1, 25, "gemini-2.5-flash"),   # 근현대: Flash
]

def generate_chunks():
    """적응형 청크 리스트 생성 (모델 정보 포함)"""
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
    """시대별 인물 선정 프롬프트"""
    if year_from < 0:
        period_str = f"기원전 {abs(year_from)}년 ~ {'기원전 ' + str(abs(year_to)) if year_to < 0 else '서기 ' + str(year_to)}년"
    else:
        period_str = f"서기 {year_from}년 ~ {year_to}년"

    # 1년 단위면 "태어난" 대신 좀 더 넓게
    if year_to - year_from <= 1:
        time_context = f"{period_str}에 태어났거나 이 해에 주요 활동을 한"
    elif year_to - year_from <= 5:
        time_context = f"{period_str} 사이에 태어난"
    else:
        time_context = f"{period_str} 사이에 태어난"

    return f"""당신은 세계사 전문 학자입니다.
{time_context} 역사적으로 중요한 인물을 정확히 {count}명 선정해주세요.

## 선정 기준 (다양한 분야에서 균형있게):
- 정치/군사: 왕, 황제, 대통령, 수상, 장군, 혁명가, 독립운동가
- 과학/기술: 과학자, 수학자, 발명가, 의학자
- 사상/종교: 철학자, 사상가, 종교 지도자, 신학자
- 문학/예술: 작가, 시인, 극작가, 화가, 조각가, 건축가
- 음악: 작곡가, 연주자 (클래식 및 전통음악 위주)
- 탐험/지리: 탐험가, 항해자, 지리학자

## 지역 균형:
동아시아(한국/중국/일본), 유럽, 중동, 남아시아, 동남아시아, 중앙아시아, 북아프리카, 사하라이남 아프리카, 북미, 남미, 오세아니아 — 해당 시대에 존재하는 문명권에서 고루 선정.

## 필수 응답 형식 (JSON 배열만, 다른 텍스트 없이):
[
  {{
    "name_en": "영어 이름 (가장 널리 알려진 표기)",
    "name_ko": "한국어 이름",
    "birth_year": 출생연도(정수, BC는 음수),
    "death_year": 사망연도(정수, null이면 생략),
    "birth_place": "출생지 (도시, 국가 — 한국어)",
    "active_country": "주요 활동국 (여러 나라면 쉼표 구분 — 한국어)",
    "role": "직업/역할 (영어, 예: monarch, scientist, poet)",
    "field": "분야 (politics/military/science/philosophy/literature/art/music/exploration/religion)",
    "region": "출신 지역 (east_asia/europe/middle_east/south_asia/southeast_asia/central_asia/north_africa/sub_saharan/north_america/latin_america/oceania)",
    "nationality": "국적/출신국 (한국어)",
    "significance": "한 줄 역사적 의의 (한국어, 30자 이내)"
  }}
]

중요: 반드시 JSON 배열만 출력하세요. 설명이나 마크다운 없이 순수 JSON만."""

# ── API 호출 ──────────────────────────────────────────
def call_gemini(prompt, model="gemini-2.5-flash", max_retries=3):
    """Gemini API 호출 (모델 동적 선택)"""
    import urllib.request
    import urllib.error

    url = f"{API_BASE}/{model}:generateContent?key={API_KEY}"
    headers = {
        "Content-Type": "application/json",
    }
    is_pro = "pro" in model
    gen_config = {
        "temperature": 0.7,
        "maxOutputTokens": 65536 if is_pro else 16384,
    }
    # Flash: thinking 비활성화 (토큰을 JSON 응답에 집중)
    if not is_pro:
        gen_config["thinkingConfig"] = {"thinkingBudget": 0}

    body = json.dumps({
        "contents": [
            {
                "parts": [
                    {"text": "You are a world history expert. Always respond with valid JSON only."},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": gen_config,
    }).encode("utf-8")

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            timeout = 180 if "pro" in model else 120
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read().decode("utf-8"))

                # 응답 구조 검증
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

                # Gemini 2.5 Pro: thinking이 parts[0], 응답이 parts[1]
                # 마지막 non-thought 파트에서 텍스트 추출
                content = ""
                for part in parts:
                    if not part.get("thought", False) and "text" in part:
                        content = part["text"]

                # content가 비어있으면 (thinking-only 응답) 재시도
                if not content or not content.strip():
                    print(f"  [Empty content] thinking-only? attempt {attempt+1}")
                    time.sleep(10)
                    continue

                return content
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            print(f"  [HTTP {e.code}] {error_body[:200]}")
            if e.code == 429:  # rate limit
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
    """AI 응답에서 JSON 배열 추출 (마크다운 코드블록, thinking 태그 등 처리)"""
    if not text:
        return []

    # 마크다운 코드블록 제거
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()

    # JSON 배열 찾기
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1:
        return []

    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        print(f"  [JSON parse error] {e}")
        # 개별 객체 복구 시도
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
    """이전 진행 상황 로드"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed_chunks": [], "total_persons": 0, "last_updated": None}


def save_progress(progress):
    """진행 상황 저장"""
    progress["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


# ── 메인 실행 ──────────────────────────────────────────
def run_scoring(resume=False, test_mode=False):
    """AI 인물 선정 메인 루프"""
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        print("  .env.local에 GEMINI_API_KEY=AIza... 추가하거나")
        print("  export GEMINI_API_KEY=AIza... 실행하세요.")
        sys.exit(1)

    AI_PERSONS_DIR.mkdir(parents=True, exist_ok=True)

    chunks = generate_chunks()
    models_used = set(c[3] for c in chunks)
    print(f"[cl] AI 인물 선정 시작 (하이브리드)")
    print(f"  모델: {', '.join(models_used)}")
    print(f"  총 청크: {len(chunks)}개")
    print(f"  예상 인물: ~{sum(c[2] for c in chunks):,}명")

    if test_mode:
        # 테스트: 고대 1청크(Pro) + 근현대 2청크(Flash)
        chunks = [
            (-500, -450, 10, "gemini-2.5-pro"),
            (1900, 1901, 10, "gemini-2.5-flash"),
            (1901, 1902, 10, "gemini-2.5-flash"),
        ]
        print(f"  [TEST MODE] {len(chunks)}개 청크 (Pro 1 + Flash 2)")

    # 진행 상황
    progress = load_progress() if resume else {"completed_chunks": [], "total_persons": 0}
    completed_set = set(tuple(c[:3]) for c in progress.get("completed_chunks", []))

    mode = "a" if resume and AI_RAW_OUTPUT.exists() else "w"
    t0 = time.time()
    session_persons = 0
    errors = 0

    with open(AI_RAW_OUTPUT, mode, encoding="utf-8") as out_f:
        for i, (year_from, year_to, count, model) in enumerate(chunks):
            chunk_key = (year_from, year_to, count)

            # 이미 완료된 청크 건너뛰기
            if chunk_key in completed_set:
                continue

            # 진행률 표시
            model_tag = "P" if "pro" in model else "F"
            if year_from < 0:
                label = f"BC{abs(year_from)}~{'BC' + str(abs(year_to)) if year_to < 0 else str(year_to)}"
            else:
                label = f"{year_from}~{year_to}"
            print(f"  [{i+1}/{len(chunks)}] {label} ({count}명)[{model_tag}] ... ", end="", flush=True)

            # API 호출 (0명이면 최대 2회 재시도)
            prompt = build_prompt(year_from, year_to, count)
            persons = []
            for retry in range(3):
                try:
                    raw_response = call_gemini(prompt, model=model)
                    persons = parse_json_response(raw_response)
                except Exception as e:
                    print(f"FAIL ({e})")
                    errors += 1
                    if errors > 30:
                        print("\n[ABORT] 에러 30회 초과 — --resume로 재시작 가능")
                        break
                    break

                if len(persons) > 0:
                    break
                # 0명 → 재시도
                if retry < 2:
                    print(f"0명(재시도 {retry+1}/2) ", end="", flush=True)
                    time.sleep(15 if "pro" in model else 5)

            if errors > 30:
                break

            if len(persons) == 0:
                print(f"SKIP (3회 시도 후 0명)")
                errors += 1
                continue

            # 결과 저장
            for p in persons:
                p["_chunk"] = f"{year_from}~{year_to}"
                p["_requested_count"] = count
                p["_model"] = model_tag
                out_f.write(json.dumps(p, ensure_ascii=False) + "\n")

            session_persons += len(persons)
            progress["total_persons"] = progress.get("total_persons", 0) + len(persons)
            progress["completed_chunks"].append(list(chunk_key))
            completed_set.add(chunk_key)

            print(f"OK ({len(persons)}명, 누적 {session_persons:,})")

            # 10청크마다 진행 저장
            if (i + 1) % 10 == 0:
                save_progress(progress)

            # Rate limit 방지 (Pro: 2 RPM=30s, Flash: 15 RPM=4s)
            delay = 30 if "pro" in model else 4
            time.sleep(delay)

    save_progress(progress)

    elapsed = time.time() - t0
    total = progress.get("total_persons", 0)
    print(f"\n{'='*55}")
    print(f"AI 인물 선정 완료 ({elapsed/60:.1f}분)")
    print(f"  이번 세션: {session_persons:,}명")
    print(f"  누적 총: {total:,}명")
    print(f"  에러: {errors}회")
    print(f"  출력: {AI_RAW_OUTPUT}")


# ── Wikidata 매칭 ──────────────────────────────────────
def run_matching():
    """AI 선정 인물을 Wikidata 309k 인물 데이터와 매칭"""
    if not AI_RAW_OUTPUT.exists():
        print(f"ERROR: {AI_RAW_OUTPUT} 없음. 먼저 scorePersons.py 실행하세요.")
        sys.exit(1)
    if not PERSON_JSONL.exists():
        print(f"ERROR: {PERSON_JSONL} 없음.")
        sys.exit(1)

    print("[cl] Wikidata 매칭 시작...")

    # 1) Wikidata 인물 로드 — name_ko, name_en, birth_year로 인덱스
    print("  Wikidata 인물 로딩...")
    wd_by_name_ko = {}   # name_ko → [items]
    wd_by_name_en = {}   # name_en.lower() → [items]
    wd_by_name_en_norm = {}  # 악센트 정규화된 영어 이름 → [items]
    wd_by_last_en = {}   # 성(last word) → [items] (심층 퍼지용)
    wd_count = 0

    def _accent_normalize(s):
        """악센트/특수문자 제거: Étienne → Etienne"""
        nfkd = unicodedata.normalize('NFKD', s)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    with open(PERSON_JSONL) as f:
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
                # 악센트 정규화 인덱스
                ne_norm = _accent_normalize(ne_lower)
                if ne_norm != ne_lower:
                    wd_by_name_en_norm.setdefault(ne_norm, []).append(item)
                # 성(last word) 인덱스 (4자 이상만)
                words = ne_lower.split()
                if len(words) >= 2 and len(words[-1]) >= 4:
                    wd_by_last_en.setdefault(words[-1], []).append(item)

            if wd_count % 100_000 == 0:
                print(f"    ... {wd_count:,}")

    print(f"  Wikidata: {wd_count:,}명 로드 (ko={len(wd_by_name_ko):,}, en={len(wd_by_name_en):,}, norm={len(wd_by_name_en_norm):,}, last={len(wd_by_last_en):,})")

    # 2) 나무위키 브릿지 준비
    namu_conn = None
    namu_titles = {}
    if NAMUWIKI_DB.exists():
        import sqlite3
        print("  나무위키 인덱스 로딩...")
        namu_conn = sqlite3.connect(str(NAMUWIKI_DB))
        namu_cur = namu_conn.cursor()
        namu_cur.execute("SELECT id, title FROM articles WHERE namespace = 0")
        for row in namu_cur.fetchall():
            namu_titles[row[1]] = row[0]
        print(f"  나무위키: {len(namu_titles):,}개 제목")
    else:
        print("  나무위키 DB 없음 — 브릿지 매칭 스킵")

    def namu_bridge_names(name_ko):
        """나무위키에서 이름 변형 추출 (ko_title만, 신뢰도 높음)"""
        if not namu_conn:
            return set()

        names = set()
        # 한국어 제목 매칭만 (en_body는 오매칭 많아 제외)
        ko_variants = [name_ko]
        no_paren = re.sub(r"\s*\([^)]*\)", "", name_ko).strip()
        ko_variants.append(no_paren)
        for p in re.findall(r"\(([^)]+)\)", name_ko):
            if len(p) >= 2:
                ko_variants.append(p)
        no_num = re.sub(r"\s+\d+세.*$", "", no_paren).strip()
        if len(no_num) >= 2:
            ko_variants.append(no_num)
        ko_variants.extend(["대 " + no_paren, "소 " + no_paren])

        article_id = None
        for v in ko_variants:
            if v and v in namu_titles:
                article_id = namu_titles[v]
                break

        if not article_id:
            return set()

        # 리다이렉트 (이 문서를 가리키는 문서 제목 = 이름 변형)
        namu_cur.execute(
            "SELECT title FROM articles WHERE redirect = ? AND namespace = 0",
            (v,)
        )
        for row in namu_cur.fetchall():
            t = row[0].strip()
            if len(t) >= 2:
                names.add(t)

        # 문서 본문 첫 300자에서 '''볼드''' 텍스트 추출
        namu_cur.execute("SELECT text FROM articles WHERE id = ?", (article_id,))
        row = namu_cur.fetchone()
        if row and row[0]:
            text = row[0][:400]
            for m in re.findall(r"'''([^']{2,30})'''", text):
                m = m.strip()
                # 한국어 또는 영어 이름만 (마크업 제외)
                if re.search(r"[\uac00-\ud7a3]", m) and not m.startswith(("{", "틀", "[")):
                    names.add(m)
                elif re.search(r"[a-zA-Z]{3,}", m) and not m.startswith(("{", "틀", "[")):
                    names.add(m)

        return names

    # 3) AI 인물 로드
    print("  AI 인물 로딩...")
    ai_persons = []
    with open(AI_RAW_OUTPUT) as f:
        for line in f:
            try:
                ai_persons.append(json.loads(line.strip()))
            except:
                continue
    print(f"  AI 인물: {len(ai_persons):,}명")

    # 이름 정규화 함수
    def normalize_en(name):
        """영어 이름 정규화: 괄호 제거, 소문자"""
        name = re.sub(r'\s*\([^)]*\)', '', name)  # (Emperor Taizong) 제거
        name = re.sub(r'\s*(the|of|von|van|de|di|al-)\s+\w+$', '', name, flags=re.I)  # 접미 제거
        return name.strip().lower()

    def get_en_variants(name):
        """영어 이름 변형 생성 (다양한 표기 커버)"""
        variants = {name.lower()}
        # 괄호 제거
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        if no_paren != name:
            variants.add(no_paren.lower())
        # 괄호 안 이름도 시도
        for p in re.findall(r'\(([^)]+)\)', name):
            if not p.startswith(("active", "활동")):
                variants.add(p.lower())
        # 이니셜 제거: "J. Robert Oppenheimer" → "Robert Oppenheimer"
        no_init = re.sub(r'\b[A-Z]\.\s*', '', no_paren).strip()
        if no_init != no_paren and len(no_init) >= 3:
            variants.add(no_init.lower())
        # père/fils/junior/senior 제거
        no_gen = re.sub(r'\s+(père|p[eè]re|fils|junior|jr\.?|senior|sr\.?)$', '', no_paren, flags=re.I).strip()
        if no_gen != no_paren:
            variants.add(no_gen.lower())
        # 칭호 제거: Sir, Lord, King, Emperor, Pope, Saint, Sultan, Chhatrapati, ...
        stripped = re.sub(r'^(Sir|Lord|King|Queen|Emperor|Empress|Pope|Saint|St\.|'
                          r'Marquis de|Count|Duke|Prince|Princess|Sultan|'
                          r'Chhatrapati|Maharaja|Sheikh|Imam|Caliph)\s+',
                          '', no_paren, flags=re.I).strip()
        if stripped != no_paren:
            variants.add(stripped.lower())
            # 이니셜 제거 + 칭호 제거 조합
            stripped_no_init = re.sub(r'\b[A-Z]\.\s*', '', stripped).strip()
            if stripped_no_init != stripped:
                variants.add(stripped_no_init.lower())
        # 로마숫자/서수 제거: XIV, III, "the Great", "the Elder"
        no_suffix = re.sub(r'\s+(X{0,3}(?:IX|IV|V?I{0,3}))$', '', stripped)  # Roman
        no_suffix = re.sub(r'\s+(?:the\s+)?(Great|Elder|Younger|Bold|Fair|Wise|Pious|Good|Bad|Terrible|Confessor|Conqueror)$',
                           '', no_suffix, flags=re.I)
        if no_suffix != stripped:
            variants.add(no_suffix.lower())
        # 악센트/특수문자 정규화: Beyoncé → beyonce, Étienne → etienne
        ascii_name = _accent_normalize(no_paren)
        if ascii_name.lower() != no_paren.lower():
            variants.add(ascii_name.lower())
            # 이니셜 제거된 버전의 악센트 정규화도
            if no_init != no_paren:
                variants.add(_accent_normalize(no_init).lower())
        # 하이픈 분리: Knowles-Carter → Knowles, Carter
        if '-' in no_paren:
            for part in no_paren.split('-'):
                part = part.strip()
                if len(part) > 2:
                    variants.add(part.lower())
        # 첫 단어만 (Rembrandt van Rijn → Rembrandt)
        words = no_paren.split()
        if len(words) >= 2:
            variants.add(words[0].lower())
        # 중간이름 건너뛰기: "Frederick I Barbarossa" → "Frederick Barbarossa"
        if len(words) >= 3:
            skip_mid = (words[0] + " " + words[-1]).lower()
            variants.add(skip_mid)
        # 중간이름 없는 2단어도: 칭호 제거 버전
        stripped_words = stripped.split()
        if len(stripped_words) >= 3:
            skip_mid2 = (stripped_words[0] + " " + stripped_words[-1]).lower()
            variants.add(skip_mid2)
        return variants

    def get_ko_variants(name):
        """한국어 이름 변형 생성"""
        variants = {name}
        # 괄호 제거
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        if no_paren != name:
            variants.add(no_paren)
        # 괄호 안 내용도 시도 (주몽 (동명성왕) → 동명성왕)
        for p in re.findall(r'\(([^)]+)\)', name):
            if len(p) >= 2:
                variants.add(p)
        # 숫자/서수 제거: "클레오파트라 7세 필로파토르" → "클레오파트라"
        no_num = re.sub(r'\s+\d+세.*$', '', no_paren).strip()
        if no_num != no_paren and len(no_num) >= 2:
            variants.add(no_num)
        # 공백 앞 첫 단어만 (2글자 이상)
        first = no_paren.split()[0] if no_paren.split() else ""
        if len(first) >= 2 and first != no_paren:
            variants.add(first)
        # 대/소 접두사: "피터르 브뤼헐" → "대 피터르 브뤼헐", "소 피터르 브뤼헐"
        for prefix in ["대 ", "소 "]:
            variants.add(prefix + no_paren)
        return variants

    # 3) 매칭 (4단계: 정확→퍼지→심층퍼지→나무위키 브릿지)
    print("  매칭 중...")
    matched = 0
    unmatched = 0
    multi_match = 0
    fuzzy_matched = 0
    deep_fuzzy_matched = 0
    namu_bridged = 0

    with open(AI_MATCHED_OUTPUT, "w", encoding="utf-8") as out_f:
        for ap in ai_persons:
            name_ko = ap.get("name_ko", "")
            name_en = ap.get("name_en", "")
            birth_year = ap.get("birth_year")

            candidates = []
            match_method = "exact"

            # ── 1단계: 정확 매칭 ──
            # 한국어 이름 매칭 (우선)
            if name_ko and name_ko in wd_by_name_ko:
                candidates.extend(wd_by_name_ko[name_ko])

            # 영어 이름 매칭
            if name_en and name_en.lower() in wd_by_name_en:
                for c in wd_by_name_en[name_en.lower()]:
                    if c not in candidates:
                        candidates.append(c)

            # ── 2단계: 퍼지 매칭 (1단계 실패 시) ──
            if not candidates:
                match_method = "fuzzy"

                # 영어 이름 변형으로 시도
                if name_en:
                    en_vars = get_en_variants(name_en)
                    for variant in en_vars:
                        if variant in wd_by_name_en:
                            candidates.extend(wd_by_name_en[variant])
                    # 악센트 정규화 인덱스에서도 시도
                    if not candidates:
                        for variant in en_vars:
                            norm_v = _accent_normalize(variant)
                            if norm_v in wd_by_name_en:
                                candidates.extend(wd_by_name_en[norm_v])
                            elif norm_v in wd_by_name_en_norm:
                                candidates.extend(wd_by_name_en_norm[norm_v])

                # 한국어 이름 변형으로 시도
                if not candidates and name_ko:
                    for ko_var in get_ko_variants(name_ko):
                        if ko_var != name_ko and ko_var in wd_by_name_ko:
                            candidates.extend(wd_by_name_ko[ko_var])

            # ── 3단계: 심층 퍼지 (2단계도 실패 시) ──
            if not candidates and name_en and birth_year:
                match_method = "deep_fuzzy"
                # 성(last word) + 이름 첫글자 + 생년 ±3 조합
                clean_name = re.sub(r'\s*\([^)]*\)', '', name_en).strip()
                clean_name = re.sub(r'\s+(père|fils|jr\.?|sr\.?)$', '', clean_name, flags=re.I).strip()
                clean_name = re.sub(r'^(Sir|Lord|King|Queen|Emperor|Empress|Pope|Saint|St\.|'
                                    r'Sultan|Chhatrapati|Maharaja)\s+', '', clean_name, flags=re.I).strip()
                cwords = clean_name.split()
                if len(cwords) >= 2:
                    last_w = cwords[-1].lower()
                    first_w = cwords[0].lower()
                    first_3 = first_w[:3] if len(first_w) >= 3 else first_w
                    # 성이 4자 이상이고 last 인덱스에 있을 때만
                    if len(last_w) >= 4 and last_w in wd_by_last_en:
                        for item in wd_by_last_en[last_w]:
                            wb = item.get("birth_year")
                            if not wb or abs(wb - birth_year) > 5:
                                continue
                            # 이름 첫 3글자도 일치해야 오매칭 방지
                            wd_en_name = (item.get("name_en") or "").lower()
                            wd_first = wd_en_name.split()[0] if wd_en_name.split() else ""
                            wd_first_norm = _accent_normalize(wd_first)
                            first_3_norm = _accent_normalize(first_3)
                            if wd_first_norm.startswith(first_3_norm) or first_3_norm.startswith(wd_first_norm[:3]):
                                candidates.append(item)

            # ── 4단계: 나무위키 브릿지 (3단계도 실패 시) ──
            if not candidates and name_ko and namu_conn:
                match_method = "namu_bridge"
                namu_names = namu_bridge_names(name_ko)
                if namu_names:
                    for nn in namu_names:
                        # 한국어 이름이면 wd_ko, 영어면 wd_en에서 검색
                        if re.search(r"[\uac00-\ud7a3]", nn):
                            if nn in wd_by_name_ko:
                                candidates.extend(wd_by_name_ko[nn])
                        elif re.search(r"[a-zA-Z]{3,}", nn):
                            nl = nn.lower()
                            if nl in wd_by_name_en:
                                candidates.extend(wd_by_name_en[nl])
                    # 생년 ±10 필수 필터 (오매칭 방지)
                    if candidates and birth_year:
                        candidates = [c for c in candidates
                                     if c.get("birth_year") and abs(c["birth_year"] - birth_year) <= 10]

            if not candidates:
                unmatched += 1
                result = {**ap, "_match": "none", "_qid": None}
                out_f.write(json.dumps(result, ensure_ascii=False) + "\n")
                continue

            # 생년 매칭으로 후보 좁히기
            year_tolerance = 5 if match_method in ("fuzzy", "deep_fuzzy") else 2
            if birth_year and len(candidates) > 1:
                year_matched = []
                for c in candidates:
                    wd_birth = c.get("birth_year")
                    if wd_birth and abs(wd_birth - birth_year) <= year_tolerance:
                        year_matched.append(c)
                if year_matched:
                    candidates = year_matched

            # 중복 제거 (qid 기준)
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
                elif match_method == "deep_fuzzy":
                    deep_fuzzy_matched += 1
                elif match_method == "namu_bridge":
                    namu_bridged += 1
                result = {
                    **ap,
                    "_match": match_method,
                    "_qid": best.get("qid"),
                    "_sitelinks": best.get("sitelinks", 0),
                    "_wd_name_ko": best.get("name_ko"),
                    "_wd_name_en": best.get("name_en"),
                    "_wd_birth": best.get("birth_year"),
                    "_wd_coord": best.get("coord"),
                }
            else:
                # 여러 후보 — sitelinks 높은 것 선택
                best = max(candidates, key=lambda x: x.get("sitelinks", 0))
                multi_match += 1
                matched += 1
                if match_method == "fuzzy":
                    fuzzy_matched += 1
                elif match_method == "deep_fuzzy":
                    deep_fuzzy_matched += 1
                elif match_method == "namu_bridge":
                    namu_bridged += 1
                result = {
                    **ap,
                    "_match": f"multi_{match_method}",
                    "_candidates": len(candidates),
                    "_qid": best.get("qid"),
                    "_sitelinks": best.get("sitelinks", 0),
                    "_wd_name_ko": best.get("name_ko"),
                    "_wd_name_en": best.get("name_en"),
                    "_wd_birth": best.get("birth_year"),
                    "_wd_coord": best.get("coord"),
                }

            out_f.write(json.dumps(result, ensure_ascii=False) + "\n")

    # 나무위키 DB 닫기
    if namu_conn:
        namu_conn.close()

    print(f"\n{'='*55}")
    print(f"매칭 완료")
    print(f"  총 AI 인물: {len(ai_persons):,}")
    print(f"  매칭 성공: {matched:,} ({matched/len(ai_persons)*100:.1f}%)")
    exact = matched - multi_match - fuzzy_matched - deep_fuzzy_matched - namu_bridged
    print(f"    - 정확 매칭: {exact:,}")
    print(f"    - 퍼지 매칭: {fuzzy_matched:,}")
    print(f"    - 심층 퍼지: {deep_fuzzy_matched:,}")
    print(f"    - 나무위키 브릿지: {namu_bridged:,}")
    print(f"    - 복수 후보: {multi_match:,}")
    print(f"  매칭 실패: {unmatched:,} ({unmatched/len(ai_persons)*100:.1f}%)")
    print(f"  출력: {AI_MATCHED_OUTPUT}")


# ── 통계 ──────────────────────────────────────────────
def show_stats():
    """결과 통계"""
    if AI_RAW_OUTPUT.exists():
        count = sum(1 for _ in open(AI_RAW_OUTPUT))
        print(f"AI 선정 인물: {count:,}명 ({AI_RAW_OUTPUT})")

        # 분야별 통계
        fields = {}
        regions = {}
        with open(AI_RAW_OUTPUT) as f:
            for line in f:
                try:
                    p = json.loads(line.strip())
                    field = p.get("field", "unknown")
                    region = p.get("region", "unknown")
                    fields[field] = fields.get(field, 0) + 1
                    regions[region] = regions.get(region, 0) + 1
                except:
                    continue

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
                    p = json.loads(line.strip())
                    total += 1
                    if p.get("_match") != "none":
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
