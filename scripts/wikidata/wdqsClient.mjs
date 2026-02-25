import { config } from "./config.mjs";
import { logWarn } from "./logger.mjs";

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
      lastError = error;
      if (attempt === config.maxRetries) {
        break;
      }
      const delay = config.baseDelayMs * 2 ** attempt;
      logWarn("WDQS request failed. Retrying...", {
        attempt: attempt + 1,
        delayMs: delay,
        error: String(error),
      });
      await sleep(delay);
    }
  }
  throw lastError;
}
