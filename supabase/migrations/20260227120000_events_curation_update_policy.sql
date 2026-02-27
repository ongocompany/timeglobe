-- [cl] 큐레이션 페이지에서 is_curated_visible 업데이트를 위한 RLS UPDATE 정책
-- anon/authenticated 모두 events 테이블 UPDATE 허용 (내부 도구 전용)
-- Created by: cl (2026-02-27)

GRANT UPDATE ON TABLE public.events TO anon, authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'events'
          AND policyname = 'events_curation_update'
    ) THEN
        CREATE POLICY events_curation_update
        ON public.events
        FOR UPDATE
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;
