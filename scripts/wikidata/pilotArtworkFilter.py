#!/usr/bin/env python3
"""
pilotArtworkFilter.py — 대중예술 역사적 맥락 AI 판별 파일럿
sl≥50 + 날짜없음 artwork 대상, Gemini Flash-Lite로 YES/NO 판별

Usage:
  python3 -u pilotArtworkFilter.py              # 전체 실행
  python3 -u pilotArtworkFilter.py --limit 20   # 테스트 20건만
  python3 -u pilotArtworkFilter.py --stats       # 결과 통계만
"""
import json, os, time, argparse, urllib.request, urllib.parse, re
from pathlib import Path

# ── 경로 ──
OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
CAT_PATH = OUTPUT_DIR / "categories" / "12_artwork.jsonl"
KOWIKI_PATH = Path("/mnt/data2/kowiki/qid_pagelen.json")
RESULT_PATH = OUTPUT_DIR / "pilot_artwork_filter.jsonl"
PROGRESS_PATH = OUTPUT_DIR / "pilot_artwork_filter_progress.json"

# ── API ──
GEMINI_KEY = os.environ.get("GEMINI_CARD_KEY") or os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-2.5-flash-lite"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_KEY}"
DELAY = 0.3  # rate limit

# ── Wikipedia ──
WIKI_API = "https://ko.wikipedia.org/w/api.php"
WIKI_CHARS = 1500  # 판별용 본문 길이 (짧게)

# ── 판별 프롬프트 ──
FILTER_PROMPT = """당신은 세계사 타임라인 큐레이터입니다.
아래 작품이 **세계사 타임라인 지구본**에 표시될 가치가 있는지 판별하세요.

## YES 기준 (하나 이상 충족 시 YES)
1. **역사적 사건을 직접 다룸** — 전쟁, 혁명, 대학살, 독립운동 등을 소재로 한 작품
2. **장르/매체를 정립하거나 대중화** — 특정 장르의 기점이 된 작품. 예시: 반지의 제왕(판타지 장르 정립), 프랑켄슈타인(SF 장르 시초), 인상·일출(인상파 기점), 스타크래프트(e스포츠 탄생)
3. **사회적 영향력 입증** — 법률 변경, 사회운동 촉발, 검열/금서 등 실제 사회 변화를 일으킨 작품
4. **장소와 불가분** — 특정 지역의 역사적 정체성과 밀접한 작품 (애비 로드, 게르니카 등)
5. **종교/철학 경전** — 문명사적 영향력이 있는 종교 경전, 철학서
6. **시대를 대표하는 아티스트** — 특정 시대·장르의 탄생/혁신을 이끈 음악가·밴드·게임 (비틀즈→60년대 록, 모차르트→고전주의, 마인크래프트→샌드박스 장르). 단순 인기가 아닌 역사적 전환점을 만든 경우만 YES.

## NO 기준 (하나라도 해당 시 NO)
- 단순히 상업적으로 성공한/인기 있는 작품이나 아티스트
- 베스트앨범, 컴필레이션, 리마스터
- 시리즈물의 개별 에피소드/시즌/후속작/확장팩
- 개별 앨범·싱글 (아티스트 자체가 YES여도 개별 앨범은 NO)
- 스포츠 이벤트, 단순 오락 TV쇼

## 작품 정보
- 제목: {name_ko} ({name_en})
- Wikidata: {qid}
- Sitelinks: {sitelinks}개

## 위키백과 본문 (앞부분)
{wiki_text}

## 응답 형식 (JSON만, 다른 텍스트 없이)
{{"verdict": "YES" 또는 "NO", "reason": "판별 이유 한 줄", "era_hint": "관련 시대 (예: 1930년대, 르네상스, 고대 등, NO면 빈 문자열)"}}"""


def load_candidates(sl_min=50):
    """sl≥50 + 날짜없음 + kowiki 있는 artwork 추출"""
    kowiki = json.loads(KOWIKI_PATH.read_text())

    candidates = []
    with open(CAT_PATH) as f:
        for line in f:
            d = json.loads(line.strip())
            sl = d.get("sitelinks", 0)
            if sl < sl_min:
                continue
            has_date = False
            for field in ["year", "birth_year", "start_year"]:
                v = d.get(field)
                if v is not None and v != "" and v != 0:
                    has_date = True
                    break
            if has_date:
                continue
            qid = d.get("qid", "")
            if qid not in kowiki:
                continue
            candidates.append(d)

    candidates.sort(key=lambda x: x.get("sitelinks", 0), reverse=True)
    return candidates


def fetch_wiki_intro(title, chars=WIKI_CHARS):
    """Wikipedia 도입부 텍스트 가져오기"""
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "exintro": True,
        "explaintext": True,
        "exsectionformat": "plain",
        "redirects": 1,
        "format": "json",
    }
    url = f"{WIKI_API}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TimeGlobe/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        pages = data.get("query", {}).get("pages", {})
        for pid, page in pages.items():
            if pid == "-1":
                return None
            text = page.get("extract", "")
            return text[:chars] if text else None
    except Exception:
        return None


def call_gemini(prompt):
    """Gemini API 호출 → JSON 파싱"""
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 200,
            "responseMimeType": "application/json",
        },
    }).encode()

    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        # 줄바꿈 포함 응답 대응 — 첫 번째 JSON 객체만 파싱
        if "\n" in text:
            text = text.split("\n")[0].strip()
        # ```json 래핑 제거
        if text.startswith("```"):
            text = re.sub(r"^```json?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        return json.loads(text)
    except Exception as e:
        return {"verdict": "ERROR", "reason": str(e)[:100], "era_hint": ""}


def load_progress():
    """진행 상황 로드"""
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"done_qids": [], "stats": {"YES": 0, "NO": 0, "ERROR": 0}}


def save_progress(progress):
    PROGRESS_PATH.write_text(json.dumps(progress, ensure_ascii=False))


def show_stats():
    """결과 통계 출력"""
    if not RESULT_PATH.exists():
        print("결과 파일 없음")
        return

    yes_items = []
    no_count = 0
    err_count = 0
    with open(RESULT_PATH) as f:
        for line in f:
            d = json.loads(line.strip())
            v = d.get("verdict", "")
            if v == "YES":
                yes_items.append(d)
            elif v == "NO":
                no_count += 1
            else:
                err_count += 1

    total = len(yes_items) + no_count + err_count
    print(f"\n{'='*60}")
    print(f"파일럿 결과: {total}건")
    print(f"  YES: {len(yes_items)} ({len(yes_items)/total*100:.1f}%)")
    print(f"  NO:  {no_count} ({no_count/total*100:.1f}%)")
    print(f"  ERR: {err_count}")
    print(f"{'='*60}")

    # YES 샘플 (sl 높은 순)
    yes_items.sort(key=lambda x: x.get("sitelinks", 0), reverse=True)
    print(f"\n--- YES 샘플 (상위 30) ---")
    for it in yes_items[:30]:
        print(f"  {it.get('sitelinks',0):>3} | {it.get('name_ko','')[:25]:<25} | {it.get('reason','')[:50]}")

    # NO 샘플도
    print(f"\n--- NO 샘플 (최근 20) ---")
    no_items = []
    with open(RESULT_PATH) as f:
        for line in f:
            d = json.loads(line.strip())
            if d.get("verdict") == "NO":
                no_items.append(d)
    no_items.sort(key=lambda x: x.get("sitelinks", 0), reverse=True)
    for it in no_items[:20]:
        print(f"  {it.get('sitelinks',0):>3} | {it.get('name_ko','')[:25]:<25} | {it.get('reason','')[:50]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="처리 건수 제한 (테스트용)")
    parser.add_argument("--stats", action="store_true", help="결과 통계만 출력")
    parser.add_argument("--sl-min", type=int, default=50, help="최소 sitelinks (기본 50)")
    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    print(f"모델: {MODEL}")
    print(f"sl 컷오프: {args.sl_min}")

    candidates = load_candidates(args.sl_min)
    print(f"후보: {len(candidates)}건")

    progress = load_progress()
    done_set = set(progress["done_qids"])
    print(f"기처리: {len(done_set)}건")

    # 필터
    todo = [c for c in candidates if c.get("qid") not in done_set]
    if args.limit:
        todo = todo[:args.limit]
    print(f"처리 대상: {len(todo)}건\n")

    # 결과 파일 append 모드
    out_f = open(RESULT_PATH, "a")
    start = time.time()

    for i, item in enumerate(todo):
        qid = item.get("qid", "")
        name_ko = item.get("name_ko", "") or item.get("name_en", "")
        name_en = item.get("name_en", "")
        sl = item.get("sitelinks", 0)

        print(f"[{i+1}/{len(todo)}] {name_ko} ({qid}, sl={sl})")

        # Wikipedia 도입부
        wiki_title = name_ko or name_en
        wiki_text = fetch_wiki_intro(wiki_title)
        # 동음이의어 페이지 감지 (100자 미만) → 괄호 제목 시도
        if wiki_text and len(wiki_text) < 100:
            for suffix in ["(밴드)", "(영화)", "(소설)", "(음반)", "(드라마)", "(뮤지컬)"]:
                alt = fetch_wiki_intro(f"{wiki_title} {suffix}")
                if alt and len(alt) > len(wiki_text):
                    wiki_text = alt
                    print(f"  → 동음이의어 → '{wiki_title} {suffix}' ({len(alt)}자)")
                    break
        if not wiki_text:
            # en fallback
            wiki_text = fetch_wiki_intro(name_en) if name_en else None
        if not wiki_text:
            print(f"  ⚠️ 위키 본문 없음 → SKIP")
            result = {"verdict": "ERROR", "reason": "위키 본문 fetch 실패", "era_hint": ""}
        else:
            print(f"  → 위키 {len(wiki_text)}자")
            prompt = FILTER_PROMPT.format(
                name_ko=name_ko, name_en=name_en,
                qid=qid, sitelinks=sl, wiki_text=wiki_text[:WIKI_CHARS]
            )
            result = call_gemini(prompt)
            print(f"  → {result.get('verdict', '?')}: {result.get('reason', '')[:60]}")

        # 저장
        record = {
            "qid": qid,
            "name_ko": name_ko,
            "name_en": name_en,
            "sitelinks": sl,
            "verdict": result.get("verdict", "ERROR"),
            "reason": result.get("reason", ""),
            "era_hint": result.get("era_hint", ""),
        }
        out_f.write(json.dumps(record, ensure_ascii=False) + "\n")
        out_f.flush()

        # progress
        progress["done_qids"].append(qid)
        v = result.get("verdict", "ERROR")
        progress["stats"][v] = progress["stats"].get(v, 0) + 1

        if (i + 1) % 50 == 0:
            save_progress(progress)
            elapsed = time.time() - start
            rate = (i + 1) / elapsed
            remaining = (len(todo) - i - 1) / rate / 60
            print(f"  --- {i+1}/{len(todo)} | YES:{progress['stats'].get('YES',0)} NO:{progress['stats'].get('NO',0)} | ~{remaining:.0f}분 남음 ---")

        if v != "ERROR":
            time.sleep(DELAY)

    out_f.close()
    save_progress(progress)

    print(f"\n완료! 결과: {RESULT_PATH}")
    show_stats()


if __name__ == "__main__":
    main()
