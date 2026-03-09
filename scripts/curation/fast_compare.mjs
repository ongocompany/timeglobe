import fs from "fs";
try { process.loadEnvFile?.(".env.local"); } catch { }
try { if (!process.env.GEMINI_API_KEY) process.loadEnvFile?.(".env"); } catch { }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELS = ["gemini-3.1-pro-preview", "gemini-2.5-flash"];
const TARGETS = [
    { answer: "윤동주", type: "Person", desc: "방 한구석 별을 세며 죽어간 시인" },
    { answer: "축음기", type: "Object", desc: "소리를 가둬놓는 기계" }
];

const SYSTEM_PROMPT = `당신은 역사 퀴즈 게임 TimeGlobe 기획자입니다.
각 타깃당 4개의 단서(텍스트 2개, 이미지 프롬프트 1개, 결정적 힌트 1개)를 JSON으로 생성하세요.
1. Person: 주변인 시점. 이름 금지. 문학적이고 절망적인 극적 묘사.
2. Object: 처음 발명품을 본 대중의 충격, 소름 돋는 감각 묘사.

- clue_3_image_prompt: 반드시 영어. 대상의 파편/녹슨 질감을 극사실적 Macro(접사) 샷으로 묘사. 전체 형태/정답 글자 포함 금지.
- clue_3_image_negative: "human, people, text, watermark" 등.
- clue_4_decisive: 직접 정답 제외.
`;

const USER_PROMPT = `JSON 응답만:\n{\n  "bundles": [\n    {\n      "entity_name": "정답",\n      "category": "분류",\n      "clue_1_text": "단서 1",\n      "clue_2_text": "단서 2",\n      "clue_3_image_prompt": "영문 프롬프트",\n      "clue_3_image_negative": "금지 영문 프롬프트",\n      "clue_4_decisive": "결정적 힌트"\n    }\n  ]\n}\n\n목록:\n` + TARGETS.map((t, i) => `${i + 1}. ${t.answer}`).join("\n");

function stripCodeFence(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t.startsWith("```")) return t;
    return t.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
}

async function runModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: "user", parts: [{ text: USER_PROMPT }] }],
                generationConfig: { temperature: 0.8 }
            }),
        });
        const raw = await res.text();
        const text = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let parsed = null;
        try {
            const cleaned = stripCodeFence(text);
            parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
        } catch { }
        return { model, raw };
    } catch (err) {
        return { model, error: err.message };
    }
}

async function main() {
    const results = await Promise.all(MODELS.map(runModel));
    console.log(JSON.stringify(results, null, 2));
}
main();
