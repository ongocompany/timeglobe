#!/usr/bin/env python3
"""
Wikipedia → 카드 데이터 가공 테스트
QID 매칭된 인물 20명 → Wikipedia 요약 fetch → Gemini 3 Flash로 카드 가공
"""
import json, os, time, urllib.request, urllib.error, urllib.parse
from pathlib import Path

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

API_KEY = os.environ.get("GEMINI_API_KEY", "")
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = "gemini-3-flash-preview"

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
PERSONS_MATCHED = OUTPUT_DIR / "ai_persons" / "ai_persons_matched.jsonl"
TEST_OUTPUT = OUTPUT_DIR / "card_test" / "card_test_persons.jsonl"


# ── Wikipedia 요약 가져오기 ───────────────────────────
def fetch_wikipedia_summary(qid, lang="ko"):
    """Wikidata QID → Wikipedia 요약 텍스트"""
    # 1) Wikidata에서 Wikipedia 사이트링크 가져오기
    wd_url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    try:
        req = urllib.request.Request(wd_url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        wd_data = json.loads(resp.read())
        entity = wd_data["entities"][qid]

        # ko wikipedia 먼저, 없으면 en
        sitelinks = entity.get("sitelinks", {})
        wiki_title = None
        wiki_lang = lang
        if f"{lang}wiki" in sitelinks:
            wiki_title = sitelinks[f"{lang}wiki"]["title"]
        elif "enwiki" in sitelinks:
            wiki_title = sitelinks["enwiki"]["title"]
            wiki_lang = "en"
        else:
            return None, None, None

        # 2) Wikipedia REST API로 요약 가져오기
        title_encoded = urllib.parse.quote(wiki_title)
        wiki_url = f"https://{wiki_lang}.wikipedia.org/api/rest_v1/page/summary/{title_encoded}"
        req2 = urllib.request.Request(wiki_url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp2 = urllib.request.urlopen(req2, timeout=15)
        wiki_data = json.loads(resp2.read())

        summary = wiki_data.get("extract", "")
        thumbnail = wiki_data.get("thumbnail", {}).get("source", "")
        full_url = wiki_data.get("content_urls", {}).get("desktop", {}).get("page", "")

        return summary, thumbnail, full_url

    except Exception as e:
        print(f"  [summary err] {e}")
        return None, None, None


def fetch_wikipedia_full(qid, lang="ko", max_chars=8000):
    """Wikidata QID → Wikipedia 전체 본문 (앞부분)"""
    wd_url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    try:
        req = urllib.request.Request(wd_url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        wd_data = json.loads(resp.read())
        entity = wd_data["entities"][qid]

        sitelinks = entity.get("sitelinks", {})
        wiki_title = None
        wiki_lang = lang
        if f"{lang}wiki" in sitelinks:
            wiki_title = sitelinks[f"{lang}wiki"]["title"]
        elif "enwiki" in sitelinks:
            wiki_title = sitelinks["enwiki"]["title"]
            wiki_lang = "en"
        else:
            return None

        # MediaWiki API로 본문 텍스트 가져오기
        params = urllib.parse.urlencode({
            "action": "query",
            "titles": wiki_title,
            "prop": "extracts",
            "explaintext": "1",
            "exlimit": "1",
            "format": "json",
        })
        mw_url = f"https://{wiki_lang}.wikipedia.org/w/api.php?{params}"
        req2 = urllib.request.Request(mw_url, headers={"User-Agent": "TimeGlobe/1.0"})
        resp2 = urllib.request.urlopen(req2, timeout=15)
        mw_data = json.loads(resp2.read())

        pages = mw_data.get("query", {}).get("pages", {})
        for page in pages.values():
            text = page.get("extract", "")
            if text:
                return text[:max_chars]
        return None

    except Exception as e:
        print(f"  [full err] {e}")
        return None


# ── Gemini 카드 가공 ─────────────────────────────────
def build_card_prompt(person, wiki_text):
    schema = '''{
  "description_ko": "한국어 상세 설명 (400자 미만, 이 인물의 생애·업적·역사적 의의를 서술)",
  "description_en": "English description (under 500 chars, life, achievements, historical significance)",
  "key_achievements": ["업적1", "업적2", "업적3"],
  "related_events": ["관련 역사 이벤트1", "이벤트2"],
  "era_context": "이 인물이 살았던 시대의 한 줄 설명",
  "fun_fact": "흥미로운 사실 하나 (카드에 넣을 만한)"
}'''
    return f"""당신은 역사 교육 카드 콘텐츠 전문가입니다.

아래 Wikipedia 본문을 읽고, 다음 JSON 형식으로 카드 데이터를 만들어주세요.
반드시 유효한 JSON만 출력하세요. 마크다운 코드블록이나 설명 없이 순수 JSON만.

중요: description_ko는 반드시 300자 이상, 400자 미만으로 작성하세요.
교과서 서술처럼 이 인물의 생애, 주요 업적, 역사적 맥락과 의의를 풍부하게 설명합니다.

출력 형식:
{schema}

인물 정보:
- 이름: {person.get("name_ko", "")} ({person.get("name_en", "")})
- 생몰년: {person.get("birth_year", "?")} ~ {person.get("death_year", "?")}
- 역할: {person.get("role", "")}
- 분야: {person.get("field", "")}
- 지역: {person.get("birth_place", "")}

Wikipedia 본문:
{wiki_text}
"""


def call_gemini(prompt, model=MODEL):
    """Gemini API 호출"""
    url = f"{API_BASE}/{model}:generateContent?key={API_KEY}"
    headers = {"Content-Type": "application/json"}

    body = json.dumps({
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096,
        }
    })

    req = urllib.request.Request(url, data=body.encode(), headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return text
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  ✗ API error {e.code}: {err_body[:200]}")
        return None
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def parse_json_response(text):
    """LLM 응답에서 JSON 추출"""
    if not text:
        return None
    # 마크다운 코드블록 제거
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
    except:
        return None


# ── 메인 ─────────────────────────────────────────────
def main():
    # 매칭된 인물에서 QID 있는 것 20개 샘플
    persons = []
    with open(PERSONS_MATCHED) as f:
        for line in f:
            try:
                d = json.loads(line.strip())
            except:
                continue
            qid = d.get("_qid")
            if qid and qid.startswith("Q"):
                persons.append(d)

    # 다양한 시대에서 골고루 뽑기
    import random
    random.seed(42)
    # 시대별로 분류
    ancient = [p for p in persons if (p.get("birth_year") or 0) < 500]
    medieval = [p for p in persons if 500 <= (p.get("birth_year") or 0) < 1500]
    modern = [p for p in persons if (p.get("birth_year") or 0) >= 1500]

    sample = []
    for group, n in [(ancient, 2), (medieval, 1), (modern, 2)]:
        if len(group) >= n:
            sample.extend(random.sample(group, n))
        else:
            sample.extend(group)

    print(f"=== 카드 생성 테스트 ({len(sample)}명) ===")
    print(f"모델: {MODEL}\n")

    # 출력 디렉토리
    TEST_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    results = []
    success = 0
    fail_wiki = 0
    fail_ai = 0

    for i, person in enumerate(sample):
        qid = person["_qid"]
        name = person.get("name_ko", person.get("name_en", "?"))
        print(f"[{i+1}/{len(sample)}] {name} ({qid})")

        # 1) Wikipedia 본문 fetch (ko 먼저, 없으면 en)
        wiki_lang = "ko"
        wiki_text = fetch_wikipedia_full(qid, "ko", max_chars=6000)
        if not wiki_text or len(wiki_text) < 100:
            wiki_text = fetch_wikipedia_full(qid, "en", max_chars=6000)
            wiki_lang = "en"
        summary, thumbnail, wiki_url = fetch_wikipedia_summary(qid, wiki_lang)

        if not wiki_text:
            print(f"  ✗ Wikipedia 본문 없음 (ko/en 모두 실패)")
            fail_wiki += 1
            continue

        print(f"  → Wikipedia ({wiki_lang}): {len(wiki_text)} chars")

        # 2) Gemini로 카드 가공
        prompt = build_card_prompt(person, wiki_text)

        t0 = time.time()
        raw_response = call_gemini(prompt)
        elapsed = time.time() - t0

        card = parse_json_response(raw_response)
        if card:
            # 메타데이터 추가
            card["_qid"] = qid
            card["_name_ko"] = person.get("name_ko", "")
            card["_name_en"] = person.get("name_en", "")
            card["_birth_year"] = person.get("birth_year")
            card["_death_year"] = person.get("death_year")
            card["_role"] = person.get("role", "")
            card["_field"] = person.get("field", "")
            card["_region"] = person.get("region", "")
            card["_thumbnail"] = thumbnail or ""
            card["_wiki_url"] = wiki_url or ""
            card["_wiki_lang"] = wiki_lang
            card["_model"] = MODEL

            results.append(card)
            success += 1
            print(f"  ✓ 카드 생성 ({elapsed:.1f}s)")
            desc = card.get('description_ko', '')
            print(f"    설명: {desc[:60]}... ({len(desc)}자)")
        else:
            fail_ai += 1
            print(f"  ✗ AI 가공 실패 ({elapsed:.1f}s)")
            if raw_response:
                print(f"    응답: {raw_response[:100]}...")

        # rate limit 대기
        time.sleep(2)

    # 결과 저장
    with open(TEST_OUTPUT, "w") as f:
        for card in results:
            f.write(json.dumps(card, ensure_ascii=False) + "\n")

    print(f"\n=== 결과 ===")
    print(f"성공: {success}/{len(sample)}")
    print(f"Wikipedia 실패: {fail_wiki}")
    print(f"AI 가공 실패: {fail_ai}")
    print(f"저장: {TEST_OUTPUT}")

    # 샘플 출력
    if results:
        print(f"\n=== 샘플 카드 ===")
        sample_card = results[0]
        print(json.dumps(sample_card, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
