"use client";

import { useEffect, useState } from "react";

// [cl] 타임바 상단 페이드 지점에서 50px 위에 위치하는 날짜/시간 표시 카드
export default function DateDisplay() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const period = hours >= 12 ? "오후" : "오전";
    const displayHours = (hours % 12 || 12).toString().padStart(2, "0");

    return (
        <div
            className="absolute right-0 w-48 z-20 pointer-events-none flex justify-center"
            style={{
                // [cl] 타임바 600px 영역의 상단 = (100vh - 600px) / 2
                // 거기서 카드 높이 + 50px 위로
                top: "calc((100vh - 600px) / 2 - 130px)",
            }}
        >
            <div
                className="rounded-xl border border-white/15 px-6 py-4 backdrop-blur-sm"
                style={{ background: "rgba(30, 30, 30, 0.4)" }}
            >
                <div
                    className="text-center text-white"
                    style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
                >
                    <div className="text-3xl font-bold tracking-wider">{year}</div>
                    <div className="text-sm font-light mt-1 text-white/70">
                        {month}월 {day}일
                    </div>
                    <div
                        className="text-xs mt-1 text-white/50 tracking-widest"
                        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                    >
                        {period} {displayHours}:{minutes}:{seconds}
                    </div>
                </div>
            </div>
        </div>
    );
}
