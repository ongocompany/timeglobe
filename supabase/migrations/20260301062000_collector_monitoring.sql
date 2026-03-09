-- TimeGlobe migration: centralized worker heartbeat + batch run monitoring
-- Created by: co (2026-03-01)

CREATE TABLE IF NOT EXISTS public.collector_workers (
    worker_id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    process_count INTEGER NOT NULL DEFAULT 1,
    source_lang TEXT,
    min_sitelinks INTEGER,
    max_sitelinks INTEGER,
    current_offset INTEGER,
    next_offset INTEGER,
    completed_batches INTEGER NOT NULL DEFAULT 0,
    current_limit INTEGER,
    last_fetched_rows INTEGER,
    last_normalized_rows INTEGER,
    last_probe_profile TEXT,
    last_probe_shape_latency_ms INTEGER,
    last_report_file TEXT,
    last_error TEXT,
    last_batch_finished_at TIMESTAMP WITH TIME ZONE,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB,
    CONSTRAINT chk_collector_workers_status
      CHECK (status IN ('running', 'idle', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_collector_workers_status
  ON public.collector_workers(status);

CREATE INDEX IF NOT EXISTS idx_collector_workers_last_heartbeat
  ON public.collector_workers(last_heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS public.collector_batch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT NOT NULL,
    job_kind TEXT NOT NULL DEFAULT 'person_candidates',
    source_lang TEXT,
    min_sitelinks INTEGER,
    max_sitelinks INTEGER,
    offset_start INTEGER NOT NULL,
    offset_end INTEGER,
    batch_limit INTEGER,
    probe_profile TEXT,
    probe_shape_latency_ms INTEGER,
    fetched_rows INTEGER NOT NULL DEFAULT 0,
    normalized_rows INTEGER NOT NULL DEFAULT 0,
    with_anchor INTEGER,
    without_anchor INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    report_file TEXT,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    payload JSONB,
    CONSTRAINT fk_collector_batch_runs_worker
      FOREIGN KEY (worker_id) REFERENCES public.collector_workers(worker_id)
      ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collector_batch_runs_generated_at
  ON public.collector_batch_runs(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_collector_batch_runs_worker_id
  ON public.collector_batch_runs(worker_id, generated_at DESC);

COMMENT ON TABLE public.collector_workers IS
  'Central heartbeat table for long-running collectors running on Linux, macOS, or Windows hosts.';

COMMENT ON TABLE public.collector_batch_runs IS
  'Append-only batch execution summaries used for remote monitoring and fetch trend charts.';

ALTER TABLE public.collector_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_batch_runs ENABLE ROW LEVEL SECURITY;
