import {
  admitAdventureCreativeDeliveryV3 as admitStrictAdventureCreativeDeliveryV3,
} from "./creative-production-admission-v3.js";
import {
  nextAdventureCreativeRepairOrderV3,
  validateAdventureCreativeReviewV3,
  validateAdventureCreativeWorkOrderV3,
  type AdventureCreativeAcceptedDeliveryV3,
  type AdventureCreativeReviewIssueV3,
  type AdventureCreativeReviewV3,
  type AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";
import {
  decideAdventureCreativeIterationV3,
} from "./creative-production-orchestrator-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "./creative-production-quality-v3.js";

export type AdventureCreativeSessionV3Status =
  | "awaiting-candidate"
  | "awaiting-review"
  | "repair-required"
  | "review-required"
  | "awaiting-strict-quality"
  | "awaiting-delivery"
  | "accepted"
  | "rejected";

export interface AdventureCreativeSessionRevisionV3 {
  readonly workOrder: AdventureCreativeWorkOrderV3;
  readonly candidateArtifactDigest?: string;
  readonly review?: AdventureCreativeReviewV3;
  readonly strictQuality?: AdventureCreativeStrictQualityEvidenceV3;
  readonly delivery?: AdventureCreativeAcceptedDeliveryV3;
}

export interface AdventureCreativeProductionSessionV3 {
  readonly sessionVersion: 3;
  readonly sessionId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly status: AdventureCreativeSessionV3Status;
  readonly revisions: readonly AdventureCreativeSessionRevisionV3[];
  readonly acceptedDelivery?: AdventureCreativeAcceptedDeliveryV3;
  readonly rejectionReasons?: readonly string[];
}

const currentRevision = (
  session: AdventureCreativeProductionSessionV3,
): AdventureCreativeSessionRevisionV3 => {
  const current = session.revisions.at(-1);
  if (!current) throw new Error("Creative production v3 session has no work-order revision.");
  return current;
};

export const createAdventureCreativeProductionSessionV3 = (
  workOrder: AdventureCreativeWorkOrderV3,
): AdventureCreativeProductionSessionV3 => {
  const issues = validateAdventureCreativeWorkOrderV3(workOrder);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(" "));
  return {
    sessionVersion: 3,
    sessionId: `creative-session.${workOrder.workOrderId}`,
    projectId: workOrder.projectId,
    assetId: workOrder.assetId,
    status: "awaiting-candidate",
    revisions: [{ workOrder }],
  };
};

export const submitAdventureCreativeCandidateV3 = (
  session: AdventureCreativeProductionSessionV3,
  candidateArtifactDigest: string,
): AdventureCreativeProductionSessionV3 => {
  if (session.status !== "awaiting-candidate") {
    throw new Error(`Creative production v3 session cannot receive a candidate while '${session.status}'.`);
  }
  if (!candidateArtifactDigest.trim()) throw new Error("Creative candidate artifact digest is required.");
  const current = currentRevision(session);
  if (current.candidateArtifactDigest) throw new Error("Current creative revision already has a candidate.");
  return {
    ...session,
    status: "awaiting-review",
    revisions: [
      ...session.revisions.slice(0, -1),
      { ...current, candidateArtifactDigest },
    ],
  };
};

export const applyAdventureCreativeReviewV3 = (
  session: AdventureCreativeProductionSessionV3,
  review: AdventureCreativeReviewV3,
): AdventureCreativeProductionSessionV3 => {
  if (session.status !== "awaiting-review") {
    throw new Error(`Creative production v3 session cannot receive a review while '${session.status}'.`);
  }
  const current = currentRevision(session);
  if (!current.candidateArtifactDigest) throw new Error("Creative revision has no submitted candidate.");
  if (review.candidateArtifactDigest !== current.candidateArtifactDigest) {
    throw new Error("Creative review does not target the submitted candidate artifact.");
  }
  const issues = validateAdventureCreativeReviewV3(current.workOrder, review);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(" "));
  const status: AdventureCreativeSessionV3Status =
    review.disposition === "accepted"
      ? "awaiting-strict-quality"
      : review.disposition === "repair-required"
        ? "repair-required"
        : review.disposition === "review-required"
          ? "review-required"
          : review.disposition === "rejected"
            ? "rejected"
            : "awaiting-review";
  return {
    ...session,
    status,
    ...(status === "rejected" ? { rejectionReasons: ["Sibling studio rejected the candidate revision."] } : {}),
    revisions: [
      ...session.revisions.slice(0, -1),
      { ...current, review },
    ],
  };
};

export const applyAdventureCreativeStrictQualityV3 = (
  session: AdventureCreativeProductionSessionV3,
  quality: AdventureCreativeStrictQualityEvidenceV3,
): AdventureCreativeProductionSessionV3 => {
  if (session.status !== "awaiting-strict-quality") {
    throw new Error(`Creative production v3 session cannot receive strict quality evidence while '${session.status}'.`);
  }
  const current = currentRevision(session);
  if (!current.review) throw new Error("Creative revision has no accepted sibling review.");
  if (quality.candidateArtifactDigest !== current.candidateArtifactDigest) {
    throw new Error("Strict quality evidence does not target the submitted candidate artifact.");
  }
  const decision = decideAdventureCreativeIterationV3(current.workOrder, current.review, quality);
  const completedCurrent: AdventureCreativeSessionRevisionV3 = { ...current, strictQuality: quality };
  switch (decision.kind) {
    case "deliver":
      return {
        ...session,
        status: "awaiting-delivery",
        revisions: [...session.revisions.slice(0, -1), completedCurrent],
        rejectionReasons: undefined,
      };
    case "targeted-repair":
      return {
        ...session,
        status: "awaiting-candidate",
        revisions: [
          ...session.revisions.slice(0, -1),
          completedCurrent,
          { workOrder: decision.nextWorkOrder },
        ],
        rejectionReasons: undefined,
      };
    case "human-review":
      return {
        ...session,
        status: "review-required",
        revisions: [...session.revisions.slice(0, -1), completedCurrent],
        rejectionReasons: undefined,
      };
    case "reject":
      return {
        ...session,
        status: "rejected",
        revisions: [...session.revisions.slice(0, -1), completedCurrent],
        rejectionReasons: decision.reasons,
      };
  }
};

export const prepareAdventureCreativeRepairRevisionV3 = (
  session: AdventureCreativeProductionSessionV3,
): AdventureCreativeProductionSessionV3 => {
  if (session.status !== "repair-required" && session.status !== "review-required") {
    throw new Error(`Creative production v3 session cannot prepare repair while '${session.status}'.`);
  }
  const current = currentRevision(session);
  if (!current.review) throw new Error("Creative revision has no review to repair.");
  const workOrder = nextAdventureCreativeRepairOrderV3(current.workOrder, current.review);
  return {
    ...session,
    status: "awaiting-candidate",
    revisions: [...session.revisions, { workOrder }],
    rejectionReasons: undefined,
  };
};

export const admitAdventureCreativeDeliveryV3 = (
  session: AdventureCreativeProductionSessionV3,
  delivery: AdventureCreativeAcceptedDeliveryV3,
): AdventureCreativeProductionSessionV3 => {
  if (session.status !== "awaiting-delivery") {
    throw new Error(`Creative production v3 session cannot accept delivery while '${session.status}'.`);
  }
  const current = currentRevision(session);
  if (!current.review || !current.strictQuality) {
    throw new Error("Creative revision has not completed sibling review plus strict Adventure Studio quality review.");
  }
  const accepted = admitStrictAdventureCreativeDeliveryV3(
    current.workOrder,
    current.review,
    current.strictQuality,
    delivery,
  );
  return {
    ...session,
    status: "accepted",
    acceptedDelivery: accepted,
    rejectionReasons: undefined,
    revisions: [
      ...session.revisions.slice(0, -1),
      { ...current, delivery: accepted },
    ],
  };
};

export const openAdventureCreativeIssuesV3 = (
  session: AdventureCreativeProductionSessionV3,
): readonly AdventureCreativeReviewIssueV3[] => {
  const review = currentRevision(session).review;
  if (!review) return [];
  const closed = new Set(review.closedIssueIds);
  return review.issues.filter((issue) => !closed.has(issue.issueId));
};

export const acceptedAdventureCreativeDeliveryV3 = (
  session: AdventureCreativeProductionSessionV3,
): AdventureCreativeAcceptedDeliveryV3 | null =>
  session.status === "accepted" ? session.acceptedDelivery ?? null : null;

export interface AdventureCreativePlanSessionV3 {
  readonly planVersion: 3;
  readonly projectId: string;
  readonly sessions: Readonly<Record<string, AdventureCreativeProductionSessionV3>>;
}

export const createAdventureCreativePlanSessionV3 = (
  workOrders: readonly AdventureCreativeWorkOrderV3[],
): AdventureCreativePlanSessionV3 => {
  if (workOrders.length === 0) throw new Error("Creative production v3 plan requires at least one work order.");
  const projectId = workOrders[0]!.projectId;
  const sessions: Record<string, AdventureCreativeProductionSessionV3> = {};
  for (const workOrder of workOrders) {
    if (workOrder.projectId !== projectId) throw new Error("Creative production v3 plan cannot mix projects.");
    if (sessions[workOrder.assetId]) throw new Error(`Creative production v3 plan duplicates asset '${workOrder.assetId}'.`);
    sessions[workOrder.assetId] = createAdventureCreativeProductionSessionV3(workOrder);
  }
  return { planVersion: 3, projectId, sessions };
};

export interface AdventureCreativePlanReadinessV3 {
  readonly projectId: string;
  readonly totalAssets: number;
  readonly acceptedAssets: number;
  readonly repairRequiredAssets: number;
  readonly reviewRequiredAssets: number;
  readonly awaitingCandidateAssets: number;
  readonly awaitingReviewAssets: number;
  readonly awaitingStrictQualityAssets: number;
  readonly awaitingDeliveryAssets: number;
  readonly rejectedAssets: number;
  readonly ready: boolean;
  readonly missingAssetIds: readonly string[];
}

export const evaluateAdventureCreativePlanReadinessV3 = (
  plan: AdventureCreativePlanSessionV3,
): AdventureCreativePlanReadinessV3 => {
  const sessions = Object.values(plan.sessions);
  const count = (status: AdventureCreativeSessionV3Status): number =>
    sessions.filter((session) => session.status === status).length;
  const missingAssetIds = sessions
    .filter((session) => session.status !== "accepted")
    .map((session) => session.assetId)
    .sort((left, right) => left.localeCompare(right));
  return {
    projectId: plan.projectId,
    totalAssets: sessions.length,
    acceptedAssets: count("accepted"),
    repairRequiredAssets: count("repair-required"),
    reviewRequiredAssets: count("review-required"),
    awaitingCandidateAssets: count("awaiting-candidate"),
    awaitingReviewAssets: count("awaiting-review"),
    awaitingStrictQualityAssets: count("awaiting-strict-quality"),
    awaitingDeliveryAssets: count("awaiting-delivery"),
    rejectedAssets: count("rejected"),
    ready: missingAssetIds.length === 0,
    missingAssetIds,
  };
};
