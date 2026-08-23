import type { Id, Point } from "@evavo/adventure-project-schema";
import type { IndexedSpriteRenderNode, ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { RuntimeWorldState } from "./index.js";
import { resolvePaletteLightTreatment } from "./lighting.js";

const nativeDitherOrigin = (node: IndexedSpriteRenderNode): Point => ({
  x: Math.round(node.transform.position.x - node.transform.pivot.x),
  y: Math.round(node.order.baselineY - node.transform.pivot.y),
});

export class PaletteLightCompatibilityError extends Error {
  readonly indexAssetId: Id<"asset">;
  readonly paletteAssetId: Id<"asset">;
  readonly paletteOffset: number;
  readonly maximumSourceIndex: number;

  constructor(
    indexAssetId: Id<"asset">,
    paletteAssetId: Id<"asset">,
    paletteOffset: number,
    maximumSourceIndex: number,
    paletteEntries: number,
  ) {
    super(
      `Indexed asset '${indexAssetId}' uses source index ${maximumSourceIndex}; palette ` +
        `'${paletteAssetId}' offset ${paletteOffset} resolves beyond ${paletteEntries} entries.`,
    );
    this.name = "PaletteLightCompatibilityError";
    this.indexAssetId = indexAssetId;
    this.paletteAssetId = paletteAssetId;
    this.paletteOffset = paletteOffset;
    this.maximumSourceIndex = maximumSourceIndex;
  }
}

const assertTreatmentCompatible = (
  bundle: RuntimeBundle,
  node: IndexedSpriteRenderNode,
  paletteAssetId: Id<"asset">,
  paletteOffset: number,
): void => {
  const indexed = bundle.indexedAssets?.assets.find((record) => record.assetId === node.indexAssetId);
  if (!indexed || indexed.maximumSourceIndex === undefined) return;
  const palette = bundle.assets.find((asset) => asset.assetId === paletteAssetId);
  if (palette?.kind !== "palette") return;
  if (indexed.maximumSourceIndex + paletteOffset >= palette.metadata.entries) {
    throw new PaletteLightCompatibilityError(
      node.indexAssetId,
      paletteAssetId,
      paletteOffset,
      indexed.maximumSourceIndex,
      palette.metadata.entries,
    );
  }
};

export const applyPaletteLightingToFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  frame: ResolvedFrame,
  sceneId: Id<"scene">,
): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.map((node) => {
    if (node.kind !== "indexed-sprite" || node.order.layer !== "world") return node;
    const treatment = resolvePaletteLightTreatment(bundle, world, sceneId, {
      x: node.transform.position.x,
      y: node.order.baselineY,
    });
    if (!treatment) return node;
    assertTreatmentCompatible(bundle, node, treatment.paletteAssetId, treatment.paletteOffset);
    if (treatment.blendMode === "hard") {
      return {
        ...node,
        paletteAssetId: treatment.paletteAssetId,
        paletteOffset: treatment.paletteOffset,
        paletteDither: undefined,
      };
    }
    if (treatment.ditherCoverage <= 0) return node;
    if (treatment.ditherCoverage >= 1) {
      return {
        ...node,
        paletteAssetId: treatment.paletteAssetId,
        paletteOffset: treatment.paletteOffset,
        paletteDither: undefined,
      };
    }
    return {
      ...node,
      paletteDither: {
        targetPaletteAssetId: treatment.paletteAssetId,
        targetPaletteOffset: treatment.paletteOffset,
        coverage: treatment.ditherCoverage,
        matrix: "bayer-4" as const,
        origin: nativeDitherOrigin(node),
      },
    };
  }),
});
