#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "data/curation/quiz_candidates/internal_test_500_candidates.json");
const OUTPUT_DIR = path.join(ROOT, "data/curation/quiz_candidates");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "internal_test_curated_50_candidates.json");

const MUST_HAVE_50 = [
  { canonical_answer: "세종대왕", entity_type: "person", candidate_bucket: "person", anchor_year: 1443, present_day_region: "서울, 대한민국", short_context: "조선 군주, 문자 체계 정비, 집현전, 천문과 계측 기구, 백성 중심 통치" },
  { canonical_answer: "이순신", entity_type: "person", candidate_bucket: "person", anchor_year: 1597, present_day_region: "전라남도 해역, 대한민국", short_context: "조선 수군 지휘관, 해협 전술, 물살, 전투 일지, 소수 함대" },
  { canonical_answer: "장영실", entity_type: "person", candidate_bucket: "person", anchor_year: 1438, present_day_region: "서울, 대한민국", short_context: "조선 궁정 기술자, 물시계, 천문 기구, 제작자 정체성" },
  { canonical_answer: "진시황", entity_type: "person", candidate_bucket: "person", anchor_year: -221, present_day_region: "시안권, 중국", short_context: "중국 통일 군주, 도량형 통일, 도로와 토목, 거대한 무덤과 병마용" },
  { canonical_answer: "클레오파트라 7세 필로파토르", entity_type: "person", candidate_bucket: "person", anchor_year: -48, present_day_region: "알렉산드리아, 이집트", short_context: "프톨레마이오스 왕조의 마지막 군주, 나일강, 로마 정치와 얽힌 지중해 권력극" },
  { canonical_answer: "아소카 대왕", entity_type: "person", candidate_bucket: "person", anchor_year: -260, present_day_region: "인도 북부", short_context: "마우리아 황제, 칼링가 전쟁 이후의 전향, 돌기둥 칙령, 불교 후원" },
  { canonical_answer: "징기스칸", entity_type: "person", candidate_bucket: "person", anchor_year: 1206, present_day_region: "몽골 고원, 몽골", short_context: "초원 유목 군주, 기마 전술, 부족 통합, 술데, 역참" },
  { canonical_answer: "티무르", entity_type: "person", candidate_bucket: "person", anchor_year: 1402, present_day_region: "사마르칸트권, 우즈베키스탄", short_context: "중앙아시아 정복 군주, 사마르칸트, 기마 원정, 전리품 도시 건설" },
  { canonical_answer: "만사 무사", entity_type: "person", candidate_bucket: "person", anchor_year: 1324, present_day_region: "말리 제국 권역, 말리", short_context: "서아프리카 군주, 황금, 사하라 교역, 메카 순례, 팀북투" },
  { canonical_answer: "알렉산드리아의 헤론", entity_type: "person", candidate_bucket: "person", anchor_year: 60, present_day_region: "알렉산드리아, 이집트", short_context: "고대 공학자, 자동장치, 증기 구, 신전 기계, 톱니와 도르래" },
  { canonical_answer: "이븐 알하이삼", entity_type: "person", candidate_bucket: "person", anchor_year: 1020, present_day_region: "카이로권, 이집트", short_context: "광학 연구, 카메라 옵스큐라, 빛과 시각, 관찰 중심 학문" },
  { canonical_answer: "알-자자리", entity_type: "person", candidate_bucket: "person", anchor_year: 1206, present_day_region: "디야르바크르권, 튀르키예", short_context: "수력 장치, 자동기계, 톱니와 축, 중세 이슬람권 기계공학" },
  { canonical_answer: "요하네스 구텐베르크", entity_type: "person", candidate_bucket: "person", anchor_year: 1454, present_day_region: "마인츠, 독일", short_context: "금속 활자 인쇄, 금세공 배경, 압착 공방, 지식 복제" },
  { canonical_answer: "갈릴레오 갈릴레이", entity_type: "person", candidate_bucket: "person", anchor_year: 1610, present_day_region: "이탈리아", short_context: "망원 관측, 목성의 위성, 고전 우주관 붕괴, 재판과 검열" },
  { canonical_answer: "마리 퀴리", entity_type: "person", candidate_bucket: "person", anchor_year: 1898, present_day_region: "파리, 프랑스", short_context: "여성 과학자, 방사성 연구, 광석 정제, 발광, 연구의 육체적 대가" },
  { canonical_answer: "마르코 폴로", entity_type: "person", candidate_bucket: "person", anchor_year: 1298, present_day_region: "베네치아-원 제국권", short_context: "여행자, 동서 교역로, 쿠빌라이 칸의 궁정, 긴 여정의 기록" },
  { canonical_answer: "샤카 줄루", entity_type: "person", candidate_bucket: "person", anchor_year: 1820, present_day_region: "콰줄루나탈권, 남아프리카공화국", short_context: "줄루 군주, 짧은 창, 연령 집단 군제, 남아프리카 초원" },
  { canonical_answer: "넬슨 만델라", entity_type: "person", candidate_bucket: "person", anchor_year: 1994, present_day_region: "프리토리아-요하네스버그권, 남아프리카공화국", short_context: "장기 수감, 민주 전환, 화해, 인종차별 철폐 이후 정치" },

  { canonical_answer: "조선", entity_type: "event", candidate_bucket: "polity", anchor_year: 1392, present_day_region: "한반도, 대한민국", short_context: "조선 왕조 국가, 궁궐, 유교 관료제, 문자와 과학, 한양 중심 통치" },
  { canonical_answer: "로마 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: -27, present_day_region: "로마, 이탈리아", short_context: "지중해 제국, 군단, 도로망, 원형경기장, 장기 지속 통치" },
  { canonical_answer: "오스만 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 1453, present_day_region: "이스탄불, 튀르키예", short_context: "장기 지속 제국, 성채, 해협, 군사-행정 융합, 대도시 지배" },
  { canonical_answer: "몽골 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 1206, present_day_region: "몽골 고원, 몽골", short_context: "초원 기반 제국, 기마 전술, 유목 통합, 장거리 전달망" },
  { canonical_answer: "동로마 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 527, present_day_region: "콘스탄티노폴리스, 튀르키예", short_context: "그리스도교 제국, 성채 도시, 황실 의례, 동지중해 교역" },
  { canonical_answer: "원나라", entity_type: "event", candidate_bucket: "polity", anchor_year: 1271, present_day_region: "베이징권, 중국", short_context: "몽골계 중국 왕조, 대도, 초원과 농경 제국의 결합" },
  { canonical_answer: "마우리아 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: -322, present_day_region: "인도 북부", short_context: "인도 고대 제국, 왕도, 칙령, 정복과 개종, 코끼리와 돌기둥" },
  { canonical_answer: "크메르 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 1100, present_day_region: "앙코르권, 캄보디아", short_context: "앙코르, 거대한 수리 체계, 사원 도시, 동남아 제국" },
  { canonical_answer: "우마이야 칼리파조", entity_type: "event", candidate_bucket: "polity", anchor_year: 715, present_day_region: "다마스쿠스, 시리아", short_context: "초기 이슬람 제국, 사막과 도시 정복, 모스크, 행정 확장" },
  { canonical_answer: "페르시아 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: -500, present_day_region: "이란권", short_context: "왕의 길, 사트라프 행정, 궁전 부조, 고대 제국" },
  { canonical_answer: "잉카 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 1500, present_day_region: "안데스, 페루", short_context: "산악 제국, 계단식 경작, 돌길, 쿠스코 중심 통치" },
  { canonical_answer: "사산 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 500, present_day_region: "이란권", short_context: "조로아스터교 왕조, 로마와 경쟁, 궁정 의례, 비단길" },
  { canonical_answer: "로마 공화국", entity_type: "event", candidate_bucket: "polity", anchor_year: -146, present_day_region: "로마, 이탈리아", short_context: "원로원, 군단, 공화정, 포럼, 제국 이전의 팽창" },
  { canonical_answer: "일본 제국", entity_type: "event", candidate_bucket: "polity", anchor_year: 1937, present_day_region: "도쿄, 일본", short_context: "근대 동아시아 제국, 제복, 동원 체제, 군국주의, 식민 확장" },
  { canonical_answer: "그란콜롬비아", entity_type: "event", candidate_bucket: "polity", anchor_year: 1821, present_day_region: "북남미 북부", short_context: "독립 전쟁 이후 신생 공화국, 안데스 정치 실험" },

  { canonical_answer: "아테네", entity_type: "place", candidate_bucket: "place", anchor_year: -430, present_day_region: "아테네, 그리스", short_context: "고대 도시, 민주정, 비극, 철학, 공공 광장 문화" },
  { canonical_answer: "알렉산드리아", entity_type: "place", candidate_bucket: "place", anchor_year: -250, present_day_region: "알렉산드리아, 이집트", short_context: "고대 항구 도시, 도서관, 헬레니즘, 학문과 교역의 결절점" },
  { canonical_answer: "델리", entity_type: "place", candidate_bucket: "place", anchor_year: 1206, present_day_region: "델리, 인도", short_context: "인도 북부 수도권, 왕조 교체, 성채 도시, 관문 도시" },
  { canonical_answer: "교토시", entity_type: "place", candidate_bucket: "place", anchor_year: 794, present_day_region: "교토시, 일본", short_context: "일본 전근대 수도, 궁정 의례, 사찰과 정원, 목조 도시" },
  { canonical_answer: "팀북투", entity_type: "place", candidate_bucket: "place", anchor_year: 1325, present_day_region: "팀북투, 말리", short_context: "서아프리카 학문 도시, 사막 교역, 진흙 건축, 필사본" },
  { canonical_answer: "테노치티틀란", entity_type: "place", candidate_bucket: "place", anchor_year: 1325, present_day_region: "멕시코시티권, 멕시코", short_context: "아즈텍 수도, 호수 위 도시, 둑길과 제단, 시장과 제국" },
  { canonical_answer: "메디나", entity_type: "place", candidate_bucket: "place", anchor_year: 622, present_day_region: "메디나, 사우디아라비아", short_context: "초기 이슬람 도시, 종교 공동체, 오아시스 도시, 순례 축" },
  { canonical_answer: "히로시마시", entity_type: "place", candidate_bucket: "place", anchor_year: 1945, present_day_region: "히로시마시, 일본", short_context: "근현대 도시, 파괴와 재건, 강과 다리, 20세기 전환점" },
  { canonical_answer: "아디스아바바", entity_type: "place", candidate_bucket: "place", anchor_year: 1896, present_day_region: "아디스아바바, 에티오피아", short_context: "에티오피아 수도, 고원 도시, 제국과 근대화, 외교 중심지" },
  { canonical_answer: "방콕", entity_type: "place", candidate_bucket: "place", anchor_year: 1782, present_day_region: "방콕, 태국", short_context: "강변 수도, 왕궁, 운하, 근세 동남아 왕도" },
  { canonical_answer: "암만", entity_type: "place", candidate_bucket: "place", anchor_year: 100, present_day_region: "암만, 요르단", short_context: "고대 유적과 현대 수도가 겹치는 레반트 도시" },
  { canonical_answer: "트빌리시", entity_type: "place", candidate_bucket: "place", anchor_year: 500, present_day_region: "트빌리시, 조지아", short_context: "코카서스 관문 도시, 온천, 언덕 성채, 국경 문화권의 혼합" },

  { canonical_answer: "명량 해전", entity_type: "event", candidate_bucket: "battle_disaster", anchor_year: 1597, present_day_region: "전라남도 해역, 대한민국", short_context: "해협, 급한 물살, 소수 함대, 조선-왜군, 병목 전투" },
  { canonical_answer: "스탈린그라드 전투", entity_type: "event", candidate_bucket: "battle_disaster", anchor_year: 1942, present_day_region: "볼고그라드, 러시아", short_context: "도시전, 폐허, 동부전선, 겨울과 포위, 산업 도시" },
  { canonical_answer: "테르모필레 전투", entity_type: "event", candidate_bucket: "battle_disaster", anchor_year: -480, present_day_region: "테르모필레, 그리스", short_context: "좁은 길목, 병목 지형, 고대 전투, 소수 저항, 해안 산맥" },
  { canonical_answer: "헤이스팅스 전투", entity_type: "event", candidate_bucket: "battle_disaster", anchor_year: 1066, present_day_region: "헤이스팅스, 영국", short_context: "중세 잉글랜드 전환점, 기병과 방진, 왕위 쟁탈전" },
  { canonical_answer: "2004년 인도양 지진해일", entity_type: "event", candidate_bucket: "battle_disaster", anchor_year: 2004, present_day_region: "인도양", short_context: "초거대 지진, 해일, 해안 파괴, 인도양 연안의 동시 재난" },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildLookup(candidates) {
  return new Map(candidates.map((candidate) => [candidate.canonical_answer, candidate]));
}

function main() {
  ensureDir(OUTPUT_DIR);

  const source = readJson(SOURCE_FILE);
  const existing = Array.isArray(source) ? source : source.candidates;
  const lookup = buildLookup(existing);

  const candidates = MUST_HAVE_50.map((item, index) => {
    const existingCandidate = lookup.get(item.canonical_answer);
    return {
      queue_index: index,
      answer_entity_id: existingCandidate?.answer_entity_id || item.canonical_answer,
      canonical_answer: item.canonical_answer,
      entity_type: item.entity_type,
      candidate_bucket: item.candidate_bucket,
      anchor_year: item.anchor_year,
      present_day_region: item.present_day_region,
      short_context: item.short_context,
      priority_source: "curated_must_have_50",
      source_file: "docs/develop/33_[co]internal_test_must_have_50_candidates.md",
    };
  });

  const payload = {
    summary: {
      generated_at: new Date().toISOString(),
      total: candidates.length,
      source: "must_have_50",
    },
    candidates,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: true, outputFile: OUTPUT_FILE, total: candidates.length }, null, 2));
}

main();
