import type { IndexedAssetRecord } from "@evavo/adventure-asset-contract/indexed-assets";
import type { Id } from "@evavo/adventure-project-schema";
import type { Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { PixiIndexedTextureCache } from "../src/indexed-texture-cache.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const record: IndexedAssetRecord = {
  assetId: asId<"asset">("asset.actor"),
  width: 2,
  height: 2,
  indexRuntimePath: "indexed/actor.idx",
  indexSha256: "a".repeat(64),
  indexByteLength: 4,
  transparentIndex: 0,
  defaultPalette: {
    paletteAssetId: asId<"asset">("asset.palette.base"),
    paletteOffset: 0,
  },
  frames: [],
};

const fallback = {
  getTexture: () => null,
};

const fakeTexture = (key: string): Texture => ({ key }) as unknown as Texture;

const preparedCache = (created: string[] = []) => {
  const cache = new PixiIndexedTextureCache(
    ({ cacheKey }) => {
      created.push(cacheKey);
      return fakeTexture(cacheKey);
    },
    fallback,
  );
  cache.registerIndexMap(record, new Uint8Array([1, 1, 1, 1]));
  cache.registerPalette(
    asId<"asset">("asset.palette.base"),
    new Uint8Array([0, 0, 0, 0, 10, 20, 30, 255]),
  );
  cache.registerPalette(
    asId<"asset">("asset.palette.warm"),
    new Uint8Array([0, 0, 0, 0, 200, 180, 140, 255]),
  );
  return cache;
};

describe("indexed texture cache", () => {
  it("reuses deterministic textures for identical indexed palette requests", () => {
    const created: string[] = [];
    const cache = preparedCache(created);
    const first = cache.getIndexedTexture(record.assetId, record.defaultPalette.paletteAssetId, 0);
    const second = cache.getIndexedTexture(record.assetId, record.defaultPalette.paletteAssetId, 0);
    expect(first).toBe(second);
    expect(created).toHaveLength(1);
  });

  it("creates a distinct cached texture for an ordered palette transition", () => {
    const created: { readonly key: string; readonly rgba: readonly number[] }[] = [];
    const cache = new PixiIndexedTextureCache(
      ({ cacheKey, rgba }) => {
        created.push({ key: cacheKey, rgba: [...rgba] });
        return fakeTexture(cacheKey);
      },
      fallback,
    );
    cache.registerIndexMap(record, new Uint8Array([1, 1, 1, 1]));
    cache.registerPalette(
      asId<"asset">("asset.palette.base"),
      new Uint8Array([0, 0, 0, 0, 10, 20, 30, 255]),
    );
    cache.registerPalette(
      asId<"asset">("asset.palette.warm"),
      new Uint8Array([0, 0, 0, 0, 200, 180, 140, 255]),
    );

    const texture = cache.getIndexedDitherTexture(
      record.assetId,
      record.defaultPalette.paletteAssetId,
      0,
      {
        targetPaletteAssetId: asId<"asset">("asset.palette.warm"),
        targetPaletteOffset: 0,
        coverage: 0.5,
        matrix: "bayer-2",
        origin: { x: 0, y: 0 },
      },
    );
    expect(texture).not.toBeNull();
    expect(created).toHaveLength(1);
    const colours = new Set<string>();
    const rgba = created[0]?.rgba ?? [];
    for (let offset = 0; offset < rgba.length; offset += 4) {
      colours.add(`${rgba[offset]},${rgba[offset + 1]},${rgba[offset + 2]},${rgba[offset + 3]}`);
    }
    expect(colours).toEqual(new Set(["10,20,30,255", "200,180,140,255"]));
  });

  it("reuses one cached texture for raw coverages in the same Bayer-4 visual state", () => {
    const created: string[] = [];
    const cache = preparedCache(created);
    const transition = (coverage: number) => ({
      targetPaletteAssetId: asId<"asset">("asset.palette.warm"),
      targetPaletteOffset: 0,
      coverage,
      matrix: "bayer-4" as const,
      origin: { x: 0, y: 0 },
    });
    const first = cache.getIndexedDitherTexture(
      record.assetId,
      record.defaultPalette.paletteAssetId,
      0,
      transition(0.49),
    );
    const second = cache.getIndexedDitherTexture(
      record.assetId,
      record.defaultPalette.paletteAssetId,
      0,
      transition(0.51),
    );
    expect(first).toBe(second);
    expect(created).toHaveLength(1);
  });

  it("invalidates resolved textures when source index data is replaced", () => {
    let creations = 0;
    const cache = new PixiIndexedTextureCache(
      ({ cacheKey }) => {
        creations += 1;
        return fakeTexture(`${cacheKey}:${creations}`);
      },
      fallback,
    );
    cache.registerIndexMap(record, new Uint8Array([1, 1, 1, 1]));
    cache.registerPalette(
      asId<"asset">("asset.palette.base"),
      new Uint8Array([0, 0, 0, 0, 10, 20, 30, 255]),
    );
    const first = cache.getIndexedTexture(record.assetId, record.defaultPalette.paletteAssetId, 0);
    cache.registerIndexMap(record, new Uint8Array([0, 1, 0, 1]));
    const second = cache.getIndexedTexture(record.assetId, record.defaultPalette.paletteAssetId, 0);
    expect(second).not.toBe(first);
    expect(creations).toBe(2);
  });

  it("returns null until both the index map and requested palette are registered", () => {
    const cache = new PixiIndexedTextureCache(() => fakeTexture("unused"), fallback);
    expect(
      cache.getIndexedTexture(
        asId<"asset">("asset.missing"),
        asId<"asset">("asset.palette.missing"),
        0,
      ),
    ).toBeNull();
  });
});
