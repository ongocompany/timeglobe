-- TimeGlobe migration: archive events that have no summary
-- Created by: co (2026-02-25)

CREATE TABLE IF NOT EXISTS public.event_summary_archive (
    event_id UUID PRIMARY KEY,
    qid TEXT,
    title JSONB NOT NULL,
    start_year INTEGER NOT NULL,
    event_kind TEXT,
    is_battle BOOLEAN,
    archived_reason TEXT NOT NULL DEFAULT 'missing_summary',
    event_payload JSONB NOT NULL,
    source_payload JSONB,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_summary_archive_start_year
  ON public.event_summary_archive(start_year);

CREATE INDEX IF NOT EXISTS idx_event_summary_archive_qid
  ON public.event_summary_archive(qid);

CREATE INDEX IF NOT EXISTS idx_event_summary_archive_archived_at
  ON public.event_summary_archive(archived_at DESC);

COMMENT ON TABLE public.event_summary_archive IS
  'Archived events removed from primary events dataset because summary is missing.';
COMMENT ON COLUMN public.event_summary_archive.event_payload IS
  'Full snapshot of original public.events row at archive time.';
COMMENT ON COLUMN public.event_summary_archive.source_payload IS
  'Snapshot of related public.event_sources row at archive time.';
COMMENT ON COLUMN public.event_summary_archive.archived_reason IS
  'Reason code for archival. default: missing_summary.';

ALTER TABLE public.event_summary_archive ENABLE ROW LEVEL SECURITY;

