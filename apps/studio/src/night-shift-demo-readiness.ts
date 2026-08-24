import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { IndexedAssetManifest } from "@evavo/adventure-asset-contract/indexed-assets";
import type { PeriodVgaAuditReport } from "@evavo/adventure-art-direction/period-vga-audit";
import { validateAudioMixManifest } from "@evavo/adventure-audio";
import { validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { nightShiftCompleteInstances } from "./night-shift-complete-proof.js";
import {
  nightShiftRuntimeContracts,
  nightShiftRuntimeProject,
} from "./night-shift-runtime-contracts.js";
import { nightShiftRuntimeStaging } from "./night-shift-runtime-staging.js";
import { validateSceneDirectorStagingAudioCues } from "./scene-director-audio-readiness.js";
import { validateNightShiftUiContracts } from "./night-shift-ui-contracts.js";

export type NightShiftDemoReadinessGateId =
  | "project-composition-staging"
  | "front-end"
  | "lifecycle"
  | "audio-contract"
  | "ui-contract"
  | "compiled-assets"
  | "indexed-assets"
  | "period-vga"
  | "packaged-bundle"
  | "replay-evidence"
  | "native-screenshots";

export interface NightShiftDemoReadinessGate {
  readonly id: NightShiftDemoReadinessGateId;
  readonly phase: "authored" | "evidence";
  readonly status: "ready" | "blocked";
  readonly message: string;
}

export interface NightShiftDemoEvidence {
  readonly assetManifest?: AssetBuildManifest | null;
  readonly indexedAssets?: IndexedAssetManifest | null;
  readonly periodVgaReport?: PeriodVgaAuditReport | null;
  readonly packagedBundleReady?: boolean;
  readonly deterministicReplayCount?: number;
  readonly nativeScreenshotCount?: number;
}

export interface NightShiftDemoReadinessReport {
  readonly reportVersion: 1;
  readonly projectId: string;
  readonly authoredReady: boolean;
  readonly shippableReady: boolean;
  readonly gates: readonly NightShiftDemoReadinessGate[];
}

const gate = (
  id: NightShiftDemoReadinessGateId,
  phase: NightShiftDemoReadinessGate["phase"],
  ready: boolean,
  readyMessage: string,
  blockedMessage: string,
): NightShiftDemoReadinessGate => ({
  id,
  phase,
  status: ready ? "ready" : "blocked",
  message: ready ? readyMessage : blockedMessage,
});

const authoredCoreReady = (): boolean => {
  const instanceIssues = validateSceneInstanceManifest(
    {
      projectId: nightShiftRuntimeProject.id,
      scenes: nightShiftRuntimeProject.scenes,
      actors: nightShiftRuntimeProject.actors,
      assets: nightShiftRuntimeProject.assets,
      inventoryItems: nightShiftRuntimeProject.inventoryItems,
      dialogues: nightShiftRuntimeProject.dialogues,
      sequences: nightShiftRuntimeProject.sequences,
    },
    nightShiftCompleteInstances,
  );
  const stagingIssues = validateSceneStagingManifest(
    {
      projectId: nightShiftRuntimeProject.id,
      scenes: nightShiftRuntimeProject.scenes,
      actors: nightShiftRuntimeProject.actors,
      assets: nightShiftRuntimeProject.assets,
      sequences: nightShiftRuntimeProject.sequences,
      sceneInstances: nightShiftCompleteInstances,
    },
    nightShiftRuntimeStaging,
  );
  return instanceIssues.length === 0 && stagingIssues.length === 0;
};

const audioReady = (): boolean =>
  validateAudioMixManifest(nightShiftRuntimeProject, nightShiftRuntimeContracts.audioMix).length === 0 &&
  validateSceneDirectorStagingAudioCues(
    nightShiftRuntimeStaging,
    nightShiftRuntimeContracts.audioMix,
  ).length === 0;

const expectedIndexedVisualAssets = new Set([
  "asset.night-shift.background.station",
  "asset.night-shift.background.roadside",
  "asset.night-shift.background.diner",
  "asset.night-shift.actor.officer",
  "asset.night-shift.actor.sergeant",
  "asset.night-shift.actor.driver",
  "asset.night-shift.actor.server",
]);

export const evaluateNightShiftDemoReadiness = (
  evidence: NightShiftDemoEvidence = {},
): NightShiftDemoReadinessReport => {
  const authoredCore = authoredCoreReady();
  const frontEndReady = nightShiftRuntimeContracts.frontEnd.projectId === nightShiftRuntimeProject.id;
  const lifecycleReady =
    nightShiftRuntimeContracts.lifecycle.projectId === nightShiftRuntimeProject.id &&
    nightShiftRuntimeContracts.lifecycle.outcomes.some((outcome) => outcome.kind === "failure") &&
    nightShiftRuntimeContracts.lifecycle.outcomes.some((outcome) => outcome.kind === "success");
  const audioContractReady = audioReady();
  const uiContractReady = validateNightShiftUiContracts().length === 0;
  const compiledAssetsReady =
    evidence.assetManifest?.projectId === nightShiftRuntimeProject.id &&
    evidence.assetManifest.assets.length > 0;
  const indexedIds = new Set(evidence.indexedAssets?.assets.map((record) => record.assetId as string) ?? []);
  const indexedReady =
    evidence.indexedAssets?.projectId === nightShiftRuntimeProject.id &&
    [...expectedIndexedVisualAssets].every((assetId) => indexedIds.has(assetId));
  const periodVgaReady =
    evidence.periodVgaReport?.projectId === nightShiftRuntimeProject.id &&
    evidence.periodVgaReport.status === "ready";
  const packagedReady = evidence.packagedBundleReady === true;
  const replayReady = (evidence.deterministicReplayCount ?? 0) >= 2;
  const screenshotReady = (evidence.nativeScreenshotCount ?? 0) >= 6;

  const gates: NightShiftDemoReadinessGate[] = [
    gate(
      "project-composition-staging",
      "authored",
      authoredCore,
      "Three-room project, composition and production staging semantics are valid.",
      "Project/composition/production staging semantics still contain blocking issues.",
    ),
    gate(
      "front-end",
      "authored",
      frontEndReady,
      "Classic front-end contract belongs to the proof project.",
      "Classic front-end contract is missing or mismatched.",
    ),
    gate(
      "lifecycle",
      "authored",
      lifecycleReady,
      "Failure and success lifecycle outcomes are authored.",
      "Failure/success lifecycle outcomes are incomplete.",
    ),
    gate(
      "audio-contract",
      "authored",
      audioContractReady,
      "Every emitted production staging cue resolves through a valid audio mix.",
      "Audio mix or production staging cue coverage contains blocking issues.",
    ),
    gate(
      "ui-contract",
      "authored",
      uiContractReady,
      "Early-SCI1 icon bar, score, inventory and bitmap-font contracts are valid.",
      "Native icon-bar UI or bitmap-font contracts contain blocking issues.",
    ),
    gate(
      "compiled-assets",
      "evidence",
      compiledAssetsReady,
      "Compiled asset manifest is present for the proof project.",
      "Compile the final visual/audio/UI assets and retain their manifest evidence.",
    ),
    gate(
      "indexed-assets",
      "evidence",
      indexedReady,
      "Station, roadside, diner and principal actor art have indexed runtime maps.",
      "Produce indexed maps for all three backgrounds and principal actor sprites.",
    ),
    gate(
      "period-vga",
      "evidence",
      periodVgaReady,
      "Period VGA art audit is approved at native and integer scale.",
      "Retain compiled pixel evidence and pass the Period VGA native-art audit.",
    ),
    gate(
      "packaged-bundle",
      "evidence",
      packagedReady,
      "A packaged runtime bundle exists and has passed runtime parsing.",
      "Build and parse the real packaged Night Shift runtime bundle.",
    ),
    gate(
      "replay-evidence",
      "evidence",
      replayReady,
      "Deterministic success and failure replay evidence is retained.",
      "Retain at least success-path and failure/retry deterministic replays.",
    ),
    gate(
      "native-screenshots",
      "evidence",
      screenshotReady,
      "Native screenshot evidence covers the three-room proof and system states.",
      "Retain at least six raw 1× screenshots covering station, roadside, diner and outcome states.",
    ),
  ];

  const authoredReady = gates
    .filter((candidate) => candidate.phase === "authored")
    .every((candidate) => candidate.status === "ready");
  const shippableReady = authoredReady && gates.every((candidate) => candidate.status === "ready");

  return {
    reportVersion: 1,
    projectId: nightShiftRuntimeProject.id,
    authoredReady,
    shippableReady,
    gates,
  };
};
