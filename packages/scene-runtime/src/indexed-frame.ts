import type {
  IndexedSpriteRenderNode,
  RenderNode,
  ResolvedFrame,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

const indexedRecordForNode = (
  bundle: RuntimeBundle,
  node: SpriteRenderNode,
) => bundle.indexedAssets?.assets.find((record) => record.assetId === node.assetId) ?? null;

export class IndexedSpriteTintConflictError extends Error {
  readonly nodeId: string;
  readonly assetId: string;

  constructor(node: SpriteRenderNode) {
    super(
      `Runtime sprite '${node.id}' uses indexed asset '${node.assetId}' and cannot also use RGBA tint. ` +
        "Author a palette map instead of tinting indexed VGA artwork.",
    );
    this.name = "IndexedSpriteTintConflictError";
    this.nodeId = node.id;
    this.assetId = node.assetId;
  }
}

const indexedNodeFromSprite = (
  bundle: RuntimeBundle,
  node: SpriteRenderNode,
): IndexedSpriteRenderNode | SpriteRenderNode => {
  const record = indexedRecordForNode(bundle, node);
  if (!record) return node;
  if (node.tintRgba) throw new IndexedSpriteTintConflictError(node);
  return {
    kind: "indexed-sprite",
    id: node.id,
    indexAssetId: node.assetId,
    paletteAssetId: record.defaultPalette.paletteAssetId,
    paletteOffset: record.defaultPalette.paletteOffset,
    sourceRect: node.sourceRect,
    originalSize: node.originalSize,
    trimOffset: node.trimOffset,
    order: node.order,
    transform: node.transform,
    opacity: node.opacity,
    visible: node.visible,
    ...(node.maskNodeId ? { maskNodeId: node.maskNodeId } : {}),
  };
};

export const applyIndexedAssetsToFrame = (
  bundle: RuntimeBundle,
  frame: ResolvedFrame,
): ResolvedFrame => {
  if (!bundle.indexedAssets || bundle.indexedAssets.assets.length === 0) return frame;
  return {
    ...frame,
    nodes: frame.nodes.map((node): RenderNode =>
      node.kind === "sprite" ? indexedNodeFromSprite(bundle, node) : node,
    ),
  };
};
