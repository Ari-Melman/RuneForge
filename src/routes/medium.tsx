import { createFileRoute } from "@tanstack/react-router";
import { WeaponCalculator } from "@/components/WeaponCalculator";
export const Route = createFileRoute("/medium")({
  head: () => ({ meta: [{ title: "Medium Melee — Rune Forge" }, { name: "description", content: "Damage calculator for straight swords, curved swords, katanas and other medium weapons." }] }),
  component: () => <WeaponCalculator group="medium" title="Medium Melee" subtitle="Straight swords, curved swords, katanas, spears — the balanced backbone of any build." />,
});
