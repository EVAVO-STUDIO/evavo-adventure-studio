import { idSchema } from "@evavo/adventure-project-schema";
import type { RuntimeRoomScriptState } from "@evavo/adventure-scene-runtime/room-scripts";
import { z } from "zod";

const activeCutawaySchema = z
  .object({
    scriptId: z.string().regex(/^room-script\.[A-Za-z0-9._-]+$/u),
    sequenceId: idSchema("sequence"),
    returnSceneId: idSchema("scene"),
    returnEntranceId: idSchema("entrance"),
  })
  .strict();

export const saveGameRoomScriptStateSchema = z
  .object({
    sceneId: idSchema("scene"),
    enteredAtTick: z.number().int().nonnegative(),
    visitedSceneIds: z.array(idSchema("scene")),
    firedScriptIds: z.array(z.string().regex(/^room-script\.[A-Za-z0-9._-]+$/u)),
    previousConsumedInteractionIds: z.array(idSchema("interaction")),
    previousConsumedDialogueChoiceIds: z.array(idSchema("dialogue-choice")),
    activeCutaway: activeCutawaySchema.nullable(),
  })
  .strict() as z.ZodType<RuntimeRoomScriptState>;
