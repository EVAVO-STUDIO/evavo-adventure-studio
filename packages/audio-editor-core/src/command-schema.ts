import {
  audioBusIdSchema,
  audioBusMixSchema,
  audioCueSchema,
  audioDuckingRuleSchema,
  audioMixManifestSchema,
  audioSceneLayerSchema,
  audioSceneSoundscapeSchema,
  audioSpeechBindingSchema,
} from "@evavo/adventure-audio";
import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import type { AudioEditorCommand } from "./index.js";

export const audioEditorCommandSchema: z.ZodType<AudioEditorCommand> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(audioEditorCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-manifest"),
          manifest: audioMixManifestSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-bus"),
          busId: audioBusIdSchema,
          bus: audioBusMixSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-cue"),
          index: z.number().int().nonnegative(),
          cue: audioCueSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-cue"),
          cueId: idSchema("audio-cue"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-cue"),
          cueId: idSchema("audio-cue"),
          cue: audioCueSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-ducking-rule"),
          index: z.number().int().nonnegative(),
          rule: audioDuckingRuleSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-ducking-rule"),
          ruleId: idSchema("audio-ducking-rule"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-ducking-rule"),
          ruleId: idSchema("audio-ducking-rule"),
          rule: audioDuckingRuleSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-soundscape"),
          index: z.number().int().nonnegative(),
          soundscape: audioSceneSoundscapeSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-soundscape"),
          sceneId: idSchema("scene"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-soundscape"),
          sceneId: idSchema("scene"),
          soundscape: audioSceneSoundscapeSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-scene-layer"),
          sceneId: idSchema("scene"),
          index: z.number().int().nonnegative(),
          layer: audioSceneLayerSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-scene-layer"),
          sceneId: idSchema("scene"),
          layerId: idSchema("audio-scene-layer"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-scene-layer"),
          sceneId: idSchema("scene"),
          layerId: idSchema("audio-scene-layer"),
          layer: audioSceneLayerSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-speech-binding"),
          index: z.number().int().nonnegative(),
          binding: audioSpeechBindingSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-speech-binding"),
          bindingId: idSchema("audio-speech-binding"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-speech-binding"),
          bindingId: idSchema("audio-speech-binding"),
          binding: audioSpeechBindingSchema,
        })
        .strict(),
    ]),
);

export const parseAudioEditorCommand = (input: unknown): AudioEditorCommand =>
  audioEditorCommandSchema.parse(input);
