import { describe, expect, it } from "vitest";
import {
  admitAdventureCreativeDeliveryV3,
  applyAdventureCreativeReviewV3,
  createAdventureCreativePlanSessionV3,
  createAdventureCreativeProductionSessionV3,
  evaluateAdventureCreativePlanReadinessV3,
  openAdventureCreativeIssuesV3,
  prepareAdventureCreativeRepairRevisionV3,
  submitAdventureCreativeCandidateV3,
} from "../src/creative-production-session-v3.js";
import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeReviewV3,
  AdventureCreativeWorkOrderV3,
} from "../src/creative-production-handoff-v3.js";

const workOrder = (assetId = "asset.hero.walk"): AdventureCreativeWorkOrderV3 => ({
  contractVersion: 3,
  workOrderId: `work.${assetId}`,
  projectId: "project.iterative",
  assetId,
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 1,
  sourceRevisionDigest: "sha256:source",
  nativeSize: { width: 144, height: 48 },
  alphaPolicy: "required",
  preserveNativeCanvas: true,
  authorities: {
    profileId: "cinematic-handdrawn-conspiracy",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    modelSheetDigest: "sha256:model",
    xSheetDigest: "sha256:xsheet",
    referenceDigests: ["sha256:identity"],
  },
  invariants: ["identity", "foot baseline"],
  forbiddenDrift: ["independent frame redraw"],
  artDirection: ["controlled clean cel walk"],
  reviewChecklist: ["identity", "timing", "anchors", "alpha"],
  rejectionRules: ["fake checkerboard", "frame count drift"],
  framePlan: [
    { frameId: "f1", role: "contact", exposureTicks: 2, requiredNeighbourFrameIds: ["f2", "f3"] },
    { frameId: "f2", role: "passing", exposureTicks: 2, requiredNeighbourFrameIds: ["f1", "f3"] },
    { frameId: "f3", role: "contact", exposureTicks: 2, requiredNeighbourFrameIds: ["f1", "f2"] },
  ],
  sequencePolicy: {
    independentFrameGenerationForbidden: true,
    exactExposureTimingRequired: true,
    modelSheetConformanceRequired: true,
    xSheetConformanceRequired: true,
    immediateNeighbourReviewRequired: true,
    loopClosureReviewRequired: true,
  },
  transparencyPolicy: {
    checkerboardForbidden: true,
    decodedAlphaRequired: true,
    transparentCanvasEdgeRequired: true,
    matteResidueForbidden: true,
    haloFringeForbidden: true,
    transparentRgbContaminationForbidden: true,
    hostilePlateReviewRequired: true,
  },
  iterationPolicy: {
    maximumRevisionPasses: 4,
    compareAgainstPreviousApproved: true,
    requireIssueClosureEvidence: true,
    preferTargetedRepair: true,
    fullRegenerationRequiresExplicitReason: true,
  },
  requestedRepairs: [],
});

const repairReview = (order: AdventureCreativeWorkOrderV3, digest: string): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: digest,
  disposition: "repair-required",
  issues: [
    {
      issueId: "issue.f2.anchor",
      code: "anchor-drift",
      severity: "blocking",
      message: "Frame f2 rises two pixels above the approved planted baseline.",
      frameIds: ["f2"],
      evidenceDigests: ["sha256:anchor-qa"],
      suggestedRepair: "Repair f2 only. Preserve f1/f3, face construction, costume and all approved timing.",
    },
  ],
  closedIssueIds: [],
  alphaEvidenceDigest: "sha256:alpha-r1",
  sequenceEvidenceDigest: "sha256:sequence-r1",
  reviewerEvidenceDigest: "sha256:review-r1",
});

const acceptedReview = (order: AdventureCreativeWorkOrderV3, digest: string): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: digest,
  disposition: "accepted",
  issues: [],
  closedIssueIds: ["issue.f2.anchor"],
  alphaEvidenceDigest: "sha256:alpha-r2",
  sequenceEvidenceDigest: "sha256:sequence-r2",
  reviewerEvidenceDigest: "sha256:review-r2",
});

const delivery = (
  order: AdventureCreativeWorkOrderV3,
  review: AdventureCreativeReviewV3,
): AdventureCreativeAcceptedDeliveryV3 => ({
  deliveryVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  assetId: order.assetId,
  approvedArtifactDigest: review.candidateArtifactDigest,
  approvedByteLength: 45678,
  mediaType: "image/png",
  nativeSize: order.nativeSize,
  alphaEvidenceDigest: review.alphaEvidenceDigest,
  sequenceEvidenceDigest: review.sequenceEvidenceDigest,
  reviewEvidenceDigest: review.reviewerEvidenceDigest,
  sourceLineageDigests: [
    order.sourceRevisionDigest,
    order.authorities.styleDigest,
    order.authorities.paletteDigest!,
    order.authorities.modelSheetDigest!,
    order.authorities.xSheetDigest!,
    ...order.authorities.referenceDigests,
  ],
});

describe("creative production session v3", () => {
  it("repairs only the defective frame and accepts only the exact reviewed delivery", () => {
    let session = createAdventureCreativeProductionSessionV3(workOrder());
    session = submitAdventureCreativeCandidateV3(session, "sha256:candidate-r1");
    session = applyAdventureCreativeReviewV3(
      session,
      repairReview(session.revisions.at(-1)!.workOrder, "sha256:candidate-r1"),
    );
    expect(session.status).toBe("repair-required");
    expect(openAdventureCreativeIssuesV3(session)).toHaveLength(1);

    session = prepareAdventureCreativeRepairRevisionV3(session);
    expect(session.status).toBe("awaiting-candidate");
    expect(session.revisions).toHaveLength(2);
    const revision2 = session.revisions.at(-1)!.workOrder;
    expect(revision2.revision).toBe(2);
    expect(revision2.requestedRepairs[0]).toMatchObject({
      targetFrameIds: ["f2"],
      preserveFrameIds: ["f1", "f3"],
      allowRegenerateWholeAsset: false,
    });

    session = submitAdventureCreativeCandidateV3(session, "sha256:candidate-r2");
    const review2 = acceptedReview(revision2, "sha256:candidate-r2");
    session = applyAdventureCreativeReviewV3(session, review2);
    expect(session.status).toBe("awaiting-delivery");

    expect(() =>
      admitAdventureCreativeDeliveryV3(session, {
        ...delivery(revision2, review2),
        approvedArtifactDigest: "sha256:substituted-after-review",
      }),
    ).toThrow(/exact artifact digest/u);

    session = admitAdventureCreativeDeliveryV3(session, delivery(revision2, review2));
    expect(session.status).toBe("accepted");
    expect(session.acceptedDelivery?.approvedArtifactDigest).toBe("sha256:candidate-r2");
  });

  it("keeps whole-plan readiness blocked until every exact delivery is admitted", () => {
    const plan = createAdventureCreativePlanSessionV3([
      workOrder("asset.hero.walk"),
      { ...workOrder("asset.hero.inspect"), workOrderId: "work.asset.hero.inspect" },
    ]);
    expect(evaluateAdventureCreativePlanReadinessV3(plan)).toMatchObject({
      totalAssets: 2,
      acceptedAssets: 0,
      ready: false,
    });
  });
});
