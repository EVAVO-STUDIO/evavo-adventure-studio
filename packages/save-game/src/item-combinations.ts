import { z } from "zod";

export const saveGameItemCombinationStateSchema = z
  .object({
    usedRecipeIds: z.array(z.string().regex(/^item-combination\.[A-Za-z0-9._-]+$/u)),
  })
  .strict();

export type SaveGameItemCombinationState = z.infer<typeof saveGameItemCombinationStateSchema>;
