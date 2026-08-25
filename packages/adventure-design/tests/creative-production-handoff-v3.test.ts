import { describe, expect, it } from "vitest";
import {
  nextAdventureCreativeRepairOrderV3,
  validateAdventureCreativeReviewV3,
  validateAdventureCreativeWorkOrderV3,
  type AdventureCreativeReviewV3,
  type AdventureCreativeWorkOrderV3,
} from "../src/creative-production-handoff-v3.js";

const order = (): AdventureCreativeWorkOrderV3 => ({
  contractVersion: 3,
  workOrderId: "adventure-work.ninth-reliquary.hero.walk-east",
  projectId: "project.ninth-reliquary",
  assetId: "asset.ninth-reliquary.hero",
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 1,
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
    referenceDigests: ["sha256:identity", "sha256:costume"],
  },
  invariants: ["same face construction", "same coat length", "stable planted-foot baseline"],
  forbiddenDrift: ["generic anime face", "independent frame redesign", "soft fake shadow under feet"],
  artDirection: ["clean cel line", "restrained modern anime influence", "purposeful hand acting"],
  reviewChecklist: ["identity", "silhouette", "alpha", "anchors", "timing", "loop closure"],
  rejectionRules: ["painted transparency grid", "cropped hair or hands", "frame count drift"],
  framePlan: [
    {
      frameId: "frame.walk.01",
      role: "contact",
      exposureTicks: 2,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      requiredNeighbourFrameIds: ["frame.walk.02", "frame.walk.08"],
    },
    {
      frameId: "frame.walk.02",
      role: "passing",
      exposureTicks: 2,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      requiredNeighbourFrameIds: ["frame.walk.01", "frame.walk.03"],
    },
    {
      frameId: "frame.walk.03",
      role: "contact",
      exposureTicks: 2,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      requiredNeighbourFrameIds: ["frame.walk.02"],
    },
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

describe("creative production handoff v3", () => {
  it("accepts a strict animation work order", () => {
    expect(validateAdventureCreativeWorkOrderV3(order())).toEqual([]);
  });

  it("turns one bad frame into a targeted repair while preserving good frames", () => {
    const original = order();
    const review: AdventureCreativeReviewV3 = {
      reviewVersion: 3,
      workOrderId: original.workOrderId,
      revision: 1,
      candidateArtifactDigest: "sha256:candidate-r1",
      disposition: "repair-required",
      issues: [
        {
          issueId: "issue.walk.02.anchor",
          code: "anchor-drift",
          severity: "blocking",
          message: "Frame 02 foot anchor rises three pixels and breaks planted-floor continuity.",
          frameIds: ["frame.walk.02"],
          evidenceDigests: ["sha256:sequence-qa"],
          suggestedRepair: "Repair frame 02 only; preserve head, coat silhouette and neighbouring approved drawings; restore foot point to y=92.",
        },
      ],
      closedIssueIds: [],
      alphaEvidenceDigest: "sha256:alpha-r1",
      sequenceEvidenceDigest: "sha256:sequence-r1",
      reviewerEvidenceDigest: "sha256:review-r1",
    };
    const repair = nextAdventureCreativeRepairOrderV3(original, review);
    expect(repair.revision).toBe(2);
    expect(repair.replacesRevision).toBe(1);
    expect(repair.requestedRepairs[0]).toMatchObject({
      issueId: "issue.walk.02.anchor",
      issueCode: "anchor-drift",
      targetFrameIds: ["frame.walk.02"],
      preserveFrameIds: ["frame.walk.01", "frame.walk.03"],
      allowRegenerateWholeAsset: false,
    });
  });

  it("does not accept transparent animation without alpha and sequence evidence", () => {
    const original = order();
    const review: AdventureCreativeReviewV3 = {
      reviewVersion: 3,
      workOrderId: original.workOrderId,
      revision: 1,
      candidateArtifactDigest: "sha256:candidate-r1",
      disposition: "accepted",
      issues: [],
      closedIssueIds: [],
      reviewerEvidenceDigest: "sha256:review-r1",
    };
    expect(validateAdventureCreativeReviewV3(original, review)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-alpha-evidence" }),
        expect.objectContaining({ code: "missing-sequence-evidence" }),
      ]),
    );
  });

  it("rejects fake transparency governance", () => {
    const invalid: AdventureCreativeWorkOrderV3 = {
      ...order(),
      transparencyPolicy: {
        ...order().transparencyPolicy,
        decodedAlphaRequired: false,
        hostilePlateReviewRequired: false,
      },
    };
    expect(validateAdventureCreativeWorkOrderV3(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-alpha-policy" })]),
    );
  });
});
