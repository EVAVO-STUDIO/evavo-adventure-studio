import { type AdventureProject, idSchema, rectangleSchema, sizeSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import {
  type AssetBuildManifest,
  relativeRuntimePathSchema,
  sha256Schema,
} from "./index.js";

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
    maximumSourceIndex: z.number().int().min(0).max(255).optional(),
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
    const frameIds = new Set<string>();
    for (let index = 0; index < record.frames.length; index += 1) {
      const frame = record.frames[index];
      if (!frame) continue;
      if (frameIds.has(frame.frameId)) {
        ctx.addIssue({
          code: "custom",
          path: ["frames", index, "frameId"],
          message: `Indexed frame '${frame.frameId}' is duplicated.`,
        });
      }
      frameIds.add(frame.frameId);
      const right = frame.sourceRect.x + frame.sourceRect.width;
      const bottom = frame.sourceRect.y + frame.sourceRect.height;
      if (frame.sourceRect.x < 0 || frame.sourceRect.y < 0 || right > record.width || bottom > record.height) {
        ctx.addIssue({
          code: "custom",
          path: ["frames", index, "sourceRect"],
          message: `Indexed frame '${frame.frameId}' exceeds the ${record.width}×${record.height} index map.`,
        });
      }
      if (
        frame.trimOffset.x + frame.sourceRect.width > frame.originalSize.width ||
        frame.trimOffset.y + frame.sourceRect.height > frame.originalSize.height
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["frames", index],
          message: `Indexed frame '${frame.frameId}' does not fit its original dimensions.`,
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

export type IndexedAssetManifestIssueCode =
  | "project-mismatch"
  | "asset-missing"
  | "asset-kind-unsupported"
  | "asset-dimension-mismatch"
  | "spritesheet-page-count-unsupported"
  | "indexed-frame-missing"
  | "indexed-frame-geometry-mismatch"
  | "palette-missing"
  | "palette-kind-mismatch"
  | "palette-primary-output-missing"
  | "palette-offset-overflow"
  | "transparent-index-overflow";

export interface IndexedAssetManifestIssue {
  readonly severity: "error";
  readonly code: IndexedAssetManifestIssueCode;
  readonly path: string;
  readonly message: string;
}

const indexedIssue = (
  issues: IndexedAssetManifestIssue[],
  code: IndexedAssetManifestIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const sameRectangle = (
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean =>
  left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;

const sameSize = (
  left: { readonly width: number; readonly height: number },
  right: { readonly width: number; readonly height: number },
): boolean => left.width === right.width && left.height === right.height;

const samePoint = (
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean => left.x === right.x && left.y === right.y;

const maximumResolvedIndex = (record: IndexedAssetRecord): number | null =>
  record.maximumSourceIndex === undefined
    ? null
    : record.maximumSourceIndex + record.defaultPalette.paletteOffset;

export const validateIndexedAssetManifest = (
  project: Pick<AdventureProject, "id">,
  compiled: AssetBuildManifest,
  indexed: IndexedAssetManifest,
): readonly IndexedAssetManifestIssue[] => {
  const issues: IndexedAssetManifestIssue[] = [];
  if (compiled.projectId !== project.id || indexed.projectId !== project.id) {
    indexedIssue(
      issues,
      "project-mismatch",
      "projectId",
      `Indexed, compiled and project identities must all match '${project.id}'.`,
    );
  }

  const compiledById = new Map(compiled.assets.map((asset) => [asset.assetId as string, asset] as const));
  indexed.assets.forEach((record, recordIndex) => {
    const recordPath = `assets[${recordIndex}]`;
    const base = compiledById.get(record.assetId);
    if (!base) {
      indexedIssue(
        issues,
        "asset-missing",
        `${recordPath}.assetId`,
        `Indexed source '${record.assetId}' has no compiled asset record.`,
      );
    } else if (base.kind !== "image" && base.kind !== "spritesheet") {
      indexedIssue(
        issues,
        "asset-kind-unsupported",
        `${recordPath}.assetId`,
        `Indexed source '${record.assetId}' decorates compiled kind '${base.kind}', expected image or spritesheet.`,
      );
    } else if (base.kind === "image") {
      if (record.width !== base.metadata.width || record.height !== base.metadata.height) {
        indexedIssue(
          issues,
          "asset-dimension-mismatch",
          recordPath,
          `Indexed map '${record.assetId}' is ${record.width}×${record.height}; compiled image is ${base.metadata.width}×${base.metadata.height}.`,
        );
      }
      if (record.frames.length > 0) {
        indexedIssue(
          issues,
          "indexed-frame-geometry-mismatch",
          `${recordPath}.frames`,
          `Indexed image '${record.assetId}' must not declare spritesheet frame metadata.`,
        );
      }
    } else {
      if (base.metadata.pages.length !== 1) {
        indexedIssue(
          issues,
          "spritesheet-page-count-unsupported",
          recordPath,
          `Indexed spritesheet '${record.assetId}' has ${base.metadata.pages.length} compiled atlas pages; the current indexed runtime supports exactly one page per asset.`,
        );
      }
      const page = base.metadata.pages[0];
      if (page && (record.width !== page.width || record.height !== page.height)) {
        indexedIssue(
          issues,
          "asset-dimension-mismatch",
          recordPath,
          `Indexed map '${record.assetId}' is ${record.width}×${record.height}; compiled atlas page is ${page.width}×${page.height}.`,
        );
      }
      for (let frameIndex = 0; frameIndex < record.frames.length; frameIndex += 1) {
        const indexedFrame = record.frames[frameIndex];
        if (!indexedFrame) continue;
        const compiledFrame = base.metadata.frames.find((frame) => frame.frameId === indexedFrame.frameId);
        if (!compiledFrame) {
          indexedIssue(
            issues,
            "indexed-frame-missing",
            `${recordPath}.frames[${frameIndex}].frameId`,
            `Indexed frame '${indexedFrame.frameId}' does not exist in compiled spritesheet '${record.assetId}'.`,
          );
          continue;
        }
        if (
          !sameRectangle(indexedFrame.sourceRect, compiledFrame.sourceRect) ||
          !sameSize(indexedFrame.originalSize, compiledFrame.originalSize) ||
          !samePoint(indexedFrame.trimOffset, compiledFrame.trimOffset)
        ) {
          indexedIssue(
            issues,
            "indexed-frame-geometry-mismatch",
            `${recordPath}.frames[${frameIndex}]`,
            `Indexed frame '${indexedFrame.frameId}' does not match compiled atlas geometry.`,
          );
        }
      }
    }

    const palette = compiledById.get(record.defaultPalette.paletteAssetId);
    if (!palette) {
      indexedIssue(
        issues,
        "palette-missing",
        `${recordPath}.defaultPalette.paletteAssetId`,
        `Palette '${record.defaultPalette.paletteAssetId}' has no compiled asset record.`,
      );
      return;
    }
    if (palette.kind !== "palette") {
      indexedIssue(
        issues,
        "palette-kind-mismatch",
        `${recordPath}.defaultPalette.paletteAssetId`,
        `Asset '${palette.assetId}' is '${palette.kind}', not a palette.`,
      );
      return;
    }
    if (!palette.outputFiles.some((output) => output.role === "primary")) {
      indexedIssue(
        issues,
        "palette-primary-output-missing",
        `${recordPath}.defaultPalette.paletteAssetId`,
        `Palette '${palette.assetId}' has no primary runtime output.`,
      );
    }
    const resolvedMaximum = maximumResolvedIndex(record);
    if (
      (resolvedMaximum !== null && resolvedMaximum >= palette.metadata.entries) ||
      (resolvedMaximum === null && record.defaultPalette.paletteOffset >= palette.metadata.entries)
    ) {
      indexedIssue(
        issues,
        "palette-offset-overflow",
        `${recordPath}.defaultPalette.paletteOffset`,
        resolvedMaximum === null
          ? `Palette offset ${record.defaultPalette.paletteOffset} is outside palette '${palette.assetId}' entry range 0–${palette.metadata.entries - 1}.`
          : `Indexed source maximum ${record.maximumSourceIndex} plus palette offset ${record.defaultPalette.paletteOffset} resolves to ${resolvedMaximum}; palette '${palette.assetId}' contains ${palette.metadata.entries} entries.`,
      );
    }
    if (
      record.transparentIndex !== undefined &&
      record.maximumSourceIndex !== undefined &&
      record.transparentIndex > record.maximumSourceIndex
    ) {
      indexedIssue(
        issues,
        "transparent-index-overflow",
        `${recordPath}.transparentIndex`,
        `Transparent source index ${record.transparentIndex} exceeds declared maximum source index ${record.maximumSourceIndex}.`,
      );
    }
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export interface IndexedAssetRuntimeBytes {
  readonly record: IndexedAssetRecord;
  readonly indexBytes: Uint8Array;
  readonly paletteBytes: Uint8Array;
}

export interface IndexedAssetRuntimeReader {
  readIndexBytes(record: IndexedAssetRecord): Promise<Uint8Array>;
  readPaletteBytes(paletteAssetId: IndexedPaletteBinding["paletteAssetId"]): Promise<Uint8Array>;
}

const observedMaximumIndex = (indexBytes: Uint8Array): number => {
  let maximum = 0;
  for (const value of indexBytes) maximum = Math.max(maximum, value);
  return maximum;
};

export const readIndexedAssetRuntimeBytes = async (
  reader: IndexedAssetRuntimeReader,
  record: IndexedAssetRecord,
): Promise<IndexedAssetRuntimeBytes> => {
  const [indexBytes, paletteBytes] = await Promise.all([
    reader.readIndexBytes(record),
    reader.readPaletteBytes(record.defaultPalette.paletteAssetId),
  ]);
  if (indexBytes.byteLength !== record.indexByteLength) {
    throw new RangeError(
      `Indexed runtime bytes for '${record.assetId}' have length ${indexBytes.byteLength}; expected ${record.indexByteLength}.`,
    );
  }
  if (paletteBytes.byteLength % 4 !== 0 || paletteBytes.byteLength === 0 || paletteBytes.byteLength > 256 * 4) {
    throw new RangeError(
      `Palette runtime bytes for '${record.defaultPalette.paletteAssetId}' must contain 1–256 RGBA entries.`,
    );
  }
  const observedMaximum = observedMaximumIndex(indexBytes);
  if (record.maximumSourceIndex !== undefined && record.maximumSourceIndex !== observedMaximum) {
    throw new RangeError(
      `Indexed runtime bytes for '${record.assetId}' have maximum source index ${observedMaximum}; sidecar declares ${record.maximumSourceIndex}.`,
    );
  }
  const entries = paletteBytes.byteLength / 4;
  if (observedMaximum + record.defaultPalette.paletteOffset >= entries) {
    throw new RangeError(
      `Indexed runtime bytes for '${record.assetId}' use source index ${observedMaximum}; offset ${record.defaultPalette.paletteOffset} exceeds ${entries} palette entries.`,
    );
  }
  return { record, indexBytes, paletteBytes };
};
