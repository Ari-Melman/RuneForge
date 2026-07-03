// Data-driven Elden Ring damage calculator.
// Uses real weapon params (attack, scaling, reinforce, calcCorrectGraph,
// attackElementCorrect), real motion values, and an effect-modifier system
// that respects buff slots and talisman conditions.

import weaponsRaw from "@/data/weapons.json";
import motionRaw from "@/data/motionValues.json";
import effectsRaw from "@/data/effects.json";
import ccgRaw from "@/data/calcCorrectGraphs.json";
import aecRaw from "@/data/attackElementCorrects.json";
import reinforceRaw from "@/data/reinforceTypes.json";
import armorRaw from "@/data/armors.json";
import equipLoadRaw from "@/data/equipLoadTable.json";
import { catalystScalingEntryFor } from "@/data/catalystScaling";
import { type EnemyPreset } from "@/data/enemyData";

export type StatKey = "str" | "dex" | "int" | "fai" | "arc";
export type DamageType = 0 | 1 | 2 | 3 | 4; // phys, magic, fire, light, holy
export const DAMAGE_LABELS: Record<DamageType, string> = {
  0: "Physical",
  1: "Magic",
  2: "Fire",
  3: "Lightning",
  4: "Holy",
};

export const AFFINITY_LABELS: Record<number, string> = {
  0: "Standard",
  1: "Heavy",
  2: "Keen",
  3: "Quality",
  4: "Fire",
  5: "Flame Art",
  6: "Lightning",
  7: "Sacred",
  8: "Magic",
  9: "Cold",
  10: "Poison",
  11: "Blood",
  12: "Occult",
  [-1]: "Unique",
};

export function affinityLabelFor(affinityId: number, fallback?: string): string {
  return AFFINITY_LABELS[affinityId] ?? fallback ?? `#${affinityId}`;
}

export type StatusType = "blood" | "frost" | "madness" | "poison" | "rot" | "sleep";
export const STATUS_LABELS: Record<StatusType, string> = {
  blood: "Bleed",
  frost: "Frostbite",
  madness: "Madness",
  poison: "Poison",
  rot: "Scarlet Rot",
  sleep: "Sleep",
};

export function formatStatusBuildupValue(value: number): string {
  const normalized = value >= 100000 ? value / 1000 : value / 100;
  return Number(normalized.toFixed(2)).toString();
}

export type GreatRune = "none" | "godrick" | "rykard" | "radahn" | "morgott" | "mohg" | "malenia";
export const GREAT_RUNE_LABELS: Record<GreatRune, string> = {
  none: "None",
  godrick: "Godrick's Great Rune",
  rykard: "Rykard's Great Rune",
  radahn: "Radahn's Great Rune",
  morgott: "Morgott's Great Rune",
  mohg: "Mohg's Great Rune",
  malenia: "Malenia's Great Rune",
};
export const GREAT_RUNE_OPTIONS: GreatRune[] = [
  "none",
  "godrick",
  "rykard",
  "radahn",
  "morgott",
  "mohg",
  "malenia",
];

export function greatRuneLabel(rune: GreatRune): string {
  return GREAT_RUNE_LABELS[rune];
}

export function greatRuneStatsBonus(rune: GreatRune): Partial<Stats> {
  if (rune !== "godrick") return {};
  return { str: 5, dex: 5, int: 5, fai: 5, arc: 5, end: 5 };
}

const BLUE_DANCER_BREAKPOINTS: Array<[number, number]> = [
  [0, 1.15],
  [8, 1.135],
  [16, 1.09],
  [20, 1.0375],
  [30, 1.0],
];

export function blueDancerMultiplier(equippedWeight: number): number {
  const weight = Math.max(0, Math.min(30, equippedWeight));
  for (let i = 0; i < BLUE_DANCER_BREAKPOINTS.length - 1; i += 1) {
    const [x1, y1] = BLUE_DANCER_BREAKPOINTS[i];
    const [x2, y2] = BLUE_DANCER_BREAKPOINTS[i + 1];
    if (weight <= x2) {
      const t = (weight - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return BLUE_DANCER_BREAKPOINTS[BLUE_DANCER_BREAKPOINTS.length - 1][1];
}

const SCADUTREE_DAMAGE_MULTIPLIERS = [
  1.0, 1.1, 1.2, 1.25, 1.3, 1.35, 1.425, 1.5, 1.55, 1.6, 1.65, 1.75, 1.85, 1.875, 1.9, 1.925, 1.95,
  1.975, 2.0, 2.025, 2.05,
];

export function scadutreeDamageMultiplier(fragmentCount: number): number {
  const tier = Math.max(0, Math.min(20, Math.floor(fragmentCount)));
  return SCADUTREE_DAMAGE_MULTIPLIERS[tier] ?? 1;
}

export interface AffinityVariant {
  affinityId: number;
  affinityName: string;
  attack: Array<[number, number]>;
  attributeScaling: Array<[StatKey, number]>;
  reinforceTypeId: number;
  attackElementCorrectId: number;
  calcCorrectGraphIds: Record<string, number>;
  requirements: Partial<Record<StatKey, number>>;
  critical?: number;
  statusBuildup?: Partial<Record<StatusType, number>>;
}
export interface BaseWeapon {
  name: string;
  affinities: AffinityVariant[];
}

export type ArmorSlotType = "helm" | "chest armor" | "gauntlets" | "leg armor";
export interface ArmorPiece {
  id: string;
  name: string;
  type: ArmorSlotType;
  weight: number;
  damageNegation: Record<string, number>;
  resistance: Record<string, number>;
  specialEffect: string;
  dlc: boolean;
}

export const weapons = weaponsRaw as unknown as Record<string, BaseWeapon[]>;
export const motionValues = motionRaw as Record<string, Record<string, number>>;
export const effects = effectsRaw as Array<{
  name: string;
  type: string;
  category: string;
  effectType: string;
  multiplier: string;
  condition: string;
  duration: string;
  notes: string;
}>;
const calcCorrectGraphs = ccgRaw as Record<
  string,
  Array<{ maxVal: number; maxGrowVal: number; adjPt: number }>
>;
type AECMap = Record<string, Record<string, Record<string, unknown>>>;
const attackElementCorrects = aecRaw as unknown as AECMap;
const reinforceTypes = reinforceRaw as unknown as Record<
  string,
  Array<{
    attack: Record<string, number>;
    attributeScaling: Record<StatKey, number>;
  }>
>;
export const armorPieces = armorRaw as unknown as ArmorPiece[];
export const ARMOR_SLOT_ORDER: ArmorSlotType[] = ["helm", "chest armor", "gauntlets", "leg armor"];
export const ARMOR_SLOT_LABELS: Record<ArmorSlotType, string> = {
  helm: "Helm",
  "chest armor": "Chest Armor",
  gauntlets: "Gauntlets",
  "leg armor": "Leg Armor",
};
export const armorPiecesByType: Record<ArmorSlotType, ArmorPiece[]> = ARMOR_SLOT_ORDER.reduce(
  (acc, slot) => {
    acc[slot] = armorPieces.filter((piece) => piece.type === slot);
    return acc;
  },
  {} as Record<ArmorSlotType, ArmorPiece[]>,
);
export function armorPieceLabel(piece: ArmorPiece) {
  return `${piece.name}${piece.dlc ? " (DLC)" : ""}`;
}

const ARMOR_STAT_ALIASES: Record<string, StatKey> = {
  strength: "str",
  dexterity: "dex",
  intelligence: "int",
  faith: "fai",
  arcane: "arc",
  endurance: "end",
};

const ARMOR_DAMAGE_TYPE_ALIASES: Array<[string, DamageType]> = [
  ["physical", 0],
  ["magic", 1],
  ["fire", 2],
  ["lightning", 3],
  ["holy", 4],
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function armorEffectText(piece: ArmorPiece): string {
  return piece.specialEffect?.trim() ?? "";
}

function armorEffectMatchesContext(text: string, ctx: EffectContext, attackKey?: string): boolean {
  const lower = text.toLowerCase();
  const attackLower = (attackKey || "").toLowerCase();
  if (!lower) return true;
  if (lower.includes("full hp") && !ctx.fullHP) return false;
  if (lower.includes("low hp") && !ctx.lowHP) return false;
  if (lower.includes("madness") && !ctx.madnessNearby && !ctx.madnessSelf) return false;
  if (
    (lower.includes("poison") || lower.includes("scarlet rot") || lower.includes("rot nearby")) &&
    !ctx.poisonOrRotNearby &&
    !ctx.scarletRotNearby
  )
    return false;
  if ((lower.includes("blood loss") || lower.includes("bleed")) && !ctx.bloodLossNearby) return false;
  if (lower.includes("after critical hit") && !ctx.afterCriticalHit) return false;
  if (lower.includes("after killing") && !ctx.afterKillEnemy) return false;
  if (lower.includes("after roll or backstep") && !ctx.afterRollOrBackstep) return false;
  if (lower.includes("jump attacks") && !ctx.isJumping) return false;
  if (lower.includes("charged attacks") && !ctx.isCharged) return false;
  if (lower.includes("successive attacks") && !(ctx.successive || (ctx.successiveStacks ?? 0) > 0))
    return false;
  if (
    attackKey &&
    (lower.includes("weapon skills") || lower.includes("skills")) &&
    !attackLower.includes("skill")
  )
    return false;
  if (
    (lower.includes("dashing attacks") || lower.includes("rolling / backstep")) &&
    !ctx.isSprintingOrDashing &&
    !ctx.isRunning &&
    !ctx.afterRollOrBackstep
  )
    return false;
  return true;
}

function parseArmorStatBonuses(text: string): Partial<Stats> {
  const out: Partial<Stats> = {};
  const add = (stat: string, amount: number) => {
    const key = ARMOR_STAT_ALIASES[stat.toLowerCase()];
    if (!key) return;
    out[key] = (out[key] ?? 0) + amount;
  };

  for (const match of text.matchAll(/(?:\+|increases?\s+|boosts?\s+|raises?\s+)(\d+)\s*(strength|dexterity|intelligence|faith|arcane|endurance)\b/gi)) {
    add(match[2], Number(match[1]));
  }

  for (const match of text.matchAll(
    /(?:increases?|boosts?|raises?)\s+([a-z ,/&'-]+?)\s+by\s+\+?(\d+)(?:\.\d+)?\b/gi,
  )) {
    const amount = Number(match[2]);
    const parts = match[1]
      .toLowerCase()
      .split(/[,/&]+| and /g)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      add(part, amount);
    }
  }

  return out;
}

function parseArmorEquipLoadMultiplier(text: string): number {
  const lower = text.toLowerCase();
  if (!lower.includes("equip load")) return 1;
  const direct = lower.match(/equip load by\s+([+-]?\d+(?:\.\d+)?)x/);
  if (direct) return Number(direct[1]) || 1;
  const percent = lower.match(/equip load(?:[^0-9+-]*)([+-]?\d+(?:\.\d+)?)%/);
  if (percent) return 1 + Number(percent[1]) / 100;
  return 1;
}

function armorNegationTargets(text: string): DamageType[] {
  const lower = text.toLowerCase();
  if (!lower.includes("negation")) return [];
  if (lower.includes("elemental negation")) return [1, 2, 3, 4];
  if (lower.includes("all damage negation") || lower.includes("damage negations")) return [0, 1, 2, 3, 4];
  const targets = ARMOR_DAMAGE_TYPE_ALIASES.filter(([label]) => lower.includes(`${label} negation`)).map(
    ([, dt]) => dt,
  );
  return [...new Set(targets)];
}

function parseArmorNegationMultiplier(text: string, ctx: EffectContext): Partial<Record<DamageType, number>> {
  const lower = text.toLowerCase();
  const targets = armorNegationTargets(lower);
  if (!targets.length) return {};
  const percent = lower.match(/(?:damage negations?|negation)[^%]*([+-]?\d+(?:\.\d+)?)%/);
  if (!percent) return {};
  const amount = Number(percent[1]);
  if (!Number.isFinite(amount)) return {};
  const multiplier = 1 + amount / 100;
  const out: Partial<Record<DamageType, number>> = {};
  for (const dt of targets) out[dt] = multiplier;
  void ctx;
  return out;
}

function damageNegationTargets(text: string): DamageType[] {
  const lower = text.toLowerCase();
  if (lower.includes("critical negation")) return [];
  if (lower.includes("elemental negation")) return [1, 2, 3, 4];
  if (lower.includes("all damage negation") || lower.includes("all negations")) return [0, 1, 2, 3, 4];
  if (lower.includes("damage negation") || lower.includes("negation")) {
    const targets = ARMOR_DAMAGE_TYPE_ALIASES.filter(([label]) => lower.includes(`${label} negation`)).map(
      ([, dt]) => dt,
    );
    if (targets.length) return [...new Set(targets)];
    return [0, 1, 2, 3, 4];
  }
  return [];
}

function parseDamageNegationText(
  text: string,
  targetHint: string = text,
): Partial<Record<DamageType, number>> {
  const lower = text.toLowerCase();
  const targets = damageNegationTargets(targetHint.toLowerCase());
  if (!targets.length) return {};

  const out: Partial<Record<DamageType, number>> = {};
  const directPercent = lower.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  const directMultiplier = lower.match(/([+-]?\d+(?:\.\d+)?)x/);
  if (directPercent) {
    const amount = Number(directPercent[1]);
    if (Number.isFinite(amount)) {
      const mult = 1 + amount / 100;
      for (const dt of targets) out[dt] = mult;
      return out;
    }
  }
  if (directMultiplier) {
    const mult = Number(directMultiplier[1]);
    if (Number.isFinite(mult)) {
      for (const dt of targets) out[dt] = mult;
      return out;
    }
  }

  const perTargetPatterns: Array<[string, DamageType]> = [
    ["physical", 0],
    ["magic", 1],
    ["fire", 2],
    ["lightning", 3],
    ["holy", 4],
  ];
  for (const [label, dt] of perTargetPatterns) {
    if (!targets.includes(dt)) continue;
    const escaped = escapeRegex(label);
    const before = lower.match(new RegExp(`([+-]?\\d+(?:\\.\\d+)?)%[^\\n;,.]{0,40}${escaped}\\s+negation`));
    const after = lower.match(new RegExp(`${escaped}\\s+negation[^\\n;,.]{0,40}([+-]?\\d+(?:\\.\\d+)?)%`));
    const match = before || after;
    if (!match) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    out[dt] = 1 + amount / 100;
  }

  if (Object.keys(out).length) return out;

  const numeric = Number(lower);
  if (Number.isFinite(numeric) && numeric > 0) {
    for (const dt of targets) out[dt] = numeric;
  }
  return out;
}

function parseEffectNegationMultipliers(effect: (typeof effects)[number]): Partial<Record<DamageType, number>> {
  const effectType = (effect.effectType || "").toLowerCase();
  const multiplier = effect.multiplier || "";
  const notes = effect.notes || "";
  const multiplierLower = multiplier.toLowerCase();
  const notesLower = notes.toLowerCase();
  const targetHint = `${effectType} ${multiplierLower} ${notesLower}`;
  if (!targetHint.includes("negation")) return {};

  const multiplierLooksNegation =
    multiplierLower.includes("negation") ||
    /%/.test(multiplierLower) ||
    /x/.test(multiplierLower);

  if (effectType.includes("negation") && multiplier) {
    return parseDamageNegationText(multiplier, targetHint);
  }
  if (multiplierLooksNegation) {
    return parseDamageNegationText(multiplier, targetHint);
  }
  if (notesLower.includes("negation")) {
    return parseDamageNegationText(notes, targetHint);
  }
  return {};
}

function parseArmorDamageMultiplier(text: string): { targets: DamageType[]; multiplier: number } | null {
  const lower = text.toLowerCase();
  if (
    !lower.includes("damage") &&
    !lower.includes("attack power") &&
    !lower.includes("strengthens") &&
    !lower.includes("boosts") &&
    !lower.includes("raises")
  ) {
    return null;
  }

  const multiplierMatch = lower.match(/([+-]?\d+(?:\.\d+)?)x/);
  if (multiplierMatch) {
    const multiplier = Number(multiplierMatch[1]);
    if (!Number.isFinite(multiplier)) return null;
    const targets = armorDamageTypeTargets(lower);
    return { targets, multiplier };
  }

  const percentMatch = lower.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!percentMatch) return null;
  const multiplier = 1 + Number(percentMatch[1]) / 100;
  if (!Number.isFinite(multiplier)) return null;
  const targets = armorDamageTypeTargets(lower);
  return { targets, multiplier };
}

function armorDamageTypeTargets(lower: string): DamageType[] {
  if (lower.includes("all damage") || lower.includes("attack power")) return [0, 1, 2, 3, 4];
  const targets = ARMOR_DAMAGE_TYPE_ALIASES.filter(([label]) => lower.includes(`${label} damage`)).map(
    ([, dt]) => dt,
  );
  if (targets.length) return [...new Set(targets)];
  return [0, 1, 2, 3, 4];
}

export function armorStatBonusesForPieces(
  pieces: Array<ArmorPiece | null | undefined>,
  ctx: EffectContext,
): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const piece of pieces) {
    if (!piece) continue;
    const text = armorEffectText(piece);
    if (!armorEffectMatchesContext(text, ctx)) continue;
    const bonuses = parseArmorStatBonuses(text);
    for (const [key, value] of Object.entries(bonuses) as Array<[StatKey, number]>) {
      out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}

export function armorEquipLoadMultiplierForPieces(
  pieces: Array<ArmorPiece | null | undefined>,
  ctx: EffectContext,
): number {
  return pieces.reduce((mult, piece) => {
    if (!piece) return mult;
    const text = armorEffectText(piece);
    if (!armorEffectMatchesContext(text, ctx)) return mult;
    return mult * parseArmorEquipLoadMultiplier(text);
  }, 1);
}

export function armorNegationMultipliersForPieces(
  pieces: Array<ArmorPiece | null | undefined>,
  ctx: EffectContext,
): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {};
  for (const piece of pieces) {
    if (!piece) continue;
    const text = armorEffectText(piece);
    if (!armorEffectMatchesContext(text, ctx)) continue;
    const pieceMultipliers = parseArmorNegationMultiplier(text, ctx);
    for (const [dtStr, mult] of Object.entries(pieceMultipliers) as Array<[string, number]>) {
      const dt = Number(dtStr) as DamageType;
      out[dt] = (out[dt] ?? 1) * mult;
    }
  }
  return out;
}

function armorDamageMultiplierForPiece(
  piece: ArmorPiece,
  ctx: EffectContext,
  attackKey: string,
): Partial<Record<DamageType, number>> {
  const text = armorEffectText(piece);
  if (!armorEffectMatchesContext(text, ctx, attackKey)) return {};
  const parsed = parseArmorDamageMultiplier(text);
  if (!parsed) return {};
  const out: Partial<Record<DamageType, number>> = {};
  for (const dt of parsed.targets) out[dt] = parsed.multiplier;
  return out;
}

export function armorDamageMultipliersForPieces(
  pieces: Array<ArmorPiece | null | undefined>,
  ctx: EffectContext,
  attackKey: string,
): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {};
  for (const piece of pieces) {
    if (!piece) continue;
    const pieceMultipliers = armorDamageMultiplierForPiece(piece, ctx, attackKey);
    for (const [dtStr, mult] of Object.entries(pieceMultipliers) as Array<[string, number]>) {
      const dt = Number(dtStr) as DamageType;
      out[dt] = (out[dt] ?? 1) * mult;
    }
  }
  return out;
}

export function effectNegationMultipliersForNames(
  effectNames: string[],
  ctx: EffectContext,
): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {};
  for (const name of effectNames) {
    const e = effects.find((x) => x.name === name);
    if (!e || !effectMatches(e, ctx)) continue;
    const pieceMultipliers = parseEffectNegationMultipliers(e);
    for (const [dtStr, mult] of Object.entries(pieceMultipliers) as Array<[string, number]>) {
      const dt = Number(dtStr) as DamageType;
      out[dt] = (out[dt] ?? 1) * mult;
    }
  }
  return out;
}

export const WEAPON_GROUPS = {
  light: ["Dagger", "Throwing Blade", "Claw", "Beast Claw", "Fist", "Hand-to-Hand"],
  medium: [
    "Straight Sword",
    "Curved Sword",
    "Katana",
    "Thrusting Sword",
    "Heavy Thrusting Sword",
    "Spear",
    "Axe",
    "Hammer",
    "Flail",
    "Whip",
    "Backhand Blade",
    "Twinblade",
    "Perfume Bottle",
    "Halberd",
    "Reaper",
    "Light Greatsword",
  ],
  heavy: [
    "Greatsword",
    "Colossal Sword",
    "Greataxe",
    "Great Hammer",
    "Colossal Weapon",
    "Curved Greatsword",
    "Great Katana",
    "Great Spear",
  ],
} as const;
export type Group = keyof typeof WEAPON_GROUPS;

export function classesFor(group: Group): string[] {
  return WEAPON_GROUPS[group].filter((c) => weapons[c]?.length);
}

const ALWAYS_THRUST_CLASSES = new Set([
  "Thrusting Sword",
  "Heavy Thrusting Sword",
  "Spear",
  "Great Spear",
  "Thrusting Shield",
]);
const THRUST_MOVE_HINT_RE = /(shieldpoke|thrust|poke)/i;
const DAMAGE_TARGETS: Array<[string, DamageType]> = [
  ["physical", 0],
  ["magic", 1],
  ["fire", 2],
  ["lightning", 3],
  ["holy", 4],
];

export function isThrustingWeaponClass(className: string): boolean {
  return ALWAYS_THRUST_CLASSES.has(className);
}

export function weaponHasThrustMoves(weaponName: string): boolean {
  const mv = motionValues[weaponName];
  if (!mv) return false;
  return Object.keys(mv).some((key) => THRUST_MOVE_HINT_RE.test(key));
}

export function attackKeyLooksThrusting(attackKey: string): boolean {
  return THRUST_MOVE_HINT_RE.test(attackKey);
}

export function isSuccessiveEffectName(name: string): boolean {
  const e = effects.find((x) => x.name === name);
  return (e?.effectType || "").toLowerCase() === "successive";
}

export function inferThrustingContext(
  weaponClass: string,
  weaponName: string,
  attackKey: string,
): boolean {
  return (
    isThrustingWeaponClass(weaponClass) ||
    weaponHasThrustMoves(weaponName) ||
    attackKeyLooksThrusting(attackKey)
  );
}

export interface Stats {
  str: number;
  dex: number;
  int: number;
  fai: number;
  arc: number;
  end: number;
}
export const defaultStats: Stats = { str: 25, dex: 25, int: 10, fai: 10, arc: 10, end: 20 };

const equipLoadTable = equipLoadRaw as Array<{ level: number; equip_load: number }>;
export function equipLoadCap(end: number) {
  const level = Math.min(99, Math.max(1, Math.round(end)));
  return equipLoadTable[level - 1]?.equip_load ?? 45 + level * 1.5;
}
export function loadTier(used: number, cap: number) {
  const r = used / cap;
  return r < 0.3 ? "Light" : r < 0.7 ? "Medium" : r <= 1 ? "Heavy" : "Overloaded";
}

// ----- calcCorrectGraph piecewise -----
function calcCorrect(stat: number, graphId: number): number {
  const graph = calcCorrectGraphs[String(graphId)];
  if (!graph || !graph.length) return 0;
  if (stat <= graph[0].maxVal) return graph[0].maxGrowVal * 100;
  for (let i = 0; i < graph.length - 1; i++) {
    const a = graph[i],
      b = graph[i + 1];
    if (stat <= b.maxVal) {
      const t = (stat - a.maxVal) / (b.maxVal - a.maxVal);
      const adj = a.adjPt;
      const eased = adj >= 0 ? Math.pow(t, adj) : 1 - Math.pow(1 - t, -adj);
      return (a.maxGrowVal + (b.maxGrowVal - a.maxGrowVal) * eased) * 100;
    }
  }
  return graph[graph.length - 1].maxGrowVal * 100;
}

// ----- reinforce level helpers -----
export function maxReinforceLevel(reinforceTypeId: number): number {
  const arr = reinforceTypes[String(reinforceTypeId)];
  return arr ? Math.max(0, arr.length - 1) : 0;
}

function reinforceAt(reinforceTypeId: number, level: number) {
  const arr = reinforceTypes[String(reinforceTypeId)];
  if (!arr)
    return {
      attack: {},
      attributeScaling: { str: 1, dex: 1, int: 1, fai: 1, arc: 1 } as Record<StatKey, number>,
    };
  return arr[Math.min(level, arr.length - 1)];
}

// ----- AR computation per damage type -----
export interface ArBreakdown {
  base: Record<DamageType, number>;
  scaled: Record<DamageType, number>;
  total: Record<DamageType, number>;
  totalAR: number;
  effectiveStats: Stats;
}

export function computeAR(opts: {
  variant: AffinityVariant;
  level: number;
  stats: Stats;
  twoHanded: boolean;
}): ArBreakdown {
  const { variant, level, stats, twoHanded } = opts;
  const effective: Stats = { ...stats };
  if (twoHanded) effective.str = Math.floor(stats.str * 1.5);

  const r = reinforceAt(variant.reinforceTypeId, level);
  const aec = attackElementCorrects[String(variant.attackElementCorrectId)] || {};

  const base = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<DamageType, number>;
  const scaled = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<DamageType, number>;
  const total = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<DamageType, number>;

  for (const [dtRaw, baseVal] of variant.attack) {
    const dt = dtRaw as DamageType;
    if (baseVal <= 0) continue;
    const rAtk = r.attack[String(dt)] ?? 1;
    const baseScaled = baseVal * rAtk;
    base[dt] = baseScaled;

    const graphId = variant.calcCorrectGraphIds?.[String(dt)] ?? 0;
    const aecForDt = aec[String(dt)] || {};
    let scalingSum = 0;
    for (const [statKey, scaleVal] of variant.attributeScaling) {
      if (!aecForDt[statKey]) continue;
      const statVal = effective[statKey];
      const ccVal = calcCorrect(statVal, graphId) / 100; // 0..~1.1
      const rScale = r.attributeScaling[statKey] ?? 1;
      scalingSum += baseScaled * scaleVal * rScale * ccVal;
    }
    scaled[dt] = scalingSum;
    total[dt] = baseScaled + scalingSum;
  }
  const totalAR = (Object.values(total) as number[]).reduce((a, b) => a + b, 0);
  return { base, scaled, total, totalAR, effectiveStats: effective };
}

export function computeCatalystScaling(opts: {
  catalystName: string;
  level: number;
  stats: Pick<Stats, "int" | "fai">;
}): { sorceryScaling: number | null; incantScaling: number | null } {
  const catalyst = catalystScalingEntryFor(opts.catalystName);
  if (!catalyst) return { sorceryScaling: null, incantScaling: null };

  const r = reinforceAt(catalyst.reinforceTypeId, opts.level);
  if (catalyst.specialScaling) {
    const statValue = opts.stats[catalyst.specialScaling.stat];
    const threshold =
      catalyst.specialScaling.stat === "int" ? catalyst.properMagic : catalyst.properFaith;
    const value = statValue < threshold ? catalyst.specialScaling.below : catalyst.specialScaling.above;
    return { sorceryScaling: catalyst.kind === "sorcery" ? value : null, incantScaling: catalyst.kind === "incant" ? value : null };
  }
  const scalingStat = catalyst.scalingStat ?? (catalyst.kind === "sorcery" ? "int" : "fai");
  if (catalyst.kind === "sorcery") {
    const statValue = opts.stats[scalingStat];
    const properRequirement = scalingStat === "int" ? catalyst.properMagic : catalyst.properFaith;
    if (statValue < properRequirement) return { sorceryScaling: 60, incantScaling: null };
    const sat = calcCorrect(statValue, catalyst.graphId) / 100;
    const reinforce = r.attributeScaling[scalingStat] ?? 1;
    const correct = scalingStat === "int" ? catalyst.correctMagic : catalyst.correctFaith;
    return {
      sorceryScaling: Math.round(100 + correct * reinforce * sat),
      incantScaling: null,
    };
  }

  const statValue = opts.stats.fai;
  if (statValue < catalyst.properFaith) return { sorceryScaling: null, incantScaling: 60 };
  const sat = calcCorrect(statValue, catalyst.graphId) / 100;
  const reinforce = r.attributeScaling.fai ?? 1;
  return {
    sorceryScaling: null,
    incantScaling: Math.round(100 + catalyst.correctFaith * reinforce * sat),
  };
}

// ----- Effect (talisman + buff) modifier system -----
export interface EffectContext {
  isCharged?: boolean;
  isChargedHeavy?: boolean;
  isJumping?: boolean;
  isThrust?: boolean;
  isRunning?: boolean;
  isSprintingOrDashing?: boolean;
  isCriticalHit?: boolean;
  isGuardCounter?: boolean;
  twoHanded?: boolean;
  fullHP?: boolean;
  lowHP?: boolean;
  bloodsuckingCrackedTear?: boolean;
  bloodLossNearby?: boolean;
  madnessNearby?: boolean;
  madnessSelf?: boolean;
  sleepNearby?: boolean;
  poisonOrRotNearby?: boolean;
  scarletRotNearby?: boolean;
  afterCriticalHit?: boolean;
  afterKillEnemy?: boolean;
  afterRollOrBackstep?: boolean;
  allowNextAttackOnly?: boolean;
  successive?: boolean;
  successiveStacks?: number;
  attackKey?: string;
  equippedWeight?: number;
  scadutreeFragments?: number;
  incantationScaling?: number;
  sorceryScaling?: number;
}

function attackKeyIsFirstHit(attackKey?: string): boolean {
  if (!attackKey) return false;
  const lower = attackKey.toLowerCase();
  if (lower.includes("backstab") || lower.includes("riposte")) return true;
  const matches = [...attackKey.matchAll(/\b(\d+)\b/g)];
  if (!matches.length) return true;
  return matches[matches.length - 1][1] === "1";
}

function effectMatches(e: (typeof effects)[number], ctx: EffectContext): boolean {
  const cond = (e.condition || "").toLowerCase();
  const et = (e.effectType || "").toLowerCase();
  if (cond === "always") return true;
  if (cond.includes("full hp") && ctx.bloodsuckingCrackedTear) return false;
  if (cond.includes("two-handing") && !ctx.twoHanded) return false;
  if (cond.includes("full hp") && !ctx.fullHP) return false;
  if (cond.includes("low hp") && !ctx.lowHP) return false;
  if (cond.includes("blood loss nearby") && !ctx.bloodLossNearby) return false;
  if (cond.includes("madness nearby") && !ctx.madnessNearby) return false;
  if (cond.includes("sleep nearby") && !ctx.sleepNearby) return false;
  if (cond.includes("poison or rot nearby") && !ctx.poisonOrRotNearby) return false;
  if (cond.includes("scarlet rot nearby") && !ctx.scarletRotNearby) return false;
  if (cond.includes("after critical hit") && !ctx.afterCriticalHit) return false;
  if (cond.includes("after killing enemy") && !ctx.afterKillEnemy) return false;
  if (cond.includes("after roll or backstep") && !ctx.afterRollOrBackstep) return false;
  if (cond.includes("charged heavies") && !ctx.isChargedHeavy) return false;
  if (cond.includes("charged") && !ctx.isCharged) return false;
  if (cond.includes("jump") && !ctx.isJumping) return false;
  if (cond.includes("thrust") && !ctx.isThrust) return false;
  if (cond.includes("guard counter") && !ctx.isGuardCounter) return false;
  if (
    (cond.includes("sprinting/dashing") || cond.includes("running") || cond.includes("dashing")) &&
    !ctx.isSprintingOrDashing &&
    !ctx.isRunning
  )
    return false;
  if (cond.includes("critical hits") && !ctx.isCriticalHit && !ctx.afterCriticalHit) return false;
  if (et === "thrust" && !ctx.isThrust) return false;
  if (et === "jump" && !ctx.isJumping) return false;
  if (et === "charged" && !ctx.isCharged) return false;
  if (cond.includes("next attack only")) {
    if (!ctx.allowNextAttackOnly) return false;
  } else if (cond.includes("next attack") && !attackKeyIsFirstHit(ctx.attackKey)) return false;
  return true;
}

export function isNextAttackOnlyEffect(name: string): boolean {
  const e = effects.find((x) => x.name === name);
  return (e?.condition || "").toLowerCase().includes("next attack only");
}

export function isMotionValueDrivenTalisman(name: string): boolean {
  const e = effects.find((x) => x.name === name);
  if (!e || e.type !== "talisman") return false;
  const cond = (e.condition || "").toLowerCase();
  const et = (e.effectType || "").toLowerCase();
  return cond.includes("two-handing") || et === "jump" || et === "charged" || et === "thrust";
}

function damageTargetsForEffect(effectType: string): DamageType[] {
  const lower = effectType.toLowerCase();
  if (!lower) return [0];
  if (
    lower.includes("negation") ||
    lower.includes("resistance") ||
    lower.includes("iframes") ||
    lower.includes("equip load") ||
    lower.includes("defense") ||
    lower.includes("roll")
  ) {
    return [];
  }
  if (lower.includes("all")) return [0, 1, 2, 3, 4];
  if (
    lower.includes("critical") ||
    lower.includes("guard counter") ||
    lower.includes("sprinting") ||
    lower.includes("running") ||
    lower.includes("dashing")
  ) {
    return [0];
  }
  const targets = DAMAGE_TARGETS.filter(([label]) => lower.includes(label)).map(([, dt]) => dt);
  return [...new Set(targets)];
}

function flatBonusEntries(multiplier: string): Array<{ amount: number; target: DamageType }> {
  const matches = multiplier.matchAll(
    /([+-]?\d+(?:\.\d+)?)\s*(ar|physical|magic|fire|lightning|holy)/gi,
  );
  const bonuses: Array<{ amount: number; target: DamageType }> = [];
  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const targetLabel = match[2].toLowerCase();
    const target =
      targetLabel === "ar" || targetLabel === "physical"
        ? 0
        : DAMAGE_TARGETS.find(([label]) => label === targetLabel)?.[1];
    if (target == null) continue;
    bonuses.push({ amount, target });
  }
  return bonuses;
}

function scalingBonusEntries(
  multiplier: string,
  ctx: EffectContext,
): Array<{ amount: number; target: DamageType }> {
  const matches = multiplier.matchAll(
    /([+-]?\d+(?:\.\d+)?)\s*\*\s*(incantation|sorcery)\s+scaling/gi,
  );
  const bonuses: Array<{ amount: number; target: DamageType }> = [];
  for (const match of matches) {
    const coeff = Number(match[1]);
    if (!Number.isFinite(coeff)) continue;
    const scaling =
      match[2].toLowerCase() === "incantation"
        ? ctx.incantationScaling ?? 0
        : ctx.sorceryScaling ?? 0;
    if (!Number.isFinite(scaling) || scaling <= 0) continue;
    bonuses.push({ amount: coeff * scaling, target: 0 });
  }
  return bonuses;
}

const STATUS_TARGETS: Array<[string, StatusType]> = [
  ["bleed", "blood"],
  ["frostbite", "frost"],
  ["madness", "madness"],
  ["poison", "poison"],
  ["scarlet rot", "rot"],
  ["sleep", "sleep"],
];

function flatStatusBonusEntries(multiplier: string): Array<{ amount: number; target: StatusType }> {
  const matches = multiplier.matchAll(
    /([+-]?\d+(?:\.\d+)?)\s*(bleed|frostbite|madness|poison|scarlet rot|sleep)/gi,
  );
  const bonuses: Array<{ amount: number; target: StatusType }> = [];
  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const targetLabel = match[2].toLowerCase();
    const target = STATUS_TARGETS.find(([label]) => label === targetLabel)?.[1];
    if (!target) continue;
    bonuses.push({ amount, target });
  }
  return bonuses;
}

function isBlueDancerCharm(name: string): boolean {
  return name === "Blue Dancer Charm";
}

export function isCrackedOrCrystalTear(name: string): boolean {
  return /(?:cracked|crystal|hard)\s*tear/i.test(name) || /\btear\b/i.test(name);
}

export function isBloodsuckingCrackedTear(name: string): boolean {
  return name === "Bloodsucking Cracked Tear";
}

function statBonusesFromMultiplier(multiplier: string): Partial<Stats> {
  const out: Partial<Stats> = {};
  const statAliasMap: Record<string, StatKey> = {
    STR: "str",
    DEX: "dex",
    INT: "int",
    FAI: "fai",
    ARC: "arc",
    END: "end",
  };
  const matches = multiplier.matchAll(/([+-]?\d+(?:\.\d+)?)\s*([A-Z]+(?:\s*\/\s*[A-Z]+)*)/gi);
  for (const match of matches) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const keys = match[2]
      .toUpperCase()
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const key of keys) {
      const statKey = statAliasMap[key];
      if (!statKey) continue;
      out[statKey] = (out[statKey] ?? 0) + amount;
    }
  }
  return out;
}

export function effectStatBonuses(
  effectNames: string[],
  ctx: EffectContext,
): Partial<Stats> {
  const out: Partial<Stats> = {};
  for (const name of effectNames) {
    const e = effects.find((x) => x.name === name);
    if (!e || !effectMatches(e, ctx)) continue;
    const effectType = (e.effectType || "").toLowerCase();
    const multiplier = (e.multiplier || "").trim();
    if (!effectType.includes("stats")) continue;

    const bonuses = statBonusesFromMultiplier(multiplier);
    if (bonuses.str) out.str = (out.str ?? 0) + bonuses.str;
    if (bonuses.dex) out.dex = (out.dex ?? 0) + bonuses.dex;
    if (bonuses.end) out.end = (out.end ?? 0) + bonuses.end;
  }
  return out;
}

export function applyStatusEffects(
  status: Partial<Record<StatusType, number>>,
  effectNames: string[],
  ctx: EffectContext,
): Partial<Record<StatusType, number>> {
  const out: Partial<Record<StatusType, number>> = {};
  for (const [key, value] of Object.entries(status) as Array<[StatusType, number]>) {
    if (value > 0) out[key] = value >= 100000 ? value / 1000 : value / 100;
  }

  for (const name of effectNames) {
    const e = effects.find((x) => x.name === name);
    if (!e || !effectMatches(e, ctx)) continue;

    const flatBonuses = flatStatusBonusEntries(e.multiplier || "");
    if (!flatBonuses.length) continue;

    for (const bonus of flatBonuses) {
      out[bonus.target] = (out[bonus.target] ?? 0) + bonus.amount;
    }
  }

  return out;
}

function successiveStacksFromAttackKey(attackKey: string): number {
  const match = attackKey.match(/(\d+)(?!.*\d)/);
  if (!match) return 0;
  return Math.max(0, Number(match[1]) - 1);
}

export function applyEffects(
  ar: Record<DamageType, number>,
  effectNames: string[],
  ctx: EffectContext,
): Record<DamageType, number> {
  const out = { ...ar };
  for (const name of effectNames) {
    const e = effects.find((x) => x.name === name);
    if (!e) continue;
    if (!effectMatches(e, ctx)) continue;

    if (isBlueDancerCharm(name)) {
      out[0] *= blueDancerMultiplier(ctx.equippedWeight ?? 30);
      continue;
    }

    const mult = (e.multiplier || "").trim();
    const et = (e.effectType || "").toLowerCase();
    const targets = damageTargetsForEffect(et);
    if (et === "successive") {
      if (!/^\d+(\.\d+)?$/.test(mult)) continue;
      const mNum = Number(mult);
      if (!isFinite(mNum) || mNum <= 0 || mNum > 5) continue;
      const stacks = Math.max(0, ctx.successiveStacks ?? 0);
      const scaled = Math.pow(mNum, stacks);
      out[0] = out[0] * scaled;
      continue;
    }

    const flatBonuses = flatBonusEntries(mult);
    if (flatBonuses.length) {
      for (const bonus of flatBonuses) {
        out[bonus.target] += bonus.amount;
      }
      continue;
    }

    const scalingBonuses = scalingBonusEntries(mult, ctx);
    if (scalingBonuses.length) {
      const bonusAmount = scalingBonuses[0]?.amount ?? 0;
      if (bonusAmount > 0) {
        for (const dt of targets) {
          out[dt] += bonusAmount;
        }
      }
      continue;
    }

    if (!/^\d+(\.\d+)?$/.test(mult)) continue; // only simple numeric multipliers are modeled
    const mNum = Number(mult);
    if (!Number.isFinite(mNum) || mNum <= 0 || mNum > 5) continue;
    for (const dt of targets) {
      out[dt] = out[dt] * mNum;
    }
  }
  return out;
}

// ----- Buff slot enforcement -----
export const BUFF_SLOTS = ["aura", "body", "weapon", "special"] as const;
export type BuffSlot = (typeof BUFF_SLOTS)[number];
export function buffsBySlot(slot: BuffSlot) {
  return effects.filter(
    (e) =>
      (e.type === "buff" || e.type === "consumable") &&
      (e.category || "").toLowerCase() === slot,
  );
}
export const talismanList = effects.filter((e) => e.type === "talisman");

// ----- Final damage with defense + damage negation -----
export function finalDamage(
  ar: Record<DamageType, number>,
  mv: number,
  enemy: EnemyPreset,
): { perType: Record<DamageType, number>; total: number } {
  const perType = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<DamageType, number>;
  for (const dtStr of Object.keys(ar)) {
    const dt = Number(dtStr) as DamageType;
    const raw = ar[dt] * (mv / 100);
    if (raw <= 0) continue;
    const def = enemy.def[dt];
    // ER defense formula approximation
    const afterDef = Math.max(raw - def, raw * 0.1);
    const afterNegation = afterDef * (1 - enemy.damageNegation[dt]);
    perType[dt] = afterNegation;
  }
  const total = (Object.values(perType) as number[]).reduce((a, b) => a + b, 0);
  const clearMult = enemy.clearDamageMultiplier ?? 1;
  if (clearMult !== 1) {
    for (const dtStr of Object.keys(perType)) {
      const dt = Number(dtStr) as DamageType;
      perType[dt] *= clearMult;
    }
  }
  return { perType, total: total * clearMult };
}

// ----- High-level convenience -----
export interface AttackResult {
  attackKey: string;
  baseMv: number;
  mv: number;
  ar: Record<DamageType, number>;
  arAfterEffects: Record<DamageType, number>;
  final: { perType: Record<DamageType, number>; total: number };
}

export function calcAttack(opts: {
  weaponClass: string;
  variant: AffinityVariant;
  level: number;
  stats: Stats;
  twoHanded: boolean;
  attackKey: string;
  effectNames: string[];
  ctx: EffectContext;
  enemy: EnemyPreset;
}): AttackResult | null {
  const ar = computeAR(opts);
  const mvSet = motionValues[opts.attackKey] ? null : null; // placeholder
  // motion-value lookup
  const mvMap = motionValues[opts.attackKey ? "" : ""];
  void mvMap;
  // Note: motionValues is keyed by weapon name, not attack key.
  return null; // not used directly; see calcForWeapon below
}

export function getMotionValues(weaponName: string): Record<string, number> {
  return motionValues[weaponName] || {};
}

export function attackKeysFor(weaponName: string, twoHanded: boolean): string[] {
  const mv = getMotionValues(weaponName);
  const prefix = twoHanded ? "2h " : "1h ";
  return Object.keys(mv).filter((k) => k.startsWith(prefix));
}

export function riposteKeysFor(weaponName: string): string[] {
  const mv = getMotionValues(weaponName);
  return Object.keys(mv).filter((k) => /\bRiposte\b/i.test(k));
}

export function runAttack(opts: {
  weaponClass: string;
  weaponName: string;
  variant: AffinityVariant;
  level: number;
  stats: Stats;
  twoHanded: boolean;
  attackKey: string;
  effectNames: string[];
  armorPieces?: Array<ArmorPiece | null>;
  ctx: EffectContext;
  enemy: EnemyPreset;
}): AttackResult {
  const arRes = computeAR(opts);

  // === IMPROVED MOTION VALUE FALLBACK ===
  let mv = getMotionValues(opts.weaponName)[opts.attackKey];

  if (!mv || mv === 100) {
    const key = opts.attackKey.toLowerCase();
    if (key.includes("charged")) mv = 135;
    else if (key.includes("jump") || key.includes("jumping")) mv = 120;
    else if (key.includes("running") || key.includes("dash")) mv = 110;
    else if (key.includes("r2") || key.includes("heavy")) mv = 125;
    else if (key.includes("skill")) mv = 150;
    else mv = 100; // default normal attack
  }

  // Detect implicit context flags from the attack key for talismans
  const lower = opts.attackKey.toLowerCase();
  const ctx: EffectContext = {
    ...opts.ctx,
    isCharged: opts.ctx.isCharged || lower.includes("charged"),
    isChargedHeavy: opts.ctx.isChargedHeavy || /\bcharged\s+[rl]2\b/i.test(opts.attackKey),
    isJumping: opts.ctx.isJumping || lower.includes("jumping"),
    isRunning: opts.ctx.isRunning || lower.includes("running"),
    isSprintingOrDashing:
      opts.ctx.isSprintingOrDashing || lower.includes("running") || lower.includes("dash"),
    isCriticalHit: opts.ctx.isCriticalHit || /riposte|critical/i.test(opts.attackKey),
    isGuardCounter: opts.ctx.isGuardCounter || /guard counter/i.test(opts.attackKey),
    afterCriticalHit: opts.ctx.afterCriticalHit || /riposte|critical/i.test(opts.attackKey),
    isThrust:
      opts.ctx.isThrust || inferThrustingContext(opts.weaponClass, opts.weaponName, opts.attackKey),
    allowNextAttackOnly: opts.ctx.allowNextAttackOnly || attackKeyIsFirstHit(opts.attackKey),
    successiveStacks: successiveStacksFromAttackKey(opts.attackKey),
    twoHanded: opts.twoHanded,
    attackKey: opts.attackKey,
  };

  const mvDrivenEffectNames = opts.effectNames.filter(isMotionValueDrivenTalisman);
  const arDrivenEffectNames = opts.effectNames.filter((name) => !isMotionValueDrivenTalisman(name));

  const mvMultiplier = mvDrivenEffectNames.reduce((acc, name) => {
    const e = effects.find((x) => x.name === name);
    if (!e || !effectMatches(e, ctx)) return acc;
    const parsed = Number(e.multiplier);
    return Number.isFinite(parsed) && parsed > 0 ? acc * parsed : acc;
  }, 1);

  const effectiveMv = mv * mvMultiplier;
  const arAfterEffects = applyEffects(arRes.total, arDrivenEffectNames, ctx);
  const armorDamageMults = armorDamageMultipliersForPieces(opts.armorPieces ?? [], ctx, opts.attackKey);
  for (const dt of Object.keys(arAfterEffects)) {
    const damageType = Number(dt) as DamageType;
    arAfterEffects[damageType] *= armorDamageMults[damageType] ?? 1;
  }
  const final = finalDamage(arAfterEffects, effectiveMv, opts.enemy);
  const scaduMult = scadutreeDamageMultiplier(ctx.scadutreeFragments ?? 0);
  final.total *= scaduMult;
  for (const dt of Object.keys(final.perType)) {
    final.perType[Number(dt) as DamageType] *= scaduMult;
  }

  return {
    attackKey: opts.attackKey,
    baseMv: mv,
    mv: effectiveMv,
    ar: arRes.total,
    arAfterEffects,
    final,
  };
}
