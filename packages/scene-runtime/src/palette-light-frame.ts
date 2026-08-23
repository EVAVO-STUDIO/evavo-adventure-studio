import type { Id, Point } from "@evavo/adventure-project-schema";
import type { IndexedSpriteRenderNode, ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { RuntimeWorldState } from "./index.js";
import { resolvePaletteLightTreatment } from "./lighting.js";

const nativeDitherOrigin = (node: IndexedSpriteRenderNode): Point => ({
  x: Math.round(node.transform.position.x - node.transform.pivot.x),
  y: Math.round(node.order.baselineY - node.transform.pivot.y),
});

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
