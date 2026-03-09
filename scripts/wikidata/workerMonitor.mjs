import os from "node:os";
import { config, requireDbEnv } from "./config.mjs";
import { logWarn } from "./logger.mjs";

let warnedUnavailable = false;

function monitoringEnabled() {
  return process.env.COLLECTOR_MONITORING !== "false"
    && Boolean(config.supabaseUrl)
    && Boolean(config.supabaseServiceRoleKey);
}

function warnUnavailable(error) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  logWarn("Collector monitoring publish skipped.", { error: String(error) });
}

async function postgrest(path, options = {}) {
  requireDbEnv();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST ${response.status} ${path}: ${text.slice(0, 400)}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

export function resolveWorkerIdentity(overrides = {}) {
  const role = overrides.role ?? process.env.COLLECTOR_WORKER_ROLE ?? "person_candidates";
  const host = overrides.host ?? process.env.COLLECTOR_WORKER_HOST ?? os.hostname();
  const workerId = overrides.workerId ?? process.env.COLLECTOR_WORKER_ID ?? `${role}:${host}`;

  return { workerId, host, role };
}

export async function publishCollectorHeartbeat(payload) {
  if (!monitoringEnabled()) return false;

  try {
    await postgrest("collector_workers?on_conflict=worker_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: [
        {
          ...payload,
          process_count: payload.process_count ?? 1,
          updated_at: new Date().toISOString(),
          last_heartbeat_at: new Date().toISOString(),
        },
      ],
    });
    return true;
  } catch (error) {
    warnUnavailable(error);
    return false;
  }
}

export async function publishCollectorBatchRun(payload) {
  if (!monitoringEnabled()) return false;

  try {
    await postgrest("collector_batch_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: [
        {
          ...payload,
          generated_at: payload.generated_at ?? new Date().toISOString(),
        },
      ],
    });
    return true;
  } catch (error) {
    warnUnavailable(error);
    return false;
  }
}
