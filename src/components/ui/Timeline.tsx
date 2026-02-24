"use client";

import { useState, useRef } from "react";

export default function Timeline() {
    // Generate an array of years dynamically
    const generateYears = () => {
        const years = [];
        // Modern history: every 10 years (2020 down to 1500)
        for (let y = 2020; y >= 1500; y -= 10) years.push(y);
        // Middle ages: every 50 years (1450 down to 500)
        for (let y = 1450; y >= 500; y -= 50) years.push(y);
        // Ancient: every 200 years (300 down to -3000)
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
    const [mouseY, setMouseY] = useState<number | null>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Get mouse position relative to the container
        setMouseY(e.clientY - rect.top);
    };

    const handleMouseLeave = () => {
        setMouseY(null);
    };

    const formatYear = (y: number) => y <= 0 ? `${Math.abs(y - 1)} BC` : y;

    return (
        <div
            className="absolute left-0 top-0 h-full w-64 z-10 select-none pointer-events-auto flex items-center"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={containerRef}
                className="relative h-full w-full overflow-y-auto no-scrollbar py-[40vh]"
                style={{ scrollBehavior: 'smooth' }}
            >
                <div className="flex flex-col items-start px-8">
                    {years.map((year, i) => {
                        // Assuming each item has a 24px height based on h-6 wrapper
                        const itemHeight = 24;
                        const itemY = i * itemHeight + (itemHeight / 2); // Center of the item

                        let width = 12; // Base tick width
                        let opacity = 0.2; // Base tick opacity
                        let scale = 1;
                        let xOffset = 0;

                        if (mouseY !== null && containerRef.current) {
                            const scrollY = containerRef.current.scrollTop;
                            const adjustedItemY = itemY - scrollY;

                            const distance = Math.abs(mouseY - adjustedItemY);
                            const maxDistance = 200; // Activation radius in pixels

                            if (distance < maxDistance) {
                                // Parabola calculation: effect is 1 at center, 0 at maxDistance
                                const effect = 1 - Math.pow(distance / maxDistance, 2);
                                width = 12 + effect * 80;    // Tick extends to max 92px
                                opacity = 0.2 + effect * 0.8; // Opacity up to 1.0
                                scale = 1 + effect * 0.4;     // Text scales up
                                xOffset = effect * 10;        // Small curve inwards
                            }
                        }

                        const label = majorLabels[year];
                        const isActiveHover = opacity > 0.7;

                        return (
                            <div
                                key={i}
                                className="h-6 flex items-center relative w-full group cursor-pointer"
                                style={{ transform: `translateX(${xOffset}px)` }}
                            >
                                {/* The physical tick line */}
                                <div
                                    className="h-[2px] bg-white rounded-r-full transition-all duration-75 ease-out"
                                    style={{
                                        width: `${width}px`,
                                        opacity,
                                        boxShadow: opacity > 0.6 ? '0 0 10px rgba(255,255,255,0.8)' : 'none'
                                    }}
                                />

                                {/* The text label */}
                                {(label || isActiveHover) && (
                                    <div
                                        className="absolute left-0 ml-[100px] whitespace-nowrap text-white font-medium transition-opacity duration-150"
                                        style={{
                                            opacity: isActiveHover ? 1 : 0.4,
                                            transform: `scale(${scale})`,
                                            transformOrigin: "left center"
                                        }}
                                    >
                                        <div className="text-sm drop-shadow-md">{formatYear(year)}</div>
                                        {label && <div className="text-[10px] text-white/70 tracking-wider uppercase mt-0.5">{label}</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Embedded CSS to hide the scrollbar for standard browsers */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}
