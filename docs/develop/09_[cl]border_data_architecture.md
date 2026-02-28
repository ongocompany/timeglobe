# 역사 국경선 데이터 아키텍처

> 작성: 민철(cl) | 2026-02-28
> TimeGlobe의 타임라인별 국경/지도 데이터 구조, 소스, 매칭 알고리즘, 메타데이터 파이프라인을 정리한 문서

---

## 1. 전체 구조 개요

TimeGlobe는 **BC 123000 ~ AD 2015** 범위를 커버하며, 두 개의 독립적인 데이터 소스를 **하이브리드 인덱스**로 통합해서 사용한다.

```
타임라인 전체 범위
═══════════════════════════════════════════════════════════════
BC 123000                    AD 1880  1886                  2015
├──── Historical-Basemaps ────┤├──── CShapes 2.0 ────────────┤
      43개 스냅샷 (sparse)     │    117개 스냅샷 (dense)
                               │
                          전환 경계 (6년 갭)
```

| 구분 | Historical-Basemaps (HB) | CShapes 2.0 |
|------|--------------------------|-------------|
| **기간** | BC 123000 ~ AD 1880 | AD 1886 ~ AD 2015 |
| **출처** | [historical-basemaps](https://github.com/aourednik/historical-basemaps) | [CShapes 2.0](https://icr.ethz.ch/data/cshapes/) (ETH ICR) |
| **스냅샷 수** | 43개 | 117개 |
| **시간 간격** | 불규칙 (100~3000년) | 이벤트 기반 (대부분 1년 단위) |
| **파일 네이밍** | `world_{연도}.geojson` | `cshapes_{연도}.geojson` |
| **매칭 방식** | Nearest (가장 가까운 연도) | Floor (직전 변동 연도) |
| **총 GeoJSON 파일** | 53개 (미사용 포함) | 117개 |

> **참고**: `world_` 파일은 디스크에 53개 존재하지만, `index.json`에 등록된 것은 43개다. 1886 이후 `world_` 파일(1900, 1914, 1920 등)은 CShapes와 중복되므로 인덱스에서 제외됨.

---

## 2. 파일 구조

### 2.1 디렉토리 레이아웃

```
public/geo/borders/
├── index.json                    ← 160개 스냅샷 인덱스 (HB 43 + CShapes 117)
├── world_bc123000.geojson        ← HB: BC 123000
├── world_bc10000.geojson         ← HB: BC 10000
├── ...                           ← (43개 HB 스냅샷)
├── world_1880.geojson            ← HB: AD 1880 (HB 마지막)
├── cshapes_1886.geojson          ← CShapes: AD 1886 (CShapes 시작)
├── cshapes_1887.geojson
├── ...                           ← (117개 CShapes 스냅샷)
├── cshapes_2015.geojson          ← CShapes: AD 2015 (CShapes 마지막)
└── metadata/
    ├── 1880.json                 ← HB용 메타데이터 (1개)
    ├── 1886.json                 ← CShapes용 메타데이터
    ├── ...                       ← (119개 메타데이터 파일)
    └── 2015.json
```

### 2.2 인덱스 파일 (`index.json`)

연도순 정렬된 160개 엔트리. 프론트엔드에서 연도 → GeoJSON 파일 매핑에 사용.

```json
[
  {"year": -123000, "file": "world_bc123000.geojson"},
  {"year": -10000,  "file": "world_bc10000.geojson"},
  ...
  {"year": 1880,    "file": "world_1880.geojson"},
  {"year": 1886,    "file": "cshapes_1886.geojson"},
  {"year": 1887,    "file": "cshapes_1887.geojson"},
  ...
  {"year": 2015,    "file": "cshapes_2015.geojson"}
]
```

---

## 3. GeoJSON 데이터 구조 비교

### 3.1 Historical-Basemaps (HB) 포맷

```json
{
  "type": "Feature",
  "properties": {
    "NAME": "Joseon",
    "ABBREVN": "Joseon",
    "SUBJECTO": "Joseon",
    "BORDERPRECISION": 3,
    "PARTOF": "Joseon"
  },
  "geometry": { "type": "MultiPolygon", "coordinates": [...] }
}
```

| 필드 | 설명 |
|------|------|
| `NAME` | 국가/세력명 (ENTITY_RULES 매핑 키) |
| `ABBREVN` | 약칭 |
| `SUBJECTO` | 종속 관계 |
| `BORDERPRECISION` | 국경 정밀도 (1~5) |
| `PARTOF` | 소속 세력 |

**특징**: 수도 좌표 없음, 간결한 5필드 구조

### 3.2 CShapes 2.0 포맷

```json
{
  "type": "Feature",
  "properties": {
    "NAME": "Korea",
    "cshapes_name": "Korea/South Korea",
    "caplong": 126.98,
    "caplat": 37.57,
    "capname": "Seoul"
  },
  "geometry": { "type": "MultiPolygon", "coordinates": [...] }
}
```

| 필드 | 설명 |
|------|------|
| `NAME` | 국가명 (ENTITY_RULES 매핑 키) |
| `cshapes_name` | CShapes 원본 정식 명칭 |
| `caplong` | 수도 경도 |
| `caplat` | 수도 위도 |
| `capname` | 수도명 |

**특징**: 수도 좌표 포함, `NAME` ≠ `cshapes_name`인 경우 있음

### 3.3 핵심 차이점

| 항목 | HB | CShapes |
|------|-----|---------|
| 수도 좌표 | **없음** (CAPITAL_COORDS로 보완) | 있음 (caplong/caplat) |
| 엔트리 매핑 키 | NAME 직접 사용 | NAME 사용 (cshapes_name은 참고용) |
| 파일 크기 | 750KB ~ 2.4MB | 875KB ~ 1.6MB |
| 지오메트리 | MultiPolygon | MultiPolygon |

---

## 4. 연도 매칭 알고리즘 (하이브리드)

**파일**: `src/lib/borderIndex.ts`

사용자가 선택한 연도(targetYear)에 가장 적합한 GeoJSON 스냅샷을 찾는 이진탐색 알고리즘.

### 4.1 경계 기준

```
targetYear < 1886  → Historical-Basemaps 영역 → Nearest Match
targetYear >= 1886 → CShapes 영역            → Floor Match
```

### 4.2 Nearest Match (HB 영역)

HB는 스냅샷 간격이 넓어서(100~3000년), 절대 거리가 가장 가까운 스냅샷을 선택.

```
예시: targetYear = 1750
  floor  = world_1700.geojson (차이: 50년)
  ceil   = world_1715.geojson (차이: 35년)
  → world_1715.geojson 선택 (더 가까움)

예시: targetYear = -2500
  floor  = world_bc3000.geojson (차이: 500년)
  ceil   = world_bc2000.geojson (차이: 500년)
  → world_bc3000.geojson 선택 (동점이면 floor 우선)
```

### 4.3 Floor Match (CShapes 영역)

CShapes는 국경 변동 이벤트 기반이라, 해당 연도 이전의 가장 최근 변동 스냅샷을 선택.

```
예시: targetYear = 1929
  cshapes_1928.geojson (year=1928) ← 선택 (직전 변동)
  cshapes_1930.geojson (year=1930) ← 1930에 새 변동이 생김
  → cshapes_1928.geojson (1929년의 국경 = 1928 변동 이후 상태)

예시: targetYear = 2026 (범위 초과)
  → cshapes_2015.geojson (마지막 스냅샷)
```

**Floor를 쓰는 이유**: CShapes의 각 연도 파일은 "해당 연도에 변동이 발생한 시점"을 나타냄. 1929년의 국경은 1928년 변동 이후 ~ 1930년 변동 이전 상태이므로, 1928이 정확한 답.

---

## 5. 메타데이터 시스템

### 5.1 메타데이터 JSON 구조

**파일**: `public/geo/borders/metadata/{year}.json`

각 스냅샷 연도별로 하나의 메타데이터 JSON이 존재. GeoJSON의 `NAME` 값을 키로 사용.

```json
{
  "Korea": {
    "display_name": "대한제국 (Korea)",
    "display_name_en": "Korea",
    "display_name_local": "대한제국",
    "display_name_ko": "대한제국",
    "is_colony": true,
    "fill_color": "#45B39D",
    "confidence": "high",
    "colonial_ruler": "大日本帝国",
    "colonial_ruler_ko": "대일본제국",
    "colonial_note": "Under 大日本帝国 Rule",
    "capital_coords": [126.98, 37.57]
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `display_name` | string | **화면 표시용** — `"한국어 (English)"` 형식 |
| `display_name_en` | string | 영문명 |
| `display_name_local` | string | 자국어명 (향후 영문 서비스용 보존) |
| `display_name_ko` | string | 한국어명 |
| `is_colony` | boolean | 식민지 여부 |
| `fill_color` | string | 문명권 기반 HEX 색상 |
| `confidence` | string | `"high"` 또는 `"low"` (매핑 신뢰도) |
| `colonial_ruler` | string? | 지배국명 (is_colony일 때) |
| `colonial_ruler_ko` | string? | 지배국 한국어명 |
| `colonial_note` | string? | 식민 상태 설명 |
| `capital_coords` | [lng, lat]? | 수도 좌표 (라벨 위치 결정) |
| `independence_year` | number? | 독립 연도 |

### 5.2 가상 엔트리 (Virtual Entries)

GeoJSON에는 별도 폴리곤이 없지만, 라벨은 따로 표시해야 하는 경우 사용.

키 패턴: `__virtual__` 접두사

```json
{
  "__virtual__Korea_under_Japan": {
    "display_name": "대한제국 (Korea)",
    "display_name_en": "Korea",
    "display_name_ko": "대한제국",
    "is_colony": true,
    "colonial_ruler": "Empire of Japan",
    "colonial_ruler_ko": "대일본제국",
    "capital_coords": [126.98, 37.57],
    "fill_color": "#45B39D",
    "confidence": "high"
  }
}
```

**현재 가상 엔트리 목록**:
| 가상 엔트리 | 적용 기간 | 부모 국가 | 설명 |
|-------------|-----------|-----------|------|
| `__virtual__Korea_under_Japan` | 1910~1945 | Empire of Japan | 일제강점기 한국 라벨 |
| `__virtual__Taiwan_under_Japan` | 1895~1945 | Empire of Japan | 일제치하 대만 라벨 |

**렌더링 규칙**: 가상 엔트리가 존재하면, 부모 국가(Empire of Japan)의 라벨은 숨기고 가상 엔트리 라벨만 표시.

---

## 6. 메타데이터 생성 파이프라인

### 6.1 스크립트

**파일**: `scripts/geo/generateBorderMetadata.py`

### 6.2 핵심 데이터 딕셔너리

```
                                 ┌─────────────────┐
     GeoJSON NAME ──────────────→│  ENTITY_RULES   │← 448개 엔트리
                                 │  name_local      │   (GeoJSON NAME → 기본 메타데이터)
                                 │  name_en         │
                                 │  palette         │
                                 │  colony/ruler    │
                                 └────────┬────────┘
                                          │
                           ┌──────────────┼──────────────┐
                           ▼              ▼              ▼
                  ┌────────────┐  ┌──────────────┐  ┌──────────┐
                  │YEAR_RANGE  │  │CAPITAL_COORDS│  │KOREAN    │
                  │OVERRIDES   │  │  (~250개)    │  │NAMES     │
                  │  (~30개)   │  │  [lng, lat]  │  │ (~346개) │
                  └────────────┘  └──────────────┘  └──────────┘
                  시대별 이름/     라벨 위치 좌표     영문명→한국어
                  상태 덮어쓰기
                           │              │              │
                           ▼              ▼              ▼
                  ┌──────────────────────────────────────────┐
                  │         generate_entity_metadata()        │
                  │  1. ENTITY_RULES 기본값 적용              │
                  │  2. YEAR_RANGE_OVERRIDES 덮어쓰기         │
                  │  3. KOREAN_NAMES 한국어 변환              │
                  │  4. CAPITAL_COORDS 좌표 주입              │
                  │  5. PALETTES 색상 매핑                    │
                  └────────────────────┬─────────────────────┘
                                       │
                           ┌───────────┴───────────┐
                           ▼                       ▼
                  ┌────────────────┐     ┌─────────────────┐
                  │ 일반 엔트리     │     │COLONIAL_OVERLAYS│
                  │ (GeoJSON 기반) │     │ (가상 엔트리)     │
                  └────────┬───────┘     └────────┬────────┘
                           │                      │
                           ▼                      ▼
                  ┌────────────────────────────────────────┐
                  │      metadata/{year}.json 출력          │
                  └────────────────────────────────────────┘
```

### 6.3 주요 딕셔너리 설명

#### ENTITY_RULES (448개)
GeoJSON의 `NAME` 값을 키로, 기본 메타데이터를 정의.

```python
"Manchu Empire": {
    "name_local": "大清帝國",
    "name_en": "Qing Dynasty",
    "palette": "EastAsia"
},
"Hong Kong": {
    "name_local": "香港",
    "name_en": "Hong Kong",
    "colony": True,
    "ruler": "British Empire",
    "palette": "EastAsia"
}
```

#### YEAR_RANGE_OVERRIDES (~30개)
특정 시대에 국명/상태가 바뀌는 경우 덮어쓰기.

```python
("Korea", 1897, 1910): {"name_local": "대한제국", "name_en": "Korean Empire"},
("Korea", 1910, 1945): {"name_local": "대한제국", "name_en": "Korea", "name_ko": "대한제국",
                         "colony": True, "ruler": "大日本帝国"},
("China", 1886, 1911): {"name_local": "大清帝國", "name_en": "Qing Dynasty"},
("China", 1912, 1949): {"name_local": "中華民國", "name_en": "Republic of China"},
```

키 구조: `(GeoJSON_NAME, start_year, end_year)` — start ≤ year < end 범위에 적용

#### COLONIAL_OVERLAYS (2개 그룹)
GeoJSON에 별도 폴리곤이 없는 식민지를 위한 가상 엔트리 정의.

```python
("Empire of Japan", 1910, 1945): [
    {"key": "__virtual__Korea_under_Japan", ...},
    {"key": "__virtual__Taiwan_under_Japan", ...}
]
```

#### PALETTES (16개 문명권 색상)

| 팔레트 | 색상 | 대상 |
|--------|------|------|
| EastAsia | `#F4D03F` (골드) | 중국, 몽골 등 |
| Korea | `#45B39D` (청록) | 한국 |
| Japan | `#E74C3C` (빨강) | 일본 |
| SoutheastAsia | `#27AE60` (초록) | 동남아 |
| SouthAsia | `#E67E22` (주황) | 인도 등 |
| British | `#F5B7B1` (핑크) | 영국 및 영연방 |
| French | `#5DADE2` (하늘) | 프랑스 |
| Spanish_Port | `#EB984E` (테라코타) | 스페인, 포르투갈 |
| Roman_Italy | `#8E44AD` (보라) | 로마, 이탈리아 |
| Germanic | `#CD6155` (어두운 빨강) | 독일 계열 |
| Russian | `#7FB3D8` (연한 파랑) | 러시아 |
| Nordic | `#85C1E9` (하늘) | 북유럽 |
| Islamic | `#58D68D` (연한 초록) | 이슬람 문명권 |
| US | `#34495E` (네이비) | 미국 |
| LatinAmerica | `#F5B041` (노랑) | 중남미 |
| Africa | `#D4AC0D` (골드) | 아프리카 |
| Oceania | `#48C9B0` (민트) | 오세아니아 |
| Default | `#D5D8DC` (회색) | 미매핑 엔트리 |

#### KOREAN_NAMES (~346개)
`display_name_en` → 한국어 매핑. 모든 메타데이터의 `display_name_ko`와 `display_name` 생성에 사용.

```python
"Qing Dynasty": "청나라",
"Republic of China": "중화민국",
"Empire of Japan": "대일본제국",
"United Kingdom": "영국",
```

#### RULER_NAMES_KO (15개)
식민지 지배국명 한국어 매핑.

```python
"British Empire": "대영제국",
"France": "프랑스",
"大日本帝国": "대일본제국",
```

#### CAPITAL_COORDS (~250개)
라벨 표시 위치용 수도 좌표 `[경도, 위도]`.

```python
"Korea":          [126.98, 37.57],   # 서울
"Ottoman Empire": [28.98, 41.01],    # 이스탄불
"China":          [116.4, 39.9],     # 베이징
```

### 6.4 실행 방법

```bash
python3 scripts/geo/generateBorderMetadata.py
# → public/geo/borders/metadata/ 아래 119개 JSON 재생성
```

---

## 7. 프론트엔드 렌더링 파이프라인

### 7.1 데이터 로딩 흐름

```
사용자 연도 선택 (currentYear)
        │
        ▼
① loadBorderIndex()
   → /geo/borders/index.json 로드 (캐싱됨)
        │
        ▼
② findClosestSnapshot(index, currentYear)
   → {year: 1928, file: "cshapes_1928.geojson"}
        │
        ▼
③ fetch(`/geo/borders/${snapshot.file}`)
   → GeoJSON 로드
        │
        ▼
④ loadMetadata(snapshot.year)
   → /geo/borders/metadata/1928.json 로드
        │
        ▼
⑤ loadBordersAsPolylines()
   → CustomDataSource 생성 (폴리라인 + 라벨)
        │
        ▼
⑥ viewer.dataSources.add(ds)
   → 지구본에 렌더링
```

### 7.2 렌더링 규칙

**국경선**: GeoJSON의 각 폴리곤 링을 Cesium Polyline으로 렌더링
- 색상: `metadata.fill_color`
- 선 굵기: 1.5px
- `clampToGround: true` (지형에 밀착)

**라벨**: 메타데이터의 `capital_coords`에 표시
- 텍스트: `metadata.display_name` (예: "대한제국 (Korea)")
- 식민지: `display_name\n[colonial_ruler_ko]` (예: "대한제국 (Korea)\n[대일본제국]")
- 가상 엔트리가 있는 부모 국가의 라벨은 숨김

### 7.3 관련 소스 파일

| 파일 | 역할 |
|------|------|
| `src/lib/borderIndex.ts` | 인덱스 로드 + 하이브리드 연도 매칭 |
| `src/components/CesiumGlobe.tsx` | GeoJSON/메타데이터 로드 + 렌더링 |
| `scripts/geo/generateBorderMetadata.py` | 메타데이터 JSON 생성 스크립트 |

---

## 8. 타임라인별 데이터 커버리지 상세

### 8.1 Historical-Basemaps 스냅샷 목록 (43개, 인덱스 등록분)

| # | 연도 | 파일명 | 비고 |
|---|------|--------|------|
| 1 | BC 123000 | world_bc123000.geojson | 최고(最古) 스냅샷 |
| 2 | BC 10000 | world_bc10000.geojson | |
| 3 | BC 8000 | world_bc8000.geojson | |
| 4 | BC 5000 | world_bc5000.geojson | |
| 5 | BC 4000 | world_bc4000.geojson | |
| 6 | BC 3000 | world_bc3000.geojson | 고대 문명 시작 |
| 7 | BC 2000 | world_bc2000.geojson | |
| 8 | BC 1500 | world_bc1500.geojson | |
| 9 | BC 1000 | world_bc1000.geojson | |
| 10 | BC 700 | world_bc700.geojson | |
| 11 | BC 500 | world_bc500.geojson | 고대 그리스/페르시아 |
| 12 | BC 400 | world_bc400.geojson | |
| 13 | BC 323 | world_bc323.geojson | 알렉산더 대왕 사망 |
| 14 | BC 300 | world_bc300.geojson | |
| 15 | BC 200 | world_bc200.geojson | |
| 16 | BC 100 | world_bc100.geojson | |
| 17 | BC 1 | world_bc1.geojson | 기원전/기원후 경계 |
| 18 | AD 100 | world_100.geojson | 로마 제국 전성기 |
| 19 | AD 200 | world_200.geojson | |
| 20 | AD 300 | world_300.geojson | |
| 21 | AD 400 | world_400.geojson | |
| 22 | AD 500 | world_500.geojson | |
| 23 | AD 600 | world_600.geojson | |
| 24 | AD 700 | world_700.geojson | 이슬람 확장기 |
| 25 | AD 800 | world_800.geojson | |
| 26 | AD 900 | world_900.geojson | |
| 27 | AD 1000 | world_1000.geojson | |
| 28 | AD 1100 | world_1100.geojson | |
| 29 | AD 1200 | world_1200.geojson | |
| 30 | AD 1279 | world_1279.geojson | 몽골 제국 최대 영역 |
| 31 | AD 1300 | world_1300.geojson | |
| 32 | AD 1400 | world_1400.geojson | |
| 33 | AD 1492 | world_1492.geojson | 콜럼버스 신대륙 |
| 34 | AD 1500 | world_1500.geojson | |
| 35 | AD 1530 | world_1530.geojson | |
| 36 | AD 1600 | world_1600.geojson | |
| 37 | AD 1650 | world_1650.geojson | |
| 38 | AD 1700 | world_1700.geojson | |
| 39 | AD 1715 | world_1715.geojson | |
| 40 | AD 1783 | world_1783.geojson | 미국 독립 |
| 41 | AD 1800 | world_1800.geojson | |
| 42 | AD 1815 | world_1815.geojson | 나폴레옹 전쟁 후 |
| 43 | AD 1880 | world_1880.geojson | HB 마지막 (인덱스 등록) |

### 8.2 CShapes 2.0 스냅샷 (117개)

1886~2015 범위에서 국경 변동이 발생한 해만 스냅샷 존재.

**밀집 구간**: 1886~1984 (거의 매년 변동)
**희소 구간**: 1985~2015 (5~6년 비어있는 구간 존재)

누락 연도 (변동 없음): 1929, 1936, 1985~1989, 1995~1996, 1999, 2004, 2010, 2013

### 8.3 메타데이터 파일 (119개)

1880년 + CShapes 117개 연도 + 2010년 = 119개

> 메타데이터는 GeoJSON 스냅샷이 존재하는 연도에 대해서만 생성됨. `world_1880`은 HB↔CShapes 전환 경계로 특별히 메타데이터가 있고, `world_` 파일 중 이보다 앞선 연도(BC~1815)는 아직 메타데이터 미생성.

---

## 9. 주의사항 및 운영 가이드

### 새로운 국가/시대 추가 시
1. `ENTITY_RULES`에 GeoJSON NAME → 메타데이터 매핑 추가
2. 시대별 이름 변동이 있으면 `YEAR_RANGE_OVERRIDES`에 추가
3. `KOREAN_NAMES`에 한국어 번역 추가
4. `CAPITAL_COORDS`에 수도 좌표 추가
5. `python3 scripts/geo/generateBorderMetadata.py` 재실행

### 식민지 라벨 분리가 필요할 때
- `COLONIAL_OVERLAYS`에 가상 엔트리 추가
- `__virtual__` 접두사 필수
- 부모 국가의 GeoJSON NAME과 연도 범위 지정

### 2015년 이후 데이터
현재 CShapes 2.0은 2015년까지만 커버. targetYear > 2015이면 `cshapes_2015.geojson`이 사용됨 (Floor match의 마지막 스냅샷 fallback).
