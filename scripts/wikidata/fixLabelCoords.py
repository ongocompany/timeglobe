#!/usr/bin/env python3
"""
[cl] Fix label coordinates: 수도 → 국토 지리적 무게중심
- OHM 폴리곤 있는 엔티티: 폴리곤 무게중심(centroid) 자동 계산
- 해외 영토 보유국 / 큰 나라: curated 본토 중심 좌표 적용
- 나머지: 기존 좌표 유지 (수도가 중앙인 소국 등)

Usage:
    python3 scripts/wikidata/fixLabelCoords.py [--dry-run]
"""

import json
import os
import sys
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CIRCLES_PATH = os.path.join(BASE_DIR, 'public', 'geo', 'borders', 'wikidata_circles.json')
OHM_INDEX_PATH = os.path.join(BASE_DIR, 'public', 'geo', 'borders', 'ohm_index.json')
OHM_DIR = os.path.join(BASE_DIR, 'public', 'geo', 'borders', 'ohm')

# ──────────────────────────────────────────────────────────────────────────────
# 해외 영토 보유로 자동 centroid가 엉뚱한 데 나올 수 있는 나라 → curated 좌표 우선
# ──────────────────────────────────────────────────────────────────────────────

# curated geographic centers (mainland 기준, 수도 ≠ 국토 중심인 나라들)
# QID 확인: wikidata_circles.json 기준
# 형식: QID -> (lat, lon)
CURATED_CENTERS: dict[str, tuple[float, float]] = {

    # ── 북아메리카 ──
    'Q30':   (39.50, -98.35),   # 미국 본토 중심 (캔자스주 부근, DC는 동쪽 끝)
    'Q16':   (62.00, -96.00),   # 캐나다 (누나부트/매니토바 경계)
    'Q96':   (24.00, -102.50),  # 멕시코 (할리스코 북부)

    # ── 남아메리카 ──
    'Q155':  (-10.00, -53.00),  # 브라질 (마투그로수 중부)
    'Q414':  (-34.00, -64.00),  # 아르헨티나 (라팜파 주)
    'Q298':  (-35.50, -71.50),  # 칠레 본토 (산티아고 남방 중부)
    'Q733':  (-23.00, -58.00),  # 파라과이
    'Q750':  (-17.00, -65.00),  # 볼리비아
    'Q717':  (8.00,  -66.00),   # 베네수엘라
    'Q739':  (2.00,  -74.00),   # 콜롬비아 (내륙 중심, 안데스 동쪽)
    'Q736':  (-1.50, -78.00),   # 에콰도르
    'Q419':  (-10.00, -74.00),  # 페루 (안데스 중부)

    # ── 유럽 (수도가 극단에 치우친 나라들) ──
    'Q183':  (51.20,  10.45),   # 독일 (카셀 서쪽, 베를린은 동쪽 끝)
    'Q34':   (62.00,  15.50),   # 스웨덴 (달라르나 부근, 스톡홀름은 동남 해안)
    'Q33':   (62.50,  26.00),   # 핀란드 (위베스퀼레 부근, 헬싱키는 남쪽 끝)
    'Q20':   (65.00,  14.00),   # 노르웨이 본토 중심 (스발바르 제외)
    'Q40':   (47.50,  13.50),   # 오스트리아 (잘츠캄머구트, 빈은 동쪽 끝)
    'Q36':   (52.00,  19.50),   # 폴란드 (바르샤바 약간 서쪽)
    'Q38':   (43.00,  12.50),   # 이탈리아 (아펜니노 중부, 로마는 남서쪽)
    'Q29':   (40.00,  -3.70),   # 스페인 본토 (마드리드 부근, 이미 거의 중앙)
    'Q211':  (56.90,  24.50),   # 라트비아 (리가는 서쪽 해안)
    'Q191':  (58.70,  25.50),   # 에스토니아 (탈린은 북쪽 끝)
    'Q37':   (55.50,  23.80),   # 리투아니아

    # ── 아시아 (대국들) ──
    'Q159':  (64.00,  97.00),   # 러시아 (예벤키 지역, 시베리아 중앙 — 모스크바는 서쪽 끝)
    'Q148':  (36.50, 103.00),   # 중국 (란저우 서쪽, 베이징은 북동쪽 끝)
    'Q668':  (22.00,  82.50),   # 인도 (마디야프라데시, 뉴델리는 북부)
    'Q232':  (47.00,  68.00),   # 카자흐스탄 (중부 스텝, 아스타나 북쪽 편)
    'Q711':  (46.50, 103.00),   # 몽골 (둔드고비, 울란바토르는 북쪽 편)
    'Q878':  (23.50,  54.00),   # 아랍에미리트 (아부다비 내륙)
    'Q43':   (39.50,  35.50),   # 튀르키예 (키르셰히르 부근, 아나톨리아 중심)
    'Q17':   (36.50, 137.50),   # 일본 (기후현, 도쿄는 동쪽 해안)
    'Q252':  (-2.00, 118.00),   # 인도네시아 (보르네오/술라웨시 사이 중심)
    # Q236 = 몬테네그로 (소국, 수도가 중앙이므로 제외)
    'Q869':  (15.50, 101.00),   # 태국 (나콘랏차시마 부근)
    'Q881':  (16.50, 107.00),   # 베트남 (중부 다낭 인근)
    'Q794':  (32.50,  54.00),   # 이란 (이스파한 동쪽)
    'Q889':  (33.50,  65.50),   # 아프가니스탄
    'Q843':  (30.00,  70.00),   # 파키스탄 (인더스강 중류)
    'Q928':  (12.00, 122.00),   # 필리핀 (비사야 중심)
    'Q265':  (41.50,  63.00),   # 우즈베키스탄 (타슈켄트 서쪽, 중부)
    'Q114':  (0.50,   37.50),   # 케냐 (나이로비보다 북쪽)
    'Q805':  (15.50,  47.00),   # 예멘 (사나는 서쪽, 중심은 중부)

    # ── 아프리카 (수도가 해안이나 극단에 있는 나라들) ──
    'Q1049': (15.00,  30.00),   # 수단 (하르툼은 북쪽, 중심은 중부)
    'Q1048': (15.00,  19.00),   # 차드 (N'자메나는 남서쪽, 중심은 중부 사막)
    'Q1032': (17.00,   9.00),   # 니제르 (니아메는 남서쪽, 국토 중심은 북부)
    'Q965':  (13.00,  -1.50),   # 부르키나파소
    'Q262':  (28.00,   2.00),   # 알제리 (알제는 북쪽 끝, 중심은 사하라)
    'Q1016': (27.00,  17.00),   # 리비아 (트리폴리는 북서쪽, 중심은 사막)
    'Q1028': (31.00,  -6.00),   # 모로코 본토 (카사블랑카는 서쪽 해안)
    'Q1033': (9.50,    8.50),   # 나이지리아 (아부자 동쪽, 국토 중심)
    'Q115':  (8.00,   38.00),   # 에티오피아 (아디스아바바 서쪽)
    'Q1009': (5.50,   12.50),   # 카메룬
    'Q117':  (7.50,   -1.00),   # 가나
    'Q912':  (17.00,  -4.00),   # 말리 (바마코는 남쪽 끝, 중심은 사헬)
    'Q1008': (7.00,   -6.00),   # 코트디부아르
    'Q953':  (-15.00,  28.00),  # 잠비아
    'Q954':  (-20.00,  29.50),  # 짐바브웨
    'Q929':  (6.50,   20.00),   # 중앙아프리카공화국
    'Q916':  (-11.00,  18.00),  # 앙골라 (루안다는 북서쪽 해안)
    'Q924':  (-6.50,   35.00),  # 탄자니아 (다르에스살람은 동쪽 해안)
    'Q971':  (-1.00,   15.00),  # 콩고 공화국

    # ── 오세아니아 ──
    'Q408':  (-27.00, 133.00),  # 호주 (앨리스스프링스 서쪽, 캔버라는 동남 해안)

    # ── 해외 영토 보유국 (본토 중심만) ──
    'Q142':  (46.00,   2.00),   # 프랑스 본토 (부르주 부근, 기아나·마르티니크 제외)
    'Q145':  (52.50,  -1.50),   # 영국 본토 (잉글랜드 중부 레스터셔, 해외령 제외)
    'Q55':   (52.30,   5.50),   # 네덜란드 본토 (위트레흐트 동쪽, 카리브 제외)
    'Q35':   (56.00,  10.00),   # 덴마크 본토 (그린란드 제외, 유틀란트 중부)
    'Q45':   (39.60,  -8.00),   # 포르투갈 본토 (아조레스·마데이라 제외)

    # ── 아시아 추가 ──
    'Q851':  (24.00,  44.50),   # 사우디아라비아 (리야드는 동쪽 편, 중심은 나즈드)
    'Q796':  (33.00,  43.50),   # 이라크 (바그다드는 중심에 가까우나 약간 보정)
    'Q858':  (35.00,  38.00),   # 시리아 (다마스쿠스는 남서쪽, 중심은 중부)

    # ── 역사적 주요 제국 (OHM 없는 경우 fallback) ──
    # Q12544 = 동로마 제국 (Byzantine) → OHM 처리
    # Q12548 = 신성 로마 제국 → OHM 처리
    'Q3044':  (38.00,  35.00),  # 히타이트 (아나톨리아 중부)
    'Q11768': (27.00,  30.00),  # 고대 이집트 (나일강 중류)
}

# ──────────────────────────────────────────────────────────────────────────────
# 폴리곤 무게중심 계산 (표준 polygon centroid formula)
# ──────────────────────────────────────────────────────────────────────────────

def polygon_centroid(coords: list[list[float]]) -> tuple[float, float]:
    """외곽 링(외환) 좌표 리스트 → (cx, cy) 무게중심 반환"""
    n = len(coords)
    if n == 0:
        return (0.0, 0.0)
    if n == 1:
        return (coords[0][0], coords[0][1])

    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n - 1):
        x0, y0 = coords[i][0], coords[i][1]
        x1, y1 = coords[i + 1][0], coords[i + 1][1]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area /= 2.0
    if abs(area) < 1e-10:
        # 면적이 거의 0 → 단순 평균
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    cx /= (6.0 * area)
    cy /= (6.0 * area)
    return (cy, cx)  # (lat, lon)


def ring_area(coords: list[list[float]]) -> float:
    """링의 절대 면적(signed area formula, 단위 없음)"""
    n = len(coords)
    area = 0.0
    for i in range(n - 1):
        area += coords[i][0] * coords[i + 1][1]
        area -= coords[i + 1][0] * coords[i][1]
    return abs(area) / 2.0


def compute_geojson_centroid(filepath: str) -> tuple[float, float] | None:
    """GeoJSON 파일에서 가장 큰 폴리곤의 무게중심 반환 (lat, lon)"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            gj = json.load(f)
    except Exception:
        return None

    rings = []  # [(area, coords), ...]

    def collect_rings(geometry):
        if geometry is None:
            return
        gtype = geometry.get('type', '')
        coords = geometry.get('coordinates', [])
        if gtype == 'Polygon':
            if coords:
                rings.append((ring_area(coords[0]), coords[0]))
        elif gtype == 'MultiPolygon':
            for poly in coords:
                if poly:
                    rings.append((ring_area(poly[0]), poly[0]))
        elif gtype == 'GeometryCollection':
            for geom in geometry.get('geometries', []):
                collect_rings(geom)

    if gj.get('type') == 'FeatureCollection':
        for feat in gj.get('features', []):
            collect_rings(feat.get('geometry'))
    elif gj.get('type') == 'Feature':
        collect_rings(gj.get('geometry'))
    else:
        collect_rings(gj)

    if not rings:
        return None

    # 가장 큰 링의 무게중심 사용
    rings.sort(key=lambda x: x[0], reverse=True)
    return polygon_centroid(rings[0][1])


# ──────────────────────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv

    print(f"{'[DRY-RUN] ' if dry_run else ''}좌표 보정 시작...")

    # 데이터 로드
    with open(CIRCLES_PATH, 'r', encoding='utf-8') as f:
        circles = json.load(f)
    with open(OHM_INDEX_PATH, 'r', encoding='utf-8') as f:
        ohm_index = json.load(f)

    # OHM index 구성: qid → snapshots 리스트
    ohm_map: dict[str, list] = {}
    for entry in ohm_index:
        qid = entry['qid']
        # MANUAL_ 접두어 처리
        raw_qid = qid.replace('MANUAL_', '')
        if raw_qid not in ohm_map:
            ohm_map[raw_qid] = []
        for snap in entry.get('snapshots', []):
            ohm_map[raw_qid].append({
                'file': snap['file'],
                'start': snap.get('start', entry.get('start_year', 0)),
                'end': snap.get('end', entry.get('end_year', 9999)),
            })

    stats = {
        'total': len(circles),
        'ohm_centroid': 0,
        'curated': 0,
        'unchanged': 0,
        'ohm_fail': 0,
    }

    for entity in circles:
        qid = entity.get('qid', '')
        orig_lat = entity.get('lat')
        orig_lon = entity.get('lon')
        name = entity.get('name_ko') or entity.get('name_en', qid)

        # ── 1순위: curated 오버라이드 ──
        if qid in CURATED_CENTERS:
            new_lat, new_lon = CURATED_CENTERS[qid]
            if not dry_run:
                entity['lat'] = new_lat
                entity['lon'] = new_lon
            dist = _approx_dist(orig_lat, orig_lon, new_lat, new_lon)
            print(f"  [curated] {qid} {name}: ({orig_lat:.1f},{orig_lon:.1f}) → ({new_lat:.1f},{new_lon:.1f})  dist={dist:.0f}km")
            stats['curated'] += 1
            continue

        # ── 2순위: OHM 폴리곤 무게중심 ──
        if qid in ohm_map:
            snaps = ohm_map[qid]
            # 대표 스냅샷 선택: start/end 중간 시점에 가장 가까운 것
            mid_year = entity.get('start_year', 0)
            if entity.get('end_year') and entity['end_year'] < 9000:
                mid_year = (entity.get('start_year', 0) + entity['end_year']) // 2

            best_snap = min(snaps, key=lambda s: abs(
                ((s['start'] or 0) + (s['end'] or 2025)) / 2 - mid_year
            ))
            filepath = os.path.join(OHM_DIR, best_snap['file'])

            if os.path.exists(filepath):
                result = compute_geojson_centroid(filepath)
                if result:
                    new_lat, new_lon = result
                    # 위도/경도 범위 체크
                    if -90 <= new_lat <= 90 and -180 <= new_lon <= 180:
                        dist = _approx_dist(orig_lat, orig_lon, new_lat, new_lon)
                        if dist > 50:  # 50km 이상 이동할 때만 적용 (소국 무시)
                            if not dry_run:
                                entity['lat'] = round(new_lat, 4)
                                entity['lon'] = round(new_lon, 4)
                            print(f"  [ohm]    {qid} {name}: ({orig_lat:.1f},{orig_lon:.1f}) → ({new_lat:.2f},{new_lon:.2f})  dist={dist:.0f}km")
                            stats['ohm_centroid'] += 1
                            continue
            else:
                stats['ohm_fail'] += 1

        stats['unchanged'] += 1

    print(f"\n완료! 결과:")
    print(f"  curated 적용: {stats['curated']}개")
    print(f"  OHM centroid: {stats['ohm_centroid']}개")
    print(f"  변경 없음:    {stats['unchanged']}개")
    print(f"  OHM 파일 없음: {stats['ohm_fail']}개")

    if not dry_run:
        with open(CIRCLES_PATH, 'w', encoding='utf-8') as f:
            json.dump(circles, f, ensure_ascii=False, separators=(',', ':'))
        print(f"\n✅ {CIRCLES_PATH} 저장 완료")
    else:
        print("\n[DRY-RUN] 실제 저장 안 함")


def _approx_dist(lat1, lon1, lat2, lon2) -> float:
    """대략적 km 거리 (Haversine)"""
    if lat1 is None or lon1 is None:
        return 0.0
    try:
        R = 6371
        dlat = math.radians(lat2 - float(lat1))
        dlon = math.radians(lon2 - float(lon1))
        a = math.sin(dlat/2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.asin(math.sqrt(a))
    except Exception:
        return 0.0


if __name__ == '__main__':
    main()
