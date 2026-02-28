# 🌐 TimeGlobe PM Dashboard
> 🤖 **PM (Gemini) ↔ 🧑‍💻 Dev (Jinwoo & Claude) Sync Point**

## 🚨 PM 알림 및 방향성 체크 (Sanity Check)
- [ ] **[완료 확인]** 2/28 국경 데이터(GeoJSON) 160개 하이브리드 인덱싱 완료 (`public/geo/borders/index.json`). 
- [ ] **[다음 스텝]** 이제 확보된 정밀한 국경 데이터와 12,194건의 이벤트 데이터를 **CesiumJS 3D 지구본 UI (타임라인 포함)**에 올려서 시각적으로 잘 렌더링되는지(성능/버그) 테스트할 차례입니다.
- [ ] **[방향성 알림]** 데이터 수집 파이프라인(Wikidata 중심, 1인 개발 유지보수 최적화) 원칙이 아주 잘 지켜지고 있습니다. 앞으로도 Wikipedia 본문 크롤링은 지양하고 구조화된 데이터 중심으로 가주세요!

## 📊 프로젝트 진척도 (Project Status)
- **현재 단계**: Phase 0 (데이터 및 인프라 세팅) ➔ **Phase 1 (UI/UX 렌더링 및 타임라인 연동) 진입 중**
- **최근 완료된 작업 (2026-02-28)**: 
  - ✅ 전투(Battle) 이벤트 406건 스코어링(1~10점) 완료 및 DB 반영 (총 이벤트 12,194건 확보)
  - ✅ CShapes 2.0 하이브리드 국경 시스템 통합 (근현대사 1886~2019 국경 정밀도 향상)
  - ✅ `CesiumGlobe.tsx`에 CShapes 데이터 연동 (caplong/caplat 라벨 위치 최적화)
  - ✅ 동아시아 시대별 라벨 수정: YEAR_RANGE_OVERRIDES 도입 (Korea/Japan/China/Taiwan 시대 반영)
- **다음 마일스톤 (Next Milestone)**: 
  - 🚀 CesiumGlobe 프론트엔드 최적화 및 타임라인 슬라이더 연동 (연도 변화에 따른 국경/마커 트랜지션 테스트)
  - 🚀 UI/UX 디자인 시스템 적용 (마커 카테고리별 색상/아이콘 렌더링)

## 📋 핵심 TODO & 블로커 (Blockers)
- [x] `02_Project_Structure.md` 초기 스캔 (2026-02-28 cl 완료)
- [ ] **[이슈/블로커]** 미매핑된 3,469건의 소규모 영토(Alaska, Maldives, Palestine 등)에 대한 향후 점진적 추가 방안 마련 필요.
- [ ] (진님이 추가할 내용 대기 중...)
