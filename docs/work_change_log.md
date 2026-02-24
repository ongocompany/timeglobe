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


## [2026-02-24] [cl]
* `CLAUDE.md` 중복 섹션(5, 6번) 정리 및 커밋 메시지 형식 `[민철][Docs]`로 수정.
* `01_[gm]development_guide.md`에 기술 검토 및 추가 제안(섹션 6) 작성.
* 진형(jn)의 결정에 따라 기술 스택 확정 반영: 프론트엔드 `Next.js` 확정, GeoJSON `CDN 정적 호스팅` 확정.
* 진형(jn)의 요청으로 CesiumJS 커스터마이징 가능 범위 조사 및 `01_[gm]development_guide.md` 섹션 6-7에 결과 추가: 3D glTF 마커, SkyBox 우주 배경 커스텀, ParticleSystem 이펙트 모두 기본 지원 확인.

