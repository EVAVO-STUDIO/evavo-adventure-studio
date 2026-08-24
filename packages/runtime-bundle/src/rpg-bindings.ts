import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const rpgIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const recipeIdSchema = z.string().regex(/^item-combination\.[A-Za-z0-9._-]+$/u);
const bindingIdSchema = z.string().regex(/^rpg-binding\.[A-Za-z0-9._-]+$/u);

const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interaction-consumed"), interactionId: idSchema("interaction") }).strict(),
  z.object({ kind: z.literal("dialogue-choice-consumed"), choiceId: idSchema("dialogue-choice") }).strict(),
  z.object({ kind: z.literal("item-combination-used"), recipeId: recipeIdSchema }).strict(),
]);

const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("practice-skill"), skillId: rpgIdSchema, amount: z.number().finite().positive() }).strict(),
  z.object({ kind: z.literal("adjust-resource"), resourceId: rpgIdSchema, delta: z.number().finite() }).strict(),
  z.object({ kind: z.literal("adjust-stat"), statId: rpgIdSchema, delta: z.number().finite() }).strict(),
  z.object({ kind: z.literal("advance-time"), minutes: z.number().int().nonnegative() }).strict(),
]);

export const runtimeAdventureRpgBindingSchema = z
  .object({
    id: bindingIdSchema,
    source: sourceSchema,
    effects: z.array(effectSchema).min(1),
  })
  .strict();

export const runtimeAdventureRpgBindingManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    bindings: z.array(runtimeAdventureRpgBindingSchema),
  })
  .strict();
export type RuntimeAdventureRpgBindingManifest = z.infer<typeof runtimeAdventureRpgBindingManifestSchema>;
export type RuntimeAdventureRpgBinding = z.infer<typeof runtimeAdventureRpgBindingSchema>;

export type RuntimeAdventureRpgBindingIssueCode =
  | "duplicate-binding"
  | "missing-rpg-manifest"
  | "unknown-source"
  | "source-not-one-shot"
  | "unknown-skill"
  | "unknown-resource"
  | "unknown-stat";

export interface RuntimeAdventureRpgBindingIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRpgBindingIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAdventureRpgBindingValidationContext {
  readonly skillIds: ReadonlySet<string>;
  readonly resourceIds: ReadonlySet<string>;
  readonly statIds: ReadonlySet<string>;
  readonly interactionIds: ReadonlySet<string>;
  readonly oneShotInteractionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
  readonly oneShotDialogueChoiceIds: ReadonlySet<string>;
  readonly recipeIds: ReadonlySet<string>;
  readonly oneShotRecipeIds: ReadonlySet<string>;
}

export const validateRuntimeAdventureRpgBindings = (
  manifest: RuntimeAdventureRpgBindingManifest,
  context: RuntimeAdventureRpgBindingValidationContext,
): RuntimeAdventureRpgBindingIssue[] => {
  const issues: RuntimeAdventureRpgBindingIssue[] = [];
  const seen = new Set<string>();
  manifest.bindings.forEach((binding, index) => {
    const path = `bindings[${index}]`;
    if (seen.has(binding.id)) {
      issues.push({ severity: "error", code: "duplicate-binding", path: `${path}.id`, message: `RPG binding '${binding.id}' is duplicated.` });
    }
    seen.add(binding.id);
    const source = binding.source;
    if (source.kind === "interaction-consumed") {
      if (!context.interactionIds.has(source.interactionId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.interactionId`, message: `Unknown interaction '${source.interactionId}'.` });
      else if (!context.oneShotInteractionIds.has(source.interactionId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.interactionId`, message: `Interaction '${source.interactionId}' must be once:true for RPG consumed-ID binding.` });
    } else if (source.kind === "dialogue-choice-consumed") {
      if (!context.dialogueChoiceIds.has(source.choiceId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.choiceId`, message: `Unknown dialogue choice '${source.choiceId}'.` });
      else if (!context.oneShotDialogueChoiceIds.has(source.choiceId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.choiceId`, message: `Dialogue choice '${source.choiceId}' must be once:true for RPG consumed-ID binding.` });
    } else {
      if (!context.recipeIds.has(source.recipeId)) issues.push({ severity: "error", code: "unknown-source", path: `${path}.source.recipeId`, message: `Unknown item-combination recipe '${source.recipeId}'.` });
      else if (!context.oneShotRecipeIds.has(source.recipeId)) issues.push({ severity: "error", code: "source-not-one-shot", path: `${path}.source.recipeId`, message: `Item-combination recipe '${source.recipeId}' must be once:true for RPG binding.` });
    }
    binding.effects.forEach((effect, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`;
      if (effect.kind === "practice-skill" && !context.skillIds.has(effect.skillId)) {
        issues.push({ severity: "error", code: "unknown-skill", path: `${effectPath}.skillId`, message: `Unknown RPG skill '${effect.skillId}'.` });
      }
      if (effect.kind === "adjust-resource" && !context.resourceIds.has(effect.resourceId)) {
        issues.push({ severity: "error", code: "unknown-resource", path: `${effectPath}.resourceId`, message: `Unknown RPG resource '${effect.resourceId}'.` });
      }
      if (effect.kind === "adjust-stat" && !context.statIds.has(effect.statId)) {
        issues.push({ severity: "error", code: "unknown-stat", path: `${effectPath}.statId`, message: `Unknown RPG stat '${effect.statId}'.` });
      }
    });
  });
  return issues;
};
