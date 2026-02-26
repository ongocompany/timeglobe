-- TimeGlobe migration: classify low-data events for curation exclusion
-- Created by: co (2026-02-25)

CREATE TABLE IF NOT EXISTS public.event_gap_cases (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_score SMALLINT NOT NULL DEFAULT 0,
    is_excluded BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_gap_cases_missing_score
  ON public.event_gap_cases(missing_score);

CREATE INDEX IF NOT EXISTS idx_event_gap_cases_is_excluded
  ON public.event_gap_cases(is_excluded);

COMMENT ON TABLE public.event_gap_cases IS
  'Low-data events classified for curation exclusion.';
COMMENT ON COLUMN public.event_gap_cases.reasons IS
  'Array of gap reason codes. e.g. ["missing_summary","missing_image"]';
COMMENT ON COLUMN public.event_gap_cases.missing_score IS
  'Count of gap reason codes for prioritization.';

ALTER TABLE public.event_gap_cases ENABLE ROW LEVEL SECURITY;
