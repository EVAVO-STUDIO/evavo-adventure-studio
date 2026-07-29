import type { BitmapFontManifest } from "./index.js";
import {
  createBitmapFontResolver,
  type BitmapFontResolver,
} from "./render.js";

const resolversByAssetCollection = new WeakMap<object, BitmapFontResolver>();

export const registerBitmapFontsForAssetCollection = (
  assetCollection: object,
  manifest: BitmapFontManifest,
): BitmapFontResolver => {
  const resolver = createBitmapFontResolver(manifest);
  resolversByAssetCollection.set(assetCollection, resolver);
  return resolver;
};

export const bitmapFontResolverForAssetCollection = (
  assetCollection: object,
): BitmapFontResolver | null =>
  resolversByAssetCollection.get(assetCollection) ?? null;
