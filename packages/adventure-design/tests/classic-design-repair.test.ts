import { describe, expect, it } from "vitest";
import {
  classicAdventureDesignRepairPolicy,
  designRepairProfileForShowcase,
  validateShowcaseDesignRepairProfiles,
} from "../src/classic-design-repair.js";

const required = (showcaseId: string) =>
  designRepairProfileForShowcase(showcaseId)?.requiredRuleIds ?? [];

describe("classic adventure design repair policy", () => {
  it("keeps authenticity repair separate from modern UI replacement", () => {
    expect(classicAdventureDesignRepairPolicy.principle).toMatch(/Preserve the original era/u);
    expect(classicAdventureDesignRepairPolicy.rules.map((rule) => rule.id)).toEqual(
      expect.arrayContaining([
        "pixel-hunting",
        "hidden-dead-end",
        "opaque-failure",
        "retry-friction",
        "save-restriction",
      ]),
    );
    expect(
      classicAdventureDesignRepairPolicy.rules.flatMap((rule) => rule.prohibit),
    ).toEqual(expect.arrayContaining(["modern objective checklist", "modern hint arrow"]));
  });

  it("gives Open Case explicit procedural repair without modernising the case grammar", () => {
    const profile = designRepairProfileForShowcase("open-case");
    expect(required("open-case")).toEqual(
      expect.arrayContaining([
        "procedural-trial-and-error",
        "hidden-dead-end",
        "retry-friction",
      ]),
    );
    expect(profile?.referencePressure).toMatch(/Police Quest IV/u);
    expect(profile?.doNotModernize.join(" ")).toMatch(/caseboard.*quest tracker/iu);
  });

  it("keeps After Hours socially consequential but prevents accidental permanent poisoning", () => {
    const profile = designRepairProfileForShowcase("after-hours");
    expect(required("after-hours")).toContain("social-route-poisoning");
    expect(profile?.referencePressure).toMatch(/Leisure Suit Larry/u);
    expect(profile?.doNotModernize.join(" ")).toMatch(/relationship meter/iu);
  });

  it("uses modern-retro ergonomics in Cold Meridian without modern visual effects", () => {
    const profile = designRepairProfileForShowcase("cold-meridian");
    expect(required("cold-meridian")).toEqual(
      expect.arrayContaining(["pixel-hunting", "save-restriction", "retry-friction"]),
    );
    expect(profile?.doNotModernize.join(" ")).toMatch(/bloom.*chromatic aberration/iu);
    expect(profile?.doNotModernize.join(" ")).toMatch(/protagonist knowledge/iu);
  });

  it("keeps every required repair rule resolvable and every proof explicit about non-modernisation", () => {
    expect(validateShowcaseDesignRepairProfiles()).toEqual([]);
  });
});
