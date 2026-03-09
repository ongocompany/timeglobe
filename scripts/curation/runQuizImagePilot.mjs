import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_SESSION_DIR = path.join(
  process.cwd(),
  ".cache",
  "quiz-bundle-batches",
  "internal-test-50-rerun",
  "20260308-210631",
);
const DEFAULT_OUTPUT_ROOT = path.join(process.cwd(), "public", "quiz-image-pilot");
const DEFAULT_MODEL = "gemini-2.5-flash-image";
const DEFAULT_EDGE = 500;
const DEFAULT_ANSWERS = [
  "세종대왕",
  "만사 무사",
  "요하네스 구텐베르크",
  "이순신",
  "이븐 알하이삼",
  "마리 퀴리",
  "알렉산드리아",
  "징기스칸",
];
const COMMON_STYLE_TAIL =
  "stylized historical clue card illustration, premium adult strategy game tone, semi-realistic digital painting, square composition, single clear focal subject, readable at small card size, restrained cinematic lighting, no readable text, no letters, no watermark, no UI elements";

function parseArgs(argv) {
  const options = {
    manifest: "",
    sessionDir: DEFAULT_SESSION_DIR,
    outRoot: DEFAULT_OUTPUT_ROOT,
    model: DEFAULT_MODEL,
    clueIndex: 0,
    answers: DEFAULT_ANSWERS,
    contexts: {},
    negativeOverrides: {},
    promptOverrides: {},
    _provided: new Set(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") {
      options.manifest = path.resolve(argv[++index]);
      options._provided.add("manifest");
    } else if (value === "--session-dir") {
      options.sessionDir = path.resolve(argv[++index]);
      options._provided.add("sessionDir");
    } else if (value === "--out-root") {
      options.outRoot = path.resolve(argv[++index]);
      options._provided.add("outRoot");
    } else if (value === "--model") {
      options.model = argv[++index];
      options._provided.add("model");
    } else if (value === "--clue-index") {
      options.clueIndex = Number.parseInt(argv[++index], 10) || 0;
      options._provided.add("clueIndex");
    } else if (value === "--answers") {
      options.answers = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
      options._provided.add("answers");
    }
  }

  return options;
}

function applyManifest(options) {
  if (!options.manifest) return options;
  const manifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
  if (manifest.session_dir && !options._provided.has("sessionDir")) {
    options.sessionDir = path.resolve(process.cwd(), manifest.session_dir);
  }
  if (manifest.out_root && !options._provided.has("outRoot")) {
    options.outRoot = path.resolve(process.cwd(), manifest.out_root);
  }
  if (manifest.model && !options._provided.has("model")) options.model = manifest.model;
  if (Number.isInteger(manifest.clue_index) && !options._provided.has("clueIndex")) {
    options.clueIndex = manifest.clue_index;
  }
  if (Array.isArray(manifest.answers) && manifest.answers.length > 0 && !options._provided.has("answers")) {
    options.answers = manifest.answers;
  }
  if (manifest.contexts && typeof manifest.contexts === "object") {
    options.contexts = manifest.contexts;
  }
  if (manifest.negative_overrides && typeof manifest.negative_overrides === "object") {
    options.negativeOverrides = manifest.negative_overrides;
  }
  if (manifest.prompt_overrides && typeof manifest.prompt_overrides === "object") {
    options.promptOverrides = manifest.prompt_overrides;
  }
  delete options._provided;
  return options;
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

function walkParsedFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".parsed.json")) results.push(fullPath);
    }
  }
  return results.sort();
}

function loadBundleIndex(sessionDir) {
  const index = new Map();
  for (const filePath of walkParsedFiles(sessionDir)) {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const bundles = Array.isArray(payload.bundles) ? payload.bundles : [];
    for (const bundle of bundles) {
      if (!bundle?.canonical_answer || index.has(bundle.canonical_answer)) continue;
      index.set(bundle.canonical_answer, {
        bundle,
        sourceFile: filePath,
      });
    }
  }
  return index;
}

function buildPrompt(bundle, clueIndex, contextHint = "", negativeOverride = "", promptOverride = "") {
  const imageClues = Array.isArray(bundle.image_clues) ? bundle.image_clues : [];
  const clue = imageClues[clueIndex];
  if (!clue) {
    throw new Error(`Missing image clue at index ${clueIndex} for ${bundle.canonical_answer}`);
  }

  if (promptOverride) {
    return promptOverride;
  }

  const negative = [bundle.image_negative_prompt, negativeOverride]
    .filter(Boolean)
    .join(", ") || "crowd scene, complex battle panorama, readable text, hero poster composition";
  const title = clue.title ? `${clue.title}. ` : "";
  const resolvedContext = contextHint || bundle.image_context_anchor || "";
  const contextText = resolvedContext ? `${resolvedContext}. ` : "";

  return `${title}${clue.brief}. ${contextText}${COMMON_STYLE_TAIL}. Avoid ${negative}.`;
}

async function generateImage({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini image request failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }

  const part = json?.candidates?.[0]?.content?.parts?.find((candidatePart) => candidatePart.inlineData?.mimeType?.startsWith("image/"));
  const data = part?.inlineData?.data;
  if (!data) {
    throw new Error(`Gemini image response missing inline image data: ${JSON.stringify(json).slice(0, 500)}`);
  }

  return { json, base64: data };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function downscaleTo512(sourcePath, outputPath) {
  execFileSync("sips", ["-z", String(DEFAULT_EDGE), String(DEFAULT_EDGE), sourcePath, "--out", outputPath], {
    stdio: "ignore",
  });
}

function renderIndex(items, outputDir) {
  const lines = [
    "# Quiz Image Pilot",
    "",
    `- generated_at: \`${new Date().toISOString()}\``,
    `- output_dir: \`${outputDir}\``,
    "",
  ];

  for (const item of items) {
    lines.push(`## ${item.answer}`);
    lines.push("");
    lines.push(`- source_file: \`${item.sourceFile}\``);
    lines.push(`- clue_title: ${item.clueTitle}`);
    lines.push(`- clue_brief: ${item.clueBrief}`);
    lines.push(`- negative: \`${item.negative}\``);
    lines.push("");
    lines.push("```text");
    lines.push(item.prompt);
    lines.push("```");
    lines.push("");
    lines.push(`![${item.answer}](${path.join(outputDir, item.scaledFilename)})`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  loadEnvFile();
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const options = applyManifest(parseArgs(process.argv.slice(2)));
  const bundleIndex = loadBundleIndex(options.sessionDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(options.outRoot, timestamp);
  ensureDir(outputDir);

  const indexItems = [];
  const failures = [];

  for (const [answerIndex, answer] of options.answers.entries()) {
    console.error(`[${answerIndex + 1}/${options.answers.length}] generating ${answer}`);
    const entry = bundleIndex.get(answer);
    if (!entry) {
      failures.push({ answer, error: `Bundle not found for answer: ${answer}` });
      continue;
    }
    const { bundle, sourceFile } = entry;
    const imageClues = Array.isArray(bundle.image_clues) ? bundle.image_clues : [];
    const clue = imageClues[options.clueIndex];
    if (!clue) {
      throw new Error(`Missing image clue ${options.clueIndex} for ${answer}`);
    }

    const prompt = buildPrompt(
      bundle,
      options.clueIndex,
      options.contexts[answer] || "",
      options.negativeOverrides[answer] || "",
      options.promptOverrides[answer] || "",
    );
    const baseName = `${String(answerIndex + 1).padStart(2, "0")}_card${options.clueIndex + 1}`;
    const rawJsonPath = path.join(outputDir, `${baseName}.json`);
    const originalPath = path.join(outputDir, `${baseName}.tmp.png`);
    const scaledPath = path.join(outputDir, `${baseName}_${DEFAULT_EDGE}.png`);

    try {
      const { json, base64 } = await generateImage({
        apiKey,
        model: options.model,
        prompt,
      });

      fs.writeFileSync(rawJsonPath, JSON.stringify(json, null, 2));
      fs.writeFileSync(originalPath, Buffer.from(base64, "base64"));
      downscaleTo512(originalPath, scaledPath);
      fs.unlinkSync(originalPath);
      console.error(`[${answerIndex + 1}/${options.answers.length}] saved ${path.basename(scaledPath)}`);

      indexItems.push({
        answer,
        sourceFile,
        clueTitle: clue.title,
        clueBrief: clue.brief,
        negative: bundle.image_negative_prompt || "",
        prompt,
        scaledFilename: path.basename(scaledPath),
      });
    } catch (error) {
      failures.push({
        answer,
        sourceFile,
        clueTitle: clue.title,
        clueBrief: clue.brief,
        prompt,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[${answerIndex + 1}/${options.answers.length}] failed ${answer}: ${failures.at(-1).error}`);
    }
  }

  const indexPath = path.join(outputDir, "index.md");
  let content = renderIndex(indexItems, outputDir);
  if (failures.length > 0) {
    content += "\n## Failures\n\n";
    for (const failure of failures) {
      content += `- ${failure.answer}: ${failure.error}\n`;
    }
  }
  fs.writeFileSync(indexPath, content);

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        outputDir,
        indexPath,
        count: indexItems.length,
        failureCount: failures.length,
        model: options.model,
        answers: options.answers,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
