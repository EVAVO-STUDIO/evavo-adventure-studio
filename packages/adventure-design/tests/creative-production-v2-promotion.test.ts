import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import {
  createAdventureCreativeProductionSession,
  prepareAdventureCreativeRework,
  reviewAdventureCreativeSession,
  submitAdventureCreativeCandidate,
} from "../src/creative-production-session.js";
import type { AdventureCreativeCandidateEvidence } from "../src/creative-production-handoff.js";
import {
  compareAdventureCreativeContractVersions,
  evaluateAdventureCreativePromotion,
} from "../src/creative-production-v2-promotion.js";
import type {
  AdventureCreativeCandidateManifestV2,
} from "../src/creative-handoff-acceptance.js";
import type { AdventureCreativeReviewResultV2 } from "../src/creative-handoff-v2.js";
import { createNinthReliquaryCreativeWorkOrders } from "../src/ninth-reliquary-creative-production.js";
import { compileNinthReliquaryCreativeProofWorkOrders } from "../src/ninth-reliquary-creative-proof.js";

const authorities = {
  projectId: "project.ninth-reliquary-proof" as Id<"project">,
  sourceRevisionDigest: "sha256:source-authority",
  visualStandardDigest: "sha256:visual-standard",
  styleBankDigest: "sha256:style-bank",
  protagonistModelSheetDigest: "sha256:model-sheet",
  protagonistWalkXSheetDigest: "sha256:walk-xsheet",
  environmentalReferenceDigests: ["sha256:environment-ref"],
  characterReferenceDigests: ["sha256:character-ref"],
};

const legacyWalkOrder = () =>
  createNinthReliquaryCreativeWorkOrders(authorities).find(
    (order) => order.workOrderId === "creative.ninth-reliquary.protagonist.walk-east",
  )!;

const legacyCandidate = (
  revision: number,
  digest: string,
  checkerboardDetected: boolean,
  previousCandidateDigest?: string,
): AdventureCreativeCandidateEvidence => {
  const order = legacyWalkOrder();
  return {
    contractVersion: 1,
    workOrderId: order.workOrderId,
    candidateRevision: revision,
    ...(previousCandidateDigest ? { previousCandidateDigest } : {}),
    sourceDigest: authorities.sourceRevisionDigest,
    candidateDigest: digest,
    width: order.nativeSize.width,
    height: order.nativeSize.height,
    mediaType: "image/png",
    alpha: {
      decodedAlphaPresent: true,
      fullyTransparentCanvasEdge: true,
      checkerboardDetected,
      matteResidueDetected: false,
      haloOrFringeDetected: false,
      alphaMaskReviewed: true,
      hostilePlateProofs: ["black", "white", "grey", "green", "magenta"],
    },
    animation: {
      frameIds: order.framePlan?.map((frame) => frame.frameId) ?? [],
      frameTimingTicks: order.framePlan?.map((frame) => frame.exposureTicks) ?? [],
      neighbourContinuityReviewed: true,
      loopClosureReviewed: true,
      identityLocked: true,
      anchorsStable: true,
      paletteStable: true,
      lineAndConstructionStable: true,
      independentlyGeneratedFrames: false,
      xSheetDigest: authorities.protagonistWalkXSheetDigest,
    },
    styleStandardDigest: authorities.visualStandardDigest,
    modelSheetDigest: authorities.protagonistModelSheetDigest,
    reviewScaleVerified: true,
  };
};

const acceptedLegacySession = () => {
  let session = createAdventureCreativeProductionSession(legacyWalkOrder());
  session = submitAdventureCreativeCandidate(
    session,
    legacyCandidate(1, "sha256:walk-candidate-r1", true),
  );
  session = reviewAdventureCreativeSession(session);
  expect(session.status).toBe("rework-required");
  session = prepareAdventureCreativeRework(session, [
    "approved model-sheet identity",
    "approved timing and anchors",
  ]);
  session = submitAdventureCreativeCandidate(
    session,
    legacyCandidate(
      2,
      "sha256:walk-candidate-r2",
      false,
      "sha256:walk-candidate-r1",
    ),
  );
  session = reviewAdventureCreativeSession(session);
  expect(session.status).toBe("accepted");
  return session;
};

const v2 = () =>
  compileNinthReliquaryCreativeProofWorkOrders(
    {
      sourceRevisionDigest: authorities.sourceRevisionDigest,
      styleDigest: authorities.visualStandardDigest,
      paletteDigest: authorities.styleBankDigest,
      environmentLayoutDigest: "sha256:layout",
      modelSheetDigest: authorities.protagonistModelSheetDigest,
      xSheetDigest: authorities.protagonistWalkXSheetDigest,
      referenceDigests: authorities.characterReferenceDigests,
    },
    2,
  ).maraWalkEast;

const candidateV2 = (): AdventureCreativeCandidateManifestV2 => {
  const order = v2();
  return {
    contractVersion: 2,
    workOrderId: order.workOrderId,
    projectId: String(order.projectId),
    assetId: String(order.assetId),
    revision: order.revision,
    candidateDigest: "sha256:walk-candidate-r2",
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
};

const reviewV2 = (): AdventureCreativeReviewResultV2 => ({
  contractVersion: 2,
  workOrderId: v2().workOrderId,
  revision: v2().revision,
  candidateDigest: "sha256:walk-candidate-r2",
  decision: "accepted",
  issues: [],
  reviewedFrameIds: v2().framePlan?.map((frame) => frame.frameId) ?? [],
  alphaEvidenceDigest: "sha256:alpha-review",
  sequenceEvidenceDigest: "sha256:sequence-review",
  styleEvidenceDigest: "sha256:style-review",
  reviewer: "animation-director",
  reviewedAt: "2026-08-25T00:00:00Z",
});

describe("Creative production v1 session + v2 promotion", () => {
  it("keeps the existing iterative rework loop and promotes only the exact v2-admitted candidate", () => {
    const session = acceptedLegacySession();
    expect(compareAdventureCreativeContractVersions(session.workOrder, v2())).toEqual([]);
    const result = evaluateAdventureCreativePromotion(
      session,
      v2(),
      candidateV2(),
      reviewV2(),
    );
    expect(result).toMatchObject({
      readyForMastering: true,
      sessionAccepted: true,
      consistencyIssues: [],
      admission: { accepted: true, issues: [] },
    });
  });

  it("blocks a v1-accepted candidate if v2 detects fake transparency", () => {
    const session = acceptedLegacySession();
    const candidate = candidateV2();
    const result = evaluateAdventureCreativePromotion(
      session,
      v2(),
      {
        ...candidate,
        alpha: {
          ...candidate.alpha,
          checkerboardDetected: true,
        },
      },
      reviewV2(),
    );
    expect(result.readyForMastering).toBe(false);
    expect(result.admission.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "fake-transparency" })]),
    );
  });

  it("blocks promotion when v1 and v2 animation contracts drift", () => {
    const session = acceptedLegacySession();
    const order = v2();
    const drifted = {
      ...order,
      framePlan: order.framePlan?.map((frame, index) =>
        index === 0 ? { ...frame, pivot: { x: 49, y: 178 } } : frame,
      ),
    };
    const result = evaluateAdventureCreativePromotion(
      session,
      drifted,
      candidateV2(),
      reviewV2(),
    );
    expect(result.readyForMastering).toBe(false);
    expect(result.consistencyIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "frame-pivot" })]),
    );
  });
});
