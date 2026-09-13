import { describe, expect, it } from "vitest";
import {
  acceptedAdventureCreativeEvidence,
  createAdventureCreativeProductionSession,
  prepareAdventureCreativeRework,
  reviewAdventureCreativeSession,
  submitAdventureCreativeCandidate,
} from "../src/creative-production-session.js";
import type {
  AdventureCreativeCandidateEvidence,
  AdventureCreativeWorkOrder,
} from "../src/creative-production-handoff.js";

const order: AdventureCreativeWorkOrder = {
  contractVersion: 1,
  workOrderId: "creative.reliquary.foreground",
  projectId: "project.ninth-reliquary" as never,
  assetId: "asset.ninth-reliquary.foreground" as never,
  destinationStudio: "art-studio",
  taskKind: "foreground-plate",
  briefRevision: 2,
  sourceRevisionDigest: "source-2",
  visualStandardDigest: "standard-9",
  styleBankDigest: "style-9",
  nativeSize: { width: 640, height: 360 },
  alphaPolicy: "required",
  checkerboardForbidden: true,
  canvasEdgeMustBeTransparent: true,
  preserveNativeCanvas: true,
  requiredReferenceDigests: ["background-approved-4"],
  artDirection: ["Match approved room perspective and lighting."],
  rejectionRules: ["No checkerboard or halo."],
};

const candidate = (
  revision: number,
  digest: string,
  previousCandidateDigest?: string,
  clean = false,
): AdventureCreativeCandidateEvidence => ({
  contractVersion: 1,
  workOrderId: order.workOrderId,
  candidateRevision: revision,
  ...(previousCandidateDigest ? { previousCandidateDigest } : {}),
  sourceDigest: "raw-source-1",
  candidateDigest: digest,
  width: 640,
  height: 360,
  mediaType: "image/png",
  styleStandardDigest: "standard-9",
  reviewScaleVerified: true,
  alpha: {
    decodedAlphaPresent: true,
    fullyTransparentCanvasEdge: clean,
    checkerboardDetected: false,
    matteResidueDetected: false,
    haloOrFringeDetected: !clean,
    alphaMaskReviewed: true,
    hostilePlateProofs: ["black", "white", "grey", "green", "magenta"],
  },
});

describe("creative production session", () => {
  it("requires inspect-review-rework-review before accepting a corrected second revision", () => {
    let session = createAdventureCreativeProductionSession(order);
    session = submitAdventureCreativeCandidate(session, candidate(1, "candidate-1"));
    session = reviewAdventureCreativeSession(session);
    expect(session.status).toBe("rework-required");
    expect(session.iterations[0]?.review?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["nontransparent-canvas-edge", "halo-fringe"]),
    );

    session = prepareAdventureCreativeRework(session, ["approved shape", "approved perspective alignment"]);
    expect(session.status).toBe("awaiting-candidate");
    expect(session.iterations[0]?.rework?.preserveApprovedAspects).toEqual([
      "approved perspective alignment",
      "approved shape",
    ]);

    session = submitAdventureCreativeCandidate(
      session,
      candidate(2, "candidate-2", "candidate-1", true),
    );
    session = reviewAdventureCreativeSession(session);
    expect(session.status).toBe("accepted");
    expect(acceptedAdventureCreativeEvidence(session)).toMatchObject({
      candidateDigest: "candidate-2",
      acceptedRevision: 2,
      alphaAccepted: true,
    });
  });

  it("rejects skipped revisions and broken candidate lineage", () => {
    let session = createAdventureCreativeProductionSession(order);
    expect(() => submitAdventureCreativeCandidate(session, candidate(2, "candidate-2"))).toThrow(/expected revision 1/u);
    session = submitAdventureCreativeCandidate(session, candidate(1, "candidate-1"));
    session = reviewAdventureCreativeSession(session);
    session = prepareAdventureCreativeRework(session, []);
    expect(() => submitAdventureCreativeCandidate(session, candidate(2, "candidate-2", "wrong-parent", true))).toThrow(/lineage/u);
  });
});
