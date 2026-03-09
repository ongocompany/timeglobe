#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

try { process.loadEnvFile?.(".env.local"); } catch { }
try { if (!process.env.GEMINI_API_KEY) process.loadEnvFile?.(".env"); } catch { }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.0-flash", // User requested 3.0, maybe 3.0-flash-preview
  "gemini-3.1-pro"    // User requested 3.1 pro, maybe 3.1-pro-preview
];

const TARGETS = [
  // Easy
  { answer: "이순신", type: "person", region: "조선 (한국)" },
  { answer: "타이타닉 호 침몰", type: "event", region: "북대서양" },
  { answer: "나침반", type: "object", region: "중국/세계" },
  { answer: "클레오파트라", type: "person", region: "이집트" },
  { answer: "아폴로 11호 달 착륙", type: "event", region: "달/미국" },
  // Medium
  { answer: "앙리 베크렐", type: "person", region: "프랑스" },
  { answer: "살라미스 해전", type: "event", region: "그리스" },
  { answer: "활판 인쇄술", type: "object", region: "신성로마제국" },
  // Hard
  { answer: "시모 해위해 (겨울전쟁 저격수)", type: "person", region: "핀란드" },
  { answer: "퉁구스카 폭발 사건", type: "event", region: "시베리아, 러시아" }
];

const SYSTEM_PROMPT = `너는 역사 추론 퀴즈 게임 TimeGlobe의 수석 게임 기획자다.
너의 목표는 검색 한 줄로 풀리지 않는, 추론을 통해 아하! 모먼트를 주는 퀴즈를 만드는 것이다.
카테고리별(인물, 사물/발명, 사건/전쟁) 특화 프롬프트 전략을 완벽히 수행해야 한다.

[카테고리별 규칙]
1. 인물 (Person)
- 텍스트 단서: 주변인(관찰자, 적)의 시점. 인물의 집념, 콤플렉스, 사소한 버릇 묘사. (직접적 이름, 직위, 국가명 절대 금지)
- 텍스트 톤: 가장 가까이서 지켜본 적, 혹은 이 인물 때문에 인생이 바뀐 무명의 관찰자.
- 이미지 프롬프트: 사람의 얼굴/몸 절대 배제. 평소 지니고 다닌 낡은 소지품이나 오래 머물렀던 공간의 빈 책상/의자 묘사.

2. 사물 / 발명 (Object)
- 텍스트 단서: 기능/스펙 설명 금지. 사회적 파장, 낯섦, 혜택, 혹은 예측 못한 결과를 관찰자 시점으로 서술. (발명가 이름, 발명 연도, 사물 이름 금지)
- 텍스트 톤: 이 사물이 처음 등장했을 때 혜택을 본 소시민, 혹은 그것 때문에 직업을 잃은 사람의 시점.
- 이미지 프롬프트: 사물의 전체 모습 배제. 결정적 부품의 초근접 클로즈업이나 사물로 남겨진 독특한 흔적/질감 묘사.

3. 사건 / 전쟁 / 재난 (Event)
- 텍스트 단서: 승패/거시적 조약 결과 금지. 사건 당일 날씨, 현장의 냄새, 귀를 때리는 굉음 등 미시적/감각적 부분 묘사. (전투명, 장군명, 특정 지명 절대 금지)
- 텍스트 톤: 사건 한가운데 휘말렸으나 역사에 이름 한 줄 남기지 못한 무명의 엑스트라 시점.
- 이미지 프롬프트: 전투 씬이나 군중 배제. 폭풍이 지나가고 난 뒤 남겨진 스산한 낡은 잔해물 하나를 묘사.

[공통 규칙]
- 공개 단서: 텍스트 2개 (도입부), 시각 단서 프롬프트 1장, 심화 텍스트 단서 1개
- 문장 단서는 1인칭이나 너무 유명한 명언을 쓰지 말고, 회고록, 현장 메모, 관찰 일지 톤으로 쓴다.
- 이미지 프롬프트는 사람의 피부나 텍스트가 절대 포함되지 않게 render_negative_prompt를 명시한다.
- 히든 단서(결정적 힌트)는 정답을 직접 치지 않고, "정복자", "사막 도시", "기계 장치", "천문학자" 같이 범주를 좁혀준다.`;

const USER_PROMPT = `아래 10개 정답 타깃에 대해 게임용 번들을 생성하라.
출력은 아래 JSON 스키마만 반환하라. markdown 백틱 금지.

출력 스키마:
{
  "bundles": [
    {
      "canonical_answer": "정답명",
      "entity_type": "person | event | object",
      "text_clues_phase_1": [
        "사건의 이면, 주변인의 시선을 담은 첫 번째 문서 조각 (수사/관찰 메모 톤)",
        "상상력을 자극하는 두 번째 문서 조각"
      ],
      "visual_clue_phase_2": {
        "title": "시각 단서 제목 요약",
        "render_prompt": "이미지 생성기용 극사실주의(macro/closeup/still-life) 프롬프트",
        "render_negative_prompt": "금지 요소 (예: crowd scene, human figure, text, numbers, portrait)"
      },
      "text_clue_phase_3": "사건의 결과나 후일담을 다루는 확신용 심화 문장",
      "hidden_hint": "점수를 희생해 여는 결정적 분류/직업/사건유형 힌트 (직접적 정답 단어 금지)",
      "difficulty_estimate": 1,
      "core_recognition_anchor": "일반 교양권 플레이어가 정답 축을 떠올릴 수 있는 간접 연결점"
    }
  ]
}

타깃:
` + TARGETS.map((t, i) => `${i + 1}. ${t.answer} (${t.type}, ${t.region})`).join("\n");

function stripCodeFence(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.split("\n").filter((line) => !line.trim().startsWith("```")).join("\n").trim();
}

async function callGemini(model) {
  let targetModel = model;

  const url = `${GEMINI_BASE}/${targetModel}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: USER_PROMPT }] }],
    generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 8192 },
  };

  try {
    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 404 && !targetModel.includes('-preview')) {
      console.log(`${targetModel} not found, trying ${targetModel}-preview`);
      targetModel = `${targetModel}-preview`;
      const url2 = `${GEMINI_BASE}/${targetModel}:generateContent?key=${GEMINI_API_KEY}`;
      response = await fetch(url2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    // Some models like 3.1-pro might not be available or named gemini-pro or 1.5-pro etc.
    if (!response.ok && response.status === 404 && targetModel.includes('3.1')) {
      console.log(`${targetModel} not found, trying gemini-1.5-pro for testing instead since 3.1 is early access`);
      targetModel = `gemini-1.5-pro`;
      const url3 = `${GEMINI_BASE}/${targetModel}:generateContent?key=${GEMINI_API_KEY}`;
      response = await fetch(url3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini ${model} failed: ${response.status} ${rawText.slice(0, 500)}`);
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

  const outDir = path.join(process.cwd(), ".cache", "pilot_test_10");
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
  console.log("Done! Check .cache/pilot_test_10");
}

main();
