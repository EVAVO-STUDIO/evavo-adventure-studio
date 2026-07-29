import { z } from "zod";
import {
  audioAssetMetadataSchema,
  compiledOutputFileSchema,
  fontAssetMetadataSchema,
  imageAssetMetadataSchema,
  paletteAssetMetadataSchema,
  spritesheetAssetMetadataSchema,
  videoAssetMetadataSchema,
} from "./index.js";
import { idSchema } from "@evavo/adventure-project-schema";

const runtimeAssetFields = {
  assetId: idSchema("asset"),
  outputFiles: z.array(compiledOutputFileSchema).min(1),
} as const;

export const runtimeAssetRecordSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("image"),
      metadata: imageAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("spritesheet"),
      metadata: spritesheetAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("audio"),
      metadata: audioAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("font"),
      metadata: fontAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("video"),
      metadata: videoAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...runtimeAssetFields,
      kind: z.literal("palette"),
      metadata: paletteAssetMetadataSchema,
    })
    .strict(),
]);
export type RuntimeAssetRecord = z.infer<typeof runtimeAssetRecordSchema>;

export const parseRuntimeAssetRecord = (input: unknown): RuntimeAssetRecord =>
  runtimeAssetRecordSchema.parse(input);
