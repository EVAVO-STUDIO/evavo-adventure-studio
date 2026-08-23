import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { NavigableRuntimeWorldState } from "../src/movement-types.js";
import type { SceneStaging } from "@evavo/adventure-scene-instances/staging";
import { describe, expect, it } from "vitest";
import {
  findStagedNavigationRoute,
  preferredRouteCostMultiplier,
  resolveInteractionApproach,
  resolvePerspectiveScale,
  surfaceZoneAtPoint,
} from "../src/staging.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const staging: SceneStaging = {
  sceneId: asId<"scene">("scene.office"),
  actorFootprints: {},
  preferredWalkLanes: [
    {
      id: asId<"preferred-walk-lane">("lane.carpet"),
      points: [
        { x: 20, y: 150 },
        { x: 220, y: 150 },
      ],
      influenceRadius: 20,
      costMultiplier: 0.7,
    },
  ],
  surfaceZones: [
    {
      id: asId<"surface-zone">("surface.carpet"),
      shape: { points: [{ x: 20, y: 130 }, { x: 220, y: 130 }, { x: 220, y: 170 }, { x: 20, y: 170 }] },
      surface: "carpet",
      movementMultiplier: 1,
    },
  ],
  depthScaleCurves: [
    {
      id: asId<"depth-scale-curve">("depth.office"),
      interpolation: "linear",
      keys: [
        { y: 80, scale: 0.5 },
        { y: 180, scale: 1.1 },
      ],
    },
  ],
  navigationScaleOverrides: [
    {
      areaId: asId<"navigation-area">("navigation.office"),
      mode: "curve",
      curveId: asId<"depth-scale-curve">("depth.office"),
    },
  ],
  approachSlotsByObject: {
    "object.desk": [
      {
        id: asId<"approach-slot">("slot.desk-front"),
        position: { x: 120, y: 150 },
        facing: "north",
        validVerbs: ["use"],
        validItemIds: [],
        preferred: true,
      },
    ],
  },
  interactionChoreographies: [],
  entryChoreographies: [],
  paletteLightZones: [],
};

describe("runtime staging resolution", () => {
  it("resolves an authored object approach", () => {
    const result = resolveInteractionApproach(staging, asId<"object">("object.desk"), {
      actorPosition: { x: 70, y: 160 },
      verb: "use",
      reachable: () => true,
    });
    expect(result?.slot.id).toBe("slot.desk-front");
  });

  it("resolves a piecewise perspective scale for an area", () => {
    expect(
      resolvePerspectiveScale(staging, asId<"navigation-area">("navigation.office"), 130, 1),
    ).toBeCloseTo(0.8);
  });

  it("exposes preferred lane and surface information to movement", () => {
    expect(preferredRouteCostMultiplier(staging, { x: 100, y: 150 })).toBeCloseTo(0.7);
    expect(surfaceZoneAtPoint(staging, { x: 100, y: 150 })?.surface).toBe("carpet");
  });

  it("can prefer an authored lane over the geometric shortest route", () => {
    const directed: SceneStaging = {
      ...staging,
      sceneId: asId<"scene">("scene.route"),
      preferredWalkLanes: [
        {
          id: asId<"preferred-walk-lane">("lane.directed"),
          points: [
            { x: 20, y: 50 },
            { x: 50, y: 50 },
            { x: 80, y: 50 },
          ],
          influenceRadius: 40,
          costMultiplier: 0.1,
        },
      ],
    };
    const bundle = {
      sceneStaging: {
        manifestVersion: 1,
        projectId: asId<"project">("project.test"),
        scenes: [directed],
      },
    } as unknown as RuntimeBundle;
    const world = {
      story: { flags: {}, variables: {} },
    } as unknown as NavigableRuntimeWorldState;
    const areas = [
      {
        id: asId<"navigation-area">("navigation.route"),
        elevation: 0,
        shape: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      },
    ];

    const result = findStagedNavigationRoute(
      bundle,
      world,
      asId<"scene">("scene.route"),
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      areas,
      [],
      { snapEnd: false },
    );

    expect(result.kind).toBe("route");
    if (result.kind === "route") {
      expect(result.route.points.some((point) => point.y === 50)).toBe(true);
      expect(result.route.distance).toBeGreaterThan(80);
    }
  });
});
