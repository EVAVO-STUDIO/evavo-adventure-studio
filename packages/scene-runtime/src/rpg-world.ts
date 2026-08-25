import type {
  RuntimeAdventureRpgWorldManifest,
} from "@evavo/adventure-runtime-bundle";
import {
  adventureRpgScheduleActive,
  type AdventureRpgManifest,
  type AdventureRpgState,
} from "./rpg.js";

export interface AdventureRpgWorldState {
  readonly balances: Readonly<Record<string, number>>;
  readonly ownedEquipmentIds: readonly string[];
  readonly equippedBySlot: Readonly<Record<string, string>>;
}

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const currencyDefinition = (manifest: RuntimeAdventureRpgWorldManifest, currencyId: string) => {
  const currency = manifest.currencies.find((entry) => entry.id === currencyId);
  if (!currency) throw new Error(`Unknown RPG currency '${currencyId}'.`);
  return currency;
};

const equipmentDefinition = (manifest: RuntimeAdventureRpgWorldManifest, equipmentId: string) => {
  const equipment = manifest.equipment.find((entry) => entry.id === equipmentId);
  if (!equipment) throw new Error(`Unknown RPG equipment '${equipmentId}'.`);
  return equipment;
};

const merchantDefinition = (manifest: RuntimeAdventureRpgWorldManifest, merchantId: string) => {
  const merchant = manifest.merchants.find((entry) => entry.id === merchantId);
  if (!merchant) throw new Error(`Unknown RPG merchant '${merchantId}'.`);
  return merchant;
};

const clampBalance = (
  manifest: RuntimeAdventureRpgWorldManifest,
  currencyId: string,
  value: number,
): number => {
  const currency = currencyDefinition(manifest, currencyId);
  return Math.max(0, Math.min(currency.maximumBalance ?? Number.MAX_SAFE_INTEGER, Math.trunc(value)));
};

export const createAdventureRpgWorldState = (
  manifest: RuntimeAdventureRpgWorldManifest,
): AdventureRpgWorldState => ({
  balances: Object.fromEntries(
    manifest.currencies.map((currency) => [currency.id, currency.startingBalance]),
  ),
  ownedEquipmentIds: uniqueSorted(manifest.startingEquipmentIds),
  equippedBySlot: { ...manifest.startingEquippedBySlot },
});

export const adventureRpgWorldBalance = (
  state: AdventureRpgWorldState,
  currencyId: string,
): number => state.balances[currencyId] ?? 0;

export const adjustAdventureRpgWorldBalance = (
  manifest: RuntimeAdventureRpgWorldManifest,
  state: AdventureRpgWorldState,
  currencyId: string,
  delta: number,
): AdventureRpgWorldState => {
  if (!Number.isSafeInteger(delta)) throw new RangeError("RPG currency adjustment must be a safe integer.");
  currencyDefinition(manifest, currencyId);
  return {
    ...state,
    balances: {
      ...state.balances,
      [currencyId]: clampBalance(manifest, currencyId, adventureRpgWorldBalance(state, currencyId) + delta),
    },
  };
};

const equipmentAllowedForClass = (
  manifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  equipmentId: string,
): boolean => {
  const equipment = equipmentDefinition(manifest, equipmentId);
  return !equipment.allowedClassIds || equipment.allowedClassIds.includes(rpgState.classId);
};

const merchantBuyPrice = (
  manifest: RuntimeAdventureRpgWorldManifest,
  merchantId: string,
  equipmentId: string,
): number => {
  const merchant = merchantDefinition(manifest, merchantId);
  const equipment = equipmentDefinition(manifest, equipmentId);
  return Math.max(0, Math.floor((equipment.price.amount * merchant.buyPricePercent) / 100));
};

const merchantSellPrice = (
  manifest: RuntimeAdventureRpgWorldManifest,
  merchantId: string,
  equipmentId: string,
): number => {
  const merchant = merchantDefinition(manifest, merchantId);
  const equipment = equipmentDefinition(manifest, equipmentId);
  return Math.max(0, Math.floor((equipment.price.amount * merchant.sellPricePercent) / 100));
};

export type AdventureRpgWorldTransactionRejection =
  | "merchant-does-not-stock"
  | "class-restricted"
  | "already-owned"
  | "not-owned"
  | "insufficient-funds";

export type AdventureRpgWorldPurchaseResult =
  | {
      readonly kind: "purchased";
      readonly state: AdventureRpgWorldState;
      readonly equipmentId: string;
      readonly itemId: string;
      readonly currencyId: string;
      readonly price: number;
    }
  | {
      readonly kind: "rejected";
      readonly state: AdventureRpgWorldState;
      readonly reason: AdventureRpgWorldTransactionRejection;
    };

export const purchaseAdventureRpgEquipment = (
  manifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  state: AdventureRpgWorldState,
  merchantId: string,
  equipmentId: string,
): AdventureRpgWorldPurchaseResult => {
  const merchant = merchantDefinition(manifest, merchantId);
  const equipment = equipmentDefinition(manifest, equipmentId);
  if (!merchant.equipmentIds.includes(equipmentId)) return { kind: "rejected", state, reason: "merchant-does-not-stock" };
  if (!equipmentAllowedForClass(manifest, rpgState, equipmentId)) return { kind: "rejected", state, reason: "class-restricted" };
  if (state.ownedEquipmentIds.includes(equipmentId)) return { kind: "rejected", state, reason: "already-owned" };
  const price = merchantBuyPrice(manifest, merchantId, equipmentId);
  const balance = adventureRpgWorldBalance(state, equipment.price.currencyId);
  if (balance < price) return { kind: "rejected", state, reason: "insufficient-funds" };
  return {
    kind: "purchased",
    state: {
      ...adjustAdventureRpgWorldBalance(manifest, state, equipment.price.currencyId, -price),
      ownedEquipmentIds: uniqueSorted([...state.ownedEquipmentIds, equipmentId]),
    },
    equipmentId,
    itemId: equipment.itemId,
    currencyId: equipment.price.currencyId,
    price,
  };
};

export type AdventureRpgWorldSaleResult =
  | {
      readonly kind: "sold";
      readonly state: AdventureRpgWorldState;
      readonly equipmentId: string;
      readonly itemId: string;
      readonly currencyId: string;
      readonly price: number;
    }
  | {
      readonly kind: "rejected";
      readonly state: AdventureRpgWorldState;
      readonly reason: AdventureRpgWorldTransactionRejection;
    };

export const sellAdventureRpgEquipment = (
  manifest: RuntimeAdventureRpgWorldManifest,
  state: AdventureRpgWorldState,
  merchantId: string,
  equipmentId: string,
): AdventureRpgWorldSaleResult => {
  const merchant = merchantDefinition(manifest, merchantId);
  const equipment = equipmentDefinition(manifest, equipmentId);
  if (!merchant.equipmentIds.includes(equipmentId)) return { kind: "rejected", state, reason: "merchant-does-not-stock" };
  if (!state.ownedEquipmentIds.includes(equipmentId)) return { kind: "rejected", state, reason: "not-owned" };
  const price = merchantSellPrice(manifest, merchantId, equipmentId);
  const equippedBySlot = Object.fromEntries(
    Object.entries(state.equippedBySlot).filter(([, candidate]) => candidate !== equipmentId),
  );
  return {
    kind: "sold",
    state: {
      ...adjustAdventureRpgWorldBalance(manifest, state, equipment.price.currencyId, price),
      ownedEquipmentIds: state.ownedEquipmentIds.filter((candidate) => candidate !== equipmentId),
      equippedBySlot,
    },
    equipmentId,
    itemId: equipment.itemId,
    currencyId: equipment.price.currencyId,
    price,
  };
};

export type AdventureRpgWorldEquipResult =
  | { readonly kind: "equipped"; readonly state: AdventureRpgWorldState; readonly equipmentId: string; readonly slotId: string }
  | { readonly kind: "rejected"; readonly state: AdventureRpgWorldState; readonly reason: "not-owned" | "class-restricted" };

export const equipAdventureRpgEquipment = (
  manifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  state: AdventureRpgWorldState,
  equipmentId: string,
): AdventureRpgWorldEquipResult => {
  const equipment = equipmentDefinition(manifest, equipmentId);
  if (!state.ownedEquipmentIds.includes(equipmentId)) return { kind: "rejected", state, reason: "not-owned" };
  if (!equipmentAllowedForClass(manifest, rpgState, equipmentId)) return { kind: "rejected", state, reason: "class-restricted" };
  return {
    kind: "equipped",
    state: {
      ...state,
      equippedBySlot: { ...state.equippedBySlot, [equipment.slotId]: equipmentId },
    },
    equipmentId,
    slotId: equipment.slotId,
  };
};

export const unequipAdventureRpgSlot = (
  state: AdventureRpgWorldState,
  slotId: string,
): AdventureRpgWorldState => {
  if (!(slotId in state.equippedBySlot)) return state;
  const next = { ...state.equippedBySlot };
  delete next[slotId];
  return { ...state, equippedBySlot: next };
};

const equippedDefinitions = (
  manifest: RuntimeAdventureRpgWorldManifest,
  state: AdventureRpgWorldState,
) => Object.values(state.equippedBySlot).map((equipmentId) => equipmentDefinition(manifest, equipmentId));

export const adventureRpgEffectiveStat = (
  manifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  state: AdventureRpgWorldState,
  statId: string,
): number =>
  (rpgState.stats[statId] ?? 0) +
  equippedDefinitions(manifest, state).reduce((total, equipment) => total + (equipment.statModifiers?.[statId] ?? 0), 0);

export const adventureRpgEffectiveSkill = (
  manifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  state: AdventureRpgWorldState,
  skillId: string,
): number =>
  (rpgState.skills[skillId] ?? 0) +
  equippedDefinitions(manifest, state).reduce((total, equipment) => total + (equipment.skillModifiers?.[skillId] ?? 0), 0);

export interface AdventureRpgNpcScheduleLocation {
  readonly actorId: string;
  readonly scheduleEntryId: string;
  readonly sceneId: string;
  readonly entranceId: string;
  readonly priority: number;
}

export const resolveAdventureRpgNpcSchedule = (
  rpgManifest: AdventureRpgManifest,
  worldManifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
  actorId: string,
): AdventureRpgNpcScheduleLocation | null => {
  const schedule = worldManifest.npcSchedules.find((entry) => entry.actorId === actorId);
  if (!schedule) return null;
  const active = schedule.windows
    .filter((window) =>
      adventureRpgScheduleActive(rpgManifest, rpgState, {
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        ...(window.days ? { days: window.days } : {}),
      }),
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      return left.id.localeCompare(right.id);
    })[0];
  return active
    ? {
        actorId,
        scheduleEntryId: active.id,
        sceneId: active.sceneId,
        entranceId: active.entranceId,
        priority: active.priority,
      }
    : null;
};

export const resolveAllAdventureRpgNpcSchedules = (
  rpgManifest: AdventureRpgManifest,
  worldManifest: RuntimeAdventureRpgWorldManifest,
  rpgState: AdventureRpgState,
): readonly AdventureRpgNpcScheduleLocation[] =>
  worldManifest.npcSchedules
    .map((schedule) => resolveAdventureRpgNpcSchedule(rpgManifest, worldManifest, rpgState, schedule.actorId))
    .filter((location): location is AdventureRpgNpcScheduleLocation => location !== null)
    .sort((left, right) => left.actorId.localeCompare(right.actorId));
