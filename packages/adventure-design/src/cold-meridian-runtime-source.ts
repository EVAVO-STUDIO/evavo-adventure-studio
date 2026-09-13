import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  parseSceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";

export const COLD_MERIDIAN_RUNTIME_PROJECT_ID = "project.cold-meridian.packaged-proof" as const;

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
      shape: { points: [{ x: 0, y: 106 }, { x: 320, y: 106 }, { x: 320, y: 200 }, { x: 0, y: 200 }] },
      elevation: 0,
    },
  ],
  depthBands: [],
  occluders: [],
  hotspots,
  entrances: [{ id: entranceId, position: { x: 42, y: 168 }, facing: "east" }],
  fallbackText: "The signal does not support that conclusion yet.",
});

const actor = (id: string, name: string, assetId: string) => ({
  id,
  name,
  frames: [
    {
      id: `frame.${id}.idle`,
      assetId,
      sourceRect: { x: 0, y: 0, width: 18, height: 36 },
      sourceSize: { width: 22, height: 40 },
      trimOffset: { x: 2, y: 3 },
      pivot: { x: 11, y: 39 },
      footPoint: { x: 11, y: 39 },
      durationTicks: 6,
      mirrorEligible: true,
    },
    {
      id: `frame.${id}.walk`,
      assetId,
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
    { id: `animation.${id}.idle-east`, state: "idle", facing: "east", frameIds: [`frame.${id}.idle`], loop: true, interruptible: true },
    { id: `animation.${id}.walk-east`, state: "walk", facing: "east", frameIds: [`frame.${id}.walk`], loop: true, interruptible: true },
  ],
});

export const coldMeridianProject = parseAdventureProject({
  schemaVersion: 1,
  id: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  title: "Cold Meridian",
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
  startSceneId: "scene.cold-meridian.observatory",
  startEntranceId: "entrance.cold-meridian.observatory",
  scenes: [
    room(
      "scene.cold-meridian.observatory",
      "Rain Observatory",
      "asset.cold-meridian.observatory-bg",
      "entrance.cold-meridian.observatory",
      [
        {
          id: "hotspot.cold-meridian.badge-recording",
          name: "Signal badge recording",
          shape: rect(70, 72, 84, 44),
          cursor: "look",
          interactions: [
            {
              id: "interaction.cold-meridian.mara-read-badge",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "cold-meridian.mara-badge-private", value: true },
                { kind: "say", text: "Mara isolates a badge number in the observatory recording. Ivo does not know it yet." },
              ],
            },
          ],
        },
        {
          id: "hotspot.cold-meridian.mara-radio",
          name: "Field radio",
          shape: rect(178, 118, 40, 30),
          cursor: "use",
          interactions: [
            {
              id: "interaction.cold-meridian.mara-share-badge",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "multi.local.actor.cold-meridian.mara.knows-badge", equals: true },
              actions: [
                { kind: "say", text: "Mara transmits the badge number to Ivo. It becomes shared knowledge only now." },
              ],
            },
          ],
        },
        {
          id: "hotspot.cold-meridian.compare",
          name: "Timestamp comparator",
          shape: rect(230, 64, 62, 70),
          cursor: "use",
          interactions: [
            {
              id: "interaction.cold-meridian.compare-recordings",
              verb: "use",
              once: true,
              when: {
                kind: "all",
                conditions: [
                  { kind: "flag", flag: "multi.fact.fact.signal.badge-number", equals: true },
                  { kind: "flag", flag: "multi.fact.fact.signal.prediction-offset", equals: true },
                ],
              },
              actions: [
                { kind: "set-flag", flag: "cold-meridian.recordings-compared", value: true },
                { kind: "set-flag", flag: "cold-meridian.relay-route-unlocked", value: true },
                { kind: "say", text: "Aligned timestamps expose a prediction offset and the correct relay window." },
              ],
            },
          ],
        },
        {
          id: "hotspot.cold-meridian.wrong-inference",
          name: "Uncertain relay inference",
          shape: rect(22, 118, 34, 30),
          cursor: "use",
          interactions: [
            {
              id: "interaction.cold-meridian.choose-wrong-inference",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "cold-meridian.recordings-compared", equals: true },
              actions: [
                { kind: "set-flag", flag: "cold-meridian.wrong-inference", value: true },
                { kind: "say", text: "The first inference sends the team to the secondary relay. It costs time, but it is not a dead end." },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.cold-meridian.harbor",
      "Harbor Service Alley",
      "asset.cold-meridian.harbor-bg",
      "entrance.cold-meridian.harbor",
      [
        {
          id: "hotspot.cold-meridian.offset-recording",
          name: "Relay timing trace",
          shape: rect(76, 68, 92, 46),
          cursor: "look",
          interactions: [
            {
              id: "interaction.cold-meridian.ivo-read-offset",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "cold-meridian.ivo-offset-private", value: true },
                { kind: "say", text: "Ivo calculates a repeating prediction offset. Mara does not gain it automatically." },
              ],
            },
          ],
        },
        {
          id: "hotspot.cold-meridian.ivo-radio",
          name: "Field radio",
          shape: rect(188, 118, 40, 30),
          cursor: "use",
          interactions: [
            {
              id: "interaction.cold-meridian.ivo-share-offset",
              verb: "use",
              once: true,
              when: { kind: "flag", flag: "multi.local.actor.cold-meridian.ivo.knows-offset", equals: true },
              actions: [
                { kind: "say", text: "Ivo sends the prediction offset to Mara. The fact becomes shared through an authored exchange." },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.cold-meridian.late-relay",
      "Secondary Relay · Late Arrival",
      "asset.cold-meridian.late-relay-bg",
      "entrance.cold-meridian.late-relay",
      [
        {
          id: "hotspot.cold-meridian.secondary-vehicle",
          name: "Secondary vehicle trace",
          shape: rect(138, 92, 86, 54),
          cursor: "look",
          interactions: [
            {
              id: "interaction.cold-meridian.observe-secondary-vehicle",
              verb: "look",
              once: true,
              actions: [
                { kind: "set-flag", flag: "cold-meridian.secondary-vehicle-known", value: true },
                { kind: "say", text: "The late arrival exposes a secondary vehicle and a useful trace. The wrong inference changes the evidence instead of killing the route." },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.cold-meridian.relay",
      "Primary Relay",
      "asset.cold-meridian.relay-bg",
      "entrance.cold-meridian.relay",
      [
        {
          id: "hotspot.cold-meridian.intervention",
          name: "Relay intervention",
          shape: rect(124, 76, 80, 72),
          cursor: "use",
          interactions: [
            {
              id: "interaction.cold-meridian.start-intervention",
              verb: "use",
              once: true,
              actions: [
                { kind: "set-flag", flag: "cold-meridian.intervention-started", value: true },
                { kind: "say", text: "The intervention begins from a private pre-action checkpoint." },
              ],
            },
          ],
        },
      ],
    ),
    room(
      "scene.cold-meridian.cutaway",
      "Remote Relay Cutaway",
      "asset.cold-meridian.cutaway-bg",
      "entrance.cold-meridian.cutaway",
      [],
    ),
    room(
      "scene.cold-meridian.intervention",
      "Intervention Insert",
      "asset.cold-meridian.intervention-bg",
      "entrance.cold-meridian.intervention",
      [],
    ),
  ],
  actors: [
    actor("actor.cold-meridian.mara", "Mara", "asset.cold-meridian.mara"),
    actor("actor.cold-meridian.ivo", "Ivo", "asset.cold-meridian.ivo"),
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.cold-meridian.remote-relay",
      name: "Remote relay reaction",
      mode: "cutscene",
      durationTicks: 36,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: { allowed: true, safeAfterTick: 8, completionActions: [{ kind: "set-flag", flag: "cold-meridian.cutaway-seen", value: true }] },
      tracks: [
        {
          id: "sequence-track.cold-meridian.remote-relay",
          kind: "story",
          cues: [
            { kind: "speech", atTick: 4, text: "A hard cut shows the remote relay accepting the prediction window before the view returns.", durationTicks: 22 },
          ],
        },
      ],
    },
  ],
  assets: [
    { id: "asset.cold-meridian.observatory-bg", path: "art/cold-meridian/observatory.png", kind: "image" },
    { id: "asset.cold-meridian.harbor-bg", path: "art/cold-meridian/harbor.png", kind: "image" },
    { id: "asset.cold-meridian.late-relay-bg", path: "art/cold-meridian/late-relay.png", kind: "image" },
    { id: "asset.cold-meridian.relay-bg", path: "art/cold-meridian/relay.png", kind: "image" },
    { id: "asset.cold-meridian.cutaway-bg", path: "art/cold-meridian/cutaway.png", kind: "image" },
    { id: "asset.cold-meridian.intervention-bg", path: "art/cold-meridian/intervention.png", kind: "image" },
    { id: "asset.cold-meridian.mara", path: "art/cold-meridian/mara.aseprite", kind: "spritesheet" },
    { id: "asset.cold-meridian.ivo", path: "art/cold-meridian/ivo.aseprite", kind: "spritesheet" },
  ],
  inventoryItems: [],
});

export const coldMeridianSceneInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  objectDefinitions: [],
  scenes: [
    {
      sceneId: "scene.cold-meridian.observatory",
      actorInstances: [
        { id: "actor-instance.cold-meridian.mara", actorId: "actor.cold-meridian.mara", position: { x: 42, y: 168 }, facing: "east", animationState: "idle", mobility: "walkable", elevation: 0, zOffset: 0, scaleMultiplier: 1 },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
    {
      sceneId: "scene.cold-meridian.harbor",
      actorInstances: [
        { id: "actor-instance.cold-meridian.ivo", actorId: "actor.cold-meridian.ivo", position: { x: 42, y: 168 }, facing: "east", animationState: "idle", mobility: "walkable", elevation: 0, zOffset: 0, scaleMultiplier: 1 },
      ],
      objectInstances: [],
      navigationPortals: [],
    },
  ],
});

export const coldMeridianMultiProtagonist = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  activeProtagonistId: "actor.cold-meridian.mara",
  protagonists: [
    { protagonistId: "actor.cold-meridian.mara", startSceneId: "scene.cold-meridian.observatory", startEntranceId: "entrance.cold-meridian.observatory", startingInventory: [] },
    { protagonistId: "actor.cold-meridian.ivo", startSceneId: "scene.cold-meridian.harbor", startEntranceId: "entrance.cold-meridian.harbor", startingInventory: [] },
  ],
} as const;

export const coldMeridianMultiProtagonistBindings = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  bindings: [
    {
      id: "multi-binding.cold-meridian.mara-private-badge",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.mara-read-badge" },
      effects: [{ kind: "set-protagonist-flag", protagonistId: "actor.cold-meridian.mara", flag: "knows-badge", value: true }],
    },
    {
      id: "multi-binding.cold-meridian.ivo-private-offset",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.ivo-read-offset" },
      effects: [{ kind: "set-protagonist-flag", protagonistId: "actor.cold-meridian.ivo", flag: "knows-offset", value: true }],
    },
    {
      id: "multi-binding.cold-meridian.share-badge",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.mara-share-badge" },
      effects: [{ kind: "add-shared-fact", factId: "fact.signal.badge-number" }],
    },
    {
      id: "multi-binding.cold-meridian.share-offset",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.ivo-share-offset" },
      effects: [{ kind: "add-shared-fact", factId: "fact.signal.prediction-offset" }],
    },
    {
      id: "multi-binding.cold-meridian.route-unlocked",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.compare-recordings" },
      effects: [{ kind: "set-shared-flag", flag: "relay-route-unlocked", value: true }],
    },
    {
      id: "multi-binding.cold-meridian.secondary-vehicle",
      source: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.observe-secondary-vehicle" },
      effects: [{ kind: "add-shared-fact", factId: "fact.late-arrival.secondary-vehicle" }],
    },
  ],
} as const;

export const coldMeridianInvestigation = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  facts: [
    { id: "fact.signal.badge-number", label: "Signal badge number", description: "Mara's recording contains a badge number that becomes shared only after transmission." },
    { id: "fact.signal.prediction-offset", label: "Prediction offset", description: "Ivo derives a repeatable prediction offset from the harbor trace." },
    { id: "fact.late-arrival.secondary-vehicle", label: "Secondary vehicle", description: "The delayed route exposes a vehicle trace that the direct route would not reveal." },
  ],
  topics: [],
  researchSources: [],
  chapters: [
    {
      id: "chapter.cold-meridian.signal",
      label: "Signal Window",
      order: 1,
      objectives: [
        { id: "objective.cold-meridian.share-badge", label: "Share the badge number", required: true, requirements: [{ kind: "fact", factId: "fact.signal.badge-number" }] },
        { id: "objective.cold-meridian.share-offset", label: "Share the prediction offset", required: true, requirements: [{ kind: "fact", factId: "fact.signal.prediction-offset" }] },
      ],
    },
  ],
} as const;

export const coldMeridianInvestigationBindings = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  interactions: [
    {
      interactionId: "interaction.cold-meridian.mara-share-badge",
      effects: [{ kind: "discover-facts", factIds: ["fact.signal.badge-number"], discoveryKind: "dialogue", sourceId: "actor.cold-meridian.mara" }],
    },
    {
      interactionId: "interaction.cold-meridian.ivo-share-offset",
      effects: [{ kind: "discover-facts", factIds: ["fact.signal.prediction-offset"], discoveryKind: "dialogue", sourceId: "actor.cold-meridian.ivo" }],
    },
    {
      interactionId: "interaction.cold-meridian.observe-secondary-vehicle",
      effects: [{ kind: "discover-facts", factIds: ["fact.late-arrival.secondary-vehicle"], discoveryKind: "evidence", sourceId: "interaction.cold-meridian.observe-secondary-vehicle" }],
    },
  ],
  dialogueChoices: [],
} as const;

export const coldMeridianRoomScripts = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  scripts: [
    {
      id: "room-script.cold-meridian.remote-relay-cutaway",
      sceneId: "scene.cold-meridian.observatory",
      trigger: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.compare-recordings" },
      once: true,
      actions: [],
      cutaway: {
        sceneId: "scene.cold-meridian.cutaway",
        entranceId: "entrance.cold-meridian.cutaway",
        sequenceId: "sequence.cold-meridian.remote-relay",
        returnToPreviousLocation: true,
      },
    },
  ],
} as const;

export const coldMeridianRouteTopology = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  startNodeId: "route-node.cold-meridian.signal-window",
  routes: [
    { id: "route.cold-meridian.direct", label: "Direct relay" },
    { id: "route.cold-meridian.delayed", label: "Late secondary relay" },
  ],
  nodes: [
    { id: "route-node.cold-meridian.signal-window", label: "Signal window", tags: ["investigation"] },
    { id: "route-node.cold-meridian.late-relay", label: "Late relay", sceneId: "scene.cold-meridian.late-relay", entranceId: "entrance.cold-meridian.late-relay", tags: ["changed-evidence"] },
    { id: "route-node.cold-meridian.primary-relay", label: "Primary relay", sceneId: "scene.cold-meridian.relay", entranceId: "entrance.cold-meridian.relay", tags: ["intervention"] },
  ],
  edges: [
    {
      id: "route-edge.cold-meridian.direct",
      label: "Follow the aligned prediction",
      fromNodeId: "route-node.cold-meridian.signal-window",
      toNodeId: "route-node.cold-meridian.primary-relay",
      routeId: "route.cold-meridian.direct",
      when: {
        kind: "all",
        conditions: [
          { kind: "flag", flag: "multi.shared.relay-route-unlocked", equals: true },
          { kind: "flag", flag: "cold-meridian.wrong-inference", equals: false },
        ],
      },
      actions: [],
    },
    {
      id: "route-edge.cold-meridian.delayed",
      label: "Commit to the uncertain relay",
      fromNodeId: "route-node.cold-meridian.signal-window",
      toNodeId: "route-node.cold-meridian.late-relay",
      routeId: "route.cold-meridian.delayed",
      when: { kind: "flag", flag: "cold-meridian.wrong-inference", equals: true },
      actions: [],
    },
    {
      id: "route-edge.cold-meridian.recover",
      label: "Use the new vehicle trace to recover",
      fromNodeId: "route-node.cold-meridian.late-relay",
      toNodeId: "route-node.cold-meridian.primary-relay",
      routeId: "route.cold-meridian.delayed",
      when: { kind: "flag", flag: "multi.fact.fact.late-arrival.secondary-vehicle", equals: true },
      actions: [],
    },
  ],
  requiredReconvergenceNodeId: "route-node.cold-meridian.primary-relay",
} as const;

export const coldMeridianSpecializedModes = {
  manifestVersion: 1,
  projectId: COLD_MERIDIAN_RUNTIME_PROJECT_ID,
  modes: [
    {
      id: "specialized-mode.cold-meridian.intervention",
      kind: "action",
      trigger: { kind: "interaction-consumed", interactionId: "interaction.cold-meridian.start-intervention" },
      once: true,
      sceneId: "scene.cold-meridian.intervention",
      entranceId: "entrance.cold-meridian.intervention",
      startStateId: "stabilise",
      return: { kind: "previous-location" },
      states: [
        {
          id: "stabilise",
          onEnterActions: [{ kind: "set-flag", flag: "cold-meridian.intervention-active", value: true }],
          inputRegions: [
            {
              id: "stabilise-array",
              label: "Stabilise the relay array",
              shape: rect(48, 76, 86, 58),
              nextStateId: "cut-power",
            },
          ],
          timeout: {
            afterTicks: 120,
            actions: [{ kind: "set-flag", flag: "cold-meridian.intervention-failed", value: true }],
            finishOutcomeId: "failed",
          },
        },
        {
          id: "cut-power",
          inputRegions: [
            {
              id: "cut-cleanly",
              label: "Cut power inside the safe window",
              shape: rect(184, 76, 86, 58),
              actions: [
                { kind: "set-flag", flag: "cold-meridian.intervention-resolved", value: true },
                { kind: "set-flag", flag: "cold-meridian.intervention-active", value: false },
              ],
              finishOutcomeId: "resolved",
            },
          ],
          timeout: {
            afterTicks: 90,
            actions: [{ kind: "set-flag", flag: "cold-meridian.intervention-failed", value: true }],
            finishOutcomeId: "failed",
          },
        },
      ],
    },
  ],
} as const;

export const validateColdMeridianRuntimeSource = () => {
  const issues = validateSceneInstanceManifest(
    {
      projectId: coldMeridianProject.id,
      scenes: coldMeridianProject.scenes,
      actors: coldMeridianProject.actors,
      assets: coldMeridianProject.assets,
      inventoryItems: coldMeridianProject.inventoryItems,
      dialogues: coldMeridianProject.dialogues,
      sequences: coldMeridianProject.sequences,
    },
    coldMeridianSceneInstances,
  ).map((issue) => `${issue.code}: ${issue.message}`);
  const manifests = [
    coldMeridianMultiProtagonist,
    coldMeridianMultiProtagonistBindings,
    coldMeridianInvestigation,
    coldMeridianInvestigationBindings,
    coldMeridianRoomScripts,
    coldMeridianRouteTopology,
    coldMeridianSpecializedModes,
  ];
  for (const manifest of manifests) {
    if (manifest.projectId !== coldMeridianProject.id) issues.push("Cold Meridian sidecar project identity mismatch.");
  }
  return { valid: issues.length === 0, issues };
};

export const evaluateColdMeridianPackagedReadiness = (evidence: {
  readonly compiledBundleReady?: boolean;
  readonly directRouteReplayReady?: boolean;
  readonly delayedRouteReplayReady?: boolean;
  readonly actionFailureRetryReplayReady?: boolean;
  readonly protagonistSwitchReplayReady?: boolean;
} = {}) => {
  const source = validateColdMeridianRuntimeSource();
  const issues = [...source.issues];
  if (!evidence.compiledBundleReady) issues.push("compiled-bundle-missing");
  if (!evidence.directRouteReplayReady) issues.push("direct-route-replay-missing");
  if (!evidence.delayedRouteReplayReady) issues.push("delayed-route-replay-missing");
  if (!evidence.actionFailureRetryReplayReady) issues.push("action-failure-retry-replay-missing");
  if (!evidence.protagonistSwitchReplayReady) issues.push("protagonist-switch-replay-missing");
  return {
    authoredReady: source.valid,
    packagedPlayableReady:
      source.valid &&
      evidence.compiledBundleReady === true &&
      evidence.directRouteReplayReady === true &&
      evidence.delayedRouteReplayReady === true &&
      evidence.actionFailureRetryReplayReady === true &&
      evidence.protagonistSwitchReplayReady === true,
    issues,
  };
};
