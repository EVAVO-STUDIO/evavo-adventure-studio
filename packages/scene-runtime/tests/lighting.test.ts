import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { RuntimeWorldState } from "../src/index.js";
import {
  paletteZoneBoundaryDistance,
  paletteZoneDitherCoverage,
  resolvePaletteLightTreatment,
} from "../src/lighting.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const bundle = {
  paletteMaps: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    maps: [
      {
        id: "palette.cool-shadow",
        paletteAssetId: asId<"asset">("asset.palette.scene"),
        paletteOffset: 16,
      },
      {
        id: "palette.warm-lamp",
        paletteAssetId: asId<"asset">("asset.palette.scene"),
        paletteOffset: 64,
      },
    ],
  },
  sceneStaging: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    scenes: [
      {
        sceneId: asId<"scene">("scene.alley"),
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
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
              ],
            },
            paletteMapId: "palette.cool-shadow",
            blendMode: "hard",
            priority: 1,
          },
          {
            id: asId<"palette-light-zone">("light.lamp"),
            shape: {
              points: [
                { x: 25, y: 25 },
                { x: 75, y: 25 },
                { x: 75, y: 75 },
                { x: 25, y: 75 },
              ],
            },
            paletteMapId: "palette.warm-lamp",
            blendMode: "ordered-dither",
            priority: 5,
            enabledWhen: { kind: "flag", flag: "lampOn", equals: true },
          },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

const world = (lampOn: boolean) =>
  ({
    story: {
      flags: { lampOn },
      variables: {},
    },
  }) as unknown as RuntimeWorldState;

const lampZone = bundle.sceneStaging.scenes[0]!.paletteLightZones[1]!;

describe("VGA palette lighting", () => {
  it("selects the highest-priority enabled zone and resolves its concrete palette binding", () => {
    expect(
      resolvePaletteLightTreatment(
        bundle,
        world(false),
        asId<"scene">("scene.alley"),
        { x: 50, y: 50 },
      ),
    ).toMatchObject({
      paletteMapId: "palette.cool-shadow",
      paletteAssetId: "asset.palette.scene",
      paletteOffset: 16,
      blendMode: "hard",
      ditherCoverage: 1,
    });

    expect(
      resolvePaletteLightTreatment(
        bundle,
        world(true),
        asId<"scene">("scene.alley"),
        { x: 50, y: 50 },
      ),
    ).toMatchObject({
      paletteMapId: "palette.warm-lamp",
      paletteAssetId: "asset.palette.scene",
      paletteOffset: 64,
      blendMode: "ordered-dither",
      priority: 5,
      ditherCoverage: 1,
    });
  });

  it("ramps ordered palette coverage over eight native pixels from the polygon boundary", () => {
    expect(paletteZoneBoundaryDistance(lampZone, { x: 50, y: 25 })).toBe(0);
    expect(paletteZoneBoundaryDistance(lampZone, { x: 50, y: 29 })).toBe(4);
    expect(paletteZoneBoundaryDistance(lampZone, { x: 50, y: 33 })).toBe(8);
    expect(paletteZoneDitherCoverage(lampZone, { x: 50, y: 25 })).toBe(0);
    expect(paletteZoneDitherCoverage(lampZone, { x: 50, y: 29 })).toBe(0.5);
    expect(paletteZoneDitherCoverage(lampZone, { x: 50, y: 33 })).toBe(1);
    expect(paletteZoneDitherCoverage(lampZone, { x: 10, y: 10 })).toBe(0);
  });

  it("returns no concrete treatment when a symbolic map is not bound", () => {
    const unbound = {
      ...bundle,
      paletteMaps: {
        ...bundle.paletteMaps,
        maps: [],
      },
    } as RuntimeBundle;
    expect(
      resolvePaletteLightTreatment(
        unbound,
        world(false),
        asId<"scene">("scene.alley"),
        { x: 50, y: 50 },
      ),
    ).toBeNull();
  });
});
