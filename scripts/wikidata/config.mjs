import path from "node:path";

const cwd = process.cwd();

export const config = {
  wdqsEndpoint:
    process.env.WDQS_ENDPOINT ?? "https://query.wikidata.org/sparql",
  requestTimeoutMs: Number(process.env.WDQS_TIMEOUT_MS ?? 25000),
  maxRetries: Number(process.env.WDQS_MAX_RETRIES ?? 4),
  baseDelayMs: Number(process.env.WDQS_BASE_DELAY_MS ?? 1200),
  requestDelayMs: Number(process.env.WDQS_REQUEST_DELAY_MS ?? 900),
  pageSize: Number(process.env.WDQS_PAGE_SIZE ?? 200),
  chunkYears: Number(process.env.WDQS_CHUNK_YEARS ?? 50),
  languages: (process.env.WIKIDATA_LANGS ?? "ko,en")
    .split(",")
    .map((lang) => lang.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  checkpointPath:
    process.env.WIKIDATA_CHECKPOINT_PATH ??
    path.join(cwd, ".cache", "wikidata-checkpoint.json"),
  fetchWikipediaSummary: process.env.WIKIPEDIA_ENRICH === "true",
  yearFrom: Number(process.env.WIKIDATA_YEAR_FROM ?? 0),
  yearTo: Number(process.env.WIKIDATA_YEAR_TO ?? 1500),
};

export function requireDbEnv() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }
}
