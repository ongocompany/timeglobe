# TimeGlobe 데이터 수집/구조화 운영 기획안 (co)

## 0. 문서 목적
- 본 문서는 `04_[jin]database_const_co.md`의 방법론을 기준으로, TimeGlobe의 기존 DB 스키마를 참조해 **Wikidata 중심 데이터 수집/정규화/적재 운영 전략**을 확정한다.
- 범위는 데이터 파이프라인 기획과 운영 정책이며, UI/렌더링 구현 범위는 제외한다.

## 1. 기준 문서 및 우선순위
- 방법론 기준: `docs/develop/04_[jin]database_const_co.md`
- 스키마 참조: `docs/develop/02_[gm]database_schema_plan.md`
- 실구현 기준(최종 진실 소스): `supabase/migrations/20260224174800_initial_schema.sql`

## 2. 핵심 원칙 (이번 작업의 결정사항)
- 1차 소스는 **Wikidata(WDQS/SPARQL)** 로 고정한다.
- Wikipedia는 **요약(summary), 썸네일(image), 링크(external_link)** 보조 소스로만 사용한다.
- 본문 대량 크롤링/파싱/AI 본문 저장은 MVP 범위에서 제외한다.
- 한 번에 큰 쿼리 1개를 실행하지 않고, **타입 x 기간 분할 Task** 기반으로 수집한다.
- 파이프라인은 재실행 가능해야 하므로 **체크포인트/재시도/로깅**을 필수로 둔다.
- 역사 데이터 특성상 증분 업데이트는 보조 운영으로 두고, **초기 구축 시 정밀 수집/검증**에 가장 많은 리소스를 투입한다.

## 3. 스키마 매핑 전략 (수집 데이터 -> TimeGlobe 테이블)

## 3-1. `events` (핵심)
- 매핑 대상:
  - `title(jsonb)`: ko/en 우선 라벨
  - `start_year`, `end_year`: Wikidata time property 정규화 결과
  - `category`: Wikidata type(P31/P279) -> TimeGlobe 카테고리 매핑 테이블
  - `location_lat`, `location_lng`: coordinate location(P625)
  - `is_fog_region`: 좌표 정밀도 낮거나 영역성 사건이면 `true` 후보
  - `modern_country(jsonb)`: country(P17) 기반 ko/en 라벨
  - `image_url`: Commons/Wikipedia 썸네일
  - `summary(jsonb)`: Wikipedia 요약(ko/en)
  - `external_link`: ko/en 위키 링크를 모두 확보하는 것을 목표로 하며, 한쪽 언어가 누락되면 검수 마크를 남긴다.
- 수집 저장 시 내부적으로 `source_qid`, `source_revision` 메타를 별도 관리 테이블에 저장해 재동기화 근거로 사용한다.
- 라벨/요약/링크는 **ko/en 동시 확보율**을 지표로 관리한다.

## 3-2. `eras`
- 초기에는 수동 큐레이션 + 반자동 생성 혼합:
  - 주요 시대(예: 고대/중세/근세/근대/현대, 지역별 왕조)는 운영자가 seed 작성
  - 이후 Wikidata 기간 범위와 이벤트 분포를 참고해 보강
- `name(jsonb)`, `start_year`, `end_year`, `description(jsonb)` 중심으로 관리한다.

## 3-3. `event_relations`
- 1차 규칙 기반 생성:
  - 같은 `era` + 인접 연도 + 유사 카테고리일 때 연관 후보
  - 동일 지역(country/좌표 근접) 연관 후보
- 2차 수동 큐레이션으로 품질 보정.

## 3-4. `borders`
- 마이그레이션 기준은 `geojson_url`이므로, DB에는 URL만 저장한다.
- 시대별 국경 GeoJSON은 외부 스토리지/CDN에 배치 후 URL 연결한다.

## 4. 수집 범위 (MVP -> 확장)

## 4-1. MVP 범위
- 엔티티 타입 우선순위:
  1. 사건(Event)
  2. 인물(Person)
  3. 장소(Place)
- 언어 우선순위: `ko`, `en`
- 기간은 아래 두 시나리오를 `probe` 품질 테스트로 비교 후 결정한다.
  - 시나리오 A: 서기 0~1500
  - 시나리오 B: 1900~2000

## 4-1-a. MVP 기간 선택 기준 (결정 프레임)
- `데이터 품질`: ko/en 라벨 동시 확보율, 좌표/연도 유효율
- `콘텐츠 설계 난이도`: 비전문가도 검수 가능한가
- `사용자 체감`: 초반 흥미 유도(근현대 친숙도 vs 장기 차별성)
- `운영 리스크`: 누락/오분류 보정 비용

## 4-1-b. 현재 권고안
- 초기 MVP는 **1900~2000(100년)** 권고.
- 이유:
  - 구조화 품질과 ko/en 데이터 밀도가 높아 초기 실패율이 낮음
  - 비전문가 큐레이션 부담이 상대적으로 낮음
  - UI/인터랙션 검증에 필요한 표본을 빠르게 확보 가능
- 이후 확장:
  - 파이프라인 안정화 후 0~1500을 별도 배치로 확장

## 4-2. 확장 순서
- 언어 확장: `ja`, `zh`
- 기간 확장: BCE 포함 전시대
- 타입 확장: 왕조/정체(polity), 문화유산, 과학사 사건 세분화

## 5. 파이프라인 구조 (기획)

## 5-1. 모듈 구성
- `planner`: 타입/기간 분할 task 생성
- `wdqs_client`: SPARQL 실행, rate limit 대응
- `normalizer`: 날짜/좌표/라벨/카테고리 표준화
- `loader`: Supabase upsert
- `checkpoint`: task 상태(`pending/success/failed`), 재시도 횟수 기록
- `enricher_wiki`: 선택적으로 summary/image 보강
- `reporter`: 실행 요약(성공/실패/재시도/누락 필드)

## 5-2. 실행 엔트리포인트
- `bootstrap`: 초기 전체 적재
- `incremental`: 최근 변경분 반영(일/주간 배치)
- `backfill`: 특정 타입/기간 재수집

## 6. WDQS 질의 전략 (과부하 방지형)

## 6-1. 분할 정책
- 타입별 분리: Event/Person/Place 개별 쿼리
- 기간 분할: 50~100년 단위 window
- 지역 분할(선택): 대륙/국가 단위 조건 추가

## 6-2. 운영 규칙
- 1회 요청 타임아웃 설정, 실패 시 exponential backoff 재시도
- task당 결과 건수 상한을 두고 초과 시 기간 창을 자동 세분화
- 동시성 낮게 유지(예: 1~2 worker) + 요청 간 delay

## 6-3. SPARQL 템플릿 요구 필드
- 공통:
  - QID (`?item`)
  - label/description (`ko`,`en`)
  - 시간(start/end 또는 birth/death)
  - 좌표(P625) 가능 시
  - 국가/행정 연결(P17 등) 가능 시
  - sitelink(ko/en wiki title)

## 7. 정규화 규칙
- 날짜:
  - ISO datetime -> year(int) 변환
  - BCE는 음수 연도로 변환
  - start/end 역전 데이터는 swap 또는 검역 큐로 보냄
- 좌표:
  - 위도/경도 범위 검증
  - 좌표 누락 시 이벤트 타입에 따라 제외 또는 `is_fog_region=true`
- 라벨:
  - ko 우선, 없으면 en fallback
  - title/description JSONB 구조 강제
- 카테고리:
  - Wikidata 클래스 -> 내부 카테고리 맵(`정치/전쟁`, `인물/문화`, `과학/발명`, `건축/유물`, `자연재해/지질`)
  - 미분류는 `인물/문화` 임시 분류 후 검수 큐 적재

## 8. 적재/동기화 정책

## 8-1. 초기 적재 (Bootstrap)
- 순서:
  1. `eras` seed 입력
  2. Event/Person/Place 수집
  3. `events` upsert
  4. summary/image 보강
  5. `event_relations` 생성
- 중간 중단 시 체크포인트 기준 재개.
- 초기 적재 전 반드시 `probe(dry-run)`로 품질 리포트를 생성해 범위별 품질을 비교한다.

## 8-2. 증분 업데이트 (Incremental)
- 주기(권고):
  - Monthly 또는 필요 시 수동 실행
  - 목적은 신규 대량 유입이 아니라 링크/요약 보강 및 누락 보정
- 키 전략:
  - `source_qid` 기준 idempotent upsert
  - 변경 감지 시에만 본문 필드 갱신

## 8-3. 데이터 품질 게이트
- 필수 필드(title/start_year/category/lat/lng) 누락률 지표
- 언어 커버리지(ko/en) 비율
- 카테고리 미분류 비율
- 잘못된 연도/좌표 검역 건수

## 9. 운영 계획 (1인 개발 기준)

## 9-1. 최소 운영 세트
- 수집 배치 스케줄러 1개 (cron 또는 GitHub Actions)
- 체크포인트 저장 테이블 1개
- 로그 저장(파일 또는 DB) 1개
- 실패 task 재실행 커맨드 1개

## 9-2. 장애 대응
- WDQS 지연/실패 시:
  - 재시도 후 실패 task만 보류
  - 전체 파이프라인 중단 대신 부분 성공 허용
- Wikipedia 보강 실패 시:
  - 핵심 구조 데이터는 먼저 적재 완료
  - summary/image는 후속 재시도로 분리

## 10. 문서 간 정합성 메모 (중요)
- `02_[gm]database_schema_plan.md`의 `Borders.geojson_data`와
  실제 마이그레이션 `borders.geojson_url`이 상이하다.
- 실행 시에는 **마이그레이션 스키마(`geojson_url`)를 우선 기준**으로 사용하고,
  문서 정합성은 별도 정리 작업에서 맞춘다.

## 11. 이번 기획안의 산출 요약
- Wikidata 중심 수집 + Wikipedia 보조 사용 원칙 확정
- 타입/기간 분할 기반 수집 전략 확정
- 체크포인트/재시도/로깅 포함 운영 방식 확정
- TimeGlobe 스키마(`events`, `eras`, `borders`, `event_relations`) 연결 방식 정의
- MVP(ko/en, Event/Person/Place)부터 확장 가능한 단계형 수집 로드맵 정리
