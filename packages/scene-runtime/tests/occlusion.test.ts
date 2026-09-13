import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame, SolidRectangleRenderNode } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { applySceneOcclusionToFrame } from "../src/occlusion.js";
import type { RuntimeWorldState } from "../src/index.js";

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

const imageAsset = (assetId: string) => ({
  assetId: asId<"asset">(assetId),
  kind: "image" as const,
  metadata: { kind: "image" as const, width: 80, height: 40, palette: false, colourCount: 32 },
  outputFiles: [],
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
    imageAsset("asset.rear-rail"),
    imageAsset("asset.desk-front"),
    imageAsset("asset.front-arch"),
  ],
  scenes: [
    {
      id: asId<"scene">("scene.office"),
      occluders: [
        {
          id: asId<"occluder">("occluder.desk"),
          assetId: asId<"asset">("asset.desk-front"),
          position: { x: 100, y: 80 },
          baselineY: 70,
        },
      ],
    },
  ],
  sceneStaging: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    scenes: [
      {
        sceneId: asId<"scene">("scene.office"),
        actorFootprints: {},
        preferredWalkLanes: [],
        surfaceZones: [],
        depthScaleCurves: [],
        navigationScaleOverrides: [],
        navigationStateModifiers: [],
        approachSlotsByObject: {},
        interactionComfortRegionsByObject: {},
        interactionChoreographies: [],
        entryChoreographies: [],
        occlusionPlanes: [
          {
            id: asId<"occlusion-plane">("plane.rear-rail"),
            assetId: asId<"asset">("asset.rear-rail"),
            position: { x: 20, y: 40 },
            pivot: { x: 0, y: 0 },
            baselineY: 50,
            elevation: 0,
            zOffset: 0,
            opacity: 1,
            scale: 1,
            mirrored: false,
          },
          {
            id: asId<"occlusion-plane">("plane.front-arch"),
            assetId: asId<"asset">("asset.front-arch"),
            position: { x: 200, y: 20 },
            pivot: { x: 0, y: 0 },
            baselineY: 90,
            elevation: 0,
            zOffset: 0,
            opacity: 1,
            scale: 1,
            mirrored: false,
            enabledWhen: { kind: "flag", flag: "archVisible", equals: true },
          },
        ],
        paletteLightZones: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: { position: { x: 0, y: 0 }, viewport: { width: 320, height: 200 }, shakeOffset: { x: 0, y: 0 } },
  nodes: [actorNode("actor.far", 40), actorNode("actor.middle", 60), actorNode("actor.near", 100)],
};

const world = (archVisible: boolean) =>
  ({
    story: {
      flags: { archVisible },
      variables: {},
      inventory: [],
      awardedScoreIds: [],
      consumedInteractionIds: [],
      consumedDialogueChoiceIds: [],
      activeDialogue: null,
      activeSequences: [],
      objectStates: {},
      randomStreams: {},
      score: 0,
    },
    actorInstances: {},
  }) as unknown as RuntimeWorldState;

describe("classic scene occlusion", () => {
  it("orders legacy and staged foreground planes around actor foot baselines", () => {
    const resolved = applySceneOcclusionToFrame(
      bundle,
      frame,
      asId<"scene">("scene.office"),
      world(true),
    );
    expect(resolved.nodes.map((node) => node.order.stableId)).toEqual([
      "actor.far",
      "occlusion-plane.plane.rear-rail",
      "actor.middle",
      "occluder.occluder.desk",
      "occlusion-plane.plane.front-arch",
      "actor.near",
    ]);
  });

  it("removes conditioned planes without disturbing the remaining depth order", () => {
    const resolved = applySceneOcclusionToFrame(
      bundle,
      frame,
      asId<"scene">("scene.office"),
      world(false),
    );
    expect(resolved.nodes.map((node) => node.order.stableId)).toEqual([
      "actor.far",
      "occlusion-plane.plane.rear-rail",
      "actor.middle",
      "occluder.occluder.desk",
      "actor.near",
    ]);
  });
});
