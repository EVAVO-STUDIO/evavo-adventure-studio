import { createBitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import {
  type PixiRendererOptions,
  type PixiTextureResolver,
  PixiWebGLRenderer,
  pixelPresentationPolicyForProfile,
} from "@evavo/adventure-renderer-pixi";
import { PixiIndexedWebGLRenderer } from "@evavo/adventure-renderer-pixi/indexed-renderer";
import type { PixiIndexedTextureCache } from "@evavo/adventure-renderer-pixi/indexed-texture-cache";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const createPackagedRendererOptions = (
  bundle: Pick<RuntimeBundle, "bitmapFonts" | "presentation">,
  textures: PixiTextureResolver,
): PixiRendererOptions => ({
  textures,
  pixelPresentation: pixelPresentationPolicyForProfile(bundle.presentation),
  ...(bundle.bitmapFonts ? { bitmapFonts: createBitmapFontResolver(bundle.bitmapFonts) } : {}),
});

export const createPackagedRuntimeRenderer = (
  bundle: RuntimeBundle,
  textures: PixiAssetTextureStore,
  indexedTextures: PixiIndexedTextureCache | null = null,
): PixiWebGLRenderer => {
  const options = createPackagedRendererOptions(bundle, indexedTextures ?? textures);
  if (!bundle.indexedAssets || bundle.indexedAssets.assets.length === 0) {
    return new PixiWebGLRenderer(options);
  }
  if (!indexedTextures) {
    throw new Error("Runtime bundle declares indexed assets but no verified indexed texture cache was loaded.");
  }
  return new PixiIndexedWebGLRenderer({
    ...options,
    textures: indexedTextures,
  });
};
