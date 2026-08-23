import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { RuntimeWorldState } from "../src/index.js";
import { resolvePaletteLightTreatment } from "../src/lighting.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const bundle = {
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

describe("VGA palette lighting", () => {
  it("selects the highest-priority enabled zone at a native point", () => {
    expect(
      resolvePaletteLightTreatment(
        bundle,
        world(false),
        asId<"scene">("scene.alley"),
        { x: 50, y: 50 },
      ),
    ).toMatchObject({ paletteMapId: "palette.cool-shadow", blendMode: "hard" });

    expect(
      resolvePaletteLightTreatment(
        bundle,
        world(true),
        asId<"scene">("scene.alley"),
        { x: 50, y: 50 },
      ),
    ).toMatchObject({ paletteMapId: "palette.warm-lamp", blendMode: "ordered-dither", priority: 5 });
  });
});
