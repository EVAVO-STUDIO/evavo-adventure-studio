import { describe, expect, it } from "vitest";
import {
  type AdventureProductionShowcase,
  adventureProductionShowcaseByProfileId,
  adventureProductionShowcases,
  validateAdventureProductionShowcase,
} from "../src/production-showcases.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("adventure production showcases", () => {
  it("ships one valid original multi-plate showcase for every production profile", () => {
    expect(adventureProductionShowcases.map((showcase) => showcase.profileId)).toEqual([
      "storybook-icon-vga",
      "comic-scifi-icon-vga",
      "gothic-investigation-vga",
      "verb-panel-cartoon-vga",
      "pulp-archaeology-vga",
      "cinematic-pulp-vga",
      "neo-noir-lowres",
    ]);
    expect(
      adventureProductionShowcases.flatMap((showcase) => validateAdventureProductionShowcase(showcase)),
    ).toEqual([]);

    for (const showcase of adventureProductionShowcases) {
      expect(showcase.plates.map((plate) => plate.kind)).toEqual(["title", "gameplay", "dialogue", "system"]);
      expect(showcase.plates.every((plate) => plate.visualProofs.length >= 3)).toBe(true);
      expect(showcase.puzzleBeats.length).toBeGreaterThan(0);
      expect(showcase.originalAssetsOnly).toBe(true);
    }
  });

  it("keeps runtime showcase data free of commercial titles and publisher names", () => {
    const serialized = JSON.stringify(adventureProductionShowcases).toLocaleLowerCase("en-US");
    for (const term of [
      "king's quest",
      "space quest",
      "quest for glory",
      "gabriel knight",
      "gemini rue",
      "monkey island",
      "fate of atlantis",
      "rise of the dragon",
      "heart of china",
      "sierra",
      "lucasarts",
      "dynamix",
    ]) {
      expect(serialized).not.toContain(term);
    }
  });

  it("resolves showcases deterministically by profile identity", () => {
    for (const showcase of adventureProductionShowcases) {
      expect(adventureProductionShowcaseByProfileId(showcase.profileId, adventureProductionShowcases)).toBe(
        showcase,
      );
    }
  });

  it("rejects missing plates, invalid geometry, unsupported puzzles and weak originality", () => {
    const malformed = clone(adventureProductionShowcases[0]!) as AdventureProductionShowcase;
    const input = malformed as unknown as {
      plates: Array<{
        kind: string;
        focalPoint: { x: number; y: number };
        actors: Array<{ role: string; height: number }>;
        props: Array<{
          position: { x: number; y: number };
          size: { width: number; height: number };
        }>;
        visualProofs: string[];
      }>;
      puzzleBeats: Array<{
        grammar: string;
        setupPlateId: string;
      }>;
      originalAssetsOnly: boolean;
      originalityStatement: string;
    };

    input.plates = input.plates.filter((plate) => plate.kind !== "system");
    const gameplay = input.plates.find((plate) => plate.kind === "gameplay");
    if (!gameplay) throw new Error("Expected gameplay fixture.");
    gameplay.focalPoint.x = 999;
    gameplay.actors = gameplay.actors.filter((actor) => actor.role !== "player");
    gameplay.props[0]!.position.x = 315;
    gameplay.props[0]!.size.width = 40;
    gameplay.visualProofs = [];
    input.puzzleBeats[0]!.grammar = "relationship-branch";
    input.puzzleBeats[0]!.setupPlateId = "plate.missing";
    input.originalAssetsOnly = false;
    input.originalityStatement = "Too short.";

    const codes = validateAdventureProductionShowcase(malformed).map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-plate-kind",
        "invalid-focal-point",
        "missing-player-actor",
        "invalid-prop-geometry",
        "insufficient-visual-proof",
        "unsupported-puzzle-grammar",
        "unknown-puzzle-plate",
        "missing-originality-boundary",
      ]),
    );
  });
});
