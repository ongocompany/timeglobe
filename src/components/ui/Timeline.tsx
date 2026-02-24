export default function Timeline() {
    const eras = [
        { year: "2024", label: "Present" },
        { year: "1945", label: "WWII Ends" },
        { year: "1492", label: "Age of Discovery" },
        { year: "476", label: "Fall of Rome" },
        { year: "1 BC", label: "Ancient Era" },
        { year: "3000 BC", label: "Early Civilizations" },
    ];

    return (
        <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 select-none pointer-events-none">
            <div className="relative flex flex-col items-center">
                {/* The Vertical Line */}
                <div className="absolute h-full w-[2px] bg-white/20 left-1/2 -translate-x-1/2" />

                {/* The Ticks and Labels */}
                <div className="flex flex-col gap-12 py-8 relative">
                    {eras.map((era, i) => (
                        <div key={i} className="flex items-center gap-4 group pointer-events-auto cursor-pointer">
                            {/* Year Label */}
                            <div className="w-24 text-right">
                                <span className="text-white/60 font-medium text-sm transition-colors group-hover:text-white drop-shadow-md">
                                    {era.year}
                                </span>
                                <p className="text-xs text-white/40 group-hover:text-white/80 transition-colors drop-shadow-md">
                                    {era.label}
                                </p>
                            </div>

                            {/* The Tick Mark / Dot */}
                            <div className="relative flex items-center justify-center w-4 h-4">
                                <div className="w-2 h-2 bg-white/50 rounded-full transition-transform group-hover:scale-150 group-hover:bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
