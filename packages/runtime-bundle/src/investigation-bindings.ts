import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import type { RuntimeInvestigationManifest } from "./investigation.js";

const factIdSchema = z.string().regex(/^fact\.[A-Za-z0-9._-]+$/u);
const topicIdSchema = z.string().regex(/^topic\.[A-Za-z0-9._-]+$/u);
const sourceIdSchema = z.string().regex(/^source\.[A-Za-z0-9._-]+$/u);

export const runtimeInvestigationEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("use-research-source"), sourceId: sourceIdSchema }).strict(),
  z
    .object({
      kind: z.literal("discover-facts"),
      factIds: z.array(factIdSchema).min(1),
      discoveryKind: z.enum(["research", "dialogue", "evidence", "event"]),
      sourceId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("use-topic"),
      topicId: topicIdSchema,
      speakerId: z.string().min(1),
    })
    .strict(),
  z.object({ kind: z.literal("set-flag"), flag: z.string().min(1), value: z.boolean() }).strict(),
  z.object({ kind: z.literal("advance-chapter") }).strict(),
]);
export type RuntimeInvestigationEffect = z.infer<typeof runtimeInvestigationEffectSchema>;

export const runtimeInvestigationInteractionBindingSchema = z
  .object({
    interactionId: idSchema("interaction"),
    effects: z.array(runtimeInvestigationEffectSchema).min(1),
  })
  .strict();

export const runtimeInvestigationDialogueChoiceBindingSchema = z
  .object({
    choiceId: idSchema("dialogue-choice"),
    effects: z.array(runtimeInvestigationEffectSchema).min(1),
  })
  .strict();

export const runtimeInvestigationBindingManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    interactions: z.array(runtimeInvestigationInteractionBindingSchema).default([]),
    dialogueChoices: z.array(runtimeInvestigationDialogueChoiceBindingSchema).default([]),
  })
  .strict();
export type RuntimeInvestigationBindingManifest = z.infer<typeof runtimeInvestigationBindingManifestSchema>;

export type RuntimeInvestigationBindingIssueCode =
  | "bindings-without-investigation"
  | "duplicate-interaction-binding"
  | "duplicate-dialogue-choice-binding"
  | "unknown-interaction"
  | "unknown-dialogue-choice"
  | "non-once-interaction-binding"
  | "non-once-dialogue-choice-binding"
  | "unknown-fact"
  | "unknown-topic"
  | "unknown-source";

export interface RuntimeInvestigationBindingIssue {
  readonly severity: "error";
  readonly code: RuntimeInvestigationBindingIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeInvestigationBindingValidationContext {
  readonly investigation?: RuntimeInvestigationManifest;
  readonly interactionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
  readonly oneShotInteractionIds: ReadonlySet<string>;
  readonly oneShotDialogueChoiceIds: ReadonlySet<string>;
}

const duplicateBindingIssues = (
  values: readonly string[],
  path: string,
  code: "duplicate-interaction-binding" | "duplicate-dialogue-choice-binding",
): RuntimeInvestigationBindingIssue[] => {
  const seen = new Set<string>();
  const issues: RuntimeInvestigationBindingIssue[] = [];
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push({
        severity: "error",
        code,
        path: `${path}[${index}]`,
        message: `Investigation binding '${value}' is duplicated.`,
      });
    }
    seen.add(value);
  });
  return issues;
};

export const validateRuntimeInvestigationBindings = (
  manifest: RuntimeInvestigationBindingManifest,
  context: RuntimeInvestigationBindingValidationContext,
): readonly RuntimeInvestigationBindingIssue[] => {
  const issues: RuntimeInvestigationBindingIssue[] = [
    ...duplicateBindingIssues(
      manifest.interactions.map((binding) => binding.interactionId),
      "interactions",
      "duplicate-interaction-binding",
    ),
    ...duplicateBindingIssues(
      manifest.dialogueChoices.map((binding) => binding.choiceId),
      "dialogueChoices",
      "duplicate-dialogue-choice-binding",
    ),
  ];
  const investigation = context.investigation;
  if (!investigation) {
    if (manifest.interactions.length > 0 || manifest.dialogueChoices.length > 0) {
      issues.push({
        severity: "error",
        code: "bindings-without-investigation",
        path: "investigationBindings",
        message: "Investigation bindings require an investigation manifest in the same runtime bundle.",
      });
    }
    return issues;
  }

  const factIds = new Set(investigation.facts.map((fact) => fact.id));
  const topicIds = new Set(investigation.topics.map((topic) => topic.id));
  const sourceIds = new Set(investigation.researchSources.map((source) => source.id));

  const validateEffects = (effects: readonly RuntimeInvestigationEffect[], path: string): void => {
    effects.forEach((effect, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`;
      if (effect.kind === "use-research-source" && !sourceIds.has(effect.sourceId)) {
        issues.push({
          severity: "error",
          code: "unknown-source",
          path: `${effectPath}.sourceId`,
          message: `Unknown investigation research source '${effect.sourceId}'.`,
        });
      }
      if (effect.kind === "discover-facts") {
        effect.factIds.forEach((factId, factIndex) => {
          if (!factIds.has(factId)) {
            issues.push({
              severity: "error",
              code: "unknown-fact",
              path: `${effectPath}.factIds[${factIndex}]`,
              message: `Unknown investigation fact '${factId}'.`,
            });
          }
        });
      }
      if (effect.kind === "use-topic" && !topicIds.has(effect.topicId)) {
        issues.push({
          severity: "error",
          code: "unknown-topic",
          path: `${effectPath}.topicId`,
          message: `Unknown investigation topic '${effect.topicId}'.`,
        });
      }
    });
  };

  manifest.interactions.forEach((binding, index) => {
    if (!context.interactionIds.has(binding.interactionId)) {
      issues.push({
        severity: "error",
        code: "unknown-interaction",
        path: `interactions[${index}].interactionId`,
        message: `Investigation binding references unknown interaction '${binding.interactionId}'.`,
      });
    } else if (!context.oneShotInteractionIds.has(binding.interactionId)) {
      issues.push({
        severity: "error",
        code: "non-once-interaction-binding",
        path: `interactions[${index}].interactionId`,
        message:
          `Automatic investigation binding '${binding.interactionId}' must reference an interaction with once: true ` +
          "so consumption is deterministic.",
      });
    }
    validateEffects(binding.effects, `interactions[${index}]`);
  });

  manifest.dialogueChoices.forEach((binding, index) => {
    if (!context.dialogueChoiceIds.has(binding.choiceId)) {
      issues.push({
        severity: "error",
        code: "unknown-dialogue-choice",
        path: `dialogueChoices[${index}].choiceId`,
        message: `Investigation binding references unknown dialogue choice '${binding.choiceId}'.`,
      });
    } else if (!context.oneShotDialogueChoiceIds.has(binding.choiceId)) {
      issues.push({
        severity: "error",
        code: "non-once-dialogue-choice-binding",
        path: `dialogueChoices[${index}].choiceId`,
        message:
          `Automatic investigation binding '${binding.choiceId}' must reference a dialogue choice with once: true ` +
          "so consumption is deterministic.",
      });
    }
    validateEffects(binding.effects, `dialogueChoices[${index}]`);
  });

  return issues;
};
