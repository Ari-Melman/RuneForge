import { createFileRoute } from "@tanstack/react-router";
import { WeaponCalculator } from "@/components/WeaponCalculator";
export const Route = createFileRoute("/heavy")({
  head: () => ({ meta: [{ title: "Heavy Melee — Rune Forge" }, { name: "description", content: "Damage calculator for greatswords, colossal weapons, great hammers and other heavy melee weapons." }] }),
  component: () => <WeaponCalculator group="heavy" title="Heavy Melee" subtitle="Greatswords, colossal weapons, great hammers — slow swings, world-ending damage." />,
});
