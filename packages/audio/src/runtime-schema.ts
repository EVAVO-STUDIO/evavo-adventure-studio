import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import {
  audioBusIdSchema,
  audioContentBusIdSchema,
} from "./index.js";
import type {
  ActiveAudioVoice,
  AudioBusRuntimeState,
  AudioRuntimeState,
  AudioVoiceLoop,
  AudioVoiceOwner,
} from "./runtime.js";

export const audioBusRuntimeStateSchema = z
  .object({
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
  })
  .strict() as z.ZodType<AudioBusRuntimeState>;

export const audioVoiceLoopSchema: z.ZodType<AudioVoiceLoop> = z.union([
  z.null(),
  z.object({ kind: z.literal("full") }).strict(),
  z
    .object({
      kind: z.literal("region"),
      startMilliseconds: z.number().int().nonnegative(),
      endMilliseconds: z.number().int().positive(),
      crossfadeMilliseconds: z.number().int().nonnegative(),
    })
    .strict(),
]);

export const audioVoiceOwnerSchema: z.ZodType<AudioVoiceOwner> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("cue") }).strict(),
    z
      .object({
        kind: z.literal("scene-layer"),
        sceneId: idSchema("scene"),
        layerId: idSchema("audio-scene-layer"),
        restartPolicy: z.enum(["restart", "resume", "continue"]),
        fadeOutTicks: z.number().int().nonnegative(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("sequence"),
        key: z.string().min(1),
      })
      .strict(),
  ]);

export const activeAudioVoiceSchema = z
  .object({
    id: idSchema("audio-voice"),
    cueId: idSchema("audio-cue").nullable(),
    assetId: idSchema("asset"),
    bus: audioContentBusIdSchema,
    volume: z.number().min(0).max(1),
    priority: z.number().int(),
    startedAtTick: z.number().int().nonnegative(),
    startOffsetMilliseconds: z.number().int().nonnegative(),
    loop: audioVoiceLoopSchema,
    interruptGroup: z.string().min(1).nullable(),
    owner: audioVoiceOwnerSchema,
  })
  .strict() as z.ZodType<ActiveAudioVoice>;

const audioBusRuntimeRecordSchema = z.record(
  audioBusIdSchema,
  audioBusRuntimeStateSchema,
);

export const audioRuntimeStateSchema = z
  .object({
    stateVersion: z.literal(1),
    projectId: idSchema("project"),
    tick: z.number().int().nonnegative(),
    sceneId: idSchema("scene"),
    buses: audioBusRuntimeRecordSchema,
    voices: z.array(activeAudioVoiceSchema),
    resumeOffsetsMilliseconds: z.record(
      z.string().min(1),
      z.number().finite().nonnegative(),
    ),
    nextVoiceSerial: z.number().int().nonnegative(),
  })
  .strict() as z.ZodType<AudioRuntimeState>;

export const parseAudioRuntimeState = (input: unknown): AudioRuntimeState =>
  audioRuntimeStateSchema.parse(input);
