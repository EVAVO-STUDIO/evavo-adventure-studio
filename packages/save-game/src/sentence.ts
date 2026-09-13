import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const sentenceTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("scene-object"),
      objectId: idSchema("object"),
      label: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("inventory-item"),
      itemId: idSchema("item"),
      label: z.string().min(1),
    })
    .strict(),
]);

export const saveGameSentenceStateSchema = z
  .object({
    verbId: idSchema("ui-verb").nullable(),
    primary: sentenceTargetSchema.nullable(),
    secondary: sentenceTargetSchema.nullable(),
  })
  .strict();

export type SaveGameSentenceState = z.infer<typeof saveGameSentenceStateSchema>;
