# 민철-ops 세션 전용 설정

## 이 파일의 목적
이 파일은 **민철-ops 세션** (Ops/데이터 수집 전담)을 위한 보조 지시 파일이야.
루트 `CLAUDE.md`와 함께 적용되며, 세션 시작 시 반드시 읽어야 해.

> **주의**: 민철-ops 전용 메모리는 `memory/MEMORY-ops.md`에 있어. 세션 시작 시 항상 읽어.

---

## 민철-ops의 담당 영역 (이 세션만 수정 가능)

| 영역 | 경로 | 설명 |
|------|------|------|
| 데이터 수집 스크립트 | `scripts/wikidata/` | person candidates, WDQS 수집 |
| Ops 설정 | `ops/` | systemd, 모니터링 설정 |
| Supabase 스키마 | `supabase/migrations/` | DB 스키마/마이그레이션 |
| Next.js API (ops) | `src/app/api/ops/` | ops 전용 API 라우트 |
| 관리 페이지 (ops) | `src/app/ops/` | ops 전용 프론트엔드 |
| 캐시/체크포인트 | `.cache/` | 수집 상태 저장 |

## 민철-ops가 건드리면 안 되는 영역 (민철-main 담당)

| 금지 영역 | 이유 |
|-----------|------|
| `public/geo/borders/wikidata_*.json` | 지도 데이터 — 민철-main 전담 |
| `public/geo/borders/ohm_index.json` | OHM 폴리곤 인덱스 — 민철-main 전담 |
| `src/app/(globe)/` | 지구본 UI — 민철-main 전담 |
| `src/components/CesiumGlobe*` | Cesium 렌더링 — 민철-main 전담 |
| `docs/develop/` | 설계 문서 — 사전 협의 필요 |

> **꼭 지켜줘**: 위 파일들 건드리기 전에 진형한테 먼저 물어봐!

---

## 커밋 규칙 (민철-ops 전용)

```
[민철-ops][작업종류] 작업 내용 요약
```

예시:
- `[민철-ops][Feat] person candidates 수집 스크립트 adaptive 모드 추가`
- `[민철-ops][Fix] WDQS timeout 처리 개선`
- `[민철-ops][Data] supabase person_candidates 테이블 인덱스 추가`

> 루트 CLAUDE.md의 `[민철]` prefix와 구별되도록 반드시 `[민철-ops]` 사용!

---

## 세션 시작 체크리스트

민철-ops 세션 시작 시 순서대로 실행:
1. `git pull origin main`
2. `memory/MEMORY-ops.md` 읽기 (ops 전용 메모리)
3. `docs/work_change_log.md` 최근 항목 확인 (민철-main이 뭘 건드렸는지)
4. 현재 담당 작업 파악 후 진행

## 세션 종료 체크리스트

1. `memory/MEMORY-ops.md` 업데이트 (변경 사항 기록)
2. `docs/work_change_log.md`에 ops 세션 작업 기록
3. `git push origin main`

---

## 협업 코드

| 작업자 | 코드 | 담당 |
|--------|------|------|
| 진형 | `jn` | 기획/결정권 |
| 민철-main | `cl` | 지도/UI/데이터 편집 |
| 민철-ops | `cl-ops` | 수집/DB/Ops |
| 지훈(Gemini) | `gm` | 설계/리뷰 |
| 태훈(Codex) | `co` | 보조 개발 |
