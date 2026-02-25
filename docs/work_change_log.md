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
