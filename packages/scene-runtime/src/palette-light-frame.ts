import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { RuntimeWorldState } from "./index.js";
import { resolvePaletteLightTreatment } from "./lighting.js";

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
    if (!treatment || treatment.blendMode !== "hard") return node;
    return {
      ...node,
      paletteAssetId: treatment.paletteAssetId,
      paletteOffset: treatment.paletteOffset,
    };
  }),
});
