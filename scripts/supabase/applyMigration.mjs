import fs from "node:fs/promises";
import path from "node:path";

function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") return;

  for (const candidate of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(candidate);
    } catch {
      // Ignore missing env files.
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    file: "",
    projectRef: "",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--file") parsed.file = args[i + 1] ?? "";
    if (arg === "--project-ref") parsed.projectRef = args[i + 1] ?? "";
  }

  if (!parsed.file && args[0] && !args[0].startsWith("--")) {
    parsed.file = args[0];
  }

  return parsed;
}

function inferProjectRef(supabaseUrl) {
  if (!supabaseUrl) return "";
  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/);
  return match?.[1] ?? "";
}

function requireEnv(value, name, hint) {
  if (value) return value;
  const suffix = hint ? ` ${hint}` : "";
  throw new Error(`Missing ${name}.${suffix}`.trim());
}

async function main() {
  loadLocalEnv();

  const options = parseArgs();
  const filePath = requireEnv(
    options.file,
    "--file",
    "Example: npm run supabase:apply-migration -- supabase/migrations/20260228170000_person_candidates.sql",
  );
  const accessToken = requireEnv(
    process.env.SUPABASE_ACCESS_TOKEN,
    "SUPABASE_ACCESS_TOKEN",
    "Create a personal access token in Supabase and export it before running this script.",
  );
  const projectRef = requireEnv(
    options.projectRef || process.env.SUPABASE_PROJECT_REF || inferProjectRef(process.env.SUPABASE_URL || ""),
    "SUPABASE_PROJECT_REF",
    "Pass --project-ref or set SUPABASE_URL so the project ref can be derived automatically.",
  );

  const sql = await fs.readFile(path.resolve(filePath), "utf8");
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();
  const body = text.trim() ? text.slice(0, 2000) : "(empty)";

  console.log(JSON.stringify({
    projectRef,
    file: path.resolve(filePath),
    status: response.status,
    body,
  }, null, 2));

  if (!response.ok) {
    throw new Error(`Supabase management API returned ${response.status}`);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
