import { idSchema } from "@evavo/adventure-project-schema";
import type { MultiProtagonistState } from "@evavo/adventure-scene-runtime/multi-protagonist";
import { z } from "zod";

const protagonistStateSchema = z
  .object({
    protagonistId: idSchema("actor"),
    location: z
      .object({
        sceneId: idSchema("scene"),
        entranceId: idSchema("entrance"),
      })
      .strict(),
    inventory: z.array(idSchema("item")),
    flags: z.record(z.string().min(1), z.boolean()),
  })
  .strict();

export const saveGameMultiProtagonistStateSchema = z
  .object({
    activeProtagonistId: idSchema("actor"),
    protagonists: z.record(z.string().min(1), protagonistStateSchema),
    sharedFlags: z.record(z.string().min(1), z.boolean()),
    sharedFacts: z.array(z.string().min(1)),
  })
  .strict() as z.ZodType<MultiProtagonistState>;
