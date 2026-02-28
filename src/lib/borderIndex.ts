// [cl] 역사 국경 GeoJSON 하이브리드 인덱스 + 연도 매칭
// historical-basemaps: BC 123000 ~ AD 1880 (43개 스냅샷, nearest match)
// CShapes 2.0: AD 1886 ~ 2015 (117개 transition year, floor match)

export interface BorderSnapshot {
  year: number; // BC = 음수 (e.g. -2000 = BC 2000)
  file: string; // e.g. "world_1900.geojson" or "cshapes_1920.geojson"
}

let _index: BorderSnapshot[] | null = null;

// [cl] CShapes 2.0 데이터 시작 연도 (ETH ICR, 1886~2019)
const CSHAPES_START = 1886;

/** [cl] 인덱스 로드 + 캐싱 */
export async function loadBorderIndex(): Promise<BorderSnapshot[]> {
  if (_index) return _index;
  const res = await fetch("/geo/borders/index.json");
  _index = (await res.json()) as BorderSnapshot[];
  return _index;
}

/**
 * [cl] targetYear에 맞는 스냅샷 찾기 (하이브리드 매칭)
 *
 * - targetYear < 1886: historical-basemaps에서 nearest match
 *   (스냅샷 간격이 넓어서 가장 가까운 연도 사용)
 * - targetYear >= 1886: CShapes에서 floor match
 *   (국경 변동 이벤트 기반 → 직전 변동 연도가 정확한 국경)
 *
 * 예시:
 * - targetYear=1875 → world_1880.geojson (nearest)
 * - targetYear=1929 → cshapes_1928.geojson (floor: 1930에 변동 발생 전)
 * - targetYear=2026 → cshapes_2015.geojson (범위 초과 → 마지막)
 */
export function findClosestSnapshot(
  index: BorderSnapshot[],
  targetYear: number,
): BorderSnapshot {
  if (index.length === 0) throw new Error("Border index is empty");

  // [cl] CShapes/HB 경계 인덱스 찾기 (정렬된 배열에서 첫 CShapes 엔트리)
  let csStartIdx = index.length;
  for (let i = 0; i < index.length; i++) {
    if (index[i].year >= CSHAPES_START) { csStartIdx = i; break; }
  }

  // ── CShapes 영역 (1886+): floor match ──
  if (targetYear >= CSHAPES_START && csStartIdx < index.length) {
    const last = index.length - 1;
    if (targetYear >= index[last].year) return index[last];
    if (targetYear < index[csStartIdx].year) return index[csStartIdx];

    // [cl] 이진탐색: 가장 큰 year <= targetYear 찾기 (floor)
    let lo = csStartIdx;
    let hi = last;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (index[mid].year <= targetYear) lo = mid;
      else hi = mid - 1;
    }
    return index[lo];
  }

  // ── Historical-basemaps 영역 (< 1886): nearest match ──
  const hbEnd = csStartIdx - 1;
  if (hbEnd < 0) return index[0];
  if (targetYear <= index[0].year) return index[0];
  if (targetYear >= index[hbEnd].year) return index[hbEnd];

  // [cl] 이진탐색으로 floor 위치 찾기
  let lo = 0;
  let hi = hbEnd;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (index[mid].year <= targetYear) lo = mid;
    else hi = mid - 1;
  }

  // [cl] floor(lo)와 ceil(lo+1) 중 더 가까운 쪽 선택
  if (lo + 1 <= hbEnd) {
    const diffFloor = targetYear - index[lo].year;
    const diffCeil = index[lo + 1].year - targetYear;
    if (diffCeil < diffFloor) return index[lo + 1];
  }

  return index[lo];
}
