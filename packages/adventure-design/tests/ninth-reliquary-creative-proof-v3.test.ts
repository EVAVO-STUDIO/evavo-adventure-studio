import { describe, expect, it } from "vitest";
import {
  nextAdventureCreativeRepairOrderV3,
  validateAdventureCreativeReviewV3,
  validateAdventureCreativeWorkOrderV3,
  type AdventureCreativeReviewV3,
} from "../src/creative-production-handoff-v3.js";
import {
  compileNinthReliquaryCreativeProofV3,
  ninthReliquaryInspectFramePlanV3,
  ninthReliquaryWalkFramePlanV3,
} from "../src/ninth-reliquary-creative-proof-v3.js";

const proof = () =>
  compileNinthReliquaryCreativeProofV3({
    sourceRevisionDigest: "sha256:source-r1",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    environmentLayoutDigest: "sha256:layout",
    modelSheetDigest: "sha256:model-sheet",
    xSheetDigest: "sha256:x-sheet",
    referenceDigests: ["sha256:ref-b", "sha256:ref-a", "sha256:ref-a"],
  });

describe("Ninth Reliquary v3 creative proof", () => {
  it("compiles Art Studio and Cel Animation Studio work orders under one v3 protocol", () => {
    const orders = proof();
    expect(Object.values(orders).every((order) => validateAdventureCreativeWorkOrderV3(order).length === 0)).toBe(true);
    expect(orders.squareLayout).toMatchObject({
      destinationStudio: "art-studio",
      taskKind: "background-layout",
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
    });
    expect(orders.squareForeground).toMatchObject({
      destinationStudio: "art-studio",
      taskKind: "foreground-plate",
      alphaPolicy: "required",
      transparencyPolicy: {
        checkerboardForbidden: true,
        decodedAlphaRequired: true,
        transparentCanvasEdgeRequired: true,
        matteResidueForbidden: true,
        haloFringeForbidden: true,
        transparentRgbContaminationForbidden: true,
        hostilePlateReviewRequired: true,
      },
    });
    expect(orders.maraWalkEast).toMatchObject({
      destinationStudio: "cel-animation-studio",
      taskKind: "animation-sequence",
      sequencePolicy: {
        independentFrameGenerationForbidden: true,
        exactExposureTimingRequired: true,
        modelSheetConformanceRequired: true,
        xSheetConformanceRequired: true,
        immediateNeighbourReviewRequired: true,
        loopClosureReviewRequired: true,
      },
    });
  });

  it("keeps every animation drawing connected to immediate neighbours and exact exposures", () => {
    expect(ninthReliquaryWalkFramePlanV3).toHaveLength(10);
    expect(ninthReliquaryWalkFramePlanV3.map((frame) => frame.exposureTicks)).toEqual([
      3, 2, 2, 2, 3, 2, 2, 2, 3, 2,
    ]);
    for (const frame of ninthReliquaryWalkFramePlanV3) {
      expect(frame.requiredNeighbourFrameIds.length).toBeGreaterThanOrEqual(2);
      expect(frame.pivot).toEqual({ x: 48, y: 178 });
      expect(frame.footPoint).toEqual({ x: 48, y: 178 });
    }
    expect(ninthReliquaryInspectFramePlanV3[0]?.requiredNeighbourFrameIds).toEqual(["inspect.02"]);
    expect(ninthReliquaryInspectFramePlanV3.at(-1)?.requiredNeighbourFrameIds).toEqual(["inspect.05"]);
  });

  it("turns a frame-specific blocking review into a targeted repair revision", () => {
    const order = proof().maraWalkEast;
    const badFrame = "walk-east.05";
    const review: AdventureCreativeReviewV3 = {
      reviewVersion: 3,
      workOrderId: order.workOrderId,
      revision: order.revision,
      candidateArtifactDigest: "sha256:candidate-r1",
      disposition: "repair-required",
      issues: [
        {
          issueId: "issue.walk.foot-contact",
          code: "ground-contact-drift",
          severity: "blocking",
          message: "Right planted foot slides two pixels across the contact drawing.",
          frameIds: [badFrame],
          evidenceDigests: ["sha256:sequence-evidence"],
          suggestedRepair: "Redraw only the right contact drawing so the planted toe and heel remain locked to the approved ground line; preserve every other drawing unchanged.",
        },
      ],
      closedIssueIds: [],
      alphaEvidenceDigest: "sha256:alpha-evidence",
      sequenceEvidenceDigest: "sha256:sequence-evidence",
      styleEvidenceDigest: "sha256:style-evidence",
      reviewerEvidenceDigest: "sha256:review-r1",
    };

    expect(validateAdventureCreativeReviewV3(order, review)).toEqual([]);
    const repaired = nextAdventureCreativeRepairOrderV3(order, review);
    expect(repaired.revision).toBe(2);
    expect(repaired.replacesRevision).toBe(1);
    expect(repaired.requestedRepairs).toHaveLength(1);
    expect(repaired.requestedRepairs[0]).toMatchObject({
      issueId: "issue.walk.foot-contact",
      issueCode: "ground-contact-drift",
      targetFrameIds: [badFrame],
      allowRegenerateWholeAsset: false,
    });
    expect(repaired.requestedRepairs[0]?.preserveFrameIds).toHaveLength(9);
    expect(repaired.requestedRepairs[0]?.preserveFrameIds).not.toContain(badFrame);
  });

  it("will not accept transparent or animated delivery without its required evidence", () => {
    const order = proof().maraWalkEast;
    const acceptedWithoutEvidence: AdventureCreativeReviewV3 = {
      reviewVersion: 3,
      workOrderId: order.workOrderId,
      revision: order.revision,
      candidateArtifactDigest: "sha256:candidate",
      disposition: "accepted",
      issues: [],
      closedIssueIds: [],
      reviewerEvidenceDigest: "sha256:review",
    };
    expect(validateAdventureCreativeReviewV3(order, acceptedWithoutEvidence).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing-alpha-evidence", "missing-sequence-evidence"]),
    );
  });
});
