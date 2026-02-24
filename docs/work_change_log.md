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


