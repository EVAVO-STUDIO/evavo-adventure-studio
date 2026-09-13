import { BufferImageSource, Texture } from "pixi.js";
import type { IndexedTextureFactory } from "./indexed-texture-cache.js";

export const createPixiIndexedBufferTextureFactory = (): IndexedTextureFactory =>
  ({ cacheKey, width, height, rgba }) => {
    const source = new BufferImageSource({
      resource: new Uint8Array(rgba),
      width,
      height,
      format: "rgba8unorm",
      alphaMode: "premultiply-alpha-on-upload",
      autoGenerateMipmaps: false,
      label: `evavo-indexed:${cacheKey}`,
    });
    source.scaleMode = "nearest";
    source.autoGenerateMipmaps = false;
    return new Texture({ source, label: `evavo-indexed:${cacheKey}` });
  };
