import { describe, expect, it } from "vitest";
import {
  ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT,
  adventureCreativeConformanceAnimationOrderV3,
  adventureCreativeConformanceFingerprintV3,
  adventureCreativeConformanceStaticOrderV3,
  validateAdventureCreativeWorkOrderV3,
} from "../src/index.js";

describe("creative production v3 conformance", () => {
  it("keeps the shared vector fingerprint stable", () => {
    expect(adventureCreativeConformanceFingerprintV3()).toBe(
      ADVENTURE_CREATIVE_CONFORMANCE_V3_FINGERPRINT,
    );
  });

  it("accepts both canonical Adventure Studio work orders", () => {
    expect(validateAdventureCreativeWorkOrderV3(adventureCreativeConformanceStaticOrderV3)).toEqual([]);
    expect(validateAdventureCreativeWorkOrderV3(adventureCreativeConformanceAnimationOrderV3)).toEqual([]);
  });

  it("retains strict transparency and animation continuity invariants", () => {
    expect(adventureCreativeConformanceStaticOrderV3.transparencyPolicy).toMatchObject({
      checkerboardForbidden: true,
      decodedAlphaRequired: true,
      transparentCanvasEdgeRequired: true,
      matteResidueForbidden: true,
      haloFringeForbidden: true,
      transparentRgbContaminationForbidden: true,
      hostilePlateReviewRequired: true,
    });
    expect(adventureCreativeConformanceAnimationOrderV3.framePlan).toHaveLength(8);
    expect(adventureCreativeConformanceAnimationOrderV3.sequencePolicy).toMatchObject({
      independentFrameGenerationForbidden: true,
      exactExposureTimingRequired: true,
      modelSheetConformanceRequired: true,
      xSheetConformanceRequired: true,
      immediateNeighbourReviewRequired: true,
      loopClosureReviewRequired: true,
    });
  });
});
