# 3D 모델 가이드 — TimeGlobe 카테고리별 모델 목록

> 작성일: 2026-02-27 | 작성자: cl
> Meshy Pro로 생성, GLB 포맷, CesiumJS Entity로 지구본 위에 배치

---

## 1. 생성 규격

| 항목 | 권장값 |
|------|--------|
| 포맷 | GLB (glTF Binary) |
| 스타일 | 로우폴리 / 스타일라이즈드 (통일감 중요) |
| 파일 크기 | 1~3MB 이하 |
| 저장 경로 | `public/models/{카테고리}/{파일명}.glb` |
| 네이밍 | 소문자 + 언더스코어 (예: `royal_seal.glb`) |

---

## 2. 카테고리별 모델 목록

### A. 랜드마크 / 원더 (실제 건축물)

지도 위에 해당 위치에 실제 모양으로 배치. 이벤트와 1:1 매핑.

| # | 모델 | 시대 | 위치 | 파일명 (예시) | 생성 여부 |
|---|------|------|------|-------------|----------|
| 1 | 기자 피라미드 | 고대 | 이집트 카이로 | `pyramid_giza.glb` | [ ] |
| 2 | 스핑크스 | 고대 | 이집트 카이로 | `sphinx.glb` | [ ] |
| 3 | 파르테논 신전 | 고대 | 그리스 아테네 | `parthenon.glb` | [ ] |
| 4 | 콜로세움 | 고대 | 이탈리아 로마 | `colosseum.glb` | [ ] |
| 5 | 만리장성 (구간) | 고대~중세 | 중국 | `great_wall.glb` | [ ] |
| 6 | 앙코르와트 | 중세 | 캄보디아 | `angkor_wat.glb` | [ ] |
| 7 | 마추픽추 | 중세 | 페루 | `machu_picchu.glb` | [ ] |
| 8 | 타지마할 | 근세 | 인도 아그라 | `taj_mahal.glb` | [ ] |
| 9 | 노트르담 대성당 | 중세 | 프랑스 파리 | `notre_dame.glb` | [ ] |
| 10 | 피사의 사탑 | 중세 | 이탈리아 피사 | `leaning_tower_pisa.glb` | [ ] |
| 11 | 모아이 석상 | 중세 | 이스터섬 | `moai.glb` | [ ] |
| 12 | 개선문 | 근대 | 프랑스 파리 | `arc_de_triomphe.glb` | [ ] |
| 13 | 에펠탑 | 근대 | 프랑스 파리 | `eiffel_tower.glb` | [ ] |
| 14 | 자유의 여신상 | 근대 | 미국 뉴욕 | `statue_of_liberty.glb` | [ ] |
| 15 | 빅벤 | 근대 | 영국 런던 | `big_ben.glb` | [ ] |
| 16 | 브란덴부르크 문 | 근대 | 독일 베를린 | `brandenburg_gate.glb` | [ ] |
| 17 | 엠파이어스테이트 빌딩 | 현대 | 미국 뉴욕 | `empire_state.glb` | [ ] |
| 18 | 시드니 오페라하우스 | 현대 | 호주 시드니 | `sydney_opera.glb` | [ ] |
| 19 | 부르즈 할리파 | 현대 | UAE 두바이 | `burj_khalifa.glb` | [ ] |
| 20 | 크렘린궁 | 근대 | 러시아 모스크바 | `kremlin.glb` | [ ] |

> 향후 확장 예정: 경복궁, 자금성, 성 소피아 대성당, 페트라, 치첸이트사, 시스티나 성당 등

---

### B. 전쟁/분쟁 — 시대별 무기 모델

| 시대 | 연도 범위 | 모델 | 파일명 | 생성 여부 |
|------|----------|------|--------|----------|
| 고대 | ~500 | 검과 방패 | `sword_shield.glb` | [ ] |
| 중세 | 500~1400 | 활과 화살 | `bow_arrow.glb` | [ ] |
| 화약시대 | 1400~1800 | 대포 | `cannon.glb` | [ ] |
| 근대 | 1800~1945 | 소총 | `rifle.glb` | [ ] |
| 현대 | 1945~ | 미사일 기지 | `missile_base.glb` | [ ] |

---

### C. 혁명/봉기 — 통일 모델

시대 구분 없이 하나의 모델로 통일.

| 모델 | 파일명 | 생성 여부 |
|------|--------|----------|
| 주먹과 깃발 (Raised Fist & Flag) | `revolution_fist_flag.glb` | [ ] |

> 적용 예: 프랑스 혁명, 동학농민전쟁, 안사의 난, 각종 시민 봉기/민중 운동

---

### D. 인물/문화 — 통일 모델

시대 구분 없이 하나의 모델로 통일.

| 모델 | 파일명 | 생성 여부 |
|------|--------|----------|
| 대리석 흉상 (Marble Bust) | `marble_bust.glb` | [ ] |

> 적용 예: 위인 탄생, 문화 인물, 사상가, 예술가 등

---

### E. 과학/발명 — 시대별 모델

| 시대 | 모델 | 파일명 | 생성 여부 |
|------|------|--------|----------|
| 고대 | 파피루스 두루마리 | `papyrus_scroll.glb` | [ ] |
| 중세~근세 | 고서 (책) | `old_book.glb` | [ ] |
| 산업혁명 | 톱니바퀴 | `cogwheel.glb` | [ ] |
| 현대 | 원자 모형 | `atom_model.glb` | [ ] |
| 동시대 | 컴퓨터/칩 | `computer_chip.glb` | [ ] |

---

### F. 정치/사회 — 통일 모델

조약, 헌법, 법률, 국제기구 설립, 사회개혁 등.

| 모델 | 파일명 | 생성 여부 |
|------|--------|----------|
| 두루마리 문서 (Scroll Document) | `scroll_document.glb` | [ ] |

> 적용 예: 마그나카르타, 미국 독립선언, 베르사유 조약, UN 창설, 노예제 폐지 등

---

### G. 건국/수립 — 시대별 모델

| 시대 | 모델 | 파일명 | 생성 여부 |
|------|------|--------|----------|
| 고대~중세 | 국새/옥새 (Royal Seal) | `royal_seal.glb` | [ ] |
| 근대 이후 | 국기 (National Flag) | `national_flag.glb` | [ ] |

> 근대 이후 국기: 가능하면 해당 국가 실제 국기 텍스처 적용 (예: 이탈리아=삼색기, 미국=성조기)

---

### H. 선사시대 — 시대별 유물 모델

| 시대 | 연도 범위 | 모델 | 파일명 | 생성 여부 |
|------|----------|------|--------|----------|
| 구석기 | ~1만 년 전 | 주먹도끼 (Hand Axe) | `hand_axe.glb` | [ ] |
| 신석기 | 1만~3천 년 전 | 토기 (Simple Pot) | `simple_pot.glb` | [ ] |
| 청동기 | 3천~1천 년 전 | 청동 도끼 (Bronze Axe) | `bronze_axe.glb` | [ ] |

---

## 3. 시대 연결 흐름도

```
[선사시대]                    [역사시대]
주먹도끼 → 토기 → 청동도끼 → 검과방패 → 활 → 대포 → 소총 → 미사일기지
(구석기)  (신석기) (청동기)    (고대)   (중세) (화약) (근대)  (현대)
```

---

## 4. 모델 선택 로직 (구현 시 참고)

```typescript
function getModelPath(event: Event): string {
  // 1. 랜드마크 체크 (특정 이벤트 ID or 태그)
  if (event.landmark_model) return `/models/landmark/${event.landmark_model}`;

  // 2. 카테고리 + 연도 기반 선택
  const year = event.start_year;

  switch (event.category) {
    case '전쟁/분쟁':
      if (year < 500) return '/models/war/sword_shield.glb';
      if (year < 1400) return '/models/war/bow_arrow.glb';
      if (year < 1800) return '/models/war/cannon.glb';
      if (year < 1945) return '/models/war/rifle.glb';
      return '/models/war/missile_base.glb';

    case '혁명/봉기':
      return '/models/revolution/revolution_fist_flag.glb';

    case '인물/문화':
      return '/models/people/marble_bust.glb';

    case '과학/발명':
      if (year < 500) return '/models/science/papyrus_scroll.glb';
      if (year < 1700) return '/models/science/old_book.glb';
      if (year < 1900) return '/models/science/cogwheel.glb';
      if (year < 2000) return '/models/science/atom_model.glb';
      return '/models/science/computer_chip.glb';

    case '정치/사회':
      return '/models/politics/scroll_document.glb';

    case '건국/수립':
      if (year < 1500) return '/models/establishment/royal_seal.glb';
      return '/models/establishment/national_flag.glb';

    case '선사시대':
      if (year < -10000) return '/models/prehistoric/hand_axe.glb';
      if (year < -3000) return '/models/prehistoric/simple_pot.glb';
      return '/models/prehistoric/bronze_axe.glb';

    default:
      return '/models/default/marker.glb';
  }
}
```

---

## 5. Meshy 생성 팁

- **프롬프트 스타일 통일**: "low-poly stylized [물체], soft colors, clean geometry" 계열로 통일감 유지
- **Image-to-3D 모드** 권장: Text-to-3D보다 퀄리티 우수
- **참고 이미지**: 원하는 스타일의 2D 이미지를 먼저 찾아서 Input으로 사용
- **텍스처**: Meshy에서 자동 생성된 텍스처 사용, 필요 시 후보정
- **크기 조절**: CesiumJS에서 `modelMatrix`의 `scale`로 조정 가능

---

## 6. 총 모델 수 요약

| 카테고리 | 모델 수 |
|---------|--------|
| 랜드마크 (초기) | 20 |
| 전쟁/분쟁 | 5 |
| 혁명/봉기 | 1 |
| 인물/문화 | 1 |
| 과학/발명 | 5 |
| 정치/사회 | 1 |
| 건국/수립 | 2 |
| 선사시대 | 3 |
| **합계** | **38** |
