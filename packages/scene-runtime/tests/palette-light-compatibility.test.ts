import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { RuntimeWorldState } from "../src/index.js";
import {
  applyPaletteLightingToFrame,
  PaletteLightCompatibilityError,
} from "../src/palette-light-frame.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const world = {
  story: { flags: {}, variables: {} },
} as unknown as RuntimeWorldState;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [
    {
      kind: "indexed-sprite",
      id: id<"render-node">("render.actor"),
      indexAssetId: id<"asset">("asset.actor"),
      paletteAssetId: id<"asset">("asset.palette.base"),
      paletteOffset: 0,
      sourceRect: { x: 0, y: 0, width: 16, height: 32 },
      originalSize: { width: 16, height: 32 },
      trimOffset: { x: 0, y: 0 },
      order: {
        layer: "world",
        elevation: 0,
        baselineY: 60,
        zOffset: 0,
        stableId: "actor",
      },
      transform: {
        position: { x: 50, y: 60 },
        pivot: { x: 8, y: 31 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
    },
  ],
};

const bundle = (targetEntries: number): RuntimeBundle =>
  ({
    assets: [
      {
        assetId: "asset.palette.base",
        kind: "palette",
        outputFiles: [{ role: "primary", runtimePath: "base.rgba", byteLength: 64, sha256: "a".repeat(64), mediaType: "application/octet-stream" }],
        metadata: { kind: "palette", entries: 64 },
      },
      {
        assetId: "asset.palette.light",
        kind: "palette",
        outputFiles: [{ role: "primary", runtimePath: "light.rgba", byteLength: targetEntries * 4, sha256: "b".repeat(64), mediaType: "application/octet-stream" }],
        metadata: { kind: "palette", entries: targetEntries },
      },
    ],
    indexedAssets: {
      manifestVersion: 1,
      projectId: "project.test",
      assets: [
        {
          assetId: "asset.actor",
          width: 16,
          height: 32,
          indexRuntimePath: "actor.idx",
          indexSha256: "c".repeat(64),
          indexByteLength: 512,
          maximumSourceIndex: 31,
          defaultPalette: { paletteAssetId: "asset.palette.base", paletteOffset: 0 },
          frames: [],
        },
      ],
    },
    paletteMaps: {
      manifestVersion: 1,
      projectId: "project.test",
      maps: [
        {
          id: "palette-map.light",
          paletteAssetId: "asset.palette.light",
          paletteOffset: 16,
        },
      ],
    },
    sceneStaging: {
      manifestVersion: 1,
      projectId: "project.test",
      scenes: [
        {
          sceneId: "scene.room",
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
              id: "palette-light-zone.test",
              shape: {
                points: [
                  { x: 0, y: 0 },
                  { x: 100, y: 0 },
                  { x: 100, y: 100 },
                  { x: 0, y: 100 },
                ],
              },
              paletteMapId: "palette-map.light",
              blendMode: "hard",
              priority: 1,
            },
          ],
        },
      ],
    },
  }) as unknown as RuntimeBundle;

describe("palette-light indexed compatibility", () => {
  it("accepts a target palette when maximum source index plus offset fits", () => {
    const resolved = applyPaletteLightingToFrame(bundle(64), world, frame, id<"scene">("scene.room"));
    expect(resolved.nodes[0]).toMatchObject({
      kind: "indexed-sprite",
      paletteAssetId: "asset.palette.light",
      paletteOffset: 16,
    });
  });

  it("rejects a target palette that cannot represent the used source range", () => {
    expect(() =>
      applyPaletteLightingToFrame(bundle(40), world, frame, id<"scene">("scene.room")),
    ).toThrow(PaletteLightCompatibilityError);
  });
});
