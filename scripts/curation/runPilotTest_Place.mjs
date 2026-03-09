#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

try { process.loadEnvFile?.(".env.local"); } catch { }
try { if (!process.env.GEMINI_API_KEY) process.loadEnvFile?.(".env"); } catch { }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MODELS = [
    "gemini-1.5-pro",
    "gemini-2.5-pro",
    "gemini-2.0-flash-thinking-exp-01-21"
];

const TARGETS = [
    { answer: "그랜드 캐니언", type: "place", region: "미국 애리조나" },
    { answer: "콜로세움", type: "place", region: "고대 로마" },
    { answer: "체르노빌 원자력 발전소", type: "place", region: "소련 (우크라이나)" },
    { answer: "마추픽추", type: "place", region: "잉카 제국 (페루)" },
    { answer: "기자의 대피라미드", type: "place", region: "고대 이집트" }
];

const SYSTEM_PROMPT = `너는 역사 추론 퀴즈 게임 TimeGlobe의 수석 게임 기획자다.
너의 목표는 검색 한 줄로 풀리지 않는, 추론을 통해 아하! 모먼트를 주는 퀴즈를 만드는 것이다.

[카테고리별 규칙]
1. 장소 / 공간 / 유적 (Place)
- 텍스트 단서: 이 공간의 흥망성쇠를 지켜본 오랜 현지인이나 무명의 여행자 시점. 완공 연도나 고유 랜드마크 명칭 배제. 냄새, 발소리, 밟히는 돌바닥의 질감 등 장소가 주는 압도적인 분위기나 감각을 현장 스케치처럼 묘사.
- 프롬프트: 거대한 풍경 샷(스카이라인, 건물 전면부 파사드) 절대 금지. 바닥 질감, 벽 끝, 부서진 건축 양식이나 낡은 파편의 초근접 클로즈업.

[공통 규칙]
- 공개 단서: 텍스트 2개 (도입부), 시각 단서 프롬프트 1장, 심화 텍스트 단서 1개
- 문장 단서는 1인칭 명언을 피하고 관찰 일지나 현장 메모 톤으로 쓴다.
- 이미지 프롬프트는 사람이 안나오도록 render_negative_prompt 명시 (crowd, human, text 등).
- 히든 단서(결정적 힌트)는 정답을 직접 노출하지 않고 카테고리를 좁혀준다 (예: "대자연의 협곡").`;

const USER_PROMPT = `아래 5개 장소/공간 타깃에 대해 게임용 번들을 생성하라. 출력을 JSON 스키마에 맞게 줘. 마크다운 백틱없이 순수 JSON만.
출력 스키마:
{
  "bundles": [
    {
      "canonical_answer": "정답명",
      "entity_type": "place",
      "text_clues_phase_1": ["문서 조각 1", "문서 조각 2"],
      "visual_clue_phase_2": {
        "title": "시각 제목",
        "render_prompt": "이미지 생성기용 극사실주의 매크로 프롬프트",
        "render_negative_prompt": "금지 요소"
      },
      "text_clue_phase_3": "후일담",
      "hidden_hint": "결정적 분류/키워드",
      "difficulty_estimate": 1,
      "core_recognition_anchor": "일반인 교양 연결점"
    }
  ]
}

타깃:
` + TARGETS.map((t, i) => `${i + 1}. ${t.answer} (${t.region})`).join("\n");

function stripCodeFence(text) {
    if (!text) return text;
    const trimmed = text.trim();
    if (!trimmed.startsWith("```")) return trimmed;
    return trimmed.split("\n").filter((line) => !line.trim().startsWith("```")).join("\n").trim();
}

async function callGemini(model) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: USER_PROMPT }] }],
        generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 8192 },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const rawText = await response.text();
        if (!response.ok) {
            return { model, error: `Failed: ${response.status}` };
        }

        const payload = JSON.parse(rawText);
        const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim() || "";

        let parsed = null;
        try {
            const cleaned = stripCodeFence(text);
            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");
            if (start >= 0 && end > start) {
                parsed = JSON.parse(cleaned.slice(start, end + 1));
            }
        } catch { }

        return { model, text, parsed };
    } catch (err) {
        return { model, error: err.message };
    }
}

async function main() {
    if (!GEMINI_API_KEY) {
        console.error("Missing GEMINI_API_KEY");
        process.exit(1);
    }

    const outDir = path.join(process.cwd(), ".cache", "pilot_test_place");
    fs.mkdirSync(outDir, { recursive: true });

    for (const model of MODELS) {
        console.log(`Running ${model}...`);
        const res = await callGemini(model);
        if (res.error) {
            console.error(`[${model}] Error: ${res.error}`);
        } else {
            console.log(`[${model}] Success. Parsed: ${Boolean(res.parsed)}`);
            fs.writeFileSync(path.join(outDir, `${model}.json`), JSON.stringify(res.parsed || { raw: res.text }, null, 2));
        }
    }
    console.log("Done! Check .cache/pilot_test_place");
}

main();
