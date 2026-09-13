import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { parseSceneInstanceManifest, validateSceneInstanceManifest } from "../src/index.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.scene-action-validation",
  title: "Scene Action Validation",
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
  startSceneId: "scene.street",
  startEntranceId: "entrance.street",
  scenes: [
    {
      id: "scene.street",
      name: "Street",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.street",
      navigationAreas: [
        {
          id: "navigation.street",
          shape: {
            points: [
              { x: 0, y: 120 },
              { x: 320, y: 120 },
              { x: 320, y: 200 },
              { x: 0, y: 200 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.street",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [
    {
      id: "actor.guard",
      name: "Guard",
      frames: [
        {
          id: "frame.guard.idle",
          assetId: "asset.guard",
          sourceRect: { x: 0, y: 0, width: 16, height: 24 },
          sourceSize: { width: 16, height: 24 },
          trimOffset: { x: 0, y: 0 },
          pivot: { x: 8, y: 23 },
          footPoint: { x: 8, y: 23 },
          durationTicks: 8,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.guard.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.guard.idle"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.street", path: "art/street.png", kind: "image" },
    { id: "asset.guard", path: "art/guard.png", kind: "spritesheet" },
    { id: "asset.door", path: "art/door.png", kind: "image" },
  ],
  inventoryItems: [],
});

const context = {
  projectId: project.id,
  scenes: project.scenes,
  actors: project.actors,
  assets: project.assets,
  inventoryItems: project.inventoryItems,
  dialogues: project.dialogues,
  sequences: project.sequences,
};

describe("scene interaction action validation", () => {
  it("allows several placed instances of one reusable actor definition", () => {
    const manifest = parseSceneInstanceManifest({
      manifestVersion: 1,
      projectId: project.id,
      objectDefinitions: [],
      scenes: [
        {
          sceneId: "scene.street",
          actorInstances: [
            {
              id: "actor-instance.guard.left",
              actorId: "actor.guard",
              position: { x: 60, y: 160 },
              facing: "east",
              animationState: "idle",
            },
            {
              id: "actor-instance.guard.right",
              actorId: "actor.guard",
              position: { x: 240, y: 160 },
              facing: "east",
              animationState: "idle",
            },
          ],
          objectInstances: [],
        },
      ],
    });

    expect(validateSceneInstanceManifest(context, manifest)).toEqual([]);
  });

  it("rejects object-state actions targeting missing states and objects", () => {
    const manifest = parseSceneInstanceManifest({
      manifestVersion: 1,
      projectId: project.id,
      objectDefinitions: [
        {
          id: "object-definition.door",
          name: "Door",
          initialStateId: "object-state.door.closed",
          states: [
            {
              id: "object-state.door.closed",
              visual: {
                kind: "image",
                assetId: "asset.door",
                pivot: { x: 8, y: 24 },
              },
              interactions: [
                {
                  id: "interaction.door.bad-state",
                  verb: "use",
                  actions: [
                    {
                      kind: "set-object-state",
                      objectId: "object.street.door",
                      state: "object-state.door.missing",
                    },
                    {
                      kind: "set-object-state",
                      objectId: "object.street.missing",
                      state: "object-state.door.closed",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      scenes: [
        {
          sceneId: "scene.street",
          actorInstances: [],
          objectInstances: [
            {
              id: "object.street.door",
              definitionId: "object-definition.door",
              position: { x: 160, y: 150 },
            },
          ],
        },
      ],
    });
    const codes = validateSceneInstanceManifest(context, manifest).map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining(["invalid-interaction-object-state", "missing-interaction-object"]),
    );
  });
});
