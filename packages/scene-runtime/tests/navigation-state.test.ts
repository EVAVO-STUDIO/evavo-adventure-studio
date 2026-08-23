import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { NavigableRuntimeWorldState } from "../src/movement-types.js";
import { enabledNavigationAreas, enabledPortals } from "../src/movement-shared.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const bundle = {
  scenes: [
    {
      id: asId<"scene">("scene.bridge"),
      navigationAreas: [
        {
          id: asId<"navigation-area">("area.left"),
          elevation: 0,
          shape: {
            points: [
              { x: 0, y: 0 },
              { x: 40, y: 0 },
              { x: 40, y: 100 },
              { x: 0, y: 100 },
            ],
          },
        },
        {
          id: asId<"navigation-area">("area.bridge"),
          elevation: 0,
          shape: {
            points: [
              { x: 40, y: 40 },
              { x: 60, y: 40 },
              { x: 60, y: 60 },
              { x: 40, y: 60 },
            ],
          },
        },
      ],
    },
  ],
  sceneInstances: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    objectDefinitions: [],
    scenes: [
      {
        sceneId: asId<"scene">("scene.bridge"),
        actorInstances: [],
        objectInstances: [],
        navigationPortals: [
          {
            id: asId<"navigation-portal">("portal.bridge"),
            fromAreaId: asId<"navigation-area">("area.left"),
            toAreaId: asId<"navigation-area">("area.bridge"),
            fromPoint: { x: 40, y: 50 },
            toPoint: { x: 45, y: 50 },
            bidirectional: true,
            traversalCost: 0,
          },
        ],
      },
    ],
  },
  sceneStaging: {
    manifestVersion: 1,
    projectId: asId<"project">("project.test"),
    scenes: [
      {
        sceneId: asId<"scene">("scene.bridge"),
        actorFootprints: {},
        preferredWalkLanes: [],
        surfaceZones: [],
        depthScaleCurves: [],
        navigationScaleOverrides: [],
        navigationStateModifiers: [
          {
            id: asId<"navigation-state-modifier">("modifier.bridge.raised"),
            objectId: asId<"object">("object.bridge"),
            activeStateIds: [asId<"object-state">("state.bridge.raised")],
            disabledAreaIds: [asId<"navigation-area">("area.bridge")],
            disabledPortalIds: [asId<"navigation-portal">("portal.bridge")],
          },
        ],
        approachSlotsByObject: {},
        interactionComfortRegionsByObject: {},
        interactionChoreographies: [],
        entryChoreographies: [],
        paletteLightZones: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const worldWithBridgeState = (state: string): NavigableRuntimeWorldState =>
  ({
    story: {
      objectStates: { "object.bridge": state },
      flags: {},
      variables: {},
    },
    actorInstances: {},
    movements: {},
  }) as unknown as NavigableRuntimeWorldState;

describe("stateful navigation staging", () => {
  it("removes authored areas and portals while the controlling object state is active", () => {
    const world = worldWithBridgeState("state.bridge.raised");
    expect(enabledNavigationAreas(bundle, world, asId<"scene">("scene.bridge")).map((area) => area.id)).toEqual([
      "area.left",
    ]);
    expect(enabledPortals(bundle, world, asId<"scene">("scene.bridge"))).toEqual([]);
  });

  it("restores authored geometry as soon as the object leaves the blocking state", () => {
    const world = worldWithBridgeState("state.bridge.lowered");
    expect(enabledNavigationAreas(bundle, world, asId<"scene">("scene.bridge")).map((area) => area.id)).toEqual([
      "area.left",
      "area.bridge",
    ]);
    expect(enabledPortals(bundle, world, asId<"scene">("scene.bridge")).map((portal) => portal.id)).toEqual([
      "portal.bridge",
    ]);
  });
});
