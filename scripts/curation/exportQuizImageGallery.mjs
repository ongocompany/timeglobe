#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function usage() {
  console.error(
    "Usage: node scripts/curation/exportQuizImageGallery.mjs --dir <absolute-output-dir> [--alias <absolute-file-path>]"
  );
}

function parseArgs(argv) {
  const args = { dir: "", alias: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      args.dir = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--alias") {
      args.alias = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return args;
}

function parseIndex(markdown) {
  const sections = markdown.split("\n## ").slice(1);
  return sections
    .map((chunk) => {
      const lines = chunk.split("\n");
      const name = lines[0].trim();
      const clueTitle =
        markdownMatch(chunk, /- clue_title: (.+)/)?.[1]?.trim() ?? "";
      const clueBrief =
        markdownMatch(chunk, /- clue_brief: (.+)/)?.[1]?.trim() ?? "";
      const imagePath =
        markdownMatch(chunk, /!\[[^\]]*\]\((.+?_512\.png)\)/)?.[1]?.trim() ?? "";
      return {
        name,
        clueTitle,
        clueBrief,
        imagePath,
      };
    })
    .filter((item) => item.name && item.imagePath);
}

function markdownMatch(text, regex) {
  return text.match(regex);
}

function toRelativeImagePath(outputDir, absoluteImagePath) {
  return path.relative(outputDir, absoluteImagePath);
}

function renderHtml({ title, items, generatedAt }) {
  const cards = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      return `
        <article class="card">
          <div class="meta">
            <span class="index">${number}</span>
            <h2>${escapeHtml(item.name)}</h2>
          </div>
          <img src="${escapeHtml(item.relativeImagePath)}" alt="${escapeHtml(item.name)}" loading="lazy" />
          <p class="title">${escapeHtml(item.clueTitle)}</p>
          <p class="brief">${escapeHtml(item.clueBrief)}</p>
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0a0d11;
        --panel: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.12);
        --text: #f2f5f9;
        --muted: rgba(242, 245, 249, 0.72);
        --accent: #d5c49b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top, rgba(76, 88, 117, 0.24), transparent 34%),
          linear-gradient(180deg, #0b1017 0%, var(--bg) 100%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap {
        max-width: 1680px;
        margin: 0 auto;
        padding: 28px 24px 40px;
      }
      header {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 24px;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.02em;
      }
      .sub {
        color: var(--muted);
        font-size: 14px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 14px;
        backdrop-filter: blur(12px);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: rgba(213, 196, 155, 0.14);
        color: var(--accent);
        font-size: 13px;
        font-weight: 700;
      }
      .meta h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
      }
      img {
        width: 100%;
        display: block;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 10px;
      }
      .title {
        margin: 0 0 8px;
        font-size: 14px;
        color: var(--text);
        font-weight: 700;
      }
      .brief {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <header>
        <h1>${escapeHtml(title)}</h1>
        <div class="sub">generated ${escapeHtml(generatedAt)} · ${items.length} cards</div>
      </header>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>`;
}

function renderMarkdown({ title, items, generatedAt, outputDir }) {
  const sections = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      const absImage = path.join(outputDir, item.relativeImagePath);
      return `## ${number}. ${item.name}

**${item.clueTitle}**

${item.clueBrief}

![${item.name}](${absImage})
`;
    })
    .join("\n");

  return `# ${title}

- generated_at: \`${generatedAt}\`
- count: \`${items.length}\`

${sections}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    usage();
    process.exit(1);
  }

  const outputDir = path.resolve(args.dir);
  const indexPath = path.join(outputDir, "index.md");
  const indexMarkdown = await fs.readFile(indexPath, "utf8");
  const generatedAt = new Date().toISOString();
  const rawItems = parseIndex(indexMarkdown);
  const items = rawItems.map((item) => ({
    ...item,
    relativeImagePath: toRelativeImagePath(outputDir, item.imagePath),
  }));

  const title = "TimeGlobe Quiz Image Pilot · First 50";
  const html = renderHtml({ title, items, generatedAt });
  const markdown = renderMarkdown({ title, items, generatedAt, outputDir });

  await fs.writeFile(path.join(outputDir, "gallery.html"), html, "utf8");
  await fs.writeFile(path.join(outputDir, "gallery.md"), markdown, "utf8");

  if (args.alias) {
    const aliasPath = path.resolve(args.alias);
    const relativeToAlias = path.relative(path.dirname(aliasPath), path.join(outputDir, "gallery.html"));
    const aliasHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta http-equiv="refresh" content="0; url=${relativeToAlias}" /><title>latest gallery</title></head><body><p><a href="${relativeToAlias}">Open latest gallery</a></p></body></html>`;
    await fs.writeFile(aliasPath, aliasHtml, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        galleryHtml: path.join(outputDir, "gallery.html"),
        galleryMd: path.join(outputDir, "gallery.md"),
        count: items.length,
        alias: args.alias || null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});
