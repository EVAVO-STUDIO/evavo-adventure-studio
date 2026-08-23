import { createBitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import type { NativeCanvas, RendererHost } from "@evavo/adventure-render-contract";
import {
  type PixiRendererOptions,
  type PixiTextureResolver,
  PixiWebGLRenderer,
  pixelPresentationPolicyForProfile,
} from "@evavo/adventure-renderer-pixi";
import { createPixiIndexedBufferTextureFactory } from "@evavo/adventure-renderer-pixi/indexed-buffer-texture";
import { PixiIndexedWebGLRenderer } from "@evavo/adventure-renderer-pixi/indexed-renderer";
import { PixiIndexedTextureCache } from "@evavo/adventure-renderer-pixi/indexed-texture-cache";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { populateIndexedRuntimeTextures } from "./indexed-runtime-textures.js";

export const createPackagedRendererOptions = (
  bundle: Pick<RuntimeBundle, "bitmapFonts" | "presentation">,
  textures: PixiTextureResolver,
): PixiRendererOptions => ({
  textures,
  pixelPresentation: pixelPresentationPolicyForProfile(bundle.presentation),
  ...(bundle.bitmapFonts ? { bitmapFonts: createBitmapFontResolver(bundle.bitmapFonts) } : {}),
});

class PackagedIndexedRuntimeRenderer extends PixiIndexedWebGLRenderer {
  private readonly bundle: RuntimeBundle;
  private readonly bundleUrl: string;
  private readonly indexedTextures: PixiIndexedTextureCache;
  private loaded = false;

  constructor(bundle: RuntimeBundle, bundleUrl: string, textures: PixiAssetTextureStore) {
    const indexedTextures = new PixiIndexedTextureCache(
      createPixiIndexedBufferTextureFactory(),
      textures,
    );
    super({
      ...createPackagedRendererOptions(bundle, indexedTextures),
      textures: indexedTextures,
    });
    this.bundle = bundle;
    this.bundleUrl = bundleUrl;
    this.indexedTextures = indexedTextures;
  }

  override async initialize(host: RendererHost, canvas: NativeCanvas): Promise<void> {
    if (!this.loaded) {
      await populateIndexedRuntimeTextures(this.bundle, this.bundleUrl, this.indexedTextures);
      this.loaded = true;
    }
    await super.initialize(host, canvas);
  }

  override async destroy(): Promise<void> {
    await super.destroy();
    this.indexedTextures.clearResolvedTextures((texture) => texture.destroy(true));
    this.loaded = false;
  }
}

export const createPackagedRuntimeRenderer = (
  bundle: RuntimeBundle,
  textures: PixiAssetTextureStore,
): PixiWebGLRenderer => {
  const options = createPackagedRendererOptions(bundle, textures);
  if (!bundle.indexedAssets || bundle.indexedAssets.assets.length === 0) {
    return new PixiWebGLRenderer(options);
  }
  const bundleUrl = textures.runtimeBundleUrl();
  if (!bundleUrl) {
    throw new Error("Runtime bundle declares indexed assets before the runtime texture store has a bundle URL.");
  }
  return new PackagedIndexedRuntimeRenderer(bundle, bundleUrl, textures);
};
