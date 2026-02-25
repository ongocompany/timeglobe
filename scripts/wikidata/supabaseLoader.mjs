import { config, requireDbEnv } from "./config.mjs";
import { logWarn } from "./logger.mjs";

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function postgrest(path, options = {}) {
  requireDbEnv();
  const url = `${config.supabaseUrl}/rest/v1/${path}`;
  const response = await fetch(url, {
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
  return response.json();
}

export async function upsertEvents(records) {
  if (!records.length) return;
  for (const part of chunk(records, 100)) {
    await postgrest("events?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: part,
    });
  }
}

export async function upsertSourceMeta(records) {
  if (!records.length) return;
  try {
    for (const part of chunk(records, 100)) {
      await postgrest("event_sources?on_conflict=event_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: part,
      });
    }
  } catch (error) {
    logWarn(
      "Skipping event_sources upsert. Create table if you need source tracking.",
      { error: String(error) },
    );
  }
}

export async function patchEventById(eventId, patch) {
  await postgrest(`events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: patch,
  });
}
