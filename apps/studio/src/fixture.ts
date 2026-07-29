import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";

export const studioProject = parseAdventureProject({
  schemaVersion: 1,
  id: "project.studio-preview",
  title: "The Red Ledger",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office.front",
  scenes: [
    {
      id: "scene.office",
      name: "Rain Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.background.office",
      navigationAreas: [
        {
          id: "navigation.office.main",
          shape: {
            points: [
              { x: 18, y: 116 },
              { x: 275, y: 116 },
              { x: 306, y: 190 },
              { x: 12, y: 190 },
            ],
          },
          elevation: 0,
        },
        {
          id: "navigation.office.threshold",
          shape: {
            points: [
              { x: 274, y: 106 },
              { x: 314, y: 106 },
              { x: 314, y: 150 },
              { x: 274, y: 150 },
            ],
          },
          elevation: 1,
        },
      ],
      depthBands: [
        {
          id: "depth.office.floor",
          farY: 110,
          nearY: 190,
          farScale: 0.7,
          nearScale: 1,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office.front",
          position: { x: 42, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing useful happens.",
    },
    {
      id: "scene.alley",
      name: "Service Alley",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.background.alley",
      navigationAreas: [
        {
          id: "navigation.alley.main",
          shape: {
            points: [
              { x: 8, y: 104 },
              { x: 312, y: 104 },
              { x: 306, y: 192 },
              { x: 14, y: 192 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [
        {
          id: "depth.alley.floor",
          farY: 104,
          nearY: 192,
          farScale: 0.66,
          nearScale: 1.04,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.alley.office",
          position: { x: 280, y: 164 },
          facing: "west",
        },
      ],
      fallbackText: "The rain swallows the attempt.",
    },
  ],
  actors: [
    {
      id: "actor.detective",
      name: "Mara Voss",
      frames: [
        {
          id: "frame.detective.idle-east",
          assetId: "asset.actor.detective",
          sourceRect: { x: 2, y: 2, width: 24, height: 50 },
          sourceSize: { width: 32, height: 56 },
          trimOffset: { x: 4, y: 4 },
          pivot: { x: 16, y: 55 },
          footPoint: { x: 16, y: 55 },
          durationTicks: 12,
          mirrorEligible: true,
        },
        {
          id: "frame.detective.walk-east",
          assetId: "asset.actor.detective",
          sourceRect: { x: 30, y: 2, width: 25, height: 50 },
          sourceSize: { width: 32, height: 56 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 16, y: 55 },
          footPoint: { x: 16, y: 55 },
          durationTicks: 7,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.detective.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.detective.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.detective.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.detective.walk-east",
          state: "walk",
          facing: "east",
          frameIds: ["frame.detective.walk-east", "frame.detective.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.detective.walk-west",
          state: "walk",
          facing: "west",
          frameIds: ["frame.detective.walk-east", "frame.detective.idle-east"],
          loop: true,
          interruptible: true,
        },
      ],
    },
    {
      id: "actor.clerk",
      name: "Night Clerk",
      frames: [
        {
          id: "frame.clerk.idle-west",
          assetId: "asset.actor.clerk",
          sourceRect: { x: 2, y: 2, width: 22, height: 46 },
          sourceSize: { width: 30, height: 52 },
          trimOffset: { x: 4, y: 4 },
          pivot: { x: 15, y: 51 },
          footPoint: { x: 15, y: 51 },
          durationTicks: 16,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.clerk.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.clerk.idle-west"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.background.office", path: "art/office.png", kind: "image" },
    { id: "asset.background.alley", path: "art/alley.png", kind: "image" },
    { id: "asset.actor.detective", path: "art/detective.aseprite", kind: "spritesheet" },
    { id: "asset.actor.clerk", path: "art/clerk.aseprite", kind: "spritesheet" },
    { id: "asset.object.lamp", path: "art/lamp.aseprite", kind: "spritesheet" },
    { id: "asset.object.door", path: "art/door.aseprite", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

export const studioSceneInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: studioProject.id,
  objectDefinitions: [
    {
      id: "object-definition.desk-lamp",
      name: "Desk lamp",
      initialStateId: "object-state.lamp.on",
      states: [
        {
          id: "object-state.lamp.on",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.object.lamp",
            frameId: "frame.lamp.on",
            sourceRect: { x: 1, y: 1, width: 18, height: 28 },
            sourceSize: { width: 22, height: 30 },
            trimOffset: { x: 2, y: 1 },
            pivot: { x: 11, y: 29 },
          },
          interactionShape: {
            points: [
              { x: 2, y: 1 },
              { x: 20, y: 1 },
              { x: 20, y: 30 },
              { x: 2, y: 30 },
            ],
          },
          walkToOffset: { x: -28, y: 16 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.lamp.switch-off",
              verb: "use",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: "object.office.lamp",
                  state: "object-state.lamp.off",
                },
              ],
            },
          ],
          fallbackText: "The lamp is already doing its job.",
        },
        {
          id: "object-state.lamp.off",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.object.lamp",
            frameId: "frame.lamp.off",
            sourceRect: { x: 22, y: 1, width: 18, height: 28 },
            sourceSize: { width: 22, height: 30 },
            trimOffset: { x: 2, y: 1 },
            pivot: { x: 11, y: 29 },
          },
          interactionShape: {
            points: [
              { x: 2, y: 1 },
              { x: 20, y: 1 },
              { x: 20, y: 30 },
              { x: 2, y: 30 },
            ],
          },
          walkToOffset: { x: -28, y: 16 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.lamp.switch-on",
              verb: "use",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: "object.office.lamp",
                  state: "object-state.lamp.on",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.office-door",
      name: "Frosted office door",
      initialStateId: "object-state.door.closed",
      states: [
        {
          id: "object-state.door.closed",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.object.door",
            frameId: "frame.door.closed",
            sourceRect: { x: 1, y: 1, width: 34, height: 70 },
            sourceSize: { width: 38, height: 72 },
            trimOffset: { x: 2, y: 1 },
            pivot: { x: 19, y: 71 },
          },
          interactionShape: {
            points: [
              { x: 1, y: 1 },
              { x: 37, y: 1 },
              { x: 37, y: 72 },
              { x: 1, y: 72 },
            ],
          },
          walkToOffset: { x: -22, y: 4 },
          faceDirection: "east",
          cursor: "enter",
          interactions: [
            {
              id: "interaction.office-door.open",
              verb: "enter",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: "object.office.door",
                  state: "object-state.door.open",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.door.open",
          visible: false,
          interactions: [],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: "scene.office",
      actorInstances: [
        {
          id: "actor-instance.office.detective",
          actorId: "actor.detective",
          position: { x: 56, y: 168 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
        },
        {
          id: "actor-instance.office.clerk",
          actorId: "actor.clerk",
          position: { x: 229, y: 151 },
          facing: "west",
          animationState: "idle",
          mobility: "fixed",
          scaleMultiplier: 0.9,
        },
      ],
      objectInstances: [
        {
          id: "object.office.lamp",
          definitionId: "object-definition.desk-lamp",
          position: { x: 186, y: 126 },
          layer: "world",
          zOffset: 2,
        },
        {
          id: "object.office.door",
          definitionId: "object-definition.office-door",
          position: { x: 294, y: 151 },
          layer: "world",
          elevation: 1,
        },
      ],
      navigationPortals: [
        {
          id: "navigation-portal.office.threshold",
          fromAreaId: "navigation.office.main",
          toAreaId: "navigation.office.threshold",
          fromPoint: { x: 276, y: 145 },
          toPoint: { x: 287, y: 138 },
          bidirectional: true,
          traversalCost: 1,
        },
      ],
    },
    {
      sceneId: "scene.alley",
      actorInstances: [
        {
          id: "actor-instance.alley.detective",
          actorId: "actor.detective",
          position: { x: 274, y: 164 },
          facing: "west",
          animationState: "idle",
          mobility: "walkable",
        },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});
