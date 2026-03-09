#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function formatUsage(usage = {}) {
  return {
    promptTokenCount: usage?.promptTokenCount ?? 0,
    candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
    thoughtsTokenCount: usage?.thoughtsTokenCount ?? 0,
    totalTokenCount: usage?.totalTokenCount ?? 0,
  };
}

function renderTargets(targets = []) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "_없음_";
  }

  return targets
    .map((target, index) => {
      const fields = [
        `${index + 1}. **${target.canonical_answer ?? "Unknown"}**`,
        `\`${target.entity_type ?? "unknown"}\``,
      ];
      if (target.anchor_year !== undefined) fields.push(`year: ${target.anchor_year}`);
      if (target.present_day_region) fields.push(`region: ${target.present_day_region}`);
      if (target.short_context) fields.push(`context: ${target.short_context}`);
      return `- ${fields.join(" | ")}`;
    })
    .join("\n");
}

function renderBundle(bundle, index) {
  const imageClues = Array.isArray(bundle.image_clues) ? bundle.image_clues : [];
  const notes = Array.isArray(bundle.search_resistance_notes) ? bundle.search_resistance_notes : [];

  return [
    `## ${index + 1}. ${bundle.canonical_answer ?? "Unknown"}`,
    "",
    `- entity_type: \`${bundle.entity_type ?? "unknown"}\``,
    `- difficulty_estimate: \`${bundle.difficulty_estimate ?? "-"}\``,
    `- line_kind: \`${bundle.line_kind ?? "-"}\``,
    `- image_negative_prompt: \`${bundle.image_negative_prompt ?? ""}\``,
    "",
    "### 왜 게임에 적합한가",
    bundle.why_this_is_good_for_gameplay ?? "_없음_",
    "",
    "### 이미지 단서",
    imageClues.length === 0
      ? "_없음_"
      : imageClues
          .map((clue, clueIndex) => {
            return `${clueIndex + 1}. **${clue.title ?? "Untitled"}**\n   - ${clue.brief ?? ""}`;
          })
          .join("\n"),
    "",
    "### 문장 단서",
    `> ${bundle.line ?? ""}`,
    "",
    "### 히든 단서",
    `> ${bundle.hidden_hint ?? ""}`,
    "",
    "### 검색 저항 메모",
    notes.length === 0 ? "_없음_" : notes.map((note) => `- ${note}`).join("\n"),
    "",
  ].join("\n");
}

export function renderModelMarkdown({
  sessionDir,
  batchLabel,
  startIndex,
  batchSize,
  model,
  targets,
  parsed,
  usage,
}) {
  const u = formatUsage(usage);
  const bundles = Array.isArray(parsed?.bundles) ? parsed.bundles : [];

  return [
    `# ${batchLabel} / ${model}`,
    "",
    `- session_dir: \`${sessionDir}\``,
    `- start_index: \`${startIndex}\``,
    `- batch_size: \`${batchSize}\``,
    `- prompt_tokens: \`${u.promptTokenCount}\``,
    `- output_tokens: \`${u.candidatesTokenCount}\``,
    `- thoughts_tokens: \`${u.thoughtsTokenCount}\``,
    `- total_tokens: \`${u.totalTokenCount}\``,
    "",
    "## 입력 타깃",
    renderTargets(targets),
    "",
    ...bundles.map(renderBundle),
  ].join("\n");
}

export function writeModelMarkdown({
  batchDir,
  sessionDir,
  batchLabel,
  startIndex,
  batchSize,
  model,
  targets,
  parsed,
  usage,
}) {
  const markdown = renderModelMarkdown({
    batchDir,
    sessionDir,
    batchLabel,
    startIndex,
    batchSize,
    model,
    targets,
    parsed,
    usage,
  });
  const outputFile = path.join(batchDir, `${model}.md`);
  fs.writeFileSync(outputFile, `${markdown}\n`);
  return { outputFile, markdown };
}
