import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

export const runtimeProtagonistDefinitionSchema = z
  .object({
    protagonistId: idSchema("actor"),
    startSceneId: idSchema("scene"),
    startEntranceId: idSchema("entrance"),
    startingInventory: z.array(idSchema("item")).default([]),
  })
  .strict();

export const runtimeMultiProtagonistManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    activeProtagonistId: idSchema("actor"),
    protagonists: z.array(runtimeProtagonistDefinitionSchema).min(2),
  })
  .strict();

export type RuntimeMultiProtagonistManifest = z.infer<typeof runtimeMultiProtagonistManifestSchema>;

export type RuntimeMultiProtagonistIssueCode =
  | "duplicate-protagonist"
  | "active-protagonist-missing"
  | "unknown-actor"
  | "unknown-scene"
  | "unknown-entrance"
  | "unknown-item";

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
  return issues;
};
