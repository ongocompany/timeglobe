import React from 'react';
import fs from 'fs';
import path from 'path';
import ReviewCard from './ReviewCard';

export const dynamic = 'force-dynamic';

const PILOT_IMAGE_ROOT = '/quiz-image-pilot-new/2026-03-09T10-42-20-655Z';
const MODEL_FOR_TEXT = "Gemini 3.1 Pro";
const MODEL_FOR_IMAGE = "Gemini 2.5 Flash Image";

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

    // Pilot targets indices (0-indexed) based on run_validation_images.mjs targets
    const pilotIndices = new Set([0, 1, 10, 11, 22, 23, 34, 35, 6, 47]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-300 p-8 font-sans">
            <header className="max-w-7xl mx-auto mb-10 border-b border-zinc-800 pb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">AI Curation Review</h1>
                    <p className="text-zinc-500 mt-2 text-sm tracking-wide flex gap-4">
                        <span>50 Target Validation Phase</span>
                        <span className="text-zinc-700">|</span>
                        <span>Text: <b className="text-zinc-400">{MODEL_FOR_TEXT}</b></span>
                        <span className="text-zinc-700">|</span>
                        <span>Image: <b className="text-zinc-400">{MODEL_FOR_IMAGE}</b></span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-zinc-400 text-sm font-medium">Total Generated: <span className="text-white ml-2 text-lg">{data.length}</span> / 50</p>
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
                        // Check if this item had a pilot image generated
                        let imageUrl = null;
                        if (pilotIndices.has(idx)) {
                            // Find the position in the target array to get the item_XX number
                            const targetIdx = [0, 1, 10, 11, 22, 23, 34, 35, 6, 47].indexOf(idx);
                            const baseName = `item_${String(targetIdx + 1).padStart(2, "0")}_500.png`;
                            imageUrl = `${PILOT_IMAGE_ROOT}/${baseName}`;
                        }

                        return <ReviewCard key={item.id || idx} item={item} imageUrl={imageUrl} />;
                    })
                )}
            </div>
        </div>
    );
}
