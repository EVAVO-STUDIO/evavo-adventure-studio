import {
  type CompiledAssetRecord,
  type CompiledSourceFile,
  compiledAssetRecordSchema,
} from "@evavo/adventure-asset-contract";
import type { Asset, Id } from "@evavo/adventure-project-schema";
import { sha256Hex } from "./index.js";

export interface CompiledPalette {
  readonly data: Uint8Array;
  readonly entries: number;
  readonly transparentIndex?: number;
  readonly sha256: string;
}

export const compileRgbaPalette = async (
  input: Uint8Array,
  transparentIndex?: number,
): Promise<CompiledPalette> => {
  if (input.byteLength === 0 || input.byteLength % 4 !== 0) {
    throw new RangeError("Palette source must contain complete RGBA quads.");
  }
  const entries = input.byteLength / 4;
  if (entries < 1 || entries > 256) {
    throw new RangeError("Palette source must contain from 1 to 256 RGBA entries.");
  }
  if (
    transparentIndex !== undefined &&
    (!Number.isSafeInteger(transparentIndex) || transparentIndex < 0 || transparentIndex >= entries)
  ) {
    throw new RangeError(`Transparent palette index must be from 0 to ${entries - 1}.`);
  }
  const data = new Uint8Array(input);
  const sha256 = await sha256Hex(data);
  return {
    data,
    entries,
    ...(transparentIndex === undefined ? {} : { transparentIndex }),
    sha256,
  };
};

export interface PaletteAssetRecordOptions {
  readonly sourceFiles: readonly CompiledSourceFile[];
  readonly runtimePath: string;
}

export const createPaletteAssetRecord = (
  asset: Asset,
  compiled: CompiledPalette,
  options: PaletteAssetRecordOptions,
): Extract<CompiledAssetRecord, { readonly kind: "palette" }> => {
  if (asset.kind !== "palette") {
    throw new TypeError(`Asset '${asset.id}' has kind '${asset.kind}', expected 'palette'.`);
  }
  if (options.sourceFiles.length === 0) {
    throw new RangeError(`Palette asset '${asset.id}' requires at least one source file.`);
  }
  return compiledAssetRecordSchema.parse({
    assetId: asset.id as Id<"asset">,
    kind: "palette",
    sourceFiles: [...options.sourceFiles],
    outputFiles: [
      {
        role: "primary",
        runtimePath: options.runtimePath,
        mediaType: "application/octet-stream",
        sha256: compiled.sha256,
        byteLength: compiled.data.byteLength,
      },
    ],
    metadata: {
      kind: "palette",
      entries: compiled.entries,
      ...(compiled.transparentIndex === undefined
        ? {}
        : { transparentIndex: compiled.transparentIndex }),
    },
  }) as Extract<CompiledAssetRecord, { readonly kind: "palette" }>;
};
