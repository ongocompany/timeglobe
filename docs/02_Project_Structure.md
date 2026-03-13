# 🌲 TimeGlobe 프로젝트 구조도 (Project Architecture Tree)
> 💡 AI 에이전트(Claude 등)가 파일 구조 변경 시 실시간으로 스캔하고 업데이트하는 문서입니다.
> 📅 마지막 업데이트: 2026-03-07 (co)

```text
TimeGlobe/
├── src/                              # 핵심 소스코드
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # 메인 페이지 (3D 지구본)
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   ├── globals.css               # 글로벌 스타일
│   │   ├── favicon.ico
│   │   ├── api/
│   │   │   ├── models/route.ts       # 3D 모델 API
│   │   │   └── ops/pipeline-status/route.ts # 운영 모니터 스냅샷 API
│   │   ├── curation/page.tsx         # AI 큐레이션 대시보드
│   │   ├── data-check/page.tsx       # 데이터 현황 확인 페이지
│   │   ├── model-manager/page.tsx    # 3D 모델 관리 페이지
│   │   └── ops/page.tsx              # 배치/적재 운영 모니터 페이지
│   │
│   ├── components/
│   │   ├── CesiumGlobe.tsx           # ★ 핵심: CesiumJS 3D 지구본 + 국경선 + 마커
│   │   ├── GlobeLoader.tsx           # SSR 비활성화 래퍼 (dynamic import)
│   │   └── ui/                       # UI 컴포넌트
│   │       ├── Carousel3D.tsx        # 3D 카드 캐러셀
│   │       ├── ControlBar.tsx        # 하단 컨트롤 바
│   │       ├── Dashboard.tsx         # 대시보드
│   │       ├── DateDisplay.tsx       # 연도 표시
│   │       ├── Header.tsx            # 상단 헤더
│   │       ├── HelpCard.tsx          # 도움말 카드
│   │       ├── HistoryEventModal.tsx # 역사 이벤트 모달
│   │       ├── LightSpeed.tsx        # 워프 이펙트
│   │       ├── LocationIndicator.tsx # 위치 표시
│   │       ├── TimeDial.tsx          # 타임 다이얼
│   │       ├── Timeline.tsx          # 타임라인 슬라이더
│   │       └── YearReveal.tsx        # 연도 공개 애니메이션
│   │
│   ├── data/                         # 정적 이벤트 데이터 (하드코딩)
│   │   ├── mockEvents.ts            # 테스트용 이벤트
│   │   ├── events17c.ts             # 17세기 이벤트
│   │   ├── events18c.ts             # 18세기 이벤트
│   │   ├── events19c.ts             # 19세기 이벤트
│   │   └── modelRegistry.json       # 3D 모델 레지스트리
│   │
│   └── lib/
│       └── borderIndex.ts            # ★ 국경선 하이브리드 인덱스 (HB + CShapes)
│
├── public/                           # 정적 에셋
│   ├── geo/borders/                  # ★ 역사 국경선 데이터
│   │   ├── index.json                #   160개 스냅샷 인덱스 (BC123000~AD2015)
│   │   ├── world_*.geojson           #   historical-basemaps (43개, BC~AD1880)
│   │   ├── cshapes_*.geojson         #   CShapes 2.0 (117개, 1886~2015)
│   │   └── metadata/                 #   연도별 메타데이터 (119개 JSON)
│   │       ├── 1880.json ~ 2015.json #   국명, 색상, 식민지 정보, 수도 좌표
│   │       └── (YEAR_RANGE_OVERRIDES 적용)
│   │
│   ├── skybox/                       # ESO 은하수 큐브맵 (6면)
│   │   └── px/nx/py/ny/pz/nz.png
│   ├── textures/                     # 지구 텍스처
│   │   ├── clouds_alpha.png          #   구름 오버레이
│   │   └── earth_daymap*.jpg         #   주간 지구 텍스처 (4K/8K)
│   ├── markers/                      # 2D 마커 아이콘 (SVG + PNG)
│   │   └── culture/economy/nature/science/temple/war/adventure
│   ├── models/                       # 3D glTF 모델 (~30개)
│   │   ├── landmark/                 #   랜드마크 (에펠탑, 콜로세움 등)
│   │   ├── war/                      #   전쟁 (칼, 대포, 미사일 등)
│   │   ├── science/                  #   과학 (원자모델, 톱니바퀴 등)
│   │   ├── people/                   #   인물 (대리석 흉상)
│   │   ├── prehistoric/              #   선사시대 (손도끼, 토기 등)
│   │   ├── establishment/            #   건국 (국기, 국새)
│   │   ├── politics/                 #   정치 (두루마리)
│   │   └── revolution/               #   혁명 (주먹 깃발)
│   └── icons/                        # 기타 아이콘
│
├── scripts/                          # 데이터 처리 스크립트
│   ├── geo/                          # 국경선 관련
│   │   ├── extractCShapes.py         #   CShapes 2.0 → 연도별 GeoJSON 추출
│   │   ├── generateBorderMetadata.py #   메타데이터 일괄 생성 (ENTITY_RULES 기반)
│   │   ├── downloadBorders.mjs       #   historical-basemaps 다운로드
│   │   └── analyzeSnapshots.mjs      #   스냅샷 분석
│   │
│   ├── wikidata/                     # Wikidata 수집 파이프라인
│   │   ├── run.mjs                   #   메인 실행 스크립트
│   │   ├── collectPersonCandidates.mjs # person 후보 큐 수집 (min-sitelinks 필터)
│   │   ├── runPersonCandidateBatches.mjs # person 후보 큐 장기 배치 래퍼 + 중앙 heartbeat publish
│   │   ├── runAdaptivePersonCandidatesOnce.mjs # adaptive 배치 재기동/lock 래퍼
│   │   ├── personCandidateQuery.mjs  #   person 후보 seed query 공용 빌더
│   │   ├── config.mjs                #   설정 (기간, 카테고리)
│   │   ├── sparqlTemplates.mjs       #   SPARQL 쿼리 템플릿
│   │   ├── wdqsClient.mjs            #   Wikidata SPARQL 클라이언트
│   │   ├── wdqsProbe.mjs             #   WDQS 상태 probe + adaptive 프로파일 판정
│   │   ├── workerMonitor.mjs         #   Supabase 기반 워커 heartbeat/batch 이력 publish
│   │   ├── wikiEnricher.mjs          #   Wikipedia 보충 데이터
│   │   ├── normalizer.mjs            #   데이터 정규화
│   │   ├── supabaseLoader.mjs        #   Supabase DB 적재
│   │   ├── checkpoint.mjs            #   중단점 복원
│   │   ├── logger.mjs                #   로거
│   │   └── planner.mjs               #   수집 계획
│   │
│   ├── supabase/                     # Supabase 운영 보조
│   │   └── applyMigration.mjs        #   Management API 기반 원격 마이그레이션 실행
│   │
│   └── curation/                     # AI 큐레이션
│       ├── aiCurator.mjs             #   AI 자동 큐레이션
│       ├── aiGeocoder.mjs            #   AI 지오코딩
│       ├── aiSummaryEnricher.mjs     #   AI 요약 보충
│       ├── battleSignificance.mjs    #   전투 중요도 스코어링
│       ├── buildInternalTest500Candidates.mjs # 내부 테스트용 500 문제 후보 큐 자동 생성
│       ├── exportQuizBatchMarkdown.mjs #   JSON 배치 결과를 Markdown으로 역변환/인덱싱
│       ├── quizBundleMarkdown.mjs    #   문제 번들 Markdown 렌더링 유틸리티
│       ├── runQuizBundleBatches.mjs  #   5-entity 단위 문제 배치 생성 및 state 관리
│       └── quizBundleModelDryRun.mjs #   Gemini 모델별 역사 퀴즈 번들 드라이런/비교
│
├── docs/                             # 문서 (PM 모니터링 폴더)
│   ├── 00_PM_Dashboard.md            # PM 대시보드 (방향성 체크)
│   ├── 01_Agent_Instructions.md      # AI 에이전트 가이드라인
│   ├── 02_Project_Structure.md       # 이 파일 (프로젝트 구조도)
│   ├── work_change_log.md            # 작업 일지
│   ├── develop/                      # 개발 문서
│   │   ├── 01_[gm]development_guide.md        # 개발 가이드 (지훈)
│   │   ├── 02_[gm]database_schema_plan.md     # DB 스키마 계획 (지훈)
│   │   ├── 03_[cl]development_roadmap.md      # 개발 로드맵 (민철)
│   │   ├── 03_[gm]border_visualization_schema.md # 국경 시각화 스키마
│   │   ├── 04_[jin]database_const_co.md       # DB 상수 (진형)
│   │   ├── 05_[co]wikidata_collection_operating_plan.md # 위키데이터 수집 계획 (태훈)
│   │   ├── 06_[co]wikidata_pipeline_runbook.md # 파이프라인 운영 매뉴얼 (태훈)
│   │   ├── 07_[cl]triposr_local_setup_guide.md # TripoSR 로컬 설정 (민철)
│   │   ├── 08_[cl]3d_model_guide.md            # 3D 모델 가이드 (민철)
│   │   ├── 09_[cl]border_data_architecture.md  # 국경 데이터 아키텍처 (민철)
│   │   ├── 10_[cl]naming_convention.md         # 네이밍 규칙 (민철)
│   │   ├── 11_[mk]curation_criteria.md         # 데이터 큐레이션 기준 (민규)
│   │   ├── 12_[cl]data_change_history.md       # 데이터 변경 이력 (민철)
│   │   ├── 13_[cl]ai_scoring_pipeline.md       # AI 스코어링 파이프라인 (민철)
│   │   ├── 14_Dataset_확보현황_0306.md         # 데이터셋 확보 현황 (공용)
│   │   ├── 15_[co]frontend_mvp_product_plan.md # 프론트엔드 후반 작업 기획 및 게임 방향 문서 (태훈)
│   │   ├── 16_[co]frontend_mvp_development_plan.md # 프론트엔드 MVP 개발계획 및 제작 파이프라인 문서 (태훈)
│   │   ├── 17_[co]frontend_mvp_screen_flow.md  # 프론트엔드 MVP 화면 흐름 및 블라인드 드롭 오버레이 설계 (태훈)
│   │   ├── 18_[co]frontend_hud_design_baseline.md # HUD 디자인 기준선 및 컴포넌트 분해 (태훈)
│   │   ├── 19_[co]frontend_mvp_checklist.md # 프론트엔드 MVP 실행 체크리스트 및 제작 준비 항목 (태훈)
│   │   ├── 20_[co]ranked_clue_bundle_schema.md # 랭크용 블라인드 드롭 문제 스키마 문서 (태훈)
│   │   ├── 21_[co]ranked_clue_generation_rules.md # 랭크용 단서 생성 규칙 및 금지 패턴 문서 (태훈)
│   │   ├── 22_[co]ranked_candidate_selection_criteria.md # 랭크용 문제은행 후보 선별 기준, 단계별 규모 목표, 한국 가중치 원칙 문서 (태훈)
│   │   ├── 23_[co]person_only_ranked_pilot_candidates.md # person 데이터 기준 파일럿 랭크 후보군 1차 선별 문서 (태훈)
│   │   ├── 24_[co]ranked_pilot_batch_a_bundle_drafts.md # person 배치 A 8명 랭크 번들 초안 및 A 재수정 반영 문서 (태훈)
│   │   ├── 25_[co]ranked_pilot_batch_b_bundle_drafts.md # person 배치 B 8명 랭크 번들 초안 및 usable/revise 판정 문서 (태훈)
│   │   ├── 26_[co]ranked_pilot_batch_c_bundle_drafts.md # person 배치 C 8명 랭크 번들 초안 및 usable/revise 판정 문서 (태훈)
│   │   ├── 27_[co]ranked_visual_clue_feasibility_review.md # 랭크 시각 단서 생산성 리뷰 및 이미지 제작 기준 문서 (태훈)
│   │   ├── 28_[co]high_feasibility_image_pilot_set.md # high-feasibility 이미지 생성 파일럿 세트 및 공통 프롬프트 문서 (태훈)
│   │   ├── 29_[co]image_prompt_logic.md # 단서에서 이미지 브리프와 생성 프롬프트로 번역하는 공통 로직 문서 (태훈)
│   │   ├── 30_[co]quiz_generation_pipeline.md # Gemini 3 Flash Preview 중심의 문제 생성/검수/이미지 파일럿 파이프라인 문서 (태훈)
│   │   ├── 31_[co]quiz_curation_policy.md # 랭크/연습/보류/폐기 기준을 고정한 문제 큐레이션 정책 문서 (태훈)
│   │   ├── 32_[co]internal_test_500_entity_plan.md # 내부 테스트/클로즈드 베타용 500 entity 확보 계획 및 웨이브 문서 (태훈)
│   │   ├── 33_[co]internal_test_must_have_50_candidates.md # 내부 테스트 선행 must-have 50 후보군 확정 문서 (태훈)
│   │   ├── 34_[co]quiz_batch_execution.md # 500 후보 큐와 5개 단위 문제 배치 실행 기준 문서 (태훈)
│   │   ├── 35_[co]quiz_labeling_rubric.md # 내부 테스트 문제를 usable/revise/reject로 빠르게 라벨링하는 기준표 (태훈)
│   │   ├── 36_[co]internal_test_first_50_review_set.md # 생성된 500 문제 중 첫 50개 사람 검토 세트 문서 (태훈)
│   │   ├── 37_[co]first_15_manual_label_review.md # 첫 15개 문제의 수동 라벨링 및 인용 검증 리스크 리뷰 문서 (태훈)
│   │   ├── 38_[co]second_15_manual_label_review.md # 두 번째 15개 문제의 수동 라벨링 및 인용 검증 리스크 리뷰 문서 (태훈)
│   │   ├── 39_[co]third_20_manual_label_review.md # 마지막 20개 문제의 수동 라벨링 및 인용 검증 리스크 리뷰 문서 (태훈)
│   │   ├── 40_[co]first_50_manual_label_summary.md # 첫 50개 문제 수동 라벨링 종합 요약 문서 (태훈)
│   │   ├── 41_[co]rerun_first_15_spot_review.md # contextual_line 규칙 강화 후 첫 15개 재생성 스팟 리뷰 문서 (태훈)
│   │   ├── 42_[co]quiz_to_image_validation_pipeline.md # 퀴즈 생성부터 이미지 생성까지의 검증 파이프라인 문서 (태훈)
│   │   └── 43_[co]image_generation_cost_comparison.md # 공식 Gemini/APIYI 이미지 생성 비용 비교 및 운영 선택 문서 (태훈)
│   ├── UI/                           # Figma 산출물 및 HUD 시안 소스
│   │   └── src_by_figma/             #   선택 시안 React/Tailwind 프로토타입
│   └── 디자인샘플/                    # UI/UX 디자인 레퍼런스
│       └── modal-design/             #   모달 디자인 프로토타입 (React+Vite)
│
├── ops/
│   └── systemd/
│       └── timeglobe-person-candidates.service # Linux 상시 collector systemd 템플릿
│
├── supabase/migrations/              # Supabase DB 마이그레이션
│   ├── ..._initial_schema.sql        #   초기 스키마
│   ├── ..._event_sources*.sql        #   이벤트 소스 테이블
│   ├── ..._event_curation*.sql       #   큐레이션 필드
│   ├── ..._event_gap_cases.sql       #   갭 케이스
│   ├── ..._event_summary_archive.sql #   요약 아카이브
│   ├── ..._event_significance*.sql   #   중요도 스코어
│   ├── ..._person_candidates.sql     #   person 후보 큐
│   └── ..._collector_monitoring.sql  #   중앙 워커 heartbeat + batch 이력
│
├── .cache/                           # AI 처리 캐시/로그 (gitignore)
├── CLAUDE.md                         # 민철(Claude) 페르소나 설정
├── gemini.md                         # 지훈(Gemini) 페르소나 설정
├── codex.md                          # 태훈(Codex) 페르소나 설정
├── next.config.ts                    # Next.js 설정 (CesiumJS webpack)
├── package.json                      # 의존성 (next, cesium, resium 등)
└── tsconfig.json                     # TypeScript 설정
```

## 📝 주요 폴더/파일 설명 요약 (Architecture Overview)

| 경로 | 역할 | 담당 |
|------|------|------|
| `src/components/CesiumGlobe.tsx` | CesiumJS 3D 지구본 핵심 (국경선, 마커, 글로우, 자전) | cl |
| `src/lib/borderIndex.ts` | 하이브리드 국경 인덱스 (HB nearest + CShapes floor 매칭) | cl |
| `src/app/ops/page.tsx` | 중앙 워커 상태 + fetch 추이 운영 대시보드 | co |
| `src/app/api/ops/pipeline-status/route.ts` | 로컬 `.cache` fallback + Supabase 기반 운영 스냅샷 API | co |
| `public/geo/borders/` | 역사 국경 GeoJSON 160개 + 메타데이터 119개 | cl |
| `scripts/geo/` | CShapes 추출 + 메타데이터 생성 스크립트 | cl |
| `scripts/wikidata/` | Wikidata SPARQL 기반 이벤트 수집 파이프라인 | co |
| `ops/systemd/` | Linux 상시 수집용 systemd 서비스 템플릿 | co |
| `scripts/supabase/` | Supabase 원격 마이그레이션/운영 보조 스크립트 | co |
| `scripts/curation/` | AI 큐레이션/지오코딩/요약 보충/역사 퀴즈 번들 드라이런/배치 결과 Markdown export/curated 50 후보 생성/이미지 파일럿 생성 | cl, co |
| `public/quiz-image-pilot/` | Gemini 이미지 파일럿 결과물 공개 폴더 (비숨김, 즉시 검토용) | co |
| `supabase/migrations/` | Supabase PostgreSQL 스키마 마이그레이션 | gm, co |
| `docs/` | 기획, 스펙, PM 모니터링 문서 | all |
| `docs/develop/` | 개발 가이드, 스키마, 로드맵 등 기술 문서 | gm, cl, co |

## 🔧 기술 스택
- **프론트엔드**: Next.js 16 + TypeScript + TailwindCSS 4 + CesiumJS + Resium
- **백엔드/DB**: Supabase (PostgreSQL)
- **데이터**: Wikidata SPARQL + CShapes 2.0 + historical-basemaps
- **배포**: Vultr VPS (PM2 + Nginx, git push 자동 배포)
- **AI 에이전트**: 민철(cl/Claude), 지훈(gm/Gemini), 태훈(co/Codex), OpenClaw(PM)

## 🗂 gitignore 주요 항목
- `node_modules/`, `.next/`, `.cache/`, `.claude/`, `.bkit/`
- `public/cesium/` (빌드 시 webpack copy)
- `scripts/geo/cshapes/` (원본 CShapes 2.0, 300MB+)
- `docs/tmp/` (임시 에셋)
