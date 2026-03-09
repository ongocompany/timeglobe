import fs from "fs";
import path from "path";

try { process.loadEnvFile?.(".env.local"); } catch { }
try { if (!process.env.GEMINI_API_KEY) process.loadEnvFile?.(".env"); } catch { }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.1-pro-preview";

const TARGETS = [
    { answer: "잔 다르크", category: "Person", desc: "마녀로 몰려 화형 당한 구국의 소녀" },
    { answer: "마리 앙투아네트", category: "Person", desc: "단두대의 이슬로 사라진 번쩍이는 왕비" },
    { answer: "율리우스 카이사르", category: "Person", desc: "믿었던 자들의 붉은 단검에 찔린 종신 독재자" },
    { answer: "빈센트 반 고흐", category: "Person", desc: "단 한 점 그림을 남기고 밀밭에서 스러진 천재 화가" },
    { answer: "사도세자", category: "Person", desc: "한여름 닫힌 나무상자에 갇혀 죽은 왕자" },
    { answer: "안중근", category: "Person", desc: "하얼빈역의 차가운 총성과 남겨진 피 묻은 손도장" },
    { answer: "베토벤", category: "Person", desc: "청력을 잃고도 교향곡을 완성한 불멸의 악성" },
    { answer: "소크라테스", category: "Person", desc: "독배를 마시고 담담히 죽음을 맞이한 철인" },
    { answer: "클레오파트라", category: "Person", desc: "독사에 물려 죽은 이집트의 마지막 핏줄" },
    { answer: "에이브러햄 링컨", category: "Person", desc: "포드 극장의 총성에 쓰러진 꺽다리 해방자" },
    { answer: "이순신", category: "Person", desc: "명량 앞바다의 고독한 장수" },
    { answer: "갈릴레오 갈릴레이", category: "Person", desc: "종교재판장에서도 지동설을 중얼거린 과학자" },
    { answer: "허준", category: "Person", desc: "역병을 막기 위해 낡은 의학 서적을 집대성한 어의" },

    { answer: "측우기", category: "Object", desc: "하늘의 비를 담아 풍흉을 재던 조선의 청동 그릇" },
    { answer: "구텐베르크 활판 인쇄기", category: "Object", desc: "세상을 바꾼 거대한 금속 활자의 무거운 압력" },
    { answer: "에니그마", category: "Object", desc: "독일군의 절대 풀리지 않던 은빛 타자기 암호 기계" },
    { answer: "스푸트니크 1호", category: "Object", desc: "인류 최초로 차가운 우주에서 들려온 섬뜩한 금속 기계음" },
    { answer: "팔만대장경", category: "Object", desc: "몽골의 말발굽을 막기 위해 산속에서 칼로 파낸 8만 장의 나무 숨결" },
    { answer: "청자 상감운학문 매병", category: "Object", desc: "학이 옥빛 하늘로 날아오르는 듯한 섬세한 도자기" },
    { answer: "모나리자", category: "Object", desc: "루브르에서 도둑맞으면서 세상에서 가장 거창해진 매혹적인 두 손" },
    { answer: "기요틴", category: "Object", desc: "프랑스 광장을 피로 물들인 묵직하고 서늘한 칼날" },
    { answer: "로제타 스톤", category: "Object", desc: "고대 이집트 상형문자의 봉인을 해제한 검고 무서운 현무암 비석" },
    { answer: "포드 모델 T", category: "Object", desc: "컨베이어 벨트가 끝없이 뱉어내던 검은 괴물 대중 자동차" },
    { answer: "백열전구", category: "Object", desc: "인간이 밤을 낮으로 강제로 바꾼 뜨거운 유리구슬" },
    { answer: "트로이 목마", category: "Object", desc: "성문 안으로 스스로 들이고 만 거대한 목재 조각상 속의 배신" },
    { answer: "축음기", category: "Object", desc: "허공에 흩어진 소리를 붙잡아 가둬놓은 금관 파이프 다이아몬드 기계" },

    { answer: "폼페이 화산 폭발", category: "Event", desc: "잿빛 비가 쏟아지며 그대로 숨이 막혀 박제되어 버린 로마의 환락 도시" },
    { answer: "타이타닉 호 침몰", category: "Event", desc: "거대한 빙산에 부딪혀 얼음장 같은 바다로 두 동강 나 가라앉은 불침선" },
    { answer: "보스턴 차 사건", category: "Event", desc: "바다를 거대한 찻잔으로 만들어버리며 대륙의 불씨를 당긴 밤" },
    { answer: "아폴로 11호 달 착륙", category: "Event", desc: "공백의 고요한 잿빛 표면 위에 영원히 짓눌려 남겨진 신발 자국" },
    { answer: "노르망디 상륙 작전", category: "Event", desc: "잿빛 구름 비 내리는 오마하 해변에서 벌어진 핏빛과 철조망의 엉킴" },
    { answer: "사라예보 사건", category: "Event", desc: "황태자를 향한 단 한 발의 총성이 폭발시킨 거대한 제국의 전쟁" },
    { answer: "체르노빌 원전 사고", category: "Event", desc: "조용한 새벽 시가지를 덮친 보이지 않는 방사능의 공포와 희생" },
    { answer: "살라미스 해전", category: "Event", desc: "거대 함대를 좁은 바다로 유인해 박살 낸 아테네의 불길과 부서진 나무판자" },
    { answer: "유럽 흑사병 창궐", category: "Event", desc: "까맣게 타들어 가며 유럽의 절반을 쥐도 새도 모르게 지워버린 전염병의 그림자" },
    { answer: "콘스탄티노플 함락", category: "Event", desc: "거대한 포탄에 속절없이 무너져 내린 제국의 가장 길고 절망적인 화요일" },
    { answer: "라이트 형제 첫 비행", category: "Event", desc: "모래바람을 가르며 자전거 수리공이 하늘을 찢고 중력을 거스른 12초" },
    { answer: "바스티유 감옥 습격", category: "Event", desc: "분노한 군중들이 거대한 돌벽을 맨손으로 부수고 화약고를 장악했던 환희의 날" },

    { answer: "콜로세움", category: "Place", desc: "피와 모래가 춤추고 짐승의 누린내가 진동하던 환호성의 원형 원형 투기장" },
    { answer: "마추픽추", category: "Place", desc: "안데스 산맥의 짙은 구름 속에 수백 년간 처절하게 숨겨진 버려진 공중 돌 도시" },
    { answer: "타지마할", category: "Place", desc: "제국의 황제가 죽은 아내를 위해 눈물로 깎아 지어 올린 완벽한 대칭의 하얀 대리석 궁전" },
    { answer: "베르사유 궁전", category: "Place", desc: "거울 갤러리와 눈부신 황금벽으로 도배되어 혁명의 도화선이 된 끝없는 사치와 폭정의 상징" },
    { answer: "아우슈비츠 수용소", category: "Place", desc: "끊임없이 피어오르는 탁한 회색 연기와 할퀴어진 벽돌 비극이 서려 있는 죽음의 공장" },
    { answer: "알렉산드리아 도서관", category: "Place", desc: "인류 고대의 모든 지식과 두루마리를 품었다가 잿가루로 불타버린 비운의 지식 저장소" },
    { answer: "만리장성", category: "Place", desc: "우주에서도 보인다는 전설 속에 핏빛 노역으로 쌓은 산등성이의 끝없는 돌장벽" },
    { answer: "스톤헨지", category: "Place", desc: "기괴하게 휘몰아치는 평원 한가운데 고대인들이 세워둔 미스터리하고 거대한 돌기둥 제단" },
    { answer: "페트라", category: "Place", desc: "붉은 사암의 좁고 어두운 협곡을 지나면 기적처럼 눈앞에 펼쳐지는 암벽을 파낸 고대 도시" },
    { answer: "기자의 대피라미드", category: "Place", desc: "불타는 사막 한가운데 수십만 개의 돌덩어리를 맨손으로 쌓아 올린 파라오 극단의 무덤" },
    { answer: "판테온", category: "Place", desc: "거대한 반구형 돔 중앙의 둥근 구멍을 뚫고 신의 시선처럼 햇빛이 수직으로 쏟아지는 로마의 신전" },
    { answer: "알함브라 궁전", category: "Place", desc: "이베리아 반도에 남겨진, 세밀한 조각과 물소리가 얽힌 이슬람 마지막 왕조의 눈물겨운 붉은 요새" }
];

const SYSTEM_PROMPT = `당신은 역사 추리 게임 TimeGlobe의 메인 기획자입니다.
주어진 역사적 타깃에 대해 게임용 4개의 단서(텍스트 2개, 이미지 프롬프트 1개, 결정적 힌트 1개)를 담은 JSON 포맷을 생성하세요.
1. Person: 주변인 혹은 방관자의 시점. 타깃의 이름 사용 금지. 문학적이고 극적인 심리/감각 묘사.
2. Object: 처음 이물을 맞닥뜨린 대중의 낯설고 충격적인 감각, 물성의 질감(소름 돋는) 묘사.
3. Event: 역사적 소용돌이에 휘말린 이름 없는 엑스트라(군중) 시점의 혼란과 공포 표출.
4. Place: 폐허 혹은 유적지를 방문한 현지 여행자(이방인)의 숨 막히고 서늘한 감각 묘사.

- clue_3_image_prompt: 반드시 초고화질 영문 프롬프트. 대상의 파편, 녹슨 질감, 특정 일부분을 극사실적 Macro(접사) 샷으로 묘사. 대상의 전체 형태나 정답을 암시하는 글자 포함 절대 금지.
- clue_3_image_negative: "human, people, text, watermark, signature, full body" 등 방해 요소 금지어.
- clue_4_decisive: 직접 정답 제외하고, 퀴즈의 마지막에 제공할 가장 명확하고 짧은 카테고리성 힌트.
`;

const USER_BASE = `JSON 응답 포맷만 반드시 반환:\n{\n  "bundles": [\n    {\n      "entity_name": "정답",\n      "category": "분류",\n      "clue_1_text": "단서 1",\n      "clue_2_text": "단서 2",\n      "clue_3_image_prompt": "영문 프롬프트",\n      "clue_3_image_negative": "금지 텍스트",\n      "clue_4_decisive": "결정적 힌트"\n    }\n  ]\n}\n\n목록:\n`;

function stripCodeFence(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t.startsWith("\`\`\`")) return t;
    return t.split("\n").filter((l) => !l.trim().startsWith("\`\`\`")).join("\n").trim();
}

async function runBatch(batch) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = USER_BASE + batch.map((t, i) => `${i + 1}. ${t.answer} (${t.desc})`).join("\n");
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: "user", parts: [{ text: prompt }] }],
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
        return parsed?.bundles || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function main() {
    const dbPath = path.join(process.cwd(), "data", "validation_temp.json");
    if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    let allResults = [];
    if (fs.existsSync(dbPath)) {
        try { allResults = JSON.parse(fs.readFileSync(dbPath, "utf8")); } catch (e) { }
    }

    const chunkSize = 5;
    for (let i = 0; i < TARGETS.length; i += chunkSize) {
        // Skip if already generated (Check by matching count loosely, or just override. Here we just run and append)
        // To prevent infinite appending if run multiple times, we clear only if it's the first run
        if (i === 0) allResults = [];
        console.log(`Processing batch ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(TARGETS.length / chunkSize)}...`);
        const batch = TARGETS.slice(i, i + chunkSize);
        const results = await runBatch(batch);
        if (results && results.length > 0) {
            allResults.push(...results.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9), status: "pending", comment: "" })));
            fs.writeFileSync(dbPath, JSON.stringify(allResults, null, 2));
        }
        await new Promise(r => setTimeout(r, 6000));
    }
    console.log("Done generating 50 items.");
}
main();
