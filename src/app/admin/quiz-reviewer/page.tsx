import React from 'react';
import fs from 'fs';
import path from 'path';
import ReviewCard from './ReviewCard';

export const dynamic = 'force-dynamic';

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

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-300 p-8 font-sans">
            <header className="max-w-7xl mx-auto mb-10 border-b border-zinc-800 pb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">AI Curation Review</h1>
                    <p className="text-zinc-500 mt-2 text-sm tracking-wide">
                        50 Target Validation Phase | AI Engine: Gemini 3.1 Pro
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
                    data.map((item: any, idx: number) => (
                        <ReviewCard key={item.id || idx} item={item} />
                    ))
                )}
            </div>
        </div>
    );
}
