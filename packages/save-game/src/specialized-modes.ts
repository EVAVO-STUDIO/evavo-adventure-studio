import { idSchema } from "@evavo/adventure-project-schema";
import type { SpecializedAdventureModeSessionState } from "@evavo/adventure-scene-runtime/specialized-mode-session";
import { z } from "zod";

const modeIdSchema = z.string().regex(/^specialized-mode\.[A-Za-z0-9._-]+$/u);

const activeSpecializedModeSchema = z
  .object({
    modeId: modeIdSchema,
    kind: z.enum(["vehicle", "action", "quick-response", "cinematic-inset", "puzzle-closeup"]),
    stateId: z.string().min(1),
    enteredAtTick: z.number().int().nonnegative(),
    stateEnteredAtTick: z.number().int().nonnegative(),
    returnSceneId: idSchema("scene"),
    returnEntranceId: idSchema("entrance"),
  })
  .strict();

export const saveGameSpecializedModeSessionStateSchema = z
  .object({
    active: activeSpecializedModeSchema.nullable(),
    firedModeIds: z.array(modeIdSchema),
    previousConsumedInteractionIds: z.array(idSchema("interaction")),
    previousConsumedDialogueChoiceIds: z.array(idSchema("dialogue-choice")),
  })
  .strict() as z.ZodType<SpecializedAdventureModeSessionState>;
