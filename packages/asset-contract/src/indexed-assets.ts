import { idSchema, rectangleSchema, sizeSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import { relativeRuntimePathSchema, sha256Schema } from "./index.js";

export const indexedPaletteBindingSchema = z
  .object({
    paletteAssetId: idSchema("asset"),
    paletteOffset: z.number().int().min(0).max(255).default(0),
  })
  .strict();
export type IndexedPaletteBinding = z.infer<typeof indexedPaletteBindingSchema>;

export const indexedFrameSchema = z
  .object({
    frameId: idSchema("sprite-frame"),
    sourceRect: rectangleSchema,
    originalSize: sizeSchema,
    trimOffset: z
      .object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type IndexedFrame = z.infer<typeof indexedFrameSchema>;

export const indexedAssetRecordSchema = z
  .object({
    assetId: idSchema("asset"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    indexRuntimePath: relativeRuntimePathSchema,
    indexSha256: sha256Schema,
    indexByteLength: z.number().int().positive(),
    transparentIndex: z.number().int().min(0).max(255).optional(),
    defaultPalette: indexedPaletteBindingSchema,
    frames: z.array(indexedFrameSchema).default([]),
  })
  .strict()
  .superRefine((record, ctx) => {
    const expectedLength = record.width * record.height;
    if (record.indexByteLength !== expectedLength) {
      ctx.addIssue({
        code: "custom",
        path: ["indexByteLength"],
        message: `Indexed asset requires exactly ${expectedLength} bytes for ${record.width}×${record.height}; received ${record.indexByteLength}.`,
      });
    }
    for (let index = 0; index < record.frames.length; index += 1) {
      const frame = record.frames[index];
      if (!frame) continue;
      const right = frame.sourceRect.x + frame.sourceRect.width;
      const bottom = frame.sourceRect.y + frame.sourceRect.height;
      if (frame.sourceRect.x < 0 || frame.sourceRect.y < 0 || right > record.width || bottom > record.height) {
        ctx.addIssue({
          code: "custom",
          path: ["frames", index, "sourceRect"],
          message: `Indexed frame '${frame.frameId}' exceeds the ${record.width}×${record.height} index map.`,
        });
      }
    }
  });
export type IndexedAssetRecord = z.infer<typeof indexedAssetRecordSchema>;

export const indexedAssetManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    assets: z.array(indexedAssetRecordSchema),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const assetIds = new Set<string>();
    const runtimePaths = new Set<string>();
    for (let index = 0; index < manifest.assets.length; index += 1) {
      const asset = manifest.assets[index];
      if (!asset) continue;
      if (assetIds.has(asset.assetId)) {
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "assetId"],
          message: `Indexed asset '${asset.assetId}' is duplicated.`,
        });
      }
      assetIds.add(asset.assetId);
      if (runtimePaths.has(asset.indexRuntimePath)) {
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "indexRuntimePath"],
          message: `Indexed runtime path '${asset.indexRuntimePath}' is duplicated.`,
        });
      }
      runtimePaths.add(asset.indexRuntimePath);
    }
  });
export type IndexedAssetManifest = z.infer<typeof indexedAssetManifestSchema>;

export const parseIndexedAssetManifest = (input: unknown): IndexedAssetManifest =>
  indexedAssetManifestSchema.parse(input);

export const indexedAssetById = (
  manifest: IndexedAssetManifest,
  assetId: string,
): IndexedAssetRecord | null => manifest.assets.find((asset) => asset.assetId === assetId) ?? null;
