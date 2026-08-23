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
      navigationPortals: [],
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
          unlockControlAt: "path-end",
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
  sequences: [],
  sceneInstances: instances,
};

describe("scene staging validation", () => {
  it("accepts references that resolve against the authored room", () => {
    expect(validateSceneStagingManifest(context, validStaging())).toEqual([]);
  });

  it("rejects missing objects, areas, entrances and unreachable approach geometry", () => {
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
          unlockControlAt: "path-end",
        },
      ],
      interactionChoreographies: [],
    };

    const codes = validateSceneStagingManifest(context, invalid).map((issue) => issue.code);
    expect(codes).toContain("missing-staging-navigation-area");
    expect(codes.filter((code) => code === "missing-staging-object").length).toBeGreaterThanOrEqual(2);
    expect(codes).toContain("invalid-staging-approach-position");
    expect(codes).toContain("missing-staging-entrance");
  });
});
