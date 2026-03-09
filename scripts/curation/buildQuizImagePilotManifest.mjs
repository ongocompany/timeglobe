#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function getArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const ROOT = process.cwd();
const candidateFile = path.resolve(ROOT, getArg("--candidate-file", "data/curation/quiz_candidates/internal_test_curated_50_candidates.json"));
const sessionDir = getArg("--session-dir", "");
const outRoot = getArg("--out-root", "public/quiz-image-pilot/curated50");
const model = getArg("--model", "gemini-2.5-flash-image");
const clueIndex = Number.parseInt(getArg("--clue-index", "0"), 10) || 0;
const outputFile = path.resolve(ROOT, getArg("--output-file", "data/curation/image_pilots/curated50_clue1.json"));

if (!sessionDir) {
  throw new Error("--session-dir is required");
}

const candidatePayload = JSON.parse(fs.readFileSync(candidateFile, "utf8"));
const candidates = Array.isArray(candidatePayload) ? candidatePayload : candidatePayload.candidates;
if (!Array.isArray(candidates) || candidates.length === 0) {
  throw new Error(`No candidates found in ${candidateFile}`);
}

const manifest = {
  session_dir: path.relative(ROOT, path.resolve(ROOT, sessionDir)),
  out_root: outRoot,
  model,
  clue_index: clueIndex,
  answers: candidates.map((candidate) => candidate.canonical_answer),
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({ ok: true, outputFile, answers: manifest.answers.length, model }, null, 2));
