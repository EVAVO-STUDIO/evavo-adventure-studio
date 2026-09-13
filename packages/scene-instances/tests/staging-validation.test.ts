import type { SceneInstanceManifest } from "../src/index.js";
import type { SceneStagingManifest } from "../src/staging.js";
import { validateSceneStagingManifest } from "../src/staging-validation.js";
import { describe, expect, it } from "vitest";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const instances: SceneInstanceManifest = {
  manifestVersion: 1,
  projectId: asId<"project">("project.test"),
  objectDefinitions: [
    {
      id: asId<"object-definition">("definition.desk"),
      name: "Desk",
      initialStateId: asId<"object-state">("state.desk.closed"),
      states: [
        {
          id: asId<"object-state">("state.desk.closed"),
          visible: false,
          interactions: [
            {
              id: asId<"interaction">("interaction.desk.use"),
              verb: "use",
              actions: [{ kind: "set-flag", flag: "deskUsed", value: true }],
            },
          ],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: asId<"scene">("scene.office"),
      actorInstances: [],
      objectInstances: [
        {
          id: asId<"object">("object.desk"),
          definitionId: asId<"object-definition">("definition.desk"),
          position: { x: 60, y: 60 },
          layer: "world",
          elevation: 0,
          zOffset: 0,
          scaleMultiplier: 1,
          mirrored: false,
        },
      ],
      navigationPortals: [
        {
          id: asId<"navigation-portal">("portal.office"),
          fromAreaId: asId<"navigation-area">("navigation.office"),
          toAreaId: asId<"navigation-area">("navigation.office"),
          fromPoint: { x: 20, y: 20 },
          toPoint: { x: 30, y: 20 },
          bidirectional: true,
          traversalCost: 0,
        },
      ],
    },
  ],
};

const validStaging = (): SceneStagingManifest => ({
  manifestVersion: 1,
  projectId: asId<"project">("project.test"),
  scenes: [
    {
      sceneId: asId<"scene">("scene.office"),
      actorFootprints: {
        "actor.detective": { width: 8, depth: 4, clearance: 1, collisionClass: "human" },
      },
      preferredWalkLanes: [],
      surfaceZones: [],
      depthScaleCurves: [
        {
          id: asId<"depth-scale-curve">("curve.office"),
          interpolation: "linear",
          keys: [
            { y: 20, scale: 0.6 },
            { y: 90, scale: 1 },
          ],
        },
      ],
      navigationScaleOverrides: [
        {
          areaId: asId<"navigation-area">("navigation.office"),
          mode: "curve",
          curveId: asId<"depth-scale-curve">("curve.office"),
        },
      ],
      navigationStateModifiers: [
        {
          id: asId<"navigation-state-modifier">("modifier.desk.closed"),
          objectId: asId<"object">("object.desk"),
          activeStateIds: [asId<"object-state">("state.desk.closed")],
          disabledAreaIds: [],
          disabledPortalIds: [asId<"navigation-portal">("portal.office")],
        },
      ],
      approachSlotsByObject: {
        "object.desk": [
          {
            id: asId<"approach-slot">("slot.desk.front"),
            position: { x: 50, y: 70 },
            facing: "north",
            validVerbs: ["use"],
            validItemIds: [],
            preferred: true,
          },
        ],
      },
      interactionComfortRegionsByObject: {
        "object.desk": [
          {
            id: asId<"interaction-comfort-region">("comfort.desk"),
            shape: {
              points: [
                { x: 48, y: 48 },
                { x: 72, y: 48 },
                { x: 72, y: 72 },
                { x: 48, y: 72 },
              ],
            },
            priority: 0,
          },
        ],
      },
      interactionChoreographies: [
        {
          id: asId<"interaction-choreography">("choreo.desk.use"),
          interactionId: asId<"interaction">("interaction.desk.use"),
          approachSlotIds: [asId<"approach-slot">("slot.desk.front")],
          beats: [{ kind: "hold", ticks: 4 }],
        },
      ],
      entryChoreographies: [
        {
          entranceId: asId<"entrance">("entrance.office"),
          entryPath: [],
          speedPixelsPerSecond: 48,
          unlockControlAt: "path-end",
        },
      ],
      occlusionPlanes: [
        {
          id: asId<"occlusion-plane">("plane.desk-front"),
          assetId: asId<"asset">("asset.desk-front"),
          position: { x: 40, y: 40 },
          pivot: { x: 0, y: 0 },
          baselineY: 65,
          elevation: 0,
          zOffset: 0,
          opacity: 1,
          scale: 1,
          mirrored: false,
        },
      ],
      paletteLightZones: [],
    },
  ],
});

const context = {
  projectId: asId<"project">("project.test"),
  scenes: [
    {
      id: asId<"scene">("scene.office"),
      navigationAreas: [
        {
          id: asId<"navigation-area">("navigation.office"),
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
      ],
      entrances: [
        {
          id: asId<"entrance">("entrance.office"),
          position: { x: 10, y: 80 },
          facing: "east" as const,
        },
      ],
    },
  ],
  actors: [{ id: asId<"actor">("actor.detective") }],
  assets: [
    { id: asId<"asset">("asset.desk-front"), kind: "image" as const },
    { id: asId<"asset">("asset.voice"), kind: "audio" as const },
  ],
  sequences: [],
  sceneInstances: instances,
};

describe("scene staging validation", () => {
  it("accepts references that resolve against the authored room", () => {
    expect(validateSceneStagingManifest(context, validStaging())).toEqual([]);
  });

  it("rejects missing objects, states, areas, portals, entrances and unreachable approach geometry", () => {
    const invalid = validStaging();
    invalid.scenes[0] = {
      ...invalid.scenes[0]!,
      navigationScaleOverrides: [
        {
          areaId: asId<"navigation-area">("navigation.missing"),
          mode: "fixed",
          fixedScale: 1,
        },
      ],
      navigationStateModifiers: [
        {
          id: asId<"navigation-state-modifier">("modifier.invalid"),
          objectId: asId<"object">("object.desk"),
          activeStateIds: [asId<"object-state">("state.desk.missing")],
          disabledAreaIds: [asId<"navigation-area">("navigation.also-missing")],
          disabledPortalIds: [asId<"navigation-portal">("portal.missing")],
        },
      ],
      approachSlotsByObject: {
        "object.missing": [
          {
            id: asId<"approach-slot">("slot.missing"),
            position: { x: 150, y: 150 },
            facing: "south",
            validVerbs: [],
            validItemIds: [],
            preferred: false,
          },
        ],
      },
      interactionComfortRegionsByObject: {
        "object.also-missing": [
          {
            id: asId<"interaction-comfort-region">("comfort.missing"),
            shape: {
              points: [
                { x: 140, y: 140 },
                { x: 160, y: 140 },
                { x: 160, y: 160 },
                { x: 140, y: 160 },
              ],
            },
            priority: 0,
          },
        ],
      },
      entryChoreographies: [
        {
          entranceId: asId<"entrance">("entrance.missing"),
          entryPath: [],
          speedPixelsPerSecond: 48,
          unlockControlAt: "path-end",
        },
      ],
      interactionChoreographies: [],
    };

    const codes = validateSceneStagingManifest(context, invalid).map((issue) => issue.code);
    expect(codes).toContain("missing-staging-navigation-area");
    expect(codes).toContain("missing-staging-navigation-portal");
    expect(codes).toContain("missing-staging-object-state");
    expect(codes.filter((code) => code === "missing-staging-object").length).toBeGreaterThanOrEqual(2);
    expect(codes).toContain("invalid-staging-approach-position");
    expect(codes).toContain("missing-staging-entrance");
  });

  it("rejects missing and non-image occlusion plane assets", () => {
    const invalid = validStaging();
    invalid.scenes[0] = {
      ...invalid.scenes[0]!,
      occlusionPlanes: [
        {
          id: asId<"occlusion-plane">("plane.missing"),
          assetId: asId<"asset">("asset.missing"),
          position: { x: 0, y: 0 },
          pivot: { x: 0, y: 0 },
          baselineY: 50,
          elevation: 0,
          zOffset: 0,
          opacity: 1,
          scale: 1,
          mirrored: false,
        },
        {
          id: asId<"occlusion-plane">("plane.audio"),
          assetId: asId<"asset">("asset.voice"),
          position: { x: 0, y: 0 },
          pivot: { x: 0, y: 0 },
          baselineY: 60,
          elevation: 0,
          zOffset: 0,
          opacity: 1,
          scale: 1,
          mirrored: false,
        },
      ],
    };

    const codes = validateSceneStagingManifest(context, invalid).map((issue) => issue.code);
    expect(codes).toContain("missing-staging-asset");
    expect(codes).toContain("invalid-staging-asset-kind");
  });
});
