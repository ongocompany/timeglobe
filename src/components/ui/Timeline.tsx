"use client";

import { useEffect, useRef, useCallback } from "react";

// [cl] 피그마 디자인 기반 타임라인
// 위=과거, 아래=현재/미래 / 600px 영역 + 상하 페이드 / 무한 스크롤 느낌
export default function Timeline() {
    // [cl] 타임스케일: 현대→고대→지구 탄생까지
    const generateYears = () => {
        const years = [];
        // 미래~현재 (5년 간격)
        for (let y = 2050; y >= 2000; y -= 5) years.push(y);
        // 근현대 (10년 간격)
        for (let y = 1990; y >= 1500; y -= 10) years.push(y);
        // 중세~고대 (50년 간격)
        for (let y = 1450; y >= 500; y -= 50) years.push(y);
        // 고대~초기문명 (200년 간격)
        for (let y = 300; y >= -3000; y -= 200) years.push(y);
        // 선사시대 (1000년 간격)
        for (let y = -4000; y >= -10000; y -= 1000) years.push(y);
        // 빙하기~지구 역사 (만년~억년 간격)
        for (let y = -20000; y >= -100000; y -= 10000) years.push(y);
        for (let y = -200000; y >= -1000000; y -= 100000) years.push(y);
        for (let y = -2000000; y >= -10000000; y -= 1000000) years.push(y);
        for (let y = -100000000; y >= -4500000000; y -= 100000000) years.push(y);
        return years;
    };

    const years = generateYears();
    const currentYear = new Date().getFullYear();

    // [cl] 순서 반전: 배열은 미래→과거 순이므로, 화면상 위=과거 아래=현재로 표시하려면
    // 스크롤 0 = 현재연도 위치, 위로 스크롤 = 과거로 이동
    const currentYearIndex = years.findIndex((y) => y <= currentYear);

    const timelineRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const targetScrollY = useRef(0);
    const currentScrollY = useRef(0);

    useEffect(() => {
        if (currentYearIndex >= 0) {
            targetScrollY.current = currentYearIndex * 5;
            currentScrollY.current = currentYearIndex * 5;
        }
    }, [currentYearIndex]);

    const formatYear = (y: number) => {
        if (y <= -1000000000) return `${Math.abs(y / 1000000000).toFixed(1)}B`;
        if (y <= -1000000) return `${Math.abs(y / 1000000).toFixed(0)}M`;
        if (y <= -10000) return `${Math.abs(y / 1000).toFixed(0)}K`;
        if (y <= 0) return `${Math.abs(y - 1)} BC`;
        return `${y}`;
    };

    const handleWheel = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // [cl] 위로 스크롤(deltaY<0) = 과거로 이동 (인덱스 증가)
            targetScrollY.current += e.deltaY * 0.12;
            const maxScroll = (years.length - 1) * 5;
            targetScrollY.current = Math.max(0, Math.min(targetScrollY.current, maxScroll));
        },
        [years.length]
    );

    useEffect(() => {
        const el = timelineRef.current;
        if (!el) return;

        el.addEventListener("wheel", handleWheel, { passive: false });

        let frameId: number;
        const render = () => {
            currentScrollY.current += (targetScrollY.current - currentScrollY.current) * 0.1;

            // [cl] 타임바 중심점 (600px 영역의 하단 쪽에 현재 연도가 위치)
            const timelineCenter = window.innerHeight * 0.55;

            itemRefs.current.forEach((item, i) => {
                if (!item) return;

                const rawY = i * 5;
                const Dy = rawY - currentScrollY.current;
                // [cl] 순서 반전: Dy가 양수(인덱스 큰 = 과거)면 위로, 음수(미래)면 아래로
                const Vy = -(Dy + 200 * Math.tanh(Dy / 50));
                const effect = Math.exp(-(Dy * Dy) / 2000);

                const isCurrent = years[i] === currentYear;
                const baseThickness = isCurrent ? 3 : 1;
                const baseWidth = isCurrent ? 24 : 14;

                const finalWidth = baseWidth + effect * 30;
                const finalOpacity = 0.2 + effect * 0.8;

                item.style.transform = `translateY(${timelineCenter + Vy}px)`;

                const line = item.querySelector(".tick-line") as HTMLElement;
                if (line) {
                    line.style.width = `${finalWidth}px`;
                    line.style.height = `${baseThickness}px`;
                    line.style.opacity = finalOpacity.toString();
                }

                const text = item.querySelector(".tick-text") as HTMLElement;
                if (text) {
                    const textOpacity = effect > 0.3 ? Math.min(1, effect * 1.5) : 0;
                    text.style.opacity = textOpacity.toString();
                }
            });

            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);

        return () => {
            el.removeEventListener("wheel", handleWheel);
            cancelAnimationFrame(frameId);
        };
    }, [years.length, handleWheel, currentYear]);

    return (
        <div
            ref={timelineRef}
            className="absolute right-0 top-0 h-full w-48 z-10 select-none pointer-events-auto overflow-hidden"
        >
            {/* [cl] mask-image로 타임바 틱만 상하 페이드 (배경은 투명 유지) */}
            <div
                className="relative w-full h-full"
                style={{
                    maskImage: "linear-gradient(to bottom, transparent 15%, black 30%, black 70%, transparent 85%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 15%, black 30%, black 70%, transparent 85%)",
                }}
            >
                {/* [cl] 세로 기준선 - 전체 높이로 무한히 이어지는 느낌 */}
                <div className="absolute right-8 top-0 bottom-0 w-px bg-white/10" />

                {years.map((year, i) => {
                    const isCurrent = year === currentYear;
                    return (
                        <div
                            key={i}
                            ref={(el) => {
                                itemRefs.current[i] = el;
                            }}
                            className="absolute right-8 top-0 flex items-center justify-end"
                        >
                            <div
                                className="tick-text absolute right-12 text-right whitespace-nowrap"
                                style={{
                                    opacity: 0,
                                    fontFamily: "var(--font-noto-sans), sans-serif",
                                    fontWeight: isCurrent ? 800 : 500,
                                    fontSize: isCurrent ? "1.125rem" : "0.8125rem",
                                    color: isCurrent
                                        ? "rgba(255, 255, 255, 1)"
                                        : "rgba(255, 255, 255, 0.6)",
                                }}
                            >
                                {formatYear(year)}
                            </div>
                            <div
                                className="tick-line bg-white/80"
                                style={{ borderRadius: isCurrent ? "1px" : "0.5px" }}
                            />
                        </div>
                    );
                })}
            </div>

            <style
                dangerouslySetInnerHTML={{
                    __html: `body { overscroll-behavior-y: none; }`,
                }}
            />
        </div>
    );
}
