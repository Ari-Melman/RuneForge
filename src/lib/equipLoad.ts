import weaponWeightsRaw from "@/data/weaponWeights.json";
import talismanWeightsRaw from "@/data/talismanWeights.json";

type WeightEntry = {
  name: string;
  weight: number;
};

function normalizeWeightName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWeightMap(entries: WeightEntry[]) {
  return entries.reduce((map, entry) => {
    map.set(normalizeWeightName(entry.name), entry.weight);
    return map;
  }, new Map<string, number>());
}

const weaponWeightMap = buildWeightMap(weaponWeightsRaw as WeightEntry[]);
const talismanWeightMap = buildWeightMap(talismanWeightsRaw.talismans as WeightEntry[]);

weaponWeightMap.set(
  normalizeWeightName("Beast Claw"),
  weaponWeightMap.get(normalizeWeightName("Beast Claw (Weapon)")) ?? 0,
);
weaponWeightMap.set(normalizeWeightName("Unarmed"), 0);

export function weaponWeightFor(name: string) {
  return weaponWeightMap.get(normalizeWeightName(name)) ?? 0;
}

export function talismanWeightFor(name: string) {
  return talismanWeightMap.get(normalizeWeightName(name)) ?? 0;
}

export function formatEquipLoadWeight(weight: number) {
  return `${weight.toFixed(1)}wt`;
}
