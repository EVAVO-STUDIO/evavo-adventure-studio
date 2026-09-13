import type {
  IndexedAssetRuntimeBytes,
  IndexedFrame,
} from "@evavo/adventure-asset-contract/indexed-assets";
import { expandIndexedPixels } from "./indexed-pixels.js";

export interface ResolvedIndexedRgbaSurface {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly paletteOffset: number;
}

const resolvedOffset = (
  bytes: IndexedAssetRuntimeBytes,
  paletteOffset: number | undefined,
): number => paletteOffset ?? bytes.record.defaultPalette.paletteOffset;

export const resolveIndexedRuntimeSurface = (
  bytes: IndexedAssetRuntimeBytes,
  paletteOffset?: number,
): ResolvedIndexedRgbaSurface => {
  const offset = resolvedOffset(bytes, paletteOffset);
  return {
    width: bytes.record.width,
    height: bytes.record.height,
    rgba: expandIndexedPixels(
      {
        width: bytes.record.width,
        height: bytes.record.height,
        indices: bytes.indexBytes,
      },
      {
        entries: bytes.paletteBytes,
        transparentIndex: bytes.record.transparentIndex ?? null,
      },
      offset,
    ),
    paletteOffset: offset,
  };
};

const frameById = (
  bytes: IndexedAssetRuntimeBytes,
  frameId: string,
): IndexedFrame => {
  const frame = bytes.record.frames.find((candidate) => candidate.frameId === frameId);
  if (!frame) {
    throw new Error(`Indexed asset '${bytes.record.assetId}' has no frame '${frameId}'.`);
  }
  return frame;
};

const cropIndices = (
  bytes: IndexedAssetRuntimeBytes,
  frame: IndexedFrame,
): Uint8Array => {
  const { sourceRect } = frame;
  const output = new Uint8Array(sourceRect.width * sourceRect.height);
  for (let row = 0; row < sourceRect.height; row += 1) {
    const sourceStart = (sourceRect.y + row) * bytes.record.width + sourceRect.x;
    const sourceEnd = sourceStart + sourceRect.width;
    output.set(bytes.indexBytes.subarray(sourceStart, sourceEnd), row * sourceRect.width);
  }
  return output;
};

export const resolveIndexedRuntimeFrame = (
  bytes: IndexedAssetRuntimeBytes,
  frameId: string,
  paletteOffset?: number,
): ResolvedIndexedRgbaSurface & {
  readonly frame: IndexedFrame;
} => {
  const frame = frameById(bytes, frameId);
  const offset = resolvedOffset(bytes, paletteOffset);
  return {
    frame,
    width: frame.sourceRect.width,
    height: frame.sourceRect.height,
    rgba: expandIndexedPixels(
      {
        width: frame.sourceRect.width,
        height: frame.sourceRect.height,
        indices: cropIndices(bytes, frame),
      },
      {
        entries: bytes.paletteBytes,
        transparentIndex: bytes.record.transparentIndex ?? null,
      },
      offset,
    ),
    paletteOffset: offset,
  };
};
