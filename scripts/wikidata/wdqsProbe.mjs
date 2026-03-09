import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { config } from "./config.mjs";
import { buildPersonCandidateQuery, assertPersonCandidateOptions } from "./personCandidateQuery.mjs";
import { logError, logInfo } from "./logger.mjs";

const execFileAsync = promisify(execFile);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    offset: 0,
    minSitelinks: 100,
    maxSitelinks: null,
    sourceLang: "ko",
    transportTimeoutMs: 8000,
    shapeTimeoutMs: 25000,
    safeLimit: 5,
    normalLimit: 10,
    burstLimit: 20,
    burstTransportMs: 2500,
    burstShapeMs: 12000,
    normalShapeMs: 30000,
    reportFile: "",
    appendLogFile: "",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--offset") parsed.offset = Number(args[i + 1]);
    if (arg === "--min-sitelinks") parsed.minSitelinks = Number(args[i + 1]);
    if (arg === "--max-sitelinks") parsed.maxSitelinks = Number(args[i + 1]);
    if (arg === "--source-lang") parsed.sourceLang = args[i + 1];
    if (arg === "--transport-timeout-ms") parsed.transportTimeoutMs = Number(args[i + 1]);
    if (arg === "--shape-timeout-ms") parsed.shapeTimeoutMs = Number(args[i + 1]);
    if (arg === "--safe-limit") parsed.safeLimit = Number(args[i + 1]);
    if (arg === "--normal-limit") parsed.normalLimit = Number(args[i + 1]);
    if (arg === "--burst-limit") parsed.burstLimit = Number(args[i + 1]);
    if (arg === "--burst-transport-ms") parsed.burstTransportMs = Number(args[i + 1]);
    if (arg === "--burst-shape-ms") parsed.burstShapeMs = Number(args[i + 1]);
    if (arg === "--normal-shape-ms") parsed.normalShapeMs = Number(args[i + 1]);
    if (arg === "--report-file") parsed.reportFile = args[i + 1];
    if (arg === "--append-log-file") parsed.appendLogFile = args[i + 1];
  }

  assertPersonCandidateOptions(parsed);
  return parsed;
}

function buildProbeComment(name) {
  return `# wdqs-probe ${name} ${Date.now()}`;
}

function withProbeComment(query, name) {
  return `${buildProbeComment(name)}\n${query}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldUseCurlFallback(error) {
  const message = String(error);
  return message.includes("fetch failed") || message.includes("AbortError");
}

async function runCurlQuery(query, timeoutMs) {
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-sS",
      "-G",
      config.wdqsEndpoint,
      "--data-urlencode",
      "format=json",
      "--data-urlencode",
      `query=${query}`,
      "-H",
      "Accept: application/sparql-results+json",
      "-H",
      "User-Agent: TimeGlobeDataPipeline/0.1 (contact: local-dev)",
      "--max-time",
      String(timeoutSeconds),
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function getResultSize(json) {
  if (typeof json?.boolean === "boolean") {
    return json.boolean ? 1 : 0;
  }
  return Array.isArray(json?.results?.bindings) ? json.results.bindings.length : 0;
}

async function runSingleProbeQuery(query, timeoutMs) {
  const startedAt = Date.now();
  try {
    const url = `${config.wdqsEndpoint}?format=json&query=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "TimeGlobeDataPipeline/0.1 (contact: local-dev)",
        },
      },
      timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WDQS ${response.status}: ${text.slice(0, 240)}`);
    }

    const json = await response.json();
    return {
      ok: true,
      via: "fetch",
      latencyMs: Date.now() - startedAt,
      resultSize: getResultSize(json),
    };
  } catch (error) {
    if (shouldUseCurlFallback(error)) {
      try {
        const json = await runCurlQuery(query, timeoutMs);
        return {
          ok: true,
          via: "curl",
          latencyMs: Date.now() - startedAt,
          resultSize: getResultSize(json),
        };
      } catch (curlError) {
        return {
          ok: false,
          via: "curl",
          latencyMs: Date.now() - startedAt,
          error: String(curlError),
        };
      }
    }

    return {
      ok: false,
      via: "fetch",
      latencyMs: Date.now() - startedAt,
      error: String(error),
    };
  }
}

function classifyProbeResult(transport, shape, options) {
  if (
    transport.ok &&
    shape.ok &&
    transport.latencyMs <= options.burstTransportMs &&
    shape.latencyMs <= options.burstShapeMs
  ) {
    return {
      profile: "burst",
      recommendedLimit: options.burstLimit,
      reason: "transport and shape are both fast",
    };
  }

  if (
    transport.ok &&
    shape.ok &&
    shape.latencyMs <= options.normalShapeMs
  ) {
    return {
      profile: "normal",
      recommendedLimit: options.normalLimit,
      reason: "shape query is stable",
    };
  }

  if (transport.ok || shape.ok) {
    return {
      profile: "safe",
      recommendedLimit: options.safeLimit,
      reason: shape.ok ? "shape query is slow but successful" : "transport is alive but shape query is unstable",
    };
  }

  return {
    profile: "pause",
    recommendedLimit: 0,
    reason: "transport and shape probes both failed",
  };
}

async function appendProbeLog(filePath, payload) {
  if (!filePath) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

export async function runWdqsProbe(options) {
  const normalized = {
    offset: Number(options.offset ?? 0),
    minSitelinks: Number(options.minSitelinks ?? 100),
    maxSitelinks: typeof options.maxSitelinks === "number" ? options.maxSitelinks : null,
    sourceLang: options.sourceLang ?? "ko",
    transportTimeoutMs: Number(options.transportTimeoutMs ?? 8000),
    shapeTimeoutMs: Number(options.shapeTimeoutMs ?? 25000),
    safeLimit: Number(options.safeLimit ?? 5),
    normalLimit: Number(options.normalLimit ?? 10),
    burstLimit: Number(options.burstLimit ?? 20),
    burstTransportMs: Number(options.burstTransportMs ?? 2500),
    burstShapeMs: Number(options.burstShapeMs ?? 12000),
    normalShapeMs: Number(options.normalShapeMs ?? 30000),
    reportFile: options.reportFile ?? "",
    appendLogFile: options.appendLogFile ?? "",
  };
  assertPersonCandidateOptions(normalized);

  const transportQuery = withProbeComment(
    "ASK { wd:Q42 wdt:P31 wd:Q5 }",
    "transport",
  );
  const shapeQuery = withProbeComment(
    buildPersonCandidateQuery({
      limit: 1,
      offset: normalized.offset,
      minSitelinks: normalized.minSitelinks,
      maxSitelinks: normalized.maxSitelinks,
      sourceLang: normalized.sourceLang,
    }),
    "person-shape",
  );

  const transport = await runSingleProbeQuery(
    transportQuery,
    normalized.transportTimeoutMs,
  );
  await sleep(200);
  const shape = await runSingleProbeQuery(shapeQuery, normalized.shapeTimeoutMs);
  const decision = classifyProbeResult(transport, shape, normalized);

  const payload = {
    generatedAt: new Date().toISOString(),
    type: "wdqs_probe",
    options: normalized,
    transport,
    shape,
    decision,
  };

  if (normalized.reportFile) {
    await fs.mkdir(path.dirname(normalized.reportFile), { recursive: true });
    await fs.writeFile(normalized.reportFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
  await appendProbeLog(normalized.appendLogFile, payload);

  return payload;
}

async function main() {
  const options = parseArgs();
  const result = await runWdqsProbe(options);
  logInfo("WDQS probe finished", result);
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  main().catch((error) => {
    logError("wdqsProbe failed", { error: String(error) });
    process.exit(1);
  });
}
