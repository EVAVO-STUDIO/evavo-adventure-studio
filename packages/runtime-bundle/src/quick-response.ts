import { actionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const modeIdSchema = z.string().regex(/^quick-response\.[A-Za-z0-9._-]+$/u);
const promptIdSchema = z.string().regex(/^quick-prompt\.[A-Za-z0-9._-]+$/u);

export const runtimeQuickResponseInputSchema = z.enum([
  "left",
  "right",
  "up",
  "down",
  "action",
  "cancel",
]);
export type RuntimeQuickResponseInput = z.infer<typeof runtimeQuickResponseInputSchema>;

export const runtimeQuickResponsePromptSchema = z
  .object({
    id: promptIdSchema,
    label: z.string().min(1),
    startTick: z.number().int().nonnegative(),
    endTick: z.number().int().positive(),
    input: runtimeQuickResponseInputSchema,
    required: z.boolean().default(true),
    successActions: z.array(actionSchema).default([]),
    missActions: z.array(actionSchema).default([]),
  })
  .strict()
  .superRefine((prompt, context) => {
    if (prompt.endTick <= prompt.startTick) {
      context.addIssue({ code: "custom", path: ["endTick"], message: "Quick-response prompt endTick must be after startTick." });
    }
  });
export type RuntimeQuickResponsePrompt = z.infer<typeof runtimeQuickResponsePromptSchema>;

export const runtimeQuickResponseModeSchema = z
  .object({
    id: modeIdSchema,
    label: z.string().min(1),
    durationTicks: z.number().int().positive(),
    maximumMisses: z.number().int().nonnegative().default(0),
    savePolicy: z.enum(["allowed", "disabled"]).default("disabled"),
    prompts: z.array(runtimeQuickResponsePromptSchema),
    successActions: z.array(actionSchema).default([]),
    failureActions: z.array(actionSchema).default([]),
  })
  .strict()
  .superRefine((mode, context) => {
    const seen = new Set<string>();
    mode.prompts.forEach((prompt, index) => {
      if (seen.has(prompt.id)) {
        context.addIssue({ code: "custom", path: ["prompts", index, "id"], message: `Quick-response prompt '${prompt.id}' is duplicated.` });
      }
      seen.add(prompt.id);
      if (prompt.endTick > mode.durationTicks) {
        context.addIssue({ code: "custom", path: ["prompts", index, "endTick"], message: `Quick-response prompt '${prompt.id}' exceeds mode duration ${mode.durationTicks}.` });
      }
    });
  });
export type RuntimeQuickResponseMode = z.infer<typeof runtimeQuickResponseModeSchema>;

export const runtimeQuickResponseManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    modes: z.array(runtimeQuickResponseModeSchema),
  })
  .strict();
export type RuntimeQuickResponseManifest = z.infer<typeof runtimeQuickResponseManifestSchema>;

export type RuntimeQuickResponseIssueCode = "duplicate-mode";
export interface RuntimeQuickResponseIssue {
  readonly severity: "error";
  readonly code: RuntimeQuickResponseIssueCode;
  readonly path: string;
  readonly message: string;
}

export const validateRuntimeQuickResponseManifest = (
  manifest: RuntimeQuickResponseManifest,
): readonly RuntimeQuickResponseIssue[] => {
  const issues: RuntimeQuickResponseIssue[] = [];
  const seen = new Set<string>();
  manifest.modes.forEach((mode, index) => {
    if (seen.has(mode.id)) {
      issues.push({ severity: "error", code: "duplicate-mode", path: `modes[${index}].id`, message: `Quick-response mode '${mode.id}' is duplicated.` });
    }
    seen.add(mode.id);
  });
  return issues;
};

export class RuntimeQuickResponseValidationError extends Error {
  readonly issues: readonly RuntimeQuickResponseIssue[];
  constructor(issues: readonly RuntimeQuickResponseIssue[]) {
    super(`Runtime quick-response modes are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeQuickResponseValidationError";
    this.issues = issues;
  }
}
