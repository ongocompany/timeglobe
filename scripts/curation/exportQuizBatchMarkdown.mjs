#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { readJsonFile } from "./quizBundleModelDryRun.mjs";
import { writeModelMarkdown } from "./quizBundleMarkdown.mjs";

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function collectSessionDirs(rootDir) {
  const directBatchDirs = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("batch-"));

  if (directBatchDirs.length > 0) {
    return [rootDir];
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
    .filter((dir) =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .some((entry) => entry.isDirectory() && entry.name.startsWith("batch-"))
    );
}

function renderSessionOverview(sessionDir, rows) {
  const totalPrompt = rows.reduce((sum, row) => sum + (row.usage?.promptTokenCount ?? 0), 0);
  const totalOutput = rows.reduce((sum, row) => sum + (row.usage?.candidatesTokenCount ?? 0), 0);
  const totalThoughts = rows.reduce((sum, row) => sum + (row.usage?.thoughtsTokenCount ?? 0), 0);
  const totalTokens = rows.reduce((sum, row) => sum + (row.usage?.totalTokenCount ?? 0), 0);

  return [
    `# ${path.basename(sessionDir)} 결과 모음`,
    "",
    `- batch_count: \`${rows.length}\``,
    `- prompt_tokens: \`${totalPrompt}\``,
    `- output_tokens: \`${totalOutput}\``,
    `- thoughts_tokens: \`${totalThoughts}\``,
    `- total_tokens: \`${totalTokens}\``,
    "",
    "## 배치 목록",
    ...rows.map((row) => `- [${row.batchLabel} / ${row.model}](./${row.batchLabel}/${row.model}.md)`),
    "",
  ].join("\n");
}

function renderRootOverview(rootDir, sessionDirs) {
  return [
    `# ${path.basename(rootDir)} Markdown 결과 모음`,
    "",
    "## 세션 목록",
    ...sessionDirs.map((sessionDir) => `- [${path.basename(sessionDir)}](./${path.basename(sessionDir)}/_session_results.md)`),
    "",
  ].join("\n");
}

async function main() {
  const rootDir = path.resolve(process.cwd(), getArg("--root", ".cache/quiz-bundle-batches/internal-test-500"));
  const sessionDirs = collectSessionDirs(rootDir);

  if (sessionDirs.length === 0) {
    throw new Error(`No session directories found under ${rootDir}`);
  }

  for (const sessionDir of sessionDirs) {
    const batchDirs = fs
      .readdirSync(sessionDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("batch-"))
      .map((entry) => path.join(sessionDir, entry.name))
      .sort();

    const rows = [];
    for (const batchDir of batchDirs) {
      const summary = readJsonFile(path.join(batchDir, "summary.json"));
      const targets = readJsonFile(path.join(batchDir, "targets.json"));

      for (const result of summary.results ?? []) {
        if (!result.outputFile) continue;
        const parsed = readJsonFile(path.join(batchDir, result.outputFile));
        writeModelMarkdown({
          batchDir,
          sessionDir,
          batchLabel: summary.batchLabel,
          startIndex: summary.startIndex,
          batchSize: summary.batchSize,
          model: result.model,
          targets,
          parsed,
          usage: result.usage,
        });
        rows.push({
          batchLabel: summary.batchLabel,
          model: result.model,
          usage: result.usage,
        });
      }
    }

    fs.writeFileSync(path.join(sessionDir, "_session_results.md"), `${renderSessionOverview(sessionDir, rows)}\n`);
  }

  fs.writeFileSync(path.join(rootDir, "_all_sessions.md"), `${renderRootOverview(rootDir, sessionDirs)}\n`);

  console.log(JSON.stringify({ rootDir, sessionCount: sessionDirs.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
