import { parseAdventureDesignDocument } from "@evavo/adventure-design";
import { showcaseAdventureDesigns } from "@evavo/adventure-design/showcases";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";

const scene = (
  id: string,
  name: string,
  backgroundAssetId: string,
  entranceId: string,
  entranceX: number,
  hotspots: readonly unknown[] = [],
) => ({
  id,
  name,
  width: 320,
  height: 200,
  backgroundAssetId,
  navigationAreas: [
    {
      id: `navigation.${id.split(".").at(-1)}`,
      shape: {
        points: [
          { x: 8, y: 108 },
          { x: 312, y: 108 },
          { x: 312, y: 194 },
          { x: 8, y: 194 },
        ],
      },
      elevation: 0,
    },
  ],
  depthBands: [
    {
      id: `depth.${id.split(".").at(-1)}`,
      farY: 108,
      nearY: 194,
      farScale: 0.68,
      nearScale: 1.03,
    },
  ],
  occluders: [],
  hotspots,
  entrances: [
    {
      id: entranceId,
      position: { x: entranceX, y: 170 },
      facing: entranceX < 160 ? "east" : "west",
    },
  ],
  fallbackText: "The route offers no further answer yet.",
});

export const progressionProject = parseAdventureProject({
  schemaVersion: 1,
  id: "project.progression.red-ledger",
  title: "The Red Ledger: Harbour Route",
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
  startSceneId: "scene.archive",
  startEntranceId: "entrance.archive.front",
  scenes: [
    scene(
      "scene.archive",
      "Municipal Archive",
      "asset.background.archive",
      "entrance.archive.front",
      36,
    ),
    scene(
      "scene.alley",
      "Service Alley",
      "asset.background.alley",
      "entrance.alley.archive",
      40,
      [
        {
          id: "hotspot.alley.witness",
          name: "Waiting witness",
          shape: {
            points: [
              { x: 210, y: 90 },
              { x: 262, y: 90 },
              { x: 262, y: 178 },
              { x: 210, y: 178 },
            ],
          },
          walkTo: { x: 194, y: 166 },
          cursor: "talk",
          interactions: [
            {
              id: "interaction.alley.witness",
              verb: "talk",
              once: true,
              actions: [
                {
                  kind: "start-dialogue",
                  dialogueId: "dialogue.witness",
                },
              ],
            },
          ],
          fallbackText: "The witness studies the rain instead of volunteering a route.",
        },
      ],
    ),
    scene(
      "scene.quay",
      "Cinder Quay",
      "asset.background.quay",
      "entrance.quay.alley",
      52,
    ),
  ],
  actors: [],
  dialogues: [
    {
      id: "dialogue.witness",
      name: "The night witness",
      startNodeId: "dialogue-node.witness.start",
      nodes: [
        {
          id: "dialogue-node.witness.start",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.witness.arrival",
              text: "You came through the archive door. Then you already have half the route.",
            },
          ],
          choices: [
            {
              id: "dialogue-choice.witness.ledger",
              text: "Ask where the red account was carried",
              once: true,
              actions: [
                {
                  kind: "play-sequence",
                  sequenceId: "sequence.witness-route",
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
      id: "sequence.witness-route",
      name: "The route to Cinder Quay",
      mode: "cutscene",
      durationTicks: 96,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: {
        allowed: true,
        safeAfterTick: 0,
        completionActions: [
          {
            kind: "change-scene",
            sceneId: "scene.quay",
            entranceId: "entrance.quay.alley",
          },
        ],
      },
      tracks: [
        {
          id: "sequence-track.witness.story",
          kind: "story",
          cues: [
            {
              kind: "story-action",
              atTick: 42,
              action: {
                kind: "set-flag",
                flag: "witness.route-revealed",
                value: true,
              },
            },
          ],
        },
      ],
    },
  ],
  assets: [
    {
      id: "asset.background.archive",
      path: "art/red-ledger/archive.png",
      kind: "image",
    },
    {
      id: "asset.background.alley",
      path: "art/red-ledger/alley.png",
      kind: "image",
    },
    {
      id: "asset.background.quay",
      path: "art/red-ledger/quay.png",
      kind: "image",
    },
    {
      id: "asset.red-ledger.key",
      path: "art/red-ledger/archive-key.png",
      kind: "image",
    },
    {
      id: "asset.red-ledger.drawer",
      path: "art/red-ledger/drawer.aseprite",
      kind: "spritesheet",
    },
    {
      id: "asset.red-ledger.door",
      path: "art/red-ledger/service-door.aseprite",
      kind: "spritesheet",
    },
    {
      id: "asset.red-ledger.shredder",
      path: "art/red-ledger/evidence-disposal.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [
    {
      id: "item.red-ledger.tool",
      name: "Archive service key",
      description: "A brass service key with fresh vermilion caught in the wards.",
      iconAssetId: "asset.red-ledger.key",
    },
  ],
});

const baseSceneInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: progressionProject.id,
  objectDefinitions: [
    {
      id: "object-definition.progression.drawer",
      name: "Ledger drawer",
      initialStateId: "object-state.progression.drawer.closed",
      states: [
        {
          id: "object-state.progression.drawer.closed",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.red-ledger.drawer",
            frameId: "frame.progression.drawer.closed",
            sourceRect: { x: 0, y: 0, width: 42, height: 25 },
            sourceSize: { width: 42, height: 25 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 21, y: 24 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 42, y: 0 },
              { x: 42, y: 25 },
              { x: 0, y: 25 },
            ],
          },
          walkToOffset: { x: -30, y: 16 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.progression.drawer.open",
              verb: "open",
              once: true,
              actions: [
                {
                  kind: "give-item",
                  itemId: "item.red-ledger.tool",
                },
                {
                  kind: "set-object-state",
                  objectId: "object.progression.drawer",
                  state: "object-state.progression.drawer.open",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.progression.drawer.open",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.red-ledger.drawer",
            frameId: "frame.progression.drawer.open",
            sourceRect: { x: 42, y: 0, width: 42, height: 25 },
            sourceSize: { width: 42, height: 25 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 21, y: 24 },
          },
          interactions: [],
        },
      ],
    },
    {
      id: "object-definition.progression.door",
      name: "Archive service door",
      initialStateId: "object-state.progression.door.locked",
      states: [
        {
          id: "object-state.progression.door.locked",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.red-ledger.door",
            frameId: "frame.progression.door.locked",
            sourceRect: { x: 0, y: 0, width: 42, height: 78 },
            sourceSize: { width: 42, height: 78 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 21, y: 77 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 42, y: 0 },
              { x: 42, y: 78 },
              { x: 0, y: 78 },
            ],
          },
          walkToOffset: { x: -24, y: 8 },
          faceDirection: "east",
          cursor: "enter",
          interactions: [
            {
              id: "interaction.progression.door.unlock",
              verb: "use",
              itemId: "item.red-ledger.tool",
              once: true,
              actions: [
                {
                  kind: "change-scene",
                  sceneId: "scene.alley",
                  entranceId: "entrance.alley.archive",
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
      sceneId: "scene.archive",
      actorInstances: [],
      objectInstances: [
        {
          id: "object.progression.drawer",
          definitionId: "object-definition.progression.drawer",
          position: { x: 144, y: 150 },
          layer: "world",
        },
        {
          id: "object.progression.door",
          definitionId: "object-definition.progression.door",
          position: { x: 286, y: 164 },
          layer: "world",
        },
      ],
      navigationPortals: [],
    },
  ],
});

const redLedgerDesign = showcaseAdventureDesigns.find(
  (candidate) => candidate.title === "The Red Ledger",
);
if (!redLedgerDesign) {
  throw new Error("The Red Ledger showcase design is missing.");
}
const chapterId = redLedgerDesign.chapters[0]?.id;
const puzzleId = redLedgerDesign.puzzles[0]?.id;
if (!chapterId || !puzzleId) {
  throw new Error("The Red Ledger showcase progression is incomplete.");
}

export const progressionDesign = parseAdventureDesignDocument({
  ...redLedgerDesign,
  projectId: progressionProject.id,
  title: progressionProject.title,
  pitch:
    "Trace an impossible debt from a locked municipal archive to Cinder Quay " +
    "without losing the recoverable evidence route.",
  playerPromise:
    "Observe, question and preserve a deterministic investigative chain across " +
    "object, dialogue and cinematic state.",
  map: {
    title: "Archive to harbour progression",
    artBrief:
      "An inked city route that makes investigation geography, access changes " +
      "and branch recovery visible without reading like a modern GPS screen.",
    locations: [
      {
        id: "location.progression.archive",
        name: "Municipal Archive",
        kind: "scene",
        position: { x: 52, y: 126 },
        sceneId: "scene.archive",
        chapterIds: [chapterId],
        unlockedByPuzzleIds: [],
        artBrief:
          "A compressed lamplit office with the disturbed drawer and service door " +
          "separated into distinct focal islands.",
        arrivalBeat:
          "The locked service door and disturbed drawer establish the immediate " +
          "route problem before the key is recovered.",
        musicCue: "red-ledger.archive-night",
      },
      {
        id: "location.progression.alley",
        name: "Service Alley",
        kind: "scene",
        position: { x: 164, y: 88 },
        sceneId: "scene.alley",
        chapterIds: [chapterId],
        unlockedByPuzzleIds: [puzzleId],
        artBrief:
          "Rain and hard coat silhouettes funnel attention toward the waiting " +
          "witness and away from decorative harbour clutter.",
        arrivalBeat:
          "The witness becomes the only reliable route onward, turning conversation " +
          "into geography rather than optional exposition.",
        musicCue: "red-ledger.alley-rain",
      },
      {
        id: "location.progression.quay",
        name: "Cinder Quay",
        kind: "hub",
        position: { x: 272, y: 126 },
        sceneId: "scene.quay",
        chapterIds: [chapterId],
        unlockedByPuzzleIds: [puzzleId],
        artBrief:
          "Harbour scale, wet stone and a restrained red evidence accent pay off the " +
          "route without flattening the quay into a travel postcard.",
        arrivalBeat:
          "The cinematic returns control with the forged account geographically " +
          "grounded and the next investigation question visible.",
        musicCue: "red-ledger.cinder-quay",
      },
    ],
    routes: [
      {
        id: "route.progression.archive-alley",
        fromLocationId: "location.progression.archive",
        toLocationId: "location.progression.alley",
        bidirectional: false,
        travelMode: "locked service door",
        transition: "A hard rain cut carries the opened door into the alley arrival pose.",
        requiredPuzzleIds: [puzzleId],
      },
      {
        id: "route.progression.alley-quay",
        fromLocationId: "location.progression.alley",
        toLocationId: "location.progression.quay",
        bidirectional: false,
        travelMode: "witness-guided harbour route",
        transition:
          "A short two-shot route reveal preserves the witness eyeline and returns control on the quay.",
        requiredPuzzleIds: [puzzleId],
      },
    ],
  },
  chapters: redLedgerDesign.chapters.map((chapter, index) =>
    index === 0
      ? {
          ...chapter,
          startLocationId: "location.progression.archive",
          unlockedLocationIds: [
            "location.progression.archive",
            "location.progression.alley",
            "location.progression.quay",
          ],
        }
      : chapter,
  ),
  clues: redLedgerDesign.clues.map((clue) => ({
    ...clue,
    locationId: "location.progression.archive",
    chapterId,
  })),
  puzzles: redLedgerDesign.puzzles.map((puzzle, index) =>
    index === 0
      ? {
          ...puzzle,
          chapterId,
          locationId: "location.progression.archive",
          solutions: puzzle.solutions.map((solution) => ({
            ...solution,
            steps: solution.steps.map((step, stepIndex) =>
              stepIndex === solution.steps.length - 1
                ? { ...step, itemId: "item.red-ledger.tool" }
                : step,
            ),
          })),
        }
      : puzzle,
  ),
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const withoutKey = clone(baseSceneInstances);
withoutKey.objectDefinitions = withoutKey.objectDefinitions.map((definition) =>
  definition.id === "object-definition.progression.drawer"
    ? {
        ...definition,
        states: definition.states.map((state) =>
          state.id === "object-state.progression.drawer.closed"
            ? {
                ...state,
                interactions: state.interactions.map((interaction) => ({
                  ...interaction,
                  actions: interaction.actions.filter(
                    (action) => action.kind !== "give-item",
                  ),
                })),
              }
            : state,
        ),
      }
    : definition,
);

const withDiscardBranch = parseSceneInstanceManifest({
  ...clone(baseSceneInstances),
  objectDefinitions: [
    ...clone(baseSceneInstances.objectDefinitions),
    {
      id: "object-definition.progression.shredder",
      name: "Evidence shredder",
      initialStateId: "object-state.progression.shredder.ready",
      states: [
        {
          id: "object-state.progression.shredder.ready",
          visual: {
            kind: "sprite-frame",
            assetId: "asset.red-ledger.shredder",
            frameId: "frame.progression.shredder.ready",
            sourceRect: { x: 0, y: 0, width: 30, height: 24 },
            sourceSize: { width: 30, height: 24 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 15, y: 23 },
          },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
              { x: 30, y: 24 },
              { x: 0, y: 24 },
            ],
          },
          walkToOffset: { x: -24, y: 12 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.progression.shredder.discard-key",
              verb: "use",
              itemId: "item.red-ledger.tool",
              once: true,
              actions: [
                {
                  kind: "remove-item",
                  itemId: "item.red-ledger.tool",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  scenes: baseSceneInstances.scenes.map((composition) =>
    composition.sceneId === "scene.archive"
      ? {
          ...clone(composition),
          objectInstances: [
            ...clone(composition.objectInstances),
            {
              id: "object.progression.shredder",
              definitionId: "object-definition.progression.shredder",
              position: { x: 96, y: 156 },
              layer: "world",
            },
          ],
        }
      : clone(composition),
  ),
});

export interface ProgressionScenario {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly sceneInstances: typeof baseSceneInstances;
}

export const progressionScenarios: readonly ProgressionScenario[] = [
  {
    id: "verified",
    label: "Verified harbour route",
    description:
      "The drawer yields the key, the service door opens, the witness dialogue " +
      "starts and the route sequence lands on Cinder Quay.",
    sceneInstances: baseSceneInstances,
  },
  {
    id: "missing-key",
    label: "Missing service key",
    description:
      "The drawer changes state but never gives the required key, so the alley and quay remain unreachable.",
    sceneInstances: withoutKey,
  },
  {
    id: "discard-branch",
    label: "Discarded evidence branch",
    description:
      "A visible evidence-disposal branch can consume the one required key " +
      "after acquisition and leave the player unable to recover the route.",
    sceneInstances: withDiscardBranch,
  },
];
