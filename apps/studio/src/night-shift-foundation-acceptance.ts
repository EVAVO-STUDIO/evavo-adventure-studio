import { validateNightShiftArtMaster, type NightShiftArtMasterObservation } from "./night-shift-art-master-intake.js";
import { nightShiftGeneratedVisualMasterObservations } from "./night-shift-generated-art-intake.js";
import { evaluateNightShiftOfficerMaster, type NightShiftOfficerMasterEvidence } from "./night-shift-officer-master-intake.js";

export interface NightShiftFoundationAcceptanceInput {
  readonly officerArt: NightShiftArtMasterObservation;
  readonly officerReview: NightShiftOfficerMasterEvidence;
}

export interface NightShiftFoundationAcceptanceReport {
  readonly status: "ready" | "blocked";
  readonly generatedVisualsReady: boolean;
  readonly officerStructuralReady: boolean;
  readonly officerReviewReady: boolean;
  readonly acceptedAssetIds: readonly string[];
  readonly issues: readonly string[];
}

export const evaluateNightShiftFoundationAcceptance = (
  input: NightShiftFoundationAcceptanceInput,
): NightShiftFoundationAcceptanceReport => {
  const generatedIssues = nightShiftGeneratedVisualMasterObservations().flatMap((observation) =>
    validateNightShiftArtMaster(observation),
  );
  const officerStructuralIssues = validateNightShiftArtMaster(input.officerArt);
  const officerReview = evaluateNightShiftOfficerMaster(input.officerReview);
  const issues = [
    ...generatedIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
    ...officerStructuralIssues.map((entry) => `${entry.assetId}: ${entry.code}: ${entry.message}`),
    ...officerReview.issues.map((entry) => `${entry.frameId ?? "officer"}: ${entry.code}: ${entry.message}`),
  ].sort((left, right) => left.localeCompare(right));
  const generatedVisualsReady = generatedIssues.length === 0;
  const officerStructuralReady = officerStructuralIssues.length === 0;
  const officerReviewReady = officerReview.status === "ready";

  return {
    status:
      generatedVisualsReady && officerStructuralReady && officerReviewReady
        ? "ready"
        : "blocked",
    generatedVisualsReady,
    officerStructuralReady,
    officerReviewReady,
    acceptedAssetIds:
      generatedVisualsReady && officerStructuralReady && officerReviewReady
        ? [
            "asset.palette.night-shift.actor-lighting",
            ...nightShiftGeneratedVisualMasterObservations().map((observation) => observation.assetId as string),
            "asset.night-shift.actor.officer",
          ]
        : [],
    issues,
  };
};
