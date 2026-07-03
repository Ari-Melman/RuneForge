// import heroVideo from "@/assets/RuneForgeHeroLoopVideo.mp4";

export function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      <video
        src="/RuneForgeHeroLoopVideo.mp4"
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/20 to-background/80" />
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <p className="text-gold uppercase tracking-[0.4em] text-xs mb-6 font-display">An Elden Ring Companion</p>
        <h1 className="text-6xl md:text-8xl font-display font-bold text-white leading-[0.95]">
          Rune <span className="text-gold-glow">Forge</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
          The most precise Elden Ring damage calculator. Tune every talisman, buff, stat and upgrade — see exactly how much pain you deal before you step into the fog gate.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-6 py-3 rounded-md bg-[color:var(--gold)] text-black font-medium hover:brightness-110 transition"
          >
            Explore Calculators
          </a>
          <a href="/auth" className="px-6 py-3 rounded-md border border-gold text-gold hover:bg-white/5 transition">
            Sign In for AI Rating
          </a>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/60 tracking-widest text-7xl">{"\n"}</div>
    </section>
  );
}
