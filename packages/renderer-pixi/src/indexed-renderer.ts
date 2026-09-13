import type { Id } from "@evavo/adventure-project-schema";
import type {
  IndexedPaletteDitherTransition,
  IndexedSpriteRenderNode,
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
import {
  normalizeIndexedDitherOrigin,
  quantizeIndexedDitherCoverage,
} from "./indexed-dither.js";

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
  const coverage = dither
    ? quantizeIndexedDitherCoverage(dither.coverage, dither.matrix)
    : "";
  const origin = dither ? normalizeIndexedDitherOrigin(dither.origin, dither.matrix) : null;
  return [
    node.indexAssetId,
    node.paletteAssetId,
    node.paletteOffset,
    dither?.targetPaletteAssetId ?? "",
    dither?.targetPaletteOffset ?? "",
    coverage,
    dither?.matrix ?? "",
    origin?.x ?? "",
    origin?.y ?? "",
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

export class PixiIndexedWebGLRenderer extends PixiWebGLRenderer {
  private readonly indexedNodes: Map<string, IndexedSpriteRenderNode>;

  constructor(options: PixiIndexedRendererOptions) {
    const indexedNodes = new Map<string, IndexedSpriteRenderNode>();
    const textures = options.textures;
    const resolver: PixiTextureResolver = {
      getTexture: (assetId, frameId) => {
        const indexed = indexedNodes.get(assetId);
        if (indexed) {
          const dither = indexed.paletteDither;
          if (dither) {
            if (!textures.getIndexedDitherTexture) {
              throw new PixiIndexedDitherCapabilityError(indexed);
            }
            const texture = textures.getIndexedDitherTexture(
              indexed.indexAssetId,
              indexed.paletteAssetId,
              indexed.paletteOffset,
              dither,
            );
            if (!texture) throw new PixiIndexedTextureResolutionError(indexed);
            return texture;
          }
          const texture = textures.getIndexedTexture(
            indexed.indexAssetId,
            indexed.paletteAssetId,
            indexed.paletteOffset,
          );
          if (!texture) throw new PixiIndexedTextureResolutionError(indexed);
          return texture;
        }
        return textures.getTexture(assetId, frameId);
      },
      ...(textures.getBitmapFontResolver
        ? { getBitmapFontResolver: () => textures.getBitmapFontResolver?.() ?? null }
        : {}),
    };
    super({ ...options, textures: resolver });
    this.indexedNodes = indexedNodes;
  }

  override render(frame: ResolvedFrame): void {
    this.indexedNodes.clear();
    const expanded = expandIndexedPixiFrame(frame, (assetId, node) => {
      const existing = this.indexedNodes.get(assetId);
      if (existing && indexedKey(existing) !== indexedKey(node)) {
        throw new Error(`Indexed Pixi synthetic texture collision for '${assetId}'.`);
      }
      this.indexedNodes.set(assetId, node);
    });
    super.render(expanded);
  }

  override async destroy(): Promise<void> {
    this.indexedNodes.clear();
    await super.destroy();
  }
}
