import { idSchema, actionSchema, conditionSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const recipeIdSchema = z.string().regex(/^item-combination\.[A-Za-z0-9._-]+$/u);

export const runtimeItemCombinationRecipeSchema = z
  .object({
    id: recipeIdSchema,
    verb: z.string().min(1),
    primaryItemId: idSchema("item"),
    secondaryItemId: idSchema("item"),
    commutative: z.boolean().optional(),
    when: conditionSchema.optional(),
    once: z.boolean().optional(),
    actions: z.array(actionSchema),
    fallbackText: z.string().min(1).optional(),
  })
  .strict();

export const runtimeItemCombinationManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    recipes: z.array(runtimeItemCombinationRecipeSchema),
    fallbackText: z.string().min(1).optional(),
  })
  .strict();
export type RuntimeItemCombinationManifest = z.infer<typeof runtimeItemCombinationManifestSchema>;

export type RuntimeItemCombinationIssueCode =
  | "duplicate-recipe"
  | "same-item-recipe"
  | "unknown-item";

export interface RuntimeItemCombinationIssue {
  readonly severity: "error";
  readonly code: RuntimeItemCombinationIssueCode;
  readonly path: string;
  readonly message: string;
}

export const validateRuntimeItemCombinations = (
  manifest: RuntimeItemCombinationManifest,
  knownItemIds: ReadonlySet<string>,
): readonly RuntimeItemCombinationIssue[] => {
  const issues: RuntimeItemCombinationIssue[] = [];
  const seen = new Set<string>();
  const checkItem = (itemId: string, path: string): void => {
    if (!knownItemIds.has(itemId)) {
      issues.push({
        severity: "error",
        code: "unknown-item",
        path,
        message: `Unknown inventory item '${itemId}'.`,
      });
    }
  };

  manifest.recipes.forEach((recipe, recipeIndex) => {
    const path = `recipes[${recipeIndex}]`;
    if (seen.has(recipe.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-recipe",
        path: `${path}.id`,
        message: `Item-combination recipe '${recipe.id}' is duplicated.`,
      });
    }
    seen.add(recipe.id);
    if (recipe.primaryItemId === recipe.secondaryItemId) {
      issues.push({
        severity: "error",
        code: "same-item-recipe",
        path,
        message: `Item-combination recipe '${recipe.id}' cannot use the same item on itself.`,
      });
    }
    checkItem(recipe.primaryItemId, `${path}.primaryItemId`);
    checkItem(recipe.secondaryItemId, `${path}.secondaryItemId`);
    recipe.actions.forEach((action, actionIndex) => {
      if (action.kind === "give-item" || action.kind === "remove-item") {
        checkItem(action.itemId, `${path}.actions[${actionIndex}].itemId`);
      }
    });
  });
  return issues;
};

export class RuntimeItemCombinationValidationError extends Error {
  readonly issues: readonly RuntimeItemCombinationIssue[];

  constructor(issues: readonly RuntimeItemCombinationIssue[]) {
    super(`Runtime item combinations are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeItemCombinationValidationError";
    this.issues = issues;
  }
}
