# TimeGlobe Wikidata 파이프라인 실행 문서 (co)

## 1. 생성된 코드 위치
- `scripts/wikidata/config.mjs`
- `scripts/wikidata/planner.mjs`
- `scripts/wikidata/sparqlTemplates.mjs`
- `scripts/wikidata/wdqsClient.mjs`
- `scripts/wikidata/normalizer.mjs`
- `scripts/wikidata/supabaseLoader.mjs`
- `scripts/wikidata/wikiEnricher.mjs`
- `scripts/wikidata/checkpoint.mjs`
- `scripts/wikidata/run.mjs`

## 2. 환경 변수
- 필수
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 선택
  - `WDQS_ENDPOINT` (default: `https://query.wikidata.org/sparql`)
  - `WDQS_TIMEOUT_MS` (default: `25000`)
  - `WDQS_MAX_RETRIES` (default: `4`)
  - `WDQS_BASE_DELAY_MS` (default: `1200`)
  - `WDQS_REQUEST_DELAY_MS` (default: `900`)
  - `WDQS_PAGE_SIZE` (default: `200`)
  - `WDQS_CHUNK_YEARS` (default: `50`)
  - `WIKIDATA_YEAR_FROM` (default: `0`)
  - `WIKIDATA_YEAR_TO` (default: `1500`)
  - `WIKIPEDIA_ENRICH` (`true`일 때 summary/image 보강)
  - `WIKIDATA_CHECKPOINT_PATH` (default: `.cache/wikidata-checkpoint.json`)

## 3. 실행 명령어
- 수집 품질 테스트(적재 없음, dry-run):
```bash
npm run collect:probe -- --year-from 1900 --year-to 2000 --report-file .cache/probe-1900-2000.json
```

- 비교 테스트 예시(고대/중세 범위):
```bash
npm run collect:probe -- --year-from 0 --year-to 1500 --report-file .cache/probe-0-1500.json
```

- 초기 적재(bootstrap):
```bash
npm run collect:bootstrap
```

- 증분 업데이트(incremental):
```bash
npm run collect:incremental
```

- 재수집(backfill):
```bash
npm run collect:backfill
```

- 타입 제한 실행 예시:
```bash
node scripts/wikidata/run.mjs --mode bootstrap --types event,person
```

## 4. 단계별 권장 실행 순서
1. `collect:probe`로 후보 기간(0~1500, 1900~2000) 품질 리포트 비교
2. 품질/검수난이도 기준으로 MVP 기간 확정
3. 확정된 범위에 대해 `bootstrap` 실행
4. `WIKIPEDIA_ENRICH=true`로 summary/image 보강 실행
5. 누락 구간은 `backfill`로 재처리
6. 운영 중 증분은 월 1회 또는 필요 시 수동 실행

## 5. 실패 시 재실행
- 체크포인트 파일:
  - 기본: `.cache/wikidata-checkpoint.json`
- 동작 방식:
  - `success` task는 `bootstrap/incremental`에서 자동 스킵
  - `failed` task는 다음 실행에서 재시도됨
  - `backfill` 모드는 성공 task도 재실행

## 6. 현재 구현 범위 메모
- `events` 테이블 적재는 동작 가능 (idempotent upsert: `id` 기준)
- `event_sources` 메타 테이블이 없는 경우 경고 후 스킵됨
  - 필요 시 별도 테이블 생성 후 source QID 추적 가능
- WDQS 과부하 방지를 위해 타입 x 기간 x 페이지(offset) 분할 실행
- `probe`는 DB 적재 없이 품질 지표(`ko/en 라벨`, `ko/en wiki`, `정규화율`)를 리포트로 출력
- 쿼리 경량화를 위해 1차 수집은 핵심 필드(`qid`, `time`, `coord`, `label`) 중심으로 실행
- 위키 sitelink/요약/이미지는 2차 보강 단계로 분리하는 것을 권장
