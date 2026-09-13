import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "./schema.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";

export const validateSavedAdventureRpgEconomy = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const economy = save.rpgEconomy;
  if (!economy) return [];
  const manifest = bundle.rpg?.economy;
  const issues: SaveGameCompatibilityIssue[] = [];
  if (!manifest) {
    addSaveGameIssue(
      issues,
      "rpg-economy-state-without-runtime-manifest",
      "rpgEconomy",
      "Save contains RPG economy state but the runtime bundle has no RPG economy manifest.",
    );
    return issues;
  }

  const currencies = new Set(manifest.currencies.map((entry) => entry.id));
  for (const currencyId of Object.keys(economy.balances)) {
    if (!currencies.has(currencyId)) {
      addSaveGameIssue(
        issues,
        "rpg-economy-currency-missing",
        `rpgEconomy.balances.${currencyId}`,
        `Saved RPG currency '${currencyId}' no longer exists.`,
      );
    }
  }

  const slots = new Set(manifest.equipmentSlots.map((entry) => entry.id));
  const equipmentItems = new Set(manifest.equipment.map((entry) => entry.itemId as string));
  for (const [slotId, itemId] of Object.entries(economy.equippedBySlot)) {
    if (!slots.has(slotId)) {
      addSaveGameIssue(
        issues,
        "rpg-economy-slot-missing",
        `rpgEconomy.equippedBySlot.${slotId}`,
        `Saved RPG equipment slot '${slotId}' no longer exists.`,
      );
    }
    if (itemId && !equipmentItems.has(itemId)) {
      addSaveGameIssue(
        issues,
        "rpg-economy-item-missing",
        `rpgEconomy.equippedBySlot.${slotId}`,
        `Saved equipped item '${itemId}' no longer exists in the RPG equipment manifest.`,
      );
    }
  }

  const stockKeys = new Set(
    manifest.shops.flatMap((shop) =>
      shop.stock.map((stock) => `${shop.id}\u0000${stock.itemId}`),
    ),
  );
  for (const key of Object.keys(economy.stockByShopItem)) {
    if (!stockKeys.has(key)) {
      addSaveGameIssue(
        issues,
        "rpg-economy-stock-missing",
        `rpgEconomy.stockByShopItem.${key}`,
        `Saved RPG shop-stock entry '${key}' no longer exists.`,
      );
    }
  }

  return issues;
};
