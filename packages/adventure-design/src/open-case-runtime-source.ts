import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import { openCaseInvestigationProof } from "./open-case-investigation-proof.js";

export const OPEN_CASE_RUNTIME_PROJECT_ID = "project.open-case.packaged-proof" as const;

const room = (
  id: string,
  name: string,
  backgroundAssetId: string,
  entranceId: string,
  hotspots: readonly unknown[],
) => ({
  id,
  name,
  width: 320,
  height: 200,
  backgroundAssetId,
  navigationAreas: [
    {
      id: `navigation.${id}`,
      shape: {
        points: [
          { x: 0, y: 108 },
          { x: 320, y: 108 },
          { x: 320, y: 200 },
          { x: 0, y: 200 },
        ],
      },
      elevation: 0,
    },
  ],
  depthBands: [],
  occluders: [],
  hotspots,
  entrances: [{ id: entranceId, position: { x: 42, y: 168 }, facing: "east" }],
  fallbackText: "That does not move the case forward.",
});

const rectangle = (x: number, y: number, width: number, height: number) => ({
  points: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
});

export const openCaseProject = parseAdventureProject({
  schemaVersion: 1,
  id: OPEN_CASE_RUNTIME_PROJECT_ID,
  title: "Open Case",
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
  startSceneId: "scene.open-case.intake",
  startEntranceId: "entrance.open-case.intake",
  scenes: [
    room(
      "scene.open-case.intake",
      "Scene Entry Desk",
      "asset.open-case.intake-bg",
      "entrance.open-case.intake",
      [
        {
          id: "hotspot.open-case.entry-log",
          name: "Entry log",
          shape: rectangle(36, 70, 72, 28),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.sign-entry-log",
              verb: "use",
              once: true,
              actions: [
                { kind: "set-flag", flag: "open-case.entry-log-signed", value: true },
                { kind: "award-score", awardId: "score-award.open-case.entry-log", points: 2 },
                {
                  kind: "say",
                  text: "You sign the protected-scene entry log before crossing the boundary.",
                },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.boundary",
          name: "Protected scene",
          shape: rectangle(214, 68, 72, 84),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.enter-protected",
              verb: "use",
              when: { kind: "flag", flag: "open-case.entry-log-signed", equals: true },
              actions: [
                {
                  kind: "change-scene",
                  sceneId: "scene.open-case.apartment",
                  entranceId: "entrance.open-case.apartment",
                },
              ],
            },
            {
              id: "interaction.open-case.entry-refused",
              verb: "use",
              when: { kind: "flag", flag: "open-case.entry-log-signed", equals: false },
              actions: [
                {
                  kind: "say",
                  text: "The scene officer stops you. Sign the entry log before entering.",
                },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.open-case.apartment",
      "Protected Apartment",
      "asset.open-case.apartment-bg",
      "entrance.open-case.apartment",
      [
        {
          id: "hotspot.open-case.fragment",
          name: "Glass fragment",
          shape: rectangle(146, 132, 18, 12),
          cursor: "look",
          interactions: [
            {
              id: "interaction.open-case.observe-fragment",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "open-case.fragment-observed", value: true },
                {
                  kind: "say",
                  text: "You record the fragment's original position beside the witness-side window.",
                },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.camera-kit",
          name: "Scene camera",
          shape: rectangle(34, 114, 46, 34),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.photograph-fragment",
              verb: "use",
              once: true,
              when: {
                kind: "interaction-used",
                interactionId: "interaction.open-case.observe-fragment",
              },
              actions: [
                { kind: "set-flag", flag: "open-case.fragment-photographed", value: true },
                { kind: "award-score", awardId: "score-award.open-case.photograph", points: 3 },
                { kind: "say", text: "The fragment and its surroundings are photographed in place." },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.collection-kit",
          name: "Collection kit",
          shape: rectangle(92, 114, 46, 34),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.collect-fragment",
              verb: "use",
              once: true,
              when: {
                kind: "interaction-used",
                interactionId: "interaction.open-case.photograph-fragment",
              },
              actions: [
                { kind: "set-flag", flag: "open-case.fragment-collected", value: true },
                { kind: "say", text: "With the photograph retained, you collect the fragment." },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.evidence-bag",
          name: "Evidence bag",
          shape: rectangle(204, 116, 48, 32),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.bag-fragment",
              verb: "use",
              once: true,
              when: {
                kind: "interaction-used",
                interactionId: "interaction.open-case.collect-fragment",
              },
              actions: [
                { kind: "set-flag", flag: "open-case.fragment-bagged", value: true },
                { kind: "say", text: "The fragment is sealed in a labelled evidence bag." },
                {
                  kind: "change-scene",
                  sceneId: "scene.open-case.custody",
                  entranceId: "entrance.open-case.custody",
                },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.open-case.custody",
      "Custody and Lab Desk",
      "asset.open-case.custody-bg",
      "entrance.open-case.custody",
      [
        {
          id: "hotspot.open-case.custody-log",
          name: "Custody log",
          shape: rectangle(38, 76, 74, 42),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.log-custody",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "open-case.fragment-bagged", equals: true },
              actions: [
                { kind: "set-flag", flag: "open-case.custody-logged", value: true },
                { kind: "award-score", awardId: "score-award.open-case.custody", points: 4 },
                { kind: "say", text: "The sealed item, collection point and transfer time are logged." },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.lab-terminal",
          name: "Lab analysis terminal",
          shape: rectangle(170, 66, 104, 62),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.read-lab-report",
              verb: "use",
              once: true,
              when: {
                kind: "interaction-used",
                interactionId: "interaction.open-case.log-custody",
              },
              actions: [
                { kind: "set-flag", flag: "open-case.lab-analysed", value: true },
                { kind: "award-score", awardId: "score-award.open-case.analysis", points: 4 },
                { kind: "say", text: "The glass composition matches the witness-side window." },
                {
                  kind: "change-scene",
                  sceneId: "scene.open-case.interview",
                  entranceId: "entrance.open-case.interview",
                },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.open-case.interview",
      "Witness Interview",
      "asset.open-case.interview-bg",
      "entrance.open-case.interview",
      [
        {
          id: "hotspot.open-case.witness",
          name: "Witness",
          shape: rectangle(184, 62, 58, 96),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.start-witness-dialogue",
              verb: "use",
              actions: [
                {
                  kind: "start-dialogue",
                  dialogueId: "dialogue.open-case.witness",
                  nodeId: "dialogue-node.open-case.witness",
                },
              ],
            },
          ],
        },
        {
          id: "hotspot.open-case.caseboard-door",
          name: "Caseboard room",
          shape: rectangle(20, 54, 54, 106),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.to-caseboard",
              verb: "use",
              when: { kind: "flag", flag: "open-case.witness-contradiction", equals: true },
              actions: [
                {
                  kind: "change-scene",
                  sceneId: "scene.open-case.caseboard",
                  entranceId: "entrance.open-case.caseboard",
                },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.open-case.caseboard",
      "Caseboard",
      "asset.open-case.caseboard-bg",
      "entrance.open-case.caseboard",
      [
        {
          id: "hotspot.open-case.caseboard",
          name: "Caseboard",
          shape: rectangle(54, 42, 212, 108),
          cursor: "use",
          interactions: [
            {
              id: "interaction.open-case.review-caseboard",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "open-case.witness-contradiction", equals: true },
              actions: [
                { kind: "set-flag", flag: "open-case.next-location-open", value: true },
                { kind: "award-score", awardId: "score-award.open-case.route", points: 2 },
                { kind: "say", text: "Evidence and revised testimony justify opening the next location." },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.open-case.hearing",
      "Review Hearing Cutaway",
      "asset.open-case.hearing-bg",
      "entrance.open-case.hearing",
      [],
    ),
  ],
  actors: [
    {
      id: "actor.open-case.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.open-case.detective.idle",
          assetId: "asset.open-case.detective",
          sourceRect: { x: 0, y: 0, width: 18, height: 34 },
          sourceSize: { width: 22, height: 38 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 11, y: 37 },
          footPoint: { x: 11, y: 37 },
          durationTicks: 6,
          mirrorEligible: true,
        },
        {
          id: "frame.open-case.detective.walk",
          assetId: "asset.open-case.detective",
          sourceRect: { x: 18, y: 0, width: 18, height: 34 },
          sourceSize: { width: 22, height: 38 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 11, y: 37 },
          footPoint: { x: 11, y: 37 },
          durationTicks: 6,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.open-case.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.open-case.detective.idle"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.open-case.detective.walk-east",
          state: "walk",
          facing: "east",
          frameIds: ["frame.open-case.detective.walk"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [
    {
      id: "dialogue.open-case.witness",
      name: "Witness interview",
      startNodeId: "dialogue-node.open-case.witness",
      nodes: [
        {
          id: "dialogue-node.open-case.witness",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.open-case.witness.initial",
              text: "I already told you. I never went near that window.",
            },
          ],
          choices: [
            {
              id: "dialogue-choice.open-case.window-condition",
              text: "The lab matched the fragment to your window. What changed?",
              visibleWhen: { kind: "flag", flag: "open-case.lab-analysed", equals: true },
              once: true,
              actions: [
                { kind: "set-flag", flag: "open-case.witness-contradiction", value: true },
                { kind: "award-score", awardId: "score-award.open-case.contradiction", points: 5 },
                {
                  kind: "say",
                  text: "The witness revises the account. The contradiction is retained in the interview notes.",
                },
              ],
              closeDialogue: true,
            },
          ],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [
    {
      id: "sequence.open-case.hearing-cutaway",
      name: "Evidence review hearing",
      mode: "cutscene",
      durationTicks: 45,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: {
        allowed: true,
        safeAfterTick: 12,
        completionActions: [
          { kind: "set-flag", flag: "open-case.hearing-presented", value: true },
        ],
      },
      tracks: [
        {
          id: "sequence-track.open-case.hearing.story",
          kind: "story",
          cues: [
            {
              kind: "speech",
              atTick: 5,
              text: "The custody chain, lab match and revised testimony are presented without embellishment.",
              durationTicks: 24,
            },
          ],
        },
      ],
    },
  ],
  assets: [
    { id: "asset.open-case.intake-bg", path: "art/open-case/intake.png", kind: "image" },
    { id: "asset.open-case.apartment-bg", path: "art/open-case/apartment.png", kind: "image" },
    { id: "asset.open-case.custody-bg", path: "art/open-case/custody.png", kind: "image" },
    { id: "asset.open-case.interview-bg", path: "art/open-case/interview.png", kind: "image" },
    { id: "asset.open-case.caseboard-bg", path: "art/open-case/caseboard.png", kind: "image" },
    { id: "asset.open-case.hearing-bg", path: "art/open-case/hearing.png", kind: "image" },
    { id: "asset.open-case.detective", path: "art/open-case/detective.aseprite", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

export const openCaseSceneInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: OPEN_CASE_RUNTIME_PROJECT_ID,
  objectDefinitions: [],
  scenes: [
    {
      sceneId: "scene.open-case.intake",
      actorInstances: [
        {
          id: "actor-instance.open-case.detective",
          actorId: "actor.open-case.detective",
          position: { x: 42, y: 168 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
          elevation: 0,
          zOffset: 0,
          scaleMultiplier: 1,
        },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

export const openCaseRuntimeInvestigation = {
  ...openCaseInvestigationProof,
  projectId: OPEN_CASE_RUNTIME_PROJECT_ID,
} as const;

export const openCaseInvestigationBindings = {
  manifestVersion: 1,
  projectId: OPEN_CASE_RUNTIME_PROJECT_ID,
  interactions: [
    {
      interactionId: "interaction.open-case.observe-fragment",
      effects: [
        {
          kind: "discover-facts",
          factIds: ["fact.open-case.fragment-position"],
          discoveryKind: "evidence",
          sourceId: "interaction.open-case.observe-fragment",
        },
      ],
    },
    {
      interactionId: "interaction.open-case.log-custody",
      effects: [
        {
          kind: "discover-facts",
          factIds: ["fact.open-case.custody-logged"],
          discoveryKind: "evidence",
          sourceId: "interaction.open-case.log-custody",
        },
      ],
    },
    {
      interactionId: "interaction.open-case.read-lab-report",
      effects: [
        { kind: "use-research-source", sourceId: "source.open-case.lab-report" },
      ],
    },
    {
      interactionId: "interaction.open-case.review-caseboard",
      effects: [
        { kind: "use-research-source", sourceId: "source.open-case.caseboard" },
        { kind: "set-flag", flag: "open-case.route-open", value: true },
        { kind: "advance-chapter" },
      ],
    },
  ],
  dialogueChoices: [
    {
      choiceId: "dialogue-choice.open-case.window-condition",
      effects: [
        {
          kind: "use-topic",
          topicId: "topic.open-case.window-condition",
          speakerId: "actor.open-case.witness",
        },
      ],
    },
  ],
} as const;

export const openCaseRoomScripts = {
  manifestVersion: 1,
  projectId: OPEN_CASE_RUNTIME_PROJECT_ID,
  scripts: [
    {
      id: "room-script.open-case.hearing-cutaway",
      sceneId: "scene.open-case.caseboard",
      trigger: {
        kind: "interaction-consumed",
        interactionId: "interaction.open-case.review-caseboard",
      },
      once: true,
      actions: [],
      cutaway: {
        sceneId: "scene.open-case.hearing",
        entranceId: "entrance.open-case.hearing",
        sequenceId: "sequence.open-case.hearing-cutaway",
        returnToPreviousLocation: true,
      },
    },
  ],
} as const;

export interface OpenCaseRuntimeSourceValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export const validateOpenCaseRuntimeSource = (): OpenCaseRuntimeSourceValidation => {
  const issues = validateSceneInstanceManifest(
    {
      projectId: openCaseProject.id,
      scenes: openCaseProject.scenes,
      actors: openCaseProject.actors,
      assets: openCaseProject.assets,
      inventoryItems: openCaseProject.inventoryItems,
      dialogues: openCaseProject.dialogues,
      sequences: openCaseProject.sequences,
    },
    openCaseSceneInstances,
  ).map((issue) => `${issue.code}: ${issue.message}`);

  if (openCaseRuntimeInvestigation.projectId !== openCaseProject.id) {
    issues.push("Investigation project identity does not match Open Case project.");
  }
  if (openCaseInvestigationBindings.projectId !== openCaseProject.id) {
    issues.push("Investigation-binding project identity does not match Open Case project.");
  }
  if (openCaseRoomScripts.projectId !== openCaseProject.id) {
    issues.push("Room-script project identity does not match Open Case project.");
  }
  return { valid: issues.length === 0, issues };
};
