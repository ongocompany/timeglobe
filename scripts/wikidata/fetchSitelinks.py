#!/usr/bin/env python3
"""
Wikidata API에서 sitelinks 수를 배치 조회하여
wikidata_entities_raw.json에 sitelinks 필드 추가

사용법: python3 scripts/wikidata/fetchSitelinks.py
"""

import json
import time
import urllib.request
import urllib.parse
import ssl
import os

# macOS Python SSL 인증서 문제 우회 (공개 API 조회용)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

RAW_PATH = os.path.join(os.path.dirname(__file__), "../../public/geo/borders/wikidata_entities_raw.json")
RAW_PATH = os.path.abspath(RAW_PATH)

API_URL = "https://www.wikidata.org/w/api.php"
BATCH_SIZE = 50  # Wikidata API 최대 50개


def fetch_sitelinks_batch(qids: list[str]) -> dict[str, int]:
    """QID 리스트 → {qid: sitelinks_count} 반환"""
    params = {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "sitelinks",
        "format": "json",
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"

    req = urllib.request.Request(url, headers={
        "User-Agent": "TimeGlobe/1.0 (https://timeglobe.kr; contact@timeglobe.kr)"
    })

    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    result = {}
    entities = data.get("entities", {})
    for qid, entity in entities.items():
        if "missing" in entity:
            result[qid] = 0
        else:
            sitelinks = entity.get("sitelinks", {})
            result[qid] = len(sitelinks)
    return result


def main():
    # 1. raw 데이터 로드
    with open(RAW_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    print(f"Raw 엔티티: {len(raw)}개")

    # 2. QID 있는 엔티티만 추출
    qid_entities = [(i, e["qid"]) for i, e in enumerate(raw) if e.get("qid")]
    print(f"QID 있음: {len(qid_entities)}개")

    # 이미 sitelinks 있는 건 스킵
    to_fetch = [(i, qid) for i, qid in qid_entities if "sitelinks" not in raw[i]]
    print(f"조회 필요: {len(to_fetch)}개")

    if not to_fetch:
        print("이미 모든 엔티티에 sitelinks가 있음!")
        return

    # 3. 배치 조회
    total_batches = (len(to_fetch) + BATCH_SIZE - 1) // BATCH_SIZE
    fetched = 0
    errors = 0

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(to_fetch))
        batch = to_fetch[start:end]

        qids = [qid for _, qid in batch]
        idx_map = {qid: i for i, qid in batch}

        try:
            counts = fetch_sitelinks_batch(qids)
            for qid, count in counts.items():
                raw_idx = idx_map[qid]
                raw[raw_idx]["sitelinks"] = count
                fetched += 1
        except Exception as e:
            print(f"  [ERROR] Batch {batch_idx+1}: {e}")
            errors += len(batch)
            # 에러 시 해당 배치는 sitelinks=0으로
            for _, qid in batch:
                raw_idx = idx_map[qid]
                if "sitelinks" not in raw[raw_idx]:
                    raw[raw_idx]["sitelinks"] = 0

        # 진행 상황
        pct = (batch_idx + 1) / total_batches * 100
        print(f"  [{batch_idx+1}/{total_batches}] {pct:.0f}% - {fetched}개 완료", end="\r")

        # rate limit
        time.sleep(0.5)

    print(f"\n완료: {fetched}개 성공, {errors}개 에러")

    # 4. QID 없는 엔티티는 sitelinks=0
    no_qid = [i for i, e in enumerate(raw) if not e.get("qid")]
    for i in no_qid:
        raw[i]["sitelinks"] = 0
    print(f"QID 없는 엔티티 {len(no_qid)}개 → sitelinks=0")

    # 5. 저장
    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)

    # 6. 통계
    sl_values = [e.get("sitelinks", 0) for e in raw]
    sl_values.sort(reverse=True)
    print(f"\n=== Sitelinks 통계 ===")
    print(f"총 엔티티: {len(raw)}")
    print(f"100+ sitelinks: {sum(1 for v in sl_values if v >= 100)}개")
    print(f"50-99 sitelinks: {sum(1 for v in sl_values if 50 <= v < 100)}개")
    print(f"20-49 sitelinks: {sum(1 for v in sl_values if 20 <= v < 50)}개")
    print(f"1-19 sitelinks:  {sum(1 for v in sl_values if 1 <= v < 20)}개")
    print(f"0 sitelinks:     {sum(1 for v in sl_values if v == 0)}개")
    print(f"Top 10: {sl_values[:10]}")
    print(f"저장 완료: {RAW_PATH}")


if __name__ == "__main__":
    main()
