import { describe, expect, it } from "vitest";
import { evaluateNightShiftFoundationAcceptance } from "../src/night-shift-foundation-acceptance.js";
import { nightShiftOfficerMasterSlots } from "../src/night-shift-officer-master-contract.js";

const validOfficerArt = {
  assetId: "asset.night-shift.actor.officer" as never,
  width: 264,
  height: 50,
  paletteIndexed: true,
  colourCount: 48,
  alphaMode: "binary" as const,
  sourceFormat: "aseprite" as const,
};

const validOfficerReview = () => ({
  fileName: "officer.aseprite",
  width: 264,
  height: 50,
  indexedColour: true,
  colourCount: 48,
  alphaMode: "binary" as const,
  universalOutline: false,
  syntheticMicrotexture: false,
  frameReviews: nightShiftOfficerMasterSlots.map((slot) => ({
    frameId: slot.frameId,
    silhouetteReadsAtOneToOne: true,
    binaryAlpha: true,
    anchorsStable: true,
    paletteBanksReadable: true,
    ...(slot.footContact ? { footContactStable: true } : {}),
  })),
});

describe("Night Shift Foundation acceptance", () => {
  it("turns Foundation ready only when generated masters and the officer both pass", () => {
    const report = evaluateNightShiftFoundationAcceptance({
      officerArt: validOfficerArt,
      officerReview: validOfficerReview(),
    });
    expect(report).toMatchObject({
      status: "ready",
      generatedVisualsReady: true,
      officerStructuralReady: true,
      officerReviewReady: true,
    });
    expect(report.acceptedAssetIds).toHaveLength(7);
    expect(report.issues).toEqual([]);
  });

  it("stays blocked when the officer art is structurally valid but a required frame review fails", () => {
    const review = validOfficerReview();
    const frameReviews = review.frameReviews.map((entry, index) =>
      index === 0 ? { ...entry, anchorsStable: false } : entry,
    );
    const report = evaluateNightShiftFoundationAcceptance({
      officerArt: validOfficerArt,
      officerReview: { ...review, frameReviews },
    });
    expect(report.status).toBe("blocked");
    expect(report.officerStructuralReady).toBe(true);
    expect(report.officerReviewReady).toBe(false);
    expect(report.acceptedAssetIds).toEqual([]);
    expect(report.issues.some((message) => message.includes("anchor-failed"))).toBe(true);
  });
});
