import { idSchema, rectangleSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

export const runtimeProtagonistDefinitionSchema = z
  .object({
    protagonistId: idSchema("actor"),
    startSceneId: idSchema("scene"),
    startEntranceId: idSchema("entrance"),
    startingInventory: z.array(idSchema("item")).default([]),
  })
  .strict();

export const runtimeProtagonistSwitcherSchema = z
  .object({
    region: rectangleSchema,
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    gap: z.number().int().min(0).max(16).default(1),
  })
  .strict();
export type RuntimeProtagonistSwitcher = z.infer<typeof runtimeProtagonistSwitcherSchema>;

export const runtimeMultiProtagonistManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    activeProtagonistId: idSchema("actor"),
    protagonists: z.array(runtimeProtagonistDefinitionSchema).min(2),
    switcher: runtimeProtagonistSwitcherSchema.optional(),
  })
  .strict();

export type RuntimeMultiProtagonistManifest = z.infer<typeof runtimeMultiProtagonistManifestSchema>;

export type RuntimeMultiProtagonistIssueCode =
  | "duplicate-protagonist"
  | "active-protagonist-missing"
  | "unknown-actor"
  | "unknown-scene"
  | "unknown-entrance"
  | "unknown-item"
  | "switcher-out-of-bounds"
  | "switcher-ui-missing";

export interface RuntimeMultiProtagonistIssue {
  readonly severity: "error";
  readonly code: RuntimeMultiProtagonistIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeMultiProtagonistValidationContext {
  readonly actorIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
  readonly nativeWidth?: number;
  readonly nativeHeight?: number;
  readonly hasUiSkin?: boolean;
  readonly hasBitmapFonts?: boolean;
}

export const validateRuntimeMultiProtagonist = (
  manifest: RuntimeMultiProtagonistManifest,
  context: RuntimeMultiProtagonistValidationContext,
): readonly RuntimeMultiProtagonistIssue[] => {
  const issues: RuntimeMultiProtagonistIssue[] = [];
  const protagonistIds = new Set<string>();
  manifest.protagonists.forEach((protagonist, index) => {
    if (protagonistIds.has(protagonist.protagonistId)) {
      issues.push({
        severity: "error",
        code: "duplicate-protagonist",
        path: `protagonists[${index}].protagonistId`,
        message: `Protagonist '${protagonist.protagonistId}' is duplicated.`,
      });
    }
    protagonistIds.add(protagonist.protagonistId);
    if (!context.actorIds.has(protagonist.protagonistId)) {
      issues.push({
        severity: "error",
        code: "unknown-actor",
        path: `protagonists[${index}].protagonistId`,
        message: `Protagonist actor '${protagonist.protagonistId}' does not exist.`,
      });
    }
    const entrances = context.entrancesByScene.get(protagonist.startSceneId);
    if (!entrances) {
      issues.push({
        severity: "error",
        code: "unknown-scene",
        path: `protagonists[${index}].startSceneId`,
        message: `Protagonist start scene '${protagonist.startSceneId}' does not exist.`,
      });
    } else if (!entrances.has(protagonist.startEntranceId)) {
      issues.push({
        severity: "error",
        code: "unknown-entrance",
        path: `protagonists[${index}].startEntranceId`,
        message: `Entrance '${protagonist.startEntranceId}' does not exist in scene '${protagonist.startSceneId}'.`,
      });
    }
    protagonist.startingInventory.forEach((itemId, itemIndex) => {
      if (!context.itemIds.has(itemId)) {
        issues.push({
          severity: "error",
          code: "unknown-item",
          path: `protagonists[${index}].startingInventory[${itemIndex}]`,
          message: `Starting item '${itemId}' does not exist.`,
        });
      }
    });
  });
  if (!protagonistIds.has(manifest.activeProtagonistId)) {
    issues.push({
      severity: "error",
      code: "active-protagonist-missing",
      path: "activeProtagonistId",
      message: `Active protagonist '${manifest.activeProtagonistId}' is not defined.`,
    });
  }

  if (manifest.switcher) {
    const { region } = manifest.switcher;
    const width = context.nativeWidth;
    const height = context.nativeHeight;
    if (
      width !== undefined &&
      height !== undefined &&
      (region.x < 0 ||
        region.y < 0 ||
        region.x + region.width > width ||
        region.y + region.height > height)
    ) {
      issues.push({
        severity: "error",
        code: "switcher-out-of-bounds",
        path: "switcher.region",
        message: `Protagonist switcher must stay inside the ${width}×${height} native canvas.`,
      });
    }
    if (context.hasUiSkin === false || context.hasBitmapFonts === false) {
      issues.push({
        severity: "error",
        code: "switcher-ui-missing",
        path: "switcher",
        message: "Protagonist switcher requires a packaged UI skin and bitmap fonts.",
      });
    }
  }
  return issues;
};
