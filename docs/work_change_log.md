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
*이전 기록은 `docs/work_change_log_archive.md`에 보관*
