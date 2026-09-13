import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { IndexedAssetManifest } from "@evavo/adventure-asset-contract/indexed-assets";
import type { PeriodVgaAuditReport } from "@evavo/adventure-art-direction/period-vga-audit";
import type { NightShiftArtIntakeReport } from "./night-shift-art-master-intake.js";
import type { NightShiftAudioIntakeReport } from "./night-shift-audio-master-intake.js";
import { evaluateNightShiftDemoReadiness } from "./night-shift-demo-readiness.js";
import type { NightShiftOfficerMasterIntakeReport } from "./night-shift-officer-master-intake.js";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";
import { nightShiftAssetRequiresRuntimeIndexMap } from "./night-shift-runtime-index-requirements.js";

const stationWaveIds = new Set(["foundation", "station"]);
const stationAssetIds = nightShiftProductionWaves
  .filter((wave) => stationWaveIds.has(wave.id))
  .flatMap((wave) => wave.assetIds);
const stationRequirements = nightShiftProductionAssets.filter((asset) =>
  stationAssetIds.includes(asset.assetId),
);
const stationIndexedAssetIds = stationRequirements
  .filter((asset) => nightShiftAssetRequiresRuntimeIndexMap(asset.assetId))
  .map((asset) => asset.assetId);
const stationVisualAssetIds = stationRequirements
  .filter((asset) => asset.evidence.includes("period-vga"))
  .map((asset) => asset.assetId);
const stationAudioAssetIds = stationRequirements
  .filter((asset) => asset.role === "audio-effect" || asset.role === "audio-ambience")
  .map((asset) => asset.assetId);

export interface NightShiftStationSliceEvidence {
  readonly artMasterIntake?: NightShiftArtIntakeReport | null;
  readonly officerMasterIntake?: NightShiftOfficerMasterIntakeReport | null;
  readonly audioMasterIntake?: NightShiftAudioIntakeReport | null;
  readonly assetManifest?: AssetBuildManifest | null;
  readonly indexedAssets?: IndexedAssetManifest | null;
  readonly periodVgaReport?: PeriodVgaAuditReport | null;
  readonly packagedBundleReady?: boolean;
  readonly deterministicReplayCount?: number;
  readonly nativeScreenshotCount?: number;
}

export interface NightShiftStationSliceReadiness {
  readonly authoredReady: boolean;
  readonly shippableReady: boolean;
  readonly expectedAssetIds: readonly string[];
  readonly missingCompiledAssetIds: readonly string[];
  readonly missingIndexedAssetIds: readonly string[];
  readonly gates: readonly {
    readonly id: string;
    readonly ready: boolean;
    readonly message: string;
  }[];
}

const compiledIds = (manifest: AssetBuildManifest | null | undefined): ReadonlySet<string> =>
  manifest?.projectId === nightShiftRuntimeProject.id
    ? new Set(manifest.assets.map((asset) => asset.assetId as string))
    : new Set();

const indexedIds = (manifest: IndexedAssetManifest | null | undefined): ReadonlySet<string> =>
  manifest?.projectId === nightShiftRuntimeProject.id
    ? new Set(manifest.assets.map((asset) => asset.assetId as string))
    : new Set();

const intakeCovers = (
  expected: readonly string[],
  report: { readonly status: string; readonly missingAssetIds: readonly string[]; readonly issues: readonly unknown[] } | null | undefined,
): boolean =>
  !!report &&
  report.issues.length === 0 &&
  expected.every((assetId) => !report.missingAssetIds.includes(assetId));

export const evaluateNightShiftStationSliceReadiness = (
  evidence: NightShiftStationSliceEvidence = {},
): NightShiftStationSliceReadiness => {
  const fullAuthored = evaluateNightShiftDemoReadiness().authoredReady;
  const compiled = compiledIds(evidence.assetManifest);
  const indexed = indexedIds(evidence.indexedAssets);
  const missingCompiledAssetIds = stationAssetIds.filter((assetId) => !compiled.has(assetId));
  const missingIndexedAssetIds = stationIndexedAssetIds.filter((assetId) => !indexed.has(assetId));
  const artReady = intakeCovers(stationVisualAssetIds, evidence.artMasterIntake);
  const officerReady = evidence.officerMasterIntake?.status === "ready";
  const audioReady = intakeCovers(stationAudioAssetIds, evidence.audioMasterIntake);
  const periodReady =
    evidence.periodVgaReport?.projectId === nightShiftRuntimeProject.id &&
    evidence.periodVgaReport.status === "ready" &&
    evidence.periodVgaReport.evidenceAssets >= stationVisualAssetIds.length &&
    evidence.periodVgaReport.reviewedAssets >= stationVisualAssetIds.length;
  const packageReady = evidence.packagedBundleReady === true;
  const replayReady = (evidence.deterministicReplayCount ?? 0) >= 1;
  const screenshotReady = (evidence.nativeScreenshotCount ?? 0) >= 2;

  const gates = [
    {
      id: "authored-source",
      ready: fullAuthored,
      message: fullAuthored
        ? "The complete Night Shift source contracts are coherent."
        : "Fix authored Night Shift source contracts before building the station slice.",
    },
    {
      id: "station-art-intake",
      ready: artReady,
      message: artReady
        ? "Every Foundation/Station Period VGA visual master passed intake."
        : `Pass all ${stationVisualAssetIds.length} Foundation/Station visual masters through native art intake.`,
    },
    {
      id: "station-officer-review",
      ready: officerReady,
      message: officerReady
        ? "All twelve officer cells passed strict native frame review."
        : "Complete the officer 12-frame review before the Station slice can ship.",
    },
    {
      id: "station-audio-intake",
      ready: audioReady,
      message: audioReady
        ? "Every Station effect/ambience master passed audio intake."
        : `Pass all ${stationAudioAssetIds.length} Station audio masters through audio intake.`,
    },
    {
      id: "station-compiled-assets",
      ready: missingCompiledAssetIds.length === 0,
      message:
        missingCompiledAssetIds.length === 0
          ? "Every Foundation/Station runtime asset is compiled."
          : `${missingCompiledAssetIds.length} Foundation/Station runtime assets still need compilation.`,
    },
    {
      id: "station-indexed-assets",
      ready: missingIndexedAssetIds.length === 0,
      message:
        missingIndexedAssetIds.length === 0
          ? "Every Foundation/Station scene-rendered indexed asset has a runtime map."
          : `${missingIndexedAssetIds.length} Foundation/Station scene runtime index maps are missing.`,
    },
    {
      id: "station-period-vga",
      ready: periodReady,
      message: periodReady
        ? "Station slice has complete approved Period VGA coverage."
        : `Approve all ${stationVisualAssetIds.length} Foundation/Station visual masters through the Period VGA audit.`,
    },
    {
      id: "station-package",
      ready: packageReady,
      message: packageReady
        ? "Station-only runtime bundle parses successfully."
        : "Package and parse the Station vertical slice runtime bundle.",
    },
    {
      id: "station-playtest",
      ready: replayReady && screenshotReady,
      message:
        replayReady && screenshotReady
          ? "Station slice has retained deterministic replay and native screenshot evidence."
          : "Retain at least one Station replay and two raw 1× screenshots.",
    },
  ] as const;

  return {
    authoredReady: fullAuthored,
    shippableReady: gates.every((gate) => gate.ready),
    expectedAssetIds: [...stationAssetIds],
    missingCompiledAssetIds,
    missingIndexedAssetIds,
    gates,
  };
};
