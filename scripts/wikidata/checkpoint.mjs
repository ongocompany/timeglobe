import fs from "node:fs/promises";
import path from "node:path";

const defaultState = {
  updatedAt: null,
  tasks: {},
};

export async function loadCheckpoint(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return structuredClone(defaultState);
    }
    throw error;
  }
}

export async function saveCheckpoint(filePath, state) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const payload = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export function ensureTaskState(state, taskId) {
  if (!state.tasks[taskId]) {
    state.tasks[taskId] = {
      status: "pending",
      retries: 0,
      records: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
      pages: 0,
      mode: null,
    };
  }
  return state.tasks[taskId];
}
