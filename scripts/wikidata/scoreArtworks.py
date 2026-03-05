#!/usr/bin/env python3
"""
[cl] AI 기반 역사적 문화작품 선정 스크립트

Gemini API를 사용하여 시대별 주요 문화작품(문학, 회화, 음악, 건축, 영화 등)을
선정하고, Wikidata 89k artwork 데이터와 QID 매칭.

하이브리드 모델 전략:
  - 고대 (-3000~500):  200년 청크, 10개, Gemini 2.5 Pro
  - 중세 (500~1500):   50년 청크, 12개, Gemini 2.5 Flash
  - 근세 (1500~1800):  25년 청크, 15개, Gemini 2.5 Flash
  - 근현대 (1800~2025): 10년 청크, 20개, Gemini 2.5 Flash

사용법:
  python3 scoreArtworks.py                    # 전체 실행
  python3 scoreArtworks.py --resume           # 이어서 실행
  python3 scoreArtworks.py --test             # 테스트
  python3 scoreArtworks.py --match            # Wikidata 매칭만 실행
  python3 scoreArtworks.py --stats            # 결과 통계

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
ARTWORK_JSONL = OUTPUT_DIR / "categories" / "12_artwork.jsonl"

# 출력 파일
AI_ART_DIR = OUTPUT_DIR / "ai_artworks"
AI_RAW_OUTPUT = AI_ART_DIR / "ai_artworks_raw.jsonl"
AI_MATCHED_OUTPUT = AI_ART_DIR / "ai_artworks_matched.jsonl"
PROGRESS_FILE = AI_ART_DIR / "progress.json"

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
CHUNKS_CONFIG = [
    (-3000,  500, 200, 10, "gemini-2.5-pro"),    # 고대: Pro
    (  500, 1500,  50, 12, "gemini-2.5-flash"),  # 중세: Flash
    ( 1500, 1800,  25, 15, "gemini-2.5-flash"),  # 근세: Flash
    ( 1800, 2025,  10, 20, "gemini-2.5-flash"),  # 근현대: Flash
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

    return f"""당신은 세계 문화사·예술사 전문 학자입니다.
{period_str} 사이에 창작/완성된 역사적으로 중요한 문화 작품을 정확히 {count}개 선정해주세요.

## 선정 기준 (역사적·문화적 영향력 중심):
- 문학: 서사시, 소설, 희곡, 시, 경전, 역사서 (인류 사상에 영향을 준 작품)
- 회화/조각: 미술사의 전환점이 된 작품, 시대를 대표하는 걸작
- 건축: 기념비적 건축물, 세계유산급 구조물 (피라미드, 성당 등)
- 음악: 클래식 작곡, 오페라, 혁신적 앨범 (대중음악은 문화적 전환점만)
- 영화: 영화사의 이정표가 된 작품 (흥행이 아닌 문화적 영향력 기준)
- 과학/사상 저술: 프린키피아, 자본론 등 세계사를 바꾼 저작물
- 종교 경전: 각 종교의 핵심 텍스트

## 제외:
- 단순 인기/흥행작 (역사적 의미 없는 히트곡, 블록버스터)
- TV 드라마, 비디오 게임 (극히 예외적인 문화 현상 제외)
- 동일 작가의 유사 작품 반복 (가장 대표작 1개만)

## 지역 균형:
동아시아(한국/중국/일본), 유럽, 중동, 남아시아, 동남아시아, 중앙아시아, 북아프리카, 사하라이남 아프리카, 아메리카 — 해당 시대 문명권에서 고루 선정.

## 필수 응답 형식 (JSON 배열만):
[
  {{
    "name_en": "영어 제목 (가장 널리 알려진 표기)",
    "name_ko": "한국어 제목",
    "year": 창작/완성 연도(정수, BC는 음수),
    "creator": "창작자 이름 (한국어)",
    "creator_en": "창작자 이름 (영어)",
    "origin": "창작 국가/지역 (한국어)",
    "medium": "매체 (literature/painting/sculpture/architecture/music/film/religious_text/philosophy/science)",
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
                {"text": "You are a world culture and art history expert. Always respond with valid JSON only."},
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
    return {"completed_chunks": [], "total_artworks": 0, "last_updated": None}

def save_progress(progress):
    progress["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


# ── 메인 실행 ──────────────────────────────────────────
def run_scoring(resume=False, test_mode=False):
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    AI_ART_DIR.mkdir(parents=True, exist_ok=True)

    chunks = generate_chunks()
    models_used = set(c[3] for c in chunks)
    print(f"[cl] AI 문화작품 선정 시작 (하이브리드)")
    print(f"  모델: {', '.join(models_used)}")
    print(f"  총 청크: {len(chunks)}개")
    print(f"  예상 작품: ~{sum(c[2] for c in chunks):,}개")

    if test_mode:
        chunks = [
            (-800, -600, 8, "gemini-2.5-pro"),
            (1500, 1525, 12, "gemini-2.5-flash"),
            (1900, 1910, 15, "gemini-2.5-flash"),
        ]
        print(f"  [TEST MODE] {len(chunks)}개 청크 (Pro 1 + Flash 2)")

    progress = load_progress() if resume else {"completed_chunks": [], "total_artworks": 0}
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
            artworks = []
            for retry in range(3):
                try:
                    raw_response = call_gemini(prompt, model=model)
                    artworks = parse_json_response(raw_response)
                except Exception as e:
                    print(f"FAIL ({e})")
                    errors += 1
                    if errors > 30:
                        print("\n[ABORT] 에러 30회 초과 — --resume로 재시작 가능")
                        break
                    break

                if len(artworks) > 0:
                    break
                if retry < 2:
                    print(f"0개(재시도 {retry+1}/2) ", end="", flush=True)
                    time.sleep(15 if "pro" in model else 5)

            if errors > 30:
                break

            if len(artworks) == 0:
                print(f"SKIP (3회 시도 후 0개)")
                errors += 1
                continue

            for art in artworks:
                art["_chunk"] = f"{year_from}~{year_to}"
                art["_requested_count"] = count
                art["_model"] = model_tag
                out_f.write(json.dumps(art, ensure_ascii=False) + "\n")

            session_count += len(artworks)
            progress["total_artworks"] = progress.get("total_artworks", 0) + len(artworks)
            progress["completed_chunks"].append(list(chunk_key))
            completed_set.add(chunk_key)

            print(f"OK ({len(artworks)}개, 누적 {session_count:,})")

            if (i + 1) % 10 == 0:
                save_progress(progress)

            delay = 30 if "pro" in model else 4
            time.sleep(delay)

    save_progress(progress)

    elapsed = time.time() - t0
    total = progress.get("total_artworks", 0)
    print(f"\n{'='*55}")
    print(f"AI 문화작품 선정 완료 ({elapsed/60:.1f}분)")
    print(f"  이번 세션: {session_count:,}개")
    print(f"  누적 총: {total:,}개")
    print(f"  에러: {errors}회")
    print(f"  출력: {AI_RAW_OUTPUT}")


# ── Wikidata 매칭 ──────────────────────────────────────
def run_matching():
    if not AI_RAW_OUTPUT.exists():
        print(f"ERROR: {AI_RAW_OUTPUT} 없음.")
        sys.exit(1)

    print("[cl] Wikidata 작품 매칭 시작...")

    # 1) Wikidata artwork 로드
    print("  Wikidata 작품 로딩...")
    wd_by_name_ko = {}
    wd_by_name_en = {}
    wd_by_name_en_norm = {}
    wd_count = 0

    def _accent_normalize(s):
        nfkd = unicodedata.normalize('NFKD', s)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    if not ARTWORK_JSONL.exists():
        print(f"  ERROR: {ARTWORK_JSONL} 없음.")
        sys.exit(1)

    with open(ARTWORK_JSONL) as f:
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

            if wd_count % 50_000 == 0:
                print(f"    ... {wd_count:,}")

    print(f"  Wikidata: {wd_count:,}개 로드 (ko={len(wd_by_name_ko):,}, en={len(wd_by_name_en):,}, norm={len(wd_by_name_en_norm):,})")

    # 2) AI 작품 로드
    print("  AI 작품 로딩...")
    ai_artworks = []
    with open(AI_RAW_OUTPUT) as f:
        for line in f:
            try:
                ai_artworks.append(json.loads(line.strip()))
            except:
                continue
    print(f"  AI 작품: {len(ai_artworks):,}개")

    # 이름 변형 생성
    def get_en_variants(name):
        variants = {name.lower()}
        no_paren = re.sub(r'\s*\([^)]*\)', '', name).strip()
        variants.add(no_paren.lower())
        for p in re.findall(r'\(([^)]+)\)', name):
            variants.add(p.lower())
        # "The" 제거/추가
        no_the = re.sub(r'^the\s+', '', no_paren, flags=re.I).strip()
        variants.add(no_the.lower())
        variants.add(f"the {no_the.lower()}")
        # 악센트 정규화
        ascii_name = _accent_normalize(no_paren)
        if ascii_name.lower() != no_paren.lower():
            variants.add(ascii_name.lower())
        # 하이픈/대시
        variants.add(no_paren.lower().replace("-", " ").replace("–", " "))
        # 콜론 앞만: "Star Wars: A New Hope" → "Star Wars"
        if ":" in no_paren:
            before_colon = no_paren.split(":")[0].strip()
            if len(before_colon) >= 3:
                variants.add(before_colon.lower())
        # ", The" → "The ..."
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
        # 공백 제거
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
        for art in ai_artworks:
            name_ko = art.get("name_ko", "")
            name_en = art.get("name_en", "")
            year = art.get("year")

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
                result = {**art, "_match": "none", "_qid": None}
                out_f.write(json.dumps(result, ensure_ascii=False) + "\n")
                continue

            # 연도 필터
            if year and len(candidates) > 1:
                year_matched = []
                for c in candidates:
                    wd_year = c.get("inception") or c.get("start_year")
                    if wd_year and abs(wd_year - year) <= 10:
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
            else:
                best = max(candidates, key=lambda x: x.get("sitelinks", 0))
                multi_match += 1
                matched += 1
                if match_method == "fuzzy":
                    fuzzy_matched += 1

            result = {
                **art,
                "_match": match_method if len(candidates) == 1 else f"multi_{match_method}",
                "_candidates": len(candidates) if len(candidates) > 1 else None,
                "_qid": best.get("qid"),
                "_sitelinks": best.get("sitelinks", 0),
                "_wd_name_ko": best.get("name_ko"),
                "_wd_name_en": best.get("name_en"),
                "_wd_year": best.get("inception") or best.get("start_year"),
            }
            out_f.write(json.dumps(result, ensure_ascii=False) + "\n")

    total = len(ai_artworks)
    print(f"\n{'='*55}")
    print(f"매칭 완료")
    print(f"  총 AI 작품: {total:,}")
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
        print(f"AI 선정 작품: {count:,}개 ({AI_RAW_OUTPUT})")

        mediums = {}
        regions = {}
        with open(AI_RAW_OUTPUT) as f:
            for line in f:
                try:
                    art = json.loads(line.strip())
                    m = art.get("medium", "unknown")
                    r = art.get("region", "unknown")
                    mediums[m] = mediums.get(m, 0) + 1
                    regions[r] = regions.get(r, 0) + 1
                except:
                    continue

        print("\n매체별:")
        for k, v in sorted(mediums.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

        print("\n지역별:")
        for k, v in sorted(regions.items(), key=lambda x: -x[1]):
            print(f"  {k:20s} {v:6,}")

    if AI_MATCHED_OUTPUT.exists():
        total = matched = 0
        with open(AI_MATCHED_OUTPUT) as f:
            for line in f:
                try:
                    art = json.loads(line.strip())
                    total += 1
                    if art.get("_match") != "none":
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
