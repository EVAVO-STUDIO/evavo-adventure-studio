import { z } from "zod";
import { conditionSchema, type Condition, type Id, idSchema } from "./index.js";

export const gameLifecycleMenuLabelsSchema = z
  .object({
    quickRetry: z.string().min(1).max(48),
    loadGame: z.string().min(1).max(48),
    restartGame: z.string().min(1).max(48),
    returnToTitle: z.string().min(1).max(48),
    back: z.string().min(1).max(48),
  })
  .strict();
export type GameLifecycleMenuLabels = z.infer<typeof gameLifecycleMenuLabelsSchema>;

export const gameLifecycleMenuSchema = z
  .object({
    allowQuickRetry: z.boolean(),
    allowLoad: z.boolean(),
    allowRestart: z.boolean(),
    allowTitle: z.boolean(),
    labels: gameLifecycleMenuLabelsSchema,
  })
  .strict()
  .superRefine((menu, context) => {
    if (!menu.allowRestart && !menu.allowTitle) {
      context.addIssue({
        code: "custom",
        path: ["allowTitle"],
        message: "A lifecycle outcome must provide Restart Game or Return to Title as an unconditional exit.",
      });
    }
  });
export type GameLifecycleMenu = z.infer<typeof gameLifecycleMenuSchema>;

export const gameLifecycleOutcomeSchema = z
  .object({
    id: z.string().min(1).max(96),
    kind: z.enum(["failure", "success"]),
    priority: z.number().int().min(-1000).max(1000),
    when: conditionSchema,
    title: z.string().min(1).max(96),
    message: z.string().min(1).max(320),
    menu: gameLifecycleMenuSchema,
  })
  .strict();
export interface GameLifecycleOutcome {
  readonly id: string;
  readonly kind: "failure" | "success";
  readonly priority: number;
  readonly when: Condition;
  readonly title: string;
  readonly message: string;
  readonly menu: GameLifecycleMenu;
}

export const gameLifecycleManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    outcomes: z.array(gameLifecycleOutcomeSchema).min(1).max(128),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    manifest.outcomes.forEach((outcome, index) => {
      if (ids.has(outcome.id)) {
        context.addIssue({
          code: "custom",
          path: ["outcomes", index, "id"],
          message: `Lifecycle outcome ID '${outcome.id}' is declared more than once.`,
        });
      }
      ids.add(outcome.id);
    });
  });
export interface GameLifecycleManifest {
  readonly manifestVersion: 1;
  readonly projectId: Id<"project">;
  readonly outcomes: readonly GameLifecycleOutcome[];
}

export const parseGameLifecycleManifest = (input: unknown): GameLifecycleManifest =>
  gameLifecycleManifestSchema.parse(input) as GameLifecycleManifest;

export const canonicaliseGameLifecycleManifest = (
  manifest: GameLifecycleManifest,
): GameLifecycleManifest =>
  parseGameLifecycleManifest({
    ...manifest,
    outcomes: [...manifest.outcomes].sort((left, right) => {
      const priority = right.priority - left.priority;
      return priority !== 0 ? priority : left.id.localeCompare(right.id);
    }),
  });

export const createDefaultFailureLifecycleMenu = (): GameLifecycleMenu => ({
  allowQuickRetry: true,
  allowLoad: true,
  allowRestart: true,
  allowTitle: true,
  labels: {
    quickRetry: "QUICK RETRY",
    loadGame: "LOAD GAME",
    restartGame: "RESTART GAME",
    returnToTitle: "RETURN TO TITLE",
    back: "BACK",
  },
});