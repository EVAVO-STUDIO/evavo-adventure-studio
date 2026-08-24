import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const recipeIdSchema = z.string().regex(/^item-combination\.[A-Za-z0-9._-]+$/u);
const bindingIdSchema = z.string().regex(/^multi-binding\.[A-Za-z0-9._-]+$/u);

const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interaction-consumed"), interactionId: idSchema("interaction") }).strict(),
  z.object({ kind: z.literal("dialogue-choice-consumed"), choiceId: idSchema("dialogue-choice") }).strict(),
  z.object({ kind: z.literal("item-combination-used"), recipeId: recipeIdSchema }).strict(),
]);

const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set-shared-flag"), flag: z.string().min(1), value: z.boolean() }).strict(),
  z.object({ kind: z.literal("add-shared-fact"), factId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("set-protagonist-flag"), protagonistId: idSchema("actor"), flag: z.string().min(1), value: z.boolean() }).strict(),
  z.object({ kind: z.literal("move-protagonist"), protagonistId: idSchema("actor"), sceneId: idSchema("scene"), entranceId: idSchema("entrance") }).strict(),
  z.object({ kind: z.literal("give-protagonist-item"), protagonistId: idSchema("actor"), itemId: idSchema("item") }).strict(),
  z.object({ kind: z.literal("remove-protagonist-item"), protagonistId: idSchema("actor"), itemId: idSchema("item") }).strict(),
  z.object({ kind: z.literal("transfer-item"), fromProtagonistId: idSchema("actor"), toProtagonistId: idSchema("actor"), itemId: idSchema("item") }).strict(),
]);

export const runtimeMultiProtagonistBindingSchema = z
  .object({
    id: bindingIdSchema,
    source: sourceSchema,
    effects: z.array(effectSchema).min(1),
  })
  .strict();

export const runtimeMultiProtagonistBindingManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    bindings: z.array(runtimeMultiProtagonistBindingSchema),
  })
  .strict();
export type RuntimeMultiProtagonistBindingManifest = z.infer<typeof runtimeMultiProtagonistBindingManifestSchema>;
export type RuntimeMultiProtagonistBinding = z.infer<typeof runtimeMultiProtagonistBindingSchema>;

export type RuntimeMultiProtagonistBindingIssueCode =
  | "duplicate-binding"
  | "missing-multi-protagonist-manifest"
  | "unknown-source"
  | "source-not-one-shot"
  | "unknown-protagonist"
  | "unknown-item"
  | "invalid-location";

export interface RuntimeMultiProtagonistBindingIssue {
  readonly severity: "error";
  readonly code: RuntimeMultiProtagonistBindingIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeMultiProtagonistBindingValidationContext {
  readonly protagonistIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
  readonly interactionIds: ReadonlySet<string>;
  readonly oneShotInteractionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
  readonly oneShotDialogueChoiceIds: ReadonlySet<string>;
  readonly recipeIds: ReadonlySet<string>;
  readonly oneShotRecipeIds: ReadonlySet<string>;
  readonly entrancesByScene: ReadonlyMap<string, ReadonlySet<string>>;
}

export const validateRuntimeMultiProtagonistBindings = (
  manifest: RuntimeMultiProtagonistBindingManifest,
  context: RuntimeMultiProtagonistBindingValidationContext,
): readonly RuntimeMultiProtagonistBindingIssue[] => {
  const issues: RuntimeMultiProtagonistBindingIssue[] = [];
  const seen = new Set<string>();
  manifest.bindings.forEach((binding, index) => {
    const path = `bindings[${index}]`;
    if (seen.has(binding.id)) issues.push({ severity: "error", code: "duplicate-binding", path: `${path}.id`, message: `Binding '${binding.id}' is duplicated.` });
    seen.add(binding.id);
    const source = binding.source;
    if (source.kind === "interaction-consumed") {
      if (!context.interactionIds.has(source.interactionId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.interactionId`, message: `Unknown interaction '${source.interactionId}'.` });
      else if (!context.oneShotInteractionIds.has(source.interactionId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.interactionId`, message: `Interaction '${source.interactionId}' must be once:true for cross-protagonist consumed-ID binding.` });
    } else if (source.kind === "dialogue-choice-consumed") {
      if (!context.dialogueChoiceIds.has(source.choiceId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.choiceId`, message: `Unknown dialogue choice '${source.choiceId}'.` });
      else if (!context.oneShotDialogueChoiceIds.has(source.choiceId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.choiceId`, message: `Dialogue choice '${source.choiceId}' must be once:true for cross-protagonist consumed-ID binding.` });
    } else {
      if (!context.recipeIds.has(source.recipeId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.recipeId`, message: `Unknown item-combination recipe '${source.recipeId}'.` });
      else if (!context.oneShotRecipeIds.has(source.recipeId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.recipeId`, message: `Item-combination recipe '${source.recipeId}' must be once:true for cross-protagonist binding.` });
    }

    binding.effects.forEach((effect, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`;
      const protagonistIds =
        effect.kind === "transfer-item"
          ? [effect.fromProtagonistId, effect.toProtagonistId]
          : "protagonistId" in effect
            ? [effect.protagonistId]
            : [];
      protagonistIds.forEach((protagonistId) => {
        if (!context.protagonistIds.has(protagonistId)) issues.push({ severity: "error", code: "unknown-protagonist", path: effectPath, message: `Unknown protagonist '${protagonistId}'.` });
      });
      if ((effect.kind === "give-protagonist-item" || effect.kind === "remove-protagonist-item" || effect.kind === "transfer-item") && !context.itemIds.has(effect.itemId)) {
        issues.push({ severity: "error", code: "unknown-item", path: `${effectPath}.itemId`, message: `Unknown inventory item '${effect.itemId}'.` });
      }
      if (effect.kind === "move-protagonist") {
        const entrances = context.entrancesByScene.get(effect.sceneId);
        if (!entrances?.has(effect.entranceId)) issues.push({ severity: "error", code: "invalid-location", path: effectPath, message: `Invalid protagonist destination '${effect.sceneId}/${effect.entranceId}'.` });
      }
    });
  });
  return issues;
};
