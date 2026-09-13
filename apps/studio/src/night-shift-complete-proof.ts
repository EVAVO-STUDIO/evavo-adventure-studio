import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";
import {
  nightShiftGameplayInstances,
  nightShiftGameplayProject,
  nightShiftGameplayStaging,
} from "./night-shift-gameplay-proof.js";

const dinerScene = {
  id: "scene.night-shift.diner",
  name: "Late diner",
  width: 320,
  height: 200,
  backgroundAssetId: "asset.night-shift.background.diner",
  navigationAreas: [
    {
      id: "navigation.night-shift.diner.main",
      shape: {
        points: [
          { x: 14, y: 118 },
          { x: 304, y: 118 },
          { x: 308, y: 192 },
          { x: 12, y: 192 },
        ],
      },
      elevation: 0,
    },
  ],
  depthBands: [
    {
      id: "depth.night-shift.diner.floor",
      farY: 116,
      nearY: 192,
      farScale: 0.7,
      nearScale: 1.02,
    },
  ],
  occluders: [],
  hotspots: [],
  entrances: [
    {
      id: "entrance.night-shift.diner.front",
      position: { x: 54, y: 176 },
      facing: "east",
    },
  ],
  fallbackText: "The diner keeps doing quiet night business around you.",
} as const;

const serverActor = {
  id: "actor.night-shift.server",
  name: "Night server",
  frames: [
    {
      id: "frame.night-shift.server.idle-west",
      assetId: "asset.night-shift.actor.server",
      sourceRect: { x: 0, y: 0, width: 20, height: 42 },
      sourceSize: { width: 24, height: 46 },
      trimOffset: { x: 2, y: 3 },
      pivot: { x: 12, y: 45 },
      footPoint: { x: 12, y: 45 },
      durationTicks: 14,
      mirrorEligible: true,
    },
  ],
  animations: [
    {
      id: "animation.night-shift.server.idle-west",
      state: "idle",
      facing: "west",
      frameIds: ["frame.night-shift.server.idle-west"],
      loop: true,
      interruptible: true,
    },
  ],
} as const;

export const nightShiftCompleteProject = parseAdventureProject({
  ...nightShiftGameplayProject,
  title: "Night Shift — Three-Room Playable Proof",
  scenes: [...nightShiftGameplayProject.scenes, dinerScene],
  actors: [...nightShiftGameplayProject.actors, serverActor],
  assets: [
    ...nightShiftGameplayProject.assets,
    { id: "asset.night-shift.background.diner", path: "art/night-shift/diner.png", kind: "image" },
    { id: "asset.night-shift.actor.server", path: "art/night-shift/server.aseprite", kind: "spritesheet" },
    { id: "asset.night-shift.object.receipt", path: "art/night-shift/receipt.png", kind: "image" },
    { id: "asset.night-shift.foreground.counter", path: "art/night-shift/diner-counter-front.png", kind: "image" },
  ],
});

const existingSedan = nightShiftGameplayInstances.objectDefinitions.find(
  (definition) => definition.id === "object-definition.night-shift.sedan",
)!;
const sedanStopped = existingSedan.states.find(
  (state) => state.id === "object-state.night-shift.sedan.stopped",
)!;

export const nightShiftCompleteInstances = parseSceneInstanceManifest({
  ...nightShiftGameplayInstances,
  projectId: nightShiftCompleteProject.id,
  objectDefinitions: [
    ...nightShiftGameplayInstances.objectDefinitions.filter(
      (definition) => definition.id !== "object-definition.night-shift.sedan",
    ),
    {
      ...existingSedan,
      states: [
        {
          ...sedanStopped,
          interactions: sedanStopped.interactions.map((interaction) =>
            interaction.id === "interaction.night-shift.sedan.resolve-safe"
              ? {
                  ...interaction,
                  actions: [
                    ...interaction.actions,
                    {
                      kind: "change-scene",
                      sceneId: "scene.night-shift.diner",
                      entranceId: "entrance.night-shift.diner.front",
                    },
                  ],
                }
              : interaction,
          ),
        },
      ],
    },
    {
      id: "object-definition.night-shift.diner-server",
      name: "Night server",
      initialStateId: "object-state.night-shift.diner-server.waiting",
      states: [
        {
          id: "object-state.night-shift.diner-server.waiting",
          interactionShape: {
            points: [
              { x: -14, y: -40 },
              { x: 14, y: -40 },
              { x: 14, y: 3 },
              { x: -14, y: 3 },
            ],
          },
          cursor: "talk",
          interactions: [
            {
              id: "interaction.night-shift.diner-server.ask-van",
              verb: "talk",
              once: true,
              actions: [
                {
                  kind: "say",
                  speakerId: "actor.night-shift.server",
                  text: "The blue delivery van? It was here before the rain got heavy. Driver paid cash and kept watching the road.",
                },
                { kind: "set-flag", flag: "dinerWitnessSpoken", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.diner-witness",
                  points: 3,
                },
              ],
            },
            {
              id: "interaction.night-shift.diner-server.repeat",
              verb: "talk",
              when: { kind: "flag", flag: "dinerWitnessSpoken", equals: true },
              actions: [
                {
                  kind: "say",
                  speakerId: "actor.night-shift.server",
                  text: "Blue van, cash, before the rain got heavy. That's all I saw.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.night-shift.receipt",
      name: "Receipt spike",
      initialStateId: "object-state.night-shift.receipt.visible",
      states: [
        {
          id: "object-state.night-shift.receipt.visible",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.receipt",
            pivot: { x: 6, y: 5 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 12, y: 0 },
              { x: 12, y: 10 },
              { x: 0, y: 10 },
            ],
          },
          cursor: "look",
          interactions: [
            {
              id: "interaction.night-shift.receipt.inspect-after-talk",
              verb: "look",
              when: { kind: "flag", flag: "dinerWitnessSpoken", equals: true },
              once: true,
              actions: [
                {
                  kind: "say",
                  text: "One cash receipt is timed just before the heavy rain. The handwritten vehicle note says BLUE VAN.",
                },
                { kind: "set-flag", flag: "dinerReceiptNoted", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.diner-receipt",
                  points: 2,
                },
              ],
            },
            {
              id: "interaction.night-shift.receipt.inspect-too-soon",
              verb: "look",
              when: { kind: "flag", flag: "dinerWitnessSpoken", equals: false },
              actions: [
                {
                  kind: "say",
                  text: "A spike of ordinary receipts. Ask what matters before deciding which scrap deserves attention.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.night-shift.diner-exit",
      name: "Diner exit",
      initialStateId: "object-state.night-shift.diner-exit.closed",
      states: [
        {
          id: "object-state.night-shift.diner-exit.closed",
          interactionShape: {
            points: [
              { x: -16, y: -58 },
              { x: 16, y: -58 },
              { x: 16, y: 2 },
              { x: -16, y: 2 },
            ],
          },
          cursor: "enter",
          interactions: [
            {
              id: "interaction.night-shift.diner-exit.complete",
              verb: "use",
              when: {
                kind: "all",
                conditions: [
                  { kind: "flag", flag: "dinerWitnessSpoken", equals: true },
                  { kind: "flag", flag: "dinerReceiptNoted", equals: true },
                ],
              },
              once: true,
              actions: [
                { kind: "set-flag", flag: "nightShiftProofComplete", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.proof-complete",
                  points: 3,
                },
                {
                  kind: "say",
                  text: "You leave with one useful observation, one physical corroboration, and no invented certainty.",
                },
              ],
            },
            {
              id: "interaction.night-shift.diner-exit.not-done",
              verb: "use",
              when: {
                kind: "not",
                condition: {
                  kind: "all",
                  conditions: [
                    { kind: "flag", flag: "dinerWitnessSpoken", equals: true },
                    { kind: "flag", flag: "dinerReceiptNoted", equals: true },
                  ],
                },
              },
              actions: [
                {
                  kind: "say",
                  text: "You have not finished the small piece of work that brought you inside.",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  scenes: [
    ...nightShiftGameplayInstances.scenes,
    {
      sceneId: "scene.night-shift.diner",
      actorInstances: [
        {
          id: "actor-instance.night-shift.diner.officer",
          actorId: "actor.night-shift.officer",
          position: { x: 58, y: 176 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
        },
        {
          id: "actor-instance.night-shift.diner.server",
          actorId: "actor.night-shift.server",
          position: { x: 222, y: 160 },
          facing: "west",
          animationState: "idle",
          mobility: "fixed",
          scaleMultiplier: 0.94,
        },
      ],
      objectInstances: [
        {
          id: "object.night-shift.diner-server",
          definitionId: "object-definition.night-shift.diner-server",
          position: { x: 222, y: 160 },
          layer: "world",
          zOffset: 2,
        },
        {
          id: "object.night-shift.receipt",
          definitionId: "object-definition.night-shift.receipt",
          position: { x: 180, y: 131 },
          layer: "world",
          zOffset: 3,
        },
        {
          id: "object.night-shift.diner-exit",
          definitionId: "object-definition.night-shift.diner-exit",
          position: { x: 37, y: 176 },
          layer: "world",
        },
      ],
      navigationPortals: [],
    },
  ],
});

const dinerStaging = {
  sceneId: "scene.night-shift.diner",
  actorFootprints: {
    "actor.night-shift.officer": { width: 10, depth: 6, clearance: 2, collisionClass: "human" },
  },
  preferredWalkLanes: [
    {
      id: "preferred-walk-lane.night-shift.diner.counter",
      points: [
        { x: 58, y: 176 },
        { x: 116, y: 168 },
        { x: 176, y: 164 },
        { x: 211, y: 164 },
      ],
      influenceRadius: 18,
      costMultiplier: 0.72,
    },
  ],
  surfaceZones: [
    {
      id: "surface-zone.night-shift.diner.tile",
      shape: {
        points: [
          { x: 16, y: 122 },
          { x: 302, y: 122 },
          { x: 306, y: 190 },
          { x: 14, y: 190 },
        ],
      },
      surface: "custom",
      customSurfaceId: "diner-tile",
      movementMultiplier: 1,
      footstepCueId: "audio-cue.night-shift.footstep.diner-tile",
    },
  ],
  depthScaleCurves: [
    {
      id: "depth-scale-curve.night-shift.diner.floor",
      interpolation: "linear",
      keys: [
        { y: 118, scale: 0.7 },
        { y: 150, scale: 0.84 },
        { y: 176, scale: 0.96 },
        { y: 192, scale: 1.02 },
      ],
    },
  ],
  navigationScaleOverrides: [
    {
      areaId: "navigation.night-shift.diner.main",
      mode: "curve",
      curveId: "depth-scale-curve.night-shift.diner.floor",
    },
  ],
  navigationStateModifiers: [],
  approachSlotsByObject: {
    "object.night-shift.diner-server": [
      {
        id: "approach-slot.night-shift.diner-server.front",
        position: { x: 198, y: 166 },
        facing: "east",
        validVerbs: ["talk"],
        validItemIds: [],
        preferred: true,
      },
    ],
    "object.night-shift.receipt": [
      {
        id: "approach-slot.night-shift.receipt.front",
        position: { x: 166, y: 160 },
        facing: "north-east",
        validVerbs: ["look"],
        validItemIds: [],
        preferred: true,
      },
    ],
    "object.night-shift.diner-exit": [
      {
        id: "approach-slot.night-shift.diner-exit.front",
        position: { x: 54, y: 175 },
        facing: "west",
        validVerbs: ["use"],
        validItemIds: [],
        preferred: true,
      },
    ],
  },
  interactionComfortRegionsByObject: {
    "object.night-shift.receipt": [
      {
        id: "interaction-comfort-region.night-shift.receipt",
        shape: {
          points: [
            { x: 169, y: 119 },
            { x: 192, y: 119 },
            { x: 192, y: 141 },
            { x: 169, y: 141 },
          ],
        },
        priority: 3,
      },
    ],
  },
  interactionChoreographies: [
    {
      id: "interaction-choreography.night-shift.diner-server.ask-van",
      interactionId: "interaction.night-shift.diner-server.ask-van",
      approachSlotIds: ["approach-slot.night-shift.diner-server.front"],
      beats: [
        { kind: "actor-animation", animationState: "idle", facing: "east", waitForCompletion: false },
        { kind: "hold", ticks: 5 },
      ],
      recoveryAnimationState: "idle",
    },
    {
      id: "interaction-choreography.night-shift.receipt.inspect-after-talk",
      interactionId: "interaction.night-shift.receipt.inspect-after-talk",
      approachSlotIds: ["approach-slot.night-shift.receipt.front"],
      beats: [
        { kind: "sound", cueId: "audio-cue.night-shift.paper-touch" },
        { kind: "hold", ticks: 4 },
      ],
      recoveryAnimationState: "idle",
    },
  ],
  entryChoreographies: [
    {
      entranceId: "entrance.night-shift.diner.front",
      spawnPosition: { x: -10, y: 176 },
      entryPath: [
        { x: 24, y: 176 },
        { x: 54, y: 176 },
      ],
      speedPixelsPerSecond: 50,
      entryAnimationState: "walk",
      arrivalFacing: "east",
      arrivalAnimationState: "idle",
      unlockControlAt: "path-end",
    },
  ],
  occlusionPlanes: [
    {
      id: "occlusion-plane.night-shift.diner.counter",
      assetId: "asset.night-shift.foreground.counter",
      position: { x: 150, y: 126 },
      pivot: { x: 0, y: 0 },
      baselineY: 158,
      elevation: 0,
      zOffset: 5,
      opacity: 1,
      scale: 1,
      mirrored: false,
    },
  ],
  paletteLightZones: [
    {
      id: "palette-light-zone.night-shift.diner-warm",
      shape: {
        points: [
          { x: 118, y: 112 },
          { x: 296, y: 112 },
          { x: 306, y: 188 },
          { x: 98, y: 188 },
        ],
      },
      paletteMapId: "palette-map.night-shift.diner-warm",
      blendMode: "ordered-dither",
      priority: 2,
    },
  ],
} as const;

export const nightShiftCompleteStaging = sceneStagingManifestSchema.parse({
  ...nightShiftGameplayStaging,
  projectId: nightShiftCompleteProject.id,
  scenes: [...nightShiftGameplayStaging.scenes, dinerStaging],
});
