import type { AdventureReferenceProofLane } from "./reference-proof-lanes.js";
import { adventureReferenceProofLanes } from "./reference-proof-lanes.js";

export type ReferenceProofRuntimeFeature =
  | "sentence"
  | "room-scripts"
  | "investigation"
  | "multi-protagonist"
  | "route-topology"
  | "specialized-modes"
  | "lifecycle"
  | "score"
  | "dialogue"
  | "scene-staging"
  | "indexed-palette"
  | "audio";

export interface ReferenceProofMilestone {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface ReferenceProofRuntimeContract {
  readonly laneId: string;
  readonly requiredFeatures: readonly ReferenceProofRuntimeFeature[];
  readonly requiredMilestones: readonly ReferenceProofMilestone[];
  readonly minimumNativeScreenshots: number;
  readonly requiresSuccessReplay: boolean;
  readonly requiresFailureReplay: boolean;
  readonly requiresSaveRestoreReplay: boolean;
}

const milestone = (id: string, label: string, description: string): ReferenceProofMilestone => ({
  id,
  label,
  description,
});

export const referenceProofRuntimeContracts: readonly ReferenceProofRuntimeContract[] = [
  {
    laneId: "late-sierra-procedural",
    requiredFeatures: [
      "room-scripts",
      "investigation",
      "lifecycle",
      "score",
      "dialogue",
      "scene-staging",
      "indexed-palette",
      "audio",
    ],
    requiredMilestones: [
      milestone(
        "open-case.protected-entry",
        "Protected entry",
        "Enter the crime scene through the authored boundary and preserve the protected evidence route.",
      ),
      milestone(
        "open-case.document-before-collect",
        "Document before collection",
        "Observe and photograph a fragile evidence target before collection changes its physical/custody state.",
      ),
      milestone(
        "open-case.custody-chain",
        "Custody chain",
        "Bag, log and retain evidence identity so later analysis remains traceable to the original scene.",
      ),
      milestone(
        "open-case.evidence-led-interview",
        "Evidence-led interview",
        "Unlock a witness question from retained evidence/prior testimony and expose a contradiction without omniscient topic access.",
      ),
      milestone(
        "open-case.procedure-failure-recovery",
        "Procedure failure and recovery",
        "Perform one invalid procedure, receive specific in-world feedback, recover without losing unrelated case progress and complete the correct route.",
      ),
      milestone(
        "open-case.location-progression",
        "Case location progression",
        "Use the completed evidence/testimony state to open a later location or caseboard route without a modern quest objective.",
      ),
    ],
    minimumNativeScreenshots: 8,
    requiresSuccessReplay: true,
    requiresFailureReplay: true,
    requiresSaveRestoreReplay: true,
  },
  {
    laneId: "sierra-social-comedy-vga",
    requiredFeatures: [
      "room-scripts",
      "lifecycle",
      "score",
      "dialogue",
      "scene-staging",
      "indexed-palette",
      "audio",
    ],
    requiredMilestones: [
      milestone(
        "after-hours.recoverable-introduction",
        "Recoverable introduction",
        "Make an awkward social choice that changes reaction/time/score but leaves a credible recovery or alternate route.",
      ),
      milestone(
        "after-hours.inventory-conversation",
        "Inventory changes conversation",
        "Use a physical clue, payment, gift or disguise state to alter available conversation and venue access.",
      ),
      milestone(
        "after-hours.comic-hold",
        "Native comic timing",
        "Deliver a joke through authored anticipation/reaction holds with enough reading time at native resolution.",
      ),
      milestone(
        "after-hours.visible-score",
        "Visible one-shot score",
        "Award classic score for discovery/social puzzle success exactly once and preserve it through save/replay.",
      ),
      milestone(
        "after-hours.alternate-access",
        "Alternate final access",
        "Reach the final social route through at least two fictionally valid solution chains with distinct consequences.",
      ),
      milestone(
        "after-hours.embarrassment-retry",
        "Embarrassment and retry",
        "Reach a comic failure/embarrassment state and retry from a bounded checkpoint without replaying solved setup.",
      ),
    ],
    minimumNativeScreenshots: 8,
    requiresSuccessReplay: true,
    requiresFailureReplay: true,
    requiresSaveRestoreReplay: true,
  },
  {
    laneId: "modern-retro-noir",
    requiredFeatures: [
      "room-scripts",
      "investigation",
      "multi-protagonist",
      "specialized-modes",
      "lifecycle",
      "dialogue",
      "scene-staging",
      "indexed-palette",
      "audio",
    ],
    requiredMilestones: [
      milestone(
        "cold-meridian.lowres-acquisition",
        "Low-resolution acquisition",
        "Acquire tiny evidence at native scale through authored visual hierarchy/click comfort without visible hotspot glow.",
      ),
      milestone(
        "cold-meridian.knowledge-separation",
        "Separate protagonist knowledge",
        "Discover information with one technician that remains unavailable to the other until an authored exchange occurs.",
      ),
      milestone(
        "cold-meridian.signal-research",
        "Signal research",
        "Compare recorded evidence/timestamps and unlock a route or intervention window through semantic investigation state.",
      ),
      milestone(
        "cold-meridian.hard-cutaway",
        "Hard cinematic cutaway",
        "Trigger a deterministic hard cut/cutaway and return without losing room, actor, investigation or audio state.",
      ),
      milestone(
        "cold-meridian.bounded-action",
        "Bounded action insert",
        "Run a short specialized action mode with clear input/failure semantics and a private retry checkpoint.",
      ),
      milestone(
        "cold-meridian.recoverable-inference",
        "Recoverable wrong inference",
        "Choose a plausible but wrong inference, enter a changed late-arrival state and continue with new evidence instead of a silent dead end.",
      ),
    ],
    minimumNativeScreenshots: 8,
    requiresSuccessReplay: true,
    requiresFailureReplay: true,
    requiresSaveRestoreReplay: true,
  },
] as const;

export interface ReferenceProofEvidence {
  readonly laneId: string;
  readonly packagedBundle: boolean;
  readonly enabledFeatures: readonly ReferenceProofRuntimeFeature[];
  readonly completedMilestoneIds: readonly string[];
  readonly nativeScreenshotCount: number;
  readonly successReplay: boolean;
  readonly failureReplay: boolean;
  readonly saveRestoreReplay: boolean;
  readonly finalArtApproved: boolean;
  readonly finalAudioApproved: boolean;
}

export interface ReferenceProofReadinessIssue {
  readonly code:
    | "unknown-lane"
    | "bundle-missing"
    | "feature-missing"
    | "milestone-missing"
    | "screenshots-insufficient"
    | "success-replay-missing"
    | "failure-replay-missing"
    | "save-restore-replay-missing"
    | "art-approval-missing"
    | "audio-approval-missing";
  readonly message: string;
}

export interface ReferenceProofReadiness {
  readonly lane: AdventureReferenceProofLane | null;
  readonly contract: ReferenceProofRuntimeContract | null;
  readonly ready: boolean;
  readonly issues: readonly ReferenceProofReadinessIssue[];
  readonly completedMilestones: number;
  readonly requiredMilestones: number;
}

export const referenceProofRuntimeContractByLaneId = (
  laneId: string,
): ReferenceProofRuntimeContract | null =>
  referenceProofRuntimeContracts.find((contract) => contract.laneId === laneId) ?? null;

export const evaluateReferenceProofReadiness = (
  evidence: ReferenceProofEvidence,
): ReferenceProofReadiness => {
  const lane = adventureReferenceProofLanes.find((candidate) => candidate.id === evidence.laneId) ?? null;
  const contract = referenceProofRuntimeContractByLaneId(evidence.laneId);
  const issues: ReferenceProofReadinessIssue[] = [];
  if (!lane || !contract) {
    issues.push({ code: "unknown-lane", message: `Reference proof lane '${evidence.laneId}' is not registered.` });
    return { lane, contract, ready: false, issues, completedMilestones: 0, requiredMilestones: 0 };
  }
  if (!evidence.packagedBundle) issues.push({ code: "bundle-missing", message: "A parsed packaged Runtime Bundle is required." });
  const enabled = new Set(evidence.enabledFeatures);
  for (const feature of contract.requiredFeatures) {
    if (!enabled.has(feature)) issues.push({ code: "feature-missing", message: `Required runtime feature '${feature}' is missing.` });
  }
  const completed = new Set(evidence.completedMilestoneIds);
  for (const required of contract.requiredMilestones) {
    if (!completed.has(required.id)) issues.push({ code: "milestone-missing", message: `Gameplay milestone '${required.label}' is not retained.` });
  }
  if (evidence.nativeScreenshotCount < contract.minimumNativeScreenshots) {
    issues.push({
      code: "screenshots-insufficient",
      message: `Retain at least ${contract.minimumNativeScreenshots} raw 1x proof screenshots; found ${evidence.nativeScreenshotCount}.`,
    });
  }
  if (contract.requiresSuccessReplay && !evidence.successReplay) issues.push({ code: "success-replay-missing", message: "Successful proof replay is missing." });
  if (contract.requiresFailureReplay && !evidence.failureReplay) issues.push({ code: "failure-replay-missing", message: "Failure/recovery proof replay is missing." });
  if (contract.requiresSaveRestoreReplay && !evidence.saveRestoreReplay) issues.push({ code: "save-restore-replay-missing", message: "Save/restore proof replay is missing." });
  if (!evidence.finalArtApproved) issues.push({ code: "art-approval-missing", message: "Final native art review is not approved." });
  if (!evidence.finalAudioApproved) issues.push({ code: "audio-approval-missing", message: "Final audio review is not approved." });
  return {
    lane,
    contract,
    ready: issues.length === 0,
    issues,
    completedMilestones: contract.requiredMilestones.filter((entry) => completed.has(entry.id)).length,
    requiredMilestones: contract.requiredMilestones.length,
  };
};

export const validateReferenceProofRuntimeContracts = (): readonly string[] => {
  const issues: string[] = [];
  const laneIds = new Set(adventureReferenceProofLanes.map((lane) => lane.id));
  const seen = new Set<string>();
  for (const contract of referenceProofRuntimeContracts) {
    if (!laneIds.has(contract.laneId)) issues.push(`Runtime proof contract '${contract.laneId}' has no reference lane.`);
    if (seen.has(contract.laneId)) issues.push(`Runtime proof contract '${contract.laneId}' is duplicated.`);
    seen.add(contract.laneId);
    if (new Set(contract.requiredFeatures).size !== contract.requiredFeatures.length) {
      issues.push(`Runtime proof contract '${contract.laneId}' repeats a required feature.`);
    }
    const milestoneIds = new Set<string>();
    for (const item of contract.requiredMilestones) {
      if (milestoneIds.has(item.id)) issues.push(`Runtime proof contract '${contract.laneId}' repeats milestone '${item.id}'.`);
      milestoneIds.add(item.id);
    }
  }
  for (const laneId of laneIds) {
    if (!seen.has(laneId)) issues.push(`Reference proof lane '${laneId}' has no runtime proof contract.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
