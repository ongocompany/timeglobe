# Handoff: 전체 데이터 파이프라인 현황 + 좌표/era 수정

> **작성**: 2026-03-13 민철(cl)
> **목적**: 세션 전환 시 컨텍스트 유지. 데이터별 진행 상태, 남은 작업, 서버 파일 위치 총정리.

---

## 1. 오늘(03-13) 완료한 작업

### 1-1. 좌표 매핑 대규모 수정
- **문제**: country_coords.json에 치명적 오류 — Q142(프랑스)가 베이징 좌표, Q117(가나)가 서울 좌표
- **결과**: 프랑스인 1,279명이 베이징에, 가나 정치인이 서울에 표시되던 버그 해결
- **수정 내용**:
  - country_coords.json: 106개 → **738개**로 확대 (Wikidata SPARQL 벌크 쿼리 3차)
  - birthplace_coords.json: **545개** 신규 생성 (출생지 QID → 좌표)
  - qid_to_birthplace.json: 인물 QID → 출생지 QID 매핑
- **persons_cards.json 재생성**: 11,899 → **15,201건** (좌표 정확도 대폭 개선)

### 1-2. active_year 배치 완료 (Gemini 2.5 Flash)
- **목적**: 현대 인물(1900+) era_id 미스매치 해결 (김영삼이 일제시대로 가는 등)
- **대상**: 4,509명 (1900년 이후 출생)
- **결과**: `/mnt/data2/wikidata/output/active_years.jsonl` — **4,509건 완료**
- **필드**: `{qid, active_start, birth_city}`
- **검증**: 만델라(1944), 오바마(1996), 마틴 루터 킹(1955), 푸틴(1999), 메시(2004) ✅
- **주의**: 일부 birth_city 할루시네이션 있음 (박정희 → Yorba Linda로 나옴). Nominatim 변환 시 검증 필요
- **스크립트**: `/mnt/data2/wikidata/output/get_active_year.py`

### 1-3. places 필터링 진행 중
- **입력**: places_raw.jsonl 4,036,345건 → 키워드+좌표+sl≥5 필터 → 14,862건
- **AI 필터**: Gemini 2.5 Flash (no-thinking), "세계사 교과서급만 남겨라" 프롬프트
- **테스트 결과**: 26% 채택률 → 최종 ~3,800개 예상
- **상태**: 🔄 백그라운드 실행 중 (PID 774773)
- **결과파일**: `/mnt/data2/wikidata/output/places_filtered.jsonl`
- **스크립트**: `/mnt/data2/wikidata/output/filter_places.py`

---

## 2. 카테고리별 데이터 현황

### jinserver 파일 위치: `/mnt/data2/wikidata/output/`

| 카테고리 | raw 파일 | raw 건수 | cards 파일 | cards 건수 | 상태 |
|---------|---------|---------|-----------|-----------|------|
| **persons** | persons_raw.jsonl (5.6GB) | ~13M | cards/persons/cards_persons.jsonl | 15,925 | ✅ 카드완료, active_year완료 → rebuild 필요 |
| **events** | events_raw.jsonl (37MB) | 79,270 | cards/events/cards_events.jsonl + events_raw_filtered.jsonl | 2,220 | ✅ 카드완료+AI확장(983개 추가)+좌표완료 |
| **artworks** | artworks_raw.jsonl (1.1GB) | ~수십만 | cards/artworks/cards_artworks.jsonl | 2,545 | ⚠️ 카드 퀄리티 나쁨(TV쇼 등), 필터링 완료(별도) |
| **inventions** | inventions_raw.jsonl (7.9MB) | ~수천 | cards/inventions/cards_inventions.jsonl | 416 | ⚠️ 카드 퀄리티 나쁨("과학자" 등 개념 섞임), 필터링 필요 |
| **items** | - | - | cards/items/cards_items.jsonl | 123 | ❓ 확인 필요 |
| **places** | places_raw.jsonl (1.2GB) | 4,036,345 | - | - | 🔄 AI 필터링 중 (~3,800개 예상) |

### 추가 데이터 파일
| 파일 | 건수 | 설명 |
|------|------|------|
| pilot_artwork_filter.jsonl | 6,771 (YES: 2,393) | artworks AI 필터링 완료 (verdict/reason/era_hint만, 카드 미생성) |
| selected_films.jsonl | 470 | AI 영화 선별 |
| generated_films.jsonl | 430K | AI 생성 영화 데이터 |
| korean_all.jsonl | 1,978,952 | 한국 관련 전체 |
| korean_curated.jsonl | 828,344 | 한국 관련 큐레이션 |
| active_years.jsonl | 4,509 | ✅ 현대인물 활동시작연도+출생도시 |
| country_coords.json | 738 | 국가 QID → 수도 좌표 |
| birthplace_coords.json | 545 | 출생지 QID → 좌표 |
| qid_to_birthplace.json | ~수천 | 인물 QID → 출생지 QID |

---

## 3. 남은 작업 (우선순위 순)

### 3-1. persons 최종 빌드 (즉시 가능)
1. active_years.jsonl에서 1900+ 인물의 `active_start` → `era_id` 재계산
2. birth_city 고유값 추출 → Nominatim 지오코딩 → 좌표 개선
3. persons_cards.json 재생성 (cardsToMockEvent.py 수정)
4. 로컬 복사 → 빌드 테스트 → VPS 배포

### 3-2. places 카드 생성 (필터링 완료 후)
1. places_filtered.jsonl 결과 확인 (~3,800개 예상)
2. 이미 coord, year, summary_ko, summary_en 포함 → MockEvent 변환만 하면 됨
3. category: 'place' or 'building' 지정
4. era_id: year 기준 매핑

### 3-3. artworks 카드 생성
1. pilot_artwork_filter.jsonl에서 YES 2,393개 QID 추출
2. artworks_raw.jsonl에서 원본 매칭 (좌표, 연도 등)
3. 부족한 필드(summary, 좌표 등) → AI 보충 또는 Wikidata 재조회
4. MockEvent 변환

### 3-4. ~~events 좌표 붙이기~~ ✅ 완료
1. ~~cards_events.jsonl 1,237건 좌표 완료~~ (events_with_coords.jsonl)
2. ~~events_raw.jsonl 79,270건 → 키워드+sl≥10 → 4,092 → AI 필터 → 983개 추가~~
3. ~~기존 1,237 + 신규 983 = 2,220개 events_cards.json (4.8MB) 생성 완료~~

### 3-5. inventions 필터링 + 카드 생성
1. cards_inventions.jsonl 416건 → AI 필터링 ("과학자" 같은 개념 제거)
2. 통과한 항목에 좌표/연도/설명 보충
3. MockEvent 변환

### 3-6. items 확인
1. cards_items.jsonl 123건 내용 확인
2. 쓸만하면 변환, 아니면 드랍

---

## 4. 최종 데이터 규모 (완료)

| 카테고리 | 건수 | 파일 | 용량 |
|---------|------|------|------|
| persons | 15,200 | persons_cards.json | 31.3 MB |
| events | 2,220 | events_cards.json | 4.8 MB |
| places | 1,217 | places_cards.json | 1.8 MB |
| artworks | 2,392 | artworks_cards.json | 2.9 MB |
| inventions | 12 | (보류 — 너무 적음) | - |
| **합계** | **21,029** | | **40.8 MB** |

---

## 5. 기술 노트

### SSH 접속
```
ssh jinwoo@100.68.25.79  (Tailscale, 사용자명 jinwoo)
```

### Gemini API 설정
- 모델: `gemini-2.5-flash`
- thinking 비활성: `"thinkingConfig": {"thinkingBudget": 0}`
- flash-lite는 할루시네이션 심함 → 사용 금지
- 한국어 프롬프트 → JSON 파싱 에러 빈발 → 영어 프롬프트만 사용

### cardsToMockEvent.py 주의사항
- `existing_coords` 재사용 로직이 이전 잘못된 좌표를 계승함
- 반드시 `country_coords.json` + `birthplace_coords.json`만 사용해서 재생성
- 스크립트 위치: `/home/jinwoo/timeglobe/scripts/wikidata/cardsToMockEvent.py`

### era_id 매핑 (get_era 함수)
- 1900+ 인물: `active_start` 기준으로 era 배정 (출생연도 X)
- 1900 이전 인물: `birth_year` 기준 (기존 로직 유지)
- era 목록: era-ancient, era-classical, ..., era-cold-war, era-modern 등

### 프론트엔드 데이터 파일
- `public/data/persons_cards.json` — 현재 15,201건, 31.3MB
- 향후 카테고리별 분리 또는 통합 결정 필요

---

## 6. 배포 정보
- **개발서버**: jinserver (100.68.25.79) — `git push dev main`
- **VPS**: 158.247.225.152 / timeglobe.kr — 진형 지시 시에만 배포
- **로컬**: /Users/jin/Documents/development/TimeGlobe
