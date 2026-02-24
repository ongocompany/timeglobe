export default function Header() {
    return (
        <div className="absolute top-0 left-0 w-full pt-16 pb-32 text-center z-10 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            {/* Using text-stroke and transparent color for the outline effect */}
            <h1
                className="text-6xl font-black tracking-widest font-sans uppercase"
                style={{
                    color: "transparent",
                    WebkitTextStroke: "1px rgba(255, 255, 255, 0.9)",
                    textShadow: "0 4px 32px rgba(255, 255, 255, 0.1)"
                }}
            >
                Time Globe
            </h1>
            <p className="text-xl mt-4 font-light text-white/90 tracking-wide drop-shadow-md">
                Travel through time, see what happened.
            </p>
        </div>
    );
}
