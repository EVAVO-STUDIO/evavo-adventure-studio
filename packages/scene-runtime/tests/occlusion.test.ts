import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame, SolidRectangleRenderNode } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { applySceneOcclusionToFrame } from "../src/occlusion.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const actorNode = (id: string, baselineY: number): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: asId<"render-node">(`render.${id}`),
  order: {
    layer: "world",
    elevation: 0,
    baselineY,
    zOffset: 0,
    stableId: id,
  },
  transform: {
    position: { x: 0, y: 0 },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
  size: { width: 1, height: 1 },
  color: 0xffffff,
});

const bundle = {
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  assets: [
    {
      assetId: asId<"asset">("asset.desk-front"),
      kind: "image",
      metadata: { kind: "image", width: 80, height: 40, palette: false, colourCount: 32 },
      outputFiles: [],
    },
  ],
  scenes: [
    {
      id: asId<"scene">("scene.office"),
      occluders: [
        {
          id: asId<"occluder">("occluder.desk"),
          assetId: asId<"asset">("asset.desk-front"),
          position: { x: 100, y: 80 },
          baselineY: 60,
        },
      ],
    },
  ],
} as unknown as RuntimeBundle;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: { position: { x: 0, y: 0 }, viewport: { width: 320, height: 200 }, shakeOffset: { x: 0, y: 0 } },
  nodes: [actorNode("actor.far", 50), actorNode("actor.near", 80)],
};

describe("classic scene occlusion", () => {
  it("places a foreground overlay between actors according to its authored baseline", () => {
    const resolved = applySceneOcclusionToFrame(bundle, frame, asId<"scene">("scene.office"));
    expect(resolved.nodes.map((node) => node.order.stableId)).toEqual([
      "actor.far",
      "occluder.occluder.desk",
      "actor.near",
    ]);
  });
});
