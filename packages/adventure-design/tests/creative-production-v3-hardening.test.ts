import { describe, expect, it } from "vitest";
import {
  nextAdventureCreativeRepairOrderV3,
  type AdventureCreativeReviewV3,
  type AdventureCreativeWorkOrderV3,
  validateAdventureCreativeReviewV3,
} from "../src/creative-production-handoff-v3.js";
import { ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT } from "../src/creative-production-protocol-v3.js";

const order = (): AdventureCreativeWorkOrderV3 => ({
  contractVersion: 3,
  workOrderId: "creative.ninth-reliquary.mara.walk-east.r1",
  projectId: "project.ninth-reliquary",
  assetId: "asset.ninth-reliquary.mara.walk-east",
  destinationStudio: "cel-animation-studio",
  taskKind: "animation-sequence",
  revision: 1,
  sourceRevisionDigest: "sha256:source-r1",
  nativeSize: { width: 256, height: 96 },
  alphaPolicy: "binary",
  preserveNativeCanvas: true,
  authorities: {
    profileId: "cinematic-handdrawn-conspiracy",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    modelSheetDigest: "sha256:model-sheet",
    xSheetDigest: "sha256:x-sheet",
    referenceDigests: ["sha256:reference"],
  },
  invariants: ["same character identity", "same costume", "same native baseline"],
  forbiddenDrift: ["generic anime face", "independent-frame identity drift"],
  artDirection: ["clean cel silhouette", "restrained hand acting"],
  reviewChecklist: ["flip whole cycle", "review every neighbour pair", "test alpha over hostile plates"],
  rejectionRules: ["reject painted checkerboard", "reject timing drift"],
  framePlan: [
    { frameId: "walk.01", role: "contact", exposureTicks: 2, requiredNeighbourFrameIds: ["walk.02"] },
    { frameId: "walk.02", role: "passing", exposureTicks: 2, requiredNeighbourFrameIds: ["walk.01", "walk.03"] },
    { frameId: "walk.03", role: "contact", exposureTicks: 2, requiredNeighbourFrameIds: ["walk.02", "walk.04"] },
    { frameId: "walk.04", role: "passing", exposureTicks: 2, requiredNeighbourFrameIds: ["walk.03"] },
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

const review = (disposition: AdventureCreativeReviewV3["disposition"]): AdventureCreativeReviewV3 => ({
  reviewVersion: 3,
  workOrderId: "creative.ninth-reliquary.mara.walk-east.r1",
  revision: 1,
  candidateArtifactDigest: "sha256:candidate",
  disposition,
  issues: [],
  closedIssueIds: [],
  alphaEvidenceDigest: "sha256:alpha",
  sequenceEvidenceDigest: "sha256:sequence",
  modelSheetEvidenceDigest: "sha256:model-conformance",
  xSheetEvidenceDigest: "sha256:xsheet-conformance",
  reviewerEvidenceDigest: "sha256:review",
});

describe("creative production v3 hardening", () => {
  it("keeps the exact protocol fingerprint shared with Art Studio and Cel Animation Studio", () => {
    expect(ADVENTURE_CREATIVE_HANDOFF_V3_PROTOCOL_FINGERPRINT).toBe("fnv1a64:7685192c8eee9542");
  });

  it("rejects an accepted review with any unresolved issue", () => {
    const accepted = review("accepted");
    const invalid: AdventureCreativeReviewV3 = {
      ...accepted,
      issues: [
        {
          issueId: "issue.minor.line",
          code: "style-drift",
          severity: "minor",
          message: "One cuff line is off-model.",
          frameIds: ["walk.02"],
          evidenceDigests: ["sha256:issue"],
          suggestedRepair: "Repair only the cuff line; preserve pose and neighbouring frames.",
        },
      ],
    };
    expect(validateAdventureCreativeReviewV3(order(), invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "accepted-with-open-issues" })]),
    );
  });

  it("requires model-sheet and X-sheet conformance evidence on accepted animation", () => {
    const accepted = review("accepted");
    expect(
      validateAdventureCreativeReviewV3(order(), {
        ...accepted,
        modelSheetEvidenceDigest: undefined,
        xSheetEvidenceDigest: undefined,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-model-sheet-evidence" }),
        expect.objectContaining({ code: "missing-x-sheet-evidence" }),
      ]),
    );
  });

  it("protects every frame outside the global repair target set", () => {
    const needsRepair: AdventureCreativeReviewV3 = {
      ...review("repair-required"),
      issues: [
        {
          issueId: "issue.anchor.02",
          code: "anchor-drift",
          severity: "major",
          message: "Frame 2 hand anchor drifts.",
          frameIds: ["walk.02"],
          evidenceDigests: ["sha256:anchor"],
          suggestedRepair: "Correct the hand anchor in frame 2 only.",
        },
        {
          issueId: "issue.contact.03",
          code: "ground-contact-drift",
          severity: "major",
          message: "Frame 3 planted foot slides.",
          frameIds: ["walk.03"],
          evidenceDigests: ["sha256:contact"],
          suggestedRepair: "Correct planted-foot contact in frame 3 only.",
        },
      ],
    };
    const next = nextAdventureCreativeRepairOrderV3(order(), needsRepair);
    expect(next.revision).toBe(2);
    expect(next.requestedRepairs).toHaveLength(2);
    for (const repair of next.requestedRepairs) {
      expect(repair.preserveFrameIds).toEqual(["walk.01", "walk.04"]);
      expect(repair.allowRegenerateWholeAsset).toBe(false);
    }
  });
});
