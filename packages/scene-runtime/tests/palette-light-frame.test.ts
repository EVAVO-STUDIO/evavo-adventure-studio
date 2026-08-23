import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { RuntimeWorldState } from "../src/index.js";
import { applyPaletteLightingToFrame } from "../src/palette-light-frame.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const frameAtActorY = (y: number): ResolvedFrame => ({
  frameVersion: 1,
  tick: 10,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: { position: { x: 0, y: 0 }, viewport: { width: 320, height: 200 }, shakeOffset: { x: 0, y: 0 } },
  nodes: [
    {
      id: asId<"render-node">("node.actor"),
      kind: "indexed-sprite",
      indexAssetId: asId<"asset">("asset.actor.indices"),
      paletteAssetId: asId<"asset">("asset.palette.base"),
      sourceRect: { x: 0, y: 0, width: 16, height: 32 },
      originalSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      paletteOffset: 0,
      order: {
        layer: "world",
        elevation: 0,
        baselineY: y,
        zOffset: 0,
        stableId: "actor",
      },
      transform: {
        position: { x: 50, y },
        pivot: { x: 8, y: 32 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
    },
    {
      id: asId<"render-node">("node.background"),
      kind: "indexed-sprite",
      indexAssetId: asId<"asset">("asset.background.indices"),
      paletteAssetId: asId<"asset">("asset.palette.base"),
      sourceRect: { x: 0, y: 0, width: 320, height: 200 },
      originalSize: { width: 320, height: 200 },
      trimOffset: { x: 0, y: 0 },
      paletteOffset: 0,
      order: {
        layer: "background",
        elevation: 0,
        baselineY: 0,
        zOffset: 0,
        stableId: "background",
      },
      transform: {
        position: { x: 0, y: 0 },
        pivot: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
    },
  ],
});

const world = {
  story: { flags: { lampOn: false }, variables: {} },
} as unknown as RuntimeWorldState;

const bundleFor = (blendMode: "hard" | "ordered-dither") =>
  ({
    paletteMaps: {
      manifestVersion: 1,
      projectId: asId<"project">("project.test"),
      maps: [
        {
          id: "palette.shadow",
          paletteAssetId: asId<"asset">("asset.palette.shadow"),
          paletteOffset: 32,
        },
      ],
    },
    sceneStaging: {
      manifestVersion: 1,
      projectId: asId<"project">("project.test"),
      scenes: [
        {
          sceneId: asId<"scene">("scene.room"),
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
          occlusionPlanes: [],
          paletteLightZones: [
            {
              id: asId<"palette-light-zone">("light.shadow"),
              shape: {
                points: [
                  { x: 0, y: 40 },
                  { x: 100, y: 40 },
                  { x: 100, y: 100 },
                  { x: 0, y: 100 },
                ],
              },
              paletteMapId: "palette.shadow",
              blendMode,
              priority: 1,
            },
          ],
        },
      ],
    },
  }) as unknown as RuntimeBundle;

describe("indexed frame palette lighting", () => {
  it("rebinds indexed world nodes inside hard palette zones", () => {
    const resolved = applyPaletteLightingToFrame(
      bundleFor("hard"),
      world,
      frameAtActorY(60),
      asId<"scene">("scene.room"),
    );
    const actor = resolved.nodes.find((node) => node.id === "node.actor");
    expect(actor).toMatchObject({
      kind: "indexed-sprite",
      paletteAssetId: "asset.palette.shadow",
      paletteOffset: 32,
    });
  });

  it("does not recolour indexed background nodes", () => {
    const resolved = applyPaletteLightingToFrame(
      bundleFor("hard"),
      world,
      frameAtActorY(60),
      asId<"scene">("scene.room"),
    );
    const background = resolved.nodes.find((node) => node.id === "node.background");
    expect(background).toMatchObject({
      kind: "indexed-sprite",
      paletteAssetId: "asset.palette.base",
      paletteOffset: 0,
    });
  });

  it("attaches a stable Bayer transition while crossing an ordered-dither boundary", () => {
    const resolved = applyPaletteLightingToFrame(
      bundleFor("ordered-dither"),
      world,
      frameAtActorY(44),
      asId<"scene">("scene.room"),
    );
    const actor = resolved.nodes.find((node) => node.id === "node.actor");
    expect(actor).toMatchObject({
      kind: "indexed-sprite",
      paletteAssetId: "asset.palette.base",
      paletteOffset: 0,
      paletteDither: {
        targetPaletteAssetId: "asset.palette.shadow",
        targetPaletteOffset: 32,
        coverage: 0.5,
        matrix: "bayer-4",
        origin: { x: 42, y: 12 },
      },
    });
  });

  it("collapses a fully covered ordered zone to the target palette without a dither payload", () => {
    const resolved = applyPaletteLightingToFrame(
      bundleFor("ordered-dither"),
      world,
      frameAtActorY(60),
      asId<"scene">("scene.room"),
    );
    const actor = resolved.nodes.find((node) => node.id === "node.actor");
    expect(actor).toMatchObject({
      kind: "indexed-sprite",
      paletteAssetId: "asset.palette.shadow",
      paletteOffset: 32,
    });
    if (actor?.kind === "indexed-sprite") expect(actor.paletteDither).toBeUndefined();
  });
});
