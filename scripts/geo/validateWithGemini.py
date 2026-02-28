#!/usr/bin/env python3
"""
[cl] Gemini API를 이용한 HB 역사 데이터 자동 검증

사용법:
  python3 scripts/geo/validateWithGemini.py

.env.local에서 GEMINI_API_KEY를 읽어 Gemini 2.5 Flash로 검증 요청.
Tier 1+2 프롬프트 5개를 순차 처리하고 결과를 JSON으로 저장.
"""

import os
import sys
import json
import glob
import time
import re

# .env.local에서 API 키 로드
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "../../.env.local")
    if not os.path.exists(env_path):
        print("ERROR: .env.local 파일이 없습니다")
        sys.exit(1)
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()

import google.generativeai as genai

VALIDATION_DIR = os.path.join(os.path.dirname(__file__), "validation")
RESULTS_DIR = os.path.join(VALIDATION_DIR, "results")

# Gemini 설정
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY가 .env.local에 없습니다")
    sys.exit(1)

genai.configure(api_key=API_KEY)


def find_tier12_prompts():
    """gemini_tier12_*.md 파일들을 순서대로 찾기"""
    pattern = os.path.join(VALIDATION_DIR, "gemini_tier12_*.md")
    files = sorted(glob.glob(pattern))
    if not files:
        print("ERROR: gemini_tier12_*.md 파일이 없습니다. extractEntityLifespans.py를 먼저 실행하세요.")
        sys.exit(1)
    return files


def call_gemini(prompt_text, chunk_name):
    """Gemini API 호출"""
    model = genai.GenerativeModel("gemini-2.5-flash")

    system_instruction = """당신은 세계사 전문가입니다. 역사 지도 데이터의 정확성을 검증하는 작업을 합니다.
각 국가/제국의 존속기간을 위키피디아와 공인된 역사 자료를 기준으로 검증하세요.

응답 규칙:
1. 반드시 JSON 배열로만 응답하세요 (마크다운 코드블록 안에)
2. 각 엔티티에 대해 검증 결과를 포함하세요
3. 데이터에 없지만 이 기간에 존재했어야 할 주요 국가도 "missing"으로 추가하세요
4. correct인 엔티티도 빠짐없이 포함하세요

JSON 형식:
```json
[
  {
    "entity": "엔티티 영어명",
    "entity_ko": "한국어명",
    "data_from": "데이터상 시작",
    "data_until": "데이터상 종료",
    "actual_from": "실제 시작",
    "actual_until": "실제 종료",
    "status": "correct | wrong_start | wrong_end | wrong_both | gap | missing | extra",
    "note": "간단한 설명"
  }
]
```"""

    print(f"  Gemini API 호출 중... ({chunk_name})")
    try:
        response = model.generate_content(
            [system_instruction, prompt_text],
            generation_config=genai.GenerationConfig(
                temperature=0.1,  # 사실 기반이므로 낮은 temperature
                max_output_tokens=65536,
            ),
        )
        return response.text
    except Exception as e:
        print(f"  ERROR: API 호출 실패 — {e}")
        return None


def parse_json_from_response(text):
    """Gemini 응답에서 JSON 배열 추출"""
    if not text:
        return None

    # ```json ... ``` 블록 찾기
    json_match = re.search(r'```json\s*\n(.*?)```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError as e:
            print(f"  WARNING: JSON 파싱 실패 — {e}")

    # 그냥 [ ... ] 배열 찾기
    array_match = re.search(r'\[[\s\S]*\]', text)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def summarize_results(all_results):
    """전체 결과 요약 통계"""
    status_counts = {}
    issues = []

    for item in all_results:
        s = item.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
        if s != "correct":
            issues.append(item)

    return status_counts, issues


def main():
    os.makedirs(RESULTS_DIR, exist_ok=True)

    print("=" * 60)
    print("[cl] Gemini API 자동 역사 데이터 검증")
    print("=" * 60)

    prompt_files = find_tier12_prompts()
    print(f"\n검증할 프롬프트 파일: {len(prompt_files)}개")
    for f in prompt_files:
        print(f"  - {os.path.basename(f)}")

    all_results = []
    failed_chunks = []

    for i, fpath in enumerate(prompt_files):
        chunk_name = os.path.basename(fpath).replace(".md", "")
        print(f"\n[{i+1}/{len(prompt_files)}] {chunk_name}")

        # 이미 결과가 있으면 건너뛰기
        result_path = os.path.join(RESULTS_DIR, f"{chunk_name}_result.json")
        if os.path.exists(result_path):
            print(f"  → 이미 결과 파일 존재, 건너뜀")
            with open(result_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            all_results.extend(existing)
            continue

        # 프롬프트 읽기
        with open(fpath, "r", encoding="utf-8") as f:
            prompt_text = f.read()

        # API 호출
        raw_response = call_gemini(prompt_text, chunk_name)

        if raw_response:
            # 원본 응답 저장 (디버깅용)
            raw_path = os.path.join(RESULTS_DIR, f"{chunk_name}_raw.md")
            with open(raw_path, "w", encoding="utf-8") as f:
                f.write(raw_response)

            # JSON 파싱
            parsed = parse_json_from_response(raw_response)
            if parsed:
                with open(result_path, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, ensure_ascii=False, indent=2)
                all_results.extend(parsed)
                print(f"  → {len(parsed)}개 엔티티 검증 완료")
            else:
                print(f"  → JSON 파싱 실패 (원본은 {os.path.basename(raw_path)}에 저장됨)")
                failed_chunks.append(chunk_name)
        else:
            failed_chunks.append(chunk_name)

        # Rate limiting — 청크 사이에 잠시 대기
        if i < len(prompt_files) - 1:
            print("  (5초 대기...)")
            time.sleep(5)

    # 전체 결과 합산
    print("\n" + "=" * 60)
    print("[검증 결과 요약]")
    print("=" * 60)

    if all_results:
        # 전체 결과 저장
        all_path = os.path.join(RESULTS_DIR, "all_validation_results.json")
        with open(all_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)

        status_counts, issues = summarize_results(all_results)
        print(f"\n총 검증 엔티티: {len(all_results)}개")
        print(f"\n판정 분포:")
        for status, count in sorted(status_counts.items(), key=lambda x: -x[1]):
            emoji = {"correct": "✅", "wrong_start": "⏪", "wrong_end": "⏩",
                     "wrong_both": "❌", "gap": "🕳️", "missing": "🔍", "extra": "🚫"}.get(status, "❓")
            print(f"  {emoji} {status}: {count}개")

        if issues:
            # 문제있는 것들만 따로 저장
            issues_path = os.path.join(RESULTS_DIR, "issues_only.json")
            with open(issues_path, "w", encoding="utf-8") as f:
                json.dump(issues, f, ensure_ascii=False, indent=2)
            print(f"\n⚠️  문제 발견: {len(issues)}개 → {os.path.basename(issues_path)}")

        print(f"\n📂 결과 폴더: {RESULTS_DIR}")

    if failed_chunks:
        print(f"\n❌ 실패한 청크: {', '.join(failed_chunks)}")
        print("  → 다시 실행하면 실패한 청크만 재시도합니다 (이미 완료된 건 건너뜀)")


if __name__ == "__main__":
    main()
