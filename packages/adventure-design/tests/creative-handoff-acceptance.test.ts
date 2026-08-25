import { describe, expect, it } from "vitest";
import {
  type AdventureCreativeCandidateManifestV2,
  evaluateAdventureCreativeCandidateAdmission,
} from "../src/creative-handoff-acceptance.js";
import type { AdventureCreativeReviewResultV2 } from "../src/creative-handoff-v2.js";
import { compileNinthReliquaryCreativeProofWorkOrders } from "../src/ninth-reliquary-creative-proof.js";

const authority = {
  sourceRevisionDigest: "sha256:source-proof",
  styleDigest: "sha256:style-proof",
  paletteDigest: "sha256:palette-proof",
  environmentLayoutDigest: "sha256:layout-proof",
  modelSheetDigest: "sha256:model-proof",
  xSheetDigest: "sha256:xsheet-proof",
  referenceDigests: ["sha256:ref-a"],
};

const acceptedWalk = () => {
  const order = compileNinthReliquaryCreativeProofWorkOrders(authority).maraWalkEast;
  const candidate: AdventureCreativeCandidateManifestV2 = {
    contractVersion: 2,
    workOrderId: order.workOrderId,
    projectId: String(order.projectId),
    assetId: String(order.assetId),
    revision: order.revision,
    candidateDigest: "sha256:candidate-walk",
    nativeSize: order.nativeSize,
    alpha: {
      decoded: true,
      mode: "binary",
      transparentCanvasEdge: true,
      checkerboardDetected: false,
      matteResidueDetected: false,
      haloFringeDetected: false,
    },
    frames: order.framePlan?.map((frame) => ({
      frameId: frame.frameId,
      exposureTicks: frame.exposureTicks,
      ...(frame.sourceRect ? { sourceRect: frame.sourceRect } : {}),
      ...(frame.pivot ? { pivot: frame.pivot } : {}),
      ...(frame.footPoint ? { footPoint: frame.footPoint } : {}),
      ...(frame.handAnchor ? { handAnchor: frame.handAnchor } : {}),
      ...(frame.shadowAnchor ? { shadowAnchor: frame.shadowAnchor } : {}),
    })),
  };
  const review: AdventureCreativeReviewResultV2 = {
    contractVersion: 2,
    workOrderId: order.workOrderId,
    revision: order.revision,
    candidateDigest: candidate.candidateDigest,
    decision: "accepted",
    issues: [],
    reviewedFrameIds: order.framePlan?.map((frame) => frame.frameId) ?? [],
    alphaEvidenceDigest: "sha256:alpha-proof",
    sequenceEvidenceDigest: "sha256:sequence-proof",
    styleEvidenceDigest: "sha256:style-review-proof",
    reviewer: "animation-director",
    reviewedAt: "2026-08-25T00:00:00Z",
  };
  return { order, candidate, review };
};

describe("Adventure creative master admission", () => {
  it("admits only an exact reviewed animation candidate", () => {
    const { order, candidate, review } = acceptedWalk();
    expect(evaluateAdventureCreativeCandidateAdmission(order, candidate, review)).toMatchObject({
      accepted: true,
      issues: [],
    });
  });

  it("blocks fake transparency even if downstream review says accepted", () => {
    const { order, candidate, review } = acceptedWalk();
    const fakeAlpha: AdventureCreativeCandidateManifestV2 = {
      ...candidate,
      alpha: {
        ...candidate.alpha,
        checkerboardDetected: true,
        transparentCanvasEdge: false,
      },
    };
    const result = evaluateAdventureCreativeCandidateAdmission(order, fakeAlpha, review);
    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["fake-transparency", "transparent-edge"]),
    );
  });

  it("blocks frame order, exposure, pivot and contact drift", () => {
    const { order, candidate, review } = acceptedWalk();
    const frames = [...(candidate.frames ?? [])];
    const first = frames[0]!;
    const second = frames[1]!;
    frames[0] = {
      ...second,
      exposureTicks: first.exposureTicks + 1,
      pivot: { x: 17, y: 62 },
      footPoint: { x: 17, y: 62 },
    };
    const result = evaluateAdventureCreativeCandidateAdmission(
      order,
      { ...candidate, frames },
      review,
    );
    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["frame-order", "timing-mismatch", "pivot-drift", "foot-contact"]),
    );
  });

  it("blocks an accepted label without retained style evidence", () => {
    const { order, candidate, review } = acceptedWalk();
    const result = evaluateAdventureCreativeCandidateAdmission(
      order,
      candidate,
      { ...review, styleEvidenceDigest: undefined },
    );
    expect(result.accepted).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "review-invalid", path: "review.styleEvidenceDigest" }),
      ]),
    );
  });

  it("blocks a review that refers to different candidate bytes", () => {
    const { order, candidate, review } = acceptedWalk();
    const result = evaluateAdventureCreativeCandidateAdmission(
      order,
      candidate,
      { ...review, candidateDigest: "sha256:other-candidate" },
    );
    expect(result.accepted).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "candidate-digest" })]),
    );
  });
});
