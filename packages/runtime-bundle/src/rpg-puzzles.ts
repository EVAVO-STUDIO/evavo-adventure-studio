import { actionSchema, conditionSchema, idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const rpgIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const puzzleIdSchema = z.string().regex(/^rpg-puzzle\.[A-Za-z0-9._-]+$/u);
const solutionIdSchema = z.string().regex(/^rpg-solution\.[A-Za-z0-9._-]+$/u);

export const runtimeAdventureRpgPuzzleSolutionSchema = z
  .object({
    id: solutionIdSchema,
    label: z.string().min(1),
    classTagsAll: z.array(z.string().min(1)).default([]),
    classTagsAny: z.array(z.string().min(1)).default([]),
    requiredItemIds: z.array(idSchema("item")).default([]),
    when: conditionSchema.optional(),
    check: z
      .object({
        skillId: rpgIdSchema,
        difficulty: z.number().finite(),
        statWeight: z.number().finite().nonnegative().optional(),
        skillWeight: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .optional(),
    practice: z
      .object({
        skillId: rpgIdSchema,
        amount: z.number().finite().positive().default(1),
      })
      .strict()
      .optional(),
    actions: z.array(actionSchema).default([]),
    failureText: z.string().min(1).optional(),
  })
  .strict();
export type RuntimeAdventureRpgPuzzleSolution = z.infer<typeof runtimeAdventureRpgPuzzleSolutionSchema>;

export const runtimeAdventureRpgPuzzleSchema = z
  .object({
    id: puzzleIdSchema,
    label: z.string().min(1),
    solutions: z.array(runtimeAdventureRpgPuzzleSolutionSchema).min(1),
    fallbackText: z.string().min(1).default("That approach will not solve this problem."),
  })
  .strict();
export type RuntimeAdventureRpgPuzzle = z.infer<typeof runtimeAdventureRpgPuzzleSchema>;

export const runtimeAdventureRpgPuzzleManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    puzzles: z.array(runtimeAdventureRpgPuzzleSchema),
  })
  .strict();
export type RuntimeAdventureRpgPuzzleManifest = z.infer<typeof runtimeAdventureRpgPuzzleManifestSchema>;

export type RuntimeAdventureRpgPuzzleIssueCode =
  | "missing-rpg-manifest"
  | "duplicate-puzzle"
  | "duplicate-solution"
  | "unknown-class-tag"
  | "unknown-skill"
  | "unknown-item"
  | "class-without-solution";

export interface RuntimeAdventureRpgPuzzleIssue {
  readonly severity: "error";
  readonly code: RuntimeAdventureRpgPuzzleIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeAdventureRpgPuzzleValidationContext {
  readonly classes?: readonly { readonly id: string; readonly tags?: readonly string[] }[];
  readonly classTags?: ReadonlySet<string>;
  readonly skillIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
}

const solutionClassEligible = (
  classTags: readonly string[],
  solution: RuntimeAdventureRpgPuzzleSolution,
): boolean => {
  if (solution.classTagsAll.some((tag) => !classTags.includes(tag))) return false;
  if (solution.classTagsAny.length > 0 && !solution.classTagsAny.some((tag) => classTags.includes(tag))) return false;
  return true;
};

export const validateRuntimeAdventureRpgPuzzles = (
  manifest: RuntimeAdventureRpgPuzzleManifest,
  context: RuntimeAdventureRpgPuzzleValidationContext,
): readonly RuntimeAdventureRpgPuzzleIssue[] => {
  const issues: RuntimeAdventureRpgPuzzleIssue[] = [];
  const knownClassTags = context.classTags ?? new Set(context.classes?.flatMap((entry) => entry.tags ?? []) ?? []);
  const puzzleIds = new Set<string>();
  manifest.puzzles.forEach((puzzle, puzzleIndex) => {
    const puzzlePath = `puzzles[${puzzleIndex}]`;
    if (puzzleIds.has(puzzle.id)) {
      issues.push({ severity: "error", code: "duplicate-puzzle", path: `${puzzlePath}.id`, message: `RPG puzzle '${puzzle.id}' is duplicated.` });
    }
    puzzleIds.add(puzzle.id);
    const solutionIds = new Set<string>();
    puzzle.solutions.forEach((solution, solutionIndex) => {
      const solutionPath = `${puzzlePath}.solutions[${solutionIndex}]`;
      if (solutionIds.has(solution.id)) {
        issues.push({ severity: "error", code: "duplicate-solution", path: `${solutionPath}.id`, message: `RPG solution '${solution.id}' is duplicated within puzzle '${puzzle.id}'.` });
      }
      solutionIds.add(solution.id);
      for (const tag of [...solution.classTagsAll, ...solution.classTagsAny]) {
        if (!knownClassTags.has(tag)) {
          issues.push({ severity: "error", code: "unknown-class-tag", path: solutionPath, message: `RPG solution '${solution.id}' references unknown class tag '${tag}'.` });
        }
      }
      for (const itemId of solution.requiredItemIds) {
        if (!context.itemIds.has(itemId)) {
          issues.push({ severity: "error", code: "unknown-item", path: `${solutionPath}.requiredItemIds`, message: `RPG solution '${solution.id}' references unknown item '${itemId}'.` });
        }
      }
      for (const skillId of [solution.check?.skillId, solution.practice?.skillId]) {
        if (skillId && !context.skillIds.has(skillId)) {
          issues.push({ severity: "error", code: "unknown-skill", path: solutionPath, message: `RPG solution '${solution.id}' references unknown skill '${skillId}'.` });
        }
      }
    });
    for (const playableClass of context.classes ?? []) {
      if (!puzzle.solutions.some((solution) => solutionClassEligible(playableClass.tags ?? [], solution))) {
        issues.push({
          severity: "error",
          code: "class-without-solution",
          path: puzzlePath,
          message: `RPG puzzle '${puzzle.id}' has no authored solution available to class '${playableClass.id}'.`,
        });
      }
    }
  });
  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
};

export class RuntimeAdventureRpgPuzzleValidationError extends Error {
  readonly issues: readonly RuntimeAdventureRpgPuzzleIssue[];
  constructor(issues: readonly RuntimeAdventureRpgPuzzleIssue[]) {
    super(`Runtime adventure RPG puzzles are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeAdventureRpgPuzzleValidationError";
    this.issues = issues;
  }
}
