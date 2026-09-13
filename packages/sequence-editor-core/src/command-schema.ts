import {
  idSchema,
  sequenceCueSchema,
  sequenceSchema,
  sequenceTrackSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";
import type { SequenceEditorCommand } from "./index.js";

export const sequenceEditorCommandSchema: z.ZodType<SequenceEditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(sequenceEditorCommandSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-sequence"),
        sequence: sequenceSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-track"),
        index: z.number().int().nonnegative(),
        track: sequenceTrackSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-track"),
        trackId: idSchema("sequence-track"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-track"),
        trackId: idSchema("sequence-track"),
        track: sequenceTrackSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-cue"),
        trackId: idSchema("sequence-track"),
        index: z.number().int().nonnegative(),
        cue: sequenceCueSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-cue"),
        trackId: idSchema("sequence-track"),
        cueIndex: z.number().int().nonnegative(),
        expectedCue: sequenceCueSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-cue"),
        trackId: idSchema("sequence-track"),
        cueIndex: z.number().int().nonnegative(),
        expectedCue: sequenceCueSchema,
        cue: sequenceCueSchema,
      })
      .strict(),
  ]),
);

export const parseSequenceEditorCommand = (input: unknown): SequenceEditorCommand =>
  sequenceEditorCommandSchema.parse(input);
