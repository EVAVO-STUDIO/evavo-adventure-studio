import { describe, expect, it } from "vitest";
import {
  compileIndexMap,
  createIndexedAssetSidecarRecord,
} from "../src/index-map-compiler.js";

const imageAsset = {
  id: "asset.actor.test",
  path: "art/actor/test.png",
  kind: "image" as const,
};

describe("indexed map compiler", () => {
  it("compiles one immutable byte per native pixel with deterministic hashing and source-index bounds", async () => {
    const source = new Uint8Array([
      0, 1, 2, 3,
      4, 5, 6, 7,
    ]);
    const original = [...source];
    const first = await compileIndexMap(source, 4, 2);
    const second = await compileIndexMap(source, 4, 2);

    expect(first).toMatchObject({ width: 4, height: 2, maximumSourceIndex: 7 });
    expect(first.data.byteLength).toBe(8);
    expect(first.sha256).toBe(second.sha256);
    expect(first.data).not.toBe(source);
    expect([...first.data]).toEqual(original);
    expect([...source]).toEqual(original);
  });

  it("finds the actual highest used index rather than assuming a 256-colour surface", async () => {
    const compiled = await compileIndexMap(new Uint8Array([0, 0, 3, 0]), 2, 2);
    expect(compiled.maximumSourceIndex).toBe(3);
  });

  it("rejects invalid dimensions and byte-count mismatches", async () => {
    await expect(compileIndexMap(new Uint8Array(8), 0, 2)).rejects.toThrow(/positive safe integers/u);
    await expect(compileIndexMap(new Uint8Array(7), 4, 2)).rejects.toThrow(/expected exactly 8/u);
  });

  it("creates a schema-validated indexed sidecar record with maximum source index", async () => {
    const compiled = await compileIndexMap(new Uint8Array([0, 1, 2, 3, 0, 1, 2, 3]), 4, 2);
    const record = createIndexedAssetSidecarRecord(imageAsset as never, compiled, {
      runtimePath: "assets/actor/test.idx",
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.actor",
        paletteOffset: 8,
      },
      frames: [
        {
          frameId: "frame.actor.test",
          sourceRect: { x: 0, y: 0, width: 2, height: 2 },
          originalSize: { width: 3, height: 3 },
          trimOffset: { x: 1, y: 1 },
        },
      ],
    });

    expect(record).toMatchObject({
      assetId: "asset.actor.test",
      width: 4,
      height: 2,
      indexRuntimePath: "assets/actor/test.idx",
      indexByteLength: 8,
      maximumSourceIndex: 3,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.actor",
        paletteOffset: 8,
      },
    });
    expect(record.indexSha256).toBe(compiled.sha256);
  });

  it("rejects invalid frame geometry and non-renderable source kinds", async () => {
    const compiled = await compileIndexMap(new Uint8Array(8), 4, 2);
    expect(() =>
      createIndexedAssetSidecarRecord(imageAsset as never, compiled, {
        runtimePath: "assets/actor/test.idx",
        defaultPalette: { paletteAssetId: "asset.palette.actor", paletteOffset: 0 },
        frames: [
          {
            frameId: "frame.actor.bad",
            sourceRect: { x: 3, y: 0, width: 2, height: 2 },
            originalSize: { width: 2, height: 2 },
            trimOffset: { x: 0, y: 0 },
          },
        ],
      }),
    ).toThrow(/exceeds the 4×2 index map/u);

    expect(() =>
      createIndexedAssetSidecarRecord(
        { id: "asset.audio.test", path: "audio/test.wav", kind: "audio" } as never,
        compiled,
        {
          runtimePath: "assets/audio/test.idx",
          defaultPalette: { paletteAssetId: "asset.palette.actor", paletteOffset: 0 },
        },
      ),
    ).toThrow(/expected image or spritesheet/u);
  });
});
