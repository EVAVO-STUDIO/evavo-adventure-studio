import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftAudioMix } from "./night-shift-runtime-contracts.js";
import {
  nightShiftProductionAssets,
  type NightShiftProductionAssetRequirement,
} from "./night-shift-production-assets.js";

export interface NightShiftAudioMasterObservation {
  readonly assetId: Id<"asset">;
  readonly sourceFormat: "wav" | "aiff" | "other";
  readonly sampleRate: number;
  readonly bitDepth: 16 | 24 | 32;
  readonly channels: 1 | 2;
  readonly durationMilliseconds: number;
  readonly peakDbfs: number;
}

export type NightShiftAudioMasterIssueCode =
  | "unknown-asset"
  | "not-audio-asset"
  | "source-format-mismatch"
  | "unsupported-sample-rate"
  | "unsupported-bit-depth"
  | "effect-not-mono"
  | "invalid-duration"
  | "effect-too-long"
  | "ambience-too-short"
  | "invalid-peak";

export interface NightShiftAudioMasterIssue {
  readonly severity: "error";
  readonly code: NightShiftAudioMasterIssueCode;
  readonly assetId: Id<"asset">;
  readonly message: string;
}

const requirementFor = (
  assetId: Id<"asset">,
): NightShiftProductionAssetRequirement | null =>
  nightShiftProductionAssets.find((asset) => asset.assetId === assetId) ?? null;

const issue = (
  assetId: Id<"asset">,
  code: NightShiftAudioMasterIssueCode,
  message: string,
): NightShiftAudioMasterIssue => ({ severity: "error", code, assetId, message });

const cueForAsset = (assetId: Id<"asset">) =>
  nightShiftAudioMix.cues.find((cue) => cue.assetId === assetId) ?? null;

export const validateNightShiftAudioMaster = (
  observation: NightShiftAudioMasterObservation,
): readonly NightShiftAudioMasterIssue[] => {
  const requirement = requirementFor(observation.assetId);
  if (!requirement) {
    return [issue(observation.assetId, "unknown-asset", `Asset '${observation.assetId}' is not part of the Night Shift production plan.`)];
  }
  if (requirement.role !== "audio-effect" && requirement.role !== "audio-ambience") {
    return [issue(observation.assetId, "not-audio-asset", `Asset '${observation.assetId}' is '${requirement.role}', not an audio production master.`)];
  }

  const issues: NightShiftAudioMasterIssue[] = [];
  if (observation.sourceFormat !== "wav") {
    issues.push(issue(observation.assetId, "source-format-mismatch", "Night Shift runtime audio sources are authored as WAV masters."));
  }
  if (![22050, 32000, 44100, 48000].includes(observation.sampleRate)) {
    issues.push(
      issue(
        observation.assetId,
        "unsupported-sample-rate",
        `Audio master sample rate ${observation.sampleRate} Hz is outside the approved 22.05/32/44.1/48 kHz set.`,
      ),
    );
  }
  if (![16, 24].includes(observation.bitDepth)) {
    issues.push(
      issue(
        observation.assetId,
        "unsupported-bit-depth",
        `Audio master bit depth ${observation.bitDepth} is not an approved 16- or 24-bit PCM source.`,
      ),
    );
  }
  if (requirement.role === "audio-effect" && observation.channels !== 1) {
    issues.push(
      issue(
        observation.assetId,
        "effect-not-mono",
        "Short interaction/footstep effects should be mono so scene placement and repeated playback remain controlled.",
      ),
    );
  }
  if (!Number.isFinite(observation.durationMilliseconds) || observation.durationMilliseconds <= 0) {
    issues.push(issue(observation.assetId, "invalid-duration", "Audio duration must be a positive finite number of milliseconds."));
  } else if (requirement.role === "audio-effect" && observation.durationMilliseconds > 4000) {
    issues.push(
      issue(
        observation.assetId,
        "effect-too-long",
        `Effect master is ${observation.durationMilliseconds} ms; small scene-scale Night Shift effects must remain under 4000 ms.`,
      ),
    );
  } else if (requirement.role === "audio-ambience") {
    const cue = cueForAsset(observation.assetId);
    const requiredDuration = cue?.loop?.endMilliseconds ?? 0;
    if (requiredDuration > 0 && observation.durationMilliseconds < requiredDuration) {
      issues.push(
        issue(
          observation.assetId,
          "ambience-too-short",
          `Ambience master is ${observation.durationMilliseconds} ms but its authored loop requires at least ${requiredDuration} ms.`,
        ),
      );
    }
  }
  if (!Number.isFinite(observation.peakDbfs) || observation.peakDbfs > 0 || observation.peakDbfs < -60) {
    issues.push(
      issue(
        observation.assetId,
        "invalid-peak",
        `Audio peak ${observation.peakDbfs} dBFS is outside the accepted -60 to 0 dBFS source range.`,
      ),
    );
  }

  return issues.sort((left, right) => left.code.localeCompare(right.code));
};

export interface NightShiftAudioIntakeReport {
  readonly status: "ready" | "blocked";
  readonly expectedMasters: number;
  readonly observedMasters: number;
  readonly missingAssetIds: readonly Id<"asset">[];
  readonly issues: readonly NightShiftAudioMasterIssue[];
}

const expectedAudioAssetIds = nightShiftProductionAssets
  .filter((asset) => asset.role === "audio-effect" || asset.role === "audio-ambience")
  .map((asset) => asset.assetId);

export const evaluateNightShiftAudioMasterIntake = (
  observations: readonly NightShiftAudioMasterObservation[],
): NightShiftAudioIntakeReport => {
  const observed = new Set(observations.map((observation) => observation.assetId as string));
  const missingAssetIds = expectedAudioAssetIds.filter((assetId) => !observed.has(assetId));
  const issues = observations.flatMap(validateNightShiftAudioMaster);
  return {
    status: missingAssetIds.length === 0 && issues.length === 0 ? "ready" : "blocked",
    expectedMasters: expectedAudioAssetIds.length,
    observedMasters: observations.length,
    missingAssetIds,
    issues,
  };
};
