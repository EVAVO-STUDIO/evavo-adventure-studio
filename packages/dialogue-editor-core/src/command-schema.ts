import { z } from "zod";
import {
  dialogueChoiceSchema,
  dialogueGraphSchema,
  dialogueLineSchema,
  dialogueNodeSchema,
  idSchema,
} from "@evavo/adventure-project-schema";
import type { DialogueEditorCommand } from "./index.js";

export const dialogueEditorCommandSchema: z.ZodType<DialogueEditorCommand> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(dialogueEditorCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-graph"),
          graph: dialogueGraphSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-node"),
          index: z.number().int().nonnegative(),
          node: dialogueNodeSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-node"),
          nodeId: idSchema("dialogue-node"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-node"),
          nodeId: idSchema("dialogue-node"),
          node: dialogueNodeSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-line"),
          nodeId: idSchema("dialogue-node"),
          index: z.number().int().nonnegative(),
          line: dialogueLineSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-line"),
          nodeId: idSchema("dialogue-node"),
          lineId: idSchema("dialogue-line"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-line"),
          nodeId: idSchema("dialogue-node"),
          lineId: idSchema("dialogue-line"),
          line: dialogueLineSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-choice"),
          nodeId: idSchema("dialogue-node"),
          index: z.number().int().nonnegative(),
          choice: dialogueChoiceSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-choice"),
          nodeId: idSchema("dialogue-node"),
          choiceId: idSchema("dialogue-choice"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-choice"),
          nodeId: idSchema("dialogue-node"),
          choiceId: idSchema("dialogue-choice"),
          choice: dialogueChoiceSchema,
        })
        .strict(),
    ]),
);

export const parseDialogueEditorCommand = (
  input: unknown,
): DialogueEditorCommand => dialogueEditorCommandSchema.parse(input);
