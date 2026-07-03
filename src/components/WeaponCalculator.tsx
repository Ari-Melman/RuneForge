import { useEffect, useMemo, useState } from "react";
import {
  weapons,
  classesFor,
  defaultStats,
  armorPiecesByType,
  armorPieceLabel,
  ARMOR_SLOT_LABELS,
  ARMOR_SLOT_ORDER,
  armorStatBonusesForPieces,
  armorEquipLoadMultiplierForPieces,
  armorNegationMultipliersForPieces,
  effectNegationMultipliersForNames,
  effects,
  talismanList,
  buffsBySlot,
  BUFF_SLOTS,
  type BuffSlot,
  equipLoadCap,
  loadTier,
  computeAR,
  applyEffects,
  applyStatusEffects,
  greatRuneLabel,
  greatRuneStatsBonus,
  GREAT_RUNE_OPTIONS,
  effectStatBonuses,
  computeCatalystScaling,
  isBloodsuckingCrackedTear,
  isCrackedOrCrystalTear,
  isNextAttackOnlyEffect,
  scadutreeDamageMultiplier,
  isMotionValueDrivenTalisman,
  runAttack,
  attackKeysFor,
  riposteKeysFor,
  maxReinforceLevel,
  affinityLabelFor,
  isSuccessiveEffectName,
  STATUS_LABELS,
  formatStatusBuildupValue,
  DAMAGE_LABELS,
  type ArmorSlotType,
  type ArmorPiece,
  type DamageType,
  type EffectContext,
  type GreatRune,
  type Stats,
  type StatusType,
  type Group,
} from "@/lib/calc";
import {
  catalystScaling as catalystScalingData,
  catalystDisplayLabel,
  catalystScalingEntryFor,
} from "@/data/catalystScaling";
import {
  ENEMY_CYCLE_OPTIONS,
  enemyKey,
  enemyLabel,
  enemyRecords,
  resolveEnemyPreset,
  type BossTier,
  type EnemyCategory,
  type EnemyCycleKey,
} from "@/data/enemyData";
import { supabase } from "@/integrations/supabase/client";
import { rateMyBuild } from "@/lib/buildAi.functions";
import { formatEquipLoadWeight, talismanWeightFor, weaponWeightFor } from "@/lib/equipLoad";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface Props {
  group: Group;
  title: string;
  subtitle: string;
  mode?: "melee" | "bow" | "spell";
}

const MUTUALLY_EXCLUSIVE_TALISMANS = [
  ["Winged Sword Insignia", "Rotten Winged Sword Insignia"],
] as const;
const BLOODSUCKING_CRACKED_TEAR = "Bloodsucking Cracked Tear";
const JELLYFISH_SHIELD = "Jellyfish Shield";
const RITUAL_FULL_HP_TALISMANS = new Set(["Ritual Sword Talisman", "Ritual Shield Talisman"]);
const PHYSICK_TEAR_SLOTS = ["Physick Tear 1", "Physick Tear 2"] as const;
const CORE_BUFF_SLOTS = BUFF_SLOTS.filter(
  (slot): slot is Exclude<BuffSlot, "special"> => slot !== "special",
);
const DAMAGE_ORDER: DamageType[] = [0, 1, 2, 3, 4];
const ARMOR_NEGATION_ORDER = ["Phy", "VS Str.", "VS Sla.", "VS Pie.", "Mag", "Fir", "Lit", "Hol"];
const ARMOR_NEGATION_INDEX_BY_LABEL: Record<string, number> = {
  Phy: 0,
  "VS Str.": 0,
  "VS Sla.": 0,
  "VS Pie.": 0,
  Mag: 1,
  Fir: 2,
  Lit: 3,
  Hol: 4,
};
const ARMOR_RESISTANCE_ORDER = ["Imm.", "Rob.", "Foc.", "Vit.", "Poi."];
const MANUAL_CONDITION_OPTIONS = [
  { key: "bloodLossNearby", label: "Blood loss nearby" },
  { key: "madnessNearby", label: "Madness nearby" },
  { key: "madnessSelf", label: "Madness active" },
  { key: "sleepNearby", label: "Sleep nearby" },
  { key: "poisonOrRotNearby", label: "Poison or rot nearby" },
  { key: "scarletRotNearby", label: "Scarlet rot nearby" },
  { key: "afterCriticalHit", label: "After critical hit" },
  { key: "afterKillEnemy", label: "After killing enemy" },
  { key: "afterRollOrBackstep", label: "After roll or backstep" },
] as const;

type ManualConditionKey = (typeof MANUAL_CONDITION_OPTIONS)[number]["key"];
type HpState = "full" | "neutral" | "low";
type BuffSelection = {
  aura: string;
  body: string;
  weapon: string;
  special: string[];
};

function formatAttackLabel(attackKey: string): string {
  let label = attackKey.replace(/^\d+h\s+/i, "").trim();
  label = label.replace(/\bR1\b/gi, "Light").replace(/\bR2\b/gi, "Heavy");
  label = label.replace(/\bL1\b/gi, "Light").replace(/\bL2\b/gi, "Heavy");
  label = label.replace(/\s+/g, " ");
  label = label.replace(/\b(\d+)\b$/, "Attack chain $1");
  return label;
}

function formatSignedAmount(amount: number) {
  const rounded = Math.round(amount);
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

function formatNormalizedStatusBuildupValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

function sumDamageTypes(perType?: Record<DamageType, number> | null) {
  return perType ? Object.values(perType).reduce((a, b) => a + b, 0) : 0;
}

function formatArmorNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatArmorOption(piece: ArmorPiece) {
  return `${armorPieceLabel(piece)} • ${piece.weight.toFixed(1)}wt`;
}

function formatEnemyNumber(value: number | string | null | undefined) {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return value;
}

function formatEnemyNegation(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

const STATUS_RESISTANCE_KEYS: Record<
  StatusType,
  "bleed" | "frost" | "madness" | "poison" | "scarletRot" | "sleep"
> = {
  blood: "bleed",
  frost: "frost",
  madness: "madness",
  poison: "poison",
  rot: "scarletRot",
  sleep: "sleep",
};

const STATUS_RESISTANCE_PROC_MULTIPLIERS: Record<StatusType, number[]> = {
  blood: [1, 1.505, 2.302],
  frost: [1, 1.505, 2.302],
  madness: [1, 1.505, 2.302],
  poison: [1, 1.505, 2.302],
  rot: [1, 1.505, 2.302],
  sleep: [1, 1.505, 2.302],
};

function statusResistanceThresholds(status: StatusType, baseValue: number) {
  return STATUS_RESISTANCE_PROC_MULTIPLIERS[status].map((multiplier) =>
    Math.max(1, Math.ceil(baseValue * multiplier)),
  );
}

function formatEnemyStatusResistance(status: StatusType, value: number | string | null | undefined) {
  if (value == null) return "—";
  if (typeof value !== "number") return value;
  return statusResistanceThresholds(status, value).join("/");
}

function formatStatusProcHits(
  status: StatusType,
  buildup: number,
  resistance: number | string | null | undefined,
) {
  if (typeof resistance !== "number" || buildup <= 0) return null;
  return statusResistanceThresholds(status, resistance)
    .map((threshold, index) => `Proc ${index + 1}: ${Math.ceil(threshold / buildup)} hits`)
    .join(" · ");
}

function formatStatusProcSuffix(
  status: StatusType,
  buildup: number,
  resistance: number | string | null | undefined,
) {
  const procHits = formatStatusProcHits(status, buildup, resistance);
  return procHits ? ` • ${procHits}` : "";
}

function statusEntries(status?: Partial<Record<StatusType, number>>, normalized = false) {
  if (!status) return [];
  return (Object.entries(status) as Array<[StatusType, number]>)
    .filter(([, value]) => value > 0)
    .sort(([a], [b]) => STATUS_LABELS[a].localeCompare(STATUS_LABELS[b]))
    .map(([key, value]) => ({
      key,
      label: STATUS_LABELS[key],
      rawValue: value,
      value: normalized
        ? formatNormalizedStatusBuildupValue(value)
        : formatStatusBuildupValue(value),
    }));
}

export function WeaponCalculator({ group, title, subtitle, mode = "melee" }: Props) {
  const classOptions = useMemo(() => classesFor(group), [group]);
  const [weaponClass, setWeaponClass] = useState(classOptions[0] ?? "");
  const weaponOptions = weapons[weaponClass] ?? [];
  const [weaponName, setWeaponName] = useState(weaponOptions[0]?.name ?? "");
  const weapon = weaponOptions.find((w) => w.name === weaponName) ?? null;
  const initialCatalystName = catalystScalingEntryFor(weaponOptions[0]?.name ?? "")?.name ?? "";
  const [selectedCatalystName, setSelectedCatalystName] = useState(initialCatalystName);

  const affinityOptions = weapon?.affinities ?? [];
  const [affinityId, setAffinityId] = useState<number>(affinityOptions[0]?.affinityId ?? 0);
  const variant =
    affinityOptions.find((a) => a.affinityId === affinityId) ?? affinityOptions[0] ?? null;
  const maxLvl = variant ? maxReinforceLevel(variant.reinforceTypeId) : 25;
  const canChooseAffinity = affinityOptions.length > 1;
  const selectedAffinityLabel = affinityLabelFor(
    variant?.affinityId ?? affinityId,
    variant?.affinityName,
  );

  const [level, setLevel] = useState(0);
  const [catalystLevel, setCatalystLevel] = useState(0);
  const [twoHanded, setTwoHanded] = useState(false);
  const [greatRune, setGreatRune] = useState<GreatRune>("none");
  const [scadutreeFragments, setScadutreeFragments] = useState(1);
  const [stats, setStats] = useState<Stats>(defaultStats);

  const [talSel, setTalSel] = useState<string[]>([]);
  const [buffSel, setBuffSel] = useState<BuffSelection>({
    aura: "",
    body: "",
    weapon: "",
    special: [],
  });

  const [armorSel, setArmorSel] = useState<string[]>(["", "", "", ""]);
  const [enemyCycle, setEnemyCycle] = useState<EnemyCycleKey>("NG");
  const [enemyCategory, setEnemyCategory] = useState<EnemyCategory>("enemy");
  const [enemyBossTier, setEnemyBossTier] = useState<"all" | BossTier>("all");
  const [enemyLocation, setEnemyLocation] = useState("All");
  const [promisedConsortCleared, setPromisedConsortCleared] = useState(false);
  const [enemySelectionKey, setEnemySelectionKey] = useState("");

  const [hpState, setHpState] = useState<HpState>("full");
  const [manualConditionFlags, setManualConditionFlags] = useState<
    Record<ManualConditionKey, boolean>
  >({
    bloodLossNearby: false,
    madnessNearby: false,
    madnessSelf: false,
    sleepNearby: false,
    poisonOrRotNearby: false,
    scarletRotNearby: false,
    afterCriticalHit: false,
    afterKillEnemy: false,
    afterRollOrBackstep: false,
  });

  const equippedWeight = useMemo(() => {
    const armorWeight = armorSel.reduce(
      (a, id, index) =>
        a + (armorPiecesByType[ARMOR_SLOT_ORDER[index]]?.find((x) => x.id === id)?.weight ?? 0),
      0,
    );
    const weaponWeight = weaponWeightFor(weaponName);
    const talismanWeight = talSel.reduce((total, name) => total + talismanWeightFor(name), 0);
    return armorWeight + weaponWeight + talismanWeight;
  }, [armorSel, weaponName, talSel]);

  const effectiveLevel = Math.min(level, maxLvl);
  const selectedCatalyst = useMemo(
    () => catalystScalingEntryFor(selectedCatalystName),
    [selectedCatalystName],
  );
  const catalystMaxLevel = selectedCatalyst ? maxReinforceLevel(selectedCatalyst.reinforceTypeId) : 0;
  const effectiveCatalystLevel = Math.min(catalystLevel, catalystMaxLevel);
  const catalystScaling = useMemo(
    () =>
      computeCatalystScaling({
        catalystName: selectedCatalystName,
        level: effectiveCatalystLevel,
        stats,
      }),
    [selectedCatalystName, effectiveCatalystLevel, stats],
  );
  const sorceryScaling = catalystScaling.sorceryScaling;
  const incantationScaling = catalystScaling.incantScaling;
  const sorceryScalingValue = sorceryScaling ?? 0;
  const incantationScalingValue = incantationScaling ?? 0;
  const selectedBuffNames = useMemo(
    () =>
      [buffSel.aura, buffSel.body, buffSel.weapon, ...buffSel.special].filter(
        (name): name is string => Boolean(name),
      ),
    [buffSel],
  );
  const effectNames = useMemo(() => [...talSel, ...selectedBuffNames], [talSel, selectedBuffNames]);
  const selectedArmorPieces = useMemo(
    () =>
      ARMOR_SLOT_ORDER.map(
        (slot, index) =>
          armorPiecesByType[slot].find((piece) => piece.id === armorSel[index]) ?? null,
      ),
    [armorSel],
  );
  const effectCtx = useMemo<EffectContext>(
    () => ({
      ...manualConditionFlags,
      fullHP: hpState === "full",
      lowHP: hpState === "low",
      equippedWeight,
      scadutreeFragments,
      incantationScaling: incantationScalingValue,
      sorceryScaling: sorceryScalingValue,
      bloodsuckingCrackedTear: effectNames.includes(BLOODSUCKING_CRACKED_TEAR),
    }),
    [
      manualConditionFlags,
      hpState,
      equippedWeight,
      scadutreeFragments,
      incantationScalingValue,
      sorceryScalingValue,
      effectNames,
    ],
  );
  useEffect(() => {
    setCatalystLevel((current) => Math.min(current, catalystMaxLevel));
  }, [catalystMaxLevel]);
  useEffect(() => {
    if (selectedCatalystName) return;
    const catalystFromWeapon = catalystScalingEntryFor(weaponName);
    if (catalystFromWeapon) {
      setSelectedCatalystName(catalystFromWeapon.name);
    }
  }, [weaponName, selectedCatalystName]);
  const specialTearOptions = useMemo(
    () => buffsBySlot("special").filter((effect) => effect.name !== JELLYFISH_SHIELD),
    [],
  );
  const selectedSpecialTears = useMemo(
    () => buffSel.special.filter(isCrackedOrCrystalTear),
    [buffSel.special],
  );
  const jellyfishSelected = buffSel.special.includes(JELLYFISH_SHIELD);
  const armorStatBonuses = useMemo(
    () => armorStatBonusesForPieces(selectedArmorPieces, effectCtx),
    [selectedArmorPieces, effectCtx],
  );
  const armorEquipLoadMultiplier = useMemo(
    () => armorEquipLoadMultiplierForPieces(selectedArmorPieces, effectCtx),
    [selectedArmorPieces, effectCtx],
  );
  const armorNegationMultipliers = useMemo(
    () => armorNegationMultipliersForPieces(selectedArmorPieces, effectCtx),
    [selectedArmorPieces, effectCtx],
  );
  const effectNegationMultipliers = useMemo(
    () => effectNegationMultipliersForNames(effectNames, effectCtx),
    [effectNames, effectCtx],
  );
  const buffStatBonuses = useMemo(
    () => effectStatBonuses(effectNames, effectCtx),
    [effectNames, effectCtx],
  );
  const effectiveStats = useMemo(() => {
    const runeBonus = greatRuneStatsBonus(greatRune);
    return {
      ...stats,
      str: stats.str + (runeBonus.str ?? 0) + (buffStatBonuses.str ?? 0) + (armorStatBonuses.str ?? 0),
      dex: stats.dex + (runeBonus.dex ?? 0) + (buffStatBonuses.dex ?? 0) + (armorStatBonuses.dex ?? 0),
      int: stats.int + (runeBonus.int ?? 0) + (buffStatBonuses.int ?? 0) + (armorStatBonuses.int ?? 0),
      fai: stats.fai + (runeBonus.fai ?? 0) + (buffStatBonuses.fai ?? 0) + (armorStatBonuses.fai ?? 0),
      arc: stats.arc + (runeBonus.arc ?? 0) + (buffStatBonuses.arc ?? 0) + (armorStatBonuses.arc ?? 0),
      end: stats.end + (runeBonus.end ?? 0) + (buffStatBonuses.end ?? 0) + (armorStatBonuses.end ?? 0),
    };
  }, [stats, greatRune, buffStatBonuses, armorStatBonuses]);

  const enemyCycleRecords = useMemo(
    () => enemyRecords.filter((record) => record.cycles[enemyCycle]),
    [enemyCycle],
  );
  const enemyLocations = useMemo(() => {
    const locations = new Set<string>();
    for (const record of enemyCycleRecords) {
      if (record.category !== enemyCategory) continue;
      if (enemyCategory === "boss" && enemyBossTier !== "all" && record.bossTier !== enemyBossTier) {
        continue;
      }
      locations.add(record.location);
    }
    return [...locations].sort((a, b) => a.localeCompare(b));
  }, [enemyCycleRecords, enemyCategory, enemyBossTier]);

  const filteredEnemyRecords = useMemo(() => {
    const records = enemyCycleRecords.filter((record) => {
      if (record.category !== enemyCategory) return false;
      if (enemyCategory === "enemy") {
        if (enemyLocation !== "All" && record.location !== enemyLocation) return false;
        return true;
      }
      if (enemyBossTier !== "all" && record.bossTier !== enemyBossTier) return false;
      return true;
    });

    return [...records].sort((a, b) => {
      if (enemyCategory === "boss") {
        const tierOrder = (tier?: BossTier | null) => (tier === "major" ? 0 : 1);
        const tierDelta = tierOrder(a.bossTier) - tierOrder(b.bossTier);
        if (tierDelta !== 0) return tierDelta;
      }
      const locationDelta = a.location.localeCompare(b.location);
      if (locationDelta !== 0) return locationDelta;
      return a.name.localeCompare(b.name);
    });
  }, [enemyCycleRecords, enemyCategory, enemyLocation, enemyBossTier]);

  useEffect(() => {
    if (filteredEnemyRecords.length === 0) {
      if (enemySelectionKey) setEnemySelectionKey("");
      return;
    }
    if (!filteredEnemyRecords.some((record) => enemyKey(record) === enemySelectionKey)) {
      setEnemySelectionKey(enemyKey(filteredEnemyRecords[0]));
    }
  }, [filteredEnemyRecords, enemySelectionKey]);

  const selectedEnemyRecord = useMemo(
    () =>
      filteredEnemyRecords.find((record) => enemyKey(record) === enemySelectionKey) ??
      filteredEnemyRecords[0] ??
      null,
    [filteredEnemyRecords, enemySelectionKey],
  );
  const selectedEnemy = useMemo(
    () =>
      selectedEnemyRecord ? resolveEnemyPreset(selectedEnemyRecord, enemyCycle, promisedConsortCleared) : null,
    [selectedEnemyRecord, enemyCycle, promisedConsortCleared],
  );

  const selectedStatusEntries = useMemo(
    () =>
      variant
        ? statusEntries(
            applyStatusEffects(variant.statusBuildup ?? {}, effectNames, effectCtx),
            true,
          )
        : [],
    [variant, effectNames, effectCtx],
  );

  // Attack Rating + Results (recalculated when stats change)
  const ar = useMemo(() => {
    if (!variant) return null;
    return computeAR({
      variant,
      level: effectiveLevel,
      stats: effectiveStats,
      twoHanded,
    });
  }, [variant, effectiveLevel, effectiveStats, twoHanded]);

  const arEffectNames = useMemo(
    () => effectNames.filter((name) => !isMotionValueDrivenTalisman(name)),
    [effectNames],
  );
  const hasFirstHitOnlyEffect = useMemo(
    () => arEffectNames.some((name) => isNextAttackOnlyEffect(name)),
    [arEffectNames],
  );
  const arWithEffects = useMemo(() => {
    if (!ar) return null;
    const regularEffectNames = arEffectNames.filter((name) => !isNextAttackOnlyEffect(name));
    return applyEffects(ar.total, regularEffectNames, effectCtx);
  }, [ar, arEffectNames, effectCtx]);
  const arWithEffectsTotal = useMemo(() => sumDamageTypes(arWithEffects), [arWithEffects]);
  const arWithFirstHitEffects = useMemo(() => {
    if (!ar) return null;
    return applyEffects(ar.total, arEffectNames, {
      ...effectCtx,
      allowNextAttackOnly: true,
    });
  }, [ar, arEffectNames, effectCtx]);
  const arWithFirstHitEffectsTotal = useMemo(
    () => sumDamageTypes(arWithFirstHitEffects),
    [arWithFirstHitEffects],
  );

  const nonSuccessiveEffectNames = useMemo(
    () =>
      effectNames.filter(
        (name) => !isSuccessiveEffectName(name) && !isMotionValueDrivenTalisman(name),
      ),
    [effectNames],
  );
  const arWithoutSuccessive = useMemo(() => {
    if (!ar) return null;
    return applyEffects(ar.total, nonSuccessiveEffectNames, effectCtx);
  }, [ar, nonSuccessiveEffectNames, effectCtx]);

  const successiveNames = useMemo(
    () => effectNames.filter((name) => isSuccessiveEffectName(name)),
    [effectNames],
  );
  const physicalAR = arWithoutSuccessive?.[0] ?? ar?.total[0] ?? 0;
  const successiveChain = useMemo(() => {
    if (!ar || successiveNames.length === 0) return null;
    const mult = successiveNames.reduce((acc, name) => {
      const e = effects.find((x) => x.name === name);
      const parsed = Number(e?.multiplier ?? 1);
      return acc * (Number.isFinite(parsed) ? parsed : 1);
    }, 1);
    if (!Number.isFinite(mult) || mult <= 0) return null;

    const hits: number[] = [];
    let current = Math.round(physicalAR);
    hits.push(current);
    for (let i = 1; i < 4; i += 1) {
      current = Math.round(current * mult);
      hits.push(current);
    }
    return { hits, mult };
  }, [ar, successiveNames, physicalAR]);

  const arDamageTypes = useMemo(
    () => DAMAGE_ORDER.filter((dt) => (ar?.total[dt] ?? 0) > 0 || (arWithEffects?.[dt] ?? 0) > 0),
    [ar, arWithEffects],
  );
  const arRows = useMemo(
    () =>
      arDamageTypes.map((dt) => {
        const base = ar?.total[dt] ?? 0;
        const buffed = arWithEffects?.[dt] ?? base;
        return {
          dt,
          baseAR: Math.round(ar?.base[dt] ?? 0),
          scaledAR: Math.round(ar?.scaled[dt] ?? 0),
          baseTotal: Math.round(base),
          buffedTotal: Math.round(buffed),
          bonus: Math.round(buffed - base),
        };
      }),
    [ar, arDamageTypes, arWithEffects],
  );

  const mvKeys = useMemo(() => attackKeysFor(weaponName, twoHanded), [weaponName, twoHanded]);
  const riposteKeys = useMemo(() => riposteKeysFor(weaponName), [weaponName]);

  const results = useMemo(() => {
    if (!variant || !selectedEnemy) return [];
    return mvKeys.map((k) =>
      runAttack({
        weaponClass,
        weaponName,
        variant,
        level: effectiveLevel,
        stats: effectiveStats,
        twoHanded,
        attackKey: k,
        effectNames,
        armorPieces: selectedArmorPieces,
        ctx: effectCtx,
        enemy: selectedEnemy,
      }),
    );
  }, [
    variant,
    mvKeys,
    weaponName,
    effectiveLevel,
    effectiveStats,
    twoHanded,
    effectNames,
    effectCtx,
    selectedEnemy,
    selectedArmorPieces,
  ]);

  const riposteResults = useMemo(() => {
    if (!variant || !selectedEnemy) return [];
    return riposteKeys.map((k) =>
      runAttack({
        weaponClass,
        weaponName,
        variant,
        level: effectiveLevel,
        stats: effectiveStats,
        twoHanded,
        attackKey: k,
        effectNames,
        armorPieces: selectedArmorPieces,
        ctx: effectCtx,
        enemy: selectedEnemy,
      }),
    );
  }, [
    variant,
    riposteKeys,
    weaponClass,
    weaponName,
    effectiveLevel,
    effectiveStats,
    twoHanded,
    effectNames,
    effectCtx,
    selectedEnemy,
    selectedArmorPieces,
  ]);

  const armorWeight = armorSel.reduce(
    (a, id, index) =>
      a + (armorPiecesByType[ARMOR_SLOT_ORDER[index]]?.find((x) => x.id === id)?.weight ?? 0),
    0,
  );
  const selectedWeaponWeight = weaponWeightFor(weaponName);
  const talismanWeight = useMemo(
    () => talSel.reduce((total, name) => total + talismanWeightFor(name), 0),
    [talSel],
  );
  const equipUsed = armorWeight + selectedWeaponWeight + talismanWeight;
  const cap = equipLoadCap(effectiveStats.end) * armorEquipLoadMultiplier;
  const tier = loadTier(equipUsed, cap);
  const armorNegationTotals = useMemo(
    () =>
      ARMOR_NEGATION_ORDER.reduce(
        (acc, key) => {
          const base = selectedArmorPieces.reduce(
            (total, piece) => total + (piece?.damageNegation[key] ?? 0),
            0,
          );
          const armorMultiplier =
            armorNegationMultipliers[ARMOR_NEGATION_INDEX_BY_LABEL[key] ?? 0] ?? 1;
          const buffMultiplier =
            effectNegationMultipliers[ARMOR_NEGATION_INDEX_BY_LABEL[key] ?? 0] ?? 1;
          acc[key] = base * armorMultiplier * buffMultiplier;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [selectedArmorPieces, armorNegationMultipliers, effectNegationMultipliers],
  );

  const onClassChange = (c: string) => {
    setWeaponClass(c);
    const first = weapons[c]?.[0];
    if (first) {
      setWeaponName(first.name);
      setAffinityId(first.affinities[0]?.affinityId ?? 0);
      if (!selectedCatalystName) {
        const catalystFromWeapon = catalystScalingEntryFor(first.name);
        if (catalystFromWeapon) setSelectedCatalystName(catalystFromWeapon.name);
      }
    }
  };
  const onWeaponChange = (n: string) => {
    setWeaponName(n);
    const w = weaponOptions.find((x) => x.name === n);
    if (w) setAffinityId(w.affinities[0]?.affinityId ?? 0);
    if (!selectedCatalystName) {
      const catalystFromWeapon = catalystScalingEntryFor(n);
      if (catalystFromWeapon) setSelectedCatalystName(catalystFromWeapon.name);
    }
  };
  const toggleTal = (n: string) => {
    if (RITUAL_FULL_HP_TALISMANS.has(n) && buffSel.special.some(isBloodsuckingCrackedTear)) {
      return;
    }
    setTalSel((cur) =>
      MUTUALLY_EXCLUSIVE_TALISMANS.find((pair) => pair[0] === n || pair[1] === n)
        ? (() => {
            const pair = MUTUALLY_EXCLUSIVE_TALISMANS.find((p) => p[0] === n || p[1] === n);
            if (!pair)
              return cur.includes(n)
                ? cur.filter((x) => x !== n)
                : cur.length < 4
                  ? [...cur, n]
                  : cur;
            const other = pair[0] === n ? pair[1] : pair[0];
            const withoutOther = cur.filter((x) => x !== other);
            if (withoutOther.includes(n)) return withoutOther.filter((x) => x !== n);
            if (withoutOther.length >= 4) return withoutOther;
            return [...withoutOther, n];
          })()
        : cur.includes(n)
          ? cur.filter((x) => x !== n)
          : cur.length < 4
            ? [...cur, n]
            : cur,
    );
  };
  const toggleSpecial = (n: string) => {
    setBuffSel((cur) => {
      if (cur.special.includes(n)) {
        return { ...cur, special: cur.special.filter((x) => x !== n) };
      }

      const isTear = isCrackedOrCrystalTear(n);
      if (isTear && cur.special.filter(isCrackedOrCrystalTear).length >= 2) {
        return cur;
      }

      return { ...cur, special: [...cur.special, n] };
    });

    if (isBloodsuckingCrackedTear(n)) {
      setTalSel((cur) => cur.filter((x) => !RITUAL_FULL_HP_TALISMANS.has(x)));
    }
  };
  const setPhysickTearSlot = (slotIndex: 0 | 1, name: string) => {
    setBuffSel((cur) => {
      const nonTears = cur.special.filter((entry) => !isCrackedOrCrystalTear(entry));
      const currentTears = cur.special.filter((entry) => isCrackedOrCrystalTear(entry));
      const nextTears = [currentTears[0] ?? "", currentTears[1] ?? ""];
      nextTears[slotIndex] = name;
      const dedupedTears = nextTears.filter(
        (tear, idx, arr) => tear && arr.indexOf(tear) === idx,
      );
      return { ...cur, special: [...nonTears, ...dedupedTears] };
    });

    if (name === BLOODSUCKING_CRACKED_TEAR) {
      setTalSel((cur) => cur.filter((x) => !RITUAL_FULL_HP_TALISMANS.has(x)));
    }
  };

  // ---- Save / AI ----
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save builds");
      setSaving(false);
      return;
    }
    const payload = {
      weaponClass,
      weaponName,
      affinityId,
      level: effectiveLevel,
      twoHanded,
      stats,
      greatRune,
      scadutreeFragments,
      catalystName: selectedCatalystName,
      catalystLevel: effectiveCatalystLevel,
      incantationScaling,
      sorceryScaling,
      talSel,
      buffSel,
      armorSel,
      enemySelection: {
        cycle: enemyCycle,
        category: enemyCategory,
        bossTier: enemyBossTier,
        location: enemyLocation,
        promisedConsortCleared,
        key: enemySelectionKey,
        name: selectedEnemy?.name ?? "",
        display: selectedEnemy ? enemyLabel(selectedEnemy) : "",
      },
      ctxFlags: effectCtx,
    };
    const { error } = await supabase.from("saved_builds").insert({
      user_id: user.id,
      page: group,
      name: saveName || `${weaponName} build`,
      build: payload as never,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Build saved");
  };

  const rate = useServerFn(rateMyBuild);
  const [rating, setRating] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const askAi = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to use AI rating");
      return;
    }
    setRatingLoading(true);
    try {
      const r = await rate({
        data: {
          build: {
            weaponClass,
            weaponName,
            affinity: selectedAffinityLabel,
            level: effectiveLevel,
            twoHanded,
            stats,
            greatRune,
            scadutreeFragments,
            catalystName: selectedCatalystName,
            catalystLevel: effectiveCatalystLevel,
            incantationScaling,
            sorceryScaling,
            talSel,
            buffSel,
            enemy: selectedEnemy
              ? {
                  cycle: enemyCycle,
                  category: enemyCategory,
                  bossTier: enemyBossTier,
                  location: selectedEnemy.location,
                  name: selectedEnemy.name,
                  promisedConsortCleared,
                }
              : null,
            ar: arWithEffects
              ? Object.values(arWithEffects).reduce((a, b) => a + b, 0)
              : ar?.totalAR,
            results: results.map((r) => ({ k: r.attackKey, dmg: r.final.total })),
          },
        },
      });
      setRating(r.text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRatingLoading(false);
    }
  };

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-5 py-20">
      <div className="text-center mb-9">
        <p className="text-gold uppercase tracking-[0.32em] text-xs mb-3 font-display">
          {group} arsenal
        </p>
        <h1 className="text-4xl sm:text-[3.15rem] font-display font-bold text-white">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">{subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <Panel title="Weapon">
          <Label>Class</Label>
          <Select value={weaponClass} onChange={onClassChange} options={classOptions} />
          <Label>Weapon</Label>
          <Select
            value={weaponName}
            onChange={onWeaponChange}
            options={weaponOptions.map((w) => w.name)}
          />
          <p className="text-xs text-muted-foreground">
            Weapon weight:{" "}
            <span className="text-gold">{formatEquipLoadWeight(selectedWeaponWeight)}</span>
          </p>
          <Label>Affinity</Label>
          {canChooseAffinity ? (
            <select
              value={String(affinityId)}
              onChange={(e) => setAffinityId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-input border border-border text-sm focus:border-gold focus:outline-none"
            >
              {affinityOptions.map((a) => (
                <option key={a.affinityId} value={a.affinityId}>
                  {affinityLabelFor(a.affinityId, a.affinityName)}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full px-3 py-2 rounded bg-input border border-border text-sm text-muted-foreground">
              {selectedAffinityLabel}
            </div>
          )}
          <Label>
            Upgrade Level (+{Math.min(level, maxLvl)} / +{maxLvl})
          </Label>
          <input
            type="range"
            min={0}
            max={maxLvl}
            value={Math.min(level, maxLvl)}
            onChange={(e) => setLevel(+e.target.value)}
            className="w-full accent-[color:var(--gold)]"
          />
          {mode === "melee" && (
            <Toggle label="Two-Handed (STR ×1.5)" on={twoHanded} setOn={setTwoHanded} />
          )}
          {variant && (
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              {variant.attributeScaling
                .filter(([, v]) => v > 0)
                .map(([s, v]) => (
                  <div key={s} className="flex justify-between">
                    <span className="uppercase">{s}</span>
                    <span className="text-gold">×{v.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <Panel title="Attributes">
          {(["str", "dex", "int", "fai", "arc", "end"] as const).map((k) => (
            <div key={k}>
              <Label>
                {k.toUpperCase()} ({stats[k]}
                {effectiveStats[k] !== stats[k] ? ` → ${effectiveStats[k]}` : ""}
                {k === "str" && twoHanded ? ` → ${Math.floor(effectiveStats.str * 1.5)}` : ""})
              </Label>
              <input
                type="range"
                min={1}
                max={99}
                value={stats[k]}
                onChange={(e) => setStats((prev) => ({ ...prev, [k]: +e.target.value }))}
                className="w-full accent-[color:var(--gold)]"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Equip Load:{" "}
            <span className="text-gold">
              {formatEquipLoadWeight(equipUsed)} / {formatEquipLoadWeight(cap)}
            </span>{" "}
            — <span className="text-gold-glow">{tier}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Armor {formatEquipLoadWeight(armorWeight)} · Weapon{" "}
            {formatEquipLoadWeight(selectedWeaponWeight)} · Talismans{" "}
            {formatEquipLoadWeight(talismanWeight)}
          </p>
        </Panel>

        <Panel title="Target">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>NG Cycle</Label>
              <Select value={enemyCycle} onChange={(v) => setEnemyCycle(v as EnemyCycleKey)} options={ENEMY_CYCLE_OPTIONS} />
            </div>
            <div>
              <Label>Target Type</Label>
              <Select
                value={enemyCategory}
                onChange={(v) => {
                  setEnemyCategory(v as EnemyCategory);
                  setEnemyBossTier("all");
                  setEnemyLocation("All");
                }}
                options={[
                  { value: "enemy", label: "Enemy" },
                  { value: "boss", label: "Boss" },
                ]}
              />
            </div>
            {enemyCategory === "enemy" ? (
              <div className="md:col-span-2">
                <Label>Location</Label>
                <Select
                  value={enemyLocation}
                  onChange={setEnemyLocation}
                  options={["All", ...enemyLocations]}
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <Label>Boss Tier</Label>
                <Select
                  value={enemyBossTier}
                  onChange={(v) => setEnemyBossTier(v as "all" | BossTier)}
                  options={[
                    { value: "all", label: "All Bosses" },
                    { value: "major", label: "Major Bosses" },
                    { value: "minor", label: "Minor Bosses" },
                  ]}
                />
              </div>
            )}
            <div className="md:col-span-2 rounded-md border border-border/60 bg-background/25 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={promisedConsortCleared}
                  onCheckedChange={() => setPromisedConsortCleared((cur) => !cur)}
                  id="promised-consort-cleared"
                  className="mt-1 border-gold data-[state=checked]:bg-gold data-[state=checked]:text-black"
                />
                <label htmlFor="promised-consort-cleared" className="flex-1 cursor-pointer">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">
                      Promised Consort cleared
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Applies DLC post-clear damage bonus
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Only DLC enemies with a clear flag get the post-clear multiplier for the selected NG cycle.
                  </p>
                </label>
              </div>
            </div>
          </div>

          <Label>Target</Label>
          <Select
            value={enemySelectionKey}
            onChange={setEnemySelectionKey}
            options={filteredEnemyRecords.map((record) => ({
              value: enemyKey(record),
              label:
                enemyCategory === "enemy"
                  ? `${record.location} • ${record.name}`
                  : `${record.name} • ${record.location}`,
            }))}
          />
          {selectedEnemy && (
            <p className="text-xs text-muted-foreground">
              {selectedEnemy.category === "boss"
                ? `${selectedEnemy.bossTier === "major" ? "Major boss" : "Minor boss"}`
                : "Enemy"}{" "}
              · {selectedEnemy.location}
              {selectedEnemy.isDlc && selectedEnemy.clearDamageMultiplier !== 1
                ? ` · DLC clear x${selectedEnemy.clearDamageMultiplier.toFixed(3)}`
                : ""}
            </p>
          )}
        </Panel>
        
        <Panel title="World Bonuses" wide>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Great Rune</Label>
              <Select
                value={greatRune}
                onChange={(value) => setGreatRune(value as GreatRune)}
                options={GREAT_RUNE_OPTIONS.map((rune) => ({
                  value: rune,
                  label: greatRuneLabel(rune),
                }))}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Only Godrick&apos;s Great Rune changes damage here. It adds +5 to every stat.
              </p>
            </div>
            <div>
              <Label>Scadutree Fragments</Label>
              <input
                type="number"
                min={1}
                max={20}
                value={scadutreeFragments}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setScadutreeFragments(
                    Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.trunc(parsed))) : 1,
                  );
                }}
                className="w-full px-3 py-2 rounded bg-input border border-border text-sm focus:border-gold focus:outline-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Damage multiplier: x{scadutreeDamageMultiplier(scadutreeFragments).toFixed(3)}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Active Conditions" wide>
          <Label>HP State</Label>
          <Select
            value={hpState}
            onChange={(value) => setHpState(value as HpState)}
            options={[
              { value: "full", label: "Full HP" },
              { value: "neutral", label: "Neutral" },
              { value: "low", label: "Low HP" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Talismans with fight-state requirements need these toggles or the HP selector turned on.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            {MANUAL_CONDITION_OPTIONS.map((option) => {
              const on = manualConditionFlags[option.key];
              return (
                <SmallToggle
                  key={option.key}
                  label={option.label}
                  on={on}
                  setOn={(v) =>
                    setManualConditionFlags((cur) => ({
                      ...cur,
                      [option.key]: v,
                    }))
                  }
                />
              );
            })}
          </div>
        </Panel>

        <Panel title={`Talismans (${talSel.length}/4)`} wide>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {talismanList.map((t) => {
              const on = talSel.includes(t.name);
              const bloodsuckingOn = buffSel.special.includes(BLOODSUCKING_CRACKED_TEAR);
              const locked = bloodsuckingOn && RITUAL_FULL_HP_TALISMANS.has(t.name);
              const weight = talismanWeightFor(t.name);
              return (
                <button
                  key={t.name}
                  onClick={() => toggleTal(t.name)}
                  disabled={locked}
                  className={`text-left text-sm px-3 py-2 rounded border transition ${
                    locked
                      ? "cursor-not-allowed border-border/40 text-muted-foreground/60 opacity-60"
                      : on
                        ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-gold-glow"
                        : "border-border hover:border-gold/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-medium">
                    <span>{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatEquipLoadWeight(weight)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.name === "Blue Dancer Charm"
                      ? "Physical attack scales with equipped weight"
                      : `${t.effectType} · ×${t.multiplier} · ${t.condition}`}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Buffs" wide>
          <div className="grid gap-3 xl:grid-cols-3 xl:grid-rows-2 xl:items-start">
            <div className="xl:col-start-1 xl:row-start-1">
              <Label>Aura Buff</Label>
              <Select
                value={buffSel.aura}
                onChange={(v) => setBuffSel({ ...buffSel, aura: v })}
                options={["", ...buffsBySlot("aura").map((b) => b.name)]}
              />
              {buffSel.aura && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {effects.find((e) => e.name === buffSel.aura)?.effectType} · ×
                  {effects.find((e) => e.name === buffSel.aura)?.multiplier}
                </p>
              )}
            </div>

            <div className="xl:col-start-1 xl:row-start-2">
              <Label>Body Buff</Label>
              <Select
                value={buffSel.body}
                onChange={(v) => setBuffSel({ ...buffSel, body: v })}
                options={["", ...buffsBySlot("body").map((b) => b.name)]}
              />
              {buffSel.body && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {effects.find((e) => e.name === buffSel.body)?.effectType} · ×
                  {effects.find((e) => e.name === buffSel.body)?.multiplier}
                </p>
              )}
            </div>

            <div className="xl:col-start-2 xl:row-start-1">
              <Label>Staff/Seal</Label>
              <Select
                value={selectedCatalystName}
                onChange={setSelectedCatalystName}
                options={[
                  "",
                  ...catalystScalingData.map((entry) => ({
                    value: entry.name,
                    label: catalystDisplayLabel(entry),
                  })),
                ]}
              />
              {selectedCatalyst ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedCatalyst.kind === "sorcery" ? "Staff" : "Seal"} · +
                  {effectiveCatalystLevel} / +{catalystMaxLevel}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a staff or seal to calculate scaling.
                </p>
              )}
            </div>

            <div className="xl:col-start-2 xl:row-start-2">
              <div className="grid gap-1.5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-border/70 bg-background/25 p-2.5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.24em] text-muted-foreground">
                        Upgrade Level 
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        +0 / +{catalystMaxLevel}
                      </p>
                    </div>
                    <p className="font-display text-base text-gold">
                      +{selectedCatalyst ? effectiveCatalystLevel : 0}
                    </p>
                  </div>
                  <div className="mt-1">
                    <Slider
                      value={[selectedCatalyst ? effectiveCatalystLevel : 0]}
                      min={0}
                      max={Math.max(catalystMaxLevel, 0)}
                      step={1}
                      disabled={!selectedCatalyst}
                      onValueChange={(value) => setCatalystLevel(value[0] ?? 0)}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/25 p-2.5">
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                    Incant Scaling
                  </p>
                  <p className="mt-1.5 font-display text-xl text-white">
                    {incantationScaling ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/25 p-2.5">
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                    Sorcery Scaling
                  </p>
                  <p className="mt-1.5 font-display text-xl text-white">
                    {sorceryScaling ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="xl:col-start-3 xl:row-start-1">
              <Label>Armament Buff</Label>
              <Select
                value={buffSel.weapon}
                onChange={(v) => setBuffSel({ ...buffSel, weapon: v })}
                options={["", ...buffsBySlot("weapon").map((b) => b.name)]}
              />
              {buffSel.weapon && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {effects.find((e) => e.name === buffSel.weapon)?.effectType} · ×
                  {effects.find((e) => e.name === buffSel.weapon)?.multiplier}
                </p>
              )}
            </div>

            <div className="xl:col-start-3 xl:row-start-2">
              <div className="rounded-xl border border-border/70 bg-background/25 p-2.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={jellyfishSelected}
                    onCheckedChange={() => toggleSpecial(JELLYFISH_SHIELD)}
                    id="jellyfish-shield"
                    className="mt-1 border-gold data-[state=checked]:bg-gold data-[state=checked]:text-black"
                  />
                  <label htmlFor="jellyfish-shield" className="flex-1 cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold text-white">Jellyfish Shield</span>
                      <span className="max-w-[12rem] text-right text-[9px] text-muted-foreground">
                        Special damage buff (Stacks with all buffs)
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">all · ×1.20 · AOW used</p>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-background/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                  Physick Tears
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pick up to two tears.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tears selected: {selectedSpecialTears.length}/2
              </p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {PHYSICK_TEAR_SLOTS.map((label, index) => {
                const value = selectedSpecialTears[index] ?? "";
                const effect = effects.find((e) => e.name === value);
                return (
                  <div key={label}>
                    <Label>{label}</Label>
                    <Select
                      value={value}
                      onChange={(next) => setPhysickTearSlot(index as 0 | 1, next)}
                      options={["", ...specialTearOptions.map((effectOption) => effectOption.name)]}
                    />
                    {effect && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {effect.effectType} · ×{effect.multiplier} · {effect.condition}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {buffSel.special.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {buffSel.special.map((name) => {
                  const effect = effects.find((e) => e.name === name);
                  return (
                    <span
                      key={name}
                      className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {name}
                      {effect ? ` · ${effect.effectType}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {effectNames.some((n) => {
            const e = effects.find((x) => x.name === n);
            return (
              !!e && /bleed|poison|scarlet rot|frostbite|madness|sleep/i.test(e.effectType || "")
            );
          }) && (
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Status-related effects
              </p>
              <div className="flex flex-wrap gap-2">
                {effectNames.map((n) => {
                  const e = effects.find((x) => x.name === n);
                  if (
                    !e ||
                    !/bleed|poison|scarlet rot|frostbite|madness|sleep/i.test(e.effectType || "")
                  )
                    return null;
                  return (
                    <span
                      key={n}
                      className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground"
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                These are the currently selected status-related talismans and buffs.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Attack Rating" className="col-span-full">
          
            <div classname="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {hasFirstHitOnlyEffect ? "Total AR / Total AR on First Hit" : "Total AR"}
            </p>
            <p className="text-3xl font-display text-gold-glow">
              {ar
                ? hasFirstHitOnlyEffect
                  ? `${Math.round(arWithEffects ? arWithEffectsTotal : ar.totalAR)} / ${Math.round(
                      arWithFirstHitEffects ? arWithFirstHitEffectsTotal : ar.totalAR,
                    )}`
                  : `${Math.round(arWithEffects ? arWithEffectsTotal : ar.totalAR)}`
                : "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-muted-foreground">
                Base AR: {ar ? Math.round(ar.totalAR) : "—"}
              </span>
              {arWithEffects && (
                <span className="rounded-full border border-gold/40 bg-[color:var(--gold)]/10 px-2 py-1 text-gold">
                  Final AR: {Math.round(arWithEffectsTotal)}
                </span>
              )}
              {hasFirstHitOnlyEffect &&
                arWithFirstHitEffects &&
                Math.round(arWithFirstHitEffectsTotal) !== Math.round(arWithEffectsTotal) && (
                  <span className="rounded-full border border-gold/40 bg-[color:var(--gold)]/10 px-2 py-1 text-gold">
                    First Hit AR: {Math.round(arWithFirstHitEffectsTotal)}
                  </span>
                )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Status buildup
              </p>
              {selectedStatusEntries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedStatusEntries.map((status) => (
                    <span
                      key={status.key}
                      className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {status.label} {status.value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No status buildup</p>
              )}
            </div>
            {selectedEnemy && (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Defense
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {[0, 1, 2, 3, 4].map((dt) => (
                      <span
                        key={`def-${dt}`}
                        className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-muted-foreground"
                      >
                        {DAMAGE_LABELS[dt as DamageType]} {formatEnemyNumber(selectedEnemy.def[dt as DamageType])}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Damage negation
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {[0, 1, 2, 3, 4].map((dt) => (
                      <span
                        key={`neg-${dt}`}
                        className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-muted-foreground"
                      >
                        {DAMAGE_LABELS[dt as DamageType]} {formatEnemyNegation(selectedEnemy.damageNegation[dt as DamageType])}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/25 p-3 md:col-span-2 xl:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Resistances
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {[
                      { label: "Poison", status: "poison", value: selectedEnemy.resistances.poison },
                      { label: "Rot", status: "rot", value: selectedEnemy.resistances.scarletRot },
                      { label: "Bleed", status: "blood", value: selectedEnemy.resistances.bleed },
                      { label: "Frost", status: "frost", value: selectedEnemy.resistances.frost },
                      { label: "Sleep", status: "sleep", value: selectedEnemy.resistances.sleep },
                      { label: "Madness", status: "madness", value: selectedEnemy.resistances.madness },
                      { label: "Deathblight", value: selectedEnemy.resistances.deathblight },
                    ].map(({ label, status, value }) => (
                      <span
                        key={label as string}
                        className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-muted-foreground"
                      >
                        {label}{" "}
                        {status
                          ? formatEnemyStatusResistance(status, value)
                          : formatEnemyNumber(value)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {ar && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background/30">
                <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr] gap-2 border-b border-border/60 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Damage</span>
                  <span className="text-right">Base</span>
                  <span className="text-right">Buffs</span>
                  <span className="text-right">Final</span>
                </div>
                <div className="divide-y divide-border/60 text-xs">
                  {arRows.map((row) => (
                    <div
                      key={row.dt}
                      className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr] gap-2 px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{DAMAGE_LABELS[row.dt]}</span>
                      <span className="text-right text-muted-foreground">
                        {row.baseAR} + {row.scaledAR}
                      </span>
                      <span className="text-right">
                        {row.bonus > 0 ? (
                          <span className="rounded-full border border-gold/40 bg-[color:var(--gold)]/10 px-2 py-0.5 text-[11px] text-gold">
                            {formatSignedAmount(row.bonus)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">+0</span>
                        )}
                      </span>
                      <span className="text-right font-medium text-gold">
                        {row.baseTotal}
                        {row.bonus > 0 ? ` → ${row.buffedTotal}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {successiveChain && (
            <div className="mt-3 rounded-md border border-gold/40 bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                4-hit chain
              </p>
              <p className="text-sm font-medium text-gold-glow">
                {successiveChain.hits.join(" -> ")}
              </p>
              <p className="text-[11px] text-muted-foreground">Physical only</p>
            </div>
          )}
        </Panel>



      </div>

      <div className="mt-9 rounded-xl border border-gold bg-panel panel-glow p-6 sm:p-7">
        <h2 className="text-[1.55rem] sm:text-2xl font-display text-gold-glow mb-5">
          Damage Output vs {selectedEnemy ? selectedEnemy.name : "Target"}
        </h2>
        <div className="mb-4 rounded-lg border border-border/60 bg-background/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Weapon status</p>
            {variant?.critical != null && (
              <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
                Critical {variant.critical}
              </span>
            )}
          </div>
          {selectedStatusEntries.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedStatusEntries.map((status) => (
                <span
                  key={`mv-${status.key}`}
                  className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {status.label} {status.value}
                  {selectedEnemy
                    ? formatStatusProcSuffix(
                        status.key,
                        status.rawValue,
                        selectedEnemy.resistances[STATUS_RESISTANCE_KEYS[status.key]],
                      )
                    : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No status buildup</p>
          )}
        </div>
        {results.length === 0 && (
          <p className="text-muted-foreground">No motion-value data for this weapon.</p>
        )}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
          {results.map((r) => (
            <div
              key={r.attackKey}
              className="rounded-lg border border-gold/15 bg-background/25 px-3 py-2.5"
            >
              <div className="flex justify-between items-baseline">
                <span className="text-sm">{formatAttackLabel(r.attackKey)}</span>
                <span className="text-xs text-muted-foreground">
                  MV{" "}
                  {r.baseMv === r.mv
                    ? r.mv.toFixed(1)
                    : `${r.baseMv.toFixed(1)} → ${r.mv.toFixed(1)}`}
                </span>
              </div>
              <div className="text-2xl font-display text-gold-glow">
                {Math.round(r.final.total)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                AR /{" "}
                {selectedEnemy?.category === "boss" ? "boss" : "enemy"}{" "}
                {Math.round(r.final.total)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DAMAGE_ORDER.filter((dt) => (r.final.perType[dt] ?? 0) > 0).map((dt) => (
                  <span
                    key={dt}
                    className="rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {DAMAGE_LABELS[dt]} {Math.round(r.final.perType[dt])}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                After motion value, enemy defense, damage negation, and cycle modifiers
              </p>
            </div>
          ))}
        </div>
        {mvKeys.length === 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Motion-value data is keyed per weapon name; if results are empty, the source data has no
            entry for this weapon.
          </p>
        )}

        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Riposte</p>
              <p className="text-sm text-muted-foreground">
                Calculated from the weapon&apos;s critical motion values.
              </p>
            </div>
          </div>
          {riposteResults.length === 0 ? (
            <p className="text-xs text-muted-foreground">No riposte data for this weapon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {riposteResults.map((r) => (
                <div
                  key={r.attackKey}
                  className="rounded border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm">{formatAttackLabel(r.attackKey)}</span>
                    <span className="text-xs text-muted-foreground">MV {r.mv.toFixed(1)}</span>
                  </div>
                  <div className="text-2xl font-display text-gold-glow">
                    {Math.round(r.final.total)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DAMAGE_ORDER.filter((dt) => (r.final.perType[dt] ?? 0) > 0).map((dt) => (
                      <span
                        key={dt}
                        className="rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {DAMAGE_LABELS[dt]} {Math.round(r.final.perType[dt])}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-gold/40 bg-background/25 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total equip load
              </p>
              <p className="text-3xl font-display text-gold-glow">
                {formatEquipLoadWeight(equipUsed)} / {formatEquipLoadWeight(cap)}
              </p>
            </div>
            <span className="rounded-full border border-gold/40 bg-[color:var(--gold)]/10 px-3 py-1 text-sm text-gold">
              {tier}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1">
              Armor {formatEquipLoadWeight(armorWeight)}
            </span>
            <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1">
              Weapon {formatEquipLoadWeight(selectedWeaponWeight)}
            </span>
            <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1">
              Talismans {formatEquipLoadWeight(talismanWeight)}
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-border/60 bg-background/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Total armor damage negation
            </p>
            <div className="flex flex-wrap gap-2">
              {ARMOR_NEGATION_ORDER.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {key} {formatArmorNumber(armorNegationTotals[key] ?? 0)}%
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            {ARMOR_SLOT_ORDER.map((slot, i) => {
              const piece = selectedArmorPieces[i];
              const options = [
                { value: "", label: "— None —" },
                ...armorPiecesByType[slot].map((p) => ({
                  value: p.id,
                  label: formatArmorOption(p),
                })),
              ];

              return (
                <div key={slot} className="rounded-lg border border-border/70 bg-background/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{ARMOR_SLOT_LABELS[slot]}</Label>
                    {piece?.dlc && (
                      <span className="rounded-full border border-gold/40 bg-[color:var(--gold)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                        DLC
                      </span>
                    )}
                  </div>
                  <Select
                    value={armorSel[i]}
                    onChange={(v) => setArmorSel((cur) => cur.map((x, j) => (i === j ? v : x)))}
                    options={options}
                  />
                  {piece ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{armorPieceLabel(piece)}</p>
                        <span className="rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {piece.weight.toFixed(1)}wt
                        </span>
                      </div>
                      {piece.specialEffect?.trim() && (
                        <div className="rounded-md border border-gold/30 bg-[color:var(--gold)]/8 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Special effect
                          </p>
                          <p className="text-xs text-gold mt-1">{piece.specialEffect}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          Damage negation
                        </p>
                        <div className="grid grid-cols-4 gap-2 text-[10px]">
                          {ARMOR_NEGATION_ORDER.map((key) => (
                            <div
                              key={key}
                              className="rounded border border-border/60 bg-background/40 px-2 py-1"
                            >
                              <p className="text-muted-foreground">{key}</p>
                              <p className="font-medium text-gold">
                                {formatArmorNumber(piece.damageNegation[key] ?? 0)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          Resistance
                        </p>
                        <div className="grid grid-cols-5 gap-2 text-[10px]">
                          {ARMOR_RESISTANCE_ORDER.map((key) => (
                            <div
                              key={key}
                              className="rounded border border-border/60 bg-background/40 px-2 py-1"
                            >
                              <p className="text-muted-foreground">{key}</p>
                              <p className="font-medium text-gold">
                                {formatArmorNumber(piece.resistance[key] ?? 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No piece equipped in this slot.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Build name"
            className="flex-1 min-w-[200px]"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded border border-gold text-gold hover:bg-[color:var(--gold)] hover:text-black transition"
          >
            {saving ? "Saving…" : "Save Build"}
          </button>
          <button
            onClick={askAi}
            disabled={ratingLoading}
            className="px-5 py-2 rounded bg-[color:var(--gold)] text-black font-medium hover:brightness-110 transition"
          >
            {ratingLoading ? "Rating…" : "Rate My Build (AI)"}
          </button>
        </div>
        {rating && (
          <div className="mt-6 rounded-md border border-gold/40 bg-background/60 p-4 text-sm whitespace-pre-wrap">
            {rating}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  wide,
  className,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gold bg-panel panel-glow p-5 ${wide ? "lg:col-span-3" : ""} ${className ?? ""}`}
    >
      <h3 className="font-display text-[1.05rem] text-gold-glow mb-4 uppercase tracking-wider">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1">{children}</p>
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded bg-input border border-border text-sm focus:border-gold focus:outline-none"
    >
      {options.map((o) => {
        const option = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={option.value} value={option.value}>
            {option.label || "— None —"}
          </option>
        );
      })}
    </select>
  );
}
function Toggle({ label, on, setOn }: { label: string; on: boolean; setOn: (b: boolean) => void }) {
  return (
    <button
      onClick={() => setOn(!on)}
      className={`w-full text-left text-sm px-3 py-2 rounded border transition mt-2 ${on ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-gold-glow" : "border-border hover:border-gold/60"}`}
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}
function SmallToggle({
  label,
  on,
  setOn,
}: {
  label: string;
  on: boolean;
  setOn: (b: boolean) => void;
}) {
  return (
    <button
      onClick={() => setOn(!on)}
      className={`w-full text-left text-xs px-2 py-1 rounded border transition ${on ? "border-gold/60 bg-[color:var(--gold)]/10 text-gold" : "border-border/60 hover:border-gold/40 text-muted-foreground"}`}
    >
      {on ? "✓ " : "○ "}
      {label}
    </button>
  );
}
