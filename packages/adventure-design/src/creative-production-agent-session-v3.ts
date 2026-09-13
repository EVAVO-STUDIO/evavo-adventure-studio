import type { AdventureCreativeStrictQualityEvidenceV3 } from "./creative-production-quality-v3.js";
import { createAdventureCreativeAutomatedReviewV3 } from "./creative-production-review-agent-v3.js";
import {
  applyAdventureCreativeReviewV3,
  prepareAdventureCreativeRepairRevisionV3,
  type AdventureCreativeProductionSessionV3,
} from "./creative-production-session-v3.js";

export interface AdventureCreativeAgentSessionStepV3 {
  readonly session: AdventureCreativeProductionSessionV3;
  readonly disposition: "accepted" | "repair-required";
  readonly reviewedRevision: number;
  readonly nextRevision: number | null;
  readonly issueCount: number;
  readonly blockingIssueCount: number;
  readonly majorIssueCount: number;
}

export const advanceAdventureCreativeSessionFromEvidenceV3 = (
  session: AdventureCreativeProductionSessionV3,
  evidence: AdventureCreativeStrictQualityEvidenceV3,
  reviewerEvidenceDigest: string,
): AdventureCreativeAgentSessionStepV3 => {
  if (session.status !== "awaiting-review") {
    throw new Error(`Creative production agent requires awaiting-review session, received '${session.status}'.`);
  }
  const revision = session.revisions.at(-1);
  if (!revision?.candidateArtifactDigest) {
    throw new Error("Creative production agent requires an exact submitted candidate before evidence review.");
  }
  if (revision.candidateArtifactDigest !== evidence.candidateArtifactDigest) {
    throw new Error("Creative production agent evidence does not describe the submitted candidate bytes.");
  }
  const automated = createAdventureCreativeAutomatedReviewV3(
    revision.workOrder,
    evidence,
    reviewerEvidenceDigest,
  );
  const reviewed = applyAdventureCreativeReviewV3(session, automated.review);
  if (automated.review.disposition === "accepted") {
    return {
      session: reviewed,
      disposition: "accepted",
      reviewedRevision: revision.workOrder.revision,
      nextRevision: null,
      issueCount: automated.issueCount,
      blockingIssueCount: automated.blockingIssueCount,
      majorIssueCount: automated.majorIssueCount,
    };
  }
  const repaired = prepareAdventureCreativeRepairRevisionV3(reviewed);
  return {
    session: repaired,
    disposition: "repair-required",
    reviewedRevision: revision.workOrder.revision,
    nextRevision: repaired.revisions.at(-1)?.workOrder.revision ?? null,
    issueCount: automated.issueCount,
    blockingIssueCount: automated.blockingIssueCount,
    majorIssueCount: automated.majorIssueCount,
  };
};
