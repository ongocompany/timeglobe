import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const API_KEY = process.env.GEMINI_API_KEY?.trim();
if (!API_KEY) {
    console.error("Missing GEMINI_API_KEY in process.env");
    process.exit(1);
}

const MODEL = "gemini-2.5-flash-image";
const EDGE = 500;
const DATA_PATH = path.join(process.cwd(), "data", "validation_temp.json");
const OUTPUT_ROOT = path.join(process.cwd(), "public", "quiz-image-pilot-new");

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

function downscaleTo512(sourcePath, outputPath) {
    execFileSync("sips", ["-z", String(EDGE), String(EDGE), sourcePath, "--out", outputPath], {
        stdio: "ignore",
    });
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    // Pick 10 interesting ones across categories
    const targets = [
        data[0],  // 잔 다르크 (Person)
        data[1],  // 마리 앙투아네트 (Person)
        data[10], // 마추픽추 (Place)
        data[11], // 타지마할 (건축물)
        data[22], // 포드 모델 T (Object)
        data[23], // 백열전구 (Object)
        data[34], // 아폴로 11호 달 착륙 (Event)
        data[35], // 노르망디 상륙 작전 (Event)
        data[6],  // 베토벤 (Person)
        data[47]  // 기자의 대피라미드 (Place)
    ].filter(Boolean);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = path.join(OUTPUT_ROOT, timestamp);
    ensureDir(outputDir);

    const indexItems = [];
    const failures = [];

    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        console.error(`[${i + 1}/${targets.length}] generating image for ${item.entity_name}...`);

        // Combine English prompt + Negative + Common Style Tail
        const rawPrompt = item.clue_3_image_prompt;
        const rawNegative = item.clue_3_image_negative;
        const negativeStr = rawNegative ? rawNegative : "human, people, text, watermark, signature, full body";

        // Construct the final prompt exactly matching the pilot format
        const prompt = `${rawPrompt}. ${COMMON_STYLE_TAIL}. Avoid ${negativeStr}.`;

        const baseName = `item_${String(i + 1).padStart(2, "0")}`;
        const rawJsonPath = path.join(outputDir, `${baseName}.json`);
        const originalPath = path.join(outputDir, `${baseName}.tmp.png`);
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

        // Slight delay to avoid aggressive rate limits
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 4000));
    }

    const indexPath = path.join(outputDir, "index.md");
    let content = "# Quiz Image Validation (Top 10 Pick)\n\n";
    for (const item of indexItems) {
        content += `## ${item.answer}\n\n`;
        content += `- **Korean Concept**: ${item.ko_concept}\n`;
        content += `- **English Prompt**: \n\`\`\`text\n${item.prompt}\n\`\`\`\n\n`;
        content += `![${item.answer}](${item.scaledFilename})\n\n`;
    }
    if (failures.length > 0) {
        content += "## Failures\n\n";
        for (const f of failures) content += `- ${f.answer}: ${f.error}\n`;
    }

    fs.writeFileSync(indexPath, content);
    console.log(`\nSuccessfully generated images!`);
    console.log(`Results saved in: ${outputDir}/index.md`);
}

main().catch(e => console.error(e));
