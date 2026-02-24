"use client";

import { useEffect, useRef } from "react";

export default function Timeline() {
    const generateYears = () => {
        const years = [];
        for (let y = 2020; y >= 1500; y -= 10) years.push(y);
        for (let y = 1450; y >= 500; y -= 50) years.push(y);
        for (let y = 300; y >= -3000; y -= 200) years.push(y);
        return years;
    };

    const years = generateYears();

    // Labels for specific important eras
    const majorLabels: Record<number, string> = {
        2020: "Present",
        1940: "WWII",
        1500: "Age of Discovery",
        500: "Fall of Rome",
        [-100]: "Ancient Rome / Han",
        [-3000]: "Early Civilizations"
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const targetScrollY = useRef(0);
    const currentScrollY = useRef(0);
    const lastTime = useRef<number>(0);

    const formatYear = (y: number) => y <= 0 ? `${Math.abs(y - 1)} BC` : y;

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            targetScrollY.current += e.deltaY * 0.15;
            const maxScroll = (years.length - 1) * 4;
            targetScrollY.current = Math.max(0, Math.min(targetScrollY.current, maxScroll));
        };

        window.addEventListener('wheel', handleWheel, { passive: true });

        let frameId: number;
        const render = (time: number) => {
            lastTime.current = time;
            currentScrollY.current += (targetScrollY.current - currentScrollY.current) * 0.1;

            const screenCenterY = window.innerHeight / 2;

            itemRefs.current.forEach((el, i) => {
                if (!el) return;

                const rawY = i * 4;
                const Dy = rawY - currentScrollY.current;
                const Vy = Dy + 250 * Math.tanh(Dy / 40);

                const effect = Math.exp(- (Dy * Dy) / 1200);

                const isMajor = el.getAttribute('data-major') === "true";

                const baseThickness = isMajor ? 3 : 2;
                const baseWidth = isMajor ? 18 : 12;

                const finalWidth = baseWidth + effect * 100;
                const finalOpacity = 0.15 + effect * 0.85;
                const translateX = effect * 15;

                el.style.transform = `translateY(${screenCenterY + Vy}px) translateX(-${translateX}px)`;

                const line = el.querySelector('.tick-line') as HTMLElement;
                if (line) {
                    line.style.width = `${finalWidth}px`;
                    line.style.height = `${baseThickness}px`;
                    line.style.opacity = finalOpacity.toString();
                    line.style.boxShadow = effect > 0.6 ? '0 0 12px rgba(255,255,255,0.8)' : 'none';
                }

                const text = el.querySelector('.tick-text') as HTMLElement;
                if (text) {
                    const textOpacity = effect > 0.5 ? effect : Math.max(0, effect * 1.5);
                    text.style.opacity = textOpacity.toString();
                    text.style.transform = `scale(${1 + effect * 0.5})`;
                }
            });

            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            cancelAnimationFrame(frameId);
        };
    }, [years.length]);

    return (
        <div className="absolute right-0 top-0 h-full w-96 z-10 select-none pointer-events-none overflow-hidden">
            <div ref={containerRef} className="relative w-full h-full">
                {years.map((year, i) => {
                    const label = majorLabels[year];
                    return (
                        <div
                            key={i}
                            ref={(el) => {
                                itemRefs.current[i] = el;
                            }}
                            data-major={label ? "true" : "false"}
                            className="absolute right-8 top-0 flex items-center justify-end group transition-transform duration-75"
                        >
                            <div className="tick-text absolute right-[100px] text-right whitespace-nowrap text-white font-medium origin-right" style={{ opacity: 0 }}>
                                <div className="text-base drop-shadow-md font-bold">{formatYear(year)}</div>
                                {label && <div className="text-[11px] text-white/90 tracking-widest uppercase mt-0.5 font-light">{label}</div>}
                            </div>

                            <div className="tick-line bg-white rounded-l-full will-change-transform" />
                        </div>
                    );
                })}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                body {
                    overscroll-behavior-y: none;
                }
            `}} />
        </div>
    );
}
