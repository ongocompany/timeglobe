// [cl] 사이트 진입 시 블러 리빌 애니메이션 적용된 헤더
export default function Header() {
    return (
        <div className="absolute top-0 left-0 w-full pt-16 pb-32 text-center z-10 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <h1
                className="uppercase tracking-widest animate-blur-reveal"
                style={{
                    fontFamily: "var(--font-noto-sans), sans-serif",
                    fontWeight: 800,
                    fontSize: "4.875rem",
                    color: "transparent",
                    WebkitTextStroke: "2px rgba(255, 255, 255, 0.95)",
                    textShadow:
                        "0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3), 0 0 80px rgba(255, 255, 255, 0.15), 0 4px 32px rgba(255, 255, 255, 0.2)",
                    animationDelay: "0.2s",
                }}
            >
                Time Globe
            </h1>
            <p
                className="mt-4 tracking-wide text-white/90 drop-shadow-md animate-blur-reveal"
                style={{
                    fontFamily: "var(--font-noto-sans), sans-serif",
                    fontWeight: 220,
                    fontSize: "1.25rem",
                    animationDelay: "0.5s",
                }}
            >
                Travel through time, see what happened.
            </p>
        </div>
    );
}
