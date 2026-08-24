import { describe, expect, it } from "vitest";
import { nightShiftOfficerMasterSlots } from "../src/night-shift-officer-master-contract.js";
import {
  nightShiftOfficerReviewTemplate,
  nightShiftOfficerReviewTemplateFileName,
  nightShiftOfficerReviewTemplateJson,
} from "../src/night-shift-officer-review-template.js";

describe("Night Shift officer review template", () => {
  it("tracks every required frame and only marks foot-contact checks where needed", () => {
    expect(nightShiftOfficerReviewTemplate.frameReviews).toHaveLength(12);
    expect(nightShiftOfficerReviewTemplate.frameReviews.map((review) => review.frameId)).toEqual(
      nightShiftOfficerMasterSlots.map((slot) => slot.frameId),
    );
    expect(
      nightShiftOfficerReviewTemplate.frameReviews.filter(
        (review) => "footContactStable" in review,
      ),
    ).toHaveLength(2);
    expect(
      nightShiftOfficerReviewTemplate.frameReviews.every(
        (review) =>
          review.silhouetteReadsAtOneToOne === false &&
          review.binaryAlpha === false &&
          review.anchorsStable === false &&
          review.paletteBanksReadable === false,
      ),
    ).toBe(true);
  });

  it("serialises deterministically as an explicitly unapproved review document", () => {
    const first = nightShiftOfficerReviewTemplateJson();
    const second = nightShiftOfficerReviewTemplateJson();
    expect(first).toBe(second);
    expect(JSON.parse(first).globalReview.alphaMode).toBe("unreviewed");
    expect(nightShiftOfficerReviewTemplateFileName).toBe(
      "night-shift.officer-review-template.json",
    );
  });
});
