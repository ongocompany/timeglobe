import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_API_KEY}`;

async function runBatch() {
    const data = JSON.parse(fs.readFileSync('data/validation_temp.json', 'utf8'));
    let modified = false;

    for (let i = 0; i < data.length; i += 5) {
        const batch = data.slice(i, i + 5);
        const promises = batch.map(async (item) => {
            if (item.clue_3_image_concept_ko) return;
            const prompt = `Translate the following English image prompt into a natural, concise Korean visual concept description (1~2 sentences). Focus on the vivid material, texture, and mood. Example: "낡고 거친 느낌의 잿빛 콘크리트 바닥에 핏자국이 얼룩진 클로즈업 사진."\n\nPrompt: ${item.clue_3_image_prompt}`;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const responseData = await response.json();
                if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
                    item.clue_3_image_concept_ko = responseData.candidates[0].content.parts[0].text.trim();
                    console.log(`Added concept for: ${item.entity_name}`);
                    modified = true;
                }
            } catch (e) {
                console.error(`Failed for ${item.entity_name}`, e.message);
            }
        });

        await Promise.all(promises);
        console.log(`Finished batch ${Math.floor(i / 5) + 1}/10`);
        if (i + 5 < data.length) await new Promise(r => setTimeout(r, 6000));
    }

    if (modified) {
        fs.writeFileSync('data/validation_temp.json', JSON.stringify(data, null, 2));
    }
    console.log('Done adding KO concepts.');
}

runBatch();
