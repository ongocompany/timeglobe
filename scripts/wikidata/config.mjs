import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envFiles = [".env", ".env.local"].map((name) => path.join(cwd, name));

for (const filePath of envFiles) {
  if (fs.existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}

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
  requireDetail: process.env.WIKIDATA_REQUIRE_DETAIL !== "false",
  requireSummary: process.env.WIKIDATA_REQUIRE_SUMMARY === "true",
  minDetailScore: Number(process.env.WIKIDATA_MIN_DETAIL_SCORE ?? 1),
  yearFrom: Number(process.env.WIKIDATA_YEAR_FROM ?? 0),
  yearTo: Number(process.env.WIKIDATA_YEAR_TO ?? 1500),
};

export function requireDbEnv() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}. Add them to .env.local.`,
    );
  }
}
