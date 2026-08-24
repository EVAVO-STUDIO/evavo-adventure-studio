import {
  nightShiftOfficerMasterContract,
  nightShiftOfficerMasterSlots,
  validateNightShiftOfficerMasterContract,
} from "./night-shift-officer-master-contract.js";

export interface NightShiftOfficerFrameReview {
  readonly frameId: string;
  readonly silhouetteReadsAtOneToOne: boolean;
  readonly binaryAlpha: boolean;
  readonly anchorsStable: boolean;
  readonly paletteBanksReadable: boolean;
  readonly footContactStable?: boolean;
  readonly notes?: string;
}

export interface NightShiftOfficerMasterEvidence {
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly indexedColour: boolean;
  readonly colourCount: number;
  readonly alphaMode: "opaque" | "binary" | "soft";
  readonly universalOutline: boolean;
  readonly syntheticMicrotexture: boolean;
  readonly frameReviews: readonly NightShiftOfficerFrameReview[];
}

export type NightShiftOfficerMasterIssueCode =
  | "contract-invalid"
  | "wrong-file-type"
  | "wrong-dimensions"
  | "not-indexed"
  | "too-many-colours"
  | "soft-alpha"
  | "universal-outline"
  | "synthetic-microtexture"
  | "missing-frame-review"
  | "silhouette-failed"
  | "binary-alpha-failed"
  | "anchor-failed"
  | "palette-readability-failed"
  | "foot-contact-failed";

export interface NightShiftOfficerMasterIssue {
  readonly severity: "error";
  readonly code: NightShiftOfficerMasterIssueCode;
  readonly frameId: string | null;
  readonly message: string;
}

export interface NightShiftOfficerMasterIntakeReport {
  readonly status: "ready" | "blocked";
  readonly reviewedFrames: number;
  readonly requiredFrames: number;
  readonly issues: readonly NightShiftOfficerMasterIssue[];
}

const issue = (
  issues: NightShiftOfficerMasterIssue[],
  code: NightShiftOfficerMasterIssueCode,
  message: string,
  frameId: string | null = null,
): void => {
  issues.push({ severity: "error", code, frameId, message });
};

export const evaluateNightShiftOfficerMaster = (
  evidence: NightShiftOfficerMasterEvidence,
): NightShiftOfficerMasterIntakeReport => {
  const issues: NightShiftOfficerMasterIssue[] = [];
  const contractIssues = validateNightShiftOfficerMasterContract();
  for (const message of contractIssues) issue(issues, "contract-invalid", message);

  if (!evidence.fileName.toLowerCase().endsWith(".aseprite")) {
    issue(issues, "wrong-file-type", "Officer master must remain an authored .aseprite source file.");
  }
  if (
    evidence.width !== nightShiftOfficerMasterContract.masterSize.width ||
    evidence.height !== nightShiftOfficerMasterContract.masterSize.height
  ) {
    issue(
      issues,
      "wrong-dimensions",
      `Officer master must be exactly ${nightShiftOfficerMasterContract.masterSize.width}×${nightShiftOfficerMasterContract.masterSize.height}.`,
    );
  }
  if (!evidence.indexedColour) issue(issues, "not-indexed", "Officer master must be final indexed-colour artwork.");
  if (evidence.colourCount > 256) issue(issues, "too-many-colours", "Officer master exceeds the 256-colour VGA ceiling.");
  if (evidence.alphaMode !== "binary") issue(issues, "soft-alpha", "Officer master requires binary transparency with no soft edge pixels.");
  if (evidence.universalOutline) issue(issues, "universal-outline", "Officer master uses a universal outline instead of selective period silhouette contrast.");
  if (evidence.syntheticMicrotexture) issue(issues, "synthetic-microtexture", "Officer master contains synthetic/AI-like microtexture that does not belong at native VGA scale.");

  const reviewByFrame = new Map(evidence.frameReviews.map((review) => [review.frameId, review] as const));
  for (const slot of nightShiftOfficerMasterSlots) {
    const review = reviewByFrame.get(slot.frameId);
    if (!review) {
      issue(issues, "missing-frame-review", `Frame '${slot.frameId}' has no retained native review.`, slot.frameId);
      continue;
    }
    if (!review.silhouetteReadsAtOneToOne) issue(issues, "silhouette-failed", "Frame silhouette does not read at raw 1×.", slot.frameId);
    if (!review.binaryAlpha) issue(issues, "binary-alpha-failed", "Frame contains non-binary edge transparency.", slot.frameId);
    if (!review.anchorsStable) issue(issues, "anchor-failed", "Frame pivot/foot/hand/shadow anchors drift from the authored contract.", slot.frameId);
    if (!review.paletteBanksReadable) issue(issues, "palette-readability-failed", "Frame loses face/material readability in one or more authored palette banks.", slot.frameId);
    if (slot.footContact && review.footContactStable !== true) {
      issue(
        issues,
        "foot-contact-failed",
        `${slot.footContact} planted-foot contact is not stable enough for the authored walk cycle.`,
        slot.frameId,
      );
    }
  }

  issues.sort((left, right) =>
    (left.frameId ?? "").localeCompare(right.frameId ?? "") || left.code.localeCompare(right.code),
  );
  return {
    status: issues.length === 0 ? "ready" : "blocked",
    reviewedFrames: evidence.frameReviews.filter((review) => reviewByFrame.has(review.frameId)).length,
    requiredFrames: nightShiftOfficerMasterSlots.length,
    issues,
  };
};
