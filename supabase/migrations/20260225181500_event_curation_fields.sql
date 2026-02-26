-- TimeGlobe migration: event curation fields for battle default-hide workflow
-- Created by: co (2026-02-25)

-- 1) Event-level curation metadata
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_kind TEXT NOT NULL DEFAULT 'historical_event',
  ADD COLUMN IF NOT EXISTS is_battle BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_curated_visible BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_events_event_kind ON public.events(event_kind);
CREATE INDEX IF NOT EXISTS idx_events_is_battle ON public.events(is_battle);
CREATE INDEX IF NOT EXISTS idx_events_is_curated_visible ON public.events(is_curated_visible);

COMMENT ON COLUMN public.events.event_kind IS
  'Normalized event subtype from Wikidata class. e.g. battle, war, treaty, disaster, historical_event.';
COMMENT ON COLUMN public.events.is_battle IS
  'Pipeline-managed flag. true when source class is Wikidata battle (Q178561).';
COMMENT ON COLUMN public.events.is_curated_visible IS
  'Manual override for UI exposure. true=always show, false=always hide, null=follow default rule (hide battles, show others).';

-- 2) Source-level class metadata for curator traceability
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS class_qid TEXT,
  ADD COLUMN IF NOT EXISTS event_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_event_sources_class_qid ON public.event_sources(class_qid);
