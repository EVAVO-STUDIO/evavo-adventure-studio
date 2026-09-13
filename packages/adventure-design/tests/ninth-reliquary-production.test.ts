import { describe, expect, it } from "vitest";
import { adventureProductionProfiles } from "../src/production-profile-presets.js";
import { validateAdventureProductionProfile } from "../src/production-profile-validate.js";
import { createNinthReliquaryCreativeWorkOrders } from "../src/ninth-reliquary-creative-production.js";

const authorities = {
  projectId: "project.ninth-reliquary" as never,
  sourceRevisionDigest: "source-revision-12",
  visualStandardDigest: "visual-standard-4",
  styleBankDigest: "style-bank-4",
  protagonistModelSheetDigest: "model-sheet-5",
  protagonistWalkXSheetDigest: "xsheet-walk-east-3",
  environmentalReferenceDigests: ["environment-reference-a", "environment-reference-b"],
  characterReferenceDigests: ["character-reference-a", "character-reference-b"],
};

describe("The Ninth Reliquary production lane", () => {
  it("registers a valid 640x360 cinematic hand-drawn production profile", () => {
    const profile = adventureProductionProfiles.find(
      (candidate) => candidate.id === "cinematic-handdrawn-conspiracy",
    );
    expect(profile).toBeDefined();
    expect(profile).toMatchObject({
      nativeSize: { width: 640, height: 360 },
      family: "cinematic-handdrawn",
      pixelMotionPolicy: "free",
      palette: { maxColours: 256 },
      showcase: { id: "showcase.ninth-reliquary", title: "The Ninth Reliquary" },
    });
    expect(profile?.productionModes).toEqual(expect.arrayContaining(["graphic-cel"]));
    expect(profile?.rules.join(" ")).toMatch(/model-sheet|X-sheet|alpha/u);
    expect(profile?.prohibitions.join(" ")).toMatch(/checkerboard|independently regenerated/u);
    expect(validateAdventureProductionProfile(profile!)).toEqual([]);
  });

  it("routes environment art to Art Studio and character animation to Cel Animation Studio", () => {
    const orders = createNinthReliquaryCreativeWorkOrders(authorities);
    expect(orders).toHaveLength(4);
    expect(orders.filter((order) => order.destinationStudio === "art-studio").map((order) => order.taskKind)).toEqual([
      "background",
      "foreground-plate",
    ]);
    expect(orders.filter((order) => order.destinationStudio === "cel-animation-studio").map((order) => order.taskKind)).toEqual([
      "character-model-sheet",
      "animation-sequence",
    ]);
  });

  it("makes transparency and X-sheet continuity non-negotiable for the returned animation", () => {
    const walk = createNinthReliquaryCreativeWorkOrders(authorities).find(
      (order) => order.taskKind === "animation-sequence",
    );
    expect(walk).toMatchObject({
      nativeSize: { width: 960, height: 192 },
      alphaPolicy: "required",
      checkerboardForbidden: true,
      canvasEdgeMustBeTransparent: true,
      characterModelSheetDigest: "model-sheet-5",
      xSheetDigest: "xsheet-walk-east-3",
    });
    expect(walk?.framePlan).toHaveLength(10);
    expect(walk?.framePlan?.map((frame) => frame.role)).toEqual(
      expect.arrayContaining(["contact", "passing", "breakdown"]),
    );
    expect(walk?.rejectionRules.join(" ")).toMatch(/independent-frame regeneration|foot skating|checkerboard/u);
  });
});
