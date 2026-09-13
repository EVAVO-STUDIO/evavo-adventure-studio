import { describe, expect, it } from "vitest";
import { nightShiftOfficerMasterSlots } from "../src/night-shift-officer-master-contract.js";
import {
  evaluateNightShiftOfficerMaster,
  type NightShiftOfficerMasterEvidence,
} from "../src/night-shift-officer-master-intake.js";

const validEvidence = (): NightShiftOfficerMasterEvidence => ({
  fileName: "officer.aseprite",
  width: 264,
  height: 50,
  indexedColour: true,
  colourCount: 48,
  alphaMode: "binary",
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

describe("Night Shift officer master intake", () => {
  it("accepts a fully reviewed 264x50 indexed master", () => {
    const report = evaluateNightShiftOfficerMaster(validEvidence());
    expect(report).toMatchObject({ status: "ready", reviewedFrames: 12, requiredFrames: 12 });
    expect(report.issues).toEqual([]);
  });

  it("rejects wrong dimensions, true-colour/soft-alpha and modern contamination", () => {
    const report = evaluateNightShiftOfficerMaster({
      ...validEvidence(),
      width: 528,
      indexedColour: false,
      colourCount: 300,
      alphaMode: "soft",
      universalOutline: true,
      syntheticMicrotexture: true,
    });
    expect(report.status).toBe("blocked");
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "wrong-dimensions",
        "not-indexed",
        "too-many-colours",
        "soft-alpha",
        "universal-outline",
        "synthetic-microtexture",
      ]),
    );
  });

  it("rejects a missing pose review and unstable planted-foot contact", () => {
    const evidence = validEvidence();
    const leftContact = nightShiftOfficerMasterSlots.find((slot) => slot.footContact === "left")!;
    const filtered = evidence.frameReviews
      .filter((review) => review.frameId !== nightShiftOfficerMasterSlots[0]!.frameId)
      .map((review) =>
        review.frameId === leftContact.frameId ? { ...review, footContactStable: false } : review,
      );
    const report = evaluateNightShiftOfficerMaster({ ...evidence, frameReviews: filtered });
    expect(report.reviewedFrames).toBe(11);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-frame-review" }),
        expect.objectContaining({ code: "foot-contact-failed", frameId: leftContact.frameId }),
      ]),
    );
  });

  it("rejects per-frame silhouette, anchor and palette-readability failures", () => {
    const evidence = validEvidence();
    const target = nightShiftOfficerMasterSlots.find((slot) => slot.role === "inspect")!;
    const frameReviews = evidence.frameReviews.map((review) =>
      review.frameId === target.frameId
        ? {
            ...review,
            silhouetteReadsAtOneToOne: false,
            anchorsStable: false,
            paletteBanksReadable: false,
          }
        : review,
    );
    const report = evaluateNightShiftOfficerMaster({ ...evidence, frameReviews });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "silhouette-failed", frameId: target.frameId }),
        expect.objectContaining({ code: "anchor-failed", frameId: target.frameId }),
        expect.objectContaining({ code: "palette-readability-failed", frameId: target.frameId }),
      ]),
    );
  });

  it("does not count unrelated review records toward the twelve required frames", () => {
    const evidence = validEvidence();
    const report = evaluateNightShiftOfficerMaster({
      ...evidence,
      frameReviews: [
        ...evidence.frameReviews.slice(0, 11),
        {
          frameId: "frame.unrelated",
          silhouetteReadsAtOneToOne: true,
          binaryAlpha: true,
          anchorsStable: true,
          paletteBanksReadable: true,
        },
      ],
    });
    expect(report.reviewedFrames).toBe(11);
    expect(report.issues.some((issue) => issue.code === "missing-frame-review")).toBe(true);
  });
});
