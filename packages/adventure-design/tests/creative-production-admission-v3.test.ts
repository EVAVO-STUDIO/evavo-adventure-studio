import { describe, expect, it } from "vitest";
import type {
  AdventureCreativeAcceptedDeliveryV3,
  AdventureCreativeReviewV3,
} from "../src/creative-production-handoff-v3.js";
import {
  admitAdventureCreativeDeliveryV3,
  validateAdventureCreativeDeliveryAdmissionV3,
} from "../src/creative-production-admission-v3.js";
import type { AdventureCreativeStrictQualityEvidenceV3 } from "../src/creative-production-quality-v3.js";
import { compileNinthReliquaryCreativeProofV3 } from "../src/ninth-reliquary-creative-proof-v3.js";

const workOrder = () =>
  compileNinthReliquaryCreativeProofV3({
    sourceRevisionDigest: "sha256:source",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    environmentLayoutDigest: "sha256:layout",
    modelSheetDigest: "sha256:model",
    xSheetDigest: "sha256:sheet",
  }).squareForeground;

const reviewFor = (order = workOrder()): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:foreground-candidate",
  disposition: "accepted",
  issues: [],
  closedIssueIds: [],
  alphaEvidenceDigest: "sha256:alpha-proof",
  styleEvidenceDigest: "sha256:style-proof",
  reviewerEvidenceDigest: "sha256:review-proof",
});

const qualityFor = (order = workOrder()): AdventureCreativeStrictQualityEvidenceV3 => ({
  qualityVersion: 1,
  workOrderId: order.workOrderId,
  revision: order.revision,
  candidateArtifactDigest: "sha256:foreground-candidate",
  styleEvidenceDigest: "sha256:strict-style",
  authorityDigests: {
    sourceRevisionDigest: order.sourceRevisionDigest,
    styleDigest: order.authorities.styleDigest,
    paletteDigest: order.authorities.paletteDigest,
    modelSheetDigest: order.authorities.modelSheetDigest,
    environmentLayoutDigest: order.authorities.environmentLayoutDigest,
    xSheetDigest: order.authorities.xSheetDigest,
  },
  alpha: {
    evidenceVersion: 1,
    artifactDigest: "sha256:foreground-candidate",
    decodedWidth: 640,
    decodedHeight: 360,
    totalPixels: 640 * 360,
    fullyTransparentPixels: 200_000,
    fullyOpaquePixels: 30_400,
    partialAlphaPixels: 0,
    checkerboardLikePixels: 0,
    matteResiduePixels: 0,
    haloPixels: 0,
    transparentRgbContaminatedPixels: 0,
    transparentCanvasEdge: true,
    hostilePlateEvidenceDigests: ["sha256:black", "sha256:white", "sha256:magenta"],
  },
  issueClosures: [],
});

const deliveryFor = (order = workOrder()): AdventureCreativeAcceptedDeliveryV3 => ({
  deliveryVersion: 3,
  workOrderId: order.workOrderId,
  revision: order.revision,
  assetId: order.assetId,
  approvedArtifactDigest: "sha256:foreground-candidate",
  approvedByteLength: 42_000,
  mediaType: "image/png",
  nativeSize: order.nativeSize,
  alphaEvidenceDigest: "sha256:alpha-proof",
  reviewEvidenceDigest: "sha256:review-proof",
  sourceLineageDigests: [
    order.sourceRevisionDigest,
    order.authorities.styleDigest,
    order.authorities.paletteDigest!,
    order.authorities.environmentLayoutDigest!,
  ],
});

describe("creative delivery admission v3", () => {
  it("admits only the exact reviewed transparent candidate with complete authority lineage", () => {
    const order = workOrder();
    const delivery = deliveryFor(order);
    expect(
      admitAdventureCreativeDeliveryV3(order, reviewFor(order), qualityFor(order), delivery),
    ).toBe(delivery);
  });

  it("rejects a re-export whose bytes no longer match the reviewed candidate digest", () => {
    const order = workOrder();
    const delivery = { ...deliveryFor(order), approvedArtifactDigest: "sha256:different-bytes" };
    expect(
      validateAdventureCreativeDeliveryAdmissionV3(order, reviewFor(order), qualityFor(order), delivery).map(
        (entry) => entry.code,
      ),
    ).toContain("artifact-mismatch");
  });

  it("rejects wrong native size or missing accepted alpha evidence", () => {
    const order = workOrder();
    const delivery = {
      ...deliveryFor(order),
      nativeSize: { width: 638, height: 360 },
      alphaEvidenceDigest: undefined,
    } as unknown as AdventureCreativeAcceptedDeliveryV3;
    const codes = validateAdventureCreativeDeliveryAdmissionV3(
      order,
      reviewFor(order),
      qualityFor(order),
      delivery,
    ).map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining(["native-size-mismatch", "alpha-evidence-mismatch"]));
  });

  it("rejects delivery that omits immutable layout/style/source lineage", () => {
    const order = workOrder();
    const delivery = { ...deliveryFor(order), sourceLineageDigests: [order.sourceRevisionDigest] };
    const issues = validateAdventureCreativeDeliveryAdmissionV3(
      order,
      reviewFor(order),
      qualityFor(order),
      delivery,
    );
    expect(issues.filter((entry) => entry.code === "missing-lineage")).toHaveLength(3);
  });
});
