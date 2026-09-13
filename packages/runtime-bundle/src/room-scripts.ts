import { actionSchema, conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const roomScriptIdSchema = z.string().regex(/^room-script\.[A-Za-z0-9._-]+$/u);

export const runtimeRoomScriptTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene-enter") }).strict(),
  z.object({ kind: z.literal("scene-first-enter") }).strict(),
  z
    .object({
      kind: z.literal("interaction-consumed"),
      interactionId: idSchema("interaction"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dialogue-choice-consumed"),
      choiceId: idSchema("dialogue-choice"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("after-room-ticks"),
      ticks: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("room-tick-cycle"),
      startTick: z.number().int().nonnegative().default(0),
      intervalTicks: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("condition"),
      condition: conditionSchema,
    })
    .strict(),
]);

export const runtimeRoomCutawaySchema = z
  .object({
    sceneId: idSchema("scene"),
    entranceId: idSchema("entrance"),
    sequenceId: idSchema("sequence"),
    returnToPreviousLocation: z.boolean().default(true),
  })
  .strict();

export const runtimeRoomScriptSchema = z
  .object({
    id: roomScriptIdSchema,
    sceneId: idSchema("scene"),
    trigger: runtimeRoomScriptTriggerSchema,
    when: conditionSchema.optional(),
    once: z.boolean().default(true),
    actions: z.array(actionSchema).default([]),
    sequenceId: idSchema("sequence").optional(),
    cutaway: runtimeRoomCutawaySchema.optional(),
  })
  .strict()
  .superRefine((script, context) => {
    const outputs = script.actions.length + (script.sequenceId ? 1 : 0) + (script.cutaway ? 1 : 0);
    if (outputs === 0) {
      context.addIssue({
        code: "custom",
        path: ["actions"],
        message: `Room script '${script.id}' must perform actions, start a sequence or start a cutaway.`,
      });
    }
    if (script.sequenceId && script.cutaway) {
      context.addIssue({
        code: "custom",
        path: ["sequenceId"],
        message: `Room script '${script.id}' cannot use sequenceId and cutaway together; the cutaway owns its sequence.`,
      });
    }
  });

export const runtimeRoomScriptManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    scripts: z.array(runtimeRoomScriptSchema),
  })
  .strict();

export type RuntimeRoomScriptManifest = z.infer<typeof runtimeRoomScriptManifestSchema>;
export type RuntimeRoomScript = RuntimeRoomScriptManifest["scripts"][number];

export type RuntimeRoomScriptIssueCode =
  | "duplicate-script"
  | "unknown-scene"
  | "unknown-entrance"
  | "unknown-sequence"
  | "unknown-interaction"
  | "unknown-dialogue-choice";

export interface RuntimeRoomScriptIssue {
  readonly severity: "error";
  readonly code: RuntimeRoomScriptIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeRoomScriptValidationContext {
  readonly sceneIds: ReadonlySet<string>;
  readonly entranceIdsByScene: ReadonlyMap<string, ReadonlySet<string>>;
  readonly sequenceIds: ReadonlySet<string>;
  readonly interactionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
}

export const validateRuntimeRoomScripts = (
  manifest: RuntimeRoomScriptManifest,
  context: RuntimeRoomScriptValidationContext,
): readonly RuntimeRoomScriptIssue[] => {
  const issues: RuntimeRoomScriptIssue[] = [];
  const seen = new Set<string>();
  const add = (code: RuntimeRoomScriptIssueCode, path: string, message: string): void => {
    issues.push({ severity: "error", code, path, message });
  };
  manifest.scripts.forEach((script, index) => {
    const path = `scripts[${index}]`;
    if (seen.has(script.id)) add("duplicate-script", `${path}.id`, `Room script '${script.id}' is duplicated.`);
    seen.add(script.id);
    if (!context.sceneIds.has(script.sceneId)) {
      add("unknown-scene", `${path}.sceneId`, `Room script '${script.id}' references unknown scene '${script.sceneId}'.`);
    }
    if (script.sequenceId && !context.sequenceIds.has(script.sequenceId)) {
      add("unknown-sequence", `${path}.sequenceId`, `Room script '${script.id}' references unknown sequence '${script.sequenceId}'.`);
    }
    if (script.trigger.kind === "interaction-consumed" && !context.interactionIds.has(script.trigger.interactionId)) {
      add("unknown-interaction", `${path}.trigger.interactionId`, `Room script '${script.id}' references unknown interaction '${script.trigger.interactionId}'.`);
    }
    if (script.trigger.kind === "dialogue-choice-consumed" && !context.dialogueChoiceIds.has(script.trigger.choiceId)) {
      add("unknown-dialogue-choice", `${path}.trigger.choiceId`, `Room script '${script.id}' references unknown dialogue choice '${script.trigger.choiceId}'.`);
    }
    if (script.cutaway) {
      const cutaway = script.cutaway;
      if (!context.sceneIds.has(cutaway.sceneId)) {
        add("unknown-scene", `${path}.cutaway.sceneId`, `Cutaway references unknown scene '${cutaway.sceneId}'.`);
      }
      const entrances = context.entranceIdsByScene.get(cutaway.sceneId);
      if (!entrances?.has(cutaway.entranceId)) {
        add("unknown-entrance", `${path}.cutaway.entranceId`, `Cutaway entrance '${cutaway.entranceId}' does not exist in '${cutaway.sceneId}'.`);
      }
      if (!context.sequenceIds.has(cutaway.sequenceId)) {
        add("unknown-sequence", `${path}.cutaway.sequenceId`, `Cutaway references unknown sequence '${cutaway.sequenceId}'.`);
      }
    }
  });
  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeRoomScriptValidationError extends Error {
  readonly issues: readonly RuntimeRoomScriptIssue[];

  constructor(issues: readonly RuntimeRoomScriptIssue[]) {
    super(`Runtime room scripts are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeRoomScriptValidationError";
    this.issues = issues;
  }
}
