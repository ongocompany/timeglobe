#!/usr/bin/env python3
"""
[cl] 직접생성 카드 테스트 — QID 없는 항목을 AI 자체 지식으로 카드 생성
Wikipedia 참조 없이 Gemini 2.5 Flash가 직접 작성.
"""
import json, os, sys, time, urllib.request, urllib.error

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
DELAY = 1  # seconds between calls

OUTPUT_DIR = "/mnt/data2/wikidata/output"
ARCHIVE_DIR = f"{OUTPUT_DIR}/archive"

# ── 카테고리별 정보 포맷터 ──
def format_person(d):
    return (
        f"- 이름: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
        f"- 생몰년: {d.get('birth_year', '?')} ~ {d.get('death_year', '?')}\n"
        f"- 역할: {d.get('role', '')}\n"
        f"- 분야: {d.get('field', '')}\n"
        f"- 활동지역: {d.get('active_country', d.get('birth_place', ''))}\n"
        f"- 국적: {d.get('nationality', '')}\n"
        f"- 요약: {d.get('significance', '')}"
    )

def format_event(d):
    return (
        f"- 사건명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
        f"- 시기: {d.get('start_year', '?')} ~ {d.get('end_year', '?')}\n"
        f"- 장소: {d.get('location', '')}\n"
        f"- 유형: {d.get('type', '')}\n"
        f"- 참여자: {d.get('participants', '')}\n"
        f"- 요약: {d.get('significance', '')}"
    )

def format_artwork(d):
    return (
        f"- 작품명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
        f"- 연도: {d.get('year', '?')}\n"
        f"- 작가: {d.get('creator', '')} ({d.get('creator_en', '')})\n"
        f"- 매체: {d.get('medium', '')}\n"
        f"- 출처: {d.get('origin', '')}\n"
        f"- 요약: {d.get('significance', '')}"
    )

def format_invention(d):
    return (
        f"- 발명명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
        f"- 연도: {d.get('year', '?')}\n"
        f"- 발명가: {d.get('inventor', '')} ({d.get('inventor_en', '')})\n"
        f"- 분야: {d.get('field', '')}\n"
        f"- 출처: {d.get('origin', '')}\n"
        f"- 요약: {d.get('significance', '')}"
    )

def format_item(d):
    return (
        f"- 유물명: {d.get('name_ko', '')} ({d.get('name_en', '')})\n"
        f"- 연도: {d.get('year', '?')}\n"
        f"- 유형: {d.get('item_type', '')}\n"
        f"- 출처: {d.get('origin', '')}\n"
        f"- 요약: {d.get('significance', '')}"
    )

FORMATTERS = {
    "persons": ("역사 인물", format_person),
    "events": ("역사적 사건", format_event),
    "artworks": ("예술 작품 / 문화유산", format_artwork),
    "inventions": ("발명 / 기술 혁신", format_invention),
    "items": ("역사적 유물 / 아이템", format_item),
}


def build_direct_prompt(category, item):
    subject, formatter = FORMATTERS[category]
    info_text = formatter(item)

    return f"""너는 세계사 백과사전 편집자이다.
아래 역사적 항목의 카드 콘텐츠를 작성하라.
반드시 유효한 JSON만 출력하라. 마크다운 코드블록이나 설명 없이 순수 JSON만.

## 절대 규칙
1. 확실히 아는 사실만 써라. 추측, 상상, 과장 절대 금지.
2. 정보가 부족하면 아는 만큼만 짧게 써라. 100자여도 괜찮다.
3. 모르는 필드는 빈 문자열("")이나 빈 배열([])로 남겨라.
4. description_ko는 평서문으로 써라. ("~이다", "~했다", "~되었다") 경어체 절대 금지.
5. "~로 알려져 있다", "~한 것으로 추정된다" 같은 불확실한 표현은 OK.

대상 유형: {subject}

## 항목 정보
{info_text}

## 출력 형식 (JSON)
{{
  "description_ko": "한국어 설명 (사실 기반, 100~400자. 짧아도 된다)",
  "description_en": "English description (fact-based, concise)",
  "key_achievements": ["핵심 업적/특징 1~3개. 확실한 것만"],
  "related_events": ["관련 사건/인물 1~3개. 확실한 것만"],
  "era_context": "같은 시대 세계사적 맥락 한 줄 (모르면 빈 문자열)",
  "fun_fact": "흥미로운 사실 하나 (확실한 것만. 없으면 빈 문자열)"
}}"""


def call_gemini(prompt):
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }).encode()
    req = urllib.request.Request(GEMINI_URL, data=body,
                                headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def parse_json(text):
    if not text:
        return None
    # 마크다운 코드블록 제거
    if "```" in text:
        lines = text.split("\n")
        filtered = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(filtered)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # { 부터 마지막 } 까지 추출
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end+1])
            except json.JSONDecodeError:
                return None
    return None


def load_unmatched(category, limit=10):
    """archive에서 QID 없는 항목 로드"""
    f = f"{ARCHIVE_DIR}/ai_{category}/ai_{category}_matched.jsonl"
    if not os.path.exists(f):
        print(f"파일 없음: {f}")
        return []
    items = []
    with open(f) as fh:
        for line in fh:
            d = json.loads(line)
            qid = d.get("qid") or d.get("_qid") or ""
            if not qid.startswith("Q"):
                items.append(d)
                if len(items) >= limit:
                    break
    return items


def main():
    if not GEMINI_KEY:
        print("GEMINI_API_KEY 환경변수 필요")
        sys.exit(1)

    category = sys.argv[1] if len(sys.argv) > 1 else "persons"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    print(f"=== 직접생성 카드 테스트: {category} (상위 {limit}건) ===\n")

    items = load_unmatched(category, limit)
    if not items:
        print("unmatched 항목 없음")
        return

    results = []
    for i, item in enumerate(items):
        name = item.get("name_ko", item.get("name_en", "?"))
        print(f"[{i+1}/{len(items)}] {name}")

        prompt = build_direct_prompt(category, item)
        raw = call_gemini(prompt)
        card = parse_json(raw)

        if card:
            desc = card.get("description_ko", "")
            print(f"  ✓ {len(desc)}자")
            print(f"    → {desc[:100]}...")
            card["_name_ko"] = item.get("name_ko", "")
            card["_name_en"] = item.get("name_en", "")
            card["_source"] = "direct_gen"
            results.append(card)
        else:
            print(f"  ✗ 파싱 실패")
            if raw:
                print(f"    raw: {raw[:150]}...")

        time.sleep(DELAY)

    # 결과 저장
    out_path = f"/tmp/direct_cards_test_{category}.json"
    with open(out_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n=== 완료: {len(results)}/{len(items)} 성공 → {out_path} ===")


if __name__ == "__main__":
    main()
