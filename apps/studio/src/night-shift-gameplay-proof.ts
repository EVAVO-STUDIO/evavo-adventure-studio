import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "./night-shift-director-fixture.js";

const readinessCondition = {
  kind: "all" as const,
  conditions: [
    { kind: "flag" as const, flag: "briefingRead", equals: true },
    { kind: "flag" as const, flag: "radioReady", equals: true },
    { kind: "flag" as const, flag: "keysReady", equals: true },
  ],
};

const notReadyCondition = {
  kind: "not" as const,
  condition: readinessCondition,
};

export const nightShiftGameplayProject = parseAdventureProject({
  ...nightShiftDirectorProject,
  title: "Night Shift — Playable Proof",
  assets: [
    ...nightShiftDirectorProject.assets,
    {
      id: "asset.night-shift.object.briefing",
      path: "art/night-shift/briefing-sheet.png",
      kind: "image",
    },
  ],
});

export const nightShiftGameplayInstances = parseSceneInstanceManifest({
  ...nightShiftDirectorInstances,
  projectId: nightShiftGameplayProject.id,
  objectDefinitions: [
    ...nightShiftDirectorInstances.objectDefinitions
      .filter(
        (definition) =>
          definition.id !== "object-definition.night-shift.radio" &&
          definition.id !== "object-definition.night-shift.keys" &&
          definition.id !== "object-definition.night-shift.station-door" &&
          definition.id !== "object-definition.night-shift.sedan",
      ),
    {
      id: "object-definition.night-shift.briefing",
      name: "Shift briefing",
      initialStateId: "object-state.night-shift.briefing.unread",
      states: [
        {
          id: "object-state.night-shift.briefing.unread",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.briefing",
            pivot: { x: 10, y: 7 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 14 },
              { x: 0, y: 14 },
            ],
          },
          cursor: "look",
          interactions: [
            {
              id: "interaction.night-shift.briefing.read",
              verb: "look",
              once: true,
              actions: [
                {
                  kind: "say",
                  speakerId: "actor.night-shift.sergeant",
                  text: "Routine patrol. Wet roads. Check the industrial turnoff before midnight and keep the radio close.",
                },
                { kind: "set-flag", flag: "briefingRead", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.briefing",
                  points: 4,
                },
                {
                  kind: "set-object-state",
                  objectId: "object.night-shift.briefing",
                  state: "object-state.night-shift.briefing.read",
                },
              ],
            },
          ],
          fallbackText: "The shift note has already been read.",
        },
        {
          id: "object-state.night-shift.briefing.read",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.briefing",
            pivot: { x: 10, y: 7 },
            opacity: 0.9,
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 14 },
              { x: 0, y: 14 },
            ],
          },
          cursor: "look",
          interactions: [
            {
              id: "interaction.night-shift.briefing.review",
              verb: "look",
              actions: [
                {
                  kind: "say",
                  text: "Industrial turnoff before midnight. Radio close. Nothing dramatic on paper.",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.night-shift.radio",
      name: "Portable radio",
      initialStateId: "object-state.night-shift.radio.rack",
      states: [
        {
          id: "object-state.night-shift.radio.rack",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.radio",
            pivot: { x: 8, y: 10 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 16, y: 0 },
              { x: 16, y: 14 },
              { x: 0, y: 14 },
            ],
          },
          walkToOffset: { x: -22, y: 18 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.night-shift.radio.take",
              verb: "use",
              once: true,
              actions: [
                { kind: "set-flag", flag: "radioReady", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.radio",
                  points: 4,
                },
                {
                  kind: "set-object-state",
                  objectId: "object.night-shift.radio",
                  state: "object-state.night-shift.radio.taken",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.night-shift.radio.taken",
          visible: false,
          interactions: [],
        },
      ],
    },
    {
      id: "object-definition.night-shift.keys",
      name: "Vehicle keys",
      initialStateId: "object-state.night-shift.keys.hook",
      states: [
        {
          id: "object-state.night-shift.keys.hook",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.keys",
            pivot: { x: 6, y: 4 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 12, y: 0 },
              { x: 12, y: 8 },
              { x: 0, y: 8 },
            ],
          },
          walkToOffset: { x: -18, y: 18 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.night-shift.keys.take",
              verb: "use",
              once: true,
              actions: [
                { kind: "set-flag", flag: "keysReady", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.keys",
                  points: 4,
                },
                {
                  kind: "set-object-state",
                  objectId: "object.night-shift.keys",
                  state: "object-state.night-shift.keys.taken",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.night-shift.keys.taken",
          visible: false,
          interactions: [],
        },
      ],
    },
    {
      id: "object-definition.night-shift.station-door",
      name: "Station exit",
      initialStateId: "object-state.night-shift.station-door.closed",
      states: [
        {
          id: "object-state.night-shift.station-door.closed",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.door",
            pivot: { x: 15, y: 58 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
              { x: 30, y: 60 },
              { x: 0, y: 60 },
            ],
          },
          walkToOffset: { x: -20, y: 4 },
          faceDirection: "east",
          cursor: "enter",
          interactions: [
            {
              id: "interaction.night-shift.station-door.ready",
              verb: "use",
              when: readinessCondition,
              once: true,
              actions: [
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.ready-for-patrol",
                  points: 2,
                },
                {
                  kind: "change-scene",
                  sceneId: "scene.night-shift.roadside",
                  entranceId: "entrance.night-shift.roadside.patrol",
                },
              ],
            },
            {
              id: "interaction.night-shift.station-door.not-ready",
              verb: "use",
              when: notReadyCondition,
              actions: [
                {
                  kind: "say",
                  speakerId: "actor.night-shift.sergeant",
                  text: "Not yet. Read the shift note, take the charged radio, and get the car keys.",
                },
              ],
            },
          ],
          fallbackText: "The exit waits on the ordinary things you are supposed to remember.",
        },
      ],
    },
    {
      id: "object-definition.night-shift.sedan",
      name: "Stopped sedan",
      initialStateId: "object-state.night-shift.sedan.stopped",
      states: [
        {
          id: "object-state.night-shift.sedan.stopped",
          visual: {
            kind: "image",
            assetId: "asset.night-shift.object.sedan",
            pivot: { x: 42, y: 24 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 84, y: 0 },
              { x: 84, y: 34 },
              { x: 0, y: 34 },
            ],
          },
          walkToOffset: { x: -46, y: 20 },
          cursor: "look",
          interactions: [
            {
              id: "interaction.night-shift.sedan.observe",
              verb: "look",
              once: true,
              actions: [
                {
                  kind: "say",
                  text: "Engine running. Driver awake. Both hands visible. Nothing in the rear seat moves.",
                },
                { kind: "set-flag", flag: "vehicleObserved", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.observe-vehicle",
                  points: 3,
                },
              ],
            },
            {
              id: "interaction.night-shift.sedan.talk-after-observe",
              verb: "talk",
              when: { kind: "flag", flag: "vehicleObserved", equals: true },
              once: true,
              actions: [
                {
                  kind: "say",
                  speakerId: "actor.night-shift.driver",
                  text: "Tail light quit near the turnoff. I stopped before somebody mistook the shoulder for a lane.",
                },
                { kind: "set-flag", flag: "driverSpoken", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.calm-contact",
                  points: 3,
                },
              ],
            },
            {
              id: "interaction.night-shift.sedan.talk-too-soon",
              verb: "talk",
              when: { kind: "flag", flag: "vehicleObserved", equals: false },
              actions: [
                {
                  kind: "say",
                  text: "You have not read the stop yet. Take in the car and the driver before you start the conversation.",
                },
              ],
            },
            {
              id: "interaction.night-shift.sedan.resolve-safe",
              verb: "use",
              when: { kind: "flag", flag: "driverSpoken", equals: true },
              once: true,
              actions: [
                { kind: "set-flag", flag: "roadsideResolved", value: true },
                {
                  kind: "award-score",
                  awardId: "score-award.night-shift.safe-stop",
                  points: 4,
                },
                {
                  kind: "say",
                  text: "The stop stays ordinary. You mark the failed tail light and send the driver on carefully.",
                },
              ],
            },
            {
              id: "interaction.night-shift.sedan.unsafe-action",
              verb: "use",
              when: { kind: "flag", flag: "driverSpoken", equals: false },
              actions: [
                { kind: "set-flag", flag: "roadsideFailure", value: true },
                {
                  kind: "say",
                  text: "Wrong order. The moment gets unnecessarily dangerous. Restore or restart the stop and read it first.",
                },
              ],
            },
          ],
          fallbackText: "The wet sedan waits for a deliberate read of the situation.",
        },
      ],
    },
  ],
  scenes: nightShiftDirectorInstances.scenes.map((scene) =>
    scene.sceneId === "scene.night-shift.station"
      ? {
          ...scene,
          objectInstances: [
            ...scene.objectInstances,
            {
              id: "object.night-shift.briefing",
              definitionId: "object-definition.night-shift.briefing",
              position: { x: 219, y: 125 },
              layer: "world",
              zOffset: 2,
            },
          ],
        }
      : scene,
  ),
});

export const nightShiftGameplayStaging = sceneStagingManifestSchema.parse({
  ...nightShiftDirectorStaging,
  projectId: nightShiftGameplayProject.id,
  scenes: nightShiftDirectorStaging.scenes.map((scene) => {
    if (scene.sceneId === "scene.night-shift.station") {
      return {
        ...scene,
        approachSlotsByObject: {
          ...scene.approachSlotsByObject,
          "object.night-shift.briefing": [
            {
              id: "approach-slot.night-shift.briefing.front",
              position: { x: 204, y: 149 },
              facing: "north-east",
              validVerbs: ["look"],
              validItemIds: [],
              preferred: true,
            },
          ],
        },
        interactionComfortRegionsByObject: {
          ...scene.interactionComfortRegionsByObject,
          "object.night-shift.briefing": [
            {
              id: "interaction-comfort-region.night-shift.briefing",
              shape: {
                points: [
                  { x: 205, y: 111 },
                  { x: 234, y: 111 },
                  { x: 234, y: 139 },
                  { x: 205, y: 139 },
                ],
              },
              priority: 2,
            },
          ],
        },
        interactionChoreographies: [
          ...scene.interactionChoreographies,
          {
            id: "interaction-choreography.night-shift.briefing.read",
            interactionId: "interaction.night-shift.briefing.read",
            approachSlotIds: ["approach-slot.night-shift.briefing.front"],
            beats: [
              { kind: "actor-animation", animationState: "idle", facing: "north-east", waitForCompletion: false },
              { kind: "hold", ticks: 5 },
            ],
            recoveryAnimationState: "idle",
          },
          {
            id: "interaction-choreography.night-shift.radio.take",
            interactionId: "interaction.night-shift.radio.take",
            approachSlotIds: ["approach-slot.night-shift.radio.front"],
            beats: [
              { kind: "sound", cueId: "audio-cue.night-shift.radio-lift" },
              { kind: "hold", ticks: 4 },
            ],
            recoveryAnimationState: "idle",
          },
          {
            id: "interaction-choreography.night-shift.keys.take",
            interactionId: "interaction.night-shift.keys.take",
            approachSlotIds: ["approach-slot.night-shift.keys.front"],
            beats: [
              { kind: "sound", cueId: "audio-cue.night-shift.keys-jingle" },
              { kind: "hold", ticks: 3 },
            ],
            recoveryAnimationState: "idle",
          },
          {
            id: "interaction-choreography.night-shift.station-door.ready",
            interactionId: "interaction.night-shift.station-door.ready",
            approachSlotIds: ["approach-slot.night-shift.station-door.main"],
            beats: [
              { kind: "sound", cueId: "audio-cue.night-shift.door-latch" },
              { kind: "hold", ticks: 4 },
            ],
            recoveryAnimationState: "idle",
          },
        ],
      };
    }

    if (scene.sceneId === "scene.night-shift.roadside") {
      return {
        ...scene,
        interactionChoreographies: [
          ...scene.interactionChoreographies,
          {
            id: "interaction-choreography.night-shift.sedan.observe",
            interactionId: "interaction.night-shift.sedan.observe",
            approachSlotIds: ["approach-slot.night-shift.sedan.rear-quarter"],
            beats: [{ kind: "hold", ticks: 6 }],
            recoveryAnimationState: "idle",
          },
          {
            id: "interaction-choreography.night-shift.sedan.resolve-safe",
            interactionId: "interaction.night-shift.sedan.resolve-safe",
            approachSlotIds: ["approach-slot.night-shift.sedan.rear-quarter"],
            beats: [
              { kind: "sound", cueId: "audio-cue.night-shift.notebook" },
              { kind: "hold", ticks: 6 },
            ],
            recoveryAnimationState: "idle",
          },
        ],
      };
    }

    return scene;
  }),
});
