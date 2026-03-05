#!/usr/bin/env python3
"""
[cl] AI 기반 역사적 발명·발견 선정 스크립트

Gemini API를 사용하여 시대별 주요 발명품, 기술 혁신, 과학적 발견을
선정하고, Wikidata 데이터와 QID 매칭.

발명은 인류 역사에서 수천 개 이상 존재하므로 scoreItems.py(213개)보다
훨씬 촘촘하게 선정. 청크당 15~25개.

하이브리드 모델 전략:
  - 고대 (-3000~500):  200년 청크, 15개, Gemini 2.5 Pro
  - 중세 (500~1500):   50년 청크, 15개, Gemini 2.5 Flash
  - 근세 (1500~1800):  25년 청크, 20개, Gemini 2.5 Flash
  - 근현대 (1800~2025): 10년 청크, 25개, Gemini 2.5 Flash

사용법:
  python3 scoreInventions.py                    # 전체 실행
  python3 scoreInventions.py --resume           # 이어서 실행
  python3 scoreInventions.py --test             # 테스트
  python3 scoreInventions.py --match            # Wikidata 매칭만 실행
  python3 scoreInventions.py --stats            # 결과 통계

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

# 매칭 소스 JSONL 파일들 (발명품은 여러 카테고리에 흩어져 있음)
SOURCE_JSONLS = {
    "unmatched": OUTPUT_DIR / "categories" / "unmatched.jsonl",
    "building":  OUTPUT_DIR / "categories" / "05_building.jsonl",
    "place":     OUTPUT_DIR / "categories" / "04_place.jsonl",
    "heritage":  OUTPUT_DIR / "categories" / "06_heritage.jsonl",
    "invention": OUTPUT_DIR / "categories" / "07_invention.jsonl",
}

# 출력 파일
AI_INV_DIR = OUTPUT_DIR / "ai_inventions"
AI_RAW_OUTPUT = AI_INV_DIR / "ai_inventions_raw.jsonl"
AI_MATCHED_OUTPUT = AI_INV_DIR / "ai_inventions_matched.jsonl"
PROGRESS_FILE = AI_INV_DIR / "progress.json"

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
# 발명은 인류사 전체에 걸쳐 수천 개 → 넉넉한 count
CHUNKS_CONFIG = [
    (-3000,  500, 200, 15, "gemini-2.5-pro"),    # 고대: Pro
    (  500, 1500,  50, 15, "gemini-2.5-flash"),  # 중세: Flash
    ( 1500, 1800,  25, 20, "gemini-2.5-flash"),  # 근세: Flash
    ( 1800, 2025,  10, 25, "gemini-2.5-flash"),  # 근현대: Flash
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

    return f"""당신은 과학기술사·발명사 전문 학자입니다.
{period_str} 사이에 발명/발견/개발된 역사적으로 중요한 발명품·기술·발견을 정확히 {count}개 선정해주세요.

## 핵심 원칙 — "카드 가치"
하나의 발명/발견이 특정 시간과 장소에 위치시킬 수 있고, 사용자 앞에 '카드'로 보여줄 가치가 있어야 합니다.
예: 화약→9세기 중국 ✓, 증기기관→1712년 영국 ✓, "기술 발전"→언제? 어디? ✗

## 선정 대상 (폭넓게):
- **도구/기계**: 물레방아, 인쇄기, 방적기, 증기기관, 내연기관, 재봉틀 등
- **소재/재료**: 청동, 철, 종이, 화약, 콘크리트, 플라스틱, 반도체 등
- **무기/군사**: 투석기, 석궁, 그리스 불, 대포, 기관총, 핵무기, 미사일 등
- **통신/정보**: 문자 체계, 인쇄술, 전신, 전화, 라디오, TV, 인터넷, WWW 등
- **교통/운송**: 바퀴, 마차, 범선, 증기선, 기차, 자동차, 비행기, 로켓 등
- **에너지**: 풍차, 수차, 증기, 전기, 원자력, 태양광, 핵융합 등
- **의학/보건**: 약초, 백신, 마취, 항생제, X선, DNA 구조, 유전자 편집 등
- **농업/식품**: 관개, 쟁기, 비료, 냉장, 통조림, 녹색혁명 등
- **과학적 발견**: 지동설, 만유인력, 전자기, 방사선, 상대성이론, 양자역학 등
- **측정/항해**: 해시계, 나침반, 천문의, 망원경, 현미경, 시계, GPS 등
- **건축/토목**: 아치, 돔, 시멘트, 강철 구조물, 엘리베이터 등
- **섬유/의류**: 직조, 염색, 실크, 면, 합성섬유 등
- **수학/논리**: 영(0)의 발견, 대수학, 미적분, 컴퓨터 알고리즘 등
- **우주/탐사**: 위성, 우주선, 탐사로봇, 우주정거장 등

## 제외:
- 인물 자체 (발명가가 아닌 발명품을 선정)
- 사건 (전쟁, 혁명 등) — 별도 파이프라인
- 문화 작품 (문학, 회화 등) — 별도 파이프라인
- 추상 개념 ("과학혁명", "산업화" 등 특정 시공간에 놓을 수 없는 것)
- 브랜드/제품명 (아이폰 X, 코카콜라 등 — 극히 예외적 기술 전환점 제외)

## 지역 균형:
동아시아(한국/중국/일본), 유럽, 중동, 남아시아, 동남아시아, 중앙아시아, 북아프리카, 사하라이남 아프리카, 아메리카 — 해당 시대 문명권에서 고루 선정.
단, 근현대(1800~)는 실제로 유럽/북미에 기술 혁신이 집중되므로 무리한 균형보다 역사적 정확성 우선.

## 필수 응답 형식 (JSON 배열만):
[
  {{
    "name_en": "영어 명칭 (가장 널리 알려진 표기)",
    "name_ko": "한국어 명칭",
    "year": 발명/발견 연도(정수, BC는 음수),
    "inventor": "발명가/발견자 (한국어, 모르면 null)",
    "inventor_en": "발명가/발견자 (영어, 모르면 null)",
    "origin": "발명 국가/지역 (한국어)",
    "field": "분야 (tool/material/weapon/communication/transport/energy/medicine/agriculture/science/measurement/construction/textile/math/space)",
    "region": "지역 (east_asia/europe/middle_east/south_asia/southeast_asia/central_asia/north_africa/sub_saharan/north_america/latin_america/oceania)",
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
        "maxOutputTokens": 65536 if is_pro else 16384,
    }
    if not is_pro:
        gen_config["thinkingConfig"] = {"thinkingBudget": 0}

    body = json.dumps({
        "contents": [{
            "parts": [
                {"text": "You are a history of science and technology expert. Always respond with valid JSON only."},
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
            print(f"  [Recovered] {len(recovered)} items")
        return recovered


# ── 진행 상황 관리 ─────────────────────────────────────
def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed_chunks": [], "total_inventions": 0, "last_updated": None}

def save_progress(progress):
    progress["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


# ── 메인 실행 ──────────────────────────────────────────
def run_scoring(resume=False, test_mode=False):
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    AI_INV_DIR.mkdir(parents=True, exist_ok=True)

    chunks = generate_chunks()
    models_used = set(c[3] for c in chunks)
    print(f"[cl] AI 발명·발견 선정 시작 (하이브리드)")
    print(f"  모델: {', '.join(models_used)}")
    print(f"  총 청크: {len(chunks)}개")
    print(f"  예상 발명: ~{sum(c[2] for c in chunks):,}개")

    if test_mode:
        chunks = [
            (-1000, -800, 10, "gemini-2.5-pro"),
            (1500, 1525, 15, "gemini-2.5-flash"),
            (1900, 1910, 20, "gemini-2.5-flash"),
        ]
        print(f"  [TEST MODE] {len(chunks)}개 청크 (Pro 1 + Flash 2)")

    progress = load_progress() if resume else {"completed_chunks": [], "total_inventions": 0}
    completed_set = set(tuple(c[:3]) for c in progress.get("completed_chunks", []))

    mode = "a" if resume and AI_RAW_OUTPUT.exists() else "w"
    t0 = time.time()
    session_count = 0
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
            inventions = []
            for retry in range(3):
                try:
                    raw_response = call_gemini(prompt, model=model)
                    inventions = parse_json_response(raw_response)
                except Exception as e:
                    print(f"FAIL ({e})")
                    errors += 1
                    if errors > 30:
                        print("\n[ABORT] 에러 30회 초과 — --resume로 재시작 가능")
                        break
                    break

                if len(inventions) > 0:
                    break
                if retry < 2:
                    print(f"0개(재시도 {retry+1}/2) ", end="", flush=True)
                    time.sleep(15 if "pro" in model else 5)

            if errors > 30:
                break

            if len(inventions) == 0:
                print(f"SKIP (3회 시도 후 0개)")
                errors += 1
                continue

            for inv in inventions:
                inv["_chunk"] = f"{year_from}~{year_to}"
                inv["_requested_count"] = count
                inv["_model"] = model_tag
                out_f.write(json.dumps(inv, ensure_ascii=False) + "\n")

            session_count += len(inventions)
            progress["total_inventions"] = progress.get("total_inventions", 0) + len(inventions)
            progress["completed_chunks"].append(list(chunk_key))
            completed_set.add(chunk_key)

            print(f"OK ({len(inventions)}개, 누적 {session_count:,})")

            if (i + 1) % 10 == 0:
                save_progress(progress)

            delay = 30 if "pro" in model else 4
            time.sleep(delay)

    save_progress(progress)

    elapsed = time.time() - t0
    total = progress.get("total_inventions", 0)
    print(f"\n{'='*55}")
    print(f"AI 발명·발견 선정 완료 ({elapsed/60:.1f}분)")
    print(f"  이번 세션: {session_count:,}개")
    print(f"  누적 총: {total:,}개")
    print(f"  에러: {errors}회")
    print(f"  출력: {AI_RAW_OUTPUT}")


# ── Wikidata 매칭 ──────────────────────────────────────
def run_matching():
    if not AI_RAW_OUTPUT.exists():
        print(f"ERROR: {AI_RAW_OUTPUT} 없음.")
        sys.exit(1)

    print("[cl] Wikidata 발명 매칭 시작...")

    # 1) Wikidata 소스 다중 로드
    print("  Wikidata 소스 로딩...")
    wd_by_name_ko = {}
    wd_by_name_en = {}
    wd_by_name_en_norm = {}
    wd_count = 0

    def _accent_normalize(s):
        nfkd = unicodedata.normalize('NFKD', s)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    for src_name, src_path in SOURCE_JSONLS.items():
        if not src_path.exists():
            print(f"  WARN: {src_path} 없음 — 스킵")
            continue
        src_count = 0
        with open(src_path) as f:
            for line in f:
                try:
                    item = json.loads(line.strip())
                except:
                    continue
                wd_count += 1
                src_count += 1
                item["_source_category"] = src_name
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
        print(f"    {src_name}: {src_count:,}개")

    print(f"  총 Wikidata: {wd_count:,}개 (ko={len(wd_by_name_ko):,}, en={len(wd_by_name_en):,}, norm={len(wd_by_name_en_norm):,})")

    # 2) AI 발명 로드
    print("  AI 발명 로딩...")
    ai_inventions = []
    with open(AI_RAW_OUTPUT) as f:
        for line in f:
            try:
                ai_inventions.append(json.loads(line.strip()))
            except:
                continue
    print(f"  AI 발명: {len(ai_inventions):,}개")

    # 이름 변형 생성
    def get_en_variants(name):
        variants = {name.lower()}
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        variants.add(no_paren.lower())
        for p in re.findall(r'\(([^)]+)\)', name):
            variants.add(p.lower())
        no_the = re.sub(r'^the\s+', '', no_paren, flags=re.I).strip()
        variants.add(no_the.lower())
        variants.add(f"the {no_the.lower()}")
        ascii_name = _accent_normalize(no_paren)
        if ascii_name.lower() != no_paren.lower():
            variants.add(ascii_name.lower())
        variants.add(no_paren.lower().replace("-", " ").replace("–", " "))
        if ":" in no_paren:
            before_colon = no_paren.split(":")[0].strip()
            if len(before_colon) >= 3:
                variants.add(before_colon.lower())
        if ", the" in no_paren.lower():
            fixed = re.sub(r'^(.+),\s*the$', r'the \1', no_paren, flags=re.I).strip()
            variants.add(fixed.lower())
        return variants

    def get_ko_variants(name):
        variants = {name}
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        variants.add(no_paren)
        for p in re.findall(r'\(([^)]+)\)', name):
            if len(p) >= 2:
                variants.add(p)
        no_space = no_paren.replace(" ", "")
        if no_space != no_paren:
            variants.add(no_space)
        return variants

    # 3) 매칭 (2단계: 정확→퍼지)
    print("  매칭 중...")
    matched = 0
    unmatched_count = 0
    fuzzy_matched = 0
    multi_match = 0

    with open(AI_MATCHED_OUTPUT, "w", encoding="utf-8") as out_f:
        for inv in ai_inventions:
            name_ko = inv.get("name_ko", "")
            name_en = inv.get("name_en", "")

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

            if not candidates:
                unmatched_count += 1
                result = {**inv, "_match": "none", "_qid": None}
                out_f.write(json.dumps(result, ensure_ascii=False) + "\n")
                continue

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
            else:
                best = max(candidates, key=lambda x: x.get("sitelinks", 0))
                multi_match += 1
                matched += 1
                if match_method == "fuzzy":
                    fuzzy_matched += 1

            result = {
                **inv,
                "_match": match_method if len(candidates) == 1 else f"multi_{match_method}",
                "_candidates": len(candidates) if len(candidates) > 1 else None,
                "_qid": best.get("qid"),
                "_sitelinks": best.get("sitelinks", 0),
                "_wd_name_ko": best.get("name_ko"),
                "_wd_name_en": best.get("name_en"),
                "_wd_source": best.get("_source_category", "unknown"),
            }
            out_f.write(json.dumps(result, ensure_ascii=False) + "\n")

    total = len(ai_inventions)
    print(f"\n{'='*55}")
    print(f"매칭 완료")
    print(f"  총 AI 발명: {total:,}")
    print(f"  매칭 성공: {matched:,} ({matched/total*100:.1f}%)")
    exact = matched - multi_match - fuzzy_matched
    print(f"    - 정확 매칭: {exact:,}")
    print(f"    - 퍼지 매칭: {fuzzy_matched:,}")
    print(f"    - 복수 후보: {multi_match:,}")
    print(f"  매칭 실패: {unmatched_count:,} ({unmatched_count/total*100:.1f}%)")
    print(f"  출력: {AI_MATCHED_OUTPUT}")


# ── 통계 ──────────────────────────────────────────────
def show_stats():
    if AI_RAW_OUTPUT.exists():
        count = sum(1 for _ in open(AI_RAW_OUTPUT))
        print(f"AI 선정 발명: {count:,}개 ({AI_RAW_OUTPUT})")

        fields = {}
        regions = {}
        with open(AI_RAW_OUTPUT) as f:
            for line in f:
                try:
                    inv = json.loads(line.strip())
                    fd = inv.get("field", "unknown")
                    r = inv.get("region", "unknown")
                    fields[fd] = fields.get(fd, 0) + 1
                    regions[r] = regions.get(r, 0) + 1
                except:
                    continue

        print("\n분야별:")
        for k, v in sorted(fields.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

        print("\n지역별:")
        for k, v in sorted(regions.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

    if AI_MATCHED_OUTPUT.exists():
        total = matched = 0
        with open(AI_MATCHED_OUTPUT) as f:
            for line in f:
                try:
                    inv = json.loads(line.strip())
                    total += 1
                    if inv.get("_match") != "none":
                        matched += 1
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
