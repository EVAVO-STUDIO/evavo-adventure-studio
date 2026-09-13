import {
  acceptAdventureCreativeCandidate,
  createAdventureCreativeReworkRequest,
  reviewAdventureCreativeCandidate,
  type AdventureCreativeAcceptance,
  type AdventureCreativeCandidateEvidence,
  type AdventureCreativeReview,
  type AdventureCreativeReworkRequest,
  type AdventureCreativeWorkOrder,
} from "./creative-production-handoff.js";

export type AdventureCreativeSessionStatus =
  | "awaiting-candidate"
  | "awaiting-review"
  | "rework-required"
  | "accepted";

export interface AdventureCreativeSessionIteration {
  readonly candidate: AdventureCreativeCandidateEvidence;
  readonly review?: AdventureCreativeReview;
  readonly rework?: AdventureCreativeReworkRequest;
  readonly acceptance?: AdventureCreativeAcceptance;
}

export interface AdventureCreativeProductionSession {
  readonly sessionVersion: 1;
  readonly workOrder: AdventureCreativeWorkOrder;
  readonly status: AdventureCreativeSessionStatus;
  readonly iterations: readonly AdventureCreativeSessionIteration[];
  readonly preserveApprovedAspects: readonly string[];
}

export const createAdventureCreativeProductionSession = (
  workOrder: AdventureCreativeWorkOrder,
): AdventureCreativeProductionSession => ({
  sessionVersion: 1,
  workOrder,
  status: "awaiting-candidate",
  iterations: [],
  preserveApprovedAspects: [],
});

const currentIteration = (
  session: AdventureCreativeProductionSession,
): AdventureCreativeSessionIteration | null => session.iterations.at(-1) ?? null;

const expectedCandidateRevision = (session: AdventureCreativeProductionSession): number =>
  session.iterations.length + 1;

export const submitAdventureCreativeCandidate = (
  session: AdventureCreativeProductionSession,
  candidate: AdventureCreativeCandidateEvidence,
): AdventureCreativeProductionSession => {
  if (session.status !== "awaiting-candidate" && session.status !== "rework-required") {
    throw new Error(`Creative session cannot receive a candidate while '${session.status}'.`);
  }
  if (candidate.workOrderId !== session.workOrder.workOrderId) {
    throw new Error("Creative candidate belongs to a different work order.");
  }
  const expected = expectedCandidateRevision(session);
  if (candidate.candidateRevision !== expected) {
    throw new Error(`Creative candidate revision ${candidate.candidateRevision} does not match expected revision ${expected}.`);
  }
  const previous = currentIteration(session)?.candidate;
  if (previous && candidate.previousCandidateDigest !== previous.candidateDigest) {
    throw new Error("Creative candidate revision does not preserve previous-candidate lineage.");
  }
  return {
    ...session,
    status: "awaiting-review",
    iterations: [...session.iterations, { candidate }],
  };
};

export const reviewAdventureCreativeSession = (
  session: AdventureCreativeProductionSession,
): AdventureCreativeProductionSession => {
  if (session.status !== "awaiting-review") {
    throw new Error(`Creative session cannot be reviewed while '${session.status}'.`);
  }
  const iteration = currentIteration(session);
  if (!iteration) throw new Error("Creative session has no candidate to review.");
  const review = reviewAdventureCreativeCandidate(
    session.workOrder,
    iteration.candidate,
    session.iterations.length,
  );
  if (review.decision === "accepted") {
    const acceptance = acceptAdventureCreativeCandidate(session.workOrder, iteration.candidate, review);
    return {
      ...session,
      status: "accepted",
      iterations: [
        ...session.iterations.slice(0, -1),
        { ...iteration, review, acceptance },
      ],
    };
  }
  const rework = createAdventureCreativeReworkRequest(
    session.workOrder,
    iteration.candidate,
    review,
    session.preserveApprovedAspects,
  );
  return {
    ...session,
    status: "rework-required",
    iterations: [
      ...session.iterations.slice(0, -1),
      { ...iteration, review, rework },
    ],
  };
};

export const prepareAdventureCreativeRework = (
  session: AdventureCreativeProductionSession,
  preserveApprovedAspects: readonly string[],
): AdventureCreativeProductionSession => {
  if (session.status !== "rework-required") {
    throw new Error(`Creative rework cannot be prepared while '${session.status}'.`);
  }
  const iteration = currentIteration(session);
  if (!iteration?.review || iteration.review.decision === "accepted") {
    throw new Error("Creative session has no failed review to rework.");
  }
  const preserved = [...new Set(preserveApprovedAspects)].sort((left, right) => left.localeCompare(right));
  const rework = createAdventureCreativeReworkRequest(
    session.workOrder,
    iteration.candidate,
    iteration.review,
    preserved,
  );
  return {
    ...session,
    status: "awaiting-candidate",
    preserveApprovedAspects: preserved,
    iterations: [
      ...session.iterations.slice(0, -1),
      { ...iteration, rework },
    ],
  };
};

export const acceptedAdventureCreativeEvidence = (
  session: AdventureCreativeProductionSession,
): AdventureCreativeAcceptance | null => {
  if (session.status !== "accepted") return null;
  return currentIteration(session)?.acceptance ?? null;
};
