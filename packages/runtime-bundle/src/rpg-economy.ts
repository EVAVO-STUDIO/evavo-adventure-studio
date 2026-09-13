import { conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const economyIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const runtimeAdventureRpgCurrencySchema = z.object({
  id: economyIdSchema,
  label: z.string().min(1),
  startingBalance: z.number().int().nonnegative().default(0),
}).strict();

export const runtimeAdventureRpgEquipmentSlotSchema = z.object({
  id: economyIdSchema,
  label: z.string().min(1),
}).strict();

export const runtimeAdventureRpgEquipmentSchema = z.object({
  id: economyIdSchema,
  itemId: idSchema("item"),
  slotId: economyIdSchema,
  classTagsAny: z.array(z.string().min(1)).default([]),
  modifiers: z.record(economyIdSchema, z.number().finite()).default({}),
}).strict();

export const runtimeAdventureRpgShopStockSchema = z.object({
  itemId: idSchema("item"),
  currencyId: economyIdSchema,
  buyPrice: z.number().int().nonnegative(),
  sellPrice: z.number().int().nonnegative(),
  quantity: z.number().int().nonnegative().nullable().default(null),
  when: conditionSchema.optional(),
}).strict();

export const runtimeAdventureRpgShopSchema = z.object({
  id: economyIdSchema,
  label: z.string().min(1),
  when: conditionSchema.optional(),
  stock: z.array(runtimeAdventureRpgShopStockSchema),
}).strict();

export const runtimeAdventureRpgEconomyManifestSchema = z.object({
  manifestVersion: z.literal(1),
  projectId: idSchema("project"),
  currencies: z.array(runtimeAdventureRpgCurrencySchema).min(1),
  equipmentSlots: z.array(runtimeAdventureRpgEquipmentSlotSchema),
  equipment: z.array(runtimeAdventureRpgEquipmentSchema),
  shops: z.array(runtimeAdventureRpgShopSchema),
}).strict();
export type RuntimeAdventureRpgEconomyManifest = z.infer<typeof runtimeAdventureRpgEconomyManifestSchema>;

export type RuntimeAdventureRpgEconomyIssueCode =
  | "duplicate-currency"
  | "duplicate-slot"
  | "duplicate-equipment"
  | "duplicate-shop"
  | "duplicate-shop-item"
  | "unknown-item"
  | "unknown-slot"
  | "unknown-currency"
  | "sell-price-exceeds-buy";

export interface RuntimeAdventureRpgEconomyIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRpgEconomyIssueCode;
  readonly path: string;
  readonly message: string;
}

const duplicateIssues = (
  values: readonly { readonly id: string }[],
  code: RuntimeAdventureRpgEconomyIssueCode,
  path: string,
  label: string,
): RuntimeAdventureRpgEconomyIssue[] => {
  const seen = new Set<string>();
  const issues: RuntimeAdventureRpgEconomyIssue[] = [];
  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      issues.push({ severity: "error", code, path: `${path}[${index}].id`, message: `${label} '${value.id}' is duplicated.` });
    }
    seen.add(value.id);
  });
  return issues;
};

export const validateRuntimeAdventureRpgEconomy = (
  manifest: RuntimeAdventureRpgEconomyManifest,
  knownItemIds: ReadonlySet<string>,
): readonly RuntimeAdventureRpgEconomyIssue[] => {
  const issues: RuntimeAdventureRpgEconomyIssue[] = [
    ...duplicateIssues(manifest.currencies, "duplicate-currency", "currencies", "Currency"),
    ...duplicateIssues(manifest.equipmentSlots, "duplicate-slot", "equipmentSlots", "Equipment slot"),
    ...duplicateIssues(manifest.equipment, "duplicate-equipment", "equipment", "Equipment"),
    ...duplicateIssues(manifest.shops, "duplicate-shop", "shops", "Shop"),
  ];
  const currencies = new Set(manifest.currencies.map((entry) => entry.id));
  const slots = new Set(manifest.equipmentSlots.map((entry) => entry.id));
  manifest.equipment.forEach((entry, index) => {
    if (!knownItemIds.has(entry.itemId)) {
      issues.push({ severity: "error", code: "unknown-item", path: `equipment[${index}].itemId`, message: `Equipment '${entry.id}' references unknown item '${entry.itemId}'.` });
    }
    if (!slots.has(entry.slotId)) {
      issues.push({ severity: "error", code: "unknown-slot", path: `equipment[${index}].slotId`, message: `Equipment '${entry.id}' references unknown slot '${entry.slotId}'.` });
    }
  });
  manifest.shops.forEach((shop, shopIndex) => {
    const seenItems = new Set<string>();
    shop.stock.forEach((stock, stockIndex) => {
      const path = `shops[${shopIndex}].stock[${stockIndex}]`;
      if (seenItems.has(stock.itemId)) {
        issues.push({ severity: "error", code: "duplicate-shop-item", path: `${path}.itemId`, message: `Shop '${shop.id}' lists item '${stock.itemId}' more than once.` });
      }
      seenItems.add(stock.itemId);
      if (!knownItemIds.has(stock.itemId)) {
        issues.push({ severity: "error", code: "unknown-item", path: `${path}.itemId`, message: `Shop '${shop.id}' references unknown item '${stock.itemId}'.` });
      }
      if (!currencies.has(stock.currencyId)) {
        issues.push({ severity: "error", code: "unknown-currency", path: `${path}.currencyId`, message: `Shop '${shop.id}' references unknown currency '${stock.currencyId}'.` });
      }
      if (stock.sellPrice > stock.buyPrice) {
        issues.push({ severity: "error", code: "sell-price-exceeds-buy", path, message: `Shop '${shop.id}' sell price for '${stock.itemId}' exceeds its buy price.` });
      }
    });
  });
  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeAdventureRpgEconomyValidationError extends Error {
  readonly issues: readonly RuntimeAdventureRpgEconomyIssue[];

  constructor(issues: readonly RuntimeAdventureRpgEconomyIssue[]) {
    super(`Runtime RPG economy is invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeAdventureRpgEconomyValidationError";
    this.issues = issues;
  }
}
