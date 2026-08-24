import {
  validateNightShiftArtMaster,
  type NightShiftArtMasterObservation,
} from "./night-shift-art-master-intake.js";
import {
  validateNightShiftAudioMaster,
  type NightShiftAudioMasterObservation,
} from "./night-shift-audio-master-intake.js";
import type { NightShiftFoundationAcceptanceReport } from "./night-shift-foundation-acceptance.js";
import {
  validateNightShiftScenePalette,
  type NightShiftScenePaletteObservation,
} from "./night-shift-scene-palette-intake.js";
import { evaluateNightShiftStationMediaPreflight } from "./night-shift-station-media-preflight.js";

export interface NightShiftStationMediaAcceptanceInput {
  readonly foundation: NightShiftFoundationAcceptanceReport;
  readonly scenePalette: NightShiftScenePaletteObservation;
  readonly visualMasters: readonly NightShiftArtMasterObservation[];
  readonly audioMasters: readonly NightShiftAudioMasterObservation[];
}

export interface NightShiftStationMediaAcceptanceReport {
  readonly status: "ready" | "blocked";
  readonly foundationReady: boolean;
  readonly scenePaletteReady: boolean;
  readonly visualMastersReady: boolean;
  readonly audioMastersReady: boolean;
  readonly missingScenePaletteAssetIds: readonly string[];
  readonly missingVisualAssetIds: readonly string[];
  readonly missingAudioAssetIds: readonly string[];
  readonly unexpectedAssetIds: readonly string[];
  readonly issues: readonly string[];
}

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort((left, right) => left.localeCompare(right));
};

export const evaluateNightShiftStationMediaAcceptance = (
  input: NightShiftStationMediaAcceptanceInput,
): NightShiftStationMediaAcceptanceReport => {
  const preflight = evaluateNightShiftStationMediaPreflight();
  const expectedPalette = new Set(preflight.scenePaletteAssetIds);
  const expectedVisual = new Set(preflight.visualMasterIds);
  const expectedAudio = new Set(preflight.audioMasterIds);
  const paletteId = input.scenePalette.assetId as string;
  const visualIds = input.visualMasters.map((master) => master.assetId as string);
  const audioIds = input.audioMasters.map((master) => master.assetId as string);
  const observedVisual = new Set(visualIds);
  const observedAudio = new Set(audioIds);
  const missingScenePaletteAssetIds = preflight.scenePaletteAssetIds.filter(
    (assetId) => assetId !== paletteId,
  );
  const missingVisualAssetIds = preflight.visualMasterIds.filter(
    (assetId) => !observedVisual.has(assetId),
  );
  const missingAudioAssetIds = preflight.audioMasterIds.filter(
    (assetId) => !observedAudio.has(assetId),
  );
  const unexpectedPaletteIds = expectedPalette.has(paletteId) ? [] : [paletteId];
  const unexpectedVisualIds = visualIds.filter((assetId) => !expectedVisual.has(assetId));
  const unexpectedAudioIds = audioIds.filter((assetId) => !expectedAudio.has(assetId));
  const unexpectedAssetIds = [
    ...unexpectedPaletteIds,
    ...unexpectedVisualIds,
    ...unexpectedAudioIds,
  ].sort((left, right) => left.localeCompare(right));
  const duplicateVisualIds = duplicates(visualIds);
  const duplicateAudioIds = duplicates(audioIds);
  const paletteIssues = validateNightShiftScenePalette(input.scenePalette);
  const artIssues = input.visualMasters.flatMap(validateNightShiftArtMaster);
  const audioIssues = input.audioMasters.flatMap(validateNightShiftAudioMaster);
  const issues = [
    ...missingScenePaletteAssetIds.map((assetId) => `missing scene palette: ${assetId}`),
    ...missingVisualAssetIds.map((assetId) => `missing visual master: ${assetId}`),
    ...missingAudioAssetIds.map((assetId) => `missing audio master: ${assetId}`),
    ...unexpectedAssetIds.map((assetId) => `unexpected Station media: ${assetId}`),
    ...duplicateVisualIds.map((assetId) => `duplicate Station visual: ${assetId}`),
    ...duplicateAudioIds.map((assetId) => `duplicate Station audio: ${assetId}`),
    ...paletteIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
    ...artIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
    ...audioIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
  ].sort((left, right) => left.localeCompare(right));
  const foundationReady = input.foundation.status === "ready";
  const scenePaletteReady =
    missingScenePaletteAssetIds.length === 0 &&
    unexpectedPaletteIds.length === 0 &&
    paletteIssues.length === 0;
  const visualMastersReady =
    missingVisualAssetIds.length === 0 &&
    unexpectedVisualIds.length === 0 &&
    duplicateVisualIds.length === 0 &&
    artIssues.length === 0;
  const audioMastersReady =
    missingAudioAssetIds.length === 0 &&
    unexpectedAudioIds.length === 0 &&
    duplicateAudioIds.length === 0 &&
    audioIssues.length === 0;

  return {
    status:
      foundationReady && scenePaletteReady && visualMastersReady && audioMastersReady
        ? "ready"
        : "blocked",
    foundationReady,
    scenePaletteReady,
    visualMastersReady,
    audioMastersReady,
    missingScenePaletteAssetIds,
    missingVisualAssetIds,
    missingAudioAssetIds,
    unexpectedAssetIds,
    issues,
  };
};
