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

## [2026-02-27] [co] 0~1899 수집 실행 종료 현황 (event/place)
* 사용자(jn) 요청에 따라 장기 실행 중이던 `collect:bootstrap`(`--types event,place --year-from 0 --year-to 1899`)의 종료 시점 상태를 점검하고 결과를 기록.
* 실행 상태:
  * 관련 프로세스는 종료됨(`running=0`).
  * 체크포인트 파일: `.cache/wikidata-checkpoint-remaining-0-1899.json`
  * 체크포인트 최종 시각: `2026-02-27T08:31:29.628Z`
* 체크포인트 집계:
  * 총 task `760`, 처리 `760` (`progressPct=100`)
  * `success=658`, `failed=102`, `running=0`
  * success task 기준 누적 records `6522`
* 타입별 결과:
  * `event`: `tracked=380`, `success=380`, `failed=0`, `records=4385` (완료)
  * `place`: `tracked=380`, `success=278`, `failed=102`, `records=2137` (WDQS 오류 다수)
* DB 적재 현황(Supabase):
  * `events=9079`
  * `event_sources=9079`
  * `event_summary_archive=1068`
* 상태 메모:
  * `place` 실패 건은 실행 중 반복 확인된 WDQS `429/500/503` 및 `AbortError` 영향으로 판단.
  * 다음 스택(`person 0~1899`)은 아직 시작하지 않음.

## [2026-02-27] [cl] 전쟁/조약/재해 좌표 없는 이벤트 수집 지원 + AI 큐레이션 스크립트

### 문제 발견: 전쟁(war) 데이터 극소량
* DB 내 event_kind 분포 확인: battle=5033, place=3960, war=58, treaty=17, disaster=7
* **원인**: SPARQL 쿼리가 `wdt:P625 ?coord`(좌표 필수)로 되어 있어, 좌표 없는 전쟁/조약/재해가 대부분 누락
* 전쟁은 여러 지역에 걸치는 다지역 이벤트라 Wikidata에 단일 좌표가 없는 경우가 대부분

### DB 스키마 변경 (`20260227140000_event_significance_score.sql`)
* `location_lat`, `location_lng` — NOT NULL 제약 해제 (좌표 없이도 이벤트 적재 가능)
* `idx_events_needs_geocoding` — 좌표 미보유 이벤트 필터용 부분 인덱스
* `significance_score SMALLINT (1~10)` — AI 역사적 중요도 점수 컬럼 추가 (CHECK 제약 + 인덱스)

### SPARQL 쿼리 수정 (`scripts/wikidata/sparqlTemplates.mjs`)
* event 쿼리: `?coord` 를 OPTIONAL로 변경
* 좌표 fallback 체인 추가: P625(직접 좌표) → P276(장소의 좌표) → P17(국가의 좌표)
* 국가 라벨(countryLabel_ko/en)도 함께 수집
* person/place 쿼리는 기존 좌표 필수 유지

### Normalizer 수정 (`scripts/wikidata/normalizer.mjs`)
* `resolveCoord()` fallback 체인 함수 신규 추가
* event는 좌표 null 허용 (`coord?.lat ?? null`), person/place는 좌표 필수 유지
* `buildEventSelect()` 분리 — event 전용 SELECT 절 (locationCoord, countryCoord 포함)

### AI Geocoder 스크립트 신규 생성 (`scripts/curation/aiGeocoder.mjs`)
* Gemini 2.5 Flash 기반 좌표 없는 이벤트에 대략적 위치 추정
* 대상: `location_lat IS NULL` 이벤트만 (기존 좌표 있는 데이터 건드리지 않음)
* 배치 처리(10건씩), 429 Rate Limit 대응(지수 백오프), confidence(high/medium/low) 판정
* `modern_country`도 없으면 함께 보강
* `--dry-run`, `--limit`, `--model` 옵션 지원
* 판정 로그: `.cache/ai-geocoder-{timestamp}.jsonl`

### Battle Significance 스크립트 신규 생성 (`scripts/curation/battleSignificance.mjs`)
* Gemini 2.5 Pro 기반 전투/전쟁의 역사적 중요도 1~10 스코어링
* 대상: `is_curated_visible=true`, `significance_score IS NULL` 이벤트
* 스코어링 기준: 10=세계사를 바꾼 전투(워털루, 적벽), 1=알려지지 않은 소규모 충돌
* `--all-kinds` (비전투 포함), `--rescore` (재평가), `--dry-run` 옵션 지원

### AI 큐레이션 스크립트 (`scripts/curation/aiCurator.mjs`) 실행 완료
* Gemini 2.5 Flash 기반 place 이벤트 500건 큐레이션 실행
* 결과: 412건 승인, 88건 거부, 0건 오류

### 중복 방지 설계
* Wikidata 수집: `on_conflict=id` + merge-duplicates (deterministic UUID)
* AI Geocoder: `location_lat IS NULL` 필터 → 기존 좌표 데이터 보호
* Battle Significance: `significance_score IS NULL` 필터 → 기존 스코어 보호

### 실행 순서 (태훈(co)에게 인계)
1. Supabase SQL Editor에서 마이그레이션 실행
2. `node scripts/wikidata/run.mjs --types event --mode backfill` — 좌표 없는 이벤트 재수집
3. `node scripts/curation/aiGeocoder.mjs` — AI 좌표 매핑
4. `node scripts/curation/battleSignificance.mjs` — 전투 중요도 스코어링

## [2026-02-27] [cl] 이벤트 재수집(2단계)~AI 좌표 매핑(3단계) 재실행 결과 + 4단계 중단 사유

### 배경
* 사용자(jn) 요청에 따라 1단계(SQL 마이그레이션)는 사용자 측에서 직접 완료.
* 본 세션에서는 2단계부터 재실행.

### 2단계: 이벤트 재수집
* 실행:
  * `node scripts/wikidata/run.mjs --types event --mode backfill --year-from 0 --year-to 1899`
* 1차 실행에서 후반 청크 네트워크성 실패 발생:
  * `event:1750:1799`, `event:1800:1849`, `event:1850:1899` → `TypeError: fetch failed`
* 실패 구간만 재실행:
  * `node scripts/wikidata/run.mjs --types event --mode backfill --year-from 1750 --year-to 1899`
* 체크포인트 최종 상태(`.cache/wikidata-checkpoint.json`):
  * `event:1750:1799` = `success` (records=832)
  * `event:1800:1849` = `success` (records=1242)
  * `event:1850:1899` = `success` (records=1240)

### 3단계: AI 좌표 매핑
* Dry-run:
  * `node scripts/curation/aiGeocoder.mjs --dry-run`
  * 결과: total=500, geocoded=500, skipped=0, errors=0
  * 로그: `.cache/ai-geocoder-1772196367503.jsonl`
* 본실행:
  * `node scripts/curation/aiGeocoder.mjs`
  * 결과: total=500, geocoded=499, skipped=1, errors=0
  * 미추정 1건: `Battle of Behgy`
  * 로그: `.cache/ai-geocoder-1772197249185.jsonl`

### 4단계: 전투 중요도 스코어링
* Dry-run 시도:
  * `node scripts/curation/battleSignificance.mjs --dry-run`
  * 결과: 시작 직후 `TypeError: fetch failed` (2회 재시도 동일)
* 원인 확인:
  * DNS 해석 실패 (`Could not resolve host`)
  * 대상: `generativelanguage.googleapis.com`, Supabase 도메인, `www.google.com`
* 결론:
  * 4단계는 네트워크(DNS) 복구 전까지 진행 불가
  * 복구 후 재개 순서:
    1. `node scripts/curation/battleSignificance.mjs --dry-run`
    2. `node scripts/curation/battleSignificance.mjs`

## [2026-02-27] [cl] 인계사항 이어서 — AI Geocoder + Battle Significance 완료

### 사전 점검
* Supabase DB 상태 확인:
  * 총 이벤트: 12,194건
  * 좌표 미보유: 261건
  * significance_score 보유: 0건 (마이그레이션 적용 확인됨)
  * event_kind 분포: battle=7,313 / war=866 / place=3,960 / treaty=28 / disaster=7 / historical_event=20
* 이전 세션의 backfill(0~1899)은 이미 완료 상태 — 추가 재수집 불필요

### 3단계(재실행): AI Geocoder 좌표 매핑
* 대상: 좌표 미보유 261건
* Dry-run:
  * `node scripts/curation/aiGeocoder.mjs --dry-run --limit 261`
  * 결과: total=261, geocoded=260, skipped=1(Battle of Behgy), errors=0
  * 신뢰도: high=171, medium=76, low=13
* 본실행:
  * `node scripts/curation/aiGeocoder.mjs --limit 261`
  * 결과: total=261, geocoded=260, skipped=1(Battle of Behgy), errors=0
  * 신뢰도: high=177, medium=70, low=13
  * 로그: `.cache/ai-geocoder-1772201157722.jsonl`
* 처리 후 좌표 미보유: 1건 (Battle of Behgy — 추정 불가)

### 4단계: 전투 중요도 스코어링 (Battle Significance)
* 대상: is_curated_visible=true & is_battle=true & significance_score IS NULL → 406건
* Dry-run:
  * `node scripts/curation/battleSignificance.mjs --dry-run --limit 500`
  * 결과: 406건 중 386건 스코어링, 20건 오류(Gemini 503 서버 과부하 — 배치 12~13)
  * 점수 분포: 10=19, 9=44, 8=75, 7=75, 6=98, 5=40, 4=28, 3=6, 2=1
* 본실행:
  * `node scripts/curation/battleSignificance.mjs --limit 500`
  * 결과: **406건 전부 스코어링 성공, 오류 0건**
  * 점수 분포: 10=18, 9=44, 8=77, 7=83, 6=97, 5=42, 4=35, 3=8, 2=2
  * 로그: `.cache/battle-significance-1772203016346.jsonl`
  * Rate limit 429 발생 2회 (배치 28, 35) — 자동 재시도로 해결

### DB 최종 상태
* 총 이벤트: 12,194건
* 좌표 미보유: 1건 (Battle of Behgy)
* significance_score 보유: 406건 (전투 이벤트 대상)
* 10점 전투 예시: 적벽 대전, 밀비우스 다리, 카탈라우눔, 야르무크, 까디시야, 투르 푸아티에, 탈라스 등

## [2026-02-28] [cl] CShapes 2.0 하이브리드 국경 시스템 통합

### 배경
* 기존 historical-basemaps는 BC~AD 2010 53개 스냅샷이나 1815→1880(65년 갭), 1960→1994(34년 갭) 등 근대 시기 정밀도 부족
* CShapes 2.0 (ETH ICR, CC-BY-NC-SA 4.0): 1886~2019, 이벤트 기반(시작/종료 연도), 710개 폴리곤 레코드

### CShapes 2.0 다운로드 + 추출 (`scripts/geo/extractCShapes.py`)
* 원본 25MB GeoJSON (710 레코드, 252개 고유 국가명) 다운로드
* `CSHAPES_TO_NAME` 매핑 (CShapes cntry_name → 기존 ENTITY_RULES NAME): 50개 변환 규칙
* 좌표 경량화: precision=2 (~1km), decimate_ring nth=3 (3점마다 1점 추출)
* **117개 transition year** GeoJSON 파일 생성 (총 111.7MB)
* 파일: `public/geo/borders/cshapes_YYYY.geojson`

### 하이브리드 인덱스 (`public/geo/borders/index.json`)
* historical-basemaps: BC 123000 ~ AD 1880 (43개 엔트리)
* CShapes 2.0: AD 1886 ~ 2015 (117개 엔트리)
* 총 160개 엔트리 (기존 53개 → 3배 증가)

### borderIndex.ts 하이브리드 매칭
* **CShapes (1886+)**: floor match — 이벤트 기반 데이터이므로 직전 변동 연도가 정확한 국경
* **historical-basemaps (<1886)**: nearest match — 스냅샷 기반이므로 가장 가까운 연도 사용
* 이진탐색으로 O(log n) 매칭

### CesiumGlobe.tsx CShapes 데이터 연동
* CShapes GeoJSON의 `caplong`/`caplat` 속성을 라벨 위치에 직접 사용 (metadata capital_coords 불필요)
* 라벨 위치 우선순위: 1.metadata capital_coords → 2.CShapes caplong/caplat → 3.가상자식 있으면 스킵 → 4.centroid 폴백
* 메타데이터 로더: 정확한 연도 시도 → 실패 시 기존 HB 메타데이터 폴백

### 메타데이터 일괄 생성 (`scripts/geo/generateBorderMetadata.py`)
* CShapes 파일 자동 탐색(glob) 추가: HB 11개 + CShapes 117개 = 총 128개 연도
* 매핑 결과: 규칙 매칭 17,494건, 미매핑 3,469건 (대부분 소규모 영토)
* 미매핑 주요 엔티티: Alaska, Maldives, Palestine, Reunion 등 → 향후 점진 추가 예정

### 수정된 파일
* `scripts/geo/extractCShapes.py` — CShapes 연도별 GeoJSON 추출
* `scripts/geo/generateBorderMetadata.py` — CShapes 메타데이터 자동 생성
* `src/lib/borderIndex.ts` — 하이브리드 매칭 (floor/nearest)
* `src/components/CesiumGlobe.tsx` — CShapes caplong/caplat 라벨, 메타데이터 로더 개선
* `public/geo/borders/index.json` — 160개 하이브리드 인덱스

## [2026-02-28] [cl] 동아시아 시대별 라벨 수정 (YEAR_RANGE_OVERRIDES)
### 문제
* 1920년 한국: "조선 (Joseon)"으로 표시 → 일제강점기(1910-1945)인데 식민지 표시 없음
* 1920년 중국: "中国 (China)" → 중화민국 시기(1912-1949)인데 시대 반영 안 됨
* 1920년 일본: "日本 (Japan)" → 대일본제국 시기(1868-1947)인데 시대 반영 안 됨

### 수정 (`scripts/geo/generateBorderMetadata.py`)
* **YEAR_RANGE_OVERRIDES 시스템 신규 도입**: 기존 단일 연도 YEAR_OVERRIDES를 연도 범위 기반으로 교체
  * 한국: 1897-1910 대한제국(독립) / 1910-1945 대한제국(일본 식민지)
  * 일본: 1868-1947 大日本帝国 (Empire of Japan)
  * 중국: 1886-1911 大清帝國 (Qing Dynasty) / 1912-1949 中華民國 (Republic of China) / 1950+ 中国
  * 대만: 1895-1945 일본 식민지 표시
* **generate_entity_metadata()**: 범위 오버라이드 지원 + colony/ruler 오버라이드 가능
* **중복 스냅샷 제거**: CShapes가 있는 연도는 HB 메타데이터 생성 스킵 (HB 11→2개로 축소)

### 결과
* 1920년 Korea = "대한제국 (Korea) [大日本帝国]" ✓
* 1920년 China = "中華民國 (Republic of China)" ✓
* 1920년 Japan = "大日本帝国 (Empire of Japan)" ✓
* 1920년 Taiwan = "臺灣 (Taiwan) [大日本帝国]" ✓

## [2026-02-28] [cl] 국명 한국어화 Phase 2 — 전체 CShapes 국명 + 식민지 지배국명 한국어 번역

### 작업 내용
* 기존 Phase 1(346개 CShapes 국명)에 이어, **HB 전체 스냅샷(BC 123000~AD 1880)** 국명 한국어화 확장
* `generateBorderMetadata.py` ENTITY_RULES에 ~200개 고대 엔티티 추가:
  * 중국 왕조: 상(은), 주, 진, 한, 수, 당, 송, 요, 금, 서하, 명, 흉노, 남조 등
  * 한국: 고조선, 고구려, 백제, 신라, 가야, 발해, 고려
  * 일본: 조몬, 야요이, 아이누, 후지와라, 전국시대, 가마쿠라 막부
  * 동남아: 대월, 크메르, 참파, 스리비자야, 아유타야
  * 남아시아: 마우리아, 굽타, 쿠샨, 무굴, 델리 술탄국, 영국 동인도회사
  * 중동: 아케메네스, 사산, 아바스, 우마이야, 아시리아, 바빌로니아
  * 유럽: 로마 공화국/제국, 비잔틴, 신성 로마, 카롤링거, 서로마, 훈 제국
  * 아메리카: 아즈텍, 잉카, 마야, 올멕
  * 아프리카: 송가이, 가나 제국, 반투
* KOREAN_NAMES에 ~150개 한국어 번역 추가
* **HB_SNAPSHOTS 자동탐색**: 하드코딩 11개 → regex로 `world_*.geojson` 전체 자동 발견 (44개)

### CesiumGlobe.tsx 수정
* `loadMetadata()` 간소화: 하드코딩된 fallback 연도 리스트 제거 → 모든 스냅샷 연도(음수 BC 포함) 직접 fetch

### 메타데이터 재생성 결과
* 42개 신규 메타데이터 파일 생성 (BC 123000 ~ AD 900)
* 119개 기존 메타데이터 파일 업데이트
* 총 161개 스냅샷 메타데이터 (44 HB + 117 CShapes)

### 미번역 잔여 (2,435개)
* 대부분 원주민/부족명 (Aaniiih, Abenaki, Algonquin 등) — 표준 한국어 번역 없음
* 향후 필요 시 점진적 추가 가능

## [2026-02-28] [co] person 수집 쿼리 수정 + 다음 크롤링 순서 재정의
* 사용자(jn)의 요청에 따라 다음 데이터 수집 스케줄을 바로 이어서 진행할 수 있도록 `person` 쿼리 병목과 좌표 조건을 우선 수정.
* 배경:
  * 기존 `person` 수집은 `wdt:P625 ?coord` 직접 좌표를 강제하고 있어 역사 인물 대부분이 제외되거나 WDQS에서 비효율적인 넓은 스캔이 발생.
  * `person 0~1899` 체크포인트도 초반 구간(`0~64`)에서 `AbortError`가 연속 발생한 상태였음.
* 변경 파일:
  * `scripts/wikidata/sparqlTemplates.mjs`
    * `person` 전용 SELECT 절 분리.
    * 좌표 fallback 추가: `P625(직접)` → `P19(출생지)의 P625` → `출생지의 P17 국가 좌표` → `P27(시민권 국가) 좌표`.
    * 메인 `person` 적재도 `birth`만 보지 않고 `death/floruit(P2031/P2032)`까지 연도 앵커로 허용.
    * 기존 `EXISTS` 중복 sitelink 필터를 `BOUND(?koWikiTitle) || BOUND(?enWikiTitle)` 형태로 단순화.
    * `person`은 좌표 fallback 중 하나라도 있어야 통과하도록 필터 추가.
  * `scripts/wikidata/normalizer.mjs`
    * 엔티티 타입별 좌표 해석 우선순위 분리(`event/person/place`).
    * `person.start_year`는 `birth -> death -> floruit_start -> floruit_end` 순으로 fallback.
    * `person`의 `modern_country`는 시민권 국가 라벨 우선, 없으면 출생국가 라벨 fallback 사용.
  * `docs/develop/06_[co]wikidata_pipeline_runbook.md`
    * 보수적 `person probe` 실행 예시 추가.
    * 현재 권장 후속 순서(`place 복구 → person probe/적재 → enrich 후처리`) 반영.
* 운영 판단:
  * `event`는 이미 완료 범위가 충분하므로 다음 배치는 `place 0~1899` 실패 구간 복구가 우선.
  * `person`은 쿼리 수정 후 small-window `probe`로 품질/속도를 재검증하고, 통과 시에만 실제 적재를 진행하는 것이 안전.
  * `collect:enrich-existing`는 필수 선행 단계가 아니라 후처리로 유지.
* 검증 메모:
  * 로컬 문법 체크: `node --check scripts/wikidata/sparqlTemplates.mjs`, `node --check scripts/wikidata/normalizer.mjs` 통과.
  * 로컬 단위 검증: `buildQuery(person)`에 fallback 필드가 포함되는 것과 `normalizeBinding(person)`이 `birthPlaceCoord`를 정상 채택하는 것 확인.
  * 실네트워크 probe (`person 0~10`, `WDQS_TIMEOUT_MS=30000`) 재실행 결과:
    * 샌드박스 네트워크 차단 상태에서는 `TypeError: fetch failed`
    * 네트워크 허용 상태에서는 WDQS까지 요청은 나가지만 각 5년 청크가 `AbortError`로 타임아웃
    * 결론: 다음 live run은 `WDQS_TIMEOUT_MS 60000~90000` + `1~5년 window`로 더 보수적으로 시작 필요
* 권장 다음 실행 순서:
  1. `place` 실패 구간 backfill (`5~139`, `315~464`, `470~704`, `895~899`, `1855~1884`)
  2. `person` probe (`0~200`, 보수적 WDQS 설정)
  3. probe 안정 시 `person` bootstrap/backfill 범위 확대
  4. 마지막에 `collect:classify-gaps`, 필요 시 `collect:enrich-existing`

## [2026-02-28] [co] person 후보 큐(`person_candidates`) 도입
* 사용자(jn)와 논의한 정책에 따라, `birth/death/floruit`가 전혀 없더라도 중요한 인물일 가능성을 남겨두기 위해 본 타임라인 적재와 별도의 후보 큐를 추가.
* 핵심 결정:
  * `events` 본테이블은 계속 `start_year`가 있는 엔터티만 적재.
  * 연도 앵커가 없는 `person`은 버리지 않고 `person_candidates`에 별도 적재.
  * 이후 Gemini 기반 역사 검증/중요도 판정 단계에서 `review_status`를 갱신해 승격/제외 판단.
  * `birth`가 없어도 `death`나 `floruit`가 있으면 메인 `person` 적재 후보로 본다.
* 신규 마이그레이션:
  * `supabase/migrations/20260228170000_person_candidates.sql`
  * 필드:
    * `qid`, `title`, `description`, `birth_year`, `death_year`, `floruit_start_year`, `floruit_end_year`
    * `anchor_year`, `anchor_type` (있으면 메인 타임라인 편입 후보로 활용 가능)
    * `location_lat/lng`, `modern_country`, `external_link`, `ko_wiki_title`, `en_wiki_title`
    * `sitelinks_count` (Wikidata sitelinks 수 기반 중요도 프록시)
    * `review_status/review_reason/review_confidence`, `source_payload`
* 신규 스크립트:
  * `scripts/wikidata/collectPersonCandidates.mjs`
  * package script: `npm run collect:person-candidates`
  * 동작:
    * `Q5(인간)` + `ko/en wiki sitelink` 기반으로 후보 수집
    * `wikibase:sitelinks`를 중요도 프록시로 저장하고, 수집 시에는 `--min-sitelinks` threshold로 후보를 압축
    * `birth/death/floruit(P2031/P2032)`는 있으면 저장, 없어도 적재 가능
    * 좌표는 `P625 -> P19 출생지 -> 출생국가 -> 시민권 국가` fallback 사용
* 운영 메모:
  * live WDQS 확인 시 `Q5 + ko.wikipedia sitelink`만으로도 약 17만 건 규모여서, `person`을 이벤트 테이블처럼 그대로 넣는 건 과도함.
  * 초기 구현에서 `ORDER BY sitelinks`는 WDQS timeout을 유발해 제거했고, 이후에는 `가벼운 WDQS 목록 조회 -> wbgetentities 상세 보강` 2단계 수집으로 전환.
  * `--min-sitelinks`로 후보를 걸러 DB 적재 후 `sitelinks_count DESC`로 우선순위를 보는 방식이 기본.
  * 메인 `person` 수집은 여전히 anchor year가 있는 경우에만 유지하는 것이 타임라인 품질 측면에서 안전.
* 검증 메모:
  * `node --check scripts/wikidata/collectPersonCandidates.mjs` 통과.
  * live dry-run(`limit=5`, `source_lang=ko`, `min_sitelinks=1000`)은 기본 timeout 25초에서 `AbortError` 반복.
  * 2단계 수집 구조로 경량화 후에도 `WDQS_TIMEOUT_MS=90000` 환경에서 최종 `WDQS 504: upstream request timeout` 확인.
  * 결론: 후보 큐 구현 자체는 완료됐지만, 실제 수집은 오프피크 시간대 장기 배치 또는 추가 분할 전략이 필요.
  * 추가 분할 적용:
    * WDQS seed를 `source-lang`별 실제 sitelink(`ko` 또는 `en`)에서 시작하도록 변경.
    * `--max-sitelinks` 옵션을 추가해 sitelinks 상단 구간만 잘라서 초소형 dry-run 가능하게 조정.
  * 초소형 dry-run 결과 (`source_lang=ko`, `limit=3`):
    * `5000~200000 sitelinks`: `0건`
    * `1000~5000 sitelinks`: `0건`
    * `100~1000 sitelinks`: `3건` 성공
      * `찰스 다윈`(Q1035, sitelinks=275, anchor=1809)
      * `엑토르 베를리오즈`(Q1151, sitelinks=133, anchor=1803)
      * `이븐 알하이삼`(Q11104, sitelinks=104, anchor=965)
  * 현재 판단:
    * `ko` seed 기준으로는 상단 고sitelinks 구간보다 `100~1000` 같은 중간 밴드부터 점진 수집하는 편이 현실적.
  * 추가 검증 (`2026-02-28 15:21 KST`):
    * `source_lang=en`, `1000~5000 sitelinks`, `limit=3` dry-run은 `WDQS 504`로 실패.
    * fallback으로 `source_lang=ko`, `100~1000 sitelinks`, `offset=3`, `limit=3` dry-run 실행 시 `3건` 정상 응답.
      * `움 쿨숨`(Q1110560, sitelinks=106, anchor=1898)
      * `존 매케인`(Q10390, sitelinks=132, anchor=1936)
      * `데이비드 베컴`(Q10520, sitelinks=135, anchor=1975)
    * 결론: 당장은 `en` 중간 밴드보다 `ko` 중간 밴드를 `offset`으로 넘기며 잘게 수집하는 쪽이 안정적.
  * 추가 dry-run 재현 확인:
    * `source_lang=ko`, `100~1000 sitelinks`, `limit=3`에서 `offset=6/9/12` 모두 정상 응답.
      * `offset=6`: `빌 클린턴`, `마하트마 간디`, `율리우스 카이사르`
      * `offset=9`: `세리나 윌리엄스`, `고든 브라운`, `바하올라`
      * `offset=12`: `카멀라 해리스`, `자와할랄 네루`, `아일톤 세나`
    * 따라서 현재 시간대에도 `ko 100~1000` 밴드는 초소형 표본 수집이 재현됨을 확인.
  * 실제 적재 시도:
    * `source_lang=ko`, `100~1000 sitelinks`, `limit=5`, `offset=0` 실제 실행에서는 WDQS 수집 자체는 통과했으나,
      PostgREST가 `public.person_candidates`를 schema cache에서 찾지 못해 `404(PGRST205)`로 실패.
    * 결론: 다음 단계는 쿼리 안정화보다 먼저 Supabase에 `20260228170000_person_candidates.sql` 반영 여부를 맞추는 것.
  * 원격 migration 적용 경로 점검:
    * 서비스 롤 키로 `POST /pg/v1/query` 호출을 시도했으나 현재 프로젝트에서는 `404 requested path is invalid`.
    * 로컬 환경에 `SUPABASE_ACCESS_TOKEN`은 없어서 Supabase Management API 기반 원격 SQL 실행은 바로 사용할 수 없는 상태.
    * 후속 조치로 `scripts/supabase/applyMigration.mjs`와 `npm run supabase:apply-migration` 스크립트를 추가.
      * `SUPABASE_ACCESS_TOKEN` + `SUPABASE_URL` 기준으로 project ref를 유도해 management API로 migration SQL 파일을 실행하는 용도.
      * PAT가 없으면 기존처럼 Supabase SQL Editor 수동 실행이 필요.
  * 사용자(jn)가 Supabase SQL Editor에서 `20260228170000_person_candidates.sql` 실행 완료.
  * 실행 직후 live 적재 재검증:
    * `source_lang=ko`, `100~1000 sitelinks`, `limit=5`, `offset=0` 실제 적재 성공.
      * 적재 샘플: `찰스 다윈`, `엑토르 베를리오즈`, `이븐 알하이삼`, `움 쿨숨`, `존 매케인`
    * 이어서 `limit=5`, `offset=5` 실제 적재도 성공.
      * 적재 샘플: `데이비드 베컴`, `빌 클린턴`, `마하트마 간디`, `율리우스 카이사르`, `세리나 윌리엄스`
    * 원격 확인 결과 `public.person_candidates` 총 `10`건 적재 확인.
  * pagination 안정화 조치:
    * `collectPersonCandidates.mjs`의 WDQS seed 쿼리를 subquery로 감싸고 `ORDER BY ?item`을 추가.
    * 목적: optional label join 전에 `LIMIT/OFFSET`을 적용해 batch 경계가 흔들리지 않도록 고정.
    * 주의: 기존 무정렬 상태에서 들어간 10건이 있어, 안정 정렬 기준 전환 후 `offset=0/5`를 다시 실행해 앞페이지를 재정렬 기준으로 보정.
  * 안정 정렬 기준 live 적재 결과:
    * `offset=0`: `프랑수아 올랑드`, `지미 웨일스`, `래리 생어`, `데이비드 캐머런`, `스티븐 하퍼`
    * `offset=5`: `조지 워싱턴`, `더글러스 애덤스`, `조지 W. 부시`, `볼프강 아마데우스 모차르트`, `루트비히 판 베토벤`
    * `offset=10`: `버락 오바마`, `팀 버너스리`, `에이브러햄 링컨`, `프레드 아스테어`, `레이철 카슨`
    * `offset=15`: `바하올라`, `타보 음베키`, `메리 울스턴크래프트`, `시고니 위버`, `마르그레테 2세`
    * 원격 확인 결과 `public.person_candidates` 총 `30`건 적재 확인.
  * 운영 메모:
    * 안정 정렬 이후 batch 1회당 소요 시간이 대략 `30~55초`로 증가.
    * 현재 프로필(`WDQS_TIMEOUT_MS=90000`, `limit=5`)에서는 timeout 없이 완료되므로, 오프피크 시간대 소배치 반복에는 사용 가능.
  * 장기 배치 래퍼 추가:
    * `scripts/wikidata/runPersonCandidateBatches.mjs`
    * package script: `npm run collect:person-candidates-batch`
    * 기능:
      * `start-offset`, `batch-count`, `offset-step`, `state-file`, `report-dir` 지원
      * `collect:person-candidates`를 순차 호출하며 batch별 report와 `nextOffset` 상태를 저장
      * runner 레벨 `max-batch-attempts`, `batch-retry-delay-ms`로 같은 offset 재시도 지원
  * live 검증:
    * `offset=20`, `batch-count=1`로 런너 진입 자체는 정상 확인.
    * 다만 `2026-02-28 15:54~15:57 KST` 구간 WDQS 연결이 불안정해 `TypeError: fetch failed`가 연속 발생.
    * 단일 수집(`collect:person-candidates`)과 배치 런너 모두 같은 증상을 보여, 런너 결함이 아니라 시점상 WDQS 연결 상태 문제로 판단.
    * 배치 런너는 실패 후 같은 offset(`20`)을 재시도하는 동작까지 확인.
  * 현재 결론:
    * 백그라운드 장기 배치 명령 자체는 준비 완료.
    * 실제 상시 실행은 `WDQS_MAX_RETRIES=3`, `WDQS_BASE_DELAY_MS=2000`, `WDQS_REQUEST_DELAY_MS=1200`,
      `max-batch-attempts=3`, `batch-retry-delay-ms=15000` 프로필로 오프피크 시간대에 시작하는 편이 안전.
  * 운영 UI 추가:
    * `src/app/api/ops/pipeline-status/route.ts`
      * `.cache` 전체 스캔
      * `.log`, `*state.json`, `*checkpoint*.json`, recent report JSON 요약
      * `ps aux` 기반 현재 실행 중인 wikidata/curation 프로세스 감지
      * Supabase `events`, `event_sources`, `person_candidates` 카운트와 최신 row 요약 제공
    * `src/app/ops/page.tsx`
      * 5/15/30초 자동 새로고침 지원
      * 원격 테이블 현황, 실행 중인 스크립트, 체크포인트 진행률, state 파일, 로그 tail, 최근 리포트, 최근 경고/에러를 한 화면에 표시
      * `/data-check`에서 바로 진입할 수 있도록 링크 추가
  * 검증:
    * `npm run build` 통과
    * 생성 라우트: `/ops`, `/api/ops/pipeline-status`
  * 후속 hotfix:
    * `/ops` 로그/에러/리포트 리스트에서 같은 문자열이 반복될 때 React duplicate key 경고가 발생.
    * `tailLines`, `checkpoint.recentErrors`, `report.sampleTitles`, `recentErrors` 렌더링 key를 index 조합 형태로 변경.
    * 수정 후 `npm run build` 재통과.
  * person 후보 장기 배치 재검증 (`2026-02-28 17:57~18:28 KST`):
    * `offset=20`, `batch-count=1`을 foreground로 붙어서 재실행.
    * 기본 샌드박스 실행에서는 `TypeError: fetch failed`가 반복되어 진행 불가.
    * 원인 분리 결과:
      * 아주 작은 WDQS 쿼리는 `curl`/`node fetch` 모두 응답.
      * 실제 `person_candidates` seed 쿼리(`ko`, `100~1000 sitelinks`, `offset=20`)는 `curl`로는 정상 응답 확인.
      * 같은 쿼리를 agent 일반 샌드박스에서 실행하면 `fetch failed`가 반복되어, agent 실행 환경의 네트워크 제약이 크게 작용하는 것으로 판단.
    * 대응:
      * `scripts/wikidata/wdqsClient.mjs`에 transport 실패(`fetch failed`, `AbortError`) 시 `curl` fallback 추가.
      * 이후 `권한 상승` 실행 기준으로는 `WDQS 504` 1회 재시도 후 `offset=20` batch 성공.
      * 결과:
        * state file `nextOffset=25`
        * `person_candidates` 원격 row count `30 -> 35`
    * 추가 관찰:
      * `nohup` 기반 detached background resume(`offset=25`부터 11 batch)는 agent 도구 환경에서는 로그 시작까지만 남고 실제 진행/상태 갱신이 이어지지 않음.
      * state file, remote row count 모두 `35`에서 정지.
    * 현재 판단:
      * 실제 수집 로직은 살아 있음.
      * agent가 띄운 detached background job은 신뢰하기 어려워, 다음 실행은 foreground 모니터링 또는 사용자의 로컬 터미널 직접 실행이 더 안전.
  * person 후보 장기 배치 추가 진행 (`2026-02-28 18:38~18:44 KST`):
    * 사용자가 로컬에서 직접 돌릴 시간이 없어, 같은 프로필로 foreground 모니터링을 이어서 수행.
    * 실행:
      * `--resume --batch-count 4 --limit 5 --min-sitelinks 100 --max-sitelinks 1000 --source-lang ko`
      * `WDQS_TIMEOUT_MS=90000`, `WDQS_MAX_RETRIES=3`, `WDQS_BASE_DELAY_MS=2000`, `WDQS_REQUEST_DELAY_MS=1200`
    * 결과:
      * `offset=45` 성공 -> `nextOffset=50`
      * `offset=50` 성공 -> `nextOffset=55`
      * `offset=55`는 `WDQS 504` 1회 재시도 후 성공 -> `nextOffset=60`
      * `offset=60`도 `WDQS 504` 1회 재시도 후 성공 -> `nextOffset=65`
    * state file:
      * `.cache/person-candidates-ko-low-state.json`
      * `completedBatches=9`, `lastOffset=60`, `nextOffset=65`
    * 원격 적재 현황:
      * Supabase `person_candidates` row count `54 -> 74`
    * 샘플 report:
      * `offset=45`: 마이클 케인, 게오르기 주코프, 도나시앵 알퐁스 프랑수아 드 사드, 싱클레어 루이스, 우마 서먼
      * `offset=50`: 살마 아예크, 아레사 프랭클린, 윌리엄 제임스, 그나이우스 폼페이우스 마그누스, 파르메니데스
      * `offset=55`: 토머스 페인, 크리스틴 스튜어트, 앨버트 에이브러햄 마이컬슨, 조지 3세, 프랭크 자파
      * `offset=60`: 샬럿 브론테, 더글러스 맥아더, 마이모니데스, 콘스탄틴 체르넨코, 모하마드 레자 팔라비
    * 결론:
      * foreground + 권한 상승 + 보수적 retry 프로필은 현재 시점에서 안정적으로 동작.
      * 공개 WDQS `504`는 간헐적으로 발생하지만, 현재 프로필에선 1회 재시도로 회복 가능.
  * person 후보 장기 배치 추가 진행 (`2026-02-28 18:49~18:58 KST`):
    * 사용자의 요청에 따라 같은 foreground 모니터링 전략을 한 번 더 연속 수행.
    * 실행:
      * `--resume --batch-count 4 --limit 5 --min-sitelinks 100 --max-sitelinks 1000 --source-lang ko`
      * 동일 프로필 유지: `WDQS_TIMEOUT_MS=90000`, `WDQS_MAX_RETRIES=3`, `WDQS_BASE_DELAY_MS=2000`, `WDQS_REQUEST_DELAY_MS=1200`
    * 결과:
      * `offset=65`는 첫 라운드에서 `WDQS 504` 3회 후 실패 -> 런너가 same offset batch-level retry 수행
      * 같은 `offset=65` 재실행에서 `WDQS 504` 2회 후 성공 -> `nextOffset=70`
      * `offset=70`, `75`, `80`은 추가 batch-level retry 없이 연속 성공
    * state file:
      * `.cache/person-candidates-ko-low-state.json`
      * `completedBatches=13`, `lastOffset=80`, `nextOffset=85`
    * 원격 적재 현황:
      * Supabase `person_candidates` row count `74 -> 94`
    * 샘플 report:
      * `offset=65`: 샤를 페로, 그레이엄 그린, 존 포브스 내시, 클레멘트 애틀리, 로제 마르탱 뒤 가르
      * `offset=70`: 니콜라이 로바쳅스키, 비비언 리, 크세노폰, 러셀 크로, 휴 잭맨
      * `offset=75`: 조지 마이클, 니콜라이 1세, 로버트 앤드루스 밀리컨, 프랑수아 라블레, 마리아 몬테소리
      * `offset=80`: 헨리 데이비드 소로, 시린 에바디, 리콴유, 후안 라몬 히메네스, 재닛 잭슨
    * 결론:
      * 현재 시점의 WDQS는 `offset=65` 구간처럼 같은 offset에서 연속 `504`가 나올 수 있음.
      * 그래도 `runPersonCandidateBatches.mjs`의 batch-level retry가 있어 foreground 운영은 계속 가능.
  * person 후보 limit 상향 소량 검증 (`2026-02-28 19:05~19:06 KST`):
    * 사용자의 요청에 따라 속도 상향 가능성 검증을 위해 batch runner가 아닌 단일 수집으로 `limit=10` 실수집을 수행.
    * 실행:
      * `npm run collect:person-candidates -- --limit 10 --offset 85 --min-sitelinks 100 --max-sitelinks 1000 --source-lang ko`
      * report: `.cache/person-candidates-ko-100-1000-offset85-limit10-live.json`
    * 결과:
      * `fetchedRows=10`, `normalizedRows=10`, `withAnchor=10`, `withCoord=10`
      * WDQS timeout/504 재시도 없이 단일 실행 성공
      * 실행 시간은 약 48초로, 최근 `limit=5` 단일 배치(대체로 30~55초)와 비슷한 수준
    * 원격 적재 현황:
      * Supabase `person_candidates` row count `94 -> 104`
    * 의미:
      * 현재 시점/쿼리 조건에서는 `limit=10`이 `limit=5` 대비 처리량이 거의 2배
      * 따라서 이후 운영은 `상시 보수 프로필(limit=10)`과 `오프피크 공격 프로필(limit>10)`의 2단계로 나누는 것이 현실적
  * person 후보 adaptive probe 기반 자동 조절 도입 (`2026-02-28 19:16~19:19 KST`):
    * 사용자의 요청에 따라, WDQS 상태를 보고 `person_candidates` batch `limit`을 자동으로 조절하는 운영 경로를 구현.
  * 구현:
    * `scripts/wikidata/personCandidateQuery.mjs`
      * `collectPersonCandidates`와 probe가 같은 seed query를 쓰도록 공용 query builder 분리
    * `scripts/wikidata/wdqsProbe.mjs`
      * `transport probe`: `ASK { wd:Q42 wdt:P31 wd:Q5 }`
      * `shape probe`: 실제 `person_candidates` seed query와 동일한 조건으로 `LIMIT 1`
      * 결과를 바탕으로 `safe / normal / burst / pause` 프로파일 판정
      * `.cache/wdqs-probe-history.jsonl`에 JSONL 누적 기록 지원
    * `scripts/wikidata/runPersonCandidateBatches.mjs`
      * `--adaptive` 모드 추가
      * `--safe-limit`, `--normal-limit`, `--burst-limit` 지원
      * probe 결과에 따라 batch별 `limit` 자동 변경
      * `nextOffset`을 고정 `limit` 대신 실제 `fetchedRows` 기준으로 갱신하도록 변경
      * transport/shape probe가 모두 실패하면 같은 offset에서 pause 후 재probe
    * `package.json`
      * `npm run collect:wdqs-probe` 추가
  * 검증:
    * `node --check`
      * `personCandidateQuery.mjs`
      * `wdqsProbe.mjs`
      * `collectPersonCandidates.mjs`
      * `runPersonCandidateBatches.mjs`
      * 모두 통과
    * live WDQS probe (`offset=85`, `ko`, `100~1000 sitelinks`)
      * transport: `988ms`
      * shape: `15414ms`
      * 판정: `normal`
      * 추천 limit: `10`
      * report: `.cache/wdqs-probe-offset85.json`
    * adaptive smoke run
      * `--adaptive --dry-run --start-offset 85 --batch-count 1`
      * probe가 `normal -> limit=10`을 선택
      * 실제 batch도 `fetchedRows=10`, `normalizedRows=10`으로 성공
      * smoke state: `.cache/person-candidates-adaptive-smoke-state.json`
      * smoke report: `.cache/person-candidate-batches/adaptive-smoke/person-candidates-ko-100-1000-offset85-limit10-dry.json`
  * 결론:
    * 이제 `person_candidates`는 수동으로 `limit`을 바꾸지 않아도, probe 결과에 따라 `5 / 10 / 20` 범위에서 자동 운영 가능
    * `.cache/wdqs-probe-history.jsonl`을 쌓으면 이후 시간대별 성공률/지연시간 기반으로 off-peak를 더 정확히 잡을 수 있음
  * person 후보 main state 정렬 + adaptive live 검증 (`2026-02-28 19:24~19:27 KST`):
    * 배경:
      * `offset=85`, `limit=10` live 단일 수집은 이미 끝났지만 메인 state file은 아직 `nextOffset=85`에 머물러 있어 중복 수집 위험이 있었음.
    * 조치:
      * `.cache/person-candidates-ko-low-state.json`을 `offset=85` live report 기준으로 정렬
      * `nextOffset=95`, `lastOffset=85`, `completedBatches=14`로 맞춤
    * adaptive live 실행:
      * `--resume --batch-count 4 --adaptive`
      * `safe-limit=5`, `normal-limit=10`, `burst-limit=20`
    * 실제 동작:
      * `offset=95`: probe `normal` -> `limit=10` -> `10건` 성공
      * `offset=105`: probe `safe` (`shape via curl`, `45223ms`) -> `limit=5` -> `5건` 성공
      * `offset=110`: probe `burst` -> `limit=20` -> `20건` 성공
      * `offset=130`: probe `normal` -> `limit=10` -> `10건` 성공
    * 결과:
      * state file `nextOffset=140`, `completedBatches=18`
      * `lastProbe`가 state에 기록되어 마지막 adaptive 판정 근거 확인 가능
      * Supabase `person_candidates` row count `104 -> 149`
    * 의미:
      * adaptive가 단순 판정 로그만 남기는 수준이 아니라, live 운영에서 실제로 `5 / 10 / 20`을 오가며 batch 크기를 조절하는 것 확인
      * 특히 `offset=105`에서 느린 shape probe를 감지해 `safe`로 내리고, 직후 `offset=110`에서 다시 `burst`로 올린 점이 핵심
      * 따라서 이후 person 후보 수집은 기본적으로 adaptive 모드로 굴리는 것이 수동 조절보다 합리적
  * person 후보 adaptive 재기동 래퍼 추가 (`2026-02-28 21:19 KST`):
    * 배경:
      * adaptive batch runner는 `batch-count`를 채우면 정상 종료되므로, 프로세스가 비어 보이는 시점이 반복 발생.
      * detached background 장기 실행은 이 agent 환경에서 신뢰성이 낮아, 사용자가 원하는 "로컬 터미널/cron 기준 안정적 재기동" 경로가 필요했음.
    * 구현:
      * `scripts/wikidata/runAdaptivePersonCandidatesOnce.mjs`
        * 기존 adaptive batch runner를 `--resume` 기준으로 한 덩어리씩 실행하는 래퍼
        * 기본 WDQS 운영값(`90000/3/2000/1200`)을 env 기본값으로 주입
        * `.cache/person-candidates-adaptive-job.lock` 디렉터리 lock으로 overlap 방지
        * stale lock은 자동 정리, 살아 있는 기존 실행이 있으면 `exit 0`
      * `package.json`
        * `npm run collect:person-candidates-adaptive-once` 추가
    * 검증:
      * `node --check scripts/wikidata/runAdaptivePersonCandidatesOnce.mjs` 통과
      * `npm run collect:person-candidates-adaptive-once -- --batch-count 0` 실행 시 네트워크 없이 skip 동작 확인
    * 운영 의미:
      * 이제 long-running detached process를 유지하지 않고, cron이나 로컬 반복 호출로 adaptive 수집을 안정적으로 이어갈 수 있음.
      * 권장 방식은 짧은 adaptive chunk를 lock 기반으로 주기 재기동하는 구조.

## [2026-02-28] [cl] BORDERPRECISION 기반 고대 국경 블러 셰이더 구현

### 배경
* 지훈(gm)이 제안한 "고대=블러/근대=실선" 국경 시각화 미적용 상태
* HB GeoJSON에 이미 `BORDERPRECISION` 필드 존재 (BP=1 근사치, BP=2 중간, BP=3 확정)
* 연도 기반이 아닌 **엔티티별 태그** → 같은 연도에도 도쿠가와=실선, 호주원주민=블러 가능
* 외부 리서치: 베스트팔렌 조약(1648)이 학술 표준, BP 전환점=1650년과 일치

### CesiumGlobe.tsx 변경 내역
* **import 추가**: `ClassificationType`, `PolylineDashMaterialProperty`, `PolygonHierarchy`, `BlurStage`(Resium), `useState`, `useCallback`
* **`extractPolygonHierarchies()` 신규 함수**: GeoJSON Polygon/MultiPolygon → `PolygonHierarchy[]` 변환 (BP=1 filled polygon용)
* **`loadBordersAsPolylines()` 리팩토링**:
  * 반환 타입: `CustomDataSource` → `{ ds, bp1Ratio }` (블러 강도 제어용)
  * `BORDERPRECISION` 읽기: CShapes=항상 3, HB=필드값(기본 1)
  * BP=1 (근사치): filled polygon + alpha 0.25, outline 없음 (PolygonGraphics 크래시 시 polyline fallback)
  * BP=2 (중간): dashed polyline (`PolylineDashMaterialProperty`, dashLength=12)
  * BP=3 (확정): 기존 solid polyline 유지
  * BP=1 비율(bp1Ratio) 집계 → `onBlurRatioChange` 콜백으로 부모에 전달
* **Resium `<BlurStage>` 추가** (CesiumGlobe Viewer 내부):
  * `enabled={blurRatio > 0.05}` — BP=1 5% 초과 시 블러 활성화
  * `sigma={blurRatio * 3.0}` — 100% BP=1일 때 최대 블러
  * `stepSize={blurRatio * 2.0}` — 블러 확산 범위
* **SceneSetupProps**: `onBlurRatioChange` 콜백 추가

### 예상 시각 효과
* BC 1000년 (100% BP=1): 반투명 영역 + 가우시안 블러 → "시간의 안개"
* AD 1650년 (혼합): 도쿠가와=실선, 호주원주민=블러
* AD 1920년 (100% BP=3): 블러 OFF, 선명한 국경선

## [2026-02-28] [cl] 문명권 색상 팔레트 세분화 (18→31개)

### 문제
* 인접 국가가 동일 문명권 팔레트를 공유하여 지도상 구분 불가
* 예: 송/요/금이 모두 같은 EastAsia 색상, 이슬람권 국가 전체 동색

### PALETTES 확장 (`generateBorderMetadata.py`)
* 기존 18개 → 28개 → 최종 31개 팔레트로 세분화
* 신규 팔레트:
  * `EastAsia_Alt` (#D4AC0D) — 요/금 등 북방 왕조 대체색
  * `Manchuria` (#D68910) — 여진/만주 계열
  * `Islamic_Arab` (#1ABC9C) — 아랍 이슬람
  * `Islamic_Turk` (#48C9B0) — 튀르크 이슬람 (셀주크, 오스만 등)
  * `Persian` (#76D7C4) — 페르시아 계열
  * `Africa_East` (#A569BD) — 동/남아프리카
  * `Africa_West` (#8E44AD) — 서아프리카
  * `Maritime_SEA` (#27AE60) — 해양 동남아 (스리비자야, 마자파힛 등)
  * `Korea_Koguryo` (#884EA0) — 고구려 (보라)
  * `Korea_Paekche` (#E59866) — 백제 (살구색)
  * `Korea_Gaya` (#F0B27A) — 가야 (앰버)

### ENTITY_RULES 대규모 재배정
* `Islamic` → `Islamic_Arab` / `Islamic_Turk` / `Persian` 분리
* `Africa` → `Africa_West` / `Africa_East` 분리
* `SoutheastAsia` → `Maritime_SEA` (해양 국가) 분리
* 특정 엔티티: 사산→Persian, 프톨레마이오스→Greek, 나바테아/사바/히미아르→AncientNE, 가즈나비→Islamic_Turk 등

### 결과
* 161개 메타데이터 파일 재생성
* 1200년: 송(#F4D03F), 몽골(#A93226), 요(#D68910), 티벳(#AF7AC5), 크메르(#27AE60) — 인접국 색상 구분 확인

## [2026-02-28] [cl] 고려/조선 라벨 오류 수정 + 한국어 라벨 우선 표시

### 문제
* 1135년에 고려가 "조선"으로 표시 — HB GeoJSON이 918~1392년 고려 시기에 `NAME=Korea` 사용 → ENTITY_RULES가 "Korea"→"조선" 매핑
* 신라가 가끔 영어 "Silla"로 표시

### 수정 (`generateBorderMetadata.py`)
* **YEAR_RANGE_OVERRIDES 추가**: `("Korea", 918, 1392)` → 고려
* 메타데이터 재생성

### 수정 (`CesiumGlobe.tsx`)
* 라벨 텍스트 우선순위: `display_name_ko` → `display_name` → 원본 NAME
* 가상 엔티티 라벨도 동일 적용

## [2026-02-28] [cl] 삼국시대 색상 분리 + 통일신라 구별

### 문제
* 고구려, 백제, 신라, 가야가 모두 동일한 Korea 팔레트(#45B39D) 사용
* 신라와 통일신라(668~935) 구분 없음

### 수정 (`generateBorderMetadata.py`)
* **삼국시대 전용 팔레트 3개 추가**:
  * `Korea_Koguryo` (#884EA0, 보라) — 고구려, 발해(후계국)
  * `Korea_Paekche` (#E59866, 살구색) — 백제
  * `Korea_Gaya` (#F0B27A, 앰버) — 가야
  * 신라는 기존 `Korea` (#45B39D) 유지
* **YEAR_RANGE_OVERRIDES 추가**: `("Silla", 668, 935)` → "통일신라"

## [2026-02-28] [cl] 위진남북조 시대 엔티티 매핑 + palette override 기능

### 문제
* 340년경 "Jin" 엔티티가 회색(미매핑) — ENTITY_RULES에 없음
* 500년대 "Jin Empire"가 여진 금나라(Manchuria 색상)로 잘못 매핑 — 실제로는 동진(東晉)
* 오호십육국, 유연, 돌궐, 야마토 등 미매핑 엔티티 다수

### 수정 (`generateBorderMetadata.py`)
* **ENTITY_RULES 추가** (7개):
  * `Jin` → 晉 (EastAsia), `Jin Empire` → 晉 (EastAsia 기본값으로 변경)
  * `Northern Liang` → 北涼, `Sixteen Kingdoms` → 五胡十六國
  * `Ruanruan` → 柔然 (Mongol), `Göktürks` → 突厥 (Mongol)
  * `Yamato` → 大和 (Japan)
* **YEAR_RANGE_OVERRIDES 추가** (Jin 시대별 분기):
  * `("Jin", 265, 316)` → 西晉 (서진)
  * `("Jin", 317, 420)` → 東晉 (동진)
  * `("Jin Empire", 265, 600)` → 東晉 (동진)
  * `("Jin Empire", 1115, 1234)` → 金 (금나라) + **palette: "Manchuria"**
* **palette override 기능 신규**: YEAR_RANGE_OVERRIDES에 `"palette"` 키 지원 → 시대별 색상 변경 가능
* **KOREAN_NAMES 추가**: 서진, 동진, 진나라, 금나라, 북량, 유연, 돌궐, 야마토
* **Jin Dynasty 충돌 해결**: "Jin Dynasty (Sima)"→진나라, "Jin Dynasty (Jurchen)"→금나라로 분리

## [2026-02-28] [cl] 자동 음역 엔진 + 한글화 100% 달성

### 배경
* 이전 세션에서 한글 라벨 2줄 표시(한국어 위 / 영어 아래) 구현했으나, 27,458개 엔티티 중 ~2,400개가 미번역 영어 상태
* 진형(jn)의 피드백: "공식 음역이 있으면 따르고, 없으면 음역 규칙에 맞춰서 전부 하자"

### 구현 (`generateBorderMetadata.py`)
* **_SUFFIX_MAP** (~80항목): 정치체(왕국/제국/칸국 등) + 사회(부족/민족) + 생계(수렵채집민/농경민/유목민) + 문화/문명
* **_PREFIX_MAP** (~15항목): 방향(서/동/북/남) + 지역(상/하/대/중앙)
* **_ADJECTIVE_MAP** (~130항목): 지리(호/강/산/타이가/반도) + 정치(부왕령/보호구역) + 언어학(핀우그르/팔레오/우랄) + 시대(신석기/청동기)
* **_PHONETIC_MAP** (~550항목): 북미 원주민(~100), 남미(~50), 호주 원주민(~30), 시베리아/중앙아시아(~30), 고대문명(~40), 유럽(~60), 아프리카(~50), 동남아(~30), HB 오타 대응(~20), 괄호 안 고유명사 보충(~20)
* **auto_korean_name()**: 패턴 기반 자동 한국어 번역 — 괄호/접미사/접두사/형용사/고유명사 분해 후 조합
* **_auto_transliterate()**: 규칙 기반 라틴→한글 자동 음역 엔진 (CV/V/C 매핑, qu→kw 변환, 이중자음 축약, 연속모음 제거)
* **_translate_paren()**: 괄호 안 복합 구문(North Borneo 등)도 _translate_phrase()로 위임하도록 개선
* **_translate_word()**: 아포스트로피/대괄호 선행 제거 처리 추가

### 결과
* **한글화 커버리지**: 206개 영어 단어 잔존 → **0개** (100.0%)
* 27,458개 전체 엔티티에서 3글자 이상 영어 단어 완전 제거
* "Finno-Ugric taiga hunter-gatherers" → "핀우그르 타이가 수렵채집민"
* "Anglo-Saxons" → "앵글로-색슨족"
* "French Guiana" → "프랑스령 기아나"

## [2026-02-28] [cl] 국가 3티어 라벨 차별화 시스템

### 배경
* 진형(jn): "지금 모든 나라가 똑같은 폰트/색깔이라 로마제국이나 수렵채집민이나 구분이 안 돼"
* 중요도에 따라 시각적 위계를 부여하여 중요 국가가 잘 보이도록 개선 필요

### 구현
* **Tier 분류** (`generateBorderMetadata.py`):
  - Tier 1 (제국/왕국): confidence=high + Empire/Kingdom/Dynasty/Sultanate/Caliphate/Shogunate/Khanate → 148개
  - Tier 2 (일반국가): confidence=high 나머지 → 381개
  - Tier 3 (부족/문화): confidence=low → 2,298개
* **한국 엔티티 강제 Tier 1**: `_TIER1_FORCE` 셋에 Korea 팔레트 계열 엔티티 추가 (고려/조선/신라/백제/고구려/발해/가야)
* **라벨 스타일** (`CesiumGlobe.tsx`):
  - Tier 1: bold 18px, 아웃라인 3, scaleByDistance(5e6→1.2, 2e7→0.6)
  - Tier 2: bold 14px (현행), 아웃라인 2
  - Tier 3: 12px (bold 없음), 투명도 0.55, scaleByDistance(5e6→0.7, 2e7→0)
* **가상/강제 엔티티 라벨에도 동일 적용**: `__virtual__` 식민지 + FORCED_ENTITIES

## [2026-02-28] [cl] HB 데이터 결함 수정 (NAME=null, 조선 누락, 원나라 기간)

### 발견된 문제
* 1435년 기준: 호주/북미에 색칠된 영역인데 라벨 없음 (NAME=null 피처 111개)
* 한국이 HB 1400 GeoJSON에 누락 — "Great Khanate"(원나라)가 한반도 포함
* Great Khanate가 1400년에도 "원나라"로 표시 (원나라는 1368년 멸망)

### 수정
* `CesiumGlobe.tsx`: `if (!name) continue;` — NAME=null 피처 렌더링 건너뜀
* `generateBorderMetadata.py` YEAR_RANGE_OVERRIDES:
  - Great Khanate (1206~1368) → 원나라
  - Great Khanate (1369~1500) → 명나라
* `generateBorderMetadata.py` FORCED_ENTITIES:
  - Korea (BC300~AD1897) — GeoJSON에 없을 때 강제 삽입 (수도: 서울 좌표)

## [2026-02-28] [cl] HB 데이터 검증 워크플로우 구축

### 배경
* 인접 스냅샷 비교 결과 심각한 데이터 갭 발견: 일본(800~1492 누락), 이집트(-700~1715 누락) 등
* 진형(jn): "함수로는 못 발견해. 제미나이한테 위키피디아 참고해서 검증시켜야 돼"

### 구현 (`extractEntityLifespans.py`)
* 161개 메타데이터 파일에서 2,827개 엔티티의 존속기간 추출
* 500년 단위 전체 프롬프트(10개) + 1000년 단위 Tier1+2 핵심 프롬프트(5개) 자동 생성
* Gemini 웹 UI에 복사-붙여넣기하여 위키피디아 기반 교차검증 가능
* 400년 이상 스냅샷 공백 자동 감지(⚠️ 표시)
* 출력: `scripts/geo/validation/` 폴더에 JSON + 마크다운 프롬프트

## [2026-02-28] [cl] 국가명 라벨 시스템: GeoJSON → entity_timeline 분리

### 배경
* HB GeoJSON은 43개 스냅샷(100~1000년 간격)만 존재하여 국가명 표시가 불가능한 연도 다수 (일본 AD800~1492 gap 등)
* Gemini 검증 결과 699개 엔티티 중 correct 20개뿐 — HB 데이터 신뢰도 심각
* 진형(jn) 방침: "국경선은 HB GeoJSON 유지, 국가명 라벨은 별도 데이터에서 1년 단위 정밀 표시"

### entity_timeline.json 시스템 구축
* **`scripts/geo/buildEntityTimeline.py`** 신규: Gemini 결과 + HB 존속기간 + 메타데이터 병합 빌드 스크립트
* **`public/geo/borders/entity_timeline.json`** 신규: 라벨 전용 독립 데이터 (2,864개 엔티티)
* **`CesiumGlobe.tsx`** 수정: `renderLabelsForYear()` 함수 추가, 라벨을 별도 CustomDataSource로 렌더링
  - 기존 loadBordersAsPolylines에서 라벨 코드 분리 (labeledNames, 가상 엔티티 루프 등 제거)
  - `EntityTimelineEntry` 인터페이스 + entityTimelineRef 캐싱
  - 연도 변경 시 라벨만 독립 업데이트 (국경선 스왑과 무관)

### 이후 진행된 반복 수정들 (문제 → 수정 → 새 문제 반복)

#### 1차: 중복 + 좌표 + 티어 수정
* 청나라 두 개 표시 (Manchu Empire + Qing Empire) → `DEDUP_REMOVE` 12개 추가
* 미국/캐나다/러시아 등 대국의 라벨이 수도 좌표에 표시 → `LABEL_COORDS_OVERRIDE` 30개 추가
* 하와이 왕국(Tier 1) > 미국(Tier 2) 크기 역전 → `TIER_OVERRIDES` 37개 추가

#### 2차: 식민지 라벨 시스템
* 진형 요청: "대일본제국" → "일본" (한국인 정서), "대영제국" → "영국"
* 식민지 렌더링: `[영국 식민지배]` italic 12px, 일제시대는 `[일제강점기]`
* `NAME_KO_OVERRIDES`, `COLONIAL_RULER_FIX`, `FORCED_ENTITIES` 도입

#### 3차: 식민지 렌더링 버그 연속
* 1차 버그: 식민지 국명이 완전히 사라지고 태그만 표시 → 국명+태그 합체로 수정
* 2차 버그: 일제강점기 라벨이 너무 작음 (일반 식민지와 동일 12px) → hasSpecialColonyLabel 분기 추가
* 3차 버그: 국명은 작고 태그만 큼 (CesiumJS가 span/mixed font 미지원) → 합체 텍스트 + Tier 통일 스타일

#### 4차: 누락 국가 188개 보강
* 뉴질랜드 등 주요국 누락 발견 → 원인: HB lifespan에 없는 엔티티는 빌드 자체가 안 됨
* 해결: buildEntityTimeline.py에 Step 4.5 "메타데이터 스캔" 단계 추가
* 161개 메타데이터 스냅샷 전수 스캔 → 188개 국가 자동 추가

#### 5차: 중복 라벨 문제 (근본적 결함 노출)
* 인도: British Raj + India 동시 표시, 호주: 식민지 7개 + 독립호주 겹침
* Italy/Italy/Sardinia, Romania/Rumania, Persia/Iran, Siam/Thailand 등 이름 중복
* 해결 시도: 3단계 dedup 시스템 도입
  1. DEDUP_REMOVE 확장 (호주 식민지 7개, India, Ceylon(Dutch) 등)
  2. 메타데이터 스캔 스마트화 (좌표 기반 start_year 조정)
  3. 좌표 기반 자동 중복제거 후처리 (2° 그리드, 50% 시간 겹침 기준)
* 결과: 1935년 겹침 0개 달성

#### 6차: 근본 문제 발견 — entity_timeline 아키텍처 자체의 한계
* **1925년 중국 = "청나라" + "중화민국" 동시 표시** → 청나라는 1912년 멸망인데?
  - 원인: metadata_scan이 "China"를 1886~2015 전체 기간 하나의 엔티티로 만들고,
    1886년 메타데이터의 name_ko("청나라")를 전 기간에 적용
* **1875년 호주 완전 누락** → DEDUP_REMOVE로 식민지 제거했는데 1875년엔 대체할 데이터가 없음
* **근본 원인**: entity_timeline.json은 엔티티 하나에 이름 하나 → 시대별 이름 변화 표현 불가
  - "China" = 1886년엔 청나라, 1912년엔 중화민국, 1950년엔 중국
  - "Japan" = 1897년엔 대일본제국, 1948년엔 일본
  - flat list 구조로는 이런 변천을 담을 수 없음

### ★ 아키텍처 재설계 결정 (진형 주도)

**진형의 진단:**
> "우리 데이터 방식 자체가 문제야. 기초 데이터가 엉망이니까 이리저리 땜빵하다가 문제가 된 거야.
> 아예 빈 데이터셋을 만들어서 테이블만 만들어놓고 연도별로 채워넣는 식으로 가야 돼.
> 스냅샷 방식도 버려야 하고."

**새 데이터 모델 방향:**
1. **지역(Region) 중심**: "이 지역을 어느 시기에 누가 지배했는가" (≠ 엔티티 중심)
2. **정확한 시대별 이름**: 그 당시 우리가 부르는 이름 (청나라/중화민국/중국 구분)
3. **빈 테이블 → 채워넣기**: 깨끗한 스키마에 검증된 데이터만 삽입
4. **핵심 난제**: 지역(Region) 자체가 시대별로 경계가 변함 — 고구려 영역 ≠ 조선 영역

**세력 분류 기준:**
* 정치적 실체가 있었는가 (수장/왕/정부 체계)
* 영토를 실효 지배했는가
* 일반인이 세계사에서 한번쯤 들어봤을 수준인가
* Wikidata 등재 여부를 1차 필터로 활용

### Wikidata 기초 데이터 수집

* Wikidata SPARQL로 전체 historical country(Q3024240) + country(Q6256) 조회
* **결과: 3,985개** (historical 3,770 + modern 215)
  - 시작일 있음: 2,967개 (74%)
  - 종료일 있음: 2,830개 (71%)
  - 한국어명 있음: 1,602개 (40%)
  - 좌표 있음: 1,580개 (39%)
* **`public/geo/borders/wikidata_entities_raw.json`**에 전체 저장 (시작일순 정렬)
* 고조선(BC 2332), 탐라(BC 2336), 우가리트(BC 6000)부터 현대 국가까지 포함
* ethnic group(10,516개)은 별도 — 정치적 실체 있는 것만 추후 선별 필요

### 현재 상태 및 다음 단계
* entity_timeline.json 기반 시스템은 **한계가 확인됨** — 구조적 재설계 필요
* Wikidata 3,985개 엔티티 raw 데이터 수집 완료 — 진형(jn)이 검토 후 방향 결정 예정
* **기존 코드(buildEntityTimeline.py, CesiumGlobe.tsx 라벨 렌더링)는 당분간 유지** — 새 시스템 구축 후 교체

---

