import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";

export const AFTER_HOURS_RUNTIME_PROJECT_ID = "project.after-hours.packaged-proof" as const;

const rect = (x: number, y: number, width: number, height: number) => ({
  points: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
});

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
      shape: { points: [{ x: 0, y: 105 }, { x: 320, y: 105 }, { x: 320, y: 200 }, { x: 0, y: 200 }] },
      elevation: 0,
    },
  ],
  depthBands: [],
  occluders: [],
  hotspots,
  entrances: [{ id: entranceId, position: { x: 38, y: 168 }, facing: "east" }],
  fallbackText: "That would only make the evening stranger.",
});

export const afterHoursProject = parseAdventureProject({
  schemaVersion: 1,
  id: AFTER_HOURS_RUNTIME_PROJECT_ID,
  title: "After Hours",
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
  startSceneId: "scene.after-hours.lounge",
  startEntranceId: "entrance.after-hours.lounge",
  scenes: [
    room(
      "scene.after-hours.lounge",
      "Hotel Lounge",
      "asset.after-hours.lounge-bg",
      "entrance.after-hours.lounge",
      [
        {
          id: "hotspot.after-hours.bartender",
          name: "Bartender",
          shape: rect(184, 62, 64, 94),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.bartender-talk",
              verb: "use",
              actions: [{ kind: "start-dialogue", dialogueId: "dialogue.after-hours.bartender" }],
            },
          ],
        },
        {
          id: "hotspot.after-hours.coat",
          name: "Unattended coat",
          shape: rect(34, 62, 48, 94),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.borrow-coat",
              verb: "use",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.borrowed-coat", value: true },
                { kind: "set-variable", variable: "after-hours.minutes", value: 2 },
                { kind: "say", text: "You borrow the unattended coat. The conference badge may be useful, but it proves nothing by itself." },
              ],
            },
          ],
        },
        {
          id: "hotspot.after-hours.receipt",
          name: "Banquet receipt",
          shape: rect(102, 126, 32, 18),
          cursor: "look",
          interactions: [
            {
              id: "interaction.after-hours.read-receipt",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.receipt-known", value: true },
                { kind: "award-score", awardId: "score-award.after-hours.receipt", points: 3 },
                { kind: "say", text: "The receipt names the keynote room and matches the surname stitched inside the coat." },
              ],
            },
          ],
        },
        {
          id: "hotspot.after-hours.host-route",
          name: "Public elevator",
          shape: rect(266, 48, 40, 112),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.to-host",
              verb: "use",
              actions: [{ kind: "change-scene", sceneId: "scene.after-hours.host", entranceId: "entrance.after-hours.host" }],
            },
          ],
        },
        {
          id: "hotspot.after-hours.service-door",
          name: "Service door",
          shape: rect(136, 48, 38, 112),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.to-service",
              verb: "use",
              when: { kind: "flag", flag: "after-hours.service-route-open", equals: true },
              actions: [{ kind: "change-scene", sceneId: "scene.after-hours.service", entranceId: "entrance.after-hours.service" }],
            },
            {
              id: "interaction.after-hours.service-closed",
              verb: "use",
              when: { kind: "flag", flag: "after-hours.service-route-open", equals: false },
              actions: [{ kind: "say", text: "The staff door remains politely, completely closed to you." }],
            },
          ],
        },
      ],
    ),
    room(
      "scene.after-hours.host",
      "Conference Host Desk",
      "asset.after-hours.host-bg",
      "entrance.after-hours.host",
      [
        {
          id: "hotspot.after-hours.host",
          name: "Conference host",
          shape: rect(170, 58, 72, 100),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.host-talk",
              verb: "use",
              actions: [{ kind: "start-dialogue", dialogueId: "dialogue.after-hours.host" }],
            },
          ],
        },
        {
          id: "hotspot.after-hours.host-back",
          name: "Return to lounge",
          shape: rect(20, 48, 42, 112),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.host-back",
              verb: "use",
              actions: [{ kind: "change-scene", sceneId: "scene.after-hours.lounge", entranceId: "entrance.after-hours.lounge" }],
            },
          ],
        },
        {
          id: "hotspot.after-hours.penthouse-social",
          name: "Penthouse lift",
          shape: rect(270, 48, 36, 112),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.enter-social",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "after-hours.penthouse-lead", equals: true },
              actions: [
                { kind: "set-flag", flag: "after-hours.final-access-social", value: true },
                { kind: "award-score", awardId: "score-award.after-hours.final-access", points: 6 },
                { kind: "change-scene", sceneId: "scene.after-hours.penthouse", entranceId: "entrance.after-hours.penthouse" },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.after-hours.service",
      "Service Corridor",
      "asset.after-hours.service-bg",
      "entrance.after-hours.service",
      [
        {
          id: "hotspot.after-hours.service-cart",
          name: "Service cart",
          shape: rect(154, 104, 72, 48),
          cursor: "look",
          interactions: [
            {
              id: "interaction.after-hours.notice-cart",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.service-cart-known", value: true },
                { kind: "say", text: "The cart carries a room-access sleeve: inelegant, but practical." },
              ],
            },
          ],
        },
        {
          id: "hotspot.after-hours.service-penthouse",
          name: "Service lift",
          shape: rect(270, 48, 36, 112),
          cursor: "use",
          interactions: [
            {
              id: "interaction.after-hours.enter-service",
              verb: "use",
              once: true,
              when: {
                kind: "all",
                conditions: [
                  { kind: "flag", flag: "after-hours.service-route-open", equals: true },
                  { kind: "flag", flag: "after-hours.service-cart-known", equals: true },
                ],
              },
              actions: [
                { kind: "set-flag", flag: "after-hours.final-access-service", value: true },
                { kind: "award-score", awardId: "score-award.after-hours.final-access", points: 6 },
                { kind: "change-scene", sceneId: "scene.after-hours.penthouse", entranceId: "entrance.after-hours.penthouse" },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.after-hours.penthouse",
      "Penthouse Threshold",
      "asset.after-hours.penthouse-bg",
      "entrance.after-hours.penthouse",
      [
        {
          id: "hotspot.after-hours.proof",
          name: "Open door",
          shape: rect(130, 54, 64, 104),
          cursor: "look",
          interactions: [
            {
              id: "interaction.after-hours.complete",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.proof-complete", value: true },
                { kind: "say", text: "You reached the correct door through a chain of social or practical consequences—not a magic disguise." },
              ],
            },
          ],
        },
      ],
    ),
  ],
  actors: [
    {
      id: "actor.after-hours.player",
      name: "Guest",
      frames: [
        {
          id: "frame.after-hours.player.idle",
          assetId: "asset.after-hours.player",
          sourceRect: { x: 0, y: 0, width: 18, height: 36 },
          sourceSize: { width: 22, height: 40 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 11, y: 39 },
          footPoint: { x: 11, y: 39 },
          durationTicks: 6,
          mirrorEligible: true,
        },
        {
          id: "frame.after-hours.player.walk",
          assetId: "asset.after-hours.player",
          sourceRect: { x: 18, y: 0, width: 18, height: 36 },
          sourceSize: { width: 22, height: 40 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 11, y: 39 },
          footPoint: { x: 11, y: 39 },
          durationTicks: 6,
          mirrorEligible: true,
        },
      ],
      animations: [
        { id: "animation.after-hours.player.idle-east", state: "idle", facing: "east", frameIds: ["frame.after-hours.player.idle"], loop: true, interruptible: true },
        { id: "animation.after-hours.player.walk-east", state: "walk", facing: "east", frameIds: ["frame.after-hours.player.walk"], loop: true, interruptible: true },
      ],
    },
  ],
  dialogues: [
    {
      id: "dialogue.after-hours.bartender",
      name: "Bartender",
      startNodeId: "dialogue-node.after-hours.bartender",
      nodes: [
        {
          id: "dialogue-node.after-hours.bartender",
          enterActions: [],
          lines: [{ id: "dialogue-line.after-hours.bartender", text: "The bartender waits to see whether you have a plan or merely confidence." }],
          choices: [
            {
              id: "dialogue-choice.after-hours.awkward-introduction",
              text: "Attempt a heroic introduction.",
              once: true,
              actions: [
                { kind: "set-variable", variable: "after-hours.embarrassment", value: 1 },
                { kind: "set-variable", variable: "after-hours.minutes", value: 5 },
                { kind: "set-variable", variable: "after-hours.bartender-state", value: "amused" },
                { kind: "say", text: "The introduction hangs one beat too long. The bartender reminds you about the unpaid tab." },
              ],
              closeDialogue: true,
            },
            {
              id: "dialogue-choice.after-hours.pay-tab",
              text: "Settle the tab properly.",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.tab-resolved", value: true },
                { kind: "set-flag", flag: "after-hours.service-route-open", value: true },
                { kind: "set-variable", variable: "after-hours.bartender-state", value: "helpful" },
                { kind: "award-score", awardId: "score-award.after-hours.lounge-route", points: 4 },
                { kind: "say", text: "You settle the tab. The bartender waves you toward the staff corridor." },
              ],
              closeDialogue: true,
            },
            {
              id: "dialogue-choice.after-hours.camera-favour",
              text: "Offer to replace the dead flash on the lounge camera.",
              once: true,
              actions: [
                { kind: "set-flag", flag: "after-hours.camera-favour-used", value: true },
                { kind: "set-flag", flag: "after-hours.service-route-open", value: true },
                { kind: "set-variable", variable: "after-hours.bartender-state", value: "helpful" },
                { kind: "award-score", awardId: "score-award.after-hours.lounge-route-alt", points: 4 },
                { kind: "say", text: "The repaired flash buys exactly the favour you needed: legitimate service-corridor access." },
              ],
              closeDialogue: true,
            },
          ],
          exitActions: [],
        },
      ],
    },
    {
      id: "dialogue.after-hours.host",
      name: "Conference host",
      startNodeId: "dialogue-node.after-hours.host",
      nodes: [
        {
          id: "dialogue-node.after-hours.host",
          enterActions: [],
          lines: [{ id: "dialogue-line.after-hours.host", text: "The host recognises the coat before recognising you." }],
          choices: [
            {
              id: "dialogue-choice.after-hours.bluff-too-early",
              text: "Pretend the borrowed coat is yours.",
              visibleWhen: {
                kind: "all",
                conditions: [
                  { kind: "flag", flag: "after-hours.borrowed-coat", equals: true },
                  { kind: "flag", flag: "after-hours.receipt-known", equals: false },
                ],
              },
              once: true,
              actions: [
                { kind: "set-variable", variable: "after-hours.host-state", value: "suspicious" },
                { kind: "set-variable", variable: "after-hours.embarrassment", value: 2 },
                { kind: "say", text: "The host identifies the coat immediately. The mistake costs goodwill, but not the entire route." },
              ],
              closeDialogue: true,
            },
            {
              id: "dialogue-choice.after-hours.explain-receipt",
              text: "Show the receipt and explain the coat mix-up.",
              visibleWhen: {
                kind: "all",
                conditions: [
                  { kind: "flag", flag: "after-hours.borrowed-coat", equals: true },
                  { kind: "flag", flag: "after-hours.receipt-known", equals: true },
                ],
              },
              once: true,
              actions: [
                { kind: "set-variable", variable: "after-hours.host-state", value: "helpful" },
                { kind: "set-flag", flag: "after-hours.penthouse-lead", value: true },
                { kind: "award-score", awardId: "score-award.after-hours.penthouse-lead", points: 5 },
                { kind: "say", text: "The host accepts the correction and gives you the penthouse room number." },
              ],
              closeDialogue: true,
            },
          ],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [],
  assets: [
    { id: "asset.after-hours.lounge-bg", path: "art/after-hours/lounge.png", kind: "image" },
    { id: "asset.after-hours.host-bg", path: "art/after-hours/host.png", kind: "image" },
    { id: "asset.after-hours.service-bg", path: "art/after-hours/service.png", kind: "image" },
    { id: "asset.after-hours.penthouse-bg", path: "art/after-hours/penthouse.png", kind: "image" },
    { id: "asset.after-hours.player", path: "art/after-hours/player.aseprite", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

export const afterHoursSceneInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: AFTER_HOURS_RUNTIME_PROJECT_ID,
  objectDefinitions: [],
  scenes: [
    {
      sceneId: "scene.after-hours.lounge",
      actorInstances: [
        {
          id: "actor-instance.after-hours.player",
          actorId: "actor.after-hours.player",
          position: { x: 38, y: 168 },
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

export interface AfterHoursPackagedEvidence {
  readonly compiledBundleReady?: boolean;
  readonly socialRouteReplayReady?: boolean;
  readonly serviceRouteReplayReady?: boolean;
  readonly embarrassmentReplayReady?: boolean;
}

export const validateAfterHoursRuntimeSource = () => {
  const issues = validateSceneInstanceManifest(
    {
      projectId: afterHoursProject.id,
      scenes: afterHoursProject.scenes,
      actors: afterHoursProject.actors,
      assets: afterHoursProject.assets,
      inventoryItems: afterHoursProject.inventoryItems,
      dialogues: afterHoursProject.dialogues,
      sequences: afterHoursProject.sequences,
    },
    afterHoursSceneInstances,
  ).map((issue) => `${issue.code}: ${issue.message}`);
  return { valid: issues.length === 0, issues };
};

export const evaluateAfterHoursPackagedReadiness = (
  evidence: AfterHoursPackagedEvidence = {},
) => {
  const source = validateAfterHoursRuntimeSource();
  const issues = [...source.issues];
  if (!evidence.compiledBundleReady) issues.push("compiled-bundle-missing");
  if (!evidence.socialRouteReplayReady) issues.push("social-route-replay-missing");
  if (!evidence.serviceRouteReplayReady) issues.push("service-route-replay-missing");
  if (!evidence.embarrassmentReplayReady) issues.push("embarrassment-replay-missing");
  return {
    authoredReady: source.valid,
    packagedPlayableReady:
      source.valid &&
      evidence.compiledBundleReady === true &&
      evidence.socialRouteReplayReady === true &&
      evidence.serviceRouteReplayReady === true &&
      evidence.embarrassmentReplayReady === true,
    issues,
  };
};
