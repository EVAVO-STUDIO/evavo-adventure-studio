import type { IndexedAssetRecord } from "@evavo/adventure-asset-contract/indexed-assets";
import type { Id } from "@evavo/adventure-project-schema";
import type { IndexedPaletteDitherTransition } from "@evavo/adventure-render-contract";
import type { Texture } from "pixi.js";
import { expandDitheredIndexedPixels } from "./indexed-dither.js";
import { expandIndexedPixels } from "./indexed-pixels.js";
import type { PixiIndexedTextureResolver } from "./indexed-renderer.js";

export interface IndexedTextureFactoryInput {
  readonly cacheKey: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export type IndexedTextureFactory = (input: IndexedTextureFactoryInput) => Texture;

interface RegisteredIndexMap {
  readonly record: IndexedAssetRecord;
  readonly indices: Uint8Array;
}

interface RegisteredPalette {
  readonly entries: Uint8Array;
}

const assetKey = (assetId: Id<"asset">): string => assetId as string;

const assertIndexBytes = (record: IndexedAssetRecord, indices: Uint8Array): Uint8Array => {
  if (indices.byteLength !== record.indexByteLength) {
    throw new RangeError(
      `Indexed asset '${record.assetId}' has ${indices.byteLength} runtime bytes; expected ${record.indexByteLength}.`,
    );
  }
  return new Uint8Array(indices);
};

const assertPaletteBytes = (assetId: Id<"asset">, entries: Uint8Array): Uint8Array => {
  if (entries.byteLength === 0 || entries.byteLength % 4 !== 0) {
    throw new RangeError(`Palette '${assetId}' must contain complete RGBA quads.`);
  }
  if (entries.byteLength / 4 > 256) {
    throw new RangeError(`Palette '${assetId}' exceeds 256 RGBA entries.`);
  }
  return new Uint8Array(entries);
};

const ditherKey = (transition: IndexedPaletteDitherTransition): string =>
  [
    transition.targetPaletteAssetId,
    transition.targetPaletteOffset,
    transition.coverage.toFixed(6),
    transition.matrix,
    Math.floor(transition.origin.x),
    Math.floor(transition.origin.y),
  ].join(":");

export class PixiIndexedTextureCache implements PixiIndexedTextureResolver {
  private readonly textureFactory: IndexedTextureFactory;
  private readonly fallbackTextureResolver: PixiIndexedTextureResolver;
  private readonly indexMaps = new Map<string, RegisteredIndexMap>();
  private readonly palettes = new Map<string, RegisteredPalette>();
  private readonly textures = new Map<string, Texture>();

  constructor(
    textureFactory: IndexedTextureFactory,
    fallbackTextureResolver: PixiIndexedTextureResolver,
  ) {
    this.textureFactory = textureFactory;
    this.fallbackTextureResolver = fallbackTextureResolver;
  }

  getBitmapFontResolver() {
    return this.fallbackTextureResolver.getBitmapFontResolver?.() ?? null;
  }

  getTexture(assetId: Id<"asset">, frameId: Id<"sprite-frame"> | null = null): Texture | null {
    return this.fallbackTextureResolver.getTexture(assetId, frameId);
  }

  registerIndexMap(record: IndexedAssetRecord, indices: Uint8Array): void {
    this.indexMaps.set(assetKey(record.assetId), {
      record,
      indices: assertIndexBytes(record, indices),
    });
    this.clearResolvedTextures();
  }

  registerPalette(assetId: Id<"asset">, entries: Uint8Array): void {
    this.palettes.set(assetKey(assetId), { entries: assertPaletteBytes(assetId, entries) });
    this.clearResolvedTextures();
  }

  hasIndexMap(assetId: Id<"asset">): boolean {
    return this.indexMaps.has(assetKey(assetId));
  }

  hasPalette(assetId: Id<"asset">): boolean {
    return this.palettes.has(assetKey(assetId));
  }

  getIndexedTexture(
    indexAssetId: Id<"asset">,
    paletteAssetId: Id<"asset">,
    paletteOffset: number,
  ): Texture | null {
    const indexMap = this.indexMaps.get(assetKey(indexAssetId));
    const palette = this.palettes.get(assetKey(paletteAssetId));
    if (!indexMap || !palette) return null;
    const cacheKey = `indexed|${indexAssetId}|${paletteAssetId}|${paletteOffset}`;
    const cached = this.textures.get(cacheKey);
    if (cached) return cached;
    const rgba = expandIndexedPixels(
      {
        width: indexMap.record.width,
        height: indexMap.record.height,
        indices: indexMap.indices,
      },
      {
        entries: palette.entries,
        transparentIndex: indexMap.record.transparentIndex ?? null,
      },
      paletteOffset,
    );
    const texture = this.textureFactory({
      cacheKey,
      width: indexMap.record.width,
      height: indexMap.record.height,
      rgba,
    });
    this.textures.set(cacheKey, texture);
    return texture;
  }

  getIndexedDitherTexture(
    indexAssetId: Id<"asset">,
    paletteAssetId: Id<"asset">,
    paletteOffset: number,
    transition: IndexedPaletteDitherTransition,
  ): Texture | null {
    const indexMap = this.indexMaps.get(assetKey(indexAssetId));
    const basePalette = this.palettes.get(assetKey(paletteAssetId));
    const targetPalette = this.palettes.get(assetKey(transition.targetPaletteAssetId));
    if (!indexMap || !basePalette || !targetPalette) return null;
    const cacheKey = `dither|${indexAssetId}|${paletteAssetId}|${paletteOffset}|${ditherKey(transition)}`;
    const cached = this.textures.get(cacheKey);
    if (cached) return cached;
    const rgba = expandDitheredIndexedPixels(
      {
        width: indexMap.record.width,
        height: indexMap.record.height,
        indices: indexMap.indices,
      },
      {
        entries: basePalette.entries,
        transparentIndex: indexMap.record.transparentIndex ?? null,
      },
      {
        entries: targetPalette.entries,
        transparentIndex: indexMap.record.transparentIndex ?? null,
      },
      {
        basePaletteOffset: paletteOffset,
        targetPaletteOffset: transition.targetPaletteOffset,
        coverage: transition.coverage,
        matrix: transition.matrix,
        originX: transition.origin.x,
        originY: transition.origin.y,
      },
    );
    const texture = this.textureFactory({
      cacheKey,
      width: indexMap.record.width,
      height: indexMap.record.height,
      rgba,
    });
    this.textures.set(cacheKey, texture);
    return texture;
  }

  clearResolvedTextures(destroy?: (texture: Texture) => void): void {
    if (destroy) {
      for (const texture of this.textures.values()) destroy(texture);
    }
    this.textures.clear();
  }
}
