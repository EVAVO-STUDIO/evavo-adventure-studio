import { z } from "zod";
import {
  dialogueGraphSchema,
  idSchema,
  sequenceSchema,
} from "@evavo/adventure-project-schema";
import type { NarrativeLibraryCommand } from "./index.js";

export const narrativeLibraryCommandSchema: z.ZodType<NarrativeLibraryCommand> =
  z.lazy(() =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(narrativeLibraryCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-dialogue"),
          index: z.number().int().nonnegative(),
          dialogue: dialogueGraphSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-dialogue"),
          dialogueId: idSchema("dialogue"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-dialogue"),
          dialogueId: idSchema("dialogue"),
          dialogue: dialogueGraphSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-sequence"),
          index: z.number().int().nonnegative(),
          sequence: sequenceSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-sequence"),
          sequenceId: idSchema("sequence"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-sequence"),
          sequenceId: idSchema("sequence"),
          sequence: sequenceSchema,
        })
        .strict(),
    ]),
  );

export const parseNarrativeLibraryCommand = (
  input: unknown,
): NarrativeLibraryCommand => narrativeLibraryCommandSchema.parse(input);
