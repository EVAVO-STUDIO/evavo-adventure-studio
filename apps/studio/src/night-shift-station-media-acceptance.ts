import {
  validateNightShiftArtMaster,
  type NightShiftArtMasterObservation,
} from "./night-shift-art-master-intake.js";
import {
  validateNightShiftAudioMaster,
  type NightShiftAudioMasterObservation,
} from "./night-shift-audio-master-intake.js";
import type { NightShiftFoundationAcceptanceReport } from "./night-shift-foundation-acceptance.js";
import { evaluateNightShiftStationMediaPreflight } from "./night-shift-station-media-preflight.js";

export interface NightShiftStationMediaAcceptanceInput {
  readonly foundation: NightShiftFoundationAcceptanceReport;
  readonly visualMasters: readonly NightShiftArtMasterObservation[];
  readonly audioMasters: readonly NightShiftAudioMasterObservation[];
}

export interface NightShiftStationMediaAcceptanceReport {
  readonly status: "ready" | "blocked";
  readonly foundationReady: boolean;
  readonly visualMastersReady: boolean;
  readonly audioMastersReady: boolean;
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
  const expectedVisual = new Set(preflight.visualMasterIds);
  const expectedAudio = new Set(preflight.audioMasterIds);
  const visualIds = input.visualMasters.map((master) => master.assetId as string);
  const audioIds = input.audioMasters.map((master) => master.assetId as string);
  const observedVisual = new Set(visualIds);
  const observedAudio = new Set(audioIds);
  const missingVisualAssetIds = preflight.visualMasterIds.filter(
    (assetId) => !observedVisual.has(assetId),
  );
  const missingAudioAssetIds = preflight.audioMasterIds.filter(
    (assetId) => !observedAudio.has(assetId),
  );
  const unexpectedAssetIds = [
    ...visualIds.filter((assetId) => !expectedVisual.has(assetId)),
    ...audioIds.filter((assetId) => !expectedAudio.has(assetId)),
  ].sort((left, right) => left.localeCompare(right));
  const duplicateIds = [...duplicates(visualIds), ...duplicates(audioIds)];
  const artIssues = input.visualMasters.flatMap(validateNightShiftArtMaster);
  const audioIssues = input.audioMasters.flatMap(validateNightShiftAudioMaster);
  const issues = [
    ...missingVisualAssetIds.map((assetId) => `missing visual master: ${assetId}`),
    ...missingAudioAssetIds.map((assetId) => `missing audio master: ${assetId}`),
    ...unexpectedAssetIds.map((assetId) => `unexpected Station media: ${assetId}`),
    ...duplicateIds.map((assetId) => `duplicate Station media: ${assetId}`),
    ...artIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
    ...audioIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
  ].sort((left, right) => left.localeCompare(right));
  const foundationReady = input.foundation.status === "ready";
  const visualMastersReady =
    missingVisualAssetIds.length === 0 &&
    unexpectedAssetIds.length === 0 &&
    duplicates(visualIds).length === 0 &&
    artIssues.length === 0;
  const audioMastersReady =
    missingAudioAssetIds.length === 0 &&
    unexpectedAssetIds.length === 0 &&
    duplicates(audioIds).length === 0 &&
    audioIssues.length === 0;

  return {
    status:
      foundationReady && visualMastersReady && audioMastersReady ? "ready" : "blocked",
    foundationReady,
    visualMastersReady,
    audioMastersReady,
    missingVisualAssetIds,
    missingAudioAssetIds,
    unexpectedAssetIds,
    issues,
  };
};
