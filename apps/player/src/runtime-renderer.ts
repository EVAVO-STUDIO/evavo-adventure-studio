import { createBitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import { PixiWebGLRenderer } from "@evavo/adventure-renderer-pixi";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const createPackagedRuntimeRenderer = (
  bundle: RuntimeBundle,
  textures: PixiAssetTextureStore,
): PixiWebGLRenderer =>
  new PixiWebGLRenderer({
    textures,
    ...(bundle.bitmapFonts
      ? { bitmapFonts: createBitmapFontResolver(bundle.bitmapFonts) }
      : {}),
  });
