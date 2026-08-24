import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { IndexedAssetManifest } from "@evavo/adventure-asset-contract/indexed-assets";
import type { PeriodVgaAuditReport } from "@evavo/adventure-art-direction/period-vga-audit";
import type { NightShiftArtIntakeReport } from "./night-shift-art-master-intake.js";
import type { NightShiftAudioIntakeReport } from "./night-shift-audio-master-intake.js";
import { evaluateNightShiftDemoReadiness } from "./night-shift-demo-readiness.js";
import { nightShiftProductionWaves } from "./night-shift-production-waves.js";
import { nightShiftRuntimeProject } from "./night-shift-runtime-contracts.js";

const stationWaveIds = new Set(["foundation", "station"]);
const stationAssetIds = nightShiftProductionWaves
  .filter((wave) => stationWaveIds.has(wave.id))
  .flatMap((wave) => wave.assetIds);
const stationIndexedAssetIds = new Set(
  stationAssetIds.filter((assetId) => {
    const asset = nightShiftRuntimeProject.assets.find((candidate) => candidate.id === assetId);
    return asset?.kind === "image" || asset?.kind === "spritesheet";
  }),
);

export interface NightShiftStationSliceEvidence {
  readonly artMasterIntake?: NightShiftArtIntakeReport | null;
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

export const evaluateNightShiftStationSliceReadiness = (
  evidence: NightShiftStationSliceEvidence = {},
): NightShiftStationSliceReadiness => {
  const fullAuthored = evaluateNightShiftDemoReadiness().authoredReady;
  const compiled = compiledIds(evidence.assetManifest);
  const indexed = indexedIds(evidence.indexedAssets);
  const missingCompiledAssetIds = stationAssetIds.filter((assetId) => !compiled.has(assetId));
  const missingIndexedAssetIds = [...stationIndexedAssetIds].filter((assetId) => !indexed.has(assetId));
  const artReady = evidence.artMasterIntake?.issues.length === 0 &&
    stationAssetIds
      .filter((assetId) => evidence.artMasterIntake?.missingAssetIds.includes(assetId) === false)
      .length > 0;
  const audioReady = evidence.audioMasterIntake?.issues.length === 0 &&
    stationAssetIds
      .filter((assetId) => evidence.audioMasterIntake?.missingAssetIds.includes(assetId) === false)
      .length > 0;
  const periodReady =
    evidence.periodVgaReport?.projectId === nightShiftRuntimeProject.id &&
    evidence.periodVgaReport.status === "ready";
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
        ? "Foundation/station visual masters have no intake errors."
        : "Pass Foundation and Station visual masters through native art intake.",
    },
    {
      id: "station-audio-intake",
      ready: audioReady,
      message: audioReady
        ? "Foundation/station audio masters have no intake errors."
        : "Pass Station Foley and room tone through audio intake.",
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
          ? "Every Foundation/Station image/spritesheet has an indexed runtime map."
          : `${missingIndexedAssetIds.length} Foundation/Station indexed maps are missing.`,
    },
    {
      id: "station-period-vga",
      ready: periodReady,
      message: periodReady
        ? "Station slice has an approved Period VGA audit."
        : "Approve the native station slice through the Period VGA audit.",
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
