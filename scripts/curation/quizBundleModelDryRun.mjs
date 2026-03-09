#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.loadEnvFile?.(".env.local");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODELS = [
  "gemini-3-flash-preview",
];

const OUTPUT_DIR = path.join(process.cwd(), ".cache", "quiz-bundle-dryrun");

export const SAMPLE_TARGETS = [
  {
    canonical_answer: "마리 퀴리",
    entity_type: "person",
    anchor_year: 1898,
    present_day_region: "파리, 프랑스",
    short_context:
      "여성 과학자, 방사성 연구, 광석 정제, 연구의 육체적 대가",
  },
  {
    canonical_answer: "요하네스 구텐베르크",
    entity_type: "person",
    anchor_year: 1454,
    present_day_region: "마인츠, 독일",
    short_context:
      "금속 활자 인쇄, 금세공 배경, 압착 공방, 지식 복제의 속도 변화",
  },
  {
    canonical_answer: "장영실",
    entity_type: "person",
    anchor_year: 1438,
    present_day_region: "서울, 대한민국",
    short_context:
      "조선 궁정 기술자, 천문/계측 기구, 물시계, 제작자 정체성",
  },
  {
    canonical_answer: "양자역학",
    entity_type: "discovery_or_theory",
    anchor_year: 1927,
    present_day_region: "유럽 과학권",
    short_context:
      "관측과 확률, 보이지 않는 세계, 고전 물리학의 붕괴, 20세기 과학 혁명",
  },
  {
    canonical_answer: "안사의 난",
    entity_type: "event",
    anchor_year: 755,
    present_day_region: "중국 화북 지역",
    short_context:
      "당 제국의 대규모 반란, 절도사 권력, 장안과 낙양, 제국 질서 붕괴",
  },
];

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readUsage(usageMetadata = {}) {
  return {
    promptTokenCount: usageMetadata?.promptTokenCount ?? 0,
    candidatesTokenCount: usageMetadata?.candidatesTokenCount ?? 0,
    totalTokenCount: usageMetadata?.totalTokenCount ?? 0,
    thoughtsTokenCount: usageMetadata?.thoughtsTokenCount ?? 0,
  };
}

export function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function stripCodeFence(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .split("\n")
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();
}

export function tryParseJson(text) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function buildSystemPrompt() {
  return `
너는 카드형 역사 추론 게임 TimeGlobe의 수석 게임 기획자다.
너는 역사 지식이 해박하고, 문학적 장면 감각이 있으며, 약간의 유머 감각도 있다.
너의 일은 정보를 설명하는 것이 아니라 플레이어가 추리하고 싶게 만드는 것이다.

게임 설명:
- 플레이어는 주어진 단서를 보고 타임머신을 타고 사건이 일어난 시간과 장소를 맞춘다.
- 정답은 역사적 인물, 사건, 발명품, 위대한 발견, 건축물 같은 실제 역사 엔터티다.
- 문제는 카드 게임 형태로 소비된다.
- 공개 단서는 이미지 카드 3장, 문장 단서 1개, 히든 단서 1개다.

중요한 목표:
- 단서는 구글링 한 줄로 바로 풀리면 안 된다.
- 하지만 너무 난해해서 아무도 못 맞히면 그것도 실패다.
- 정답을 모르는 플레이어도 문명권, 시대대, 지역 정도는 좁혀 갈 수 있어야 한다.
- 결과를 본 뒤에는 "아, 그 사람이었구나", "아, 그 사건이었구나"라는 납득이 남아야 한다.

작성 규칙:
1. 교과서 요약처럼 쓰지 마라.
2. 위키피디아 첫 문장처럼 쓰지 마라.
3. 대표 업적만 뻔하게 반복하지 마라.
4. 덜 알려졌지만 역사적으로 납득 가능한 상징, 습관, 물건, 공간, 재료, 상황을 우선 써라.
4-1. 하지만 역사학자 수준의 지엽 지식이 없으면 접근조차 안 되는 문제는 실패다.
4-2. 한국의 일반 성인 사용자가 세계사 교양 수준에서 시대권과 지역권을 좁혀 갈 수 있어야 한다.
4-3. 각 문제에는 정답의 "대표 정체성"과 이어지는 공개 단서가 최소 1개는 있어야 한다. 단, 정답을 바로 말하는 방식은 금지한다.
4-4. 대표 정체성을 피하려고 너무 우회하다가 엉뚱한 문제를 만들면 실패다.
5. 이미지 단서는 검색어가 아니라 장면이어야 한다.
6. 이미지 단서는 초상화보다 행동, 도구, 환경, 재료, 흔적을 우선한다.
6-1. 이미지 단서는 정적인 한 장면으로 바로 이미지 생성 모델에 넘길 수 있어야 한다.
6-2. 군중, 복잡한 전투 파노라마, 읽히는 문자, 영웅 포스터 구도를 유도하는 단서는 피한다.
7. 문장 단서는 기억에 남아야 하지만, 그대로 검색창에 넣으면 바로 정답이 뜨는 문장은 피한다.
8. 유명한 명언은 가급적 피한다. 필요하면 덜 알려진 실제 문장이나 시대감 있는 수사 메모 문장으로 바꾼다.
9. 히든 단서는 방향을 잡아주는 결정적 단서지만, 거의 정답을 말해버리면 안 된다.
10. contextual_line은 실제 인용문처럼 보이면 실패다.
11. contextual_line은 기본적으로 수사 메모, 현장 메모, 시대 메모, 실험 메모 톤으로 쓴다.
12. contextual_line은 1인칭 회고, 일기, 독백, 유언, 자서전 문장처럼 쓰지 마라.
13. 실제 출처를 검증할 수 없다면 lesser_known_quote로 쓰지 말고 contextual_line으로 내려라.
14. lesser_known_quote는 예외값이다. 기본값은 contextual_line이다.
15. lesser_known_quote는 널리 알려지지 않았더라도 역사적으로 출처가 비교적 분명한 경우에만 사용한다.
16. 더 그럴듯해 보이게 만들기 위해 인용문을 창작해서는 안 된다.

안전 규칙:
- 정답의 시대와 충돌하는 물질문화나 분위기를 넣지 마라.
- 성별이 중요한 힌트가 될 경우 반대 성별로 오인시키는 단서를 만들지 마라.
- 정답과 모순되는 잘못된 인상을 주는 단서는 금지한다.
- 이미지 생성 네거티브 프롬프트 관점에서 crowd scene, complex battle panorama, readable text, hero poster composition을 유발하는 단서는 금지한다.

좋은 문제의 조건:
- 공개 단서만 봐도 플레이어가 머릿속으로 장면을 그릴 수 있다.
- 오답을 찍더라도 정답과 가까운 문명권/역할/시대에서 맴돈다.
- 히든 단서를 열면 "아차" 하는 기분이 든다.
- contextual_line은 누가 직접 한 말이 아니라, 누군가가 현장을 보고 적은 게임용 메모처럼 읽혀야 한다.
- 지나친 모호성 때문에 "아무 시대, 아무 지역이나 될 수 있는" 문제로 흐르면 실패다.
- 대표 정체성을 완전히 숨기지 말고, 간접적이지만 학습 가능한 형태로 남겨야 한다.
  `.trim();
}

export function buildUserPrompt(targets) {
  const targetsBlock = targets
    .map((target, index) => {
      return [
        `### 타깃 ${index + 1}`,
        `- canonical_answer: ${target.canonical_answer}`,
        `- entity_type: ${target.entity_type}`,
        `- anchor_year: ${target.anchor_year}`,
        `- present_day_region: ${target.present_day_region}`,
        `- short_context: ${target.short_context}`,
      ].join("\n");
    })
    .join("\n\n");

  return `
아래 5개 타깃에 대해 각각 문제 번들을 만들어라.

질문 의도:
- 카드 게임용 문제를 만들려는 것이다.
- 답을 설명하지 말고, 단서만으로 플레이어가 추리하게 만들어라.
- 이미지 3장, 문장 1개, 히든 단서 1개 구조를 유지하라.
- 단서는 구글링으로 쉽게 뚫리지 않되, 생각하거나 검색을 동원하면 점차 좁혀질 수 있어야 한다.

반드시 아래 출력 스키마를 지켜라.
- JSON만 출력
- Markdown 금지
- 설명문 금지

출력 스키마:
{
  "bundles": [
    {
      "canonical_answer": "정답명",
      "entity_type": "person | event | invention | discovery_or_theory | architecture | artwork",
      "why_this_is_good_for_gameplay": "이 정답이 왜 추론 게임 문제로 좋은지 한두 문장",
      "image_clues": [
        {
          "title": "카드 1 요약 제목",
          "brief": "이미지 카드용 장면 설명 1개",
          "render_prompt": "이미지 생성 모델에 바로 넣을 수 있는 장면 프롬프트 1개",
          "render_negative_prompt": "이 카드에만 적용할 네거티브 프롬프트 1개"
        },
        {
          "title": "카드 2 요약 제목",
          "brief": "이미지 카드용 장면 설명 1개",
          "render_prompt": "이미지 생성 모델에 바로 넣을 수 있는 장면 프롬프트 1개",
          "render_negative_prompt": "이 카드에만 적용할 네거티브 프롬프트 1개"
        },
        {
          "title": "카드 3 요약 제목",
          "brief": "이미지 카드용 장면 설명 1개",
          "render_prompt": "이미지 생성 모델에 바로 넣을 수 있는 장면 프롬프트 1개",
          "render_negative_prompt": "이 카드에만 적용할 네거티브 프롬프트 1개"
        }
      ],
      "image_negative_prompt": "공통 네거티브 프롬프트 1개",
      "image_context_anchor": "이미지 생성에 필요한 시대/지역/문화권 앵커 1개",
      "core_recognition_anchor": "이 문제가 일반 교양권 플레이어에게 어떤 대표 정체성으로 연결되는지 한 줄",
      "line_kind": "authentic_quote | lesser_known_quote | contextual_line",
      "line": "문장 단서 1개",
      "hidden_hint": "결정적 힌트 1개",
      "difficulty_estimate": 1,
      "search_resistance_notes": [
        "이 문제가 왜 검색 한 줄로 바로 무너지지 않는지",
        "어떤 오답이 유도될 수 있는지"
      ]
    }
  ]
}

세부 규칙:
- image_clues는 실제 이미지 생성 모델에 넘길 수 있을 정도로 장면 중심이어야 한다.
- image_clues는 초상화, 정답 장소 정면 전경, 읽히는 텍스트, 유명 표어에 의존하지 마라.
- image_clues[*].render_prompt는 후속 변환 없이 이미지 생성 모델에 바로 넣을 수 있어야 한다.
- render_prompt는 반드시 시대, 지역, 문화권 앵커를 포함해야 한다.
- render_prompt는 사람을 보여줄지 말지, 어떤 공간과 재질이 보여야 하는지까지 직접 써라.
- render_prompt는 서양 default, 현대 default, 남성 default로 오인될 수 있는 대상이면 그걸 막는 표현까지 포함하라.
- brief는 사람용 검토 텍스트이고, render_prompt는 모델용 실행 텍스트다. 둘을 구분해서 써라.
- render_negative_prompt는 카드 단위 위험요소를 직접 막는 용도다. 예: European ship interior, male workers, readable text, crowd scene.
- image_negative_prompt는 실제 이미지 생성 단계에 공통으로 붙일 수 있는 짧은 네거티브 프롬프트여야 한다.
- image_context_anchor는 이미지 생성 모델이 서양 default, 현대 default, 남성 default로 흐르지 않도록 잡아 주는 시대/지역/문화권 문장이어야 한다.
- image_context_anchor는 예: "late 16th century Joseon Korea naval setting", "early 20th century Paris scientific workbench", "7th century Asuka Japan court setting" 같이 구체적으로 쓴다.
- core_recognition_anchor는 지나친 모호성을 막기 위한 안전장치다. 대표 업적이나 대표 정체성을 직접 답처럼 쓰지 말고, 일반 교양권 플레이어가 정답 축을 떠올릴 수 있는 간접 연결점으로 쓴다.
- image_negative_prompt에는 반드시 crowd scene, complex battle panorama, readable text, hero poster composition을 포함하라.
- line은 너무 유명한 명언이면 안 된다.
- contextual_line은 실제 인용처럼 보이면 안 된다.
- contextual_line은 1인칭 발화 대신 관찰자 시점의 짧은 메모로 써라.
- contextual_line은 가능하면 '현장 메모:', '수사 메모:', '시대 메모:', '실험 메모:' 같은 게임 노트 톤을 활용하라.
- lesser_known_quote는 기본 선택지가 아니다. 정말로 출처 신뢰가 높고 과하게 유명하지 않을 때만 사용하라.
- lesser_known_quote와 authentic_quote만 실제 인용문처럼 보여도 된다.
- 출처를 확신할 수 없는 문장을 억지로 인용문처럼 쓰지 마라.
- 조금이라도 출처가 애매하면 lesser_known_quote를 포기하고 contextual_line으로 내려라.
- hidden_hint는 정답을 거의 말해버리지 말고, 방향을 잡아주는 수준으로 써라.
- difficulty_estimate는 1~5 정수로 준다.
- 각 번들은 서로 톤이 비슷하지 않게, 각 대상의 개성이 살아야 한다.
- 가능하면 플레이어가 "이건 누구지?"보다 "이건 어느 시대, 어느 지역 냄새가 나지?"를 먼저 느끼게 써라.
- 문제를 "덜 알려진 사실"만으로 구성하지 마라. 적어도 한 개의 공개 단서는 정답의 핵심 정체성에 연결되어야 한다.
- 세종대왕처럼 대표 업적이 지나치게 핵심인 인물은, 그 축을 완전히 피하지 말고 간접적으로라도 남겨야 한다.
- 덴지 천황처럼 지엽 지식 없이는 접근이 어려운 대상은, 억지로 미스터리하게 쓰지 말고 시대·개혁·정치 전환처럼 학습 가능한 앵커를 먼저 확보하라.
- 출력은 "사람이 검토할 문제 데이터"와 "이미지 생성에 바로 쓰는 프롬프트"를 한 번에 묶어서 내야 한다.

문장 단서 예시:
- 좋은 contextual_line: "현장 메모: 좁은 물길을 먼저 읽는 지휘관의 전장이다. 배보다 바다가 먼저 무기였다."
- 좋은 contextual_line: "시대 메모: 글과 별, 비와 시간을 하나의 체계로 묶으려는 통치자의 냄새가 난다."
- 나쁜 contextual_line: "오늘 밤은 유독 물소리가 깊다."
- 나쁜 contextual_line: "내 눈이 침침해져 책을 읽기 어렵다."

타깃 목록:

${targetsBlock}
  `.trim();
}

export async function callGemini({ model, systemPrompt, userPrompt }) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini ${model} failed: ${response.status} ${rawText.slice(0, 500)}`);
  }

  const payload = JSON.parse(rawText);
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";

  return {
    model,
    rawResponse: payload,
    text,
    parsed: tryParseJson(text),
    usageMetadata: payload?.usageMetadata || null,
  };
}

async function main() {
  const run = hasFlag("--run");
  const modelsArg = getArg("--models", DEFAULT_MODELS.join(","));
  const targetsFileArg = getArg("--targets-file");
  const models = modelsArg
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const targets = targetsFileArg
    ? readJsonFile(path.resolve(process.cwd(), targetsFileArg))
    : SAMPLE_TARGETS;

  const stamp = nowStamp();
  const runDir = path.join(OUTPUT_DIR, stamp);
  ensureDir(runDir);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(targets);

  fs.writeFileSync(
    path.join(runDir, "system-prompt.txt"),
    `${systemPrompt}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(runDir, "user-prompt.txt"),
    `${userPrompt}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(runDir, "targets.json"),
    JSON.stringify(targets, null, 2),
    "utf8"
  );

  if (!run) {
    console.log(`Dry run saved to ${runDir}`);
    console.log("\n=== system prompt ===\n");
    console.log(systemPrompt);
    console.log("\n=== user prompt ===\n");
    console.log(userPrompt);
    console.log(
      `\nRun with: node scripts/curation/quizBundleModelDryRun.mjs --run --models ${models.join(",")}`
    );
    return;
  }

  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const results = [];
  for (const model of models) {
    console.log(`\n[run] ${model}`);
    try {
      const result = await callGemini({ model, systemPrompt, userPrompt });
      const usage = readUsage(result.usageMetadata);
      fs.writeFileSync(
        path.join(runDir, `${model}.raw.json`),
        JSON.stringify(result.rawResponse, null, 2),
        "utf8"
      );
      fs.writeFileSync(
        path.join(runDir, `${model}.text.txt`),
        `${result.text}\n`,
        "utf8"
      );
      fs.writeFileSync(
        path.join(runDir, `${model}.parsed.json`),
        JSON.stringify(result.parsed, null, 2),
        "utf8"
      );
      results.push({
        model,
        ok: true,
        parsed_ok: Boolean(result.parsed),
        usageMetadata: result.usageMetadata,
        usage,
        outputFile: `${model}.parsed.json`,
      });
      console.log(
        `[usage] ${model} prompt=${usage.promptTokenCount} output=${usage.candidatesTokenCount} total=${usage.totalTokenCount} thoughts=${usage.thoughtsTokenCount}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fs.writeFileSync(path.join(runDir, `${model}.error.txt`), `${message}\n`, "utf8");
      results.push({
        model,
        ok: false,
        parsed_ok: false,
        error: message,
        usage: readUsage(),
        outputFile: `${model}.error.txt`,
      });
      console.log(`[error] ${model} ${message}`);
    }
  }

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    JSON.stringify({ models, results }, null, 2),
    "utf8"
  );

  const lines = [
    "model,ok,prompt_tokens,output_tokens,total_tokens,thoughts_tokens,parsed_ok",
    ...results.map((result) => {
      const usage = result.usage;
      return [
        result.model,
        result.ok,
        usage.promptTokenCount,
        usage.candidatesTokenCount,
        usage.totalTokenCount,
        usage.thoughtsTokenCount,
        result.parsed_ok,
      ].join(",");
    }),
  ];
  fs.writeFileSync(path.join(runDir, "usage.csv"), `${lines.join("\n")}\n`, "utf8");

  console.log(`\nSaved model comparison to ${runDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
