import { describe, expect, it } from "vitest";
import type {
  DepthBand,
  Id,
  PresentationProfile,
  SpriteFrame,
} from "@evavo/adventure-project-schema";
import {
  buildResolvedFrame,
  resolveActorSprite,
  resolveCamera,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const presentation: PresentationProfile = {
  nativeWidth: 320,
  nativeHeight: 200,
  interactionMode: "context",
  integerScale: true,
  textureSampling: "nearest",
  logicalTicksPerSecond: 60,
  pixelMotionPolicy: "strict",
  showScore: false,
  allowHotspotAssist: false,
};

const frame: SpriteFrame = {
  id: id<"sprite-frame">("frame.detective.walk-1"),
  assetId: id<"asset">("asset.detective"),
  sourceRect: { x: 32, y: 0, width: 30, height: 60 },
  sourceSize: { width: 50, height: 80 },
  trimOffset: { x: 10, y: 15 },
  pivot: { x: 25, y: 78 },
  footPoint: { x: 25, y: 78 },
  durationTicks: 6,
  mirrorEligible: true,
};

const depthBands: readonly DepthBand[] = [
  {
    id: id<"depth-band">("depth.floor"),
    farY: 130,
    nearY: 190,
    farScale: 0.72,
    nearScale: 1,
  },
];

describe("resolved frame composition", () => {
  it("preserves trimmed sprite geometry around the authored foot point", () => {
    const node = resolveActorSprite({
      nodeId: id<"render-node">("render.actor.detective"),
      stableId: "actor.detective",
      frame,
      footPosition: { x: 100.4, y: 160.6 },
      depthBands,
      presentation,
      elevation: 0,
      mirrored: true,
    });

    expect(node.transform.position).toEqual({ x: 100, y: 161 });
    expect(node.transform.pivot).toEqual(frame.footPoint);
    expect(node.transform.scale.x).toBeLessThan(0);
    expect(node.transform.scale.y).toBeCloseTo(0.8646666667);
    expect(node.assetId).toBe(frame.assetId);
    expect(node.frameId).toBe(frame.id);
    expect(node.sourceRect).toEqual(frame.sourceRect);
    expect(node.originalSize).toEqual(frame.sourceSize);
    expect(node.trimOffset).toEqual(frame.trimOffset);
    expect(node.order).toMatchObject({
      layer: "world",
      baselineY: 161,
      stableId: "actor.detective",
    });
  });

  it("quantizes camera motion under strict pixel presentation", () => {
    const camera = resolveCamera({
      position: { x: 12.4, y: 4.6 },
      shakeOffset: { x: 0.6, y: -0.6 },
      viewport: { width: 320, height: 200 },
      presentation,
    });

    expect(camera).toEqual({
      position: { x: 12, y: 5 },
      shakeOffset: { x: 1, y: -1 },
      viewport: { width: 320, height: 200 },
    });
  });

  it("sorts and validates a complete native frame", () => {
    const far = resolveActorSprite({
      nodeId: id<"render-node">("render.actor.far"),
      stableId: "actor.far",
      frame,
      footPosition: { x: 80, y: 140 },
      depthBands,
      presentation,
      elevation: 0,
    });
    const near = resolveActorSprite({
      nodeId: id<"render-node">("render.actor.near"),
      stableId: "actor.near",
      frame,
      footPosition: { x: 120, y: 180 },
      depthBands,
      presentation,
      elevation: 0,
    });

    const result = buildResolvedFrame({
      tick: 42,
      canvas: {
        width: 320,
        height: 200,
        clearColor: [0, 0, 0, 255],
      },
      camera: resolveCamera({
        position: { x: 0, y: 0 },
        viewport: { width: 320, height: 200 },
        presentation,
      }),
      nodes: [near, far],
    });

    expect(result.issues).toEqual([]);
    expect(result.frame.nodes.map((node) => node.id)).toEqual([
      "render.actor.far",
      "render.actor.near",
    ]);
  });
});
