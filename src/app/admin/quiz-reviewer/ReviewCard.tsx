"use client";

import React, { useState } from 'react';

export default function ReviewCard({ item }: { item: any }) {
    const [status, setStatus] = useState(item.status || "pending");
    const [comment, setComment] = useState(item.comment || "");
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        setSaved(false);
        try {
            const res = await fetch('/api/curation/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, status, comment })
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) {
            console.error(e);
        }
        setIsSaving(false);
    };

    const getStatusBorder = () => {
        if (status === "confirmed") return "border-emerald-600/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
        if (status === "rejected") return "border-rose-600/50 shadow-[0_0_15px_rgba(225,29,72,0.1)]";
        return "border-zinc-800 hover:border-zinc-700";
    };

    return (
        <div className={`bg-zinc-900 rounded-xl p-8 flex flex-col lg:flex-row gap-10 border transition-all duration-300 ${getStatusBorder()}`}>
            {/* Left Column: Target Controls */}
            <div className="lg:w-1/3 flex flex-col justify-between">
                <div>
                    <div className="mb-2">
                        <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                            {item.category}
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-100 mt-3">{item.entity_name}</h2>
                </div>

                <div className="mt-8 space-y-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">리뷰 상태 (Status)</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="bg-zinc-950/50 border border-zinc-800 rounded-md p-3 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                        >
                            <option value="pending">🟡 검토 대기안 (Pending)</option>
                            <option value="confirmed">🟢 승인 완료 (Confirmed)</option>
                            <option value="rejected">🔴 재생성 요망 (Rejected)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">수정 코멘트 (Feedback)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="bg-zinc-950/50 border border-zinc-800 rounded-md p-3 text-zinc-300 h-28 resize-none focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-700"
                            placeholder="문맥이 어색하거나 수정되었으면 하는 사항을 기록하세요."
                        ></textarea>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`w-full font-bold py-3 rounded-md transition-colors ${saved ? "bg-emerald-500 text-white" : "bg-zinc-100 hover:bg-white text-zinc-900"}`}
                    >
                        {isSaving ? "저장 중..." : saved ? "✔️ 저장 완료!" : "상태 저장하기"}
                    </button>
                </div>
            </div>

            {/* Right Column: AI Clue Outputs */}
            <div className="lg:w-2/3 flex flex-col gap-4 pl-0 lg:pl-10 lg:border-l border-zinc-800">
                <div className="bg-zinc-950/50 p-5 rounded-lg border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-3 font-bold border-b border-zinc-800/80 pb-2">Clue 1 (Text)</span>
                    <p className="text-zinc-300 leading-relaxed text-[15px]">{item.clue_1_text}</p>
                </div>

                <div className="bg-zinc-950/50 p-5 rounded-lg border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-3 font-bold border-b border-zinc-800/80 pb-2">Clue 2 (Text)</span>
                    <p className="text-zinc-300 leading-relaxed text-[15px]">{item.clue_2_text}</p>
                </div>

                <div className="bg-zinc-950/50 p-5 rounded-lg border border-zinc-800/80 relative">
                    <span className="text-[10px] text-indigo-400 uppercase tracking-widest block mb-3 font-bold border-b border-zinc-800/80 pb-2">Generated Image Prompt (Macro)</span>
                    <p className="text-indigo-200/80 font-mono text-[13px] leading-relaxed mb-4 p-3 bg-zinc-950 rounded border border-zinc-900">{item.clue_3_image_prompt}</p>

                    <span className="text-[10px] text-rose-500 uppercase tracking-widest block mb-2 font-bold">Negative Prompt</span>
                    <p className="text-rose-400/80 font-mono text-xs">{item.clue_3_image_negative}</p>
                </div>

                <div className="bg-amber-950/20 p-5 rounded-lg border border-amber-900/30">
                    <span className="text-[10px] text-amber-500 uppercase tracking-widest block mb-3 font-bold border-b border-amber-900/30 pb-2">Decisive Hint</span>
                    <p className="text-amber-200/90 font-medium leading-relaxed tracking-wide">{item.clue_4_decisive}</p>
                </div>
            </div>
        </div>
    );
}
