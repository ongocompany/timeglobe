# 지도 데이터 수정 이력

> 작성/관리: 민철(cl)
> 목적: entities_raw, circles, ohm_index, cshapes_qid_index 등 데이터 파일의 변경 내역 추적
> "왜 이 엔티티가 없지?", "이거 언제 바꿨지?" 할 때 여기를 본다.

---

## 변경 이력 (최신순)

### 2026-03-03 — CSHAPES prefix 중복 엔티티 정리
**커밋**: `4d2ab00`
**변경 파일**: `wikidata_entities_raw.json`, `cshapes_qid_index.json`, `wikidata_circles.json`

#### 1) entities_raw에서 CSHAPES_ 중복 160개 제거
- **원인**: `CSHAPES_United_Kingdom`, `CSHAPES_France` 등 Wikidata QID가 아닌 자체 ID 엔티티가 QID 엔티티와 중복 등록
- **처리**: `name_ko` 기준 QID 매칭 → 매칭된 160개 CSHAPES_ 엔티티 삭제
- **결과**: 2,148개 → **1,988개**
- **유지**: QID 매칭 없는 73개 CSHAPES_ 엔티티 유지 (식민지/해외영토 등)
  - 예: `CSHAPES_French_Guyana`, `CSHAPES_Puerto_Rico`, `CSHAPES_Reunion` 등
- **circles/ohm 영향**: CSHAPES_ 엔티티는 circles, ohm_index에서 참조 0건 → 영향 없음
- **스크립트**: `/tmp/cleanup_cshapes_dupes.py` (jinserver에서 실행)
- **백업**: `wikidata_entities_raw.json.bak` (jinserver)

#### 2) cshapes_qid_index에 76개 QID 추가
- **원인**: CSHAPES_ 엔티티 삭제 시 CShapes 폴리곤 연결고리도 끊어짐
  - 예: `CSHAPES_United_Kingdom` 삭제 → `Q145`(영국)가 index에 없으면 CShapes 폴리곤 안 그려짐
- **처리**: 삭제된 160개 CSHAPES_의 `cshapes_name`을 QID 엔티티에 매핑하여 index에 추가
- **cshapes_years**: 117개 GeoJSON(1886~2015) 전체 스캔하여 연도 배열 채움 (empty 0)
  - GeoJSON의 NAME 필드가 공백(`United Kingdom`)이고 index는 밑줄(`United_Kingdom`) → 양쪽 매칭
- **결과**: 94개 → **170개**
- **주요 추가**: Q30(미국), Q145(영국), Q142(프랑스), Q148(중국), Q668(인도), Q38(이탈리아), Q16(캐나다), Q408(호주) 등

#### 3) circles 재생성
- **결과**: 1,551개 → **1,425개**
- CSHAPES_ 73개 제외 + 삭제분 반영
- `python3 scripts/wikidata/rebuildCircles.py`로 재생성

---

### 2026-03-03 — 경계선 렌더링 수정
**커밋**: `a005b7f`, `51c1782`
**변경 파일**: `src/components/CesiumGlobe.tsx`

#### 1) 이중 그리기 방지 (`a005b7f`)
- **문제**: polygon fill fallback(catch 블록)에서 polyline + 경계선 섹션에서도 polyline → 같은 국경 2번 그림
- **수정**: fallback에 `if (!showBorderRef.current || entityTier > 2)` 가드 추가
- **추가**: `extractOuterRings()` 함수 — hole 링 제외, 외곽 경계만 렌더링

#### 2) T1 경계선 너비 축소 (`51c1782`)
- T1: 1.5px → **1.0px** (T2는 이미 1.0px)
- 참고: 지그재그 국경선이 축소 시 겹쳐 두꺼워 보이는 현상은 데이터 특성 (코드 문제 아님)

---

### 2026-03-02 — 오스트리아/헝가리 정리 (세션8)
**변경 파일**: `wikidata_entities_raw.json`, `wikidata_minor_entities.json`

#### 오스트리아 계열
- minor로 이동: 합스부르크 군주국, 제1공화국, 연방국, 독일계오스트리아 공화국
- T1 승격: 오스트리아 (Q40)
- 타임라인: 공국T3 → 대공국T2 → 제국T1 → 오헝T1 → 오스트리아T1

#### 헝가리 계열
- minor로 이동: 세부시대구분 3개, 평의회공화국, 제2공화국
- T1 승격: 헝가리 (Q28)
- 타임라인: 대공국T3 → 왕국T1 → 오헝T1 → 헝가리T1

---

### 2026-02-28 — 지명 표기 적용 (세션4)
**변경 파일**: `wikidata_entities_raw.json`, `wikidata_minor_entities.json`

| 국가 | 처리 | 설명 |
|------|------|------|
| 영국 | 그레이트브리튼 왕국/연합왕국 삭제, "영국" 1707~2025 통일 | 국가 연속성 원칙 |
| 프랑스 | 왕국/제1~4공화국/제1~2제국/비시 삭제, "프랑스" 987~2025 | 국가 연속성 원칙 |
| 러시아 | 소련 1886→1922~1991 수정, RSFSR 삭제 | 키예프루스→모스크바→차르→제국→소련→러시아 |
| 독일 | 프로이센 왕국/공국 삭제, 독일국(나치)→나치 독일, 동독 중복 제거 | |
| 이탈리아 | 왕국 3개/제국/살로 삭제, "이탈리아" 1861~2025 | |
| 중국 | 중화민국 대륙시기→중화민국, 국민정부 삭제 | 별개 실체 원칙 |

- 밀레니엄급 부정확 날짜 6건 수정 (고촉 BC2000→BC1200 등)
- 내부 정체변화 14개국 시작일 원복

---

### 2026-02-27 — Tier 스코어링 최초 적용
**변경 파일**: `wikidata_entities_raw.json`

- 3요소 스코어링: sitelinks(log*12) + 존속기간(min/50,20) + 동시대경쟁도(percentile*30)
- 11개 권역 바운딩박스, 한국사 오버라이드 (왕조=T1, 부족연맹=T2)
- Tier 배분: region별 상위 8%=T1, 8~25%=T2, 25~55%=T3, 55~100%=T4
- 스크립트: `scripts/wikidata/assignTiers.py`

---

### 2026-02-26 — OHM 폴리곤 구축
**변경 파일**: `ohm_index.json`, `public/geo/borders/ohm/*.geojson`

- OHM 3,550개 relation 중 확장 매칭 229/565 (40.5%)
- 다운로드: `scripts/geo/downloadOhmPolygons.py` → `ohm_{rid}.geojson` 1,006개 (~900MB)
- 수동 폴리곤 109개 (RID 9000001~9000109, border_precision=1, source="manual_cl")
- ohm_index.json: 807개 엔티티, 1,062 스냅샷

---

## 데이터 파일 요약 (현재 상태)

| 파일 | 건수 | 설명 |
|------|------|------|
| `wikidata_entities_raw.json` | 1,988 | 전체 엔티티 (T1~T4 + CSHAPES_ 73개) |
| `wikidata_circles.json` | 1,425 | 지도에 그려지는 원형 (CSHAPES/T5 제외) |
| `wikidata_minor_entities.json` | 605 | 내부정권/중복/통합된 엔티티 |
| `cshapes_qid_index.json` | 170 | QID→CShapes 폴리곤 매핑 |
| `ohm_index.json` | 807 엔티티, 1,062 스냅샷 | OHM 폴리곤 매핑 |
| `wikidata_no_dates.json` | 1,337 | 날짜 없는 엔티티 (좌표 보충 대기) |

---

## 미완료 / 향후 처리 대상

| 항목 | 상태 | 설명 |
|------|------|------|
| CSHAPES_ 73개 QID 미매칭 | 보류 | 식민지/해외영토. QID 부여 or minor 분류 필요 |
| 지명 표기 미완료 국가 | 보류 | 스페인, 오스만/튀르키예, 일본, 한국, 폴란드 등 |
| unknown region 631개 | 보류 | dump 파싱 후 좌표 보충 예정 |
| OHM 수동 폴리곤 미생성 | 보류 | 오환, 동예, 옥저, 변한, 마한, 대가야, 금관가야 |
| T1 국경선 완전누락 76개 | 분석완료 | `docs/develop/11_[cl]border_gap_analysis.md` 참조 |
| 영국 1707~1922 갭 | 확인필요 | OHM에서 해당 시기 데이터 존재 여부 확인 |
