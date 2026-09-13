import type { AdventureCapabilityId } from "./full-game-capabilities.js";
import type { AdventureSceneArchetypeId } from "./scene-archetypes.js";
import type { AdventureCreativeIterationDecisionV3 } from "./creative-production-orchestrator-v3.js";

export type NinthReliquaryStressChapterId =
  | "old-city-square"
  | "archive-hidden-chapel"
  | "night-train-mountain-hospice";

export interface NinthReliquaryStressChapter {
  readonly id: NinthReliquaryStressChapterId;
  readonly label: string;
  readonly purpose: string;
  readonly archetypes: readonly AdventureSceneArchetypeId[];
  readonly requiredCapabilities: readonly AdventureCapabilityId[];
  readonly proofQuestions: readonly string[];
}

export const ninthReliquaryStressChapters: readonly NinthReliquaryStressChapter[] = [
  {
    id: "old-city-square",
    label: "Old-city square and café",
    purpose: "Prove modern hand-painted exploration, readable urban staging, contextual investigation and a hard editorial incident without modern quest-HUD dependence.",
    archetypes: ["classic-room", "hub-location", "dialogue-closeup", "state-variant-room", "cinematic-inset"],
    requiredCapabilities: [
      "fixed-room",
      "walk-regions",
      "per-region-perspective",
      "multi-plane-occlusion",
      "preferred-approach",
      "context-interface",
      "conditional-hotspots",
      "in-scene-dialogue",
      "branching-dialogue",
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "room-state-variants",
      "cutscene-sequences",
      "room-cutaways",
      "deterministic-save-replay",
    ],
    proofQuestions: [
      "Does the square read as a specific believable place at native 640×360 without generated-detail noise?",
      "Can investigation clues be found through composition, dialogue and object inspection rather than modern markers?",
      "Does the street incident cutaway return to the exact playable room state and camera logic?",
    ],
  },
  {
    id: "archive-hidden-chapel",
    label: "Conservation archive and hidden chapel",
    purpose: "Prove research-driven conspiracy progression, evidence close-ups, stairs/elevation, foreground occlusion and a temporary cinematic discovery insert.",
    archetypes: ["investigation-research", "multi-level-interior", "puzzle-closeup", "cinematic-inset", "chapter-transition"],
    requiredCapabilities: [
      "research-investigation-loop",
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "chapter-day-progression",
      "closeup-puzzle-view",
      "multi-elevation-room",
      "multi-plane-occlusion",
      "stateful-navigation",
      "room-cutaways",
      "cutscene-sequences",
      "global-progression-graph",
      "deterministic-save-replay",
    ],
    proofQuestions: [
      "Can a research source reveal a fact/topic with provenance and unlock the hidden-chapel route without flag soup?",
      "Do stairs/landings alter actor depth and occlusion coherently without scale or draw-order pops?",
      "Can a close-up evidence inspection and chapel cutaway save/restore and return without losing investigation state?",
    ],
  },
  {
    id: "night-train-mountain-hospice",
    label: "Night train and mountain hospice",
    purpose: "Prove travel, protagonist switching, independent character knowledge/inventory, evidence exchange, branch topology and a hand-animated confrontation.",
    archetypes: ["vehicle-interior", "travel-map", "multi-protagonist-cross-state", "cutaway-montage", "action-insert"],
    requiredCapabilities: [
      "vehicle-scene",
      "travel-map",
      "multi-protagonist-switching",
      "branching-route-topology",
      "inventory",
      "item-on-object",
      "item-on-item",
      "alternate-puzzle-solutions",
      "cutscene-sequences",
      "room-cutaways",
      "action-minigame",
      "failure-retry",
      "deterministic-save-replay",
    ],
    proofQuestions: [
      "Can each protagonist retain independent room/inventory/local knowledge while shared conspiracy facts remain global?",
      "Can evidence be exchanged deliberately without collapsing all inventories into one bag?",
      "Does the confrontation use an authored deterministic mode/cutaway and return to the correct route outcome?",
    ],
  },
] as const;

export const ninthReliquaryRequiredCapabilities: readonly AdventureCapabilityId[] = [
  ...new Set(ninthReliquaryStressChapters.flatMap((chapter) => chapter.requiredCapabilities)),
].sort((left, right) => left.localeCompare(right));

export type NinthReliquaryCreativeProofAssetId =
  | "squareLayout"
  | "squareBackground"
  | "squareForeground"
  | "maraModelSheet"
  | "maraWalkEast"
  | "maraInspect"
  | "chapelCutaway";

export interface NinthReliquaryFullGameEvidence {
  readonly runtime: {
    readonly investigationGraph: boolean;
    readonly roomScriptsAndCutawayReturn: boolean;
    readonly multiProtagonistSession: boolean;
    readonly routeTopology: boolean;
    readonly specializedModeReturn: boolean;
    readonly deterministicSaveReplay: boolean;
  };
  readonly creativeDecisions: Readonly<
    Partial<Record<NinthReliquaryCreativeProofAssetId, AdventureCreativeIterationDecisionV3["kind"]>>
  >;
  readonly retainedEvidence: {
    readonly nativeScreenshots: number;
    readonly completePlaythroughReplay: boolean;
    readonly cutawayReturnReplay: boolean;
    readonly protagonistSwitchReplay: boolean;
    readonly creativeDeliveryReceipts: number;
  };
}

export type NinthReliquaryProofStage = "authored-ready" | "creative-ready" | "full-proof-ready";

export interface NinthReliquaryFullGameReadiness {
  readonly stage: NinthReliquaryProofStage;
  readonly authoredReady: boolean;
  readonly creativeReady: boolean;
  readonly fullProofReady: boolean;
  readonly capabilityCount: number;
  readonly creativeDeliveryCount: number;
  readonly blockers: readonly string[];
}

const requiredCreativeAssets: readonly NinthReliquaryCreativeProofAssetId[] = [
  "squareLayout",
  "squareBackground",
  "squareForeground",
  "maraModelSheet",
  "maraWalkEast",
  "maraInspect",
  "chapelCutaway",
];

export const evaluateNinthReliquaryFullGameReadiness = (
  evidence: NinthReliquaryFullGameEvidence,
): NinthReliquaryFullGameReadiness => {
  const blockers: string[] = [];
  const runtimeEntries = Object.entries(evidence.runtime) as readonly [string, boolean][];
  for (const [key, ready] of runtimeEntries) {
    if (!ready) blockers.push(`Runtime proof missing: ${key}.`);
  }
  const authoredReady = runtimeEntries.every(([, ready]) => ready);

  const creativeDeliveryCount = requiredCreativeAssets.filter(
    (assetId) => evidence.creativeDecisions[assetId] === "deliver",
  ).length;
  for (const assetId of requiredCreativeAssets) {
    const decision = evidence.creativeDecisions[assetId];
    if (decision !== "deliver") {
      blockers.push(
        `Creative proof '${assetId}' has not reached deliver${decision ? ` (current: ${decision})` : ""}.`,
      );
    }
  }
  const creativeReady = authoredReady && creativeDeliveryCount === requiredCreativeAssets.length;

  if (evidence.retainedEvidence.nativeScreenshots < 8) {
    blockers.push(
      `Full-game proof requires at least 8 retained native screenshots; received ${evidence.retainedEvidence.nativeScreenshots}.`,
    );
  }
  if (!evidence.retainedEvidence.completePlaythroughReplay) blockers.push("Complete playthrough replay is missing.");
  if (!evidence.retainedEvidence.cutawayReturnReplay) blockers.push("Cutaway-return replay evidence is missing.");
  if (!evidence.retainedEvidence.protagonistSwitchReplay) blockers.push("Protagonist-switch replay evidence is missing.");
  if (evidence.retainedEvidence.creativeDeliveryReceipts < requiredCreativeAssets.length) {
    blockers.push(
      `Accepted creative delivery receipts are incomplete (${evidence.retainedEvidence.creativeDeliveryReceipts}/${requiredCreativeAssets.length}).`,
    );
  }
  const fullProofReady =
    creativeReady &&
    evidence.retainedEvidence.nativeScreenshots >= 8 &&
    evidence.retainedEvidence.completePlaythroughReplay &&
    evidence.retainedEvidence.cutawayReturnReplay &&
    evidence.retainedEvidence.protagonistSwitchReplay &&
    evidence.retainedEvidence.creativeDeliveryReceipts >= requiredCreativeAssets.length;

  return {
    stage: fullProofReady ? "full-proof-ready" : creativeReady ? "creative-ready" : "authored-ready",
    authoredReady,
    creativeReady,
    fullProofReady,
    capabilityCount: ninthReliquaryRequiredCapabilities.length,
    creativeDeliveryCount,
    blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)),
  };
};
