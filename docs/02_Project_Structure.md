# 🌲 TimeGlobe 프로젝트 구조도 (Project Architecture Tree)
> 💡 AI 에이전트(Claude 등)가 파일 구조 변경 시 실시간으로 스캔하고 업데이트하는 문서입니다.
> 📅 마지막 업데이트: 2026-02-28 (cl)

```text
TimeGlobe/
├── src/                              # 핵심 소스코드
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # 메인 페이지 (3D 지구본)
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   ├── globals.css               # 글로벌 스타일
│   │   ├── favicon.ico
│   │   ├── api/
│   │   │   └── models/route.ts       # 3D 모델 API
│   │   ├── curation/page.tsx         # AI 큐레이션 대시보드
│   │   ├── data-check/page.tsx       # 데이터 현황 확인 페이지
│   │   └── model-manager/page.tsx    # 3D 모델 관리 페이지
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
│   │   ├── config.mjs                #   설정 (기간, 카테고리)
│   │   ├── sparqlTemplates.mjs       #   SPARQL 쿼리 템플릿
│   │   ├── wdqsClient.mjs            #   Wikidata SPARQL 클라이언트
│   │   ├── wikiEnricher.mjs          #   Wikipedia 보충 데이터
│   │   ├── normalizer.mjs            #   데이터 정규화
│   │   ├── supabaseLoader.mjs        #   Supabase DB 적재
│   │   ├── checkpoint.mjs            #   중단점 복원
│   │   ├── logger.mjs                #   로거
│   │   └── planner.mjs               #   수집 계획
│   │
│   └── curation/                     # AI 큐레이션
│       ├── aiCurator.mjs             #   AI 자동 큐레이션
│       ├── aiGeocoder.mjs            #   AI 지오코딩
│       ├── aiSummaryEnricher.mjs     #   AI 요약 보충
│       └── battleSignificance.mjs    #   전투 중요도 스코어링
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
│   │   └── 08_[cl]3d_model_guide.md            # 3D 모델 가이드 (민철)
│   └── 디자인샘플/                    # UI/UX 디자인 레퍼런스
│       └── modal-design/             #   모달 디자인 프로토타입 (React+Vite)
│
├── supabase/migrations/              # Supabase DB 마이그레이션
│   ├── ..._initial_schema.sql        #   초기 스키마
│   ├── ..._event_sources*.sql        #   이벤트 소스 테이블
│   ├── ..._event_curation*.sql       #   큐레이션 필드
│   ├── ..._event_gap_cases.sql       #   갭 케이스
│   ├── ..._event_summary_archive.sql #   요약 아카이브
│   └── ..._event_significance*.sql   #   중요도 스코어
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
| `public/geo/borders/` | 역사 국경 GeoJSON 160개 + 메타데이터 119개 | cl |
| `scripts/geo/` | CShapes 추출 + 메타데이터 생성 스크립트 | cl |
| `scripts/wikidata/` | Wikidata SPARQL 기반 이벤트 수집 파이프라인 | co |
| `scripts/curation/` | AI 큐레이션/지오코딩/요약 보충 | cl |
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
