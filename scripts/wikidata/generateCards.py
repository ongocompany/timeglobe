#!/usr/bin/env python3
"""
generateCards.py — QID 매칭 항목 → Wikipedia fetch → AI 카드 생성
모든 카테고리(persons, events, artworks, inventions, items) 처리
Gemini 3 Flash 또는 Qwen 3.5-Plus 선택 가능

Usage:
  python3 generateCards.py --category persons --model qwen
  python3 generateCards.py --category persons --model gemini --resume
  python3 generateCards.py --category persons --test 10
  python3 generateCards.py --category all --model qwen
  python3 generateCards.py --stats
"""
import json, os, time, argparse, urllib.request, urllib.error, urllib.parse
from pathlib import Path
from datetime import datetime

# ── 설정 ──────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent

# .env.local 직접 파싱 (jinserver에 pip 없음)
env_path = PROJECT_ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# API 설정 (모델별로 main()에서 세팅)
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODEL = "gemini-3-flash-preview"

QWEN_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_BASE = os.environ.get("QWEN_API_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
QWEN_MODEL = os.environ.get("QWEN_MODEL", "qwen3.5-plus")

# 런타임에 설정됨
API_KEY = ""
MODEL = ""
MODEL_PROVIDER = "gemini"  # "gemini" or "qwen"

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
CARD_DIR = OUTPUT_DIR / "cards"
CATEGORIES = ["persons", "events", "artworks", "inventions", "items"]

# 카테고리별 입력 파일 (final/ 최종 리스트)
FINAL_DIR = OUTPUT_DIR / "final"
INPUT_FILES = {
    cat: FINAL_DIR / f"{cat}.jsonl"
    for cat in CATEGORIES
}

GEMINI_DELAY = 1  # seconds between Gemini calls (paid: 1000 RPM)
MAX_RETRIES = 3


# ── Wikipedia 가져오기 ────────────────────────────────

def get_wiki_sitelink(qid, lang="ko"):
    """Wikidata QID → (wiki_title, wiki_lang) 또는 (None, None)"""
    wd_url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    req = urllib.request.Request(wd_url, headers={"User-Agent": "TimeGlobe/1.0"})
    resp = urllib.request.urlopen(req, timeout=15)
    wd_data = json.loads(resp.read())
    entity = wd_data["entities"][qid]

    sitelinks = entity.get("sitelinks", {})
    if f"{lang}wiki" in sitelinks:
        return sitelinks[f"{lang}wiki"]["title"], lang
    elif "enwiki" in sitelinks:
        return sitelinks["enwiki"]["title"], "en"
    return None, None


def fetch_wikipedia_full(qid, lang="ko", max_chars=6000):
    """Wikidata QID → Wikipedia 전체 본문 (앞부분)"""
    try:
        wiki_title, wiki_lang = get_wiki_sitelink(qid, lang)
        if not wiki_title:
            return None, None

        params = urllib.parse.urlencode({
            "action": "query",
            "titles": wiki_title,
            "prop": "extracts",
            "explaintext": "1",
            "exlimit": "1",
            "format": "json",
        })
        mw_url = f"https://{wiki_lang}.wikipedia.org/w/api.php?{params}"
        req = urllib.request.Request(mw_url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        mw_data = json.loads(resp.read())

        pages = mw_data.get("query", {}).get("pages", {})
        for page in pages.values():
            text = page.get("extract", "")
            if text and len(text) >= 100:
                return text[:max_chars], wiki_lang
        return None, None

    except Exception as e:
        print(f"  [wiki err] {e}")
        return None, None


def fetch_wikipedia_meta(qid, wiki_lang="ko"):
    """Wikipedia 썸네일, URL 가져오기 (summary API)"""
    try:
        wiki_title, wl = get_wiki_sitelink(qid, wiki_lang)
        if not wiki_title:
            return "", ""

        title_encoded = urllib.parse.quote(wiki_title)
        url = f"https://{wl}.wikipedia.org/api/rest_v1/page/summary/{title_encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())

        thumbnail = data.get("thumbnail", {}).get("source", "")
        wiki_url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
        return thumbnail, wiki_url

    except Exception:
        return "", ""


# ── 카테고리별 프롬프트 ──────────────────────────────

CARD_SCHEMA = '''{
  "description_ko": "한국어 설명 (사실 기반, 100~400자. 짧아도 된다)",
  "description_en": "English description (2~3 sentences max)",
  "key_achievements": ["업적 1~3개, 각 20자 이내"],
  "related_events": ["관련 사건 1~3개, 각 15자 이내"],
  "era_context": "시대 맥락 한 줄 50자 이내 (모르면 빈 문자열)",
  "fun_fact": "흥미로운 사실 한 줄 50자 이내 (없으면 빈 문자열)"
}'''

CATEGORY_INSTRUCTIONS = {
    "persons": {
        "subject": "역사 인물",
        "desc_guide": "이 인물의 생애, 주요 업적, 역사적 의의를 간결하게 서술하라.",
        "info_builder": lambda d: (
            f"- 이름: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 생몰년: {d.get('birth_year', '?')} ~ {d.get('death_year', '?')}\n"
            f"- 역할: {d.get('role', '')}\n"
            f"- 분야: {d.get('field', '')}\n"
            f"- 지역: {d.get('birth_place', d.get('region', ''))}"
        ),
    },
    "events": {
        "subject": "역사적 사건",
        "desc_guide": "이 사건의 배경, 전개 과정, 결과, 역사적 영향을 간결하게 서술하라.",
        "info_builder": lambda d: (
            f"- 사건명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 시기: {d.get('start_year', '?')} ~ {d.get('end_year', '?')}\n"
            f"- 장소: {d.get('location', '')}\n"
            f"- 유형: {d.get('type', '')}\n"
            f"- 분야: {d.get('field', '')}\n"
            f"- 참여자: {d.get('participants', '')}"
        ),
    },
    "artworks": {
        "subject": "예술 작품 / 문화유산",
        "desc_guide": "이 작품의 창작 배경, 예술적 특징, 문화사적 의의를 간결하게 서술하라.",
        "info_builder": lambda d: (
            f"- 작품명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 작가: {d.get('creator', '')} ({d.get('creator_en', '')})\n"
            f"- 매체: {d.get('medium', '')}\n"
            f"- 출처: {d.get('origin', '')}"
        ),
    },
    "inventions": {
        "subject": "발명 / 기술 혁신",
        "desc_guide": "이 발명의 배경, 핵심 개념, 사회적·기술적 영향을 간결하게 서술하라.",
        "info_builder": lambda d: (
            f"- 발명명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 발명가: {d.get('inventor', '')} ({d.get('inventor_en', '')})\n"
            f"- 분야: {d.get('field', '')}\n"
            f"- 출처: {d.get('origin', '')}"
        ),
    },
    "items": {
        "subject": "역사적 유물 / 아이템",
        "desc_guide": "이 유물의 기원, 특징, 발견 경위, 역사적·문화적 의의를 간결하게 서술하라.",
        "info_builder": lambda d: (
            f"- 유물명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 유형: {d.get('item_type', '')}\n"
            f"- 출처: {d.get('origin', '')}"
        ),
    },
}


def build_card_prompt(category, item, wiki_text):
    """카테고리별 카드 생성 프롬프트"""
    cfg = CATEGORY_INSTRUCTIONS[category]
    info_text = cfg["info_builder"](item)

    return f"""너는 세계사 백과사전 편집자이다.
아래 Wikipedia 본문을 읽고 카드 콘텐츠를 작성하라. 유효한 JSON만 출력하라.

## 절대 규칙
1. 확실히 아는 사실만 써라. 추측, 상상, 과장 절대 금지.
2. description_ko는 평서문으로 써라. ("~이다", "~했다", "~되었다") 경어체 절대 금지.
3. description_ko는 100~400자. 짧아도 된다. 400자 넘기면 잘린다.
4. 모르는 필드는 빈 문자열("")이나 빈 배열([])로 남겨라.

대상 유형: {cfg["subject"]}
서술 방향: {cfg["desc_guide"]}

{cfg["subject"]} 정보:
{info_text}

출력 형식:
{CARD_SCHEMA}

Wikipedia 본문:
{wiki_text}
"""


# ── Gemini API ────────────────────────────────────────

def call_llm(prompt):
    """LLM API 호출 — Gemini / Qwen 자동 분기 (재시도 포함)"""
    if MODEL_PROVIDER == "qwen":
        return _call_qwen(prompt)
    return _call_gemini(prompt)


def _call_gemini(prompt):
    url = f"{GEMINI_BASE}/{MODEL}:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096,
                              "thinkingConfig": {"thinkingBudget": 0}},
    })

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, data=body.encode(), headers=headers)
            resp = urllib.request.urlopen(req, timeout=120)
            data = json.loads(resp.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            if e.code == 429:
                wait = (attempt + 1) * 15
                print(f"  ⏳ Rate limit, {wait}s 대기... (시도 {attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            print(f"  ✗ API error {e.code}: {err_body[:200]}")
            return None
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(5)
                continue
            print(f"  ✗ Error: {e}")
            return None
    return None


def _call_qwen(prompt):
    url = f"{QWEN_BASE}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4096,
    })

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, data=body.encode(), headers=headers)
            resp = urllib.request.urlopen(req, timeout=120)
            data = json.loads(resp.read())
            text = data["choices"][0]["message"]["content"]
            # Qwen thinking 태그 제거
            if "<think>" in text:
                parts = text.split("</think>")
                text = parts[-1].strip() if len(parts) > 1 else text
            return text
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            if e.code == 429:
                wait = (attempt + 1) * 10
                print(f"  ⏳ Rate limit, {wait}s 대기... (시도 {attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            print(f"  ✗ API error {e.code}: {err_body[:200]}")
            return None
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(5)
                continue
            print(f"  ✗ Error: {e}")
            return None
    return None


def parse_json_response(text):
    """LLM 응답에서 JSON 추출"""
    if not text:
        return None
    if "```json" in text:
        text = text.split("```json", 1)[1]
        if "```" in text:
            text = text.rsplit("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1]
        if "```" in text:
            text = text.rsplit("```", 1)[0]

    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        return None


# ── 메타데이터 빌더 ──────────────────────────────────

def build_card_meta(category, item, thumbnail, wiki_url, wiki_lang):
    """카테고리별 메타데이터 추가"""
    meta = {
        "_qid": item.get("qid", ""),
        "_name_ko": item.get("name_ko", ""),
        "_name_en": item.get("name_en", ""),
        "_region": item.get("region", ""),
        "_thumbnail": thumbnail,
        "_wiki_url": wiki_url,
        "_wiki_lang": wiki_lang,
        "_model": MODEL,
        "_category": category,
        "_generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    if category == "persons":
        meta["_birth_year"] = item.get("birth_year")
        meta["_death_year"] = item.get("death_year")
        meta["_role"] = item.get("role", "")
        meta["_field"] = item.get("field", "")
    elif category == "events":
        meta["_start_year"] = item.get("start_year")
        meta["_end_year"] = item.get("end_year")
        meta["_type"] = item.get("type", "")
    elif category == "artworks":
        meta["_year"] = item.get("year")
        meta["_creator"] = item.get("creator", "")
        meta["_medium"] = item.get("medium", "")
    elif category == "inventions":
        meta["_year"] = item.get("year")
        meta["_inventor"] = item.get("inventor", "")
        meta["_field"] = item.get("field", "")
    elif category == "items":
        meta["_year"] = item.get("year")
        meta["_item_type"] = item.get("item_type", "")

    return meta


# ── 진행 상황 관리 ────────────────────────────────────

def get_progress_path(category):
    return CARD_DIR / category / "progress.json"


def get_output_path(category):
    return CARD_DIR / category / f"cards_{category}.jsonl"


def load_progress(category):
    path = get_progress_path(category)
    if path.exists():
        return json.loads(path.read_text())
    return {"processed_qids": [], "success": 0, "fail_wiki": 0, "fail_ai": 0}


def save_progress(category, progress):
    path = get_progress_path(category)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(progress, ensure_ascii=False))


# ── 메인 처리 ────────────────────────────────────────

def process_category(category, test_limit=0, resume=False):
    """카테고리별 카드 생성"""
    input_file = INPUT_FILES[category]
    if not input_file.exists():
        print(f"✗ 입력 파일 없음: {input_file}")
        return

    # 데이터 로드
    items = []
    with open(input_file) as f:
        for line in f:
            try:
                d = json.loads(line.strip())
            except Exception:
                continue
            qid = d.get("qid")
            if qid and qid.startswith("Q"):
                items.append(d)

    print(f"\n{'='*60}")
    print(f"카테고리: {category} ({len(items)}건)")
    print(f"모델: {MODEL}")
    print(f"{'='*60}")

    # 진행 상황
    progress = load_progress(category) if resume else {
        "processed_qids": [], "success": 0, "fail_wiki": 0, "fail_ai": 0
    }
    processed_set = set(progress["processed_qids"])

    if resume and processed_set:
        print(f"이어하기: {len(processed_set)}건 완료, {len(items) - len(processed_set)}건 남음")

    # 출력 준비
    output_path = get_output_path(category)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if resume and output_path.exists() else "w"

    # 테스트 모드
    if test_limit > 0:
        remaining = [it for it in items if it["qid"] not in processed_set]
        items_to_process = remaining[:test_limit]
    else:
        items_to_process = [it for it in items if it["qid"] not in processed_set]

    total = len(items_to_process)
    if total == 0:
        print("처리할 항목 없음")
        return

    print(f"처리 대상: {total}건")
    est_hours = total * (GEMINI_DELAY + 4) / 3600  # ~6s per item
    print(f"예상 소요: ~{est_hours:.1f}시간\n")

    start_time = time.time()

    with open(output_path, mode) as outf:
        for i, item in enumerate(items_to_process):
            qid = item["qid"]
            name = item.get("name_ko", item.get("name_en", "?"))
            print(f"[{i+1}/{total}] {name} ({qid})")

            # 1) Wikipedia 본문 fetch
            wiki_text, wiki_lang = fetch_wikipedia_full(qid, "ko", max_chars=6000)
            if not wiki_text:
                wiki_text, wiki_lang = fetch_wikipedia_full(qid, "en", max_chars=6000)
            if not wiki_text:
                # ko/en 둘 다 본문 부족 — 건너뜀
                wiki_lang = wiki_lang or "ko"

            if not wiki_text:
                print(f"  ✗ Wikipedia 본문 없음")
                progress["fail_wiki"] += 1
                progress["processed_qids"].append(qid)
                if (i + 1) % 50 == 0:
                    save_progress(category, progress)
                continue

            print(f"  → Wikipedia ({wiki_lang}): {len(wiki_text)} chars")

            # 2) 썸네일/URL 가져오기
            thumbnail, wiki_url = fetch_wikipedia_meta(qid, wiki_lang)

            # 3) Gemini 카드 생성
            prompt = build_card_prompt(category, item, wiki_text)
            t0 = time.time()
            raw_response = call_llm(prompt)
            elapsed = time.time() - t0

            card = parse_json_response(raw_response)
            if card:
                # description_ko 400자 후처리 (LLM이 정확히 못 지킴)
                desc = card.get("description_ko", "")
                if len(desc) > 420:
                    # 400자 이내 마지막 마침표에서 자르기
                    cut = desc[:400].rfind(".")
                    if cut > 250:
                        card["description_ko"] = desc[:cut+1]
                    else:
                        card["description_ko"] = desc[:400]

                # 메타데이터 병합
                meta = build_card_meta(category, item, thumbnail, wiki_url, wiki_lang)
                card.update(meta)

                outf.write(json.dumps(card, ensure_ascii=False) + "\n")
                outf.flush()
                progress["success"] += 1

                desc = card.get("description_ko", "")
                print(f"  ✓ 카드 생성 ({elapsed:.1f}s, {len(desc)}자)")
            else:
                progress["fail_ai"] += 1
                print(f"  ✗ AI 가공 실패 ({elapsed:.1f}s)")
                if raw_response:
                    print(f"    응답: {raw_response[:100]}...")

            progress["processed_qids"].append(qid)

            # 진행 상황 저장 (50건마다 + 마지막)
            if (i + 1) % 50 == 0 or (i + 1) == total:
                save_progress(category, progress)
                elapsed_total = time.time() - start_time
                rate = (i + 1) / elapsed_total if elapsed_total > 0 else 0
                remaining_est = (total - i - 1) / rate / 60 if rate > 0 else 0
                print(f"  --- 진행: {i+1}/{total} | "
                      f"성공: {progress['success']} | "
                      f"위키실패: {progress['fail_wiki']} | "
                      f"AI실패: {progress['fail_ai']} | "
                      f"남은시간: ~{remaining_est:.0f}분 ---")

            # rate limit 대기
            time.sleep(GEMINI_DELAY)

    # 최종 저장
    save_progress(category, progress)

    print(f"\n{'='*60}")
    print(f"=== {category} 완료 ===")
    print(f"성공: {progress['success']}")
    print(f"Wikipedia 실패: {progress['fail_wiki']}")
    print(f"AI 가공 실패: {progress['fail_ai']}")
    print(f"출력: {output_path}")
    print(f"{'='*60}")


def show_stats():
    """전체 통계"""
    print(f"\n{'='*60}")
    print(f"=== 카드 생성 통계 ===")
    print(f"{'='*60}")

    for cat in CATEGORIES:
        input_file = INPUT_FILES[cat]
        output_path = get_output_path(cat)
        progress = load_progress(cat)

        total_input = 0
        if input_file.exists():
            with open(input_file) as f:
                total_input = sum(1 for l in f if l.strip())

        total_output = 0
        if output_path.exists():
            with open(output_path) as f:
                total_output = sum(1 for l in f if l.strip())

        print(f"\n{cat}:")
        print(f"  입력: {total_input}건")
        print(f"  생성: {total_output}건")
        print(f"  성공: {progress.get('success', 0)}")
        print(f"  위키실패: {progress.get('fail_wiki', 0)}")
        print(f"  AI실패: {progress.get('fail_ai', 0)}")
        remaining = total_input - len(progress.get("processed_qids", []))
        print(f"  남은: {remaining}건")


# ── CLI ───────────────────────────────────────────────

def main():
    global GEMINI_DELAY, API_KEY, MODEL, MODEL_PROVIDER

    parser = argparse.ArgumentParser(description="카드 콘텐츠 생성 (Wikipedia → AI)")
    parser.add_argument("--category", choices=CATEGORIES + ["all"], default="persons",
                        help="처리할 카테고리 (default: persons)")
    parser.add_argument("--model", choices=["gemini", "qwen"], default="gemini",
                        help="사용할 모델 (default: gemini)")
    parser.add_argument("--resume", action="store_true", help="이전 진행 이어서")
    parser.add_argument("--test", type=int, default=0, help="테스트 모드 (N건만 처리)")
    parser.add_argument("--stats", action="store_true", help="전체 통계 출력")
    parser.add_argument("--delay", type=float, default=-1,
                        help="AI 호출 간 대기 (default: gemini=2, qwen=1)")
    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    # 모델 설정
    MODEL_PROVIDER = args.model
    if MODEL_PROVIDER == "qwen":
        API_KEY = QWEN_KEY
        MODEL = QWEN_MODEL
        GEMINI_DELAY = args.delay if args.delay >= 0 else 1
    else:
        API_KEY = GEMINI_KEY
        MODEL = GEMINI_MODEL
        GEMINI_DELAY = args.delay if args.delay >= 0 else 1

    if not API_KEY:
        print(f"✗ API 키 없음: {'QWEN_API_KEY' if MODEL_PROVIDER == 'qwen' else 'GEMINI_API_KEY'} 설정 필요")
        return

    print(f"API 키: ...{API_KEY[-8:]}")
    print(f"모델: {MODEL} ({MODEL_PROVIDER})")
    print(f"딜레이: {GEMINI_DELAY}s")

    if args.category == "all":
        for cat in CATEGORIES:
            process_category(cat, test_limit=args.test, resume=args.resume)
    else:
        process_category(args.category, test_limit=args.test, resume=args.resume)


if __name__ == "__main__":
    main()
