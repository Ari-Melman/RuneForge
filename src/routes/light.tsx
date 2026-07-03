import { createFileRoute } from "@tanstack/react-router";
import { WeaponCalculator } from "@/components/WeaponCalculator";
export const Route = createFileRoute("/light")({
  head: () => ({ meta: [{ title: "Light Melee — Rune Forge" }, { name: "description", content: "Damage calculator for daggers, claws, fists and other light melee weapons." }] }),
  component: () => <WeaponCalculator group="light" title="Light Melee" subtitle="Daggers, claws, fists — speed over weight, riposte-focused damage." />,
});
