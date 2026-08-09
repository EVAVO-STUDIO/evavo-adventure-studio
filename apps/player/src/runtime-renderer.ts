import { createBitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import {
  type PixiRendererOptions,
  PixiWebGLRenderer,
  pixelPresentationPolicyForProfile,
} from "@evavo/adventure-renderer-pixi";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const createPackagedRendererOptions = (
  bundle: Pick<RuntimeBundle, "bitmapFonts" | "presentation">,
  textures: PixiAssetTextureStore,
): PixiRendererOptions => ({
  textures,
  pixelPresentation: pixelPresentationPolicyForProfile(bundle.presentation),
  ...(bundle.bitmapFonts ? { bitmapFonts: createBitmapFontResolver(bundle.bitmapFonts) } : {}),
});

export const createPackagedRuntimeRenderer = (
  bundle: RuntimeBundle,
  textures: PixiAssetTextureStore,
): PixiWebGLRenderer => new PixiWebGLRenderer(createPackagedRendererOptions(bundle, textures));
