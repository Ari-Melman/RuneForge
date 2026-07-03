import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rune Forge — Elden Ring Damage Calculator" },
      { name: "description", content: "Pixel-precise Elden Ring damage calculator. Tune weapons, talismans, buffs and stats — see exactly how much damage you deal." },
      { property: "og:title", content: "Rune Forge — Elden Ring Damage Calculator" },
      { property: "og:description", content: "Plan your Tarnished. Calculate every R1, R2, charged and jump attack across all weapon classes." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { title: "Melee Weapon Classes", body: "From daggers and claws to colossal weapons 300+ armaments with motion values from the source." },
  { title: "Exact Modifiers", body: "Stack 0–4 talismans and the full Aura / Body / Weapon / Special buff slots. Multipliers are applied exactly as in-game." },
  { title: "Enemy Resistances", body: "Pick from common enemies and major bosses output is calibrated to their physical defense and negation." },
  { title: "Save Your Builds", body: "Sign in to save unlimited builds to the cloud. Switch between them in one click on any device." },
  { title: "AI Build Rating", body: "Signed-in users unlock our Elden Ring AI coach. It rates your build out of 10 and tells you exactly how to push it harder." },
  { title: "Equip Load Calculator", body: "Track armor, weapon and talisman weight in real time. Your total equip load and roll tier update live as you swap gear." },
];

function Index() {
  return (
    <main>
      <Hero />

      <section id="features" className="max-w-6xl mx-auto px-6 py-32">
        <div className="text-center mb-16">
          <p className="text-gold uppercase tracking-[0.4em] text-xs mb-3 font-display">What's inside</p>
          <h2 className="text-5xl font-display font-bold text-white">A workshop for the Tarnished</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Three calculators, one design language. Built to feel like the inventory you already know.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-gold bg-panel p-6 hover:panel-glow transition">
              <h3 className="font-display text-xl text-gold-glow">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="rounded-2xl border border-gold panel-glow bg-panel p-10 md:p-16 text-center">
          <p className="text-gold uppercase tracking-[0.4em] text-xs mb-3 font-display">Perk · Free</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Sign in. Unlock the AI build coach.</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Sign in with Google and an Elden Ring tuned AI will rate your build out of 10 — calling out
            wasted talisman slots, broken synergies and the one buff you forgot.
          </p>
          <a href="/auth" className="inline-block mt-8 px-7 py-3 rounded-md bg-[color:var(--gold)] text-black font-medium hover:brightness-110 transition">
            Sign in with Google
          </a>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        Rune Forge · Fan-made companion. Not affiliated with FromSoftware or Bandai Namco.
      </footer>
    </main>
  );
}
