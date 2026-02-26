-- TimeGlobe migration: source tracking + public event read policy
-- Created by: co (2026-02-25)

-- 1) Source tracking table for Wikidata loader (upsert key: event_id)
CREATE TABLE IF NOT EXISTS public.event_sources (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    qid TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    ko_wiki_title TEXT,
    en_wiki_title TEXT,
    description JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_sources_qid ON public.event_sources(qid);
CREATE INDEX IF NOT EXISTS idx_event_sources_entity_type ON public.event_sources(entity_type);

-- 2) data-check page uses anon key, so events needs a public read policy.
GRANT SELECT ON TABLE public.events TO anon, authenticated;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'events'
          AND policyname = 'events_public_read'
    ) THEN
        CREATE POLICY events_public_read
        ON public.events
        FOR SELECT
        USING (true);
    END IF;
END
$$;

-- 3) event_sources is internal metadata. Keep RLS enabled and rely on service role.
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;
