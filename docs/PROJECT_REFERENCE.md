# TimeGlobe 프로젝트 레퍼런스 (2026-03-03 기준)

> 이 문서는 프로젝트 전체 현황을 한 곳에 정리한 참조용 문서입니다.
> 매 세션 읽지 않고, 필요할 때만 참조하세요.

---

## 1. 프로젝트 개요

- **TimeGlobe**: 3D 지구본(CesiumJS) 기반 역사 에듀테크 서비스
- **스택**: Next.js 16 + CesiumJS (Resium) + Supabase
- **URL**: http://timeglobe.kr (프로덕션), http://100.68.25.79:3000 (개발)

---

## 2. 서버 환경

| 서버 | IP | 접속 | 경로 | 용도 |
|------|-----|------|------|------|
| **jinserver** | 100.68.25.79 | `ssh jinwoo@` | `/home/jinwoo/timeglobe` | 개발 (port 3000), 46GB RAM, i5-12400 |
| **VPS** | 158.247.225.152 | `ssh root@` | `/var/www/timeglobe.kr` | 프로덕션 (port 3001, nginx 프록시) |
| **NAS** | 100.115.194.12 | `ssh jinadmin@` | `~/timeglobe` | 백업용 (port 3001) |

- jinserver: `/mnt/data2/wikidata/` (덤프 142GB + 파싱 output), `/mnt/data2/namuwiki/` (8GB SQLite)
- 모든 IP는 Tailscale 내부망

---

## 3. 페이지 & API

### 사용자 페이지
| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `src/app/page.tsx` (786줄) | 메인 지구본 — TimeDial, 국경선, 라벨 |

### 관리/리뷰 페이지
| 경로 | 파일 | 설명 |
|------|------|------|
| `/tier-review` | `src/app/tier-review/page.tsx` (2,701줄) | 엔티티 Tier 리뷰 + 덤프 브라우저 + Leaflet 지도 |
| `/dump-review` | `src/app/dump-review/page.tsx` | Wikidata 덤프 큐레이션 UI (4탭) |
| `/namuwiki-viewer` | `src/app/namuwiki-viewer/page.tsx` | 나무위키 검색/분류/본문 뷰어 |
| `/ops` | `src/app/ops/page.tsx` | 수집 파이프라인 모니터링 |
| `/data-check` | `src/app/data-check/page.tsx` | Supabase 데이터 확인 |
| `/curation` | `src/app/curation/page.tsx` | 이벤트 큐레이션 |
| `/model-manager` | `src/app/model-manager/page.tsx` | 3D 모델 관리 |

### API
| 경로 | 설명 |
|------|------|
| `/api/tiers` | GET/POST — raw 엔티티 읽기/쓰기 |
| `/api/tiers/comments` | Tier 리뷰 코멘트 |
| `/api/dump-browse` | 덤프 데이터 페이지네이션/필터 (jinserver 직접 읽기) |
| `/api/dump-curation` | 큐레이션 결정 저장/조회 |
| `/api/namuwiki` | 나무위키 SQLite 검색 (search/article/categories/category) |
| `/api/ops/pipeline-status` | 수집 파이프라인 상태 |
| `/api/models` | 3D 모델 API |

---

## 4. 핵심 컴포넌트

### CesiumGlobe.tsx (2,288줄) — 지구본 렌더링 엔진
| 함수 | 줄 | 역할 |
|------|-----|------|
| `SceneSetup()` | 238 | SkyBox, 구름, 자전, glow, 조명 설정 |
| `renderCirclesForYear()` | 1687 | 연도별 원형 마커 + 라벨 렌더링 (라벨 통합 담당) |
| `loadOhmIndex()` | 1778 | ohm_index.json 로드 + ohmQidsRef 세팅 |
| `renderOhmForYear()` | 1828 | OHM 폴리곤 렌더링 (라벨 없음, 폴리곤만) |

**3개 독립 DataSource**: circleDsRef (원형+라벨), ohmDsRef (OHM 폴리곤), borderDsRef (CShapes, 비활성)

### 기타 컴포넌트
| 파일 | 역할 |
|------|------|
| `GlobeLoader.tsx` | CesiumGlobe SSR-safe 래퍼 (dynamic import) |
| `ui/TimeDial.tsx` | 연도 조절 다이얼 |
| `ui/ControlBar.tsx` | 하단 컨트롤바 |
| `ui/Header.tsx` | 상단 헤더 |
| `ui/Dashboard.tsx` | 대시보드 오버레이 |
| `tier-review/TierReviewMap.tsx` | Leaflet 지도 래퍼 |

---

## 5. 데이터 파일

### 지도 데이터 (`public/geo/borders/`)
| 파일 | 개수 | 설명 |
|------|------|------|
| `wikidata_entities_raw.json` | 2,148개 | 메인 엔티티 (T1~T5) |
| `wikidata_circles.json` | 1,425개 | 렌더링용 (T1~T4, CSHAPES/T5 제외) |
| `wikidata_minor_entities.json` | 747개 | 내부정권/중복 분류 |
| `wikidata_no_dates.json` | 1,337개 | 날짜 없음, 보충 참조용 |
| `ohm_index.json` | 807개 | OHM 폴리곤 인덱스 (1,062 스냅샷) |
| `ohm/ohm_*.geojson` | 2,231개 | OHM 폴리곤 GeoJSON (~900MB, gitignored) |

### jinserver 덤프 데이터 (`/mnt/data2/wikidata/output/`)
| 파일 | 크기 | 설명 |
|------|------|------|
| `persons_final.json` | 7.6GB | 인물 |
| `places_final.json` | 1.5GB | 장소 |
| `events_final.json` | 48MB | 사건 |
| `hist_entities_final.json` | 32MB | 역사 엔티티 |
| `korean_all.jsonl` | 파싱 중 | 한국어 엔티티 전량 |
| `maps.db` | 9.1GB | 좌표/라벨 SQLite |

---

## 6. 스크립트

### 지도 데이터 (`scripts/geo/`)
| 스크립트 | 역할 |
|----------|------|
| `downloadOhmPolygons.py` | OHM Overpass API → GeoJSON 다운로드 |
| `extractCShapes.py` | CShapes 2.0 GeoJSON 처리 |
| `buildEntityTimeline.py` | 엔티티 타임라인 생성 |

### Wikidata (`scripts/wikidata/`)
| 스크립트 | 역할 |
|----------|------|
| `rebuildCircles.py` | **circles.json 재생성** (fixLabelCoords 포함) |
| `assignTiers.py` | Tier 자동 스코어링 |
| `fetchSitelinks.py` | Wikidata sitelinks 조회 |
| `fixLabelCoords.py` | 국명 라벨 좌표 보정 |
| `parseDump.py` | Wikidata 덤프 파싱 (SQLite v2) |
| `parseKorean.py` | 한국어 엔티티 전량 추출 |
| `buildNamuwikiSqlite.py` | 나무위키 SQLite 빌드 |

### 수집 파이프라인 (`scripts/wikidata/` — mk 담당)
| 스크립트 | 역할 |
|----------|------|
| `collectPersonCandidates.mjs` | 인물 후보 수집 |
| `runPersonCandidateBatches.mjs` | 배치 반복 실행 |
| `wdqsProbe.mjs` | WDQS 부하 탐지 |
| `workerMonitor.mjs` | 워커 heartbeat 모니터 |

---

## 7. 소스 트리 (주요)

```
TimeGlobe/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # 메인 지구본
│   │   ├── tier-review/page.tsx      # Tier 리뷰 + 덤프 브라우저
│   │   ├── dump-review/page.tsx      # 덤프 큐레이션
│   │   ├── namuwiki-viewer/page.tsx   # 나무위키 뷰어
│   │   ├── ops/page.tsx              # Ops 모니터링
│   │   └── api/
│   │       ├── tiers/route.ts        # 엔티티 CRUD
│   │       ├── dump-browse/route.ts  # 덤프 데이터 조회
│   │       ├── namuwiki/route.ts     # 나무위키 검색
│   │       └── ops/                  # 파이프라인 상태
│   ├── components/
│   │   ├── CesiumGlobe.tsx           # 지구본 엔진 (2,288줄)
│   │   ├── GlobeLoader.tsx           # SSR-safe 래퍼
│   │   ├── tier-review/              # Leaflet 지도
│   │   └── ui/                       # UI 컴포넌트
│   └── data/                         # 목업 이벤트
├── public/geo/borders/
│   ├── wikidata_*.json               # 엔티티 데이터
│   ├── ohm_index.json                # OHM 인덱스
│   └── ohm/                          # GeoJSON 2,231개 (gitignored)
├── scripts/
│   ├── geo/                          # 지도 데이터 스크립트
│   └── wikidata/                     # 파싱/수집 스크립트
├── docs/
│   ├── develop/                      # 설계 문서
│   ├── work_change_log.md            # 당일 작업 기록
│   └── work_change_log_archive.md    # 과거 기록
├── ops/
│   ├── CLAUDE.md                     # 민규 전용 설정
│   └── systemd/                      # 서비스 파일
├── supabase/migrations/              # DB 마이그레이션
└── CLAUDE.md                         # 민철 설정
```

---

## 8. 주요 설계 문서 (`docs/develop/`)

| 번호 | 파일 | 내용 |
|------|------|------|
| 01 | `[gm]development_guide.md` | 개발 가이드 |
| 02 | `[gm]database_schema_plan.md` | DB 스키마 |
| 03 | `[gm]border_visualization_schema.md` | 국경선 시각화 |
| 09 | `[cl]border_data_architecture.md` | 국경 데이터 아키텍처 |
| 10 | `[cl]naming_convention.md` | 지명 표기 원칙 |
| 11 | `[mk]curation_criteria.md` | 큐레이션 기준 |
