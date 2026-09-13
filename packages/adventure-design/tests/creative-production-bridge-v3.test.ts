import { describe, expect, it } from "vitest";
import {
  compileAdventureStudioProductionRequestV3,
  compileArtStudioProductionRequestV3,
  compileCelAnimationStudioProductionRequestV3,
} from "../src/creative-production-bridge-v3.js";
import { compileNinthReliquaryCreativeProofV3 } from "../src/ninth-reliquary-creative-proof-v3.js";

const proof = () =>
  compileNinthReliquaryCreativeProofV3({
    sourceRevisionDigest: "sha256:source",
    styleDigest: "sha256:style",
    paletteDigest: "sha256:palette",
    environmentLayoutDigest: "sha256:layout",
    modelSheetDigest: "sha256:model-sheet",
    xSheetDigest: "sha256:x-sheet",
    referenceDigests: ["sha256:b", "sha256:a", "sha256:a"],
  });

describe("Adventure Studio v3 production bridge", () => {
  it("compiles an Art Studio request with strict alpha admission and targeted repairs", () => {
    const request = compileArtStudioProductionRequestV3(proof().squareForeground);
    expect(request).toMatchObject({
      requestVersion: 3,
      taskKind: "foreground-plate",
      nativeSize: { width: 640, height: 360 },
      alphaAdmission: {
        required: true,
        checkerboardForbidden: true,
        decodedAlphaRequired: true,
        transparentCanvasEdgeRequired: true,
        hostilePlateReviewRequired: true,
        rejectMatteResidue: true,
        rejectHaloFringe: true,
        rejectTransparentRgbContamination: true,
      },
    });
    expect(request.authorities.referenceDigests).toEqual(["sha256:a", "sha256:b"]);
  });

  it("compiles a Cel Animation Studio request with authored X-sheet/model-sheet constraints", () => {
    const request = compileCelAnimationStudioProductionRequestV3(proof().maraWalkEast);
    expect(request.framePlan).toHaveLength(10);
    expect(request.sequencePolicy).toMatchObject({
      independentFrameGenerationForbidden: true,
      exactExposureTimingRequired: true,
      modelSheetConformanceRequired: true,
      xSheetConformanceRequired: true,
      immediateNeighbourReviewRequired: true,
      loopClosureReviewRequired: true,
    });
    expect(request.authorities.modelSheetDigest).toBe("sha256:model-sheet");
    expect(request.authorities.xSheetDigest).toBe("sha256:x-sheet");
  });

  it("routes generic work orders to the correct sibling studio without reinterpretation", () => {
    expect(compileAdventureStudioProductionRequestV3(proof().squareBackground).destination).toBe("art-studio");
    expect(compileAdventureStudioProductionRequestV3(proof().maraInspect).destination).toBe("cel-animation-studio");
  });

  it("rejects attempts to send a Cel sequence through the static Art Studio bridge", () => {
    expect(() => compileArtStudioProductionRequestV3(proof().maraWalkEast)).toThrow(/not an Art Studio/u);
  });
});
