import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const API_KEY = process.env.GEMINI_API_KEY?.trim();
if (!API_KEY) {
    console.error("Missing GEMINI_API_KEY in process.env");
    process.exit(1);
}

// Model requested by user for comparison
const MODEL = "gemini-3.1-flash-image-preview";
const EDGE = 512;
const DATA_PATH = path.join(process.cwd(), "data", "validation_temp.json");
const OUTPUT_ROOT = path.join(process.cwd(), "public", "quiz-image-pilot-v2");

const COMMON_STYLE_TAIL = "stylized historical clue card illustration, premium adult strategy game tone, semi-realistic digital painting, square composition, single clear focal subject, readable at small card size, restrained cinematic lighting, no readable text, no letters, no watermark, no UI elements";

async function generateImage(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });

    const json = await response.json();
    if (!response.ok) {
        throw new Error(`Gemini image request failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`);
    }

    const part = json?.candidates?.[0]?.content?.parts?.find((c) => c.inlineData?.mimeType?.startsWith("image/"));
    const data = part?.inlineData?.data;
    if (!data) {
        throw new Error(`Gemini image response missing inline data: ${JSON.stringify(json).slice(0, 500)}`);
    }

    return { json, base64: data };
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

    // Already done: 0, 1, 6, 10, 11, 23, 24, 25, 26, 27 (V1)
    // Already done: 2, 3, 4, 5, 7, 8, 9, 12, 13, 14 (V2)
    const alreadyIndices = [0, 1, 6, 10, 11, 23, 24, 25, 26, 27, 2, 3, 4, 5, 7, 8, 9, 12, 13, 14];

    const targets = data
        .map((item, index) => ({ item, index }))
        .filter(obj => !alreadyIndices.includes(obj.index));

    console.error(`Starting generation for ${targets.length} items using paid GEMINI_API_KEY at 512px...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = path.join(OUTPUT_ROOT, timestamp);
    ensureDir(outputDir);

    const indexItems = [];
    const failures = [];

    // Parallel processing in chunks of 5 to avoid crashing or hitting extreme RPM too fast
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
        const chunk = targets.slice(i, i + CHUNK_SIZE);
        console.error(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}...`);

        const results = await Promise.all(chunk.map(async ({ item, index }) => {
            const prompt = `${item.clue_3_image_prompt}. ${COMMON_STYLE_TAIL}. Avoid ${item.clue_3_image_negative || "human, text"}.`;
            const baseName = `item_${String(index).padStart(2, "0")}`;
            const rawJsonPath = path.join(outputDir, `${baseName}.json`);
            const scaledPath = path.join(outputDir, `${baseName}_${EDGE}.png`);

            try {
                const { json, base64 } = await generateImage(prompt);
                fs.writeFileSync(rawJsonPath, JSON.stringify(json, null, 2));
                fs.writeFileSync(scaledPath, Buffer.from(base64, "base64"));
                console.error(`  - [Idx ${index}] saved ${path.basename(scaledPath)}`);

                return {
                    index,
                    answer: item.entity_name,
                    prompt: prompt,
                    ko_concept: item.clue_3_image_concept_ko,
                    scaledFilename: path.basename(scaledPath)
                };
            } catch (e) {
                console.error(`  - [Idx ${index}] failed: ${e.message}`);
                return { index, failure: true, error: e.message, answer: item.entity_name };
            }
        }));

        for (const res of results) {
            if (res.failure) {
                failures.push(res);
            } else {
                indexItems.push(res);
            }
        }

        // Small break between chunks
        if (i + CHUNK_SIZE < targets.length) await new Promise(r => setTimeout(r, 2000));
    }

    const indexPath = path.join(outputDir, "index.md");
    let content = `# Quiz Image Validation V2 (Gemini 3.1 Flash Image - 512px)\n\n`;
    content += `Generated ${indexItems.length} items, ${failures.length} failures.\n\n`;
    for (const item of indexItems) {
        content += `## ${item.answer} (Global Index: ${item.index})\n\n`;
        content += `- **Korean Concept**: ${item.ko_concept}\n`;
        content += `- **English Prompt**: \n\`\`\`text\n${item.prompt}\n\`\`\`\n\n`;
        content += `![${item.answer}](${item.scaledFilename})\n\n`;
    }

    fs.writeFileSync(indexPath, content);
    console.log(`\nSuccessfully generated images!`);
    console.log(`Results saved in: ${outputDir}/index.md`);
}

main().catch(e => console.error(e));
