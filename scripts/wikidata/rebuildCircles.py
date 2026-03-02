#!/usr/bin/env python3
"""
[cl] rebuildCircles.py — wikidata_entities_raw.json → wikidata_circles.json 재생성
사용법: python3 scripts/wikidata/rebuildCircles.py

처리 순서:
  1. wikidata_entities_raw.json 로드
  2. CSHAPES 제외, 좌표/날짜 없는 것 제외
  3. 연도 파싱: "BC 1450" → -1450, "AD 476" → 476, "Present" → 2025
  4. 색상: 3도 격자 MD5 공간해싱 hsl(hue, 70%, 55%)
  5. wikidata_circles.json 저장
  6. fixLabelCoords.py 자동 실행 (수도→국토 무게중심 보정)

주의: 이 스크립트를 실행하면 반드시 fixLabelCoords.py가 자동으로 따라 실행됨.
      circles.json 직접 재생성 후 fixLabelCoords 빼먹는 실수 방지!
"""

import json
import hashlib
import os
import subprocess
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW_PATH    = os.path.join(BASE_DIR, 'public', 'geo', 'borders', 'wikidata_entities_raw.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'public', 'geo', 'borders', 'wikidata_circles.json')
FIX_SCRIPT  = os.path.join(BASE_DIR, 'scripts', 'wikidata', 'fixLabelCoords.py')


# ============================================================
# 연도 파싱
# ============================================================
def parse_year(s: str) -> int | None:
    """
    "BC 1450" → -1450
    "AD 476"  → 476
    "476"     → 476
    "Present" → 2025
    None / ""  → None
    """
    if not s or not str(s).strip():
        return None
    s = str(s).strip()
    if s.lower() in ('present', 'now', '현재', '2025'):
        return 2025
    if s.upper().startswith('BC '):
        try:
            return -int(s[3:].strip())
        except ValueError:
            return None
    if s.upper().startswith('AD '):
        try:
            return int(s[3:].strip())
        except ValueError:
            return None
    try:
        return int(s)
    except ValueError:
        return None


# ============================================================
# 색상 생성 (3도 격자 MD5 공간해싱 HSL)
# ============================================================
def make_color(lat: float, lon: float) -> str:
    """
    위도/경도를 3도 단위 격자로 버킷팅 후 MD5 해시 → hsl(hue, 70%, 55%)
    같은 지역의 엔티티끼리 유사한 색상이 나옴
    """
    blat = int(float(lat) / 3) * 3
    blon = int(float(lon) / 3) * 3
    key  = f'{blat},{blon}'
    h    = hashlib.md5(key.encode()).hexdigest()
    hue  = int(h[:4], 16) % 360
    return f'hsl({hue}, 70%, 55%)'


# ============================================================
# 메인
# ============================================================
def main():
    print(f'[rebuildCircles] {RAW_PATH} 로딩...')
    raw = json.load(open(RAW_PATH, encoding='utf-8'))
    print(f'[rebuildCircles] raw 총 {len(raw)}개 엔티티')

    circles = []
    stats = {
        'total':      len(raw),
        'cshapes':    0,
        'no_coord':   0,
        'no_dates':   0,
        'ok':         0,
    }

    for ent in raw:
        qid = ent.get('qid', '')

        # CSHAPES 제외 (현대 국가 폴리곤 참조용, 우리 데이터 아님)
        # QID가 'CSHAPES_'로 시작하는 엔티티 (type 필드가 아니라 QID로 판별)
        if str(qid).startswith('CSHAPES_'):
            stats['cshapes'] += 1
            continue

        # T5 제외 (지도 숨김 처리)
        if ent.get('tier') == 5:
            stats.setdefault('t5', 0)
            stats['t5'] += 1
            continue

        # 좌표 확인
        lat = ent.get('lat')
        lon = ent.get('lon')
        if lat is None or lon is None or str(lat).strip() == '' or str(lon).strip() == '':
            stats['no_coord'] += 1
            continue

        # 날짜 파싱
        start_year = parse_year(ent.get('start'))
        end_year   = parse_year(ent.get('end'))
        if start_year is None:
            stats['no_dates'] += 1
            continue

        lat_f = float(lat)
        lon_f = float(lon)

        circles.append({
            'name_en':    ent.get('name_en', ''),
            'name_ko':    ent.get('name_ko', ''),
            'lon':        lon_f,
            'lat':        lat_f,
            'start_year': start_year,
            'end_year':   end_year if end_year is not None else 2025,
            'lineage_id': ent.get('lineage_id'),
            'color':      make_color(lat_f, lon_f),
            'qid':        qid,
            'tier':       ent.get('tier', 4),
            'region':     ent.get('region', 'other'),
            'sitelinks':  ent.get('sitelinks', 0),
        })
        stats['ok'] += 1

    # 정렬: start_year 오름차순
    circles.sort(key=lambda x: x['start_year'])

    print(f'\n[rebuildCircles] 처리 결과:')
    print(f'  ✅ 생성:    {stats["ok"]}개')
    print(f'  🚫 CSHAPES: {stats["cshapes"]}개 제외')
    print(f'  ❌ 좌표없음: {stats["no_coord"]}개 제외')
    print(f'  ❌ 날짜없음: {stats["no_dates"]}개 제외')
    tier_counts = {}
    for c in circles:
        t = c['tier']
        tier_counts[t] = tier_counts.get(t, 0) + 1
    for t in sorted(tier_counts):
        print(f'  T{t}: {tier_counts[t]}개')

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(circles, f, ensure_ascii=False, separators=(',', ':'))
    print(f'\n✅ {OUTPUT_PATH} 저장 완료 ({len(circles)}개)')

    # ─────────────────────────────────────────────────────
    # 자동으로 fixLabelCoords.py 실행 (수도 → 국토 무게중심)
    # ─────────────────────────────────────────────────────
    print('\n[rebuildCircles] fixLabelCoords.py 자동 실행 중...')
    result = subprocess.run(
        [sys.executable, FIX_SCRIPT],
        capture_output=False,
    )
    if result.returncode != 0:
        print(f'⚠️  fixLabelCoords.py 실패 (returncode={result.returncode})')
        sys.exit(1)
    else:
        print('[rebuildCircles] ✅ fixLabelCoords 완료 — 파이프라인 성공!')


if __name__ == '__main__':
    main()
