# AI 스코어링 파이프라인 문서

> 작성: 민철(cl) | 2026-03-05 | TimeGlobe 데이터 구축

## 1. 개요

Wikidata 덤프에서 수집한 대량 데이터(인물 309K, 작품 89K, 사건 3.2K 등)에서
역사적으로 중요한 항목만 AI로 선별하고, 원본 Wikidata QID와 매칭하는 파이프라인.

### 왜 필요한가?
- Wikidata 수집 데이터는 양이 방대하지만 대부분 역사적으로 사소한 항목
- sitelinks 수 기반 필터링만으로는 "역사적 중요도"를 정확히 판별 불가
- AI가 세계사 전문가 역할로 시대별 주요 항목을 선정 → Wikidata QID로 연결

### 파이프라인 요약

```
Wikidata 덤프 → 카테고리별 JSONL → AI 스코어링 → Wikidata QID 매칭 → curated JSONL
      (민규 mk)                          (민철 cl)
```

---

## 2. 아키텍처

### 2.1 실행 환경
- **서버**: jinserver (100.68.25.79), 46GB RAM
- **AI 모델**: Google Gemini 2.5 Pro / Flash (하이브리드)
- **API**: Google Generative AI REST API (urllib, 외부 라이브러리 불필요)
- **환경변수**: `GEMINI_API_KEY` (.env.local)

### 2.2 하이브리드 모델 전략
고대 데이터는 정확한 지식이 필요하므로 Pro, 근현대는 속도 우선 Flash 사용.

| 구간 | 모델 | 이유 |
|------|------|------|
| 고대 (~500 AD) | Gemini 2.5 **Pro** | 고대사 정밀 지식 필요 |
| 중세~근현대 (500~2025) | Gemini 2.5 **Flash** | 속도 우선, 충분한 정확도 |

### 2.3 적응형 청크 전략 (Adaptive Chunking)
시대별로 데이터 밀도가 다르므로, 청크 크기와 선정 개수를 조정:

**원칙**: 고대 = 넓은 시간 범위 + 적은 선정 수 / 근현대 = 좁은 범위 + 많은 선정 수

#### Person (scorePersons.py)
| 시대 | 범위 | 청크 크기 | 청크당 선정 | 모델 | 총 청크 |
|------|------|-----------|------------|------|---------|
| 고대 | -1000~500 | 50년 | 20명 | Pro | 30 |
| 중세 | 500~1500 | 10년 | 20명 | Flash | 100 |
| 근세 | 1500~1800 | 5년 | 25명 | Flash | 60 |
| 근현대 | 1800~2015 | 1년 | 25명 | Flash | 215 |
| **합계** | | | | | **405** |

#### Event (scoreEvents.py)
| 시대 | 범위 | 청크 크기 | 청크당 선정 | 모델 | 총 청크 |
|------|------|-----------|------------|------|---------|
| 고대 | -3000~-500 | 200년 | 10개 | Pro | 13 |
| 고전기 | -500~500 | 100년 | 15개 | Pro | 10 |
| 중세 | 500~1500 | 25년 | 15개 | Flash | 40 |
| 근세 | 1500~1800 | 10년 | 20개 | Flash | 30 |
| 근현대 | 1800~2025 | 5년 | 25개 | Flash | 45 |
| **합계** | | | | | **138** |

#### Artwork (scoreArtworks.py)
| 시대 | 범위 | 청크 크기 | 청크당 선정 | 모델 | 총 청크 |
|------|------|-----------|------------|------|---------|
| 고대 | -3000~500 | 200년 | 10개 | Pro | 18 |
| 중세 | 500~1500 | 50년 | 12개 | Flash | 20 |
| 근세 | 1500~1800 | 25년 | 15개 | Flash | 12 |
| 근현대 | 1800~2025 | 10년 | 20개 | Flash | 23 |
| **합계** | | | | | **73** |

---

## 3. 처리 흐름 (각 스크립트 공통)

### 3.1 Phase 1: AI 스코어링

```
for each chunk(year_from, year_to, count, model):
    1. build_prompt(year_from, year_to, count) → 시대별 프롬프트 생성
    2. call_gemini(prompt, model) → API 호출 (429 재시도 포함)
    3. parse_json_response(text) → JSON 배열 파싱 (마크다운 코드블록 처리)
    4. 결과를 ai_{category}_raw.jsonl에 append
    5. progress.json 업데이트 (이어하기 지원)
```

- **재시도**: 429(Rate Limit) → 60초 대기 후 재시도 (최대 3회)
- **이어하기**: `--resume` 옵션으로 중단 지점부터 재개 가능
- **진행 저장**: 매 청크 완료 시 progress.json에 기록

### 3.2 Phase 2: Wikidata QID 매칭

AI가 생성한 이름을 Wikidata 원본 데이터의 name_ko/name_en과 대조하여 QID 부여.

#### Person 매칭 (4단계)
```
1단계: 정확 매칭    — name_ko/name_en 완전 일치
2단계: 퍼지 매칭    — 괄호 제거, 칭호/서수 제거, 악센트 정규화, The 접두사
3단계: 심층 퍼지    — 출생연도 ±5년, 이름 순서 뒤집기, 닉네임 변형
4단계: 나무위키 브릿지 — /api/namuwiki 검색 → 리다이렉트 → QID 추출
```

#### Event 매칭 (3단계)
```
1단계: 정확 매칭    — name_ko/name_en 완전 일치 (정규화 포함)
2단계: 퍼지 매칭    — "Battle of X" ↔ "X", 악센트 정규화, 연도 제거, 접두사 제거
3단계: 부분문자열   — AI 이름이 WD 이름에 포함되거나 그 반대
```

#### Artwork 매칭 (2단계)
```
1단계: 정확 매칭    — name_ko/name_en 완전 일치 (정규화 포함)
2단계: 퍼지 매칭    — "The" 접두사, 악센트 정규화, 콜론 분리, "이름, The" 재배치
```

#### Disaster/Pandemic (매칭 불필요)
```
sitelinks 기반 직접 분류 → 이미 Wikidata QID 보유
```

---

## 4. 프롬프트 설계

### 4.1 공통 원칙
- 역할 부여: "세계사 전문 학자"
- 시대/개수 명시: "정확히 N개 선정"
- 지역 균형 요구: 11개 문명권 나열
- 출력 형식 강제: "JSON 배열만, 설명 없이"

### 4.2 카테고리별 선정 기준

#### Person
- 정치/군사, 과학/기술, 사상/종교, 문학/예술, 음악, 탐험/지리 6분야

#### Event
- 전쟁/전투, 혁명/반란, 조약/회의, 재난/역병, 탐험/발견, 문화/종교, 정치/외교 7유형

#### Artwork
- 문학, 회화/조각, 건축, 음악, 영화, 과학/사상 저술, 종교 경전 7매체
- **제외**: TV 드라마, 비디오 게임, 단순 인기/흥행작
- **제한**: 동일 작가 대표작 1개만

### 4.3 출력 JSON 필드

| 필드 | Person | Event | Artwork |
|------|--------|-------|---------|
| 이름 | name_en, name_ko | name_en, name_ko | name_en, name_ko |
| 시간 | birth_year, death_year | start_year, end_year | year |
| 장소 | birth_place, active_country | location, participants | origin |
| 분류 | role, field, region | type, field, region | medium, region |
| 사람 | nationality | - | creator, creator_en |
| 설명 | significance (30자) | significance (40자) | significance (40자) |

---

## 5. 실행 결과 (2026-03-05)

### 5.1 전체 현황

| 카테고리 | 스크립트 | WD원본 | AI선정 | QID매칭 | 매칭율 | 소요 |
|----------|---------|--------|--------|---------|--------|------|
| **Person** | scorePersons.py | 309K | 9,503 | 8,520 | 89.7% | ~180분 |
| **Event** | scoreEvents.py | 3.2K | 2,606 | 911 | 35.0% | 65분 |
| **Artwork** | scoreArtworks.py | 89K | 1,060 | 489 | 46.1% | 38분 |
| **Disaster** | export_disasters.py | 622 | 455 | 455 | 100% | <1분 |
| **합계** | | | **13,624** | **10,375** | **76.1%** | ~285분 |

### 5.2 매칭율 차이 원인

| 카테고리 | 매칭율 | 원인 |
|----------|--------|------|
| Person 89.7% | 높음 | 인물명은 표기가 비교적 표준화됨 + 나무위키 브릿지 |
| Artwork 46.1% | 중간 | 작품명 번역 변형 다양 (일리아스/Iliad, 논어/Analects) |
| Event 35.0% | 낮음 | WD event 카테고리 자체가 불완전 (WWI, 아르메니아 학살 등 누락) |
| Disaster 100% | 완벽 | 이미 WD QID 보유 데이터를 sitelinks로 필터링 |

### 5.3 세부 분포

#### Person 분야별
정치/군사 > 과학/기술 > 문학/예술 > 사상/종교 > 음악 > 탐험

#### Event 유형별
전쟁/전투 > 정치/외교 > 혁명/반란 > 조약 > 재난 > 탐험 > 문화

#### Artwork 매체별
문학 343 | 건축 153 | 회화 120 | 조각 95 | 철학 95 | 영화 85 | 음악 71 | 종교경전 57 | 과학 38

---

## 6. 출력 파일

### 6.1 경로 (jinserver)

```
/mnt/data2/wikidata/output/
├── ai_persons/
│   ├── ai_persons_raw.jsonl          # AI 선정 원본 (9,503)
│   ├── ai_persons_matched.jsonl      # QID 매칭 결과 (8,520)
│   └── progress.json                 # 진행 상태
├── ai_events/
│   ├── ai_events_raw.jsonl           # AI 선정 원본 (2,606)
│   ├── ai_events_matched.jsonl       # QID 매칭 결과 (911)
│   ├── disasters_curated.jsonl       # 재난/역병 (455)
│   └── progress.json
└── ai_artworks/
    ├── ai_artworks_raw.jsonl         # AI 선정 원본 (1,060)
    ├── ai_artworks_matched.jsonl     # QID 매칭 결과 (489)
    └── progress.json
```

### 6.2 JSONL 형식 예시

#### ai_persons_matched.jsonl
```json
{"name_en":"Confucius","name_ko":"공자","birth_year":-551,"death_year":-479,"birth_place":"노나라","role":"philosopher","field":"philosophy","region":"east_asia","significance":"유교 창시자","qid":"Q4604","match_type":"exact"}
```

#### ai_events_matched.jsonl
```json
{"name_en":"Battle of Thermopylae","name_ko":"테르모필레 전투","start_year":-480,"location":"테르모필레, 그리스","type":"battle","field":"military","region":"europe","significance":"페르시아 전쟁의 상징적 방어전","qid":"Q178561","match_type":"exact"}
```

#### ai_artworks_matched.jsonl
```json
{"name_en":"The Iliad","name_ko":"일리아스","year":-750,"creator":"호메로스","medium":"literature","region":"europe","significance":"서양 문학의 시원","qid":"Q8275","match_type":"fuzzy"}
```

---

## 7. 스크립트 사용법

### 7.1 공통 CLI 옵션

```bash
python3 score{Persons|Events|Artworks}.py           # 전체 실행 (처음부터)
python3 score{Persons|Events|Artworks}.py --resume   # 중단점부터 이어서
python3 score{Persons|Events|Artworks}.py --test     # 테스트 (소수 청크만)
python3 score{Persons|Events|Artworks}.py --match    # Wikidata 매칭만
python3 score{Persons|Events|Artworks}.py --stats    # 결과 통계
```

### 7.2 전제 조건

1. jinserver에 `GEMINI_API_KEY` 설정 (.env.local)
2. Wikidata 카테고리 JSONL이 `/mnt/data2/wikidata/output/categories/`에 존재
3. Python 3.10+ (urllib만 사용, 외부 패키지 없음)

### 7.3 Disaster/Pandemic (별도)
```bash
python3 /tmp/export_disasters.py   # sitelinks 기반 필터링 (AI 불필요)
```

---

## 8. 미처리 카테고리

| 카테고리 | WD 수량 | 상태 | 비고 |
|----------|---------|------|------|
| place | ~30K | 미시작 | raw 데이터(국가/도시)와 중복 가능성 높음 |
| building | ~10K | 미시작 | heritage(10K)와 성격 유사 |
| heritage | ~10K | 보류 | 98%가 sitelinks < 5 |
| invention | ~1K | 보류 | 데이터 품질 낮음 (날짜/좌표 부족) |

---

## 9. 설계 결정 기록

### Q: 왜 sitelinks가 아닌 AI 스코어링인가?
- sitelinks는 위키백과 편집 편향 반영 (서양 중심, 근현대 편중)
- AI는 "역사적 중요도"를 직접 판단 → 지역/시대 균형 가능
- 단, disaster/pandemic처럼 소규모+QID 있는 경우는 sitelinks로 충분

### Q: 왜 하이브리드 모델인가?
- Pro만 사용 시 비용/시간 과다 (person 405청크 → ~6시간)
- Flash만 사용 시 고대사 정확도 부족 (메소포타미아, 이집트 등)
- 하이브리드: Pro(고대 정밀) + Flash(근현대 속도) = 최적 균형

### Q: 매칭 실패한 항목은 어떻게 하나?
- 매칭 실패 = Wikidata에 해당 항목이 없거나 이름 변형이 심한 경우
- AI가 제공한 이름/연도/장소/설명은 그 자체로 유효한 데이터
- 향후: 미매칭 항목에 대해 수동 QID 부여 또는 새 Wikidata 항목 생성 고려

### Q: 왜 나무위키 브릿지는 Person에만?
- 인물은 나무위키 리다이렉트가 QID 탐색에 효과적 (약 1,200건 추가 매칭)
- 사건/작품은 나무위키 문서 구조가 불규칙하여 효과 미미
