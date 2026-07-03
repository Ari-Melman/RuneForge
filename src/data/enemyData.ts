import enemyCatalog from "@/data/enemyCatalog.json";

export type EnemyCycleKey = "NG" | "NG+" | "NG+2" | "NG+3" | "NG+4" | "NG+5" | "NG+6" | "NG+7";
export type EnemyCategory = "enemy" | "boss";
export type BossTier = "major" | "minor";
export type DamageType = 0 | 1 | 2 | 3 | 4;
export type StatusType = "blood" | "frost" | "madness" | "poison" | "rot" | "sleep";

export interface EnemyCycleStats {
  health: number;
  clearFlag: number | null;
  def: [number, number, number, number, number];
  damageNegation: [number, number, number, number, number];
  resistances: Record<StatusType | "deathblight", number | string>;
  poise: {
    base: number;
    incomingMultiplier: number;
    effective: number;
    regenDelay: number;
  };
}

export interface EnemyRecord {
  location: string;
  name: string;
  id: string | number;
  category: EnemyCategory;
  bossTier?: BossTier | null;
  isDlc: boolean;
  cycles: Partial<Record<EnemyCycleKey, EnemyCycleStats>>;
}

export interface EnemyPreset extends EnemyRecord, EnemyCycleStats {
  cycle: EnemyCycleKey;
  clearDamageMultiplier: number;
}

export interface EnemyCatalog {
  cycles: EnemyCycleKey[];
  cycleLabels: Record<EnemyCycleKey, string>;
  dlcClearBonus: Record<EnemyCycleKey, number>;
  records: EnemyRecord[];
}

const catalog = enemyCatalog as EnemyCatalog;

export const enemyCycleKeys = catalog.cycles;
export const enemyCycleLabels = catalog.cycleLabels;
export const enemyRecords = catalog.records;
export const dlcClearBonus = catalog.dlcClearBonus;

export const ENEMY_CYCLE_OPTIONS = enemyCycleKeys.map((cycle) => ({
  value: cycle,
  label: enemyCycleLabels[cycle],
}));

const majorBossNames = new Set([
  "Margit, the Fell Omen [Boss]",
  "Godrick the Grafted [Boss]",
  "Rennala, Queen of the Full Moon [Boss]",
  "Starscourge Radahn [Boss]",
  "Rykard, Lord of Blasphemy [Boss]",
  "Morgott, the Omen King [Boss]",
  "Fire Giant [Boss]",
  "Godskin Duo [Boss]",
  "Maliketh, The Black Blade [Boss]",
  "Godfrey, First Elden Lord [Boss]",
  "Hoarah Loux [Boss]",
  "Radagon of the Golden Order [Boss]",
  "Elden Beast [Boss]",
  "Divine Beast Dancing Lion [Boss]",
  "Rellana, Twin Moon Knight [Boss]",
  "Messmer the Impaler [Boss]",
  "Romina, Saint of the Bud [Boss]",
  "Scadutree Avatar (Phase 1) [Boss]",
  "Scadutree Avatar (Phase 2) [Boss]",
  "Scadutree Avatar (Phase 3) [Boss]",
  "Promised Consort Radahn [Boss]",
  "Midra, Lord of Frenzied Flame [Boss]",
  "Bayle The Dread [Boss]",
  "Metyr, Mother of Fingers [Boss]",
  "Golden Hippopotamus [Boss]",
  "Jori, Elder Inquisitor [Boss]",
]);

export function enemyKey(record: EnemyRecord): string {
  return `${record.location}||${record.name}`;
}

export function enemyLabel(record: EnemyRecord): string {
  return `${record.location} • ${record.name}`;
}

export function enemyCycleStats(record: EnemyRecord, cycle: EnemyCycleKey): EnemyCycleStats | null {
  return record.cycles[cycle] ?? null;
}

export function resolveEnemyPreset(
  record: EnemyRecord,
  cycle: EnemyCycleKey,
  promisedConsortCleared: boolean,
): EnemyPreset | null {
  const stats = enemyCycleStats(record, cycle);
  if (!stats) return null;
  const clearDamageMultiplier =
    promisedConsortCleared && record.isDlc && stats.clearFlag != null ? dlcClearBonus[cycle] ?? 1 : 1;
  return {
    ...record,
    ...stats,
    cycle,
    clearDamageMultiplier,
  };
}

export function bossTierForRecord(record: EnemyRecord): BossTier | null {
  if (record.category !== "boss") return null;
  return majorBossNames.has(record.name) ? "major" : "minor";
}
