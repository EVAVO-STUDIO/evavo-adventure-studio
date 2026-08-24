import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { IndexedAssetManifest } from "@evavo/adventure-asset-contract/indexed-assets";
import type { PeriodVgaAuditReport } from "@evavo/adventure-art-direction/period-vga-audit";
import { validateAudioMixManifest } from "@evavo/adventure-audio";
import { validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import type { NightShiftArtIntakeReport } from "./night-shift-art-master-intake.js";
import type { NightShiftAudioIntakeReport } from "./night-shift-audio-master-intake.js";
import { nightShiftCompleteInstances } from "./night-shift-complete-proof.js";
import {
  nightShiftIndexedProductionAssetIds,
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
  validateNightShiftProductionAssetPlan,
} from "./night-shift-production-assets.js";
import { validateNightShiftProductionWaves } from "./night-shift-production-waves.js";
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
  | "production-asset-plan"
  | "art-master-intake"
  | "audio-master-intake"
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
  readonly artMasterIntake?: NightShiftArtIntakeReport | null;
  readonly audioMasterIntake?: NightShiftAudioIntakeReport | null;
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

const allExpectedAssetsCompiled = (manifest: AssetBuildManifest | null | undefined): boolean => {
  if (manifest?.projectId !== nightShiftRuntimeProject.id) return false;
  const compiled = new Set(manifest.assets.map((asset) => asset.assetId as string));
  return nightShiftProductionAssets.every((asset) => compiled.has(asset.assetId));
};

const allExpectedIndexedAssetsPresent = (
  manifest: IndexedAssetManifest | null | undefined,
): boolean => {
  if (manifest?.projectId !== nightShiftRuntimeProject.id) return false;
  const indexed = new Set(manifest.assets.map((record) => record.assetId as string));
  return nightShiftIndexedProductionAssetIds.every((assetId) => indexed.has(assetId));
};

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
  const productionAssetPlanReady =
    validateNightShiftProductionAssetPlan().length === 0 &&
    validateNightShiftProductionWaves().length === 0;
  const artMasterReady = evidence.artMasterIntake?.status === "ready";
  const audioMasterReady = evidence.audioMasterIntake?.status === "ready";
  const compiledAssetsReady = allExpectedAssetsCompiled(evidence.assetManifest);
  const indexedReady = allExpectedIndexedAssetsPresent(evidence.indexedAssets);
  const periodVgaReady =
    evidence.periodVgaReport?.projectId === nightShiftRuntimeProject.id &&
    evidence.periodVgaReport.status === "ready" &&
    evidence.periodVgaReport.evidenceAssets >= nightShiftPeriodVgaProductionAssetIds.length &&
    evidence.periodVgaReport.reviewedAssets >= nightShiftPeriodVgaProductionAssetIds.length;
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
      "production-asset-plan",
      "authored",
      productionAssetPlanReady,
      "Every runtime asset has a native production requirement and exactly one ordered build wave.",
      "Runtime assets, production requirements or Foundation/Station/Roadside/Diner wave assignments are out of sync.",
    ),
    gate(
      "art-master-intake",
      "evidence",
      artMasterReady,
      "Every required native visual master passed the Night Shift intake gate.",
      "Submit every Period VGA visual master through native-size/palette/alpha/source-format intake before compilation.",
    ),
    gate(
      "audio-master-intake",
      "evidence",
      audioMasterReady,
      "Every required WAV master passed the Night Shift audio intake gate.",
      "Submit every effect and ambience WAV through format/rate/channel/duration intake before compilation.",
    ),
    gate(
      "compiled-assets",
      "evidence",
      compiledAssetsReady,
      `All ${nightShiftProductionAssets.length} required runtime assets are represented in the compiled manifest.`,
      `Compile all ${nightShiftProductionAssets.length} required visual/audio/UI/palette assets; a partial manifest does not satisfy the proof.`,
    ),
    gate(
      "indexed-assets",
      "evidence",
      indexedReady,
      `All ${nightShiftIndexedProductionAssetIds.length} indexed masters have verified runtime index maps.`,
      `Produce verified .idx maps for all ${nightShiftIndexedProductionAssetIds.length} indexed backgrounds, actors, props, font and UI icons.`,
    ),
    gate(
      "period-vga",
      "evidence",
      periodVgaReady,
      `Period VGA audit covers all ${nightShiftPeriodVgaProductionAssetIds.length} required visual masters at native and integer scale.`,
      `Retain compiled pixel evidence and native-art approval for all ${nightShiftPeriodVgaProductionAssetIds.length} Period VGA visual masters.`,
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
      "Deterministic success and failure/retry replay evidence is retained.",
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
