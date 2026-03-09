#!/usr/bin/env python3
"""
curatePersons.py — AI 큐레이션 (Step 2)
persons_filtered.jsonl에서 카드 미보유 인물을 대상으로
Gemini에게 "역사 타임라인 카드 가치 있는가?" YES/NO 판정

Usage:
  python3 curatePersons.py --dry-run          # 대상 수만 확인
  python3 curatePersons.py --test 2           # 2배치(40명)만 테스트
  python3 curatePersons.py --resume           # 이어서 실행
  python3 curatePersons.py --resume --stats   # 현재 진행 통계만
"""
import json, os, time, argparse, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime

# ── 설정 ──
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent

env_path = PROJECT_ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

GEMINI_KEY = os.environ.get("GEMINI_CARD_KEY") or os.environ.get("GEMINI_API_KEY", "")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = "gemini-2.5-flash-lite"

OUTPUT_DIR = Path("/mnt/data2/wikidata/output")
FILTERED_FILE = OUTPUT_DIR / "final" / "persons_filtered.jsonl"
CARDS_FILE = OUTPUT_DIR / "cards" / "persons" / "cards_persons.jsonl"
CURATED_DIR = OUTPUT_DIR / "curation"
RESULT_FILE = CURATED_DIR / "persons_curated.jsonl"
PROGRESS_FILE = CURATED_DIR / "curation_progress.json"

BATCH_SIZE = 20       # 한 API 호출당 인물 수
DELAY = 1.2           # 초 (유료 1000 RPM → 여유롭게)
MAX_RETRIES = 3

# ── 프롬프트 ──
SYSTEM_PROMPT = """당신은 역사 교육용 타임라인 카드 큐레이터입니다.
아래 인물 목록을 보고, 각 인물이 **세계사 타임라인 카드**로 가치가 있는지 판정하세요.

## 판정 기준
**YES** (카드 가치 있음):
- 세계사/지역사에서 의미 있는 역할을 한 인물
- 정치 지도자, 과학자, 사상가, 예술가(역사적), 혁명가, 탐험가, 발명가 등
- 해당 시대를 이해하는 데 중요한 인물
- 한국사/동아시아사 인물도 포함

**NO** (카드 가치 없음):
- 현대 대중문화 인물 (현역 배우, 가수, 유튜버, 스포츠 선수 등)
- 학술적으로만 알려진 마이너 인물 (특정 분야 전문가이지만 일반 역사 교육과 무관)
- 단순히 유명하지만 역사적 맥락이 없는 인물

## 출력 형식
반드시 JSON 배열로 응답하세요. 각 항목은 {"qid": "Q...", "verdict": "YES" 또는 "NO"} 형식입니다.
다른 텍스트 없이 JSON만 출력하세요."""


def build_user_prompt(batch):
    """배치 인물 목록 → 사용자 프롬프트"""
    lines = []
    for p in batch:
        name = p.get("name_ko") or p.get("name_en") or "?"
        desc = p.get("desc_ko") or p.get("desc_en") or ""
        birth = p.get("birth_year", "?")
        death = p.get("death_year", "")
        years = f"{birth}"
        if death:
            years += f"~{death}"
        lines.append(f'- {p["qid"]}: {name} ({years}) — {desc}')
    return "다음 인물들을 판정하세요:\n\n" + "\n".join(lines)


def call_gemini(system_prompt, user_prompt):
    """Gemini API 호출 → parsed JSON"""
    url = f"{GEMINI_BASE}/{MODEL}:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        },
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "User-Agent": "TimeGlobe/1.0",
    })

    for attempt in range(MAX_RETRIES):
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            result = json.loads(resp.read())
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            usage = result.get("usageMetadata", {})
            parsed = json.loads(text)
            return parsed, usage
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            if e.code == 429 or e.code >= 500:
                wait = (attempt + 1) * 5
                print(f"  ⚠ HTTP {e.code}, {wait}초 대기 후 재시도...")
                time.sleep(wait)
                continue
            print(f"  ✗ HTTP {e.code}: {body[:200]}")
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            wait = (attempt + 1) * 5
            print(f"  ⚠ 네트워크 오류: {e}, {wait}초 대기...")
            time.sleep(wait)
            continue
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            print(f"  ⚠ 파싱 오류: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(3)
                continue
            raise

    raise RuntimeError("최대 재시도 초과")


def load_progress():
    """진행 상태 로드"""
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"processed": 0, "yes": 0, "no": 0, "errors": 0,
            "total_prompt_tokens": 0, "total_output_tokens": 0,
            "started_at": datetime.now().isoformat()}


def save_progress(prog):
    """진행 상태 저장"""
    prog["updated_at"] = datetime.now().isoformat()
    PROGRESS_FILE.write_text(json.dumps(prog, indent=2, ensure_ascii=False))


def print_stats(prog, total_target):
    """통계 출력"""
    p = prog["processed"]
    y = prog["yes"]
    n = prog["no"]
    e = prog["errors"]
    pct = p / total_target * 100 if total_target > 0 else 0
    yes_pct = y / p * 100 if p > 0 else 0
    pt = prog.get("total_prompt_tokens", 0)
    ot = prog.get("total_output_tokens", 0)
    print(f"\n{'='*50}")
    print(f"진행: {p:,} / {total_target:,} ({pct:.1f}%)")
    print(f"YES: {y:,} ({yes_pct:.1f}%) | NO: {n:,} | 오류: {e:,}")
    print(f"토큰: prompt {pt:,} + output {ot:,} = {pt+ot:,}")
    print(f"{'='*50}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--test", type=int, default=0, help="테스트 배치 수")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--stats", action="store_true")
    args = parser.parse_args()

    CURATED_DIR.mkdir(parents=True, exist_ok=True)

    # 1. 기존 카드 QID
    card_qids = set()
    if CARDS_FILE.exists():
        with open(CARDS_FILE) as f:
            for line in f:
                d = json.loads(line)
                qid = d.get("_qid") or d.get("qid")
                if qid:
                    card_qids.add(qid)

    # 2. 이미 큐레이션 완료된 QID
    done_qids = set()
    if RESULT_FILE.exists():
        with open(RESULT_FILE) as f:
            for line in f:
                d = json.loads(line)
                done_qids.add(d["qid"])

    # 3. 큐레이션 대상 로드
    targets = []
    with open(FILTERED_FILE) as f:
        for line in f:
            d = json.loads(line)
            qid = d["qid"]
            if qid in card_qids:
                continue  # 카드 이미 있음
            if qid in done_qids:
                continue  # 이미 큐레이션 완료
            targets.append(d)

    print(f"기존 카드: {len(card_qids):,}")
    print(f"큐레이션 완료: {len(done_qids):,}")
    print(f"큐레이션 대상: {len(targets):,}")

    prog = load_progress()

    if args.stats:
        print_stats(prog, len(targets) + len(done_qids))
        return

    if args.dry_run:
        print("[dry-run] 실행하려면 --dry-run 없이 실행하세요.")
        return

    if not GEMINI_KEY:
        print("✗ GEMINI_API_KEY 또는 GEMINI_CARD_KEY 환경변수 필요")
        return

    if not targets:
        print("✓ 큐레이션 대상 없음 (모두 완료)")
        return

    # 4. 배치 실행
    batches = [targets[i:i+BATCH_SIZE] for i in range(0, len(targets), BATCH_SIZE)]
    total_batches = len(batches)
    if args.test:
        batches = batches[:args.test]
    total_target = len(targets) + len(done_qids)

    print(f"배치: {len(batches):,} / {total_batches:,} (각 {BATCH_SIZE}명)")
    print(f"모델: {MODEL}")
    print()

    result_f = open(RESULT_FILE, "a")

    try:
        for bi, batch in enumerate(batches):
            batch_num = bi + 1
            user_prompt = build_user_prompt(batch)

            try:
                parsed, usage = call_gemini(SYSTEM_PROMPT, user_prompt)

                # 결과 매핑
                verdict_map = {}
                for item in parsed:
                    if isinstance(item, dict) and "qid" in item:
                        verdict_map[item["qid"]] = item.get("verdict", "?").upper()

                batch_yes = 0
                batch_no = 0
                for p in batch:
                    qid = p["qid"]
                    verdict = verdict_map.get(qid, "ERR")
                    if verdict == "YES":
                        batch_yes += 1
                        prog["yes"] += 1
                    elif verdict == "NO":
                        batch_no += 1
                        prog["no"] += 1
                    else:
                        verdict = "ERR"
                        prog["errors"] += 1

                    result_f.write(json.dumps({
                        "qid": qid,
                        "name_ko": p.get("name_ko", ""),
                        "verdict": verdict,
                        "sitelinks": p.get("sitelinks", 0),
                        "birth_year": p.get("birth_year"),
                    }, ensure_ascii=False) + "\n")

                prog["processed"] += len(batch)
                prog["total_prompt_tokens"] += usage.get("promptTokenCount", 0)
                prog["total_output_tokens"] += usage.get("candidatesTokenCount", 0)

                print(f"  [{batch_num}/{len(batches)}] YES={batch_yes} NO={batch_no} | 누적 YES={prog['yes']:,} NO={prog['no']:,}")

            except Exception as e:
                print(f"  [{batch_num}] ✗ 오류: {e}")
                prog["errors"] += len(batch)
                for p in batch:
                    result_f.write(json.dumps({
                        "qid": p["qid"],
                        "name_ko": p.get("name_ko", ""),
                        "verdict": "ERR",
                    }, ensure_ascii=False) + "\n")

            result_f.flush()
            save_progress(prog)
            time.sleep(DELAY)

    finally:
        result_f.close()

    print_stats(prog, total_target)
    print(f"✓ 결과 저장: {RESULT_FILE}")


if __name__ == "__main__":
    main()
