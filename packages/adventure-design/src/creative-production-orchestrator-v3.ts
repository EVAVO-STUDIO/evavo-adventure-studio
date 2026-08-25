import {
  type AdventureCreativeIssueCodeV3,
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

const issueCodeForStrictQuality = (code: string): AdventureCreativeIssueCodeV3 => {
  if (code.includes("alpha") || code.includes("transparent") || code.includes("checkerboard")) {
    return "missing-real-alpha";
  }
  if (code.includes("anchor")) return "anchor-drift";
  if (code.includes("exposure") || code.includes("frame-order") || code.includes("total-exposure")) {
    return "exposure-timing-mismatch";
  }
  if (code.includes("neighbour") || code.includes("loop-closure")) {
    return "neighbour-continuity-mismatch";
  }
  if (code.includes("model") || code.includes("silhouette") || code.includes("identity")) {
    return "identity-drift";
  }
  if (code.includes("palette")) return "palette-drift";
  if (code.includes("authority")) return "reference-authority-mismatch";
  return "style-drift";
};

const quotedFrameIds = (
  message: string,
  knownFrameIds: ReadonlySet<string>,
): readonly string[] => {
  const matches = [...message.matchAll(/'([^']+)'/gu)].map((match) => match[1]).filter(Boolean) as string[];
  return [...new Set(matches.filter((candidate) => knownFrameIds.has(candidate)))].sort((left, right) =>
    left.localeCompare(right),
  );
};

const strictRepairOrder = (
  workOrder: AdventureCreativeWorkOrderV3,
  qualityIssues: readonly { readonly code: string; readonly message: string }[],
): AdventureCreativeWorkOrderV3 => {
  if (workOrder.revision >= workOrder.iterationPolicy.maximumRevisionPasses) {
    throw new Error(
      `Maximum revision passes (${workOrder.iterationPolicy.maximumRevisionPasses}) reached for '${workOrder.workOrderId}'.`,
    );
  }
  const frameIds = (workOrder.framePlan ?? []).map((frame) => frame.frameId);
  const knownFrameIds = new Set(frameIds);
  return {
    ...workOrder,
    revision: workOrder.revision + 1,
    replacesRevision: workOrder.revision,
    requestedRepairs: qualityIssues.map((issue, index) => {
      const targets = quotedFrameIds(issue.message, knownFrameIds);
      return {
        issueId: `strict.${workOrder.revision}.${index + 1}`,
        issueCode: issueCodeForStrictQuality(issue.code),
        targetFrameIds: targets,
        repairInstruction: issue.message,
        preserveFrameIds: frameIds.filter((frameId) => !targets.includes(frameId)),
        preserveRegions: [],
        allowRegenerateWholeAsset: false,
      };
    }),
  };
};

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
      if (workOrder.revision >= workOrder.iterationPolicy.maximumRevisionPasses) {
        return {
          kind: "reject",
          workOrder,
          review,
          reasons: [
            ...messages(reviewIssues),
            `Maximum revision passes (${workOrder.iterationPolicy.maximumRevisionPasses}) reached.`,
          ],
        };
      }
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
    if (workOrder.revision >= workOrder.iterationPolicy.maximumRevisionPasses) {
      return {
        kind: "reject",
        workOrder,
        review,
        reasons: [`Maximum revision passes (${workOrder.iterationPolicy.maximumRevisionPasses}) reached.`],
      };
    }
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
    if (workOrder.revision >= workOrder.iterationPolicy.maximumRevisionPasses) {
      return {
        kind: "reject",
        workOrder,
        review,
        reasons: [
          ...messages(qualityIssues),
          `Maximum revision passes (${workOrder.iterationPolicy.maximumRevisionPasses}) reached.`,
        ],
      };
    }
    return {
      kind: "targeted-repair",
      workOrder,
      review,
      nextWorkOrder: strictRepairOrder(workOrder, qualityIssues),
      reviewIssues: messages(qualityIssues),
    };
  }
  return { kind: "deliver", workOrder, review, quality };
};
