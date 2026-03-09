import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { logError, logInfo, logWarn } from "./logger.mjs";
import { runWdqsProbe } from "./wdqsProbe.mjs";
import {
  publishCollectorBatchRun,
  publishCollectorHeartbeat,
  resolveWorkerIdentity,
} from "./workerMonitor.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    limit: 5,
    startOffset: 0,
    batchCount: 10,
    offsetStep: null,
    minSitelinks: 100,
    maxSitelinks: null,
    sourceLang: "ko",
    dryRun: false,
    stopOnEmpty: true,
    sleepMs: 1000,
    maxBatchAttempts: 3,
    batchRetryDelayMs: 15000,
    resume: false,
    adaptive: false,
    safeLimit: 5,
    normalLimit: 10,
    burstLimit: 20,
    probePauseMs: 60000,
    maxPauseCycles: 6,
    probeTransportTimeoutMs: 8000,
    probeShapeTimeoutMs: 25000,
    probeBurstTransportMs: 2500,
    probeBurstShapeMs: 12000,
    probeNormalShapeMs: 30000,
    probeLogFile: path.join(process.cwd(), ".cache", "wdqs-probe-history.jsonl"),
    reportDir: path.join(process.cwd(), ".cache", "person-candidate-batches"),
    stateFile: path.join(
      process.cwd(),
      ".cache",
      "person-candidate-batches-state.json",
    ),
    workerId: process.env.COLLECTOR_WORKER_ID ?? "",
    workerHost: process.env.COLLECTOR_WORKER_HOST ?? "",
    workerRole: process.env.COLLECTOR_WORKER_ROLE ?? "person_candidates",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit") parsed.limit = Number(args[i + 1]);
    if (arg === "--start-offset") parsed.startOffset = Number(args[i + 1]);
    if (arg === "--batch-count") parsed.batchCount = Number(args[i + 1]);
    if (arg === "--offset-step") parsed.offsetStep = Number(args[i + 1]);
    if (arg === "--min-sitelinks") parsed.minSitelinks = Number(args[i + 1]);
    if (arg === "--max-sitelinks") parsed.maxSitelinks = Number(args[i + 1]);
    if (arg === "--source-lang") parsed.sourceLang = args[i + 1];
    if (arg === "--sleep-ms") parsed.sleepMs = Number(args[i + 1]);
    if (arg === "--max-batch-attempts") parsed.maxBatchAttempts = Number(args[i + 1]);
    if (arg === "--batch-retry-delay-ms") parsed.batchRetryDelayMs = Number(args[i + 1]);
    if (arg === "--report-dir") parsed.reportDir = args[i + 1];
    if (arg === "--state-file") parsed.stateFile = args[i + 1];
    if (arg === "--safe-limit") parsed.safeLimit = Number(args[i + 1]);
    if (arg === "--normal-limit") parsed.normalLimit = Number(args[i + 1]);
    if (arg === "--burst-limit") parsed.burstLimit = Number(args[i + 1]);
    if (arg === "--probe-pause-ms") parsed.probePauseMs = Number(args[i + 1]);
    if (arg === "--max-pause-cycles") parsed.maxPauseCycles = Number(args[i + 1]);
    if (arg === "--probe-transport-timeout-ms") parsed.probeTransportTimeoutMs = Number(args[i + 1]);
    if (arg === "--probe-shape-timeout-ms") parsed.probeShapeTimeoutMs = Number(args[i + 1]);
    if (arg === "--probe-burst-transport-ms") parsed.probeBurstTransportMs = Number(args[i + 1]);
    if (arg === "--probe-burst-shape-ms") parsed.probeBurstShapeMs = Number(args[i + 1]);
    if (arg === "--probe-normal-shape-ms") parsed.probeNormalShapeMs = Number(args[i + 1]);
    if (arg === "--probe-log-file") parsed.probeLogFile = args[i + 1];
    if (arg === "--worker-id") parsed.workerId = args[i + 1];
    if (arg === "--worker-host") parsed.workerHost = args[i + 1];
    if (arg === "--worker-role") parsed.workerRole = args[i + 1];
    if (arg === "--dry-run") parsed.dryRun = true;
    if (arg === "--resume") parsed.resume = true;
    if (arg === "--adaptive") parsed.adaptive = true;
    if (arg === "--no-stop-on-empty") parsed.stopOnEmpty = false;
  }

  if (!["ko", "en", "both"].includes(parsed.sourceLang)) {
    throw new Error(`Invalid --source-lang: ${parsed.sourceLang}`);
  }

  if (!Number.isFinite(parsed.offsetStep)) {
    parsed.offsetStep = parsed.limit;
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureParentDirs(options) {
  await fs.mkdir(options.reportDir, { recursive: true });
  await fs.mkdir(path.dirname(options.stateFile), { recursive: true });
}

async function readState(stateFile) {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeState(stateFile, state) {
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function buildReportFile(reportDir, options, offset) {
  const max = typeof options.maxSitelinks === "number"
    ? options.maxSitelinks
    : "inf";
  const mode = options.dryRun ? "dry" : "live";
  return path.join(
    reportDir,
    `person-candidates-${options.sourceLang}-${options.minSitelinks}-${max}-offset${offset}-limit${options.limit}-${mode}.json`,
  );
}

function runSingleBatch(options, offset, reportFile) {
  const scriptPath = path.join(process.cwd(), "scripts", "wikidata", "collectPersonCandidates.mjs");
  const args = [
    scriptPath,
    "--limit",
    String(options.limit),
    "--offset",
    String(offset),
    "--min-sitelinks",
    String(options.minSitelinks),
    "--source-lang",
    options.sourceLang,
    "--report-file",
    reportFile,
  ];

  if (typeof options.maxSitelinks === "number") {
    args.push("--max-sitelinks", String(options.maxSitelinks));
  }

  if (options.dryRun) {
    args.push("--dry-run");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Batch offset ${offset} exited with code ${code}`));
    });
  });
}

async function runBatchWithRetries(options, offset, reportFile) {
  for (let attempt = 1; attempt <= options.maxBatchAttempts; attempt += 1) {
    try {
      await runSingleBatch(options, offset, reportFile);
      return;
    } catch (error) {
      if (attempt >= options.maxBatchAttempts) {
        throw error;
      }

      logWarn("Person candidate batch failed. Retrying the same offset.", {
        offset,
        attempt,
        nextAttempt: attempt + 1,
        retryDelayMs: options.batchRetryDelayMs,
        error: String(error),
      });
      await sleep(options.batchRetryDelayMs);
    }
  }
}

async function resolveAdaptiveBatchOptions(options, offset) {
  const probe = await runWdqsProbe({
    offset,
    minSitelinks: options.minSitelinks,
    maxSitelinks: options.maxSitelinks,
    sourceLang: options.sourceLang,
    transportTimeoutMs: options.probeTransportTimeoutMs,
    shapeTimeoutMs: options.probeShapeTimeoutMs,
    safeLimit: options.safeLimit,
    normalLimit: options.normalLimit,
    burstLimit: options.burstLimit,
    burstTransportMs: options.probeBurstTransportMs,
    burstShapeMs: options.probeBurstShapeMs,
    normalShapeMs: options.probeNormalShapeMs,
    appendLogFile: options.probeLogFile,
  });

  return {
    probe,
    batchOptions: {
      ...options,
      limit: probe.decision.recommendedLimit,
      offsetStep: probe.decision.recommendedLimit,
    },
  };
}

async function publishWorkerState(identity, payload) {
  await publishCollectorHeartbeat({
    worker_id: identity.workerId,
    host: identity.host,
    role: identity.role,
    ...payload,
  });
}

async function main() {
  const options = parseArgs();
  await ensureParentDirs(options);
  const worker = resolveWorkerIdentity({
    workerId: options.workerId || undefined,
    host: options.workerHost || undefined,
    role: options.workerRole || undefined,
  });

  let offset = options.startOffset;
  let completedBatches = 0;

  if (options.resume) {
    const state = await readState(options.stateFile);
    if (state?.nextOffset !== undefined) {
      offset = Number(state.nextOffset);
      completedBatches = Number(state.completedBatches ?? 0);
      logInfo("Resuming person candidate batch runner", {
        stateFile: options.stateFile,
        nextOffset: offset,
        completedBatches,
      });
    }
  }

  logInfo("Person candidate batch runner started", {
    startOffset: offset,
    batchCount: options.batchCount,
    offsetStep: options.offsetStep,
    limit: options.limit,
    minSitelinks: options.minSitelinks,
    maxSitelinks: options.maxSitelinks,
    sourceLang: options.sourceLang,
    dryRun: options.dryRun,
    maxBatchAttempts: options.maxBatchAttempts,
    batchRetryDelayMs: options.batchRetryDelayMs,
    adaptive: options.adaptive,
    safeLimit: options.safeLimit,
    normalLimit: options.normalLimit,
    burstLimit: options.burstLimit,
    stateFile: options.stateFile,
    workerId: worker.workerId,
    workerHost: worker.host,
  });

  await publishWorkerState(worker, {
    status: "running",
    source_lang: options.sourceLang,
    min_sitelinks: options.minSitelinks,
    max_sitelinks: options.maxSitelinks,
    current_offset: offset,
    next_offset: offset,
    completed_batches: completedBatches,
    current_limit: options.limit,
    started_at: new Date().toISOString(),
    metadata: {
      adaptive: options.adaptive,
      safe_limit: options.safeLimit,
      normal_limit: options.normalLimit,
      burst_limit: options.burstLimit,
      state_file: options.stateFile,
    },
  });

  try {
    let pauseCycles = 0;
    for (let i = 0; i < options.batchCount; ) {
      let batchOptions = options;
      let probe = null;

      if (options.adaptive) {
        const adaptive = await resolveAdaptiveBatchOptions(options, offset);
        batchOptions = adaptive.batchOptions;
        probe = adaptive.probe;

        if (probe.decision.profile === "pause") {
          pauseCycles += 1;
          logWarn("WDQS probe requested a pause before the next batch", {
            offset,
            pauseCycles,
            maxPauseCycles: options.maxPauseCycles,
            pauseMs: options.probePauseMs,
            transport: probe.transport,
            shape: probe.shape,
          });

          await publishWorkerState(worker, {
            status: "running",
            source_lang: options.sourceLang,
            min_sitelinks: options.minSitelinks,
            max_sitelinks: options.maxSitelinks,
            current_offset: offset,
            next_offset: offset,
            completed_batches: completedBatches,
            current_limit: batchOptions.limit,
            last_probe_profile: probe.decision.profile,
            last_probe_shape_latency_ms: Number(probe.shape?.latencyMs ?? 0) || null,
            metadata: {
              pause_cycles: pauseCycles,
              probe_reason: probe.decision.reason,
            },
          });

          if (pauseCycles >= options.maxPauseCycles) {
            throw new Error(
              `Adaptive probe paused ${pauseCycles} times at offset ${offset}; stopping batch runner.`,
            );
          }

          await sleep(options.probePauseMs);
          continue;
        }

        pauseCycles = 0;
        logInfo("Adaptive WDQS profile selected", {
          offset,
          profile: probe.decision.profile,
          recommendedLimit: probe.decision.recommendedLimit,
          reason: probe.decision.reason,
          transport: probe.transport,
          shape: probe.shape,
        });
      }

      const reportFile = buildReportFile(options.reportDir, batchOptions, offset);
      logInfo("Starting person candidate batch", {
        batchIndex: i,
        offset,
        reportFile,
        limit: batchOptions.limit,
      });

      await publishWorkerState(worker, {
        status: "running",
        source_lang: options.sourceLang,
        min_sitelinks: options.minSitelinks,
        max_sitelinks: options.maxSitelinks,
        current_offset: offset,
        next_offset: offset,
        completed_batches: completedBatches,
        current_limit: batchOptions.limit,
        last_probe_profile: probe?.decision?.profile ?? null,
        last_probe_shape_latency_ms: Number(probe?.shape?.latencyMs ?? 0) || null,
        metadata: {
          probe_reason: probe?.decision?.reason ?? null,
          report_file: reportFile,
        },
      });

      await runBatchWithRetries(batchOptions, offset, reportFile);
      const report = JSON.parse(await fs.readFile(reportFile, "utf8"));
      const summary = report.summary ?? {};

      completedBatches += 1;
      const fetchedRows = Number(summary.fetchedRows ?? 0);
      const nextOffset = offset + (fetchedRows > 0 ? fetchedRows : batchOptions.offsetStep);
      await writeState(options.stateFile, {
        updatedAt: new Date().toISOString(),
        nextOffset,
        completedBatches,
        lastOffset: offset,
        lastReportFile: reportFile,
        lastSummary: summary,
        lastProbe: probe,
        options: {
          limit: batchOptions.limit,
          batchCount: options.batchCount,
          offsetStep: batchOptions.offsetStep,
          minSitelinks: options.minSitelinks,
          maxSitelinks: options.maxSitelinks,
          sourceLang: options.sourceLang,
          dryRun: options.dryRun,
          adaptive: options.adaptive,
          safeLimit: options.safeLimit,
          normalLimit: options.normalLimit,
          burstLimit: options.burstLimit,
        },
      });

      await publishCollectorBatchRun({
        worker_id: worker.workerId,
        job_kind: "person_candidates",
        source_lang: options.sourceLang,
        min_sitelinks: options.minSitelinks,
        max_sitelinks: options.maxSitelinks,
        offset_start: offset,
        offset_end: nextOffset,
        batch_limit: batchOptions.limit,
        probe_profile: probe?.decision?.profile ?? null,
        probe_shape_latency_ms: Number(probe?.shape?.latencyMs ?? 0) || null,
        fetched_rows: Number(summary.fetchedRows ?? 0),
        normalized_rows: Number(summary.normalizedRows ?? 0),
        with_anchor: Number(summary.withAnchor ?? 0),
        without_anchor: Number(summary.withoutAnchor ?? 0),
        success: true,
        report_file: reportFile,
        generated_at: report.generatedAt ?? new Date().toISOString(),
        payload: summary,
      });

      await publishWorkerState(worker, {
        status: "running",
        source_lang: options.sourceLang,
        min_sitelinks: options.minSitelinks,
        max_sitelinks: options.maxSitelinks,
        current_offset: offset,
        next_offset: nextOffset,
        completed_batches: completedBatches,
        current_limit: batchOptions.limit,
        last_fetched_rows: Number(summary.fetchedRows ?? 0),
        last_normalized_rows: Number(summary.normalizedRows ?? 0),
        last_probe_profile: probe?.decision?.profile ?? null,
        last_probe_shape_latency_ms: Number(probe?.shape?.latencyMs ?? 0) || null,
        last_report_file: reportFile,
        last_batch_finished_at: report.generatedAt ?? new Date().toISOString(),
      });

      logInfo("Completed person candidate batch", {
        offset,
        nextOffset,
        fetchedRows: summary.fetchedRows ?? null,
        normalizedRows: summary.normalizedRows ?? null,
        withAnchor: summary.withAnchor ?? null,
      });

      const isEmpty =
        Number(summary.fetchedRows ?? 0) === 0 ||
        Number(summary.normalizedRows ?? 0) === 0;
      if (isEmpty && options.stopOnEmpty) {
        logWarn("Stopping batch runner because the last batch returned no rows", {
          offset,
          reportFile,
        });

        await publishWorkerState(worker, {
          status: "idle",
          source_lang: options.sourceLang,
          min_sitelinks: options.minSitelinks,
          max_sitelinks: options.maxSitelinks,
          current_offset: offset,
          next_offset: nextOffset,
          completed_batches: completedBatches,
          current_limit: batchOptions.limit,
          last_fetched_rows: Number(summary.fetchedRows ?? 0),
          last_normalized_rows: Number(summary.normalizedRows ?? 0),
          last_probe_profile: probe?.decision?.profile ?? null,
          last_probe_shape_latency_ms: Number(probe?.shape?.latencyMs ?? 0) || null,
          last_report_file: reportFile,
          last_batch_finished_at: report.generatedAt ?? new Date().toISOString(),
        });
        return;
      }

      offset = nextOffset;
      i += 1;
      if (i < options.batchCount && options.sleepMs > 0) {
        await sleep(options.sleepMs);
      }
    }

    await publishWorkerState(worker, {
      status: "idle",
      source_lang: options.sourceLang,
      min_sitelinks: options.minSitelinks,
      max_sitelinks: options.maxSitelinks,
      current_offset: offset,
      next_offset: offset,
      completed_batches: completedBatches,
      current_limit: options.limit,
    });

    logInfo("Person candidate batch runner finished", {
      completedBatches,
      nextOffset: offset,
      stateFile: options.stateFile,
    });
  } catch (error) {
    await publishWorkerState(worker, {
      status: "error",
      source_lang: options.sourceLang,
      min_sitelinks: options.minSitelinks,
      max_sitelinks: options.maxSitelinks,
      current_offset: offset,
      next_offset: offset,
      completed_batches: completedBatches,
      current_limit: options.limit,
      last_error: String(error),
    });
    throw error;
  }
}

main().catch((error) => {
  logError("runPersonCandidateBatches failed", { error: String(error) });
  process.exit(1);
});
