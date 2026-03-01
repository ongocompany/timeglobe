import { config } from "./config.mjs";
import { logWarn } from "./logger.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

async function runCurlSparql(query) {
  const timeoutSeconds = Math.max(1, Math.ceil(config.requestTimeoutMs / 1000));
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

  const json = JSON.parse(stdout);
  return json.results?.bindings ?? [];
}

export async function runSparql(query) {
  let lastError = null;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      await sleep(config.requestDelayMs);
      const url = `${config.wdqsEndpoint}?query=${encodeURIComponent(query)}`;
      const response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": "TimeGlobeDataPipeline/0.1 (contact: local-dev)",
          },
        },
        config.requestTimeoutMs,
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`WDQS ${response.status}: ${text.slice(0, 240)}`);
      }

      const json = await response.json();
      return json.results?.bindings ?? [];
    } catch (error) {
      let retryError = error;
      if (shouldUseCurlFallback(error)) {
        try {
          logWarn("WDQS fetch transport failed. Falling back to curl.", {
            attempt: attempt + 1,
            error: String(error),
          });
          return await runCurlSparql(query);
        } catch (curlError) {
          retryError = curlError;
        }
      }

      lastError = retryError;
      if (attempt === config.maxRetries) {
        break;
      }
      const delay = config.baseDelayMs * 2 ** attempt;
      logWarn("WDQS request failed. Retrying...", {
        attempt: attempt + 1,
        delayMs: delay,
        error: String(retryError),
      });
      await sleep(delay);
    }
  }
  throw lastError;
}
