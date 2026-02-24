export default function Header() {
    return (
        <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none text-white">
            <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg font-sans">
                Time Globe
            </h1>
            <p className="text-lg mt-2 font-medium text-white/80 drop-shadow-md">
                Travel through time, see what happened.
            </p>
        </div>
    );
}
