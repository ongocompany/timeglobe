#!/usr/bin/env python3
"""
[cl] generateDirectCards.py — QID 미매칭 항목 → AI 직접생성 카드
Wikipedia 없이 Gemini 3 Flash가 자체 지식으로 카드 콘텐츠 작성.
GEMINI_CARD_KEY 사용 (generateCards.py와 병렬 실행 가능)

Usage:
  python3 generateDirectCards.py --category persons
  python3 generateDirectCards.py --category all --resume
  python3 generateDirectCards.py --category events --test 10
  python3 generateDirectCards.py --stats
"""
import json, os, sys, time, argparse, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime

# ── 설정 ──────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent

# .env.local 직접 파싱
env_path = PROJECT_ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# GEMINI_CARD_KEY 사용 (generateCards.py는 GEMINI_API_KEY 사용)
API_KEY = os.environ.get("GEMINI_CARD_KEY", "")
MODEL = "gemini-3-flash-preview"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
ARCHIVE_DIR = OUTPUT_DIR / "archive"
CARD_DIR = OUTPUT_DIR / "cards_direct"
CATEGORIES = ["persons", "events", "artworks", "inventions", "items"]

DELAY = 1  # seconds between calls
MAX_RETRIES = 3

# ── 토큰 카운터 ──
total_tokens = 0
total_calls = 0


# ── 카테고리별 포맷터 + 프롬프트 ──────────────────────

CATEGORY_CONFIG = {
    "persons": {
        "subject": "역사 인물",
        "desc_guide": "이 인물의 생애, 주요 업적, 역사적 의의를 간결하게 서술하라.",
        "formatter": lambda d: (
            f"- 이름: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 생몰년: {d.get('birth_year', '?')} ~ {d.get('death_year', '?')}\n"
            f"- 역할: {d.get('role', '')}\n"
            f"- 분야: {d.get('field', '')}\n"
            f"- 활동지역: {d.get('active_country', d.get('birth_place', ''))}\n"
            f"- 국적: {d.get('nationality', '')}\n"
            f"- 요약: {d.get('significance', '')}"
        ),
    },
    "events": {
        "subject": "역사적 사건",
        "desc_guide": "이 사건의 배경, 전개 과정, 결과, 역사적 영향을 간결하게 서술하라.",
        "formatter": lambda d: (
            f"- 사건명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 시기: {d.get('start_year', '?')} ~ {d.get('end_year', '?')}\n"
            f"- 장소: {d.get('location', '')}\n"
            f"- 유형: {d.get('type', '')}\n"
            f"- 참여자: {d.get('participants', '')}\n"
            f"- 요약: {d.get('significance', '')}"
        ),
    },
    "artworks": {
        "subject": "예술 작품 / 문화유산",
        "desc_guide": "이 작품의 창작 배경, 예술적 특징, 문화사적 의의를 간결하게 서술하라.",
        "formatter": lambda d: (
            f"- 작품명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 작가: {d.get('creator', '')} ({d.get('creator_en', '')})\n"
            f"- 매체: {d.get('medium', '')}\n"
            f"- 출처: {d.get('origin', '')}\n"
            f"- 요약: {d.get('significance', '')}"
        ),
    },
    "inventions": {
        "subject": "발명 / 기술 혁신",
        "desc_guide": "이 발명의 배경, 핵심 개념, 사회적·기술적 영향을 간결하게 서술하라.",
        "formatter": lambda d: (
            f"- 발명명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 발명가: {d.get('inventor', '')} ({d.get('inventor_en', '')})\n"
            f"- 분야: {d.get('field', '')}\n"
            f"- 출처: {d.get('origin', '')}\n"
            f"- 요약: {d.get('significance', '')}"
        ),
    },
    "items": {
        "subject": "역사적 유물 / 아이템",
        "desc_guide": "이 유물의 기원, 특징, 발견 경위, 역사적·문화적 의의를 간결하게 서술하라.",
        "formatter": lambda d: (
            f"- 유물명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
            f"- 연도: {d.get('year', '?')}\n"
            f"- 유형: {d.get('item_type', '')}\n"
            f"- 출처: {d.get('origin', '')}\n"
            f"- 요약: {d.get('significance', '')}"
        ),
    },
}

CARD_SCHEMA = '''{
  "description_ko": "한국어 설명 (사실 기반, 100~400자. 짧아도 된다)",
  "description_en": "English description (2~3 sentences max)",
  "key_achievements": ["업적 1~3개, 각 20자 이내"],
  "related_events": ["관련 사건 1~3개, 각 15자 이내"],
  "era_context": "시대 맥락 한 줄 50자 이내 (모르면 빈 문자열)",
  "fun_fact": "흥미로운 사실 한 줄 50자 이내 (없으면 빈 문자열)"
}'''


def build_prompt(category, item):
    cfg = CATEGORY_CONFIG[category]
    info_text = cfg["formatter"](item)

    return f"""너는 세계사 백과사전 편집자이다.
아래 역사적 항목의 카드 콘텐츠를 작성하라. 유효한 JSON만 출력하라.

## 절대 규칙
1. 확실히 아는 사실만 써라. 추측, 상상, 과장 절대 금지.
2. 정보가 부족하면 아는 만큼만 짧게 써라. 100자여도 괜찮다.
3. 모르는 필드는 빈 문자열("")이나 빈 배열([])로 남겨라.
4. description_ko는 평서문으로 써라. ("~이다", "~했다", "~되었다") 경어체 절대 금지.
5. "~로 알려져 있다", "~한 것으로 추정된다" 같은 불확실한 표현은 OK.

대상 유형: {cfg["subject"]}
서술 방향: {cfg["desc_guide"]}

## 항목 정보
{info_text}

## 출력 형식 (JSON)
{CARD_SCHEMA}"""


# ── Gemini API ────────────────────────────────────────

def call_gemini(prompt):
    global total_tokens, total_calls
    url = f"{GEMINI_BASE}/{MODEL}:generateContent?key={API_KEY}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096,
                              "thinkingConfig": {"thinkingBudget": 0}},
    }).encode()

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, data=body,
                                        headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
                usage = data.get("usageMetadata", {})
                total_tokens += usage.get("totalTokenCount", 0)
                total_calls += 1
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            if e.code == 429:
                wait = (attempt + 1) * 15
                print(f"  rate limit, {wait}s 대기... ({attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            print(f"  API error {e.code}: {err_body[:200]}")
            return None
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(5)
                continue
            print(f"  Error: {e}")
            return None
    return None


def parse_json(text):
    if not text:
        return None
    if "```" in text:
        lines = text.split("\n")
        filtered = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(filtered)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end+1])
            except json.JSONDecodeError:
                return None
    return None


# ── 데이터 로드 ──────────────────────────────────────

def load_unmatched(category):
    """archive에서 QID 없는 항목 전체 로드"""
    f = ARCHIVE_DIR / f"ai_{category}" / f"ai_{category}_matched.jsonl"
    if not f.exists():
        print(f"파일 없음: {f}")
        return []
    items = []
    with open(f) as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except Exception:
                continue
            qid = d.get("qid") or d.get("_qid") or ""
            if not qid.startswith("Q"):
                items.append(d)
    return items


# ── 메타데이터 빌더 ──────────────────────────────────

def build_meta(category, item):
    meta = {
        "_name_ko": item.get("name_ko", ""),
        "_name_en": item.get("name_en", ""),
        "_region": item.get("region", ""),
        "_source": "direct_gen",
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
    return CARD_DIR / category / f"cards_direct_{category}.jsonl"

def load_progress(category):
    path = get_progress_path(category)
    if path.exists():
        return json.loads(path.read_text())
    return {"processed_indices": [], "success": 0, "fail": 0}

def save_progress(category, progress):
    path = get_progress_path(category)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(progress, ensure_ascii=False))


# ── 메인 처리 ────────────────────────────────────────

def process_category(category, test_limit=0, resume=False):
    items = load_unmatched(category)
    if not items:
        print(f"  {category}: unmatched 항목 없음")
        return

    print(f"\n{'='*60}")
    print(f"카테고리: {category} (직접생성, {len(items)}건)")
    print(f"모델: {MODEL}")
    print(f"{'='*60}")

    progress = load_progress(category) if resume else {
        "processed_indices": [], "success": 0, "fail": 0
    }
    processed_set = set(progress["processed_indices"])

    if resume and processed_set:
        print(f"이어하기: {len(processed_set)}건 완료, {len(items) - len(processed_set)}건 남음")

    output_path = get_output_path(category)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if resume and output_path.exists() else "w"

    # 처리 대상 결정
    remaining = [(i, it) for i, it in enumerate(items) if i not in processed_set]
    if test_limit > 0:
        remaining = remaining[:test_limit]

    total = len(remaining)
    if total == 0:
        print("처리할 항목 없음")
        return

    est_seconds = total * (DELAY + 2)  # 직접생성은 wiki fetch 없어서 빠름
    print(f"처리 대상: {total}건")
    print(f"예상 소요: ~{est_seconds/3600:.1f}시간\n")

    start_time = time.time()

    with open(output_path, mode) as outf:
        for seq, (idx, item) in enumerate(remaining):
            name = item.get("name_ko", item.get("name_en", "?"))
            print(f"[{seq+1}/{total}] {name}")

            prompt = build_prompt(category, item)
            t0 = time.time()
            raw = call_gemini(prompt)
            elapsed = time.time() - t0

            card = parse_json(raw)
            if card:
                # 400자 후처리
                desc = card.get("description_ko", "")
                if len(desc) > 420:
                    cut = desc[:400].rfind(".")
                    if cut > 250:
                        card["description_ko"] = desc[:cut+1]
                    else:
                        card["description_ko"] = desc[:400]

                meta = build_meta(category, item)
                card.update(meta)
                outf.write(json.dumps(card, ensure_ascii=False) + "\n")
                outf.flush()
                progress["success"] += 1
                print(f"  OK ({elapsed:.1f}s, {len(card.get('description_ko',''))}자)")
            else:
                progress["fail"] += 1
                print(f"  FAIL ({elapsed:.1f}s)")
                if raw:
                    print(f"    raw: {raw[:100]}...")

            progress["processed_indices"].append(idx)

            if (seq + 1) % 50 == 0 or (seq + 1) == total:
                save_progress(category, progress)
                elapsed_total = time.time() - start_time
                rate = (seq + 1) / elapsed_total if elapsed_total > 0 else 0
                remaining_est = (total - seq - 1) / rate / 60 if rate > 0 else 0
                avg_tok = total_tokens // max(total_calls, 1)
                print(f"  --- {seq+1}/{total} | "
                      f"성공: {progress['success']} | "
                      f"실패: {progress['fail']} | "
                      f"토큰평균: {avg_tok} | "
                      f"남은시간: ~{remaining_est:.0f}분 ---")

            time.sleep(DELAY)

    save_progress(category, progress)
    avg_tok = total_tokens // max(total_calls, 1)
    print(f"\n{'='*60}")
    print(f"=== {category} 직접생성 완료 ===")
    print(f"성공: {progress['success']} | 실패: {progress['fail']}")
    print(f"토큰: 총 {total_tokens:,} / 건당 평균 {avg_tok}")
    print(f"출력: {output_path}")
    print(f"{'='*60}")


def show_stats():
    print(f"\n{'='*60}")
    print(f"=== 직접생성 카드 통계 ===")
    print(f"{'='*60}")

    for cat in CATEGORIES:
        output_path = get_output_path(cat)
        progress = load_progress(cat)
        items = load_unmatched(cat)

        total_output = 0
        if output_path.exists():
            with open(output_path) as f:
                total_output = sum(1 for l in f if l.strip())

        print(f"\n{cat}:")
        print(f"  대상: {len(items)}건")
        print(f"  생성: {total_output}건")
        print(f"  성공: {progress.get('success', 0)}")
        print(f"  실패: {progress.get('fail', 0)}")
        remaining = len(items) - len(progress.get("processed_indices", []))
        print(f"  남은: {remaining}건")


def main():
    parser = argparse.ArgumentParser(description="직접생성 카드 (QID 미매칭, GEMINI_CARD_KEY)")
    parser.add_argument("--category", choices=CATEGORIES + ["all"], default="persons")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--test", type=int, default=0)
    parser.add_argument("--stats", action="store_true")
    parser.add_argument("--delay", type=float, default=1)
    args = parser.parse_args()

    global DELAY
    DELAY = args.delay

    if args.stats:
        show_stats()
        return

    if not API_KEY:
        print("GEMINI_CARD_KEY 환경변수 필요 (.env.local)")
        sys.exit(1)

    print(f"API 키: ...{API_KEY[-8:]}")
    print(f"모델: {MODEL}")
    print(f"딜레이: {DELAY}s")

    if args.category == "all":
        for cat in CATEGORIES:
            process_category(cat, test_limit=args.test, resume=args.resume)
    else:
        process_category(args.category, test_limit=args.test, resume=args.resume)


if __name__ == "__main__":
    main()
