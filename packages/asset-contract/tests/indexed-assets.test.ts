import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "../src/index.js";
import {
  indexedAssetById,
  parseIndexedAssetManifest,
  readIndexedAssetRuntimeBytes,
  validateIndexedAssetManifest,
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

const compiledFixture = () =>
  assetBuildManifestSchema.parse({
    manifestVersion: 1,
    projectId: "project.indexed-test",
    compilerVersion: "test",
    fingerprint: hash,
    assets: [
      {
        assetId: "asset.actor.index-map",
        kind: "spritesheet",
        sourceFiles: [{ path: "art/actor.aseprite", sha256: hash, byteLength: 8 }],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: "assets/actor/atlas.json",
            mediaType: "application/json",
            sha256: hash,
            byteLength: 16,
          },
          {
            role: "page-000",
            runtimePath: "assets/actor/page-000.png",
            mediaType: "image/png",
            sha256: hash,
            byteLength: 32,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 4, height: 2 }],
          frames: [
            {
              frameId: "frame.actor.idle",
              pageOutputRole: "page-000",
              sourceRect: { x: 0, y: 0, width: 2, height: 2 },
              originalSize: { width: 3, height: 3 },
              trimOffset: { x: 1, y: 1 },
              padding: 0,
            },
          ],
        },
      },
      {
        assetId: "asset.palette.actor",
        kind: "palette",
        sourceFiles: [{ path: "art/actor.pal", sha256: hash, byteLength: 128 }],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/actor.rgba",
            mediaType: "application/octet-stream",
            sha256: hash,
            byteLength: 128,
          },
        ],
        metadata: {
          kind: "palette",
          entries: 32,
          transparentIndex: 0,
        },
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

  it("cross-validates source geometry and palette identity against compiled assets", () => {
    const indexed = parseIndexedAssetManifest(fixture());
    expect(
      validateIndexedAssetManifest(
        { id: "project.indexed-test" },
        compiledFixture(),
        indexed,
      ),
    ).toEqual([]);
  });

  it("rejects index-map dimensions that drift from the compiled atlas page", () => {
    const indexed = parseIndexedAssetManifest({
      ...fixture(),
      assets: [{ ...fixture().assets[0]!, width: 8, indexByteLength: 16 }],
    });
    expect(validateIndexedAssetManifest({ id: "project.indexed-test" }, compiledFixture(), indexed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "asset-dimension-mismatch" })]),
    );
  });

  it("rejects multi-page indexed spritesheets until the sidecar models page identity", () => {
    const compiled = compiledFixture();
    const actor = compiled.assets[0]!;
    if (actor.kind !== "spritesheet") throw new Error("fixture must be a spritesheet");
    const multiPage = {
      ...compiled,
      assets: [
        {
          ...actor,
          metadata: {
            ...actor.metadata,
            pages: [
              ...actor.metadata.pages,
              { outputRole: "page-001", width: 4, height: 2 },
            ],
          },
        },
        compiled.assets[1]!,
      ],
    } as typeof compiled;
    expect(
      validateIndexedAssetManifest(
        { id: "project.indexed-test" },
        multiPage,
        parseIndexedAssetManifest(fixture()),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "spritesheet-page-count-unsupported" }),
      ]),
    );
  });

  it("rejects indexed frame metadata that drifts from compiled atlas geometry", () => {
    const indexed = parseIndexedAssetManifest({
      ...fixture(),
      assets: [
        {
          ...fixture().assets[0]!,
          frames: [
            {
              ...fixture().assets[0]!.frames[0]!,
              trimOffset: { x: 0, y: 0 },
            },
          ],
        },
      ],
    });
    expect(validateIndexedAssetManifest({ id: "project.indexed-test" }, compiledFixture(), indexed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "indexed-frame-geometry-mismatch" }),
      ]),
    );
  });

  it("rejects missing palettes, wrong palette kinds and overflowing palette offsets", () => {
    const indexed = parseIndexedAssetManifest(fixture());
    const compiled = compiledFixture();

    const missingPalette = {
      ...compiled,
      assets: compiled.assets.filter((asset) => asset.assetId !== "asset.palette.actor"),
    };
    expect(validateIndexedAssetManifest({ id: "project.indexed-test" }, missingPalette, indexed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "palette-missing" })]),
    );

    const wrongPaletteKind = {
      ...compiled,
      assets: compiled.assets.map((asset) =>
        asset.assetId === "asset.palette.actor"
          ? {
              ...compiled.assets.find((candidate) => candidate.assetId === "asset.actor.index-map")!,
              assetId: "asset.palette.actor",
            }
          : asset,
      ),
    } as typeof compiled;
    expect(validateIndexedAssetManifest({ id: "project.indexed-test" }, wrongPaletteKind, indexed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "palette-kind-mismatch" })]),
    );

    const overflowing = parseIndexedAssetManifest({
      ...fixture(),
      assets: [
        {
          ...fixture().assets[0]!,
          defaultPalette: {
            paletteAssetId: "asset.palette.actor",
            paletteOffset: 32,
          },
        },
      ],
    });
    expect(validateIndexedAssetManifest({ id: "project.indexed-test" }, compiled, overflowing)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "palette-offset-overflow" })]),
    );
  });

  it("reads exact runtime index/palette bytes and rejects source indices outside the palette window", async () => {
    const record = parseIndexedAssetManifest(fixture()).assets[0]!;
    const loaded = await readIndexedAssetRuntimeBytes(
      {
        readIndexBytes: async () => new Uint8Array(8),
        readPaletteBytes: async () => new Uint8Array(32 * 4),
      },
      record,
    );
    expect(loaded.indexBytes.byteLength).toBe(8);
    expect(loaded.paletteBytes.byteLength).toBe(128);

    await expect(
      readIndexedAssetRuntimeBytes(
        {
          readIndexBytes: async () => new Uint8Array(7),
          readPaletteBytes: async () => new Uint8Array(32 * 4),
        },
        record,
      ),
    ).rejects.toThrow(/expected 8/u);

    await expect(
      readIndexedAssetRuntimeBytes(
        {
          readIndexBytes: async () => new Uint8Array(8),
          readPaletteBytes: async () => new Uint8Array(7),
        },
        record,
      ),
    ).rejects.toThrow(/RGBA entries/u);

    await expect(
      readIndexedAssetRuntimeBytes(
        {
          readIndexBytes: async () => new Uint8Array(8).fill(31),
          readPaletteBytes: async () => new Uint8Array(32 * 4),
        },
        record,
      ),
    ).rejects.toThrow(/source index 31/u);
  });
});
