import type { AdventureRpgEconomyState } from "@evavo/adventure-scene-runtime/rpg-economy";
import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

export const saveGameAdventureRpgEconomyStateSchema = z
  .object({
    balances: z.record(z.string().min(1), z.number().int().nonnegative()),
    equippedBySlot: z.record(z.string().min(1), idSchema("item").nullable()),
    stockByShopItem: z.record(z.string().min(1), z.number().int().nonnegative().nullable()),
  })
  .strict() as z.ZodType<AdventureRpgEconomyState>;
