#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_MODELS,
  buildSystemPrompt,
  buildUserPrompt,
  callGemini,
  readJsonFile,
  readUsage,
  nowStamp,
} from "./quizBundleModelDryRun.mjs";
import { writeModelMarkdown } from "./quizBundleMarkdown.mjs";

process.loadEnvFile?.(".env.local");

const DEFAULT_CANDIDATE_FILE = "data/curation/quiz_candidates/internal_test_500_candidates.json";
const DEFAULT_OUTPUT_ROOT = path.join(process.cwd(), ".cache", "quiz-bundle-batches");

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  const candidateFile = path.resolve(process.cwd(), getArg("--candidate-file", DEFAULT_CANDIDATE_FILE));
  const batchSize = Number(getArg("--batch-size", "5"));
  const batchCount = Number(getArg("--batch-count", "10"));
  const startIndexArg = Number(getArg("--start-index", "0"));
  const resume = hasFlag("--resume");
  const modelsArg = getArg("--models", DEFAULT_MODELS.join(","));
  const models = modelsArg.split(",").map((x) => x.trim()).filter(Boolean);
  const outputRoot = path.resolve(process.cwd(), getArg("--out-dir", DEFAULT_OUTPUT_ROOT));
  const stateFile = path.resolve(process.cwd(), getArg("--state-file", path.join(outputRoot, "state.json")));

  const payload = readJsonFile(candidateFile);
  const allCandidates = Array.isArray(payload) ? payload : payload.candidates;
  if (!Array.isArray(allCandidates) || allCandidates.length === 0) {
    throw new Error(`No candidates found in ${candidateFile}`);
  }

  ensureDir(outputRoot);

  let nextIndex = startIndexArg;
  let completedBatches = 0;
  if (resume && fs.existsSync(stateFile)) {
    const state = readJsonFile(stateFile);
    nextIndex = Number(state.nextIndex || 0);
    completedBatches = Number(state.completedBatches || 0);
  }

  const systemPrompt = buildSystemPrompt();
  const sessionDir = path.join(outputRoot, nowStamp());
  ensureDir(sessionDir);

  for (let i = 0; i < batchCount; i += 1) {
    const batch = allCandidates.slice(nextIndex, nextIndex + batchSize);
    if (batch.length === 0) break;

    const batchLabel = `batch-${String(completedBatches + 1).padStart(3, "0")}-${String(nextIndex).padStart(4, "0")}`;
    const batchDir = path.join(sessionDir, batchLabel);
    ensureDir(batchDir);

    const userPrompt = buildUserPrompt(batch);
    fs.writeFileSync(path.join(batchDir, "targets.json"), JSON.stringify(batch, null, 2));
    fs.writeFileSync(path.join(batchDir, "system-prompt.txt"), `${systemPrompt}\n`);
    fs.writeFileSync(path.join(batchDir, "user-prompt.txt"), `${userPrompt}\n`);

    const batchResults = [];
    for (const model of models) {
      const result = await callGemini({ model, systemPrompt, userPrompt });
      const usage = readUsage(result.usageMetadata);
      writeJson(path.join(batchDir, `${model}.raw.json`), result.rawResponse);
      fs.writeFileSync(path.join(batchDir, `${model}.text.txt`), `${result.text}\n`);
      writeJson(path.join(batchDir, `${model}.parsed.json`), result.parsed);
      writeModelMarkdown({
        batchDir,
        sessionDir,
        batchLabel,
        startIndex: nextIndex,
        batchSize: batch.length,
        model,
        targets: batch,
        parsed: result.parsed,
        usage,
      });
      batchResults.push({
        model,
        parsed_ok: Boolean(result.parsed),
        usage,
        outputFile: `${model}.parsed.json`,
      });
      console.log(
        `[batch] ${batchLabel} ${model} prompt=${usage.promptTokenCount} output=${usage.candidatesTokenCount} total=${usage.totalTokenCount} thoughts=${usage.thoughtsTokenCount}`
      );
    }

    writeJson(path.join(batchDir, "summary.json"), {
      batchLabel,
      startIndex: nextIndex,
      batchSize: batch.length,
      models,
      results: batchResults,
    });

    nextIndex += batch.length;
    completedBatches += 1;
    writeJson(stateFile, {
      candidateFile,
      nextIndex,
      completedBatches,
      batchSize,
      sessionDir,
      lastBatchLabel: batchLabel,
    });
  }

  console.log(JSON.stringify({ stateFile, nextIndex, completedBatches }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
