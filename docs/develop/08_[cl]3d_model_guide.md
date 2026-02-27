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

## 5. Meshy Text-to-3D 프롬프트 가이드

### 5-1. 스타일 공통 규칙

**일반 카테고리 모델** (전쟁, 혁명, 인물, 과학, 정치, 건국, 선사):
- 스타일: Low-poly, 미니어처 느낌, 단순한 색감
- 텍스처: 플랫 컬러 위주 (복잡한 맵핑 X)
- 폴리곤: 적게 (지구 위에 작게 올라가므로 디테일 과잉 불필요)

**랜드마크 모델**:
- 스타일: Medium-poly, 건축물 특징이 살아야 함
- 텍스처: 약간 더 디테일 허용 (돌결, 금속감 정도)
- 실루엣이 명확해야 함 (멀리서도 알아볼 수 있게)

### 5-2. 공통 프롬프트 템플릿

**일반 모델용 (Base Prompt)**:
```
[물체 영문], low-poly miniature style, flat shading, simple solid colors,
clean geometry, minimal detail, soft matte finish, no background,
centered, game asset style, isometric view
```

**랜드마크용 (Landmark Prompt)**:
```
[건축물 영문], stylized miniature model, medium-poly,
subtle stone/metal texture, clean silhouette, recognizable shape,
warm natural lighting, no background, centered, architectural model style
```

### 5-3. 전체 프롬프트 목록

---

#### H. 선사시대

**H1. 주먹도끼** — `hand_axe.glb`
```
prehistoric hand axe, flint stone tool, teardrop shaped,
low-poly miniature style, flat shading, simple solid colors,
rough grey-brown stone surface, clean geometry, minimal detail,
no background, centered, game asset style
```

**H2. 토기** — `simple_pot.glb`
```
neolithic clay pot, simple round pottery with no decoration,
low-poly miniature style, flat shading, warm terracotta color,
clean geometry, minimal detail, soft matte finish,
no background, centered, game asset style
```

**H3. 청동 도끼** — `bronze_axe.glb`
```
bronze age axe, short wooden handle with bronze blade,
low-poly miniature style, flat shading, bronze metallic color and brown wood,
clean geometry, minimal detail, no background, centered, game asset style
```

---

#### B. 전쟁/분쟁

**B1. 검과 방패** — `sword_shield.glb`
```
ancient sword and round shield crossed together,
low-poly miniature style, flat shading, silver blade and bronze shield,
clean geometry, minimal detail, soft matte finish,
no background, centered, game asset style
```

**B2. 활과 화살** — `bow_arrow.glb`
```
medieval longbow with single arrow, wooden bow with string,
low-poly miniature style, flat shading, brown wood tones,
clean geometry, minimal detail, no background, centered, game asset style
```

**B3. 대포** — `cannon.glb`
```
old cannon on wooden wheeled carriage, 16th century style,
low-poly miniature style, flat shading, dark iron barrel and brown wood,
clean geometry, minimal detail, no background, centered, game asset style
```

**B4. 소총** — `rifle.glb`
```
19th century military rifle, bolt action, wooden stock,
low-poly miniature style, flat shading, dark metal and brown wood,
clean geometry, minimal detail, no background, centered, game asset style
```

**B5. 미사일 기지** — `missile_base.glb`
```
military missile launcher on platform, single upright missile,
low-poly miniature style, flat shading, military green and grey,
clean geometry, minimal detail, no background, centered, game asset style
```

---

#### C. 혁명/봉기

**C1. 주먹과 깃발** — `revolution_fist_flag.glb`
```
raised clenched fist holding a waving flag on a pole,
low-poly miniature style, flat shading, stone grey fist and red flag,
clean geometry, minimal detail, powerful upward pose,
no background, centered, game asset style
```

---

#### D. 인물/문화

**D1. 대리석 흉상** — `marble_bust.glb`
```
classical marble bust sculpture on small pedestal, generic male figure,
low-poly miniature style, flat shading, white marble color,
clean geometry, minimal detail, Roman/Greek style,
no background, centered, game asset style
```

---

#### E. 과학/발명

**E1. 파피루스 두루마리** — `papyrus_scroll.glb`
```
ancient papyrus scroll partially unrolled,
low-poly miniature style, flat shading, aged yellow-beige color,
clean geometry, minimal detail, no background, centered, game asset style
```

**E2. 고서** — `old_book.glb`
```
thick old leather-bound book, slightly open, medieval style,
low-poly miniature style, flat shading, dark brown leather cover,
clean geometry, minimal detail, no background, centered, game asset style
```

**E3. 톱니바퀴** — `cogwheel.glb`
```
industrial cogwheel gear, single large metallic gear with teeth,
low-poly miniature style, flat shading, iron grey metallic color,
clean geometry, minimal detail, no background, centered, game asset style
```

**E4. 원자 모형** — `atom_model.glb`
```
atom model with nucleus and three electron orbits,
low-poly miniature style, flat shading, blue orbits and red nucleus,
clean geometry, minimal detail, scientific model style,
no background, centered, game asset style
```

**E5. 컴퓨터 칩** — `computer_chip.glb`
```
computer microchip processor, square chip with pins,
low-poly miniature style, flat shading, dark green PCB with gold pins,
clean geometry, minimal detail, no background, centered, game asset style
```

---

#### F. 정치/사회

**F1. 두루마리 문서** — `scroll_document.glb`
```
official scroll document with wax seal, partially unrolled parchment,
low-poly miniature style, flat shading, cream parchment with red wax seal,
clean geometry, minimal detail, no background, centered, game asset style
```

---

#### G. 건국/수립

**G1. 국새/옥새** — `royal_seal.glb`
```
royal seal stamp, ornate handle on square base, official government seal,
low-poly miniature style, flat shading, gold and jade green colors,
clean geometry, minimal detail, no background, centered, game asset style
```

**G2. 국기** — `national_flag.glb`
```
flag on a pole waving in wind, simple tricolor design,
low-poly miniature style, flat shading, vibrant flag colors,
clean geometry, minimal detail, no background, centered, game asset style
```

---

#### A. 랜드마크 (Medium-poly)

**A1. 기자 피라미드** — `pyramid_giza.glb`
```
Great Pyramid of Giza, ancient Egyptian pyramid,
stylized miniature model, medium-poly, subtle sandstone texture,
clean silhouette, warm desert colors, sandy beige stone blocks,
no background, centered, architectural model style
```

**A2. 스핑크스** — `sphinx.glb`
```
Great Sphinx of Giza, lion body with human head,
stylized miniature model, medium-poly, subtle sandstone texture,
clean silhouette, warm sandy beige color,
no background, centered, architectural model style
```

**A3. 파르테논 신전** — `parthenon.glb`
```
Parthenon temple Athens, Greek columns and pediment,
stylized miniature model, medium-poly, white marble texture,
clean silhouette, classical Greek architecture,
no background, centered, architectural model style
```

**A4. 콜로세움** — `colosseum.glb`
```
Roman Colosseum, oval amphitheater with arched tiers,
stylized miniature model, medium-poly, aged stone texture,
clean silhouette, warm beige-grey stone color,
no background, centered, architectural model style
```

**A5. 만리장성** — `great_wall.glb`
```
Great Wall of China section with watchtower, winding wall segment,
stylized miniature model, medium-poly, grey stone brick texture,
clean silhouette, mountain wall section,
no background, centered, architectural model style
```

**A6. 앙코르와트** — `angkor_wat.glb`
```
Angkor Wat temple, Cambodian temple with five towers,
stylized miniature model, medium-poly, aged grey stone texture,
clean silhouette, iconic tower profile,
no background, centered, architectural model style
```

**A7. 마추픽추** — `machu_picchu.glb`
```
Machu Picchu ruins, Inca stone terraces and buildings on mountain,
stylized miniature model, medium-poly, grey stone with green grass,
clean silhouette, terraced mountain city,
no background, centered, architectural model style
```

**A8. 타지마할** — `taj_mahal.glb`
```
Taj Mahal, white marble mausoleum with central dome and four minarets,
stylized miniature model, medium-poly, white marble with subtle detail,
clean silhouette, symmetrical design,
no background, centered, architectural model style
```

**A9. 노트르담 대성당** — `notre_dame.glb`
```
Notre-Dame Cathedral Paris, Gothic cathedral with twin towers and spire,
stylized miniature model, medium-poly, grey stone texture,
clean silhouette, Gothic architecture,
no background, centered, architectural model style
```

**A10. 피사의 사탑** — `leaning_tower_pisa.glb`
```
Leaning Tower of Pisa, tilted white marble tower with arched galleries,
stylized miniature model, medium-poly, white marble texture,
clean silhouette, characteristic tilt angle,
no background, centered, architectural model style
```

**A11. 모아이 석상** — `moai.glb`
```
Easter Island Moai statue, single large stone head figure,
stylized miniature model, medium-poly, dark grey volcanic stone,
clean silhouette, iconic elongated face,
no background, centered, architectural model style
```

**A12. 개선문** — `arc_de_triomphe.glb`
```
Arc de Triomphe Paris, monumental arch with relief sculptures,
stylized miniature model, medium-poly, light grey stone texture,
clean silhouette, neoclassical arch,
no background, centered, architectural model style
```

**A13. 에펠탑** — `eiffel_tower.glb`
```
Eiffel Tower Paris, iron lattice tower,
stylized miniature model, medium-poly, dark iron grey metallic,
clean silhouette, iconic tapered shape with observation decks,
no background, centered, architectural model style
```

**A14. 자유의 여신상** — `statue_of_liberty.glb`
```
Statue of Liberty New York, figure holding torch and tablet on pedestal,
stylized miniature model, medium-poly, copper green patina color,
clean silhouette, recognizable pose with crown,
no background, centered, architectural model style
```

**A15. 빅벤** — `big_ben.glb`
```
Big Ben clock tower London, Elizabeth Tower with clock faces,
stylized miniature model, medium-poly, golden stone and dark roof,
clean silhouette, Gothic Revival style,
no background, centered, architectural model style
```

**A16. 브란덴부르크 문** — `brandenburg_gate.glb`
```
Brandenburg Gate Berlin, neoclassical gate with columns and quadriga on top,
stylized miniature model, medium-poly, light sandstone texture,
clean silhouette, six columns with chariot sculpture,
no background, centered, architectural model style
```

**A17. 엠파이어스테이트 빌딩** — `empire_state.glb`
```
Empire State Building New York, Art Deco skyscraper with antenna spire,
stylized miniature model, medium-poly, grey concrete and steel,
clean silhouette, iconic stepped setback design,
no background, centered, architectural model style
```

**A18. 시드니 오페라하우스** — `sydney_opera.glb`
```
Sydney Opera House, white shell-shaped roof sections,
stylized miniature model, medium-poly, bright white ceramic tiles,
clean silhouette, distinctive sail-shaped shells,
no background, centered, architectural model style
```

**A19. 부르즈 할리파** — `burj_khalifa.glb`
```
Burj Khalifa Dubai, super tall modern skyscraper with Y-shaped floor plan,
stylized miniature model, medium-poly, silver glass and steel,
clean silhouette, tapering needle shape,
no background, centered, architectural model style
```

**A20. 크렘린궁** — `kremlin.glb`
```
Moscow Kremlin, red brick fortress with towers and green onion domes,
stylized miniature model, medium-poly, red brick and green dome colors,
clean silhouette, iconic star-topped tower,
no background, centered, architectural model style
```

---

## 6. 생성 작업 순서 추천

1단계: 우선 테스트 (3개)
- 대포 (B3) — 가장 단순한 형태, 스타일 기준 잡기
- 기자 피라미드 (A1) — 랜드마크 기준 잡기
- 대리석 흉상 (D1) — 인물 기준 잡기

2단계: 나머지 일반 모델 (15개)
- 전쟁 4개 + 혁명 1개 + 과학 5개 + 정치 1개 + 건국 2개 + 선사 3개 - 1(테스트)

3단계: 나머지 랜드마크 (19개)

> 1단계에서 스타일이 확정되면 나머지는 같은 프롬프트 패턴으로 빠르게 생성 가능

---

## 7. 총 모델 수 요약

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
