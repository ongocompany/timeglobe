# Handoff: persons 단계별 필터 + 카드 생성 파이프라인

> **작성**: 2026-03-08 민철(cl)
> **목적**: 세션 전환 시 컨텍스트 유지용. 노트북에서 이어서 작업.

---

## 1. 현재 상태

### 데이터 위치 (jinserver 100.68.25.79)
```
/mnt/data2/wikidata/output/
  final/persons.jsonl          ← 52,229건 (sl≥20, AI 스코어링 없음)
  cards/persons/cards_persons.jsonl  ← 3,293건 카드 완료 (기존 AI 큐레이션분)
  cards/persons/progress.json  ← 진행 기록
  categories/03_person.jsonl   ← 308,628건 원본 후보 풀
  persons_raw.jsonl            ← 13M건 (전체 dump 파싱 결과, 5.8GB)
```

### 카드 완료 현황
| 카테고리 | final/ | cards/ | 상태 |
|---------|--------|--------|------|
| persons | 52,229 | 3,293 | **미완료 48,936건** |
| events | 1,238 | 1,237 | 완료 |
| artworks | 2,812 | 2,545 | 267건 실패 |
| inventions | 417 | 416 | 완료 |
| items | 123 | 123 | 완료 |
| AI 영화 | 470 | - | 카드 불필요 (description 포함) |

### 카드 파일 구조
- final/ 키: `qid`, `name_ko`, `name_en`, `sitelinks`, `birth_year`, `death_year`, `citizenship_qid`, `occupation_qids`, `image`, `_category`
- cards/ 키: `description_ko`, `description_en`, `key_achievements`, `related_events`, `era_context`, `fun_fact`, `_qid`, `_name_ko`, `_model`, `_birth_year` 등
- **주의**: cards에서 QID는 `_qid` 필드 (앞에 언더스코어)

---

## 2. 핵심 문제: persons 52,229건의 편중

### 연대별 분포
```
고대~근세 (~1800):    6,544명 (13%)  ← 역사적 핵심, 거의 다 카드 가치 있음
근대 (1800~1900):     5,701명 (11%)
현대초 (1900~1950):  10,944명 (21%)
현대 (1950~1980):    14,105명 (27%)  ← 축구선수/연예인 다수
동시대 (1980~):      14,747명 (28%)  ← 유튜버/현역 배우/e스포츠 등
```
**55%가 1950년 이후 출생** — sl이 높아도 하위문화 인물이 대부분

### 기존 카드 3,293건의 연대 균형 (참고)
- 고대~근세: 1,502건 (46%) — AI가 역사적 인물을 잘 골랐음
- 현대+동시대: 407건 (12%) — 현대 인물은 엄격하게 걸러냈음

### sl 구간별 분포 (미완료 48,936건)
```
sl 100+:     424명 — 확실히 카드 가치 있는 인물 (마를레네 디트리히, 오일러, 젤렌스키 등)
sl 50~99:  7,655명 — 혼재 (역사인물 + 축구선수)
sl 30~49: 17,906명 — 하위문화 비중 높음
sl 20~29: 22,951명 — 대부분 마이너
```

---

## 3. 진형 결정 사항

- **최종 목표: ~20,000명** (현재 3,293 + 추가 ~17,000)
- **전체 52K 무차별 처리 금지** — 비용/품질 모두 비효율
- **단계별 진행**

---

## 4. 실행 계획 (다음 세션에서 할 일)

### Step 1: 기계적 사전 필터 (비용 $0)
**목적**: 52,229 → ~15,000~20,000으로 축소

필터 조건 (안):
1. **occupation 필터**: `occupation_qids`에서 스포츠 선수(Q937857 등), 현역 배우, 유튜버, e스포츠 등 제외
   - 단, 역사적 스포츠 인물은 예외 (무하마드 알리, 펠레 등은 sl 높으면 유지)
2. **연대별 sl 차등**:
   - 1980~ 출생: sl≥80 (하위문화 강하게 필터)
   - 1950~1980 출생: sl≥50
   - 1900~1950 출생: sl≥30
   - ~1900 출생: sl≥20 (고대~근대는 전부 유지)
3. **이미 카드 있는 3,293명은 자동 통과**

**필요한 작업**:
- Wikidata occupation QID → "sports/entertainment" 매핑 테이블 구축
- `final/persons.jsonl`에서 `occupation_qids` 파싱해서 필터 적용
- 필터 결과 통계 확인 후 진형에게 리뷰 요청

### Step 2: AI 큐레이션 (~$1~3)
- Step 1 통과분 중 기존 카드 없는 것만 대상
- Gemini Flash Lite로 "이 인물이 역사 타임라인 카드로 가치 있는가?" YES/NO
- 프롬프트: desc_ko + birth_year + occupation 정보만 전달 (토큰 절약)
- 예상 통과율: 60~80%

### Step 3: 카드 생성 (~$5~15)
- Step 2 통과분만 → Wikipedia 본문 읽기 + Gemini로 카드 생성
- 기존 `generateCards.py` 사용 (--model gemini-2.5-flash-lite)
- 기존 3,293 카드와 합치면 최종 ~20,000명

---

## 5. 기타 대기 작업

| 작업 | 우선도 | 비고 |
|------|--------|------|
| **persons 단계별 필터** | **최우선** | 위 계획 실행 |
| AI필터 YES artworks 2,393건 | 중 | 날짜/좌표 보충 후 카드 생성 |
| MockEvent 변환 | 중 | items/inventions/events/artworks → 프론트엔드 JSON |
| 영화 470편 좌표 매핑 | 하 | setting_location → lat/lon |
| artworks 좌표 보강 | 하 | SPARQL P1071/P840/creator P19 |

---

## 6. 스크립트 참조

| 스크립트 | 위치 | 용도 |
|---------|------|------|
| generateCards.py | jinserver `scripts/wikidata/` | 카드 생성 (Gemini) |
| generateFilmList.py | `/tmp/` (로컬) | AI 영화 생성 |
| selectFilmsByYear.py | `/tmp/` (로컬) | **deprecated** (Wikidata 기반) |
| pilotArtworkFilter.py | `/tmp/` (로컬) | artwork AI 필터 |
| data_status.py | `/tmp/` (로컬) | 데이터 현황 리포트 |

---

## 7. API 키 & 모델

- **GEMINI_API_KEY** / **GEMINI_CARD_KEY**: 유료 키 (RPM 1,000)
- **카드 생성 모델**: `gemini-2.5-flash-lite` (비용 절감)
- **큐레이션 모델**: `gemini-2.5-flash-lite` 또는 `gemini-3.1-flash-lite-preview`
- **영화 생성 모델**: `gemini-3.1-flash-lite-preview` (2.5는 할루시네이션)

---

## 8. 세션 시작 체크리스트

1. `git pull dev main`
2. 이 문서 읽기
3. `docs/work_change_log.md` 최하단 확인
4. Step 1 기계적 필터부터 시작
