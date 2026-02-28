# [cl] HB 역사 데이터 검증 워크플로우

## 개요
historical-basemaps(HB) GeoJSON 데이터의 국가별 존속기간을 Gemini에게 위키피디아 기준으로 교차검증시키는 워크플로우.

## 생성된 파일 구조

```
scripts/geo/validation/
├── README_WORKFLOW.md          ← 이 문서
├── all_entity_lifespans.json   ← 전체 2,827개 엔티티 존속 데이터 (참고용)
│
├── [핵심] Tier 1+2 검증용 (1000년 단위, 총 529개)
│   ├── gemini_tier12_1_-3000_to_-2000.md   ←  10개 (고대 문명)
│   ├── gemini_tier12_2_-1999_to_-999.md    ←  21개 (청동기~철기)
│   ├── gemini_tier12_3_-998_to_2.md        ←  69개 (고전기)
│   ├── gemini_tier12_4_3_to_1003.md        ← 174개 (중세 전반)
│   └── gemini_tier12_5_1004_to_1880.md     ← 386개 (중세~근세)
│
├── [전체] 500년 단위 (Tier 1+2+3, 총 2,827개)
│   ├── gemini_prompt_-3000_to_-2500.md
│   ├── ...
│   └── gemini_prompt_1509_to_1880.md
│
└── [데이터] 기간별 JSON
    ├── period_-3000_to_-2500.json
    ├── ...
    └── period_1509_to_1880.json
```

## 워크플로우 (Gemini 웹 UI 사용)

### Phase 1: 핵심 국가 검증 (Tier 1+2, 529개)

**순서: gemini_tier12_1 → 2 → 3 → 4 → 5**

1. Gemini 웹 UI (gemini.google.com) 접속
2. `gemini_tier12_1_-3000_to_-2000.md` 파일 내용 전체 복사
3. Gemini에 붙여넣기
4. Gemini가 테이블 형태로 검증 결과 반환
5. 결과를 `results/` 폴더에 저장
6. 다음 파일(2→3→4→5) 반복

**예상 소요**: 파일당 2~5분, 총 ~20분

### Phase 2: Tier 3 부족/문화 검증 (선택)

Tier 3은 2,298개로 많고 역사적 기록도 불확실하므로, Phase 1 완료 후 필요시 진행.
`gemini_prompt_*.md` 파일 사용.

### Phase 3: 결과 반영

검증 결과에서 발견된 문제를 `generateBorderMetadata.py`에 반영:

| 판정 | 조치 |
|------|------|
| `wrong_start` | YEAR_RANGE_OVERRIDES로 시작년도 보정 |
| `wrong_end` | YEAR_RANGE_OVERRIDES로 종료년도 보정 |
| `gap` | FORCED_ENTITIES로 빠진 구간 채움 |
| `missing` | FORCED_ENTITIES에 추가 |
| `extra` | 검토 후 필터링 |

## Gemini 프롬프트 특징

- **★ 표시**: Tier 1 (제국/왕국) 엔티티
- **⚠️ 의심 gap**: 400년 이상 스냅샷 공백 자동 감지
- **결과 형식**: 테이블 + 판정코드 → 파싱하기 쉬움

## 재생성 방법

```bash
python3 scripts/geo/extractEntityLifespans.py
```

메타데이터가 변경된 경우:
```bash
python3 scripts/geo/generateBorderMetadata.py
python3 scripts/geo/extractEntityLifespans.py
```
