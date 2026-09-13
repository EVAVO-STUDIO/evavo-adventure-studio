import { idSchema } from "@evavo/adventure-project-schema";
import { uiSkinSchema, uiVerbSchema } from "@evavo/adventure-ui-skin";
import { z } from "zod";
import type { UiSkinEditorCommand } from "./index.js";

export const uiSkinEditorCommandSchema: z.ZodType<UiSkinEditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(uiSkinEditorCommandSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("set-default-skin"),
        skinId: idSchema("ui-skin"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-skin"),
        index: z.number().int().nonnegative(),
        skin: uiSkinSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-skin"),
        skinId: idSchema("ui-skin"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-skin"),
        skinId: idSchema("ui-skin"),
        skin: uiSkinSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-verb"),
        skinId: idSchema("ui-skin"),
        index: z.number().int().nonnegative(),
        verb: uiVerbSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-verb"),
        skinId: idSchema("ui-skin"),
        verbId: idSchema("ui-verb"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-verb"),
        skinId: idSchema("ui-skin"),
        verbId: idSchema("ui-verb"),
        verb: uiVerbSchema,
      })
      .strict(),
  ]),
);

export const parseUiSkinEditorCommand = (input: unknown): UiSkinEditorCommand =>
  uiSkinEditorCommandSchema.parse(input);
