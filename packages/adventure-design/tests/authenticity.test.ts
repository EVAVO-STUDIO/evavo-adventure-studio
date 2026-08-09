import { describe, expect, it } from "vitest";
import {
  createAdventureSceneProductionBriefs,
  evaluateAdventureAuthenticity,
  parseAdventureDesignDocument,
} from "../src/index.js";
import { showcaseAdventureDesigns } from "../src/showcases.js";

describe("adventure authenticity audit", () => {
  it("produces a complete deterministic ten-dimension report", () => {
    const report = evaluateAdventureAuthenticity(showcaseAdventureDesigns[0]!);

    expect(report.reportVersion).toBe(1);
    expect(report.maximumScore).toBe(100);
    expect(report.dimensions).toHaveLength(10);
    expect(report.score).toBe(report.dimensions.reduce((total, dimension) => total + dimension.score, 0));
    expect(report.dimensions.map((dimension) => dimension.id)).toEqual([
      "native-canvas",
      "palette-values",
      "scene-composition",
      "actor-performance",
      "interface-identity",
      "audio-identity",
      "world-cohesion",
      "puzzle-causality",
      "cinematic-continuity",
      "production-discipline",
    ]);
    expect(evaluateAdventureAuthenticity(showcaseAdventureDesigns[0]!)).toEqual(report);
  });

  it("keeps every original showcase above the developing threshold", () => {
    for (const document of showcaseAdventureDesigns) {
      const report = evaluateAdventureAuthenticity(document);
      expect(report.score).toBeGreaterThanOrEqual(65);
      expect(report.status).not.toBe("blocked");
      expect(report.findings.some((finding) => finding.severity === "error")).toBe(false);
    }
  });

  it("detects a narrow, duplicated and malformed anchor palette", () => {
    const source = showcaseAdventureDesigns[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      creativeDirection: {
        ...source.creativeDirection,
        palette: {
          ...source.creativeDirection.palette,
          keyColours: ["#202020", "#202020", "#303030", "blue"],
        },
      },
    });

    const report = evaluateAdventureAuthenticity(broken);
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "native-canvas-anchor-count",
        "palette-invalid-anchor",
        "palette-duplicate-anchor",
        "palette-value-range-narrow",
      ]),
    );
  });

  it("detects backwards required puzzles without guaranteed clue delivery", () => {
    const source = showcaseAdventureDesigns[0]!;
    const puzzle = source.puzzles[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      clues: source.clues.map((clue) => ({ ...clue, guaranteed: false })),
      puzzles: [
        {
          ...puzzle,
          problemIntroducedBeforeSolution: false,
          storyPayoff: "Thin.",
          rationale: "Thin.",
        },
      ],
    });

    const report = evaluateAdventureAuthenticity(broken);
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "puzzle-backwards-construction",
        "puzzle-required-clue-not-guaranteed",
        "puzzle-dramatic-purpose-thin",
      ]),
    );
  });

  it("creates one native-resolution production brief per location", () => {
    const document = showcaseAdventureDesigns[0]!;
    const briefs = createAdventureSceneProductionBriefs(document);

    expect(briefs).toHaveLength(document.map.locations.length);
    expect(briefs[0]).toMatchObject({
      locationId: document.map.locations[0]!.id,
      nativeSize: document.creativeDirection.nativeSize,
      paletteBudget: document.creativeDirection.palette.maxColours,
      productionMode: document.creativeDirection.productionMode,
      compositionMode: document.creativeDirection.compositionMode,
    });
    expect(briefs.every((brief) => brief.focalHierarchy.length >= 5)).toBe(true);
    expect(briefs.every((brief) => brief.layerPlan.length >= 5)).toBe(true);
    expect(briefs.every((brief) => brief.reviewQuestions.length >= 5)).toBe(true);
  });
});
