#!/usr/bin/env python3
"""[cl] T1/T2 국경선 시대별 누락 분석"""
import json

# 데이터 로드
with open('/home/jinwoo/timeglobe/public/geo/borders/wikidata_entities_raw.json') as f:
    raw = json.load(f)
with open('/home/jinwoo/timeglobe/public/geo/borders/ohm_index.json') as f:
    ohm = json.load(f)
with open('/home/jinwoo/timeglobe/public/geo/borders/cshapes_qid_index.json') as f:
    cs = json.load(f)

ohm_by_qid = {o['qid']: o for o in ohm}
cs_by_qid = {c['qid']: c for c in cs}

def parse_year(s):
    if s is None:
        return None
    s = str(s).strip()
    if s.startswith('BC '):
        return -int(s[3:])
    try:
        return int(s)
    except:
        return None

results = []
for e in raw:
    tier = e.get('tier', 99)
    if tier > 2:
        continue

    qid = e['qid']
    name = e.get('name_ko', e.get('name_en', '?'))
    start = parse_year(e.get('start'))
    end = parse_year(e.get('end'))

    # OHM
    ohm_data = ohm_by_qid.get(qid)
    ohm_snaps = []
    is_manual = False
    if ohm_data:
        for s in ohm_data.get('snapshots', []):
            rid = s.get('rid', 0)
            if rid >= 9000000:
                is_manual = True
            ohm_snaps.append({
                'start': s.get('start'),
                'end': s.get('end'),
                'rid': rid,
                'manual': rid >= 9000000
            })

    # CShapes
    cs_data = cs_by_qid.get(qid)
    cs_years = cs_data['cshapes_years'] if cs_data else []

    has_ohm = len(ohm_snaps) > 0
    has_cs = len(cs_years) > 0

    # 갭 분석
    gaps = []
    if start is not None and end is not None:
        covered = []
        for sn in ohm_snaps:
            covered.append((sn['start'], sn['end']))
        if cs_years:
            covered.append((min(cs_years), max(cs_years)))

        if not covered:
            gaps.append((start, end))
        else:
            # None 값 처리: start가 None이면 엔티티 start, end가 None이면 엔티티 end 사용
            covered = [(s if s is not None else start, e if e is not None else end) for s, e in covered]
            covered.sort()
            if covered[0][0] > start:
                gaps.append((start, covered[0][0] - 1))
            for i in range(len(covered) - 1):
                if covered[i][1] + 1 < covered[i+1][0]:
                    gaps.append((covered[i][1] + 1, covered[i+1][0] - 1))
            if covered[-1][1] < end:
                gaps.append((covered[-1][1] + 1, end))

    results.append({
        'qid': qid,
        'name': name,
        'tier': tier,
        'start': start,
        'end': end,
        'has_ohm': has_ohm,
        'has_cs': has_cs,
        'is_manual': is_manual,
        'ohm_snaps': ohm_snaps,
        'cs_range': f"{min(cs_years)}-{max(cs_years)}" if cs_years else None,
        'gaps': gaps,
        'no_border': not has_ohm and not has_cs
    })

# ── 출력 ──

print('=' * 80)
print('T1 -- 국경선 완전 누락 (OHM/CShapes 모두 없음)')
print('=' * 80)
t1_none = sorted([r for r in results if r['tier'] == 1 and r['no_border']],
                  key=lambda x: x.get('start') or 9999)
for r in t1_none:
    s = r['start'] if r['start'] is not None else '?'
    e = r['end'] if r['end'] is not None else '?'
    print(f"  {r['qid']:12s} {r['name']:<30s} {s} ~ {e}")
print(f"  => 총 {len(t1_none)}개\n")

print('=' * 80)
print('T1 -- 부분 누락 (일부 시대에 갭 존재)')
print('=' * 80)
t1_gaps = sorted([r for r in results if r['tier'] == 1 and not r['no_border'] and r['gaps']],
                  key=lambda x: x.get('start') or 9999)
for r in t1_gaps:
    s = r['start'] if r['start'] is not None else '?'
    e = r['end'] if r['end'] is not None else '?'
    src = []
    if r['has_ohm']:
        mn = ' *manual*' if r['is_manual'] else ''
        snaps = ', '.join(f"{sn['start']}~{sn['end']}" for sn in r['ohm_snaps'])
        src.append(f"OHM[{snaps}]{mn}")
    if r['has_cs']:
        src.append(f"CS[{r['cs_range']}]")
    gap_str = ', '.join(f"{g[0]}~{g[1]}" for g in r['gaps'])
    print(f"  {r['qid']:12s} {r['name']:<30s} {s}~{e}")
    print(f"               src: {' + '.join(src)}")
    print(f"               GAP: {gap_str}")
print(f"  => 총 {len(t1_gaps)}개\n")

print('=' * 80)
print('T1 -- 완전 커버 (갭 없음)')
print('=' * 80)
t1_full = sorted([r for r in results if r['tier'] == 1 and not r['no_border'] and not r['gaps']],
                  key=lambda x: x.get('start') or 9999)
for r in t1_full:
    s = r['start'] if r['start'] is not None else '?'
    e = r['end'] if r['end'] is not None else '?'
    src = []
    if r['has_ohm']:
        mn = ' *manual*' if r['is_manual'] else ''
        snaps = ', '.join(f"{sn['start']}~{sn['end']}" for sn in r['ohm_snaps'])
        src.append(f"OHM[{snaps}]{mn}")
    if r['has_cs']:
        src.append(f"CS[{r['cs_range']}]")
    print(f"  {r['qid']:12s} {r['name']:<30s} {s}~{e}  src={' + '.join(src)}")
print(f"  => 총 {len(t1_full)}개\n")

print('=' * 80)
print('T2 -- 국경선 완전 누락 (상위 60개)')
print('=' * 80)
t2_none = sorted([r for r in results if r['tier'] == 2 and r['no_border']],
                  key=lambda x: x.get('start') or 9999)
for r in t2_none[:60]:
    s = r['start'] if r['start'] is not None else '?'
    e = r['end'] if r['end'] is not None else '?'
    print(f"  {r['qid']:12s} {r['name']:<30s} {s} ~ {e}")
print(f"  => 총 {len(t2_none)}개 (상위 60개 표시)\n")

print('=' * 80)
print('T2 -- 부분 누락 (갭 길이 TOP 30)')
print('=' * 80)
t2_gaps = [r for r in results if r['tier'] == 2 and not r['no_border'] and r['gaps']]
for r in t2_gaps:
    r['gap_total'] = sum(g[1] - g[0] for g in r['gaps'])
t2_gaps.sort(key=lambda x: -x['gap_total'])
for r in t2_gaps[:30]:
    s = r['start'] if r['start'] is not None else '?'
    e = r['end'] if r['end'] is not None else '?'
    src = []
    if r['has_ohm']:
        mn = ' *manual*' if r['is_manual'] else ''
        snaps = ', '.join(f"{sn['start']}~{sn['end']}" for sn in r['ohm_snaps'])
        src.append(f"OHM[{snaps}]{mn}")
    if r['has_cs']:
        src.append(f"CS[{r['cs_range']}]")
    gap_str = ', '.join(f"{g[0]}~{g[1]}" for g in r['gaps'])
    print(f"  {r['qid']:12s} {r['name']:<30s} {s}~{e}  gap={r['gap_total']}yr")
    print(f"               src: {' + '.join(src)}")
    print(f"               GAP: {gap_str}")
print(f"  => 총 {len(t2_gaps)}개 (상위 30개 표시)\n")

# 요약
print('=' * 80)
print('SUMMARY')
print('=' * 80)
t1_total = len([r for r in results if r['tier'] == 1])
t2_total = len([r for r in results if r['tier'] == 2])
print(f"  T1: 총 {t1_total}개 | 완전커버={len(t1_full)} | 부분커버={len(t1_gaps)} | 완전누락={len(t1_none)}")
t2_full_cnt = len([r for r in results if r['tier'] == 2 and not r['no_border'] and not r['gaps']])
print(f"  T2: 총 {t2_total}개 | 완전커버={t2_full_cnt} | 부분커버={len(t2_gaps)} | 완전누락={len(t2_none)}")
