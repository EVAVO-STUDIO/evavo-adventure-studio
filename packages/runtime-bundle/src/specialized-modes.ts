import { actionSchema, conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const modeIdSchema = z.string().regex(/^specialized-mode\.[A-Za-z0-9._-]+$/u);
const stateIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const regionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

const modeTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interaction-consumed"), interactionId: idSchema("interaction") }).strict(),
  z.object({ kind: z.literal("dialogue-choice-consumed"), choiceId: idSchema("dialogue-choice") }).strict(),
  z.object({ kind: z.literal("condition"), condition: conditionSchema }).strict(),
]);

const modeReturnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("previous-location") }).strict(),
  z.object({ kind: z.literal("stay") }).strict(),
  z
    .object({
      kind: z.literal("explicit"),
      sceneId: idSchema("scene"),
      entranceId: idSchema("entrance"),
    })
    .strict(),
]);

const inputRegionSchema = z
  .object({
    id: regionIdSchema,
    label: z.string().min(1),
    shape: z.object({
      points: z.array(z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).min(3),
    }).strict(),
    enabledWhen: conditionSchema.optional(),
    actions: z.array(actionSchema).optional(),
    nextStateId: stateIdSchema.optional(),
    finishOutcomeId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((region, context) => {
    if (region.nextStateId && region.finishOutcomeId) {
      context.addIssue({
        code: "custom",
        path: ["nextStateId"],
        message: "A specialized-mode input region cannot both transition and finish.",
      });
    }
  });

const timeoutSchema = z
  .object({
    afterTicks: z.number().int().positive(),
    actions: z.array(actionSchema).optional(),
    nextStateId: stateIdSchema.optional(),
    finishOutcomeId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((timeout, context) => {
    if (timeout.nextStateId && timeout.finishOutcomeId) {
      context.addIssue({
        code: "custom",
        path: ["nextStateId"],
        message: "A specialized-mode timeout cannot both transition and finish.",
      });
    }
  });

const stateSchema = z
  .object({
    id: stateIdSchema,
    onEnterActions: z.array(actionSchema).optional(),
    inputRegions: z.array(inputRegionSchema).optional(),
    timeout: timeoutSchema.optional(),
  })
  .strict();

export const runtimeSpecializedAdventureModeSchema = z
  .object({
    id: modeIdSchema,
    kind: z.enum(["vehicle", "action", "quick-response", "cinematic-inset", "puzzle-closeup"]),
    trigger: modeTriggerSchema.optional(),
    once: z.boolean().default(true),
    sceneId: idSchema("scene"),
    entranceId: idSchema("entrance"),
    startStateId: stateIdSchema,
    return: modeReturnSchema,
    states: z.array(stateSchema).min(1),
  })
  .strict();
export type RuntimeSpecializedAdventureMode = z.infer<typeof runtimeSpecializedAdventureModeSchema>;

export const runtimeSpecializedAdventureModeManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    modes: z.array(runtimeSpecializedAdventureModeSchema),
  })
  .strict();
export type RuntimeSpecializedAdventureModeManifest = z.infer<typeof runtimeSpecializedAdventureModeManifestSchema>;

export type RuntimeSpecializedAdventureModeIssueCode =
  | "duplicate-mode"
  | "duplicate-state"
  | "duplicate-region"
  | "missing-start-state"
  | "missing-next-state"
  | "unknown-scene"
  | "unknown-entrance"
  | "unknown-interaction"
  | "repeatable-interaction"
  | "unknown-dialogue-choice"
  | "repeatable-dialogue-choice";

export interface RuntimeSpecializedAdventureModeIssue {
  readonly severity: "error";
  readonly code: RuntimeSpecializedAdventureModeIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeSpecializedAdventureModeValidationContext {
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
  readonly interactionIds: ReadonlySet<string>;
  readonly oneShotInteractionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
  readonly oneShotDialogueChoiceIds: ReadonlySet<string>;
}

export const validateRuntimeSpecializedAdventureModes = (
  manifest: RuntimeSpecializedAdventureModeManifest,
  context: RuntimeSpecializedAdventureModeValidationContext,
): readonly RuntimeSpecializedAdventureModeIssue[] => {
  const issues: RuntimeSpecializedAdventureModeIssue[] = [];
  const modeIds = new Set<string>();
  const checkLocation = (sceneId: string, entranceId: string, path: string): void => {
    const entrances = context.entrancesByScene.get(sceneId);
    if (!entrances) {
      issues.push({ severity: "error", code: "unknown-scene", path: `${path}.sceneId`, message: `Unknown specialized-mode scene '${sceneId}'.` });
      return;
    }
    if (!entrances.has(entranceId)) {
      issues.push({ severity: "error", code: "unknown-entrance", path: `${path}.entranceId`, message: `Scene '${sceneId}' has no specialized-mode entrance '${entranceId}'.` });
    }
  };

  manifest.modes.forEach((mode, modeIndex) => {
    const path = `modes[${modeIndex}]`;
    if (modeIds.has(mode.id)) {
      issues.push({ severity: "error", code: "duplicate-mode", path: `${path}.id`, message: `Specialized mode '${mode.id}' is duplicated.` });
    }
    modeIds.add(mode.id);
    checkLocation(mode.sceneId, mode.entranceId, path);
    if (mode.return.kind === "explicit") checkLocation(mode.return.sceneId, mode.return.entranceId, `${path}.return`);

    if (mode.trigger?.kind === "interaction-consumed") {
      const source = mode.trigger.interactionId;
      if (!context.interactionIds.has(source)) {
        issues.push({ severity: "error", code: "unknown-interaction", path: `${path}.trigger.interactionId`, message: `Specialized mode '${mode.id}' references unknown interaction '${source}'.` });
      } else if (!context.oneShotInteractionIds.has(source)) {
        issues.push({ severity: "error", code: "repeatable-interaction", path: `${path}.trigger.interactionId`, message: `Consumed-interaction specialized-mode trigger '${source}' must use once: true.` });
      }
    }
    if (mode.trigger?.kind === "dialogue-choice-consumed") {
      const source = mode.trigger.choiceId;
      if (!context.dialogueChoiceIds.has(source)) {
        issues.push({ severity: "error", code: "unknown-dialogue-choice", path: `${path}.trigger.choiceId`, message: `Specialized mode '${mode.id}' references unknown dialogue choice '${source}'.` });
      } else if (!context.oneShotDialogueChoiceIds.has(source)) {
        issues.push({ severity: "error", code: "repeatable-dialogue-choice", path: `${path}.trigger.choiceId`, message: `Consumed-dialogue specialized-mode trigger '${source}' must use once: true.` });
      }
    }

    const stateIds = new Set<string>();
    mode.states.forEach((state, stateIndex) => {
      const statePath = `${path}.states[${stateIndex}]`;
      if (stateIds.has(state.id)) {
        issues.push({ severity: "error", code: "duplicate-state", path: `${statePath}.id`, message: `Specialized mode '${mode.id}' state '${state.id}' is duplicated.` });
      }
      stateIds.add(state.id);
      const regionIds = new Set<string>();
      (state.inputRegions ?? []).forEach((region, regionIndex) => {
        const regionPath = `${statePath}.inputRegions[${regionIndex}]`;
        if (regionIds.has(region.id)) {
          issues.push({ severity: "error", code: "duplicate-region", path: `${regionPath}.id`, message: `Specialized mode region '${mode.id}/${state.id}/${region.id}' is duplicated.` });
        }
        regionIds.add(region.id);
      });
    });
    if (!stateIds.has(mode.startStateId)) {
      issues.push({ severity: "error", code: "missing-start-state", path: `${path}.startStateId`, message: `Specialized mode '${mode.id}' start state '${mode.startStateId}' is missing.` });
    }
    mode.states.forEach((state, stateIndex) => {
      for (const [nextStateId, nextPath] of [
        ...(state.inputRegions ?? []).map((region, regionIndex) => [region.nextStateId, `${path}.states[${stateIndex}].inputRegions[${regionIndex}].nextStateId`] as const),
        [state.timeout?.nextStateId, `${path}.states[${stateIndex}].timeout.nextStateId`] as const,
      ]) {
        if (nextStateId && !stateIds.has(nextStateId)) {
          issues.push({ severity: "error", code: "missing-next-state", path: nextPath, message: `Specialized mode '${mode.id}' references missing state '${nextStateId}'.` });
        }
      }
    });
  });
  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeSpecializedAdventureModeValidationError extends Error {
  readonly issues: readonly RuntimeSpecializedAdventureModeIssue[];

  constructor(issues: readonly RuntimeSpecializedAdventureModeIssue[]) {
    super(`Runtime specialized adventure modes are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeSpecializedAdventureModeValidationError";
    this.issues = issues;
  }
}
