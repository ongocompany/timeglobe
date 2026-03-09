import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { logError, logInfo, logWarn } from "./logger.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    batchCount: 4,
    sleepMs: 1000,
    maxBatchAttempts: 3,
    batchRetryDelayMs: 15000,
    probePauseMs: 60000,
    maxPauseCycles: 6,
    safeLimit: 5,
    normalLimit: 10,
    burstLimit: 20,
    minSitelinks: 100,
    maxSitelinks: 1000,
    sourceLang: "ko",
    stateFile: path.join(process.cwd(), ".cache", "person-candidates-ko-low-state.json"),
    reportDir: path.join(process.cwd(), ".cache", "person-candidate-batches", "ko-low"),
    probeLogFile: path.join(process.cwd(), ".cache", "wdqs-probe-history.jsonl"),
    lockDir: path.join(process.cwd(), ".cache", "person-candidates-adaptive-job.lock"),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--batch-count") parsed.batchCount = Number(args[i + 1]);
    if (arg === "--sleep-ms") parsed.sleepMs = Number(args[i + 1]);
    if (arg === "--max-batch-attempts") parsed.maxBatchAttempts = Number(args[i + 1]);
    if (arg === "--batch-retry-delay-ms") parsed.batchRetryDelayMs = Number(args[i + 1]);
    if (arg === "--probe-pause-ms") parsed.probePauseMs = Number(args[i + 1]);
    if (arg === "--max-pause-cycles") parsed.maxPauseCycles = Number(args[i + 1]);
    if (arg === "--safe-limit") parsed.safeLimit = Number(args[i + 1]);
    if (arg === "--normal-limit") parsed.normalLimit = Number(args[i + 1]);
    if (arg === "--burst-limit") parsed.burstLimit = Number(args[i + 1]);
    if (arg === "--min-sitelinks") parsed.minSitelinks = Number(args[i + 1]);
    if (arg === "--max-sitelinks") parsed.maxSitelinks = Number(args[i + 1]);
    if (arg === "--source-lang") parsed.sourceLang = args[i + 1];
    if (arg === "--state-file") parsed.stateFile = args[i + 1];
    if (arg === "--report-dir") parsed.reportDir = args[i + 1];
    if (arg === "--probe-log-file") parsed.probeLogFile = args[i + 1];
    if (arg === "--lock-dir") parsed.lockDir = args[i + 1];
  }

  if (!["ko", "en", "both"].includes(parsed.sourceLang)) {
    throw new Error(`Invalid --source-lang: ${parsed.sourceLang}`);
  }

  return parsed;
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock(lockDir) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.mkdir(lockDir);
      const owner = {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        cwd: process.cwd(),
      };
      await fs.writeFile(
        path.join(lockDir, "owner.json"),
        `${JSON.stringify(owner, null, 2)}\n`,
        "utf8",
      );
      return { acquired: true, owner };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      const ownerPath = path.join(lockDir, "owner.json");
      const existing = await readJson(ownerPath);
      if (existing?.pid && isPidAlive(Number(existing.pid))) {
        return { acquired: false, existing };
      }

      logWarn("Found stale adaptive lock. Removing it.", {
        lockDir,
        existing,
      });
      await fs.rm(lockDir, { recursive: true, force: true });
    }
  }

  throw new Error(`Failed to acquire lock: ${lockDir}`);
}

async function releaseLock(lockDir) {
  await fs.rm(lockDir, { recursive: true, force: true });
}

function buildChildEnv() {
  return {
    ...process.env,
    WDQS_TIMEOUT_MS: process.env.WDQS_TIMEOUT_MS ?? "90000",
    WDQS_MAX_RETRIES: process.env.WDQS_MAX_RETRIES ?? "3",
    WDQS_BASE_DELAY_MS: process.env.WDQS_BASE_DELAY_MS ?? "2000",
    WDQS_REQUEST_DELAY_MS: process.env.WDQS_REQUEST_DELAY_MS ?? "1200",
  };
}

function buildBatchArgs(options) {
  return [
    path.join(process.cwd(), "scripts", "wikidata", "runPersonCandidateBatches.mjs"),
    "--resume",
    "--batch-count",
    String(options.batchCount),
    "--adaptive",
    "--safe-limit",
    String(options.safeLimit),
    "--normal-limit",
    String(options.normalLimit),
    "--burst-limit",
    String(options.burstLimit),
    "--min-sitelinks",
    String(options.minSitelinks),
    "--max-sitelinks",
    String(options.maxSitelinks),
    "--source-lang",
    options.sourceLang,
    "--sleep-ms",
    String(options.sleepMs),
    "--max-batch-attempts",
    String(options.maxBatchAttempts),
    "--batch-retry-delay-ms",
    String(options.batchRetryDelayMs),
    "--probe-pause-ms",
    String(options.probePauseMs),
    "--max-pause-cycles",
    String(options.maxPauseCycles),
    "--probe-log-file",
    options.probeLogFile,
    "--state-file",
    options.stateFile,
    "--report-dir",
    options.reportDir,
  ];
}

async function runChild(options) {
  const args = buildBatchArgs(options);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: buildChildEnv(),
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Adaptive batch job exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs();

  if (options.batchCount <= 0) {
    logInfo("Skipping adaptive batch job because batchCount <= 0", {
      batchCount: options.batchCount,
    });
    return;
  }

  const lock = await acquireLock(options.lockDir);
  if (!lock.acquired) {
    logInfo("Adaptive batch job is already running. Exiting without overlap.", {
      lockDir: options.lockDir,
      existing: lock.existing,
    });
    return;
  }

  logInfo("Adaptive batch job acquired lock", {
    lockDir: options.lockDir,
    owner: lock.owner,
    batchCount: options.batchCount,
  });

  try {
    await runChild(options);
  } finally {
    await releaseLock(options.lockDir);
    logInfo("Adaptive batch job released lock", {
      lockDir: options.lockDir,
    });
  }
}

main().catch((error) => {
  logError("runAdaptivePersonCandidatesOnce failed", { error: String(error) });
  process.exit(1);
});
