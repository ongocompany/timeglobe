#!/usr/bin/env node

import fs from "fs";
import path from "path";

function loadEnv() {
    const envFiles = [".env.local", ".env"];
    for (const f of envFiles) {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, "utf8");
            for (const line of content.split("\n")) {
                const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let val = match[2].trim();
                    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                    if (!process.env[key]) process.env[key] = val;
                }
            }
        }
    }
}
loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash"
];

const TARGETS = [
    { answer: "윤동주", type: "Person", desc: "시인" },
    { answer: "축음기", type: "Object", desc: "녹음장치" },
    { answer: "흑사병", type: "Event", desc: "유행병" },
    { answer: "그랜드 캐니언", type: "Place", desc: "대협곡" }
];

const SYSTEM_PROMPT = `당신은 역사 퀴즈 TimeGlobe 기획자입니다.
타깃당 4개의 단서(텍스트 2, 이미지 프롬프트 1, 결정적 힌트 1)를 생성하세요.
1. Person: 주변인 시점.
2. Object: 기능적 충격과 질감.
3. Event: 엑스트라 시점의 혼란.
4. Place: 현지 여행자의 감각 묘사.

- 이미지 프롬프트(clue_3_image_prompt)는 영문 작성. 파편/얼룩 등 Macro 샷 필수. 전체 윤곽 절대 불가.
- clue_4_decisive는 큰 범주만 묘사 (이름 금지).`;

const USER_PROMPT = `순수한 JSON 응답만:\\n{\n  "bundles": [\n    {\n      "entity_name": "정답",\n      "category": "분류",\n      "clue_1_text": "단서 1",\n      "clue_2_text": "단서 2",\n      "clue_3_image_prompt": "이미지 영어 프롬프트",\n      "clue_3_image_negative": "금지 영어 프롬프트",\n      "clue_4_decisive": "마지막 힌트"\n    }\n  ]\n}\\n\\n목록:\\n` + TARGETS.map((t, i) => `${i + 1}. ${t.answer}`).join("\n");

function stripCodeFence(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t.startsWith("```")) return t;
    return t.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
}

async function callGemini(modelName) {
    const url = `${GEMINI_BASE}/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: USER_PROMPT }] }],
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const raw = await res.text();
        if (!res.ok) return { model: modelName, error: raw };

        const payload = JSON.parse(raw);
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let parsed = null;
        try {
            const cleaned = stripCodeFence(text);
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");
            if (start >= 0 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch { }

        return { model: modelName, parsed: parsed || text };
    } catch (err) {
        return { model: modelName, error: err.message };
    }
}

async function main() {
    const outDir = path.join(process.cwd(), ".cache", "pilot_test_final");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    for (const model of MODELS) {
        let res = await callGemini(model);
        fs.writeFileSync(path.join(outDir, `${model}.json`), JSON.stringify(res, null, 2));
    }
}

main();
