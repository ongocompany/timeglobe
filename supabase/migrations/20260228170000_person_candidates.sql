-- TimeGlobe migration: person candidate queue for no-anchor or low-confidence people
-- Created by: co (2026-02-28)

CREATE TABLE IF NOT EXISTS public.person_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qid TEXT NOT NULL UNIQUE,
    title JSONB NOT NULL,
    description JSONB,
    birth_year INTEGER,
    death_year INTEGER,
    floruit_start_year INTEGER,
    floruit_end_year INTEGER,
    anchor_year INTEGER,
    anchor_type TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    modern_country JSONB,
    external_link TEXT,
    ko_wiki_title TEXT,
    en_wiki_title TEXT,
    sitelinks_count INTEGER NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'pending',
    review_reason TEXT,
    review_confidence SMALLINT,
    source_payload JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_person_candidates_review_status
      CHECK (review_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_person_candidates_review_confidence
      CHECK (
        review_confidence IS NULL OR
        (review_confidence >= 0 AND review_confidence <= 100)
      )
);

CREATE INDEX IF NOT EXISTS idx_person_candidates_anchor_year
  ON public.person_candidates(anchor_year);

CREATE INDEX IF NOT EXISTS idx_person_candidates_review_status
  ON public.person_candidates(review_status);

CREATE INDEX IF NOT EXISTS idx_person_candidates_sitelinks_count
  ON public.person_candidates(sitelinks_count DESC);

COMMENT ON TABLE public.person_candidates IS
  'Staging queue for person entities that may be important but are not ready for main timeline ingestion.';

COMMENT ON COLUMN public.person_candidates.anchor_year IS
  'Best-effort timeline anchor from birth/death/floruit signals. Null means candidate-only until curation.';

COMMENT ON COLUMN public.person_candidates.anchor_type IS
  'Source of anchor_year. e.g. birth, death, floruit_start, floruit_end.';

COMMENT ON COLUMN public.person_candidates.sitelinks_count IS
  'Wikidata sitelinks count used as a rough popularity/notability proxy for candidate prioritization.';

COMMENT ON COLUMN public.person_candidates.review_status IS
  'Curation workflow state. pending=unreviewed, approved=ready for promotion, rejected=discarded.';

ALTER TABLE public.person_candidates ENABLE ROW LEVEL SECURITY;
