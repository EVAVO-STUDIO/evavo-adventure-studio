import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SceneStaging } from "@evavo/adventure-scene-instances/staging";
import { describe, expect, it } from "vitest";
import type { NavigableRuntimeWorldState } from "../src/movement-types.js";
import {
  findStagedNavigationRoute,
  preferredRouteCostMultiplier,
  resolveInteractionApproach,
  resolvePerspectiveScale,
  routeHasFootprintClearance,
  runtimeSurfaceZoneAtPoint,
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
  navigationStateModifiers: [],
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
  interactionComfortRegionsByObject: {},
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
      story: { flags: {}, variables: {}, objectStates: {} },
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

  it("rejects routes whose foot point fits but visible actor footprint does not", () => {
    const area = {
      id: asId<"navigation-area">("navigation.narrow"),
      elevation: 0,
      shape: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 12 },
          { x: 0, y: 12 },
        ],
      },
    };
    const route = {
      points: [{ x: 10, y: 6 }, { x: 90, y: 6 }],
      segments: [
        {
          from: { x: 10, y: 6 },
          to: { x: 90, y: 6 },
          kind: "walk" as const,
          areaId: area.id,
          portalId: null,
          distance: 80,
        },
      ],
      distance: 80,
      startAreaId: area.id,
      endAreaId: area.id,
      snappedStart: false,
      snappedEnd: false,
    };

    expect(
      routeHasFootprintClearance(route, [area], {
        width: 8,
        depth: 8,
        clearance: 0,
        collisionClass: "human",
      }),
    ).toBe(true);
    expect(
      routeHasFootprintClearance(route, [area], {
        width: 8,
        depth: 14,
        clearance: 0,
        collisionClass: "human",
      }),
    ).toBe(false);
  });

  it("resolves conditioned surface zones from the runtime story state", () => {
    const conditioned: SceneStaging = {
      ...staging,
      surfaceZones: [
        {
          id: asId<"surface-zone">("surface.water"),
          shape: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          surface: "water",
          movementMultiplier: 0.7,
          footstepCueId: "footstep.water",
          enabledWhen: { kind: "flag", flag: "flooded", equals: true },
        },
      ],
    };
    const bundle = {
      sceneStaging: {
        manifestVersion: 1,
        projectId: asId<"project">("project.test"),
        scenes: [conditioned],
      },
    } as unknown as RuntimeBundle;
    const dry = {
      story: { flags: { flooded: false }, variables: {}, objectStates: {} },
    } as unknown as NavigableRuntimeWorldState;
    const wet = {
      story: { flags: { flooded: true }, variables: {}, objectStates: {} },
    } as unknown as NavigableRuntimeWorldState;

    expect(runtimeSurfaceZoneAtPoint(bundle, dry, conditioned.sceneId, { x: 50, y: 50 })).toBeNull();
    expect(runtimeSurfaceZoneAtPoint(bundle, wet, conditioned.sceneId, { x: 50, y: 50 })?.footstepCueId).toBe(
      "footstep.water",
    );
  });
});
