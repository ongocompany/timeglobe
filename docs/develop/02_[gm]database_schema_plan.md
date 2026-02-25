# TimeGlobe 데이터베이스 스키마 최종 설계안

본 문서는 `gemini.md.md`의 초기 기획을 바탕으로, **도감 및 퀴즈 기능**, **레벨링 시스템(travel_tokens)**, 그리고 **다국어 지원(JSONB)** 요구사항을 모두 통합하여 설계된 Supabase 기반의 최종 데이터베이스 스키마입니다.

---

## 1. 시대 및 이벤트 핵심 데이터 (Core Data)

`Globe.gl` 렌더링 및 타임라인 구성을 위한 메인 데이터입니다.

### 1-1. `Eras` (시대 정보)
특정 시기(예: 삼국시대, 로마제국 시대 등)의 큰 범위를 정의합니다.
* `id` : `uuid` (Primary Key)
* `name` : `jsonb` (다국어 시대명, 예: `{"ko": "조선", "en": "Joseon"}`)
* `start_year` : `integer` (기원전은 음수로 표현, 예: BC 2333 -> -2333)
* `end_year` : `integer` (종료 연도)
* `description` : `jsonb` (선택적 다국어 요약 설명)
* `bgm_url` : `text` (몰입감 강화를 위한 배경음악 URL 저장 여부)
* `created_at` : `timestamp with time zone`

### 1-2. `Events` (마커 & 팝업 모달)
팝업 모달 구성 요소(제목, 요약, 이미지, 현재 위치, 링크 등)를 포함하여 지도 위에 그려지는 이벤트 마커입니다.
* `id` : `uuid` (Primary Key)
* `era_id` : `uuid` (Foreign Key -> `Eras.id`, 선택적 매핑 가능)
* `title` : `jsonb` (다국어 이벤트명)
* `start_year` : `integer` (발생 연도)
* `end_year` : `integer` (종료 기간이 있는 이벤트 시 사용, nullable)
* `category` : `text` (정치/전쟁, 인물/문화, 과학/발명, 건축/유물, 자연재해/지질 등)
* `location_lat` : `double precision` (위도)
* `location_lng` : `double precision` (경도)
* `is_fog_region` : `boolean` (Default: `false` - 불명확한 지역: 안개/히트맵 표현 여부 플래그)
* `historical_region` : `jsonb` (다국어 당시 국가/지역명, 예: `{"ko": "조선", "en": "Joseon Dynasty"}`)
* `modern_country` : `jsonb` (다국어 현재 기준의 국가/지역명)
* `image_url` : `text` (대표 이미지 URL)
* `importance` : `smallint` (Default: `5`, range 1~10 — 마커 표시 우선순위. 타임 윈도우 필터링 시 카메라 줌 레벨과 결합하여 `importance >= threshold` 조건으로 렌더 이벤트 제어. 10=필수 랜드마크, 1=희귀 보조 이벤트)
* `summary` : `jsonb` (다국어 핵심 요약 2~3줄 — orbit 카드 프리뷰용)
* `description` : `jsonb` (다국어 상세 본문 설명 — 모달 펼침 시 표시, 분량 제한 없음)
* `external_link` : `text` (나무위키 등 외부 링크 버튼을 위한 URL)
* `created_at` : `timestamp with time zone`

### 1-3. `EventRelations` (관련 이벤트 배열)
모달 하단 "관련 시대 이벤트 추천" 기능 제공을 위한 다대다 연결 테이블
* `source_event_id` : `uuid` (Foreign Key -> `Events.id`)
* `target_event_id` : `uuid` (Foreign Key -> `Events.id`)
* Primary Key : `(source_event_id, target_event_id)`

---

## 2. 공간/시각 데이터 (Spatial Data)

### 2-1. `Borders` (시대별 마커 및 국경선)
`Globe.gl`에 그려질 3D 폴리곤 형태의 국경 데이터입니다. 
* `id` : `uuid` (Primary Key)
* `era_id` : `uuid` (Foreign Key -> `Eras.id`, 어떤 시대의 어느 국가 국경인지 연동)
* `name` : `jsonb` (다국어 제국 / 국가명)
* `geojson_data` : `jsonb` (GeoJSON 데이터 객체 전체 저장)
* `created_at` : `timestamp with time zone`

---

## 3. 사용자 및 게이미피케이션 (Users & Gamification)

Freemium 모델 처리, 자녀/학부모 진척도 확인 및 유저 레벨링 시스템 용도입니다.

### 3-1. `Users` (퍼블릭 유저 정보)
Supabase Auth의 `auth.users`와 1:1 매핑되는 프로필 테이블.
* `id` : `uuid` (Primary Key, Foreign Key -> `auth.users.id`)
* `username` : `text` (닉네임)
* `is_premium` : `boolean` (Time-Travel Pass 결제 여부 플래그, Default `false`)
* `travel_tokens` : `integer` (Default `0`, 퀴즈 성공이나 탐험 등을 통해 획득하는 재화. 기획된 '초보 타임트래블러' -> '타임로드(시간의 정복자)' 레벨링 시스템의 기준값)
* `created_at` : `timestamp with time zone`

### 3-2. `UserProgress` (타임 트래블러 패스포트 - 마커 발견 도감)
어떤 마커(Event)를 클릭하여 도감을 획득했는지 기록합니다.
* `id` : `uuid` (Primary Key)
* `user_id` : `uuid` (Foreign Key -> `Users.id`)
* `event_id` : `uuid` (Foreign Key -> `Events.id`)
* `user_token` : `integer` (해당 도감을 획득할 때 발생/소모한 토큰 양이나 당시 보유 토큰)
* `user_level` : `text` (해당 시점의 유저 레벨 기록용)
* `acquired_at` : `timestamp with time zone`
* Unique Constraint : `(user_id, event_id)` (중복 획득 방지)

### 3-3. `Quizzes` (미니 퀴즈 문제 은행)
각 이벤트(마커)와 연관된 퀴즈 시스템
* `id` : `uuid` (Primary Key)
* `event_id` : `uuid` (Foreign Key -> `Events.id`)
* `question` : `jsonb` (다국어 질문 텍스트)
* `options` : `jsonb` (다국어 선택지 객체 배열, 예: `{"ko": ["고구려", "백제"], "en": ["Goguryeo", "Baekje"]}`)
* `correct_option_index` : `integer` (정답 배열 인덱스)
* `created_at` : `timestamp with time zone`

### 3-4. `UserQuizResults` (퀴즈 결과/진척도 기록)
이 테이블을 통해 '학습 진척도' 리포트를 시각화합니다.
* `id` : `uuid` (Primary Key)
* `user_id` : `uuid` (Foreign Key -> `Users.id`)
* `quiz_id` : `uuid` (Foreign Key -> `Quizzes.id`)
* `is_correct` : `boolean` (정답 여부)
* `solved_at` : `timestamp with time zone`
