// [cl] 역사 국경 GeoJSON 스냅샷 인덱스 + 연도 매칭
// historical-basemaps 데이터셋: BC 123000 ~ AD 2010 (53개 스냅샷)

export interface BorderSnapshot {
  year: number; // BC = 음수 (e.g. -2000 = BC 2000)
  file: string; // e.g. "world_1900.geojson"
}

let _index: BorderSnapshot[] | null = null;

/** [cl] 인덱스 로드 + 캐싱 */
export async function loadBorderIndex(): Promise<BorderSnapshot[]> {
  if (_index) return _index;
  const res = await fetch("/geo/borders/index.json");
  _index = (await res.json()) as BorderSnapshot[];
  return _index;
}

/**
 * [cl] targetYear에 가장 가까운 스냅샷을 이진탐색으로 찾기 (nearest match)
 * - targetYear=1875 → world_1880.geojson (5년 차이 vs 1815의 60년)
 * - targetYear=1914 → world_1914.geojson (exact)
 * - targetYear=2026 → world_2010.geojson (범위 초과 → 마지막)
 */
export function findClosestSnapshot(
  index: BorderSnapshot[],
  targetYear: number,
): BorderSnapshot {
  if (index.length === 0) throw new Error("Border index is empty");
  if (targetYear <= index[0].year) return index[0];
  if (targetYear >= index[index.length - 1].year) return index[index.length - 1];

  // [cl] 이진탐색으로 floor 위치 찾기
  let lo = 0;
  let hi = index.length - 1;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (index[mid].year <= targetYear) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  // [cl] floor(lo)와 ceil(lo+1) 중 더 가까운 쪽 선택
  if (lo + 1 < index.length) {
    const diffFloor = targetYear - index[lo].year;
    const diffCeil = index[lo + 1].year - targetYear;
    if (diffCeil < diffFloor) return index[lo + 1];
  }

  return index[lo];
}
