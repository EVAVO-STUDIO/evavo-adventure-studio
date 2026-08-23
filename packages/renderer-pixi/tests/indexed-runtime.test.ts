import { describe, expect, it } from "vitest";
import type { IndexedAssetRuntimeBytes } from "@evavo/adventure-asset-contract/indexed-assets";
import {
  resolveIndexedRuntimeFrame,
  resolveIndexedRuntimeSurface,
} from "../src/indexed-runtime.js";

const runtimeBytes = (): IndexedAssetRuntimeBytes => {
  const palette = new Uint8Array(32 * 4);
  for (let index = 0; index < 32; index += 1) {
    palette[index * 4] = index;
    palette[index * 4 + 1] = 255 - index;
    palette[index * 4 + 2] = index * 2;
    palette[index * 4 + 3] = 255;
  }
  return {
    record: {
      assetId: "asset.actor.index-map",
      width: 4,
      height: 2,
      indexRuntimePath: "assets/actor/index.bin",
      indexSha256: "a".repeat(64),
      indexByteLength: 8,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.actor",
        paletteOffset: 16,
      },
      frames: [
        {
          frameId: "frame.actor.right",
          sourceRect: { x: 2, y: 0, width: 2, height: 2 },
          originalSize: { width: 3, height: 3 },
          trimOffset: { x: 1, y: 1 },
        },
      ],
    },
    indexBytes: new Uint8Array([
      0, 1, 2, 3,
      4, 5, 6, 7,
    ]),
    paletteBytes: palette,
  };
};

describe("indexed runtime bridge", () => {
  it("resolves the full surface using the authored default palette offset", () => {
    const surface = resolveIndexedRuntimeSurface(runtimeBytes());
    expect(surface).toMatchObject({ width: 4, height: 2, paletteOffset: 16 });
    expect(surface.rgba.byteLength).toBe(4 * 2 * 4);
    expect([...surface.rgba.slice(0, 4)]).toEqual([16, 239, 32, 0]);
    expect([...surface.rgba.slice(4, 8)]).toEqual([17, 238, 34, 255]);
  });

  it("supports a palette-offset override without mutating source indices", () => {
    const bytes = runtimeBytes();
    const original = [...bytes.indexBytes];
    const defaultSurface = resolveIndexedRuntimeSurface(bytes);
    const alternateSurface = resolveIndexedRuntimeSurface(bytes, 8);

    expect([...bytes.indexBytes]).toEqual(original);
    expect(alternateSurface.paletteOffset).toBe(8);
    expect([...alternateSurface.rgba.slice(4, 8)]).toEqual([9, 246, 18, 255]);
    expect([...alternateSurface.rgba]).not.toEqual([...defaultSurface.rgba]);
  });

  it("crops indexed frames before palette expansion", () => {
    const frame = resolveIndexedRuntimeFrame(runtimeBytes(), "frame.actor.right");
    expect(frame.width).toBe(2);
    expect(frame.height).toBe(2);
    expect(frame.frame.sourceRect).toEqual({ x: 2, y: 0, width: 2, height: 2 });
    expect(frame.rgba.byteLength).toBe(16);
    expect([...frame.rgba.slice(0, 4)]).toEqual([18, 237, 36, 255]);
    expect([...frame.rgba.slice(8, 12)]).toEqual([22, 233, 44, 255]);
  });

  it("fails closed for unknown frame ids", () => {
    expect(() => resolveIndexedRuntimeFrame(runtimeBytes(), "frame.missing")).toThrow(
      /has no frame 'frame\.missing'/u,
    );
  });
});
