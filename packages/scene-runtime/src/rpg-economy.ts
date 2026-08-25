import { evaluateCondition } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeAdventureRpgEconomyManifest } from "@evavo/adventure-runtime-bundle/rpg-economy";
import type { InteractiveRuntimeWorldState } from "./commands.js";

export interface AdventureRpgEconomyState {
  readonly balances: Readonly<Record<string, number>>;
  readonly equippedBySlot: Readonly<Record<string, Id<"item"> | null>>;
  readonly stockByShopItem: Readonly<Record<string, number | null>>;
}

export type AdventureRpgEconomyFailureReason =
  | "shop-unavailable"
  | "item-unavailable"
  | "out-of-stock"
  | "insufficient-funds"
  | "item-not-owned"
  | "item-not-equipment"
  | "class-restricted"
  | "already-equipped";

export type AdventureRpgEconomyResult =
  | {
      readonly kind: "success";
      readonly world: InteractiveRuntimeWorldState;
      readonly economy: AdventureRpgEconomyState;
    }
  | {
      readonly kind: "failure";
      readonly reason: AdventureRpgEconomyFailureReason;
      readonly world: InteractiveRuntimeWorldState;
      readonly economy: AdventureRpgEconomyState;
    };

const stockKey = (shopId: string, itemId: Id<"item">): string => `${shopId}\u0000${itemId}`;

export const createAdventureRpgEconomyState = (
  manifest: RuntimeAdventureRpgEconomyManifest,
): AdventureRpgEconomyState => ({
  balances: Object.fromEntries(manifest.currencies.map((currency) => [currency.id, currency.startingBalance])),
  equippedBySlot: Object.fromEntries(manifest.equipmentSlots.map((slot) => [slot.id, null])),
  stockByShopItem: Object.fromEntries(
    manifest.shops.flatMap((shop) =>
      shop.stock.map((stock) => [stockKey(shop.id, stock.itemId), stock.quantity] as const),
    ),
  ),
});

const addInventoryItem = (
  world: InteractiveRuntimeWorldState,
  itemId: Id<"item">,
): InteractiveRuntimeWorldState =>
  world.story.inventory.includes(itemId)
    ? world
    : {
        ...world,
        story: {
          ...world.story,
          inventory: [...world.story.inventory, itemId].sort((left, right) => left.localeCompare(right)),
        },
      };

const removeInventoryItem = (
  world: InteractiveRuntimeWorldState,
  itemId: Id<"item">,
): InteractiveRuntimeWorldState => ({
  ...world,
  story: {
    ...world.story,
    inventory: world.story.inventory.filter((candidate) => candidate !== itemId),
  },
});

const shopFor = (manifest: RuntimeAdventureRpgEconomyManifest, shopId: string) =>
  manifest.shops.find((shop) => shop.id === shopId) ?? null;

const stockFor = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  shopId: string,
  itemId: Id<"item">,
) => shopFor(manifest, shopId)?.stock.find((stock) => stock.itemId === itemId) ?? null;

const shopAvailable = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  world: InteractiveRuntimeWorldState,
  shopId: string,
): boolean => {
  const shop = shopFor(manifest, shopId);
  return Boolean(shop && (!shop.when || evaluateCondition(shop.when, world.story)));
};

const stockAvailable = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  world: InteractiveRuntimeWorldState,
  shopId: string,
  itemId: Id<"item">,
): boolean => {
  const stock = stockFor(manifest, shopId, itemId);
  return Boolean(stock && (!stock.when || evaluateCondition(stock.when, world.story)));
};

export const buyAdventureRpgItem = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  world: InteractiveRuntimeWorldState,
  economy: AdventureRpgEconomyState,
  shopId: string,
  itemId: Id<"item">,
): AdventureRpgEconomyResult => {
  if (!shopAvailable(manifest, world, shopId)) return { kind: "failure", reason: "shop-unavailable", world, economy };
  const stock = stockFor(manifest, shopId, itemId);
  if (!stock || !stockAvailable(manifest, world, shopId, itemId)) {
    return { kind: "failure", reason: "item-unavailable", world, economy };
  }
  const remaining = economy.stockByShopItem[stockKey(shopId, itemId)];
  if (remaining === 0) return { kind: "failure", reason: "out-of-stock", world, economy };
  const balance = economy.balances[stock.currencyId] ?? 0;
  if (balance < stock.buyPrice) return { kind: "failure", reason: "insufficient-funds", world, economy };
  return {
    kind: "success",
    world: addInventoryItem(world, itemId),
    economy: {
      ...economy,
      balances: { ...economy.balances, [stock.currencyId]: balance - stock.buyPrice },
      stockByShopItem: {
        ...economy.stockByShopItem,
        [stockKey(shopId, itemId)]: remaining === null ? null : Math.max(0, remaining - 1),
      },
    },
  };
};

export const sellAdventureRpgItem = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  world: InteractiveRuntimeWorldState,
  economy: AdventureRpgEconomyState,
  shopId: string,
  itemId: Id<"item">,
): AdventureRpgEconomyResult => {
  if (!shopAvailable(manifest, world, shopId)) return { kind: "failure", reason: "shop-unavailable", world, economy };
  const stock = stockFor(manifest, shopId, itemId);
  if (!stock || !stockAvailable(manifest, world, shopId, itemId)) {
    return { kind: "failure", reason: "item-unavailable", world, economy };
  }
  if (!world.story.inventory.includes(itemId)) return { kind: "failure", reason: "item-not-owned", world, economy };
  if (Object.values(economy.equippedBySlot).includes(itemId)) {
    return { kind: "failure", reason: "already-equipped", world, economy };
  }
  const balance = economy.balances[stock.currencyId] ?? 0;
  const currentStock = economy.stockByShopItem[stockKey(shopId, itemId)];
  return {
    kind: "success",
    world: removeInventoryItem(world, itemId),
    economy: {
      ...economy,
      balances: { ...economy.balances, [stock.currencyId]: balance + stock.sellPrice },
      stockByShopItem: {
        ...economy.stockByShopItem,
        [stockKey(shopId, itemId)]: currentStock === null ? null : (currentStock ?? 0) + 1,
      },
    },
  };
};

export const equipAdventureRpgItem = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  world: InteractiveRuntimeWorldState,
  economy: AdventureRpgEconomyState,
  itemId: Id<"item">,
  classTags: readonly string[] = [],
): AdventureRpgEconomyResult => {
  if (!world.story.inventory.includes(itemId)) return { kind: "failure", reason: "item-not-owned", world, economy };
  const equipment = manifest.equipment.find((entry) => entry.itemId === itemId);
  if (!equipment) return { kind: "failure", reason: "item-not-equipment", world, economy };
  if (equipment.classTagsAny.length > 0 && !equipment.classTagsAny.some((tag) => classTags.includes(tag))) {
    return { kind: "failure", reason: "class-restricted", world, economy };
  }
  if (economy.equippedBySlot[equipment.slotId] === itemId) {
    return { kind: "failure", reason: "already-equipped", world, economy };
  }
  return {
    kind: "success",
    world,
    economy: {
      ...economy,
      equippedBySlot: { ...economy.equippedBySlot, [equipment.slotId]: itemId },
    },
  };
};

export const unequipAdventureRpgSlot = (
  economy: AdventureRpgEconomyState,
  slotId: string,
): AdventureRpgEconomyState => ({
  ...economy,
  equippedBySlot: { ...economy.equippedBySlot, [slotId]: null },
});

export const adventureRpgEquipmentModifiers = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  economy: AdventureRpgEconomyState,
): Readonly<Record<string, number>> => {
  const totals: Record<string, number> = {};
  for (const itemId of Object.values(economy.equippedBySlot)) {
    if (!itemId) continue;
    const equipment = manifest.equipment.find((entry) => entry.itemId === itemId);
    if (!equipment) continue;
    for (const [id, value] of Object.entries(equipment.modifiers)) {
      totals[id] = (totals[id] ?? 0) + value;
    }
  }
  return totals;
};
