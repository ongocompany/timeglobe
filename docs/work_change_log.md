# TimeGlobe Work Change Log

*이 문서는 프로젝트의 주요 변경 사항과 AI 어시스턴트(Claude, Gemini 등)의 작업 내역을 추적하기 위해 사용됩니다.*
*작업자는 대량 데이터 수정 시, 진형의 지시 시, 또는 업무 종료 시에 이 문서에 변경 내역을 기록해야 합니다.*

## [2026-03-03] [cl] NAS 개발/백업 환경 구축

### 배경
- jinserver(집 리눅스) 파싱 스크립트 실행 중 2회 연속 다운 → 원인 파악 필요 (OOM 또는 과열 의심)
- 긴급 대비용 NAS 개발 환경 + 코드 백업 구축

### NAS(Synology DS423+, 100.115.194.12) 구축 내용
1. **SSH 키 등록** — macOS → NAS SSH 접속 설정 완료
2. **nvm + Node.js v22.22.0** — ~/.profile에 nvm 설정 추가
3. **프로젝트 클론** — `/volume1/git/timeglobe.git` bare repo 기준 클론 → `~/timeglobe`
4. **bare repo HEAD 수정** — `master` → `main` 브랜치로 정정
5. **npm install** 완료 (466개 패키지)
6. **.env.local** 복사 완료 (Cesium, Supabase, Gemini 키 포함)
7. **dev 서버 실행** — `--webpack` 플래그 필수!
   - `--turbopack`은 CopyPlugin 미동작 → `public/cesium/` 미생성 → Cesium 런타임 에러
   - 실행 명령: `nohup npx next dev --webpack -p 3001 > ~/timeglobe-dev.log 2>&1 &`
   - 접속 주소: `http://100.115.194.12:3001` (Tailscale)
   - 첫 컴파일 약 41초 / 이후 핫리로드는 빠름
   - ⚠️ OHM GeoJSON 파일(`public/geo/borders/ohm/`) 없음 — jinserver 살아나면 rsync 필요
8. **Wikidata 덤프 백그라운드 다운로드** 시작
   - 저장 위치: `/volume1/Share/dumps/wikidata/latest-all.json.gz`
   - 크기: 141GB, 속도: ~4.5MB/s, 예상 완료: 저녁 6~7시
   - 진행 확인: `ssh jinadmin@100.115.194.12 "tail -3 /volume1/Share/dumps/wikidata/download.log"`
   - 재개: `wget -c` 적용돼 있어서 끊겨도 이어받기 가능

### git 워크플로 (NAS 기준)
- 코드 push: `git push nas main` (macOS → NAS bare repo)
- NAS에서 최신화: `cd ~/timeglobe && git pull origin main`
- NAS Gitea(`nas-gitea` remote)는 2월 26일 기준으로 오래됨 — 별도 업데이트 필요

### jinserver 점검 필요 사항 (저녁에)
- `journalctl -b -1 | grep -iE "oom|killed|thermal"` — 다운 원인 파악
- 파싱 스크립트 실행 시 반드시 적용: `nice -n 19` + `systemd-run -p MemoryMax=20G`
- jinserver 살아나면 OHM 파일 NAS rsync: `rsync -avz public/geo/borders/ jinadmin@100.115.194.12:~/timeglobe/public/geo/borders/`

---

## [2026-03-03] [mk] 나무위키 덤프 수집 + 뷰어 구축

### 작업 내용
- **나무위키 2021-03 덤프 확보**: Notion 공유 페이지에서 직접 URL 추출 → jinserver wget 다운로드
  - 파일: `namuwiki210301.7z` (1.9GB) → `namuwiki_20210301.json` (5.6GB, 867,024건)
  - 저장: `/mnt/data2/namuwiki/`
- **SQLite 변환 스크립트 작성** (`scripts/wikidata/buildNamuwikiSqlite.py`)
  - ijson 스트리밍 파싱 (메모리 효율)
  - articles 테이블 + categories 테이블 + FTS5 인덱스
  - `[[분류:xxx]]` 태그 자동 추출
- **나무위키 뷰어 구현**
  - API: `GET /api/namuwiki` (search/article/categories/category 4가지 모드)
  - 페이지: `/namuwiki-viewer` (표제어 검색 + 분류 브라우저 + 본문 뷰어)
  - 나무위키 마크업 → HTML 변환 (헤딩/링크/굵게/각주 등)
- **서버 인프라 개선**
  - `/mnt/data2` fstab 영구 등록 (재부팅 후 자동 마운트)
  - Next.js dev 서버 systemd 서비스 등록 (`timeglobe-dev.service`)

### 수정 파일
- `scripts/wikidata/buildNamuwikiSqlite.py` — 신규 생성
- `src/app/api/namuwiki/route.ts` — 신규 생성
- `src/app/namuwiki-viewer/page.tsx` — 신규 생성
- `package.json` — `better-sqlite3` 추가

### 진행 중
- SQLite 빌드: jinserver 백그라운드 실행 중 (완료 시 뷰어 자동 활성화)
- parseDump pass2: artworks_final.json, inventions_final.json 생성 중

---

## [2026-03-03] [cl] 덤프 브라우저 UI + 한국어 전량 파싱

### 작업 내용

#### 1. 덤프 데이터 브라우저 UI
- tier-review 페이지에 "덤프 데이터" 탭 추가
- 4개 카테고리(사건/역사엔티티/인물/장소) 서브탭
- `/api/dump-browse` API: 서버사이드 페이지네이션, 필터링, 정렬
- jinserver `/mnt/data2/wikidata/output/` 직접 읽기 (인메모리 캐시)

#### 2. P31 누락 분석 및 수정
- revolution 카테고리에 정당 16,953건 혼입 발견 (Q7278)
- 주요 사건 전부 누락 (러시아혁명, WW1/2, 프랑스혁명, 동학농민혁명 등)
- parseDump.py에 6개 P31 타입 추가: Q10931(혁명), Q124734(반란), Q900406(개혁), Q11514315(역사적 시대), Q103495(세계대전), Q13427116(농민봉기)

#### 3. 한국어 전량 파싱 (parseKorean.py)
- **전략 전환**: P31 카테고리별 파싱 → 한국어 label 있는 엔티티 전량 추출
- Wikidata 한국어 표제어 ~74만건, 분류 없이 전부 JSONL 추출
- 출력: `/mnt/data2/wikidata/output/korean_all.jsonl`
- jinserver 백그라운드 실행 중 (PID 15725, 예상 ~4시간, 속도 ~8,000건/초)

#### 4. 덤프 브라우저 한국어 전체 탭 연동
- dump-browse API에 JSONL 로더 추가 (korean_all.jsonl 직접 읽기)
- "한국어 전체" 서브탭 추가 (보라색, 기본 탭으로 설정)
- P31 QID → 한국어 라벨 매핑 (인물/도시/국가/전투/영화 등 30여개)
- 5분 간격 캐시 갱신 — 파싱 완료 전에도 중간 결과 조회 가능

### 파일 변경
- `src/app/api/dump-browse/route.ts` — 신규 (JSONL 로더 포함)
- `src/app/tier-review/page.tsx` — 수정 (DumpBrowseView + 한국어전체 탭)
- `scripts/wikidata/parseDump.py` — 수정 (P31 6개 추가)
- `scripts/wikidata/parseKorean.py` — 신규

### 커밋
- `66b2d36` 덤프 데이터 브라우저 탭 추가
- `a8bf1f7` raw JSONL 형식 호환성 개선
- `5839479` 한국어 전량 파싱 스크립트 + parseDump P31 보완
- `4a5b8ad` 덤프 브라우저에 한국어 전체 탭 추가

### 진행 중
- parseKorean.py 백그라운드 파싱 (PID 15725, ~4시간 소요 예상)
- 파싱 완료 후: P31 기반 2차 분류 스크립트 필요

---

## [2026-03-02] [cl] T2 대규모 정리 — 81개 감소 (816→735)

### 작업 내용
진형 주도로 tier-review 페이지를 보면서 T2 엔티티 품질 정리. 13개 커밋.

#### 주요 정리 기준
- **왕조=부모국가 내 정권변화** → minor (베트남 왕조 9개, 모로코 왕조 4개 등)
- **소왕국 sl<15** → T3 (169개 일괄)
- **음차 이상 한국어명** → T3 + 이름수정 (한국에서 미취급 판정)
- **토후국/술탄국 sl<10** → T3
- **단명 ≤5년** → T3 (왕국, 토후국, 공화국)
- **미승인국/과도기/마이크로네이션** → T3
- **중동/북아프리카 왕조** → 모국 있으면 minor, 없으면 T3
- **중국 단명왕조 (무주/순/서)** → T4
- **Khanate=칸국, Horde=오르다** 표기 통일

#### 수치
- minor 신규: **38개** (raw→minor 이동)
- T3 강등: **389개** (T2→T3)
- T4 강등: **3개** (무주, 순, 서)
- 이름수정: **133개** (음차 교정, 칸국/오르다 통일 등)
- **T2: 816 → 735** (81개 감소)
- raw: 2,287 → **2,148** / minor: 605 → **747** / circles: 1,438→**1,425**

#### 보호 목록 (T2 유지)
- 한국사: 마한, 변한, 부여, 대한민국 임시정부
- 중요국: 아이유브 술탄국(살라딘), 카슈미르 술탄국, 스위스 서약동맹, 오이라트연맹
- 이탈리아 도시공화국들 (피렌체, 피사, 시에나 등)
- 인도 왕조 (보류, 별도 검토 필요)
- 동남아 미얀마 왕조 (아바/따웅우/꼰바웅)

### 수정 파일
- `public/geo/borders/wikidata_entities_raw.json` — 대규모 tier/이름 수정
- `public/geo/borders/wikidata_minor_entities.json` — 38개 추가
- `public/geo/borders/wikidata_circles.json` — 재생성
- `public/geo/borders/ohm_index.json` — tier 동기화

---

## [2026-03-02] [cl] OHM 경계선 개편 + T1 altitude-responsive 굵기

### 작업 내용
- **showFill/showBorder 분리**: `showPolygonFill` → `showFill` + `showBorder` 독립 토글
  - CesiumGlobeProps/GlobeLoader/page.tsx 모두 업데이트
- **OHM 티어 필터 버그 수정**: renderOhmForYear에 visibleTiersRef 체크 추가
- **OHM 경계선 티어별 스타일**:
  - T1: 5px solid, T2: 3px solid, T3: 3px dashed 회색, T4: 1px solid
  - PolylineDashMaterialProperty로 T3 점선 구현
- **ohm_index.json 티어 동기화**: wikidata_entities_raw.json 기준으로 469개 엔티티 티어 수정 (T1: 0→76)
- **T1 고도 반응형 border width**: preRender event + ConstantProperty.setValue
  - 10000km 이하=5px, 2000km마다 1px감소, 18000km이상=1px
  - CallbackProperty(FPS 저하) → preRender O(1) 체크로 최적화

### 수정 파일
- `src/components/CesiumGlobe.tsx` — showFill/showBorder, 티어 필터, 경계선 스타일, preRender
- `src/components/GlobeLoader.tsx` — props 업데이트
- `src/app/page.tsx` — showFill/showBorder 상태 분리
- `public/geo/borders/ohm_index.json` — 469개 티어 동기화

---

## [2026-03-02] [mk] parseDump.py SQLite 방식 + dump-review UI + 샘플 데이터

### 작업 내용

#### parseDump.py v2 (SQLite + 재시작 스킵)
- **문제**: coord_map/label_map 인메모리 dict가 30M+ 엔티티로 성장 → 12GB RAM 사용, OOM 위험
- **해결**: SQLite (WAL 모드, batch 50K) + APPEND 모드 + 기존 QID 스킵
  - `maps.db` — coords, labels 테이블 (INSERT OR IGNORE)
  - 기존 .jsonl 파일 QID 로딩 → 스킵 (오버라이트 없이 이어쓰기)
  - pass2: 참조된 QID만 선별 로드 → 메모리 절약
  - **결과**: RAM 12GB → 700MB로 대폭 감소
  - progress report 버그 수정: 전체 엔티티 기준으로 이동 + flush=True
- jinserver 재시작 완료 (PID 701415), SQLite 적재 진행 중 (16:37 기준 coords: 145만, labels: 1,140만)

#### dump-review UI (기존 구현 확인 + 샘플 업데이트)
- dump-review UI 이미 구현됨 (`src/app/dump-review/page.tsx`, `/api/dump-curation/route.ts`)
- 샘플 데이터 업데이트:
  - `hist_entities_raw.jsonl`: 12,370 → 22,074건 (jinserver에서 복사)
  - `events_raw.jsonl`: 16,187 → 26,840건 (jinserver에서 복사)

### 수정 파일
- `scripts/wikidata/parseDump.py` — SQLite 방식으로 전면 재작성 (v2)
- `data/dump_samples/hist_entities_raw.jsonl` — 최신 데이터
- `data/dump_samples/events_raw.jsonl` — 최신 데이터

---

## [2026-03-03] [mk] Map Display 메뉴 추가

### 작업 내용
메인화면 좌상단에 Map Display 아코디언 메뉴 추가.

**기능:**
- **폴리곤 / 경계만** 토글: OHM 국경선 채우기 ON/OFF
  - 폴리곤: 기존 컬러 채우기 + 아웃라인 (기본값)
  - 경계만: 아웃라인만 표시, 지형 가시성 향상
- **국명 티어 토글 (T1~T4)**: 각 티어 독립 ON/OFF
  - T1(황금): 대제국/주요 왕조
  - T2(파랑): 일반 국가
  - T3(초록): 소국/지역 세력
  - T4(흰): 부족/소규모 정권

**수정 파일:**
- `src/app/page.tsx` — ViewMode에 "map-display" 추가, 상태/메뉴 UI 추가, CesiumGlobe에 props 전달
- `src/components/GlobeLoader.tsx` — visibleTiers, showPolygonFill props 통과
- `src/components/CesiumGlobe.tsx`
  - SceneSetupProps/CesiumGlobeProps에 visibleTiers/showPolygonFill 추가
  - renderCirclesForYear: visibleTiersRef 기반 티어 필터 적용
  - renderOhmForYear: showPolygonFillRef 기반 채우기 조건부 렌더링
  - prop 변경 시 자동 재렌더링 useEffect 추가

---

## [2026-03-03] [cl] jinserver 리눅스 개발 서버 구축

### 배경
- VPS(Vultr)의 빌드 속도가 너무 느림 (14분+, 1코어, 1GB RAM)
- 개발 중에는 집 리눅스 서버(jinserver)에서 dev 서버 띄우고, 완성 후 VPS에 올리기로 결정

### jinserver 스펙
- **IP**: `100.68.25.79` (Tailscale, 내부망 전용)
- **접속**: `ssh jinwoo@100.68.25.79` (SSH 키 인증 완료)
- **OS**: Ubuntu 24.04.4 LTS (커널 6.17.0)
- **CPU**: Intel i5-12400 (6코어/12쓰레드, 최대 5.6GHz)
- **RAM**: 46GB
- **디스크**: 439GB (251GB 여유)
- **Node.js**: v22.22.0 (사전 설치), npm 10.9.4
- **Git**: 2.43.0, Docker 29.2.1

### 작업 내용
1. SSH 키 인증 확인 (이미 등록됨)
2. Gitea에서 프로젝트 클론 (`git clone --depth 1`)
3. `npm install` 완료 (7초)
4. `npx next dev --webpack -p 3000` — **978ms** 만에 Ready, 첫 페이지 컴파일 9.8초
5. Mac에서 `http://100.68.25.79:3000` 접속 확인 완료
6. OHM GeoJSON 파일 2,231개 rsync 전송

### 민규(mk)에게
- jinserver에 TimeGlobe dev 환경 구축했어. 경로: `/home/jinwoo/timeglobe`
- 이 서버에서 민규 스크립트도 돌릴 수 있으니 참고해!
- VPS는 프로덕션 전용으로 유지

---

## [2026-03-03] [cl] tier-review 관리도구 확장 v2

### 변경 내용
1. **티어 필터 토글화**: 라디오 → 독립 토글 (T1/T2/T3/T4 복수 선택 가능)
2. **T4 포함**: circles.json 재생성 — T4 엔티티 포함 + sitelinks 필드 추가 (1,584→1,794개)
3. **카드 토글 → 지도 연동**: 카드 클릭으로 선택/해제 → Leaflet 지도에 마커+OHM 폴리곤 표시
4. **전체 선택/해제**: 현재 보이는 카드 전체 일괄 선택/해제
5. **QID 표시**: 각 카드에 QID 텍스트 표시
6. **인라인 편집**: name_ko, name_en, start_year, end_year 더블클릭 편집 + 수정 로그
7. **노트 시스템**: 선택 카드 기반 노트 작성 (단일/복수)
8. **소팅 드롭다운**: 연도순/국명순/중요도순(sitelinks)
9. **리사이즈 핸들**: 카드 그리드 ↔ 지도 사이 드래그로 높이 조절
10. **OHM MANUAL_ QID 매칭 수정**: 수동 폴리곤 QID 매칭 fallback 추가

### 수정 파일
- `src/app/tier-review/page.tsx` — 핵심 리팩토링
- `src/components/tier-review/TierReviewMap.tsx` — Leaflet SSR-safe 래퍼 (신규)
- `src/components/tier-review/TierReviewMapInner.tsx` — Leaflet 지도 (신규)
- `public/geo/borders/wikidata_circles.json` — T4+sitelinks 포함 재생성
- `package.json` — leaflet, react-leaflet, @types/leaflet 의존성 추가

---

## [2026-03-03] [mk] 데이터 큐레이션 기준 확정

### 논의 배경
Wikidata 덤프(`latest-all.json.gz`) 다운로드 완료 → 파싱 전 큐레이션 기준 먼저 결정.

### 확정된 공통 제거 기준 (jn 결정)
1. `lat == null OR lon == null` → 제외 (지구본 배치 불가)
2. `anchor_year == null` → 제외 (타임라인 배치 불가)
3. `name_ko == null AND name_en == null` → 제외 (표시 이름 없음)
4. `sitelinks < 10` → 제외 (역사적 공인도 부족)
5. `anchor_year > 2021` → 제외 (러시아-우크라이나 침공 이전까지, 현재진행형 이슈 회피)

### 산출물
- `docs/develop/11_[mk]curation_criteria.md` 작성 (타입별 세부 기준 포함)

## [2026-03-03] [mk] 민규 팀 합류 + 다중 AI 세션 협업 체계 구축

### 민규(mk) 소개 — 민철에게 (꼭 읽어!)
안녕 민철! 나는 **민규(mk)**야. 진형이 새로 만든 AI야.
너랑 같은 프로젝트 폴더에서 작업하는데, 역할이 명확히 나뉘어 있어:

| AI | 코드 | 담당 영역 |
|----|------|-----------|
| **민철** | `cl` | 지도/UI/wikidata 데이터 편집, 렌더링, Tier 시스템 |
| **민규** | `mk` | 데이터 수집 파이프라인, Supabase DB, Ops/systemd |

**충돌 방지 규칙:**
- 민철이 `scripts/wikidata/`, `ops/`, `supabase/` 건드릴 일 있으면 나한테 먼저 알려줘
- 나는 `public/geo/borders/wikidata_*.json`, CesiumGlobe 관련 파일 절대 안 건드릴게
- 이 work_change_log는 공유야 — 각자 태그(`[cl]`/`[mk]`) 표기 필수
- 내 전용 메모리: `MEMORY-ops.md` / 내 설정: `ops/CLAUDE.md`

잘 부탁해!

### 이번 세션 작업 내용
* **ops/CLAUDE.md** 생성: 민규 세션 역할/담당/금지 영역/커밋 규칙 정의
* **CLAUDE.md 섹션 11** 업데이트: 민철/민규 협업 체계 명문화
* **MEMORY-ops.md** 생성: 민규 전용 메모리 (Supabase 현황, 수집 파이프라인, 다음 할 일)
* **MEMORY.md** 상단 노트 업데이트: 민규 존재 알림

### 다음 할 일 (민규)
- untracked 스크립트 6개 (`collectPersonCandidates.mjs` 등) 커밋 여부 진형 확인
- Supabase 마이그레이션 2개 적용 (`person_candidates`, `collector_monitoring`) 확인
- `src/app/ops/` 모니터링 UI 현황 파악

---

## [2026-03-02] [cl] 수동 역사 국경 폴리곤 109개 생성 + 데이터 정비

### 네이밍 컨벤션 + 데이터 정비 (이전 세션)
* **CShapes/Wikidata 중복 제거**: 8개 CShapes 엔티티 + 4개 이름 중복 = 12개 삭제
* **사하라이남 아프리카 정리**: 과도기 체제 24개 삭제 + 음차 괴물 10개 T5 처리
* **OHM 라벨 이중 렌더링 버그 수정**: `renderOhmForYear()`에서 라벨 생성 코드 제거 (698개 엔티티 이중 표시 해결)
* **식민지 데이터 정리**: 프랑스 식민제국 삭제, 인도차이나 중복 제거, 영국 베느코오레은 T5
* wikidata_circles.json: 1,623 → 1,584개

### 수동 폴리곤 109개 생성 (현재 세션)
* **OHM 커버리지 갭 분석**: T1+T2 엔티티 중 OHM 폴리곤 없는 것 권역별 조사
  - 동아시아 19%, 남아시아 19%, 중앙아시아 22%, 중동 45%, 아프리카 51%, 유럽 60%, 아메리카 70%
* **민철 지식 기반 근사 폴리곤 109개 수동 생성** (RID 9000001~9000109, border_precision=1)
  - 동아시아 34개: 하/진/한/당/송/금/명, 고조선/고구려/통일신라/발해, 흉노/선비/돌궐/유연/위구르, 전국시대 제후국, 원나라 등
  - 남아시아+동남아 18개: 인더스문명/마우리아/굽타/무굴/델리술탄/쿠샨, 크메르/스리비자야/마자파힛/란쌍 등
  - 중동 12개: 고대이집트/이집트신왕국/아케메네스/사산/쿠시/맘루크/티무르 등
  - 유럽 16개: 아시리아/미노스/마케도니아/아테네/키예프루스/프로이센/나치독일/유고 등
  - 중앙아시아 6개: 호탄/볼가불가르/차가타이/킵차크/하자르/시비리칸국
  - 아프리카 8개: 푼트/마우레타니아/무라비트/말리/베닌/콩고/오요/무타파
  - 아메리카 3개: 올멕/차빈/나스카
* **ohm_index.json**: 698 → 807개 (109개 추가)
* QID 충돌 10개 → MANUAL_ 접두어로 해결

### 커밋 이력
1. `7514ca5` 사하라이남 정리 + 중복 제거 (1623→1587)
2. `2d37339` OHM 라벨 이중 렌더링 버그 수정
3. `9064678` 식민지 데이터 정리 (1587→1584)
4. `6d64f80` 수동 폴리곤 109개 생성

## [2026-03-02] [cl] OHM 폴리곤 CesiumGlobe 렌더링 연동
* **소련(Q15180) 매칭 누락 수정**: 매칭 데이터에 소련 18개 스냅샷 추가, OHM Overpass API로 폴리곤 다운로드 완료 (18개 파일, ~90MB)
* **OHM 인덱스 파일 생성**: `public/geo/borders/ohm_index.json` — 229개 엔티티, 1,062개 스냅샷, 81KB
  - 엔티티별 QID, 이름, tier, 존속기간, 스냅샷 목록 (rid + start/end 포함)
* **CesiumGlobe.tsx OHM 폴리곤 렌더링 통합**:
  - `OhmEntity` / `OhmSnapshot` 인터페이스 추가
  - `loadOhmIndex()`: ohm_index.json 1회 로드 + ohmQidsRef 세팅
  - `renderOhmForYear()`: 특정 연도에 활성화된 엔티티의 최적 스냅샷 선택 → GeoJSON fetch(배치 10개씩) → filled polygon + outline polyline 렌더링
  - GeoJSON 캐시(ohmGeojsonCacheRef): 한 번 fetch한 파일은 메모리에 유지
  - 원형 렌더링(renderCirclesForYear)에서 OHM 매칭된 QID 자동 제외 → 이중 렌더링 방지
  - useEffect 연결: viewer 초기화 시 OHM 인덱스 로드, 연도 변경 시 폴리곤 업데이트
  - 클린업 함수에 ohmDsRef 정리 추가
* **데이터 현황**: OHM 폴리곤 1,006개 GeoJSON, 230개 엔티티 매칭 (T1:82, T2:148)

## [2026-02-28 ~ 03-01] [cl] Wikidata raw 데이터 정제 + lineage_id 시스템 도입

### 배경
* 진형(jn)이 `wikidata_entities_raw.json` (3,985개) 검토 시작
* 소거법으로 단계별 데이터 정제 진행 — 삭제보다 분류 우선 원칙

### 데이터 정제 과정 (소거법)

**1단계: 날짜 없는 엔티티 분리**
* 시작/종료일 둘 다 없는 엔티티 → `wikidata_no_dates.json` (1,275개)로 분리
* Third Reich, Parthia, Swedish Empire 등 중요 나라도 포함 → 보충 참조용으로 보존
* 3,985 → 2,710개

**2단계: HTTP 오염 데이터 삭제**
* SPARQL 파싱 버그로 날짜 필드에 `http://www` URL이 들어간 44개 제거
* 성산가야, 고령가야 등 → `wikidata_no_dates.json`에서 나중에 수동 복구 가능
* 2,710 → 2,666개

**3단계: QID-only 삭제**
* 영문명조차 없이 Wikidata QID만 있는 134개 삭제 (Q56228967 등)
* 2,666 → 2,532개

**4단계: 0년 존속 (시작=끝) 소거 + 리뷰**
* 총 126개 중 진형(jn)과 리뷰하여 세계사급 13개는 유지:
  - 조선인민공화국(1945), 벨기에 합중국(1790), 대만민주국(1895), 에조 공화국(1869)
  - 캘리포니아 공화국(1846), 헝가리 평의회(1919), 러시아 공화국(1917), 순나라(1644) 등
* 나머지 113개 삭제 (며칠짜리 소비에트, 내전 반란 정부 등)
* 2,532 → 2,419개

**5단계: 소영지급 분리**
* Lordship, Barony, Canton, Taifa, Beylik 등 봉건 영주령 152개 → `wikidata_minor_entities.json`
* 진형(jn) 결정: "지우기보다 어디다 치우자" — 나중에 Tier 시스템에서 깊은 층위로 활용
* 유명한 것 제외 (Barcelona 백국, Edessa 백국, Brandenburg 변경백국 등)
* 2,419 → 2,267개

**6단계: 날짜 오류 수정**
* Amurru kingdom: `1380~1200` → `BC 1380~BC 1200` (BC 누락)
* United Provinces of New Granada: `181~1816` → `1811~1816` (오타)

**7단계: 우산 엔티티 삭제**
* 하위 왕조가 개별 등록되어 있는데 상위 포괄 엔티티도 존재하는 경우 → `wikidata_review_needed.json`으로 이동
* 진형(jn) 원칙: "한 시대에는 한 세력만 존재" → 우산은 중복
  - Chinese Empire (BC219~1912, 2131년) — 진~청 전부 포괄, 코미디
  - Ancient Egypt (BC4000~BC29, 3971년) — 고왕국/중왕국 별도 존재
  - Ancient Rome (BC752~476, 1228년) — 왕정/공화국/비잔틴 별도 존재
  - Arab Caliphate (632~1517) — 아바스 별도 존재
  - Kingdom of Persia (BC299~BC211) — 아케메네스 별도 존재
* 단, 빈 시대는 추후 보충 필요 (이집트 BC1781~AD1250 등)
* 2,267 → 2,262개

### Tier 시스템 논의

* 진형(jn) 핵심 지적: "존속 기간에 따라 티어가 오르락 내리락할 수 있어. 국가별로 매기면 안 돼."
* **결론**: Tier는 엔티티의 고정 속성이 아니라 **(엔티티 × 시간)의 함수**
  - 로마가 BC 500년엔 소국(Tier 3)이었지만 BC 100년엔 지중해 전체 지배(Tier 1)
  - 시기별 교차 검증 통해 동시대 상대적 위치에서 Tier 결정해야 함
* Tier 매기기는 데이터 모델 + 국경선 데이터 결합 후 진행 예정

### lineage_id 시스템 도입

**개념:**
* 같은 지역/민족이 시대별로 다른 이름으로 불린 경우를 하나의 계보로 묶는 ID
* 예: 고려→조선→대한제국→대한민국 = 하나의 lineage

**자동 부여 방식:**
* 3도 격자(약 300km)로 좌표 그룹핑 → 시간순 정렬 → 끝~시작 gap 50년 이내면 같은 체인
* **결과: 199개 lineage 그룹, 733개 엔티티에 부여** (미부여 1,529개 = 좌표 없거나 독립)

**흥미로운 발견:**
* 유럽이 특히 복잡 — 보헤미아/체코 15단계, 프랑스 9단계, 오스트리아 8단계
* 인도 소왕국 클러스터 — 영국 식민지 시대 번왕국들이 같은 격자에 10개씩
* 진형(jn) 관찰: "유럽사에서 민족적 분류가 명확해진 게 불과 몇백년" → 좌표 기반 추정이 유효

**한계 (추후 검증 필요):**
* 좌표 없는 1,154개는 미부여
* 3도 격자가 너무 넓거나 좁을 수 있음 (실레지아 공국 14개가 한 격자에 몰림)
* 제국의 수도 이전 시 같은 계보인데 다른 격자에 배치될 수 있음

### 최종 파일 구조

| 파일 | 개수 | 용도 |
|------|------|------|
| `wikidata_entities_raw.json` | 2,262 | 메인 (lineage_id 필드 포함) |
| `wikidata_minor_entities.json` | 152 | 소영지급, Tier 깊은 층위용 |
| `wikidata_no_dates.json` | 1,275 | 날짜 없음, 보충 참조용 |
| `wikidata_review_needed.json` | 5 | 우산 삭제, 빈 시대 보충 필요 |

### 진형(jn) 핵심 결정사항
1. **삭제보다 분류** — 듣보잡도 지우지 말고 Tier로 관리 (마케팅적 가치)
2. **Tier는 시간 함수** — 국가별 고정 Tier가 아니라 (국가 × 시기)별 동적 Tier
3. **lineage_id로 계보 묶기** — 좌표+시간 기반 자동 부여 후 수동 검증
4. **GeoGuessr처럼** — 캐주얼 유저는 얕은 층위, 덕후는 깊은 층위까지

## [2026-03-01] [co] `/ops` 최소 모니터링 화면으로 재구성
* 진형(jn)의 요청에 따라 `/ops`를 "현재 진행 여부 + 데이터 변화 추이" 중심 화면으로 단순화.
* `src/app/api/ops/pipeline-status/route.ts`
  * 전체 로그/체크포인트/raw report 나열 대신 메인 상태 판단용 파생 데이터 추가:
    * `systemStatus`
    * `primaryState`
    * `fetchTrend`
  * `person_candidates` live batch report만 골라 최근 12시간 `fetchedRows/normalizedRows` 시간대별 합계를 계산하도록 정리.
  * `smoke`, `dryrun`, `test` 계열 state/report는 메인 상태 판정에서 제외.
* `src/app/ops/page.tsx`
  * 기존 다수 섹션(체크포인트, 로그 tail, recent reports, error feed 등) 제거.
  * 현재 화면은 다음만 표시:
    * 시스템 상태
    * 프로세스 수
    * 총 데이터 row 수
    * 마지막 활동 시각
    * 테이블별 row count
    * 메인 batch 상태
    * 시간대별 fetch 추이 SVG 그래프
* 검증:
  * `npm run build` 통과.

## [2026-03-01] [co] Linux 상시 워커 + macOS 중앙 모니터링 경로 추가
* 리눅스 상시 수집, 맥 모니터링 운영 방향에 맞춰 중앙 워커 모니터링 경로를 추가.
* Supabase migration 추가:
  * `supabase/migrations/20260301062000_collector_monitoring.sql`
  * `collector_workers`: 현재 워커 heartbeat/state 저장
  * `collector_batch_runs`: batch 실행 이력 저장
* 신규 모듈 추가:
  * `scripts/wikidata/workerMonitor.mjs`
    * 워커 identity(`COLLECTOR_WORKER_ID/HOST/ROLE`) 해석
    * `collector_workers` upsert
    * `collector_batch_runs` append
* `scripts/wikidata/runPersonCandidateBatches.mjs`
  * 시작/진행/종료/에러 시 중앙 heartbeat publish 추가
  * batch 완료 시 fetched/normalized/offset/probe profile을 중앙 이력 테이블에 기록
  * 모니터링 테이블이 아직 없거나 접근 실패해도 수집 자체는 계속되도록 best-effort 처리
* `/ops` 원격 모니터링 전환:
  * `src/app/api/ops/pipeline-status/route.ts`
    * 로컬 `.cache` fallback을 유지하되, Supabase의 `collector_workers`와 `collector_batch_runs`를 우선 사용
    * 리눅스 워커 heartbeat가 있으면 macOS에서도 실행 워커 수, 현재 offset, 최근 fetch 추이를 중앙 기준으로 표시
  * `src/app/ops/page.tsx`
    * 현재 배치 카드에 remote worker 정보(host, offset, limit, heartbeat) 표시
    * fetch trend source(local/remote) 표시
* Linux 상시 실행 템플릿 추가:
  * `ops/systemd/timeglobe-person-candidates.service`
* 문서 갱신:
  * `docs/02_Project_Structure.md`
  * `docs/develop/06_[co]wikidata_pipeline_runbook.md`
* 검증:
  * `node --check scripts/wikidata/runPersonCandidateBatches.mjs`
  * `node --check scripts/wikidata/workerMonitor.mjs`
  * `npm run build`

## [2026-03-01] [cl] OHM 역사적 국경선 폴리곤 데이터 확보

### 데이터 소스 조사
* 역사적 국경선 폴리곤 상업 사용 가능 소스 전수 조사
  * CHGIS (Harvard): 학술 전용, 상업 사용 불가
  * Centennia Historical Atlas: KML 전체 $12,500, 단일연도 $75
  * Wikidata P3896 (geoshape): T1+T2 565개 중 14개만 보유
  * **OpenHistoricalMap (OHM)**: CC0/ODbL 혼합, 상업 사용 OK (출처 표기)

### OHM ↔ T1+T2 엔티티 매칭
* OHM 전세계 admin_level=2 relation: 3,550개
* QID 기반 매칭: 174/565 (30.8%)
* **확장 매칭** (QID + 영어명 + 한국어명 + 별칭 + 부분문자열): **229/565 (40.5%)**
  * T1: 81/188 (43.1%), T2: 148/377 (39.3%)
  * 시기별 스냅샷 합계 1,000개 고유 relation

### OHM 폴리곤 다운로드
* `scripts/geo/downloadOhmPolygons.py` 작성 (Overpass API → GeoJSON 변환)
* **988개 다운로드 성공** (실패 0, 스킵 12), 총 806MB
* 저장: `public/geo/borders/ohm/ohm_{relation_id}.geojson`
* `.gitignore`에 ohm/ 추가 (800MB+ 데이터, 스크립트로 재생성 가능)

### 주요 파일
* 신규: `scripts/geo/downloadOhmPolygons.py`
* 수정: `.gitignore` (OHM 데이터 디렉토리 제외)
* 데이터: `public/geo/borders/ohm/` (988개 GeoJSON, gitignore됨)

---
## [2026-03-02][mk] dump-review 큐레이션 UI 신규 추가

### 작업 내용
Wikidata 덤프 파싱 데이터 큐레이션 관리 웹 UI 구축.

**생성 파일:**
- `data/dump_samples/hist_entities_raw.jsonl` — 12,374건 (jinserver에서 복사)
- `data/dump_samples/events_raw.jsonl` — 16,187건
- `data/dump_samples/places_sample.jsonl` — sitelinks 상위 1,000건
- `data/dump_samples/persons_sample.jsonl` — sitelinks 상위 500건
- `data/curation_decisions.json` — 결정 저장소 (초기값)
- `src/app/api/dump-curation/route.ts` — GET(필터/페이지네이션) + POST(결정저장) + stats
- `src/app/dump-review/page.tsx` — 4탭 큐레이션 UI (hist/event/place/person)
- `.claude/launch.json` — 로컬 dev 서버 설정

**주요 기능:**
- 4개 타입 탭 + 타입별 통계(전체/포함/제외/미결정)
- 검색, sitelinks 슬라이더, 연도범위, 결정상태 필터
- 개별 결정 버튼(✅포함/❌제외/⏭️건너뜀) + 키보드 단축키(A/D/S/↑↓)
- 일괄처리: sitelinks<10 제외, 좌표없는것 제외
- 상세 패널: Wikidata/위키백과 링크 포함
- 결정 즉시 `data/curation_decisions.json`에 자동저장
