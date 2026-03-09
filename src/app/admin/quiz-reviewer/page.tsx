import React from 'react';
import fs from 'fs';
import path from 'path';
import ReviewCard from './ReviewCard';

export const dynamic = 'force-dynamic';

const PILOT_IMAGE_V1_ROOT = '/quiz-image-pilot-new/2026-03-09T10-42-20-655Z';
const PILOT_IMAGE_V2_ROOT = '/quiz-image-pilot-v2/2026-03-09T11-26-08-462Z';
const MODEL_FOR_TEXT = "Gemini 3.1 Pro";
const MODEL_V1_FOR_IMAGE = "Gemini 2.5 Flash Image";
const MODEL_V2_FOR_IMAGE = "Gemini 3.1 Flash Image";

export default async function QuizReviewer() {
    let data = [];
    try {
        const filePath = path.join(process.cwd(), 'data', 'validation_temp.json');
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error(err);
    }

    const pilotIndicesV1 = new Set([0, 1, 10, 11, 23, 24, 25, 26, 27, 6]);
    const PILOT_IMAGE_V2_FINAL = '/quiz-image-pilot-v2/final';

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-300 p-8 font-sans">
            <header className="max-w-7xl mx-auto mb-10 border-b border-zinc-800 pb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">AI Curation Review</h1>
                    <p className="text-zinc-500 mt-2 text-sm tracking-wide flex flex-wrap gap-x-6 gap-y-2">
                        <span>50 Target Validation Phase (Hybrid Cost Strategy)</span>
                        <span className="text-zinc-700">|</span>
                        <span>Text: <b className="text-zinc-400">{MODEL_FOR_TEXT}</b></span>
                        <span className="text-zinc-700">|</span>
                        <span>Image V1: <b className="text-zinc-400">{MODEL_V1_FOR_IMAGE}</b></span>
                        <span className="text-zinc-700">|</span>
                        <span>Image V2: <b className="text-zinc-400">{MODEL_V2_FOR_IMAGE} (512px)</b></span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-zinc-400 text-sm font-medium">Validation Progress: <span className="text-white ml-2 text-lg">50</span> / 50</p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                {data.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-lg">아직 AI가 생성한 데이터가 없습니다.</p>
                        <p className="text-zinc-600 text-sm mt-2">백그라운드 스크립트 실행을 기다려주세요...</p>
                    </div>
                ) : (
                    data.map((item: any, idx: number) => {
                        let imageUrl = null;
                        let modelLabel = "";

                        // V1 logic (Original 10)
                        if (pilotIndicesV1.has(idx)) {
                            const v1Array = [0, 1, 10, 11, 23, 24, 25, 26, 27, 6];
                            const targetIdx = v1Array.indexOf(idx);
                            const baseName = `item_${String(targetIdx + 1).padStart(2, "0")}_500.png`;
                            imageUrl = `${PILOT_IMAGE_V1_ROOT}/${baseName}`;
                            modelLabel = "V1 (2.5 Flash)";
                        }

                        // V2 logic (Consolidated 40) - overwrite if V2 exists
                        const v2FileName = `item_${String(idx).padStart(2, "0")}_512.png`;
                        const v2FilePath = path.join(process.cwd(), 'public', 'quiz-image-pilot-v2', 'final', v2FileName);

                        if (fs.existsSync(v2FilePath)) {
                            imageUrl = `${PILOT_IMAGE_V2_FINAL}/${v2FileName}`;
                            modelLabel = "V2 (3.1 Flash)";
                        }

                        return <ReviewCard key={item.id || idx} item={item} imageUrl={imageUrl} imageLabel={modelLabel} />;
                    })
                )}
            </div>
        </div>
    );
}
