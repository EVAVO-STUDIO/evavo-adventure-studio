import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const currencyIdSchema = z.string().regex(/^currency\.[A-Za-z0-9._-]+$/u);
const equipmentSlotIdSchema = z.string().regex(/^equipment-slot\.[A-Za-z0-9._-]+$/u);
const equipmentIdSchema = z.string().regex(/^equipment\.[A-Za-z0-9._-]+$/u);
const merchantIdSchema = z.string().regex(/^merchant\.[A-Za-z0-9._-]+$/u);
const scheduleEntryIdSchema = z.string().regex(/^npc-schedule\.[A-Za-z0-9._-]+$/u);
const modifierMapSchema = z.record(z.string().min(1), z.number().finite());

const currencySchema = z
  .object({
    id: currencyIdSchema,
    label: z.string().min(1),
    startingBalance: z.number().int().nonnegative(),
    maximumBalance: z.number().int().positive().optional(),
  })
  .strict();

const equipmentSlotSchema = z
  .object({ id: equipmentSlotIdSchema, label: z.string().min(1) })
  .strict();

const equipmentSchema = z
  .object({
    id: equipmentIdSchema,
    label: z.string().min(1),
    itemId: idSchema("item"),
    slotId: equipmentSlotIdSchema,
    price: z
      .object({ currencyId: currencyIdSchema, amount: z.number().int().nonnegative() })
      .strict(),
    allowedClassIds: z.array(z.string().min(1)).optional(),
    statModifiers: modifierMapSchema.optional(),
    skillModifiers: modifierMapSchema.optional(),
    resourceMaximumModifiers: modifierMapSchema.optional(),
  })
  .strict();

const merchantSchema = z
  .object({
    id: merchantIdSchema,
    label: z.string().min(1),
    equipmentIds: z.array(equipmentIdSchema),
    buyPricePercent: z.number().int().min(1).max(1000).default(100),
    sellPricePercent: z.number().int().min(0).max(100).default(50),
  })
  .strict();

const scheduleWindowSchema = z
  .object({
    id: scheduleEntryIdSchema,
    startMinute: z.number().int().nonnegative(),
    endMinute: z.number().int().nonnegative(),
    days: z.array(z.number().int().positive()).optional(),
    sceneId: idSchema("scene"),
    entranceId: idSchema("entrance"),
    priority: z.number().int().default(0),
  })
  .strict();

const npcScheduleSchema = z
  .object({
    actorId: idSchema("actor"),
    windows: z.array(scheduleWindowSchema).min(1),
  })
  .strict();

export const runtimeAdventureRpgWorldManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    currencies: z.array(currencySchema),
    equipmentSlots: z.array(equipmentSlotSchema),
    equipment: z.array(equipmentSchema),
    merchants: z.array(merchantSchema),
    npcSchedules: z.array(npcScheduleSchema),
    startingEquipmentIds: z.array(equipmentIdSchema).default([]),
    startingEquippedBySlot: z.record(equipmentSlotIdSchema, equipmentIdSchema).default({}),
  })
  .strict();
export type RuntimeAdventureRpgWorldManifest = z.infer<typeof runtimeAdventureRpgWorldManifestSchema>;

export type RuntimeAdventureRpgWorldIssueCode =
  | "duplicate-id"
  | "unknown-item"
  | "unknown-slot"
  | "unknown-currency"
  | "unknown-class"
  | "unknown-stat"
  | "unknown-skill"
  | "unknown-resource"
  | "unknown-equipment"
  | "unknown-actor"
  | "unknown-scene"
  | "unknown-entrance"
  | "invalid-starting-equipment";

export interface RuntimeAdventureRpgWorldIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRpgWorldIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAdventureRpgWorldValidationContext {
  readonly itemIds: ReadonlySet<string>;
  readonly actorIds: ReadonlySet<string>;
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
  readonly classIds: ReadonlySet<string>;
  readonly statIds: ReadonlySet<string>;
  readonly skillIds: ReadonlySet<string>;
  readonly resourceIds: ReadonlySet<string>;
}

export const validateRuntimeAdventureRpgWorld = (
  manifest: RuntimeAdventureRpgWorldManifest,
  context: RuntimeAdventureRpgWorldValidationContext,
): readonly RuntimeAdventureRpgWorldIssue[] => {
  const issues: RuntimeAdventureRpgWorldIssue[] = [];
  const push = (code: RuntimeAdventureRpgWorldIssueCode, path: string, message: string): void => {
    issues.push({ severity: "error", code, path, message });
  };
  const duplicateCheck = (values: readonly { readonly id: string }[], path: string): Set<string> => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value.id)) push("duplicate-id", `${path}[${index}].id`, `Duplicate RPG-world ID '${value.id}'.`);
      seen.add(value.id);
    });
    return seen;
  };

  const currencies = duplicateCheck(manifest.currencies, "currencies");
  const slots = duplicateCheck(manifest.equipmentSlots, "equipmentSlots");
  const equipmentIds = duplicateCheck(manifest.equipment, "equipment");
  duplicateCheck(manifest.merchants, "merchants");

  manifest.equipment.forEach((equipment, index) => {
    const path = `equipment[${index}]`;
    if (!context.itemIds.has(equipment.itemId)) push("unknown-item", `${path}.itemId`, `Unknown equipment inventory item '${equipment.itemId}'.`);
    if (!slots.has(equipment.slotId)) push("unknown-slot", `${path}.slotId`, `Unknown equipment slot '${equipment.slotId}'.`);
    if (!currencies.has(equipment.price.currencyId)) push("unknown-currency", `${path}.price.currencyId`, `Unknown currency '${equipment.price.currencyId}'.`);
    for (const classId of equipment.allowedClassIds ?? []) {
      if (!context.classIds.has(classId)) push("unknown-class", `${path}.allowedClassIds`, `Unknown RPG class '${classId}'.`);
    }
    for (const statId of Object.keys(equipment.statModifiers ?? {})) {
      if (!context.statIds.has(statId)) push("unknown-stat", `${path}.statModifiers.${statId}`, `Unknown RPG stat '${statId}'.`);
    }
    for (const skillId of Object.keys(equipment.skillModifiers ?? {})) {
      if (!context.skillIds.has(skillId)) push("unknown-skill", `${path}.skillModifiers.${skillId}`, `Unknown RPG skill '${skillId}'.`);
    }
    for (const resourceId of Object.keys(equipment.resourceMaximumModifiers ?? {})) {
      if (!context.resourceIds.has(resourceId)) push("unknown-resource", `${path}.resourceMaximumModifiers.${resourceId}`, `Unknown RPG resource '${resourceId}'.`);
    }
  });

  manifest.merchants.forEach((merchant, index) => {
    merchant.equipmentIds.forEach((equipmentId) => {
      if (!equipmentIds.has(equipmentId)) push("unknown-equipment", `merchants[${index}].equipmentIds`, `Merchant '${merchant.id}' references unknown equipment '${equipmentId}'.`);
    });
  });

  manifest.npcSchedules.forEach((schedule, index) => {
    const path = `npcSchedules[${index}]`;
    if (!context.actorIds.has(schedule.actorId)) push("unknown-actor", `${path}.actorId`, `Unknown scheduled actor '${schedule.actorId}'.`);
    const windowIds = new Set<string>();
    schedule.windows.forEach((window, windowIndex) => {
      const windowPath = `${path}.windows[${windowIndex}]`;
      if (windowIds.has(window.id)) push("duplicate-id", `${windowPath}.id`, `Duplicate NPC schedule window '${window.id}'.`);
      windowIds.add(window.id);
      const entrances = context.entrancesByScene.get(window.sceneId);
      if (!entrances) push("unknown-scene", `${windowPath}.sceneId`, `Unknown NPC schedule scene '${window.sceneId}'.`);
      else if (!entrances.has(window.entranceId)) push("unknown-entrance", `${windowPath}.entranceId`, `Scene '${window.sceneId}' has no entrance '${window.entranceId}'.`);
    });
  });

  for (const equipmentId of manifest.startingEquipmentIds) {
    if (!equipmentIds.has(equipmentId)) push("invalid-starting-equipment", "startingEquipmentIds", `Unknown starting equipment '${equipmentId}'.`);
  }
  for (const [slotId, equipmentId] of Object.entries(manifest.startingEquippedBySlot)) {
    const equipment = manifest.equipment.find((entry) => entry.id === equipmentId);
    if (!slots.has(slotId) || !equipment || equipment.slotId !== slotId || !manifest.startingEquipmentIds.includes(equipmentId)) {
      push("invalid-starting-equipment", `startingEquippedBySlot.${slotId}`, `Starting equipped item '${equipmentId}' is not owned equipment for slot '${slotId}'.`);
    }
  }

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeAdventureRpgWorldValidationError extends Error {
  readonly issues: readonly RuntimeAdventureRpgWorldIssue[];

  constructor(issues: readonly RuntimeAdventureRpgWorldIssue[]) {
    super(`Runtime RPG world is invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeAdventureRpgWorldValidationError";
    this.issues = issues;
  }
}
