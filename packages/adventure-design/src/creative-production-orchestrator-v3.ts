import {
  type AdventureCreativeReviewV3,
  type AdventureCreativeWorkOrderV3,
  nextAdventureCreativeRepairOrderV3,
  validateAdventureCreativeReviewV3,
} from "./creative-production-handoff-v3.js";
import {
  type AdventureCreativeStrictQualityEvidenceV3,
  validateAdventureCreativeStrictQualityV3,
} from "./creative-production-quality-v3.js";

export type AdventureCreativeIterationDecisionV3 =
  | {
      readonly kind: "deliver";
      readonly workOrder: AdventureCreativeWorkOrderV3;
      readonly review: AdventureCreativeReviewV3;
      readonly quality: AdventureCreativeStrictQualityEvidenceV3;
    }
  | {
      readonly kind: "targeted-repair";
      readonly workOrder: AdventureCreativeWorkOrderV3;
      readonly nextWorkOrder: AdventureCreativeWorkOrderV3;
      readonly review: AdventureCreativeReviewV3;
      readonly reviewIssues: readonly string[];
    }
  | {
      readonly kind: "human-review";
      readonly workOrder: AdventureCreativeWorkOrderV3;
      readonly review: AdventureCreativeReviewV3;
      readonly reviewIssues: readonly string[];
    }
  | {
      readonly kind: "reject";
      readonly workOrder: AdventureCreativeWorkOrderV3;
      readonly review: AdventureCreativeReviewV3;
      readonly reasons: readonly string[];
    };

const messages = (issues: readonly { readonly message: string }[]): readonly string[] =>
  [...new Set(issues.map((issue) => issue.message))].sort((left, right) => left.localeCompare(right));

export const decideAdventureCreativeIterationV3 = (
  workOrder: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
  quality?: AdventureCreativeStrictQualityEvidenceV3,
): AdventureCreativeIterationDecisionV3 => {
  const reviewIssues = validateAdventureCreativeReviewV3(workOrder, review);
  if (review.disposition === "rejected") {
    return {
      kind: "reject",
      workOrder,
      review,
      reasons: reviewIssues.length > 0 ? messages(reviewIssues) : ["Sibling studio explicitly rejected the creative revision."],
    };
  }
  if (reviewIssues.length > 0) {
    if (review.disposition === "repair-required") {
      return {
        kind: "targeted-repair",
        workOrder,
        review,
        nextWorkOrder: nextAdventureCreativeRepairOrderV3(workOrder, review),
        reviewIssues: messages(reviewIssues),
      };
    }
    return {
      kind: "human-review",
      workOrder,
      review,
      reviewIssues: messages(reviewIssues),
    };
  }
  if (review.disposition === "repair-required") {
    return {
      kind: "targeted-repair",
      workOrder,
      review,
      nextWorkOrder: nextAdventureCreativeRepairOrderV3(workOrder, review),
      reviewIssues: [],
    };
  }
  if (review.disposition === "review-required" || review.disposition === "candidate") {
    return { kind: "human-review", workOrder, review, reviewIssues: [] };
  }
  if (review.disposition !== "accepted") {
    return { kind: "reject", workOrder, review, reasons: [`Unsupported creative disposition '${review.disposition}'.`] };
  }
  if (!quality) {
    return {
      kind: "human-review",
      workOrder,
      review,
      reviewIssues: ["Accepted sibling review still requires strict Adventure Studio quality evidence before delivery."],
    };
  }
  const qualityIssues = validateAdventureCreativeStrictQualityV3(workOrder, review, quality);
  if (qualityIssues.length > 0) {
    return {
      kind: "targeted-repair",
      workOrder,
      review,
      nextWorkOrder: {
        ...workOrder,
        revision: workOrder.revision + 1,
        replacesRevision: workOrder.revision,
        requestedRepairs: qualityIssues.map((issue, index) => ({
          issueId: `strict.${workOrder.revision}.${index + 1}`,
          issueCode: issue.code.includes("alpha")
            ? "missing-real-alpha"
            : issue.code.includes("anchor")
              ? "anchor-drift"
              : issue.code.includes("exposure") || issue.code.includes("frame-order")
                ? "exposure-timing-mismatch"
                : issue.code.includes("neighbour")
                  ? "neighbour-continuity-mismatch"
                  : issue.code.includes("model") || issue.code.includes("silhouette")
                    ? "identity-drift"
                    : "style-drift",
          targetFrameIds: [],
          repairInstruction: issue.message,
          preserveFrameIds: (workOrder.framePlan ?? []).map((frame) => frame.frameId),
          preserveRegions: [],
          allowRegenerateWholeAsset: false,
        })),
      },
      reviewIssues: messages(qualityIssues),
    };
  }
  return { kind: "deliver", workOrder, review, quality };
};
