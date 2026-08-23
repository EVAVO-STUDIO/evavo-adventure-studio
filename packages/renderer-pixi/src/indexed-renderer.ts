import type { Id } from "@evavo/adventure-project-schema";
import type {
  IndexedPaletteDitherTransition,
  IndexedSpriteRenderNode,
  NativeCanvas,
  RendererAdapter,
  RendererHost,
  RenderNode,
  ResolvedFrame,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { Texture } from "pixi.js";
import {
  PixiWebGLRenderer,
  type PixiRendererOptions,
  type PixiTextureResolver,
} from "./index.js";

export interface PixiIndexedTextureResolver extends PixiTextureResolver {
  getIndexedTexture(
    indexAssetId: Id<"asset">,
    paletteAssetId: Id<"asset">,
    paletteOffset: number,
  ): Texture | null;
  getIndexedDitherTexture?(
    indexAssetId: Id<"asset">,
    paletteAssetId: Id<"asset">,
    paletteOffset: number,
    transition: IndexedPaletteDitherTransition,
  ): Texture | null;
}

export interface PixiIndexedRendererOptions extends Omit<PixiRendererOptions, "textures"> {
  readonly textures: PixiIndexedTextureResolver;
}

export class PixiIndexedTextureResolutionError extends Error {
  readonly indexAssetId: Id<"asset">;
  readonly paletteAssetId: Id<"asset">;
  readonly paletteOffset: number;

  constructor(node: IndexedSpriteRenderNode) {
    super(
      `No palette-resolved texture is available for index asset '${node.indexAssetId}', ` +
        `palette '${node.paletteAssetId}' at offset ${node.paletteOffset}.`,
    );
    this.name = "PixiIndexedTextureResolutionError";
    this.indexAssetId = node.indexAssetId;
    this.paletteAssetId = node.paletteAssetId;
    this.paletteOffset = node.paletteOffset;
  }
}

export class PixiIndexedDitherCapabilityError extends Error {
  readonly nodeId: Id<"render-node">;

  constructor(node: IndexedSpriteRenderNode) {
    super(
      `Indexed sprite '${node.id}' requests ordered palette dithering but the texture resolver ` +
        "does not implement getIndexedDitherTexture().",
    );
    this.name = "PixiIndexedDitherCapabilityError";
    this.nodeId = node.id;
  }
}

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const indexedKey = (node: IndexedSpriteRenderNode): string => {
  const dither = node.paletteDither;
  return [
    node.indexAssetId,
    node.paletteAssetId,
    node.paletteOffset,
    dither?.targetPaletteAssetId ?? "",
    dither?.targetPaletteOffset ?? "",
    dither?.coverage ?? "",
    dither?.matrix ?? "",
    dither?.origin.x ?? "",
    dither?.origin.y ?? "",
  ].join("|");
};

const syntheticAssetId = (node: IndexedSpriteRenderNode): Id<"asset"> =>
  `asset.runtime-indexed.${fnv1a(indexedKey(node))}` as Id<"asset">;

const spriteFromIndexed = (
  node: IndexedSpriteRenderNode,
  assetId: Id<"asset">,
): SpriteRenderNode => ({
  id: node.id,
  kind: "sprite",
  assetId,
  sourceRect: node.sourceRect,
  originalSize: node.originalSize,
  trimOffset: node.trimOffset,
  sampling: "nearest",
  order: node.order,
  transform: node.transform,
  opacity: node.opacity,
  visible: node.visible,
  ...(node.maskNodeId ? { maskNodeId: node.maskNodeId } : {}),
});

export const expandIndexedPixiFrame = (
  frame: ResolvedFrame,
  register: (syntheticId: Id<"asset">, node: IndexedSpriteRenderNode) => void,
): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.map((node): RenderNode => {
    if (node.kind !== "indexed-sprite") return node;
    const assetId = syntheticAssetId(node);
    register(assetId, node);
    return spriteFromIndexed(node, assetId);
  }),
});

export class PixiIndexedWebGLRenderer implements RendererAdapter {
  private readonly textures: PixiIndexedTextureResolver;
  private readonly indexedNodes = new Map<string, IndexedSpriteRenderNode>();
  private readonly renderer: PixiWebGLRenderer;

  constructor(options: PixiIndexedRendererOptions) {
    this.textures = options.textures;
    const resolver: PixiTextureResolver = {
      getTexture: (assetId, frameId) => {
        const indexed = this.indexedNodes.get(assetId);
        if (indexed) {
          const dither = indexed.paletteDither;
          if (dither) {
            if (!this.textures.getIndexedDitherTexture) {
              throw new PixiIndexedDitherCapabilityError(indexed);
            }
            const texture = this.textures.getIndexedDitherTexture(
              indexed.indexAssetId,
              indexed.paletteAssetId,
              indexed.paletteOffset,
              dither,
            );
            if (!texture) throw new PixiIndexedTextureResolutionError(indexed);
            return texture;
          }
          const texture = this.textures.getIndexedTexture(
            indexed.indexAssetId,
            indexed.paletteAssetId,
            indexed.paletteOffset,
          );
          if (!texture) throw new PixiIndexedTextureResolutionError(indexed);
          return texture;
        }
        return this.textures.getTexture(assetId, frameId);
      },
      ...(this.textures.getBitmapFontResolver
        ? { getBitmapFontResolver: () => this.textures.getBitmapFontResolver?.() ?? null }
        : {}),
    };
    this.renderer = new PixiWebGLRenderer({ ...options, textures: resolver });
  }

  initialize(host: RendererHost, canvas: NativeCanvas): Promise<void> {
    return this.renderer.initialize(host, canvas);
  }

  render(frame: ResolvedFrame): void {
    this.indexedNodes.clear();
    const expanded = expandIndexedPixiFrame(frame, (assetId, node) => {
      const existing = this.indexedNodes.get(assetId);
      if (existing && indexedKey(existing) !== indexedKey(node)) {
        throw new Error(`Indexed Pixi synthetic texture collision for '${assetId}'.`);
      }
      this.indexedNodes.set(assetId, node);
    });
    this.renderer.render(expanded);
  }

  resize(hostWidth: number, hostHeight: number): void {
    this.renderer.resize(hostWidth, hostHeight);
  }

  async destroy(): Promise<void> {
    this.indexedNodes.clear();
    await this.renderer.destroy();
  }
}
