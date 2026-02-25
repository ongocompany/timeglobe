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
            className="absolute right-6 top-5 z-20 pointer-events-none text-right"
            style={{ fontFamily: "var(--font-noto-sans), sans-serif" }}
        >
            <div className="text-xs font-semibold tracking-wider text-white/80">
                {year}년 {month}월 {day}일
            </div>
            <div
                className="mt-0.5 text-white/45 tracking-widest"
                style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "0.65rem" }}
            >
                {period} {displayHours}:{minutes}:{seconds}
            </div>
        </div>
    );
}
