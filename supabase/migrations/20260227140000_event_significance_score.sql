-- [cl] 1) 좌표 nullable 변경 — 전쟁(war) 등 좌표 없는 이벤트 수집 지원
-- 기존 NOT NULL 제약을 풀어서 좌표 없이도 이벤트 적재 가능
-- AI Geocoder가 나중에 좌표를 채워넣음
ALTER TABLE public.events
  ALTER COLUMN location_lat DROP NOT NULL,
  ALTER COLUMN location_lng DROP NOT NULL;

-- [cl] 좌표 미보유 이벤트 필터용 인덱스
CREATE INDEX IF NOT EXISTS idx_events_needs_geocoding
  ON public.events(id) WHERE location_lat IS NULL;

-- [cl] 2) 역사적 중요도 점수 컬럼 추가
-- AI(Gemini)가 1~10 스케일로 역사적 중요도를 평가
-- 1=지역 소규모 충돌, 10=세계사를 바꾼 전투(적벽, 워털루 등)
-- null=미평가
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS significance_score SMALLINT;

ALTER TABLE public.events
  ADD CONSTRAINT chk_significance_score
  CHECK (significance_score IS NULL OR (significance_score >= 1 AND significance_score <= 10));

CREATE INDEX IF NOT EXISTS idx_events_significance_score
  ON public.events(significance_score);

COMMENT ON COLUMN public.events.significance_score IS
  'AI-assessed historical significance score (1-10). 1=minor local event, 10=world-changing event. null=not yet scored.';
