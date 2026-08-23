import {
  type IndexedAssetRecord,
  type IndexedFrame,
  type IndexedPaletteBinding,
  indexedAssetRecordSchema,
} from "@evavo/adventure-asset-contract/indexed-assets";
import type { Asset, Id } from "@evavo/adventure-project-schema";
import { sha256Hex } from "./index.js";

export interface CompiledIndexMap {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export const compileIndexMap = async (
  input: Uint8Array,
  width: number,
  height: number,
): Promise<CompiledIndexMap> => {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError("Indexed map dimensions must be positive safe integers.");
  }
  const expectedLength = width * height;
  if (input.byteLength !== expectedLength) {
    throw new RangeError(
      `Indexed map contains ${input.byteLength} bytes; expected exactly ${expectedLength} for ${width}×${height}.`,
    );
  }
  const data = new Uint8Array(input);
  return {
    data,
    width,
    height,
    sha256: await sha256Hex(data),
  };
};

export interface IndexedAssetSidecarRecordOptions {
  readonly runtimePath: string;
  readonly defaultPalette: IndexedPaletteBinding;
  readonly transparentIndex?: number;
  readonly frames?: readonly IndexedFrame[];
}

export const createIndexedAssetSidecarRecord = (
  asset: Asset,
  compiled: CompiledIndexMap,
  options: IndexedAssetSidecarRecordOptions,
): IndexedAssetRecord => {
  if (asset.kind !== "image" && asset.kind !== "spritesheet") {
    throw new TypeError(
      `Indexed sidecar source '${asset.id}' has kind '${asset.kind}', expected image or spritesheet.`,
    );
  }
  if (!options.runtimePath.trim()) {
    throw new RangeError(`Indexed sidecar source '${asset.id}' requires a runtime path.`);
  }
  return indexedAssetRecordSchema.parse({
    assetId: asset.id as Id<"asset">,
    width: compiled.width,
    height: compiled.height,
    indexRuntimePath: options.runtimePath,
    indexSha256: compiled.sha256,
    indexByteLength: compiled.data.byteLength,
    ...(options.transparentIndex === undefined ? {} : { transparentIndex: options.transparentIndex }),
    defaultPalette: options.defaultPalette,
    frames: [...(options.frames ?? [])],
  });
};
