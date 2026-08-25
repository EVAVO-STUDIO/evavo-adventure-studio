import { describe, expect, it } from "vitest";
import {
  validateAdventureCreativeAcceptedDeliveryV3,
} from "../src/creative-production-acceptance-v3.js";
import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeReviewV3,
  AdventureCreativeWorkOrderV3,
} from "../src/creative-production-handoff-v3.js";

const order: AdventureCreativeWorkOrderV3 = {
  contractVersion: 3,
  workOrderId: "work.ninth-reliquary.walk",
  projectId: "project.ninth-reliquary",
  assetId: "asset.ninth-reliquary.mara.walk-east",
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 3,
  replacesRevision: 2,
  sourceRevisionDigest: "sha256:source",
  nativeSize: { width: 384, height: 96 },
  alphaPolicy: "required",
  preserveNativeCanvas: true,
  authorities: {
    profileId: "cinematic-handdrawn-conspiracy",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    modelSheetDigest: "sha256:model",
    xSheetDigest: "sha256:xsheet",
    referenceDigests: ["sha256:ref-a", "sha256:ref-b"],
  },
  invariants: ["identity", "foot baseline"],
  forbiddenDrift: ["generic anime face"],
  artDirection: ["clean cel"],
  reviewChecklist: ["alpha", "timing", "anchors"],
  rejectionRules: ["fake checkerboard"],
  framePlan: [
    { frameId: "f1", role: "contact", exposureTicks: 2, requiredNeighbourFrameIds: ["f2"] },
    { frameId: "f2", role: "passing", exposureTicks: 2, requiredNeighbourFrameIds: ["f1"] },
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
    maximumRevisionPasses: 5,
    compareAgainstPreviousApproved: true,
    requireIssueClosureEvidence: true,
    preferTargetedRepair: true,
    fullRegenerationRequiresExplicitReason: true,
  },
  requestedRepairs: [],
};

const review: AdventureCreativeReviewV3 = {
  reviewVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:artifact-approved",
  disposition: "accepted",
  issues: [],
  closedIssueIds: [],
  alphaEvidenceDigest: "sha256:alpha",
  sequenceEvidenceDigest: "sha256:sequence",
  styleEvidenceDigest: "sha256:style-review",
  reviewerEvidenceDigest: "sha256:review",
};

const delivery = (): AdventureCreativeAcceptedDeliveryV3 => ({
  deliveryVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  assetId: order.assetId,
  approvedArtifactDigest: review.candidateArtifactDigest,
  approvedByteLength: 123456,
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

describe("creative delivery acceptance v3", () => {
  it("accepts only the exact reviewed artifact and evidence lineage", () => {
    expect(validateAdventureCreativeAcceptedDeliveryV3(order, review, delivery())).toEqual([]);
  });

  it("rejects byte substitution after review", () => {
    expect(
      validateAdventureCreativeAcceptedDeliveryV3(order, review, {
        ...delivery(),
        approvedArtifactDigest: "sha256:different-bytes",
      }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: "delivery-byte-mismatch" })]));
  });

  it("rejects missing accepted alpha/sequence evidence", () => {
    const invalid = { ...delivery(), alphaEvidenceDigest: undefined, sequenceEvidenceDigest: undefined };
    expect(validateAdventureCreativeAcceptedDeliveryV3(order, review, invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "alpha-evidence-mismatch" }),
        expect.objectContaining({ code: "sequence-evidence-mismatch" }),
      ]),
    );
  });

  it("rejects delivery missing model/X-sheet/style lineage", () => {
    const invalid = { ...delivery(), sourceLineageDigests: [order.sourceRevisionDigest] };
    expect(validateAdventureCreativeAcceptedDeliveryV3(order, review, invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-source-lineage" })]),
    );
  });
});
