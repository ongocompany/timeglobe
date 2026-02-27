# TimeGlobe Work Change Log

*이 문서는 프로젝트의 주요 변경 사항과 AI 어시스턴트(Claude, Gemini 등)의 작업 내역을 추적하기 위해 사용됩니다.*
*작업자는 대량 데이터 수정 시, 진형의 지시 시, 또는 업무 종료 시에 이 문서에 변경 내역을 기록해야 합니다.*

## [2026-02-24] [gm]
* `docs/database_schema_plan.md` 및 `docs/development_guide.md` 작성.
* `claud.md.md` 및 `gemini.md.md` 구조 개편 및 `gemini.md` (지훈 페르소나 설정) 작성.
* 작업 로그 작성을 위한 `docs/work_change_log.md` 초기화.
* 진형(jn)의 요청으로 `docs/database_schema_plan.md` 내 `UserProgress` 테이블에 게이미피케이션 확장을 위한 `user_token`, `user_level` 컬럼 추가.
* `docs/database_schema_plan.md` 및 `docs/development_guide.md` 문서를 새 `docs/develop` 폴더로 이동하고 파일명 앞에 작성자 코드 `[gm]`을 붙여 관리하도록 개편 (규칙 문서 경로 업데이트 포함).
* 파일 네이밍 시 순차적인 번호(`01_`, `02_` 등)를 부여하는 규칙 추가 및 기존 문서 이름(`01_[gm]development_guide.md`, `02_[gm]database_schema_plan.md`) 변경 반영.
* 진형(jn)의 지시에 따라 초기 단계 생산성을 위해 문서뿐만 아니라 모든 작업/코드 수정 시 자동으로 `git push` 하도록 `CLAUDE.md`, `gemini.md` 내 규칙 변경.
* 진형(jn)의 지시에 따라 초기 단계 생산성을 위해 문서뿐만 아니라 모든 작업/코드 수정 시 자동으로 `git push` 하도록 `CLAUDE.md`, `gemini.md` 내 규칙 변경.
* 진형(jn)의 검토 결과에 따라 `01_[gm]development_guide.md` 내 민철(cl)의 제안사항 업데이트: Next.js 도입 확정, Globe.gl 성능 대안 모색(필요), 기타 제안 보류 처리.
* 진형(jn)의 지시에 따라 Globe.gl 대안 및 성능 이슈 해결책 리서치 및 문서 반영: `deck.gl` 대안 채택 제안, DB 부하 감소를 위해 GeoJSON의 `jsonb` 저장을 폐기하고 외부 CDN을 가리키는 `geojson_url(text)`로 스키마 전면 수정.
* `supabase/migrations/20260224174800_initial_schema.sql` (마이그레이션 스크립트) 최초 작성 및 완료.
* 진형(jn)의 데모 확인 결과 `deck.gl`은 그래픽 시각성이 맞지 않아 기각 처리. `01_[gm]development_guide.md`를 업데이트하여 향후 대안을 `CesiumJS` 또는 `Globe.gl 유지 + 극한 최적화` 방향으로 재조정.
* 진형(jn)의 요청으로 Design-First 방침에 따른 단계별 개발 로드맵 `03_[cl]development_roadmap.md` 작성 (Phase 0~5: 인프라 세팅 → UI 디자인 → 프론트엔드 → 백엔드 → 게이미피케이션 → 런칭).
* 진형(jn)의 요청으로 `01_[gm]development_guide.md` 파트 6-8에 CesiumJS 모바일 배포 전략 추가: WebView의 WebGL 성능 한계로 인해 Capacitor(네이티브 래핑) 대신 **반응형 웹 + PWA 방식** 강력 권장 및 명시적 렌더링 최적화 기법 기록.
* 진형(jn)의 요청으로 MVP 1차 스케치 UI 구현: Next.js + TailwindCSS를 사용하여 CesiumJS 지구본 위에 `Time Globe` 타이틀 헤더와 애플 타임머신 스타일의 세로 타임라인 레이아웃 오버레이 추가.
* 진형(jn)의 피드백을 수렴하여 UI 디자인 전면 수정: 타이틀 텍스트 아웃라인 효과(`text-stroke`), 그라데이션 페이드 백그라운드 적용 및 중앙 정렬 처리. 타임라인은 밀집된 연도 표기(스크롤 가능)와 마우스 커서 위치에 따른 포물선(Parabolic) 호버 확장 효과를 적용하여 애플 타임머신 감성 극대화.



## [2026-02-24] [cl]
* `CLAUDE.md` 중복 섹션(5, 6번) 정리 및 커밋 메시지 형식 `[민철][Docs]`로 수정.
* `01_[gm]development_guide.md`에 기술 검토 및 추가 제안(섹션 6) 작성.
* 진형(jn)의 결정에 따라 기술 스택 확정 반영: 프론트엔드 `Next.js` 확정, GeoJSON `CDN 정적 호스팅` 확정.
* 진형(jn)의 요청으로 CesiumJS 커스터마이징 가능 범위 조사 및 `01_[gm]development_guide.md` 섹션 6-7에 결과 추가: 3D glTF 마커, SkyBox 우주 배경 커스텀, ParticleSystem 이펙트 모두 기본 지원 확인.
* **[Phase 0] Next.js + CesiumJS 프로젝트 초기 환경 구축:**
  * Next.js 16.1.6 + TypeScript + Tailwind CSS 4 + App Router로 프로젝트 초기화.
  * CesiumJS(^1.138.0) + Resium(^1.19.4) 설치 및 `next.config.ts`에 copy-webpack-plugin 설정 (Workers, ThirdParty, Assets, Widgets 에셋 복사).
  * Next.js 16 Turbopack 기본 설정과 CesiumJS webpack 설정 충돌 해결 (`--webpack` 플래그 추가).
  * `CesiumGlobe.tsx` (3D 지구본 + 서울 테스트 마커) 및 `GlobeLoader.tsx` (SSR 비활성화 래퍼) 컴포넌트 생성.
  * `.env.example` 작성 (Cesium Ion 토큰, Supabase 키 템플릿).
  * `.gitignore` 정리 (public/cesium/, .claude/, .mcp.json, bkit 관련 파일 제외).
  * git remote 재설정 및 전체 빌드 성공 확인 후 push 완료.

## [2026-02-24] [cl] Phase 0 시각 효과 + 마커 + UI 개선
* **ESO 은하수 스카이박스** 적용: eso0932a 파노라마(6000x3000) → 큐브맵 6면 변환(px/nx/py/ny/pz/nz.png), 내장 skyAtmosphere OFF
* **CSS 대기 글로우**: radial-gradient 오버레이 (1.75x, 38%→41%→85% 소멸), rAF 매 프레임 추적
* **CSS 그림자**: linear-gradient 오버레이 (태양=오른쪽 가정, 왼쪽 어둡게 5단계)
* **구름 오버레이**: clouds_alpha.png (SingleTileImageryProvider, alpha 0.15)
* **기본 타일 색감 보정**: saturation 0.7, brightness 1.05, contrast 1.1
* **Cesium Ion 토큰 설정**: .env.local에 NEXT_PUBLIC_CESIUM_ION_TOKEN 추가 → Bing Maps 위성 타일 활성화
* **서울 마커 LOD 시스템**: 원거리(500km+) 2D Billboard(museum.svg) ↔ 근거리(0~500km) 3D Box 자동 전환
* **자동 자전 거리별 속도 제어**: 500km 이내 완전 정지, 500km~2000km 선형 감속, 2000km+ 정상 속도
* **자전축 복원**: heading/roll을 0(북↑)으로 서서히 보간 (RESTORE_SPEED=0.03)
* **하이브리드 이미지리 시도 → 철회**: 8K 커스텀 텍스처 + Bing Maps 타일 조합 시도했으나, 레이어 간섭으로 타일 로딩 실패. 기본 CesiumJS 맵으로 복원.
* **Header/Timeline UI 리뉴얼**: Noto Sans 폰트, 타임스케일 지구 탄생(45억년)까지 확장, mask-image 페이드
* **DateDisplay 컴포넌트** 추가
* **.gitignore 정리**: .bkit/, docs/tmp/, 미사용 텍스처 제외

## [2026-02-25] [cl] 3D 캐러셀 + 헤더 애니메이션
* **Carousel3D 컴포넌트** 신규 생성 (`src/components/ui/Carousel3D.tsx`): `docs/interactiontest.html` 바닐라 JS 프로토타입을 React로 변환
  * 3D perspective(1200px) 무한 스크롤 캐러셀
  * 드래그/터치/스크롤 조작 지원
  * 카드 클릭 시 모달 확장 (800px, 3:4 비율, cubic-bezier 트랜지션)
  * 배경 클릭: 모달 닫기 → 캐러셀 닫기 (2단계 동작)
  * rAF 루프에서 useRef/useState 동기화 패턴 적용
* **Header 블러 리빌 애니메이션**: `@keyframes blurReveal` (blur 20px→0, brightness 1.5→1, scale 1.1→1) 사이트 진입 시 적용
* **page.tsx**: "Explore Events" 테스트 버튼 + Carousel3D 오버레이 연동 (샘플 Unsplash 데이터 10장)
* **프로토타입 보관**: `docs/interactiontest.html` 원본 저장소에 보관

## [2026-02-25] [cl] Event Orbit UX 대폭 개선
* **캐러셀 → 원형 궤도**: 선형 스크롤에서 원형 띠(circular orbit) 방식으로 전환, CSS perspective 보정 공식 `R = (G+M)*P/(P-G-M)` 적용
* **동적 궤도 반지름**: CesiumGlobe에서 `window.__timeglobe_screenRadius` 공유 → 캐러셀이 매 프레임 읽어 궤도 크기 자동 조절
* **아이콘 hover 인터랙션**: 기본 ~30px 아이콘 (지구 지름 800px 기준 비례), hover 시 180×180 확대 (0.3s cubic-bezier)
* **카드 자동 반복**: 궤도 둘레를 아이콘+5px 간격으로 나눠 필요한 만큼 items 반복 (최대 200개)
* **스크롤 제거**: 마우스 휠 핸들러 삭제, 드래그/터치만 지원
* **줌 제한**: `orbitActive` prop으로 Event Orbit 활성 시 카메라 줌 범위 제한 (현재 높이 50%~200%)
* **prop 체인 교체**: `shrink` → `orbitActive` (page.tsx → GlobeLoader → CesiumGlobe → SceneSetup)
* **UI 토글**: Event Orbit / Event Marker 듀얼 토글 버튼 (viewMode state)

## [2026-02-25] [cl] Event Orbit 지구본 완전 종속 시스템
* **지구본 위치/기울기 동기화**: CesiumGlobe에서 `__timeglobe_center`, `__timeglobe_cameraPitch`, `__timeglobe_cameraHeading` 공유 → 캐러셀이 rAF에서 읽어 컨테이너 transform 갱신
* **pointer-events 패스스루**: 오버레이 `pointer-events: none` → 카드만 `auto` → 지구본 조작과 캐러셀 공존
* **heading(자전축) 동기화**: 컨테이너 `rotateY(-heading)` → 지구 좌우 회전 시 궤도도 같이 회전
* **pitch(기울기) 동기화**: 컨테이너 `rotateX(tilt)` → 지구 기울이면 궤도도 같이 기울어짐
* **재렌더링 완전 제거**: `globeRadius` state 삭제, `displayCount`는 열릴 때 한번만 계산 (1.5배 버퍼), 모든 시각 업데이트 rAF에서만 수행
* **physicalAngle vs visualAngle 분리**: 카드 위치는 링 내 고정(physical), 밝기/투명도는 카메라 기준(visual)
* **모달 시 heading freeze**: 모달 열리면 heading 고정 → 지구 돌려도 모달 카드 위치 유지
* **줌 제한 완화**: 50%~200% → 30%~300%으로 확대
* **아이콘 기본 크기**: 30px → 80px (지구 지름 800px 기준 비례)

## [2026-02-25] [cl] resetToDefault + Orbit 안정화 + 지구 색감 개선

### resetToDefault 기능 구현 (카메라 리셋)
* **원인 발견**: 지구 자전축 "기울기"의 원인은 heading이 아닌 **카메라 위도(latitude)**였음 — 극지방(lat=76°)에서 내려다보면 자전축이 기울어 보이는 원근 효과
* **resetToDefault 전역 함수**: `flyTo(lat→0°, height→기본높이, heading→0, pitch→-90°)` — 적도 기본 뷰로 부드럽게 복귀
* **calcDefaultHeight 공용 함수**: 800px 지구 지름 기준 카메라 높이 계산 → 초기 카메라, Reset View, Event Orbit 진입 모두 동일 값 사용
* **초기 카메라 위치 설정**: 사이트 진입 시 적도 + 기본 높이에서 시작 (서울 경도 126.978°)
* **Reset View 버튼**: page.tsx에 정식 UI 버튼 추가 — 마커 탐색 후 복귀 등에 활용
* **spin loop 보호**: resetToDefault 호출 후 1.5초간 자전+heading 복원 모두 정지 (flyTo 간섭 방지)
* **updateGlow camera lock 보호**: 리셋 후 500ms간 lock setView 스킵

### Event Orbit 안정화
* **카드 겹침 버그 수정**: 동적 `displayCount` 계산 제거 → `ORBIT_CARD_COUNT = 44` 고정 (원본 items 순환 반복)
* **itemElsRef 초기화**: 캐러셀 열릴 때마다 ref 배열을 명시적으로 초기화 — 이전 DOM 참조 찌꺼기 방지
* **미사용 ICON_GAP 상수 제거**
* **Orbit rolling 애니메이션**: ±5° 좌우 rolling 오실레이션 (sin파, ~15초 주기), 모달 시 0°로 수렴
* **Orbit 반대 자전**: `targetLon = cameraLongitude + 2 * autoRotationTotal` — 자동 자전과 반대 방향, 수동 드래그는 따라감
* **hover 애니메이션 튜닝**: 확대 크기 180→120px, translateZ 120px, transition 0.5s

### 지구 색감 개선
* **타일 색감 보정 강화**: saturation 1.6, brightness 1.5, contrast 0.9, gamma 1.0 — "Blue Marble" 느낌
* **CSS 내부 발광 레이어**: `mix-blend-mode: screen` — 어두운 바다에 파란빛 추가 (rgba 40,100,220, opacity 0.35)
* **CSS 하이라이트 레이어**: `screen` 블렌드, 광원 방향(62%, 45%) 오프셋 — 우측 앞에서 비추는 입체 조명
* **그림자 radial-gradient**: linear → radial 변경, 광원 오른쪽 앞 기준 — 중앙이 밝고 가장자리가 어두운 3D 입체감

### [향후 검토] 시대별 맵 전환 방향
* **문제**: 과거 시대에 현대 위성사진(Bing Maps)이 보이면 타임머신 컨셉과 불일치
* **방향**: 현대=위성타일, 과거=자연지형 텍스처(8K) + 역사 벡터 데이터(GeoJSON) 오버레이
* **참고 데이터**: Natural Earth(naturalearthdata.com), 역사 국경 오픈소스 프로젝트
* **구현 시기**: Phase 2~3 (타임라인↔지구본 연동 시)

## [2026-02-25] [cl] DB 스키마 필드 추가 + 15세기 목업 데이터
* **MockEvent 인터페이스**: Events 스키마 기반 TypeScript 인터페이스 정의 (`src/data/mockEvents.ts`)
* **15세기 목업 데이터 27건** 작성: 동아시아(조선, 명, 일본), 동남아, 중앙아시아, 중동, 유럽, 아프리카, 아메리카 균등 분포
* **DB 스키마 업데이트** (`02_[gm]database_schema_plan.md`): image_url, summary, description, external_link 필드 추가

## [2026-02-25] [cl] Event Orbit 베타 완성: 이벤트 상세 카드 시스템
* **HistoryEventModal 컴포넌트** 신규 생성 (`src/components/ui/HistoryEventModal.tsx`)
  * `EventDetailContent`: 오빗 카드 내부 인라인용 (renderDetail 패턴)
  * `HistoryEventModal`: 독립 모달 래퍼 (마커 모드 등에서 사용)
  * 다크/라이트 테마 지원: `themeTokens` 객체로 모든 색상 토큰 관리
  * 카테고리별 아이콘 + 테마별 색상 뱃지 (Swords, User, Lightbulb, Landmark, Mountain, Palette, BookOpen)
  * 히어로 이미지 (38%) + 지역 정보 + 설명 + 출처 링크 + "같은 시대 다른 나라에서는?" 연관 이벤트
* **Carousel3D 연동 개선**:
  * `renderDetail` render prop 패턴: 활성 카드 내부에 EventDetailContent 렌더링
  * 카드 클릭 시 화면 좌/우 판별 → 좌우 대칭 확대 + 기울기 반전
  * 무중력 플로팅 애니메이션 (Y축 ±3° + 상하 ±5px, 느린 사인파)
  * 글로우 효과 (box-shadow, 블루 톤)
  * 확대 애니메이션 1초, 왼쪽 5vw 오프셋
  * 뒤쪽 카드 지구 관통 방지 (`Math.min(0.3, targetOpacity)`)
* **tsconfig.json**: `docs/디자인샘플` 폴더 exclude 추가 (Figma 샘플 빌드 오류 방지)
* **lucide-react, motion** 패키지 추가

## [2026-02-25] [cl] Event Marker 베타 구현: 글로우 도트 + 카메라 flyTo
* **동적 마커 렌더링**: 27개 MockEvent를 카테고리별 글로우 도트로 지구본 위에 표시
  * Canvas API로 64×64 방사형 그라데이션 글로우 이미지 동적 생성 + 캐싱
  * 카테고리별 SF 네온 색상 (정치=빨강, 인물=파랑, 과학=에메랄드, 건축=앰버, 자연재해=오렌지, 문화=보라, 지적유산=인디고)
  * `scaleByDistance`로 거리에 따른 도트 크기 자동 조절
  * 마커 모드 토글 시 엔티티 동적 생성/제거
* **마커 클릭 인터랙션**: `ScreenSpaceEventHandler`로 Entity 클릭 감지
  * 카메라 flyTo: 해당 위치 2000km 높이, pitch -45°, 1.5초 애니메이션
  * 자전 정지 플래그 (`__timeglobe_markerFocused`) 연동
  * Reset View로 복귀 시 자전 재개
* **서울 테스트 마커 제거**: 하드코딩된 Seoul Museum Entity 2개 → 동적 마커로 대체
* **Props 확장**: CesiumGlobe/GlobeLoader에 `markerMode`, `events`, `onMarkerClick` 추가

## [2026-02-25] [co] DB 구축용 데이터 수집/구조화 기획 문서 작성
* 진형(jn)의 지시에 따라 UI 작업과 병렬로 진행할 DB 구축 준비 목적의 데이터 수집/정규화 운영 기획을 작성.
* 참고 기준:
  * 방법론: `docs/develop/04_[jin]database_const_co.md`
  * 스키마 참조: `docs/develop/02_[gm]database_schema_plan.md`
  * 실구현 기준 확인: `supabase/migrations/20260224174800_initial_schema.sql`
* 신규 문서 생성: `docs/develop/05_[co]wikidata_collection_operating_plan.md`
  * Wikidata 1차 수집 + Wikipedia 보조 수집 원칙 확정
  * 타입×기간 분할 Task 기반 ETL 운영 정책(체크포인트/재시도/로깅 포함) 정리
  * TimeGlobe 스키마(`events`, `eras`, `borders`, `event_relations`) 매핑 전략 명시
  * 초기 적재(bootstrap) / 증분 업데이트(incremental) 실행 전략과 품질 게이트 정의
* 문서 정합성 메모 추가:
  * `02_[gm]...`의 `Borders.geojson_data`와 실제 migration의 `borders.geojson_url` 차이를 명시하고, 실행 기준은 migration 우선으로 정리.

## [2026-02-25] [co] 수집 파이프라인 최소 실행 골격 구현
* 진형(jn)의 "수정 반영 후 진행" 지시에 따라 문서 기획안을 기반으로 실제 실행 가능한 Wikidata 수집 파이프라인 골격 추가.
* 신규 코드 추가: `scripts/wikidata/`
  * `run.mjs`: bootstrap / incremental / backfill 실행 엔트리
  * `planner.mjs`: 타입×기간 task 분할 생성
  * `sparqlTemplates.mjs`: Event/Person/Place WDQS 쿼리 템플릿
  * `wdqsClient.mjs`: WDQS 요청, timeout, exponential backoff 재시도
  * `normalizer.mjs`: 날짜/좌표/라벨 정규화 및 events 레코드 변환
  * `supabaseLoader.mjs`: Supabase PostgREST upsert/patch 로더
  * `checkpoint.mjs`: task 상태 저장/복구(`pending/success/failed`)
  * `wikiEnricher.mjs`: Wikipedia summary/image 선택 보강
  * `config.mjs`, `logger.mjs`: 환경 설정/로그
* 실행 스크립트 추가 (`package.json`):
  * `collect:bootstrap`, `collect:incremental`, `collect:backfill`
* 실행 문서 추가:
  * `docs/develop/06_[co]wikidata_pipeline_runbook.md`
* 검증:
  * `node --check`로 주요 모듈 문법 검사 통과.

## [2026-02-25] [co] 초기 수집 검증 우선 정책 반영 + probe 모드 추가
* 진형(jn)의 피드백 반영:
  * 비전문가 수동 큐레이션 부담을 줄이기 위해 seed 수동 결정 전 **수집 품질 테스트 선행**으로 정책 전환.
  * 역사 데이터 특성을 반영해 증분 업데이트를 핵심 전략에서 제외하고 **초기 정밀 구축 우선**으로 문서/실행 흐름 수정.
* 파이프라인 개선:
  * `scripts/wikidata/run.mjs`에 `probe` 모드 및 `--dry-run` 지원 추가 (DB 적재 없이 WDQS 수집/정규화 품질 지표 산출).
  * CLI 인자 확장: `--year-from`, `--year-to`, `--report-file`.
  * 품질 지표 리포트 추가: `normalizeRate`, `ko/en label/wiki coverage`, `bilingualTitleRate`.
* 실행 스크립트 추가:
  * `package.json`에 `collect:probe` 추가.
* 실행 문서/기획 문서 수정:
  * `05_[co]wikidata_collection_operating_plan.md`에 MVP 기간 선택 프레임(0~1500 vs 1900~2000)과 현재 권고안(1900~2000) 반영.
  * `06_[co]wikidata_pipeline_runbook.md`에 probe 기반 비교 테스트 절차 반영.
* 로컬 실행 검증:
  * `npm run collect:probe -- --types event --year-from 1950 --year-to 1955` 실행 시도.
  * 네트워크 제한으로 WDQS fetch 실패 재시도 후 종료되었으나, 재시도/리포트 출력/체크포인트 동작은 확인됨.

## [2026-02-25] [co] WDQS 쿼리 경량화 및 정규화 버그 수정
* 진형(jn)의 요청에 따라 WDQS 타임아웃 원인을 쿼리 복잡도로 판단하고 SPARQL 템플릿 경량화 진행.
* `scripts/wikidata/sparqlTemplates.mjs` 변경:
  * `P31/P279*` 경로 제거 -> `P31` 직접 매칭으로 축소
  * `GROUP BY + SAMPLE` 제거, `SELECT DISTINCT` 기반으로 단순화
  * 다중 OPTIONAL(설명/국가/sitelink) 축소, 1차 수집은 핵심 필드 중심으로 분리
  * 시간 필드는 UNION 기반(`P580/P585/P571`)으로 단순화
* `scripts/wikidata/normalizer.mjs` 수정:
  * 연도 파싱 로직 개선(`YYYY-...` 형식에서 연도 추출 실패 버그 해결)
* 검증:
  * `collect:probe` (`event`, `1950~1950`) 실행 성공
  * 결과: `rows=58`, `normalized=58`, `normalizeRate=100%`, `koLabelRate=89.66%`, `enLabelRate=100%`

## [2026-02-25] [cl] 타임스케일 스펙 + DB 스키마 문서화
* **타임스케일 T1~T7 설계 스펙 문서화** (`01_[gm]development_guide.md` 섹션 7 추가):
  * T1(200년)~T7(1년) 비균등 계층 구조 표로 정리
  * 연속 윈도우 규칙(Contiguous Window Rule): 최대 3단위, 반드시 연속된 단위만 선택 가능
  * 구현 시기: Phase 2 (Supabase 연동) 때 본격 적용
* **Events 테이블 `importance` 컬럼 추가** (`02_[gm]database_schema_plan.md`):
  * `importance: smallint DEFAULT 5, range 1~10`
  * 카메라 줌 레벨 + 타임 윈도우와 결합하여 마커 밀도 제어 예정

## [2026-02-25] [cl] Event Marker 시인성 개선 + 호버 툴팁 + 헤더 애니메이션 + Dashboard
* **Event Marker 시인성 개선**: 마커 크기 24px → 48px, Canvas 글로우 이미지 64px → 96px
  * `scaleByDistance`: NearFarScalar(5e5, 2.0, 1.5e7, 0.5) → NearFarScalar(5e5, 1.5, 1.5e7, 0.6)
* **마커 호버 툴팁 추가**: ScreenSpaceEventHandler MOUSE_MOVE로 Entity 감지 → `● 제목 연도` 툴팁 DOM 표시, 커서 pointer 전환
* **Header 컴팩트 전환 애니메이션** (`src/components/ui/Header.tsx`):
  * `timeglobe:globeReady` 이벤트 수신 시 대형 중앙 타이틀 → 좌상단 컴팩트 로고로 전환
  * CSS `transition-all duration-1000` + `blur-md` 페이드 효과
* **LocationIndicator 컴포넌트** 생성 후 Dashboard로 대체 (파일은 보관)
* **Dashboard 컴포넌트** 신규 생성 (`src/components/ui/Dashboard.tsx`):
  * 지명 브레드크럼: 대륙 → 소지역 → 역사적 지역명 → 도시 근처 (카메라 높이 기반 계층별 표시)
  * 시대 연도: `| 1859년` (height < 2,000km 시 가장 가까운 이벤트 연도 표시)
  * 좌표 표시: 화면 중심(중심) + 마우스 커서(커서) 지상 좌표 (라디안 → `47.42°N 19.05°E` 포맷)
  * 고도 표시: `fmtHeight()` 함수로 m/km 자동 전환 (1,243 km 등)
  * 폴링 방식: `window.__timeglobe_*` 글로벌 200ms 인터벌, prevRef 얕은 비교로 불필요한 리렌더 방지
* **CesiumGlobe.tsx 확장** (Dashboard 지원을 위한 데이터 노출):
  * `tileLoadProgressEvent` → `timeglobe:globeReady` 커스텀 이벤트 발행 (tiles 로딩 완료 시)
  * rAF 루프에서 `__timeglobe_cameraLatitude`, `__timeglobe_cameraLongitude`, `__timeglobe_cameraHeight` 갱신
  * 화면 중앙 레이캐스팅으로 지상 좌표 계산 → `__timeglobe_groundLat/Lng` 갱신
  * MOUSE_MOVE 핸들러로 커서 지상 좌표 계산 → `__timeglobe_cursorLat/Lng` 갱신
  * 고도 < 3,000km 시 커서 조준경(reticle) SVG 커서로 전환
* **page.tsx**: `LocationIndicator` → `Dashboard` 교체

## [2026-02-25] [cl] 17c/18c/19c 역사 이벤트 목데이터 105개 추가 + mockEvents.ts 통합
* 진형(jn)의 요청으로 다국어 런칭 대비 17~19세기 이벤트 데이터 신규 작성.
* 각 세기별로 35개씩 총 105개의 역사 이벤트 MockData 생성 (기존 15c 27개 유지).
* 참조 링크 다양화: `en.wikipedia.org` / `ko.wikipedia.org` / `britannica.com` / `namu.wiki` 분산.
* 지역 분포: 동아시아(조선/중국/일본), 남아시아, 중동, 유럽, 아프리카, 아메리카, 오세아니아 균형.
* 생성 파일:
  * `src/data/events17c.ts` — 17세기 35개 (갈릴레이, 케플러, 30년전쟁, 병자호란, 세키가하라 전투, 타지마할, 명→청 교체, 코로크나 혁명 등)
  * `src/data/events18c.ts` — 18세기 35개 (계몽주의, 미국독립, 프랑스혁명, 와트 증기기관, 제너 백신, 영조 탕평책, 화성 건설 등)
  * `src/data/events19c.ts` — 19세기 35개 (나폴레옹, 메이지유신, 아편전쟁, 달윈 진화론, 에디슨 전구, 흥선대원군, 동학혁명 등)
* `src/data/mockEvents.ts` 구조 개편:
  * 기존 15c 인라인 배열을 `EVENTS_15C` 상수로 분리.
  * `export const MOCK_EVENTS` = `[...EVENTS_15C, ...EVENTS_17C, ...EVENTS_18C, ...EVENTS_19C]` — 전 세기 통합.
  * 총 이벤트 수: 27 + 35 + 35 + 35 = **132개**.

## [2026-02-25] [cl] 조준경 커서 개선 + 자전 고도 임계값 변경 + 스택 툴팁 구현
* **자전 고도 임계값 조정**: ROTATION_STOP_DIST 3,000km / ROTATION_FADE_DIST 15,000km (기존 500km/2,000km)
  * 3,000km 이하 완전 정지, 3,000~15,000km 선형 가속, 15,000km+ 정상 자전
* **조준경 커서 DOM 오버레이 전환**: CSS 정적 커서 → `position:absolute` div + rAF 루프 애니메이션
  * `makeReticleSvg(color, size)` 함수로 SVG 동적 생성 (기존 `RETICLE_CURSOR` 상수 대체)
  * 기본 상태: 검정(#111111) 64px 정적 조준경
  * 마커 호버 상태: 파랑 맥동 (사인곡선 scale 0.7~1.3, ~1.7초 주기)
  * 변환 공식: `translate(mx,my) scale(s) translate(-S/2,-S/2)` → 스케일 변화 시에도 커서 중심 고정
* **스택 툴팁 구현**: 커서 반경 30px(스크린 픽셀, 절대값) 내 마커 중첩 표시
  * `SceneTransforms.worldToWindowCoordinates()` → 전체 132개 이벤트 스크린 좌표 변환 후 필터링
  * 거리 기준 정렬, 최대 5개 항목 + "+N more" 표시 (투명도 단계별 감소)
  * 가장 가까운 항목 font-weight:600, 나머지 400
  * 표시 딜레이 250ms / 숨김 딜레이 450ms: 커서 빠른 이동 시 깜빡임 방지, 클릭 용이성 향상
  * 이미 표시 중이면 즉시 내용/위치 갱신 (딜레이 없음)
  * `markerHoverRef` 공유: 툴팁 useEffect ↔ 커서 useEffect 간 hover 상태 동기화

## [2026-02-25] [co] 실제 적재 시도 + 웹 데이터 확인 UI 추가
* 진형(jn)의 요청으로 `dry-run`이 아닌 실제 DB 적재를 소범위(`event`, `1950`)로 실행 시도.
* 실행 결과:
  * `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 미설정으로 로더 단계에서 중단됨.
  * 에러: `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.`
* 웹상 확인용 간단 UI 추가:
  * 신규 페이지: `src/app/data-check/page.tsx`
  * 기능: Supabase `events` 테이블 최근 50건 조회, 상태 표시(loading/error), refresh 버튼, 외부 링크 확인
  * 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) 누락 시 화면 경고 표시
* 검증:
  * `npm run lint -- src/app/data-check/page.tsx` 통과.

## [2026-02-25] [co] 세션 정리 기록 (재부팅 전 인수인계용)
* 진형(jn)의 피드백(초보 사용자 기준)에 맞춰 데이터 확인 UI 단순화 진행.
* 수정 파일:
  * `src/app/data-check/page.tsx`
* UI 변경 내용:
  * React 훅 복잡도 축소(`useEffect/useCallback/useMemo` 제거)
  * 버튼 클릭형 `데이터 불러오기` 방식으로 단순화
  * 표(`table`) 중심의 HTML 형태 화면으로 정리
  * 환경변수 누락/로딩/에러 메시지 직관적으로 표시
* 쿼리/파이프라인 관련 현재 상태(핵심):
  * `scripts/wikidata/sparqlTemplates.mjs`
    * WDQS 경량화 반영 완료 (`P31/P279*` 제거, `SELECT DISTINCT`, OPTIONAL 축소, 시간 UNION)
  * `scripts/wikidata/normalizer.mjs`
    * 연도 파싱 버그 수정 완료 (`YYYY-...` 형식 처리)
  * `scripts/wikidata/run.mjs`
    * `probe`/`dry-run` 모드로 DB 적재 없이 품질 리포트 생성 가능
* 실행 결과 요약:
  * `collect:probe` 소범위(`event`, `1950`) 성공
    * `rows=58`, `normalized=58`, `normalizeRate=100%`
  * 실제 적재(backfill) 시도는 Supabase 환경변수 미설정으로 중단
    * 필요 키: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
* 현시점 미완료/대기 항목:
  * `.env.local`에 Supabase 4개 키 입력 필요
    * `NEXT_PUBLIC_SUPABASE_URL`
    * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    * `SUPABASE_URL`
    * `SUPABASE_SERVICE_ROLE_KEY`
  * 입력 후 재실행 순서:
    1. `node scripts/wikidata/run.mjs --mode backfill --types event --year-from 1950 --year-to 1950`
    2. `http://localhost:3000/data-check`에서 실제 DB 반영 확인
* 참고 산출물 경로:
  * 기획: `docs/develop/05_[co]wikidata_collection_operating_plan.md`
  * 실행문서: `docs/develop/06_[co]wikidata_pipeline_runbook.md`
  * probe 리포트: `.cache/probe-1950-event.json`, `.cache/probe-1950-1955-event.json`

## [2026-02-25] [cl] — Event Marker + StackCarousel UI 완성

### 마커 색상 팔레트 교체
* `CesiumGlobe.tsx` `CATEGORY_COLORS`: SF 네온 계열 → `map_marker_color_palettes.scss` 어스톤 팔레트로 교체
* 글로우 이미지 크기 96→64, 글로우 반경 3px로 축소
* 과학/발명 + 기본 색상: `#94d2bd` → `#6a4c93` (커스텀 보라)로 교체

### 마커 스케일 설정
* 빌보드 기본 크기 12×12px
* `NearFarScalar(3e6, 20/12, 5e6, 1.0)`: 고도 5000km→3000km 구간에서 12→20px, 이하 20px 고정

### 고도 분기 툴팁/이미지 팝업
* 고도 > 1500km: 텍스트 툴팁
* 고도 ≤ 1500km + 단독 마커: 3:4 비율 이미지 카드 팝업 (커서 추적)
* 스택 마커: 툴팁 유지, 클릭 시 StackCarousel

### Carousel3D (Event Orbit) 카드 디자인
* 정방형 → 3:4 비율로 변경, 카드 하단에 제목 텍스트 상시 표시

### StackCarousel 완성
* 커서 클릭 위치 기준 배치, 배경 컨테이너 없이 개별 그림자
* 클릭 시 해당 카드가 CSS width/height 트랜지션으로 직접 확장 (오빗 패턴 동일)
* 밖 클릭 → 카드들 랜덤 방향 scatter 애니메이션 후 사라짐
* hover 효과: `scale(1.08) translateY(-4px)` + 그림자 강화 (스프링 이징)

### 단독/스택 마커 통합
* `onMarkerClick` 콜백 완전 제거, `onStackClick(events, pos)` 단일 콜백으로 통합
* 단독 마커 flyTo/flyBack/markerFocused 제거 → 지구본 고정 상태에서 카드만 팝업
* `page.tsx`: `selectedEvent` 상태 제거, `stackState: {events, pos}` 단일 상태로 관리

## [2026-02-25] [co] Supabase 환경설정 재시작 준비(수집 파이프라인)
* 어제 중단 지점(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 미설정) 재점검 결과, `.env.local`의 Supabase 4개 키가 모두 비어 있음을 확인.
* `scripts/wikidata/config.mjs` 개선:
  * 실행 시 `.env`, `.env.local` 자동 로드 추가 (Node `process.loadEnvFile` 사용)
  * DB 필수키 누락 에러 메시지를 구체화 (`Missing environment variables: ...`)
* `scripts/wikidata/run.mjs` 개선:
  * `backfill/bootstrap/incremental` 시작 시 DB 필수키 선검증(`requireDbEnv`) 추가
  * 키 누락 시 WDQS 호출 전에 즉시 실패하여 원인 파악 속도 개선
* `.env.example` 보강:
  * `SUPABASE_URL`
  * `SUPABASE_SERVICE_ROLE_KEY`
  * (기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 함께 총 4개 키 예시 제공)
* 실행 문서 업데이트: `docs/develop/06_[co]wikidata_pipeline_runbook.md`
  * `/data-check` 확인 화면에 필요한 public 키 2개를 명시
  * 소범위 적재 테스트 명령 추가 (`collect:backfill -- --types event --year-from 1950 --year-to 1950`)
  * 직접 `node ...` 예시를 npm 스크립트 기반 예시로 통일

## [2026-02-25] [co] Supabase 연결 재검증 결과 (스키마 미적용 확인)
* `.env.local` 4개 키 입력 후 `collect:backfill(event, 1950)` 재실행.
* 결과:
  * WDQS fetch 네트워크 경로는 정상(권한 상승 실행 기준) 확인.
  * Supabase 적재 단계에서 `public.events` 테이블 미존재로 실패:
    * `PGRST205: Could not find the table 'public.events' in the schema cache`
* 조치:
  * `supabase/migrations/20260224174800_initial_schema.sql` 상단에 `CREATE EXTENSION IF NOT EXISTS pgcrypto;` 추가
  * SQL Editor에서 마이그레이션 본문 실행 후 backfill 재시도 필요 상태로 정리.

## [2026-02-25] [co] backfill 재시작 후 적재 성공 + 파이프라인 안정화
* Supabase SQL Editor에서 스키마 적용 후 `collect:backfill -- --types event --year-from 1950 --year-to 1950` 재실행.
* 파이프라인 보강:
  * `scripts/wikidata/run.mjs`
    * 페이지 단위 중복 레코드 제거(`eventRecord.id` 기준 dedupe) 추가.
    * 배경: `ON CONFLICT DO UPDATE command cannot affect row a second time`(동일 batch 내 중복 id) 방지.
  * `scripts/wikidata/supabaseLoader.mjs`
    * PostgREST 응답이 빈 본문일 때 JSON 파싱 에러가 나지 않도록 처리(`return=minimal` 대응).
* 실행 결과:
  * task `event:1950:1950` 성공, `pageRows=45`, `records=45`, `pages=1`.
  * 품질 지표: `rows=58`, `normalized=58`, `normalizeRate=100%`, `koLabelRate=89.66%`, `enLabelRate=100%`.
  * `event_sources` 테이블은 미생성 상태라 upsert는 경고 후 스킵(기존 의도된 동작).
* 체크포인트 메모:
  * 최종 요약의 `failed` 카운트는 과거 probe 실패 task(`event:1950:1955`, `event:1950:1954`, `event:1955:1955`)가 `.cache/wikidata-checkpoint.json`에 남아 있어 함께 집계된 값임.

## [2026-02-25] [co] 1951~1955 backfill + /data-check 점검 + event_sources 마이그레이션 추가
* `collect:backfill -- --types event --year-from 1951 --year-to 1955` 실행 성공:
  * task `event:1951:1955` 성공, `pageRows=51`, `records=51`, `normalizeRate=98.28%`.
* Supabase 집계 확인:
  * `public.events` 총 `96`건 (`1950:45`, `1951:19`, `1952:14`, `1953:10`, `1954:2`, `1955:6`).
* `/data-check` 경로 점검:
  * 라우트 자체는 `HTTP 200` 정상.
  * 페이지와 동일한 anon 키 쿼리 결과는 `0건`으로 확인되어, `events` 공개 조회 정책(RLS policy) 필요 상태 확인.
* 신규 마이그레이션 추가:
  * `supabase/migrations/20260225174800_event_sources_and_events_read_policy.sql`
  * 포함 내용:
    * `public.event_sources` 테이블 생성(파이프라인 source 추적용)
    * `public.events` anon/authenticated `SELECT` grant + `events_public_read` 정책
    * `event_sources` 인덱스 및 RLS enable

## [2026-02-25] [co] 마이그레이션 적용 후 최종 검증(1→2→3 완료)
* 사용자(jn)가 `20260225174800_event_sources_and_events_read_policy.sql`를 Supabase SQL Editor에서 실행 완료.
* 검증 실행:
  * `collect:backfill -- --types event --year-from 1950 --year-to 1955` 재실행
  * 결과: task `event:1950:1955` 성공, `pageRows=96`, `records=96`.
* Supabase 적재 확인:
  * `public.events`: `96`건
  * `public.event_sources`: `96`건 (source 추적 적재 정상)
* `/data-check` 관련 anon 권한 확인:
  * anon 키 기반 `events` 조회 `HTTP 200`, 샘플 5건 반환 확인
  * `events_public_read` 정책 반영으로 웹 데이터 확인 페이지에서 데이터 로드 가능한 상태 확인

## [2026-02-25] [co] battle 수동 큐레이션(기본 숨김) 구현
* 요구사항 반영: DB에는 battle을 유지하되, 기본 노출은 숨기고 수동 승인(`is_curated_visible=true`)한 항목만 노출하는 정책 구현.
* 파이프라인 변경:
  * `scripts/wikidata/sparqlTemplates.mjs`
    * 이벤트 수집 시 Wikidata 클래스 식별자(`classQid`)를 SELECT에 추가.
  * `scripts/wikidata/normalizer.mjs`
    * `event_kind` 정규화(`historical_event/war/battle/treaty/disaster/person/place`).
    * `is_battle` 플래그 생성(`event_kind === "battle"`).
    * `event_sources`에 `class_qid`, `event_kind` 메타 적재 추가.
* 웹 확인 UI 변경: `src/app/data-check/page.tsx`
  * 기본 조회에 큐레이션 필터 적용:
    * `is_curated_visible=true` OR (`is_curated_visible IS NULL` AND `is_battle=false`)
  * 검수용 토글 추가: `전체 보기`, `전투만 보기`.
  * 테이블 컬럼 확장: `종류(event_kind)`, `노출(기본/수동 상태)`.
  * 컬럼 미적용 DB에서의 실패를 안내하는 에러 메시지 추가(필요 migration 파일명 표시).
* 신규 마이그레이션 추가:
  * `supabase/migrations/20260225181500_event_curation_fields.sql`
  * 내용:
    * `events` 컬럼 추가: `event_kind`, `is_battle`, `is_curated_visible`
    * `event_sources` 컬럼 추가: `class_qid`, `event_kind`
* 상태 메모:
  * 마이그레이션 미적용 상태에서 backfill 실행 시 `event_kind` 컬럼 미존재 오류(`PGRST204`) 확인.
  * 적용 후 backfill 재실행이 필요함.

## [2026-02-25] [co] curation 필드 마이그레이션 적용 후 검증 완료
* 사용자(jn)가 `20260225181500_event_curation_fields.sql` 실행 완료.
* `collect:backfill -- --types event --year-from 1950 --year-to 1955` 재실행 성공:
  * task `event:1950:1955` 성공, `records=96`.
* 검증 결과:
  * `events` 총 96건에서 `is_battle=true` 91건, `is_battle=false` 5건.
  * `event_kind` 분포: `battle=91`, `treaty=4`, `disaster=1`.
  * `is_curated_visible`은 아직 전건 `NULL`(수동 승인/숨김 전 초기 상태).
* anon 기본 노출 규칙 검증:
  * 기본 필터(`is_curated_visible=true OR (is_curated_visible IS NULL AND is_battle=false)`)에서 5건 조회 확인.
  * 전체 보기(필터 없음)에서는 동일 기간 상위 50건 조회 확인.
* 실행문서 보강:
  * `06_[co]wikidata_pipeline_runbook.md`에 수동 큐레이션 SQL 예시(A~D) 추가.

## [2026-02-25] [co] 누락 항목 재수집 검증(타이틀 기반 점검 + QID fallback 적용)
* 테스트베드 검증 요청에 따라 `1950~1955 event` raw↔normalize 누락 분석 수행.
* 분석 결과:
  * raw 116건 / normalized 115건 / 누락 1건.
  * 누락 원인: `missing_label` 1건 (`Q15781932`, ko/en 라벨 없음).
  * 결론: 해당 케이스는 “타이틀 기반 재조회” 자체가 불가능(초기 타이틀 부재).
* 보완 구현:
  * `scripts/wikidata/run.mjs`: ko/en 라벨 미존재 행에 대해 QID 집합으로 추가 WDQS 조회 후 다국어 라벨 fallback 적용.
  * `scripts/wikidata/normalizer.mjs`: `itemLabel_fallback` 사용 허용.
* 재검증:
  * backfill 재실행 시 `Applied fallback labels { targets: 1, applied: 1 }` 확인.
  * task 요약 `normalized 116/116 (100%)`.
  * `events` 총 건수 `96 -> 97` 증가.
  * 복구 항목 확인: `Q15781932` (`event_kind=treaty`, title=`Akademiezentrum Sankelmark`).
  * 기본 노출 필터 기준 결과도 `5 -> 6`건으로 증가(비전투 조약 1건 추가 반영).

## [2026-02-25] [co] data-check UI 개선: 방금 추가된 항목 확인 흐름 보강
* 사용자(jn) 요청에 따라 기존 `/data-check`에서 신규 적재 항목 확인이 쉽도록 조회 옵션 확장.
* 변경 파일: `src/app/data-check/page.tsx`
  * `created_at` 컬럼 조회/표시 추가.
  * 정렬 토글 추가: `정렬: 추가시각` ↔ `정렬: 연도`.
  * 필터 토글 추가: `최근 추가만 ON/OFF` (최근 24시간, `created_at >= now-24h`).
  * 안내 문구 추가: 최근 추가 모드 동작 방식 명시.
* 검증:
  * anon 키 기준 최근 24시간 필터 조회 `HTTP 200`, 6건 반환 확인.
  * 신규 복구 항목(`Akademiezentrum Sankelmark`, 1952)이 `created_at` 최신순 상단에 노출됨을 확인.

## [2026-02-25] [co] data-check 투컬럼 리스트/상세 뷰 전환(전체 필드 확인용)
* 사용자(jn) 요청에 따라 기존 표 형식에서 **좌측 목록 + 우측 상세** 레이아웃으로 전환.
* 변경 파일: `src/app/data-check/page.tsx`
  * 좌측: `title / year / short id` 목록 (선택 가능, 하이라이트).
  * 우측: 선택 행의 전체 필드 표시
    * 기본 필드(`id, era_id, year, category, event_kind, visibility, created_at, location`)
    * JSON 필드(`title`, `modern_country`, `summary`)
    * 링크 필드(`external_link`, `image_url`)
    * `Raw Row JSON` 섹션으로 전체 행 원문 확인
  * 조회 select에 `events` 주요 필드 전체 포함하도록 확장.
* 검증:
  * `npm run lint -- src/app/data-check/page.tsx` 통과.

## [2026-02-25] [co] 기존 적재 데이터 누락 필드 보강(풀데이터셋 테스트)
* 사용자(jn)의 요청에 따라 “실데이터 수집 검증” 목적으로 기존 `events` 97건에 대한 누락 필드 보강 작업 수행.
* 배경:
  * WDQS 쿼리 강화(위키타이틀/국가 optional 추가) 방식은 `429/timeout`으로 불안정.
  * 대안으로 `event_sources.qid` 기반 보강 전용 스크립트 구현.
* 신규 스크립트:
  * `scripts/wikidata/enrichExistingFromSources.mjs`
  * package script 추가: `npm run collect:enrich-existing`
  * 동작:
    * Wikidata `wbgetentities`로 sitelink/description/country(P17)/image(P18) 수집
    * Wikipedia summary API로 `summary`, 썸네일 `image_url` 보강
    * `external_link`를 ko/en wiki 우선, 없으면 wikidata URL fallback
    * `modern_country` 라벨 보강
    * `event_sources`의 `ko_wiki_title`, `en_wiki_title`, `description`도 patch
* 실행 결과:
  * `patchedEvents=97`, `patchedSources=96`
  * `patchedSummary=94`, `patchedImage=77`, `patchedExternal=97`, `patchedCountry=64`
* 최종 커버리지 집계 (`events`, total=97):
  * `summary` 누락: `97 -> 3`
  * `image_url` 누락: `97 -> 20`
  * `external_link` 누락: `97 -> 0`
  * `modern_country` 누락: `97 -> 33`
* source 메타 집계 (`event_sources`, total=97):
  * `ko_wiki_title` 누락 29, `en_wiki_title` 누락 3, 둘 다 누락 3, `description` 누락 2

## [2026-02-25] [co] 누락 케이스 별도 분류 + 큐레이션 제외 자동화
* 사용자(jn)의 요청에 따라 “데이터 부족 항목은 큐레이션에서 제외” 정책을 반영.
* 신규 마이그레이션 추가:
  * `supabase/migrations/20260225193000_event_gap_cases.sql`
  * 목적: 누락 케이스를 `event_gap_cases` 테이블에 별도 저장(`reasons`, `missing_score`, `is_excluded`)
* 신규 스크립트 추가:
  * `scripts/wikidata/classifyGapsForCuration.mjs`
  * package script: `npm run collect:classify-gaps`
  * 동작:
    * `events` + `event_sources`를 기준으로 누락 reason 코드 분류
    * 보고서 `.cache/event-gap-cases.json` 생성
    * 누락 케이스를 `events.is_curated_visible=false`로 patch (기본 노출에서 제외)
    * `event_gap_cases` 테이블 존재 시 DB upsert
* 실행 결과 (`1950~1955`):
  * `scopedEvents=97`, `gapCases=46`, `excludedUpdated=46`
  * reason 분포:
    * `missing_modern_country`: 33
    * `missing_image`: 20
    * `missing_summary`: 3
    * `missing_wiki_title`: 3
    * `missing_source_description`: 2
* 상태 메모:
  * 현재 Supabase에는 `event_gap_cases`가 아직 없어 upsert는 스킵(경고 로그).
  * 하지만 `is_curated_visible=false` 반영은 완료(`false=46, null=51, true=0`).
  * anon 기본 노출 결과는 4건으로 축소되어 정책 반영 확인.

## [2026-02-25] [co] 파이프라인 디테일 선검증 게이트 적용
* 사용자(jn)의 요청에 따라 “디테일 없는 항목은 아예 적재 제외”하도록 수집 파이프라인 정책 변경.
* 변경 파일:
  * `scripts/wikidata/config.mjs`
    * `WIKIDATA_REQUIRE_DETAIL` (default `true`)
    * `WIKIDATA_MIN_DETAIL_SCORE` (default `1`)
  * `scripts/wikidata/run.mjs`
    * 적재 전 디테일 점수 계산(`wiki title`, `source description`, `modern_country`, `summary`, `image`)
    * 기준 미달 항목 skip 처리
    * 디테일 보강 패치(summary/image)와 적재 플로우 통합
    * 리포트 지표에 `detailKept`, `detailSkipped`, `detailKeepRate` 추가
  * `.env.example`, `06_[co]wikidata_pipeline_runbook.md`에 신규 옵션/동작 문서화
* 실행 검증 메모:
  * 로직/문법 검증(`node --check`) 통과.
  * 실백필 검증은 WDQS timeout/429(외부 API 상태)로 완료 로그 확보 실패.
  * 정책 자체는 기존 누락 분류/제외 자동화(`collect:classify-gaps`)와 결합되어 운용 가능 상태.

## [2026-02-25] [co] WDQS 병목 해소 후 1900~2000 이벤트 실수집 완료
* 사용자(jn)의 "본격 가동" 요청에 따라 실수집 실행 중 발생한 WDQS timeout 이슈를 쿼리 단에서 해결하고 전체 범위 재수집 수행.
* 변경 파일:
  * `scripts/wikidata/sparqlTemplates.mjs`
    * 이벤트 쿼리의 시간 필터를 UNION 바깥 공통 `YEAR(?timeRef)`에서 각 분기(`P580/P585/P571`) 내부 필터로 이동.
    * WDQS 병목을 유발하던 국가 라벨 join(`countryLabel_ko/en`) 제거.
* 검증:
  * `collect:probe` (`event`, `1900~1900`) 재검증 성공
  * 결과: `rows=26`, `normalized=26`, `detailKept=24`, `detailSkipped=2`
* 실수집 실행:
  * `collect:bootstrap` (`event`, `1900~2000`, `chunk=5y`, `page=80`) 완료
  * 파이프라인 최종 결과: `total=21`, `success=21`, `failed=0`
* 적재 결과 확인(Supabase):
  * `events=1807`, `event_sources=1807`
  * 샘플 확인 시 `event_kind/is_battle` 필드 정상 반영
* 후속 메모:
  * 현재 수집 실행은 `WIKIPEDIA_ENRICH=false` 상태라 `summary/image`는 별도 enrich 단계(`collect:enrich-existing`)에서 보강 필요.

## [2026-02-26] [co] 데이터 수집 현황 점검 리포트
* 사용자(jn) 요청으로 현재 데이터 수집 진행 상태를 로컬 체크포인트 + Supabase 실데이터 기준으로 점검.
* 실행 상태:
  * 수집 프로세스(`collect:bootstrap/backfill/enrich-existing`)는 현재 실행 중인 작업 없음.
  * `.cache/collect-full-20260225.log`는 0B로, 현재 시점 진행 중 로그는 비어 있음.
* 체크포인트 점검 결과:
  * `wikidata-checkpoint-live-full-20260225.json`: `event 1900~2000` 21/21 success, `records=1813`, `pages=39`.
  * `wikidata-checkpoint-place-full-1900-2000.json`: `place 1900~2000` 21/21 success, `records=1893`, `pages=43`.
  * `wikidata-checkpoint-person-probe-1900.json`: `person 1900` probe 실패(`AbortError`), `records=0`.
  * `wikidata-checkpoint.json`: 과거 실패/중단 실행 흔적(`WDQS 429`, `AbortError`, `running` 잔존) 확인.
* Supabase 실데이터 확인(서비스 롤 키 조회):
  * `events=2600`, `event_sources=2600`, `event_summary_archive=1068`.
  * `events` 연도 범위: `1900~2000`.
  * `event_kind` 분포: `place=1861`, `battle=712`, `treaty=11`, `war=8`, `disaster=7`, `historical_event=1`.
  * 최신 연도 샘플 조회 시 2000년 `place` 데이터 적재 확인.
* 리스크/미완료 사항:
  * `event_gap_cases` 테이블 조회 시 `404(PGRST205)`로 확인되어 현재 DB 스키마 캐시에 테이블이 없는 상태.
  * 과거 런의 실패 task가 레거시 체크포인트에 남아 있어 파일 기준 집계 시 현재 상태와 혼동 가능.

## [2026-02-26] [cl] GitHub → NAS Gitea 마이그레이션

### GitHub 계정 정지 대응
* GitHub 계정(leejinwoo1973) 정지 발생 — 원인 추정: 단시간 다수 push + Actions workflow 생성 + Vercel OAuth 인증
* 지원 경로 시도:
  * support.github.com/contact → CAPTCHA 동작 불가
  * Gmail → support@github.com → 5.7.1 정책 거부
  * Naver → support@github.com → 블로킹
* 복구 불가 판단 → GitHub 사용 중단 결정

### NAS Git Server 구축 (Synology DSM + Tailscale)
* Synology DSM Git Server 패키지 설치
* `/volume1/git/timeglobe.git` bare repository 생성
* 맥에서 SSH 키(ed25519) 생성 → NAS `authorized_keys` 등록
* NAS 홈 디렉토리 권한 수정(`chmod 755 ~`)으로 SSH 키 인증 활성화
* `git remote add nas ssh://jinadmin@100.115.194.12/volume1/git/timeglobe.git`
* `git push nas main` 성공 — Tailscale IP(100.115.194.12) 사용으로 어디서든 접속 가능

### Gitea 설치 (Docker, 웹 UI)
* NAS Docker에 Gitea 컨테이너 설치 (`gitea/gitea:latest`, 포트 3000)
* `http://100.115.194.12:3000` 접속하여 초기 설정 완료
* `jinadmin/timeglobe` 리포지터리 생성
* Access Token 발급 → remote URL에 토큰 인증 적용
* `git push origin main` 성공 — 웹에서 코드/커밋 확인 가능

### Git Remote 재구성
* `origin` → Gitea (`http://100.115.194.12:3000/jinadmin/timeglobe.git`)
* `nas` → bare repo (`ssh://jinadmin@100.115.194.12/volume1/git/timeglobe.git`)
* GitHub remote(`origin`) 제거

### 설정 파일 업데이트
* `CLAUDE.md`, `gemini.md`, `codex.md` — 저장소 정보 GitHub → Gitea로 변경
* 세션 시작/종료 시 `git pull/push origin main` 명령어로 통일

---

## 2026-02-27 (cl) — TripoSR 로컬 3D 모델링 환경 구축

### 3D 모델 생성 서비스 비교 조사
* Meshy.ai, Tripo3D 등 상용 Image-to-3D 서비스 테스트
* Image-to-3D 모드가 Text-to-3D보다 훨씬 우수, Meshy가 약간 우위
* GLB 포맷이 CesiumJS 네이티브 지원으로 권장
* Meshy 무료 티어는 다운로드 불가 (월 $20 유료) → TripoSR 로컬 대안 탐색

### TripoSR 로컬 환경 구축 (Ubuntu PC — jinserver)
* 서버: RTX 3080 10GB, Ubuntu 24.04, Tailscale IP 100.68.25.79
* SSH 원격 접속으로 전체 환경 세팅 수행
* Stable Diffusion 프로세스 종료 (5.3GB VRAM 확보)
* Python venv 생성 (`~/triposr/venv/`)
* TripoSR GitHub 클론 + PyTorch CUDA 12.1 + 의존성 설치
* torchmcubes 빌드 이슈 해결 (`python3-dev`, `nvidia-cuda-toolkit` 설치)

### CLI 테스트 성공
* `python run.py examples/chair.png --output-dir output/` — ~5초 생성 완료
* OBJ → GLB 변환: trimesh 라이브러리 사용

### Web UI 개발 (VRAM OOM 해결)
* 원본 Gradio UI (`gradio_app.py`) — CUDA OOM 반복 발생
  * chunk_size 조정, model.half(), torch.autocast 등 시도 → 모두 실패
  * 원인: 모델(~2GB) + GUI(~2GB) + 추론 활성화(~7GB) > 10GB VRAM
* **해결**: `web_ui.py` 신규 작성 — 서브프로세스 방식
  * 웹 서버 GPU 메모리 0, 매 요청마다 `run.py` 서브프로세스 실행
  * 생성 완료 후 프로세스 종료 → GPU 메모리 완전 해제
  * OBJ/GLB 파일 다운로드 지원

### 최종 결정
* TripoSR 품질: 모델링은 가능하나 텍스처/맵핑 후처리 필요
* **TimeGlobe 프로젝트**: Meshy.ai 등 상용 서비스 우선 사용
* **TripoSR 활용 계획**: 향후 대량 자동 생성/파이프라인 구축 시

### 문서 작성
* `docs/develop/07_[cl]triposr_local_setup_guide.md` — 서버 정보, 설치 구조, 사용법(CLI/Web UI/SSH), 알려진 이슈, 포맷 호환성, 향후 활용 아이디어 포함

## [2026-02-27] [cl] 3D 모델 카테고리 체계 설계 + 가이드 문서 작성

### 3D 모델 카테고리 체계 확정
* 진형(jn)과 논의하여 TimeGlobe 이벤트별 3D 모델 체계 설계 완료
* **Meshy Pro 구독** 결정 — 오픈소스 모델은 스타일 일관성 부족, AI 생성으로 통일감 확보
* 카테고리별 모델 목록:
  * **랜드마크** (20개): 피라미드, 콜로세움, 에펠탑, 자유의 여신상 등 실제 건축물
  * **전쟁/분쟁** (5개): 시대별 무기 — 검과방패 → 활 → 대포 → 소총 → 미사일기지
  * **혁명/봉기** (1개): 주먹과 깃발 (시대 구분 없이 통일)
  * **인물/문화** (1개): 대리석 흉상 (시대 구분 없이 통일)
  * **과학/발명** (5개): 시대별 — 파피루스 → 고서 → 톱니바퀴 → 원자모형 → 컴퓨터칩
  * **정치/사회** (1개): 두루마리 문서 (조약, 헌법, 선언 등)
  * **건국/수립** (2개): 고대~중세=국새/옥새, 근대 이후=국기(실제 국기 텍스처)
  * **선사시대** (3개): 주먹도끼(구석기) → 토기(신석기) → 청동도끼(청동기)
* 총 38개 모델, 글로벌 보편성 고려 (빗살무늬토기/비파형동검 등 한국 특유 유물 → 범용 형태로 교체)

### 문서 작성
* `docs/develop/08_[cl]3d_model_guide.md` — 카테고리별 모델 목록, 시대 연결 흐름도, 모델 선택 로직(TypeScript), Meshy 생성 팁, 파일 네이밍 규칙
