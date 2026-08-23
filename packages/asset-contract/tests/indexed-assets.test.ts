import { describe, expect, it } from "vitest";
import {
  indexedAssetById,
  parseIndexedAssetManifest,
} from "../src/indexed-assets.js";

const hash = "a".repeat(64);

const fixture = () => ({
  manifestVersion: 1 as const,
  projectId: "project.indexed-test",
  assets: [
    {
      assetId: "asset.actor.index-map",
      width: 4,
      height: 2,
      indexRuntimePath: "assets/actor/index.bin",
      indexSha256: hash,
      indexByteLength: 8,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.actor",
        paletteOffset: 16,
      },
      frames: [
        {
          frameId: "frame.actor.idle",
          sourceRect: { x: 0, y: 0, width: 2, height: 2 },
          originalSize: { width: 3, height: 3 },
          trimOffset: { x: 1, y: 1 },
        },
      ],
    },
  ],
});

describe("indexed asset sidecar", () => {
  it("parses exact one-byte-per-pixel index maps with palette bindings", () => {
    const manifest = parseIndexedAssetManifest(fixture());
    const record = indexedAssetById(manifest, "asset.actor.index-map");
    expect(record).toMatchObject({
      width: 4,
      height: 2,
      indexByteLength: 8,
      transparentIndex: 0,
      defaultPalette: {
        paletteAssetId: "asset.palette.actor",
        paletteOffset: 16,
      },
    });
  });

  it("rejects byte counts that do not match native index-map dimensions", () => {
    const malformed = fixture();
    malformed.assets[0]!.indexByteLength = 7;
    expect(() => parseIndexedAssetManifest(malformed)).toThrow(/exactly 8 bytes/u);
  });

  it("rejects frame rectangles outside the index map", () => {
    const malformed = fixture();
    malformed.assets[0]!.frames[0]!.sourceRect = { x: 3, y: 0, width: 2, height: 2 };
    expect(() => parseIndexedAssetManifest(malformed)).toThrow(/exceeds the 4×2 index map/u);
  });

  it("rejects duplicate asset ids and duplicate runtime paths", () => {
    const malformed = fixture();
    malformed.assets.push({ ...malformed.assets[0]! });
    expect(() => parseIndexedAssetManifest(malformed)).toThrow();
  });

  it("rejects palette offsets and transparent indices outside byte range", () => {
    const malformedPalette = fixture();
    malformedPalette.assets[0]!.defaultPalette.paletteOffset = 256;
    expect(() => parseIndexedAssetManifest(malformedPalette)).toThrow();

    const malformedTransparency = fixture();
    malformedTransparency.assets[0]!.transparentIndex = 256;
    expect(() => parseIndexedAssetManifest(malformedTransparency)).toThrow();
  });
});
