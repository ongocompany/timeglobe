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
const EDGE = 500;
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

    // Pick 10 NEW items (indices that were not in the first pilot)
    // 2 (Caesar), 3 (Van Gogh), 4 (Sado), 5 (An Jung-geun), 7 (Socrates), 
    // 8 (Cleopatra), 9 (Lincoln), 12 (Yi Sun-sin), 13 (Galileo), 14 (Heo Jun)
    const targets = [
        data[2],  // 율리우스 카이사르
        data[3],  // 빈센트 반 고흐
        data[4],  // 사도세자
        data[5],  // 안중근
        data[7],  // 소크라테스
        data[8],  // 클레오파트라
        data[9],  // 에이브러햄 링컨
        data[12], // 이순신
        data[13], // 갈릴레오 갈릴레이
        data[14]  // 허준
    ].filter(Boolean);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = path.join(OUTPUT_ROOT, timestamp);
    ensureDir(outputDir);

    const indexItems = [];
    const failures = [];

    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        console.error(`[${i + 1}/${targets.length}] generating image for ${item.entity_name} using ${MODEL}...`);

        const prompt = `${item.clue_3_image_prompt}. ${COMMON_STYLE_TAIL}. Avoid ${item.clue_3_image_negative || "human, text"}.`;

        const baseName = `item_${String(i + 1).padStart(2, "0")}`;
        const rawJsonPath = path.join(outputDir, `${baseName}.json`);
        const scaledPath = path.join(outputDir, `${baseName}_${EDGE}.png`);

        try {
            const { json, base64 } = await generateImage(prompt);
            fs.writeFileSync(rawJsonPath, JSON.stringify(json, null, 2));
            fs.writeFileSync(scaledPath, Buffer.from(base64, "base64"));

            console.error(`[${i + 1}/${targets.length}] saved ${path.basename(scaledPath)}`);

            indexItems.push({
                answer: item.entity_name,
                prompt: prompt,
                ko_concept: item.clue_3_image_concept_ko,
                scaledFilename: path.basename(scaledPath)
            });
        } catch (e) {
            failures.push({ answer: item.entity_name, error: e.message });
            console.error(`[${i + 1}/${targets.length}] failed: ${e.message}`);
        }

        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 4000));
    }

    const indexPath = path.join(outputDir, "index.md");
    let content = `# Quiz Image Validation V2 (Gemini 3.1 Flash Image)\n\n`;
    for (const item of indexItems) {
        content += `## ${item.answer}\n\n`;
        content += `- **Korean Concept**: ${item.ko_concept}\n`;
        content += `- **English Prompt**: \n\`\`\`text\n${item.prompt}\n\`\`\`\n\n`;
        content += `![${item.answer}](${item.scaledFilename})\n\n`;
    }

    fs.writeFileSync(indexPath, content);
    console.log(`\nSuccessfully generated images!`);
    console.log(`Results saved in: ${outputDir}/index.md`);
}

main().catch(e => console.error(e));
