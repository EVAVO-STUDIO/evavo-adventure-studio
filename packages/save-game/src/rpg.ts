import type { AdventureRpgState } from "@evavo/adventure-scene-runtime/rpg";
import { z } from "zod";

const valueMap = z.record(z.string().min(1), z.number().finite());

export const saveGameAdventureRpgStateSchema = z
  .object({
    classId: z.string().min(1),
    stats: valueMap,
    skills: valueMap,
    resources: valueMap,
    practice: valueMap,
    day: z.number().int().positive(),
    minuteOfDay: z.number().int().nonnegative(),
  })
  .strict() as z.ZodType<AdventureRpgState>;
