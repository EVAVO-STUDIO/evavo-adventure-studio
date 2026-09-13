import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  applyNavigationElevationToFrame,
  runtimeNavigationElevationAtPoint,
} from "../src/elevation-frame.js";
import type { RuntimeWorldState } from "../src/index.js";

const actorInstanceId = "actor-instance.hero" as Id<"actor-instance">;
const sceneId = "scene.stairs" as Id<"scene">;

const bundle = {
  scenes: [
    {
      id: sceneId,
      navigationAreas: [
        {
          id: "navigation.floor",
          elevation: 0,
          shape: { points: [{ x: 0, y: 80 }, { x: 320, y: 80 }, { x: 320, y: 200 }, { x: 0, y: 200 }] },
        },
        {
          id: "navigation.landing",
          elevation: 2,
          shape: { points: [{ x: 160, y: 80 }, { x: 320, y: 80 }, { x: 320, y: 130 }, { x: 160, y: 130 }] },
          enabledWhen: { kind: "flag", flag: "landingOpen", equals: true },
        },
      ],
    },
  ],
} as unknown as RuntimeBundle;

const world = (position: { x: number; y: number }, landingOpen = true) =>
  ({
    story: {
      flags: { landingOpen },
      variables: {},
      inventory: [],
      consumedInteractionIds: [],
      consumedDialogueChoiceIds: [],
    },
    actorInstances: {
      [actorInstanceId]: {
        instanceId: actorInstanceId,
        sceneId,
        actorId: "actor.hero",
        position,
      },
    },
  }) as unknown as RuntimeWorldState;

const frame = (): ResolvedFrame => ({
  frameVersion: 1,
  tick: 1,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [
    {
      kind: "solid-rectangle",
      id: "render.actor-instance.actor-instance.hero" as Id<"render-node">,
      size: { width: 10, height: 20 },
      color: 0xffffff,
      order: { layer: "world", elevation: 0, baselineY: 110, zOffset: 0, stableId: "hero" },
      transform: {
        position: { x: 200, y: 110 },
        pivot: { x: 5, y: 20 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
    },
  ],
});

describe("navigation-area runtime elevation", () => {
  it("selects the highest enabled navigation elevation at the actor foot point", () => {
    expect(runtimeNavigationElevationAtPoint(bundle, world({ x: 200, y: 110 }), sceneId, { x: 200, y: 110 })).toEqual({
      areaId: "navigation.landing",
      elevation: 2,
    });
    expect(runtimeNavigationElevationAtPoint(bundle, world({ x: 200, y: 110 }, false), sceneId, { x: 200, y: 110 })).toEqual({
      areaId: "navigation.floor",
      elevation: 0,
    });
  });

  it("updates only actor render-order elevation as the actor reaches a raised landing", () => {
    const source = frame();
    const elevated = applyNavigationElevationToFrame(bundle, world({ x: 200, y: 110 }), source, sceneId);
    expect(elevated.nodes[0]?.order.elevation).toBe(2);
    expect(elevated.nodes[0]?.transform).toEqual(source.nodes[0]?.transform);

    const floor = applyNavigationElevationToFrame(bundle, world({ x: 80, y: 150 }), source, sceneId);
    expect(floor.nodes[0]?.order.elevation).toBe(0);
  });
});
