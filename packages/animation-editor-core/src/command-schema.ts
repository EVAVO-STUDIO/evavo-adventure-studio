import {
  actorSchema,
  animationClipSchema,
  idSchema,
  spriteFrameSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";
import type { AnimationEditorCommand } from "./index.js";

export const animationEditorCommandSchema: z.ZodType<AnimationEditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(animationEditorCommandSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-actor"),
        actor: actorSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-frame"),
        index: z.number().int().nonnegative(),
        frame: spriteFrameSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-frame"),
        frameId: idSchema("sprite-frame"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-frame"),
        frameId: idSchema("sprite-frame"),
        frame: spriteFrameSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-animation"),
        index: z.number().int().nonnegative(),
        animation: animationClipSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-animation"),
        animationId: idSchema("animation-clip"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-animation"),
        animationId: idSchema("animation-clip"),
        animation: animationClipSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-clip-frame"),
        animationId: idSchema("animation-clip"),
        index: z.number().int().nonnegative(),
        frameId: idSchema("sprite-frame"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-clip-frame"),
        animationId: idSchema("animation-clip"),
        frameIndex: z.number().int().nonnegative(),
        expectedFrameId: idSchema("sprite-frame"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-clip-frame"),
        animationId: idSchema("animation-clip"),
        frameIndex: z.number().int().nonnegative(),
        expectedFrameId: idSchema("sprite-frame"),
        frameId: idSchema("sprite-frame"),
      })
      .strict(),
  ]),
);

export const parseAnimationEditorCommand = (input: unknown): AnimationEditorCommand =>
  animationEditorCommandSchema.parse(input);
