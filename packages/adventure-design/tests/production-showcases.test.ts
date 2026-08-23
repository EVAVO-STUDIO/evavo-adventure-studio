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
      "gothic-rpg-vga",
      "early-procedural-icon-vga",
      "procedural-investigation-vga",
      "verb-panel-cartoon-vga",
      "pulp-archaeology-vga",
      "cinematic-pulp-vga",
      "neo-noir-lowres",
    ]);
    expect(
      adventureProductionShowcases.flatMap((showcase) =>
        validateAdventureProductionShowcase(showcase),
      ),
    ).toEqual([]);

    for (const showcase of adventureProductionShowcases) {
      expect(showcase.plates.map((plate) => plate.kind)).toEqual([
        "title",
        "gameplay",
        "dialogue",
        "system",
      ]);
      expect(showcase.plates.every((plate) => plate.visualProofs.length >= 3)).toBe(true);
      expect(showcase.puzzleBeats.length).toBeGreaterThan(0);
      expect(showcase.originalAssetsOnly).toBe(true);
    }
  });

  it("keeps early and later procedural proofs visibly and mechanically separate", () => {
    const nightShift = adventureProductionShowcases.find(
      (showcase) => showcase.id === "night-shift",
    );
    const openCase = adventureProductionShowcases.find(
      (showcase) => showcase.id === "open-case",
    );
    if (!nightShift || !openCase) throw new Error("Procedural showcases are missing.");

    expect(nightShift).toMatchObject({
      profileId: "early-procedural-icon-vga",
      title: "Night Shift",
      originalAssetsOnly: true,
      motif: "municipal-night-shift",
    });
    expect(nightShift.puzzleBeats.map((beat) => beat.grammar)).toEqual([
      "environmental-state",
      "inventory-chain",
    ]);
    const earlyText = JSON.stringify(nightShift).toLowerCase();
    expect(earlyText).toContain("briefing");
    expect(earlyText).toContain("roadside");
    expect(earlyText).toContain("score");
    expect(earlyText).not.toContain("caseboard");
    expect(earlyText).not.toContain("custody");

    expect(openCase).toMatchObject({
      profileId: "procedural-investigation-vga",
      title: "Open Case",
      originalAssetsOnly: true,
    });
    expect(openCase.puzzleBeats.map((beat) => beat.grammar)).toEqual([
      "research-deduction",
      "topic-investigation",
    ]);
    const laterText = JSON.stringify(openCase).toLowerCase();
    expect(laterText).toContain("custody");
    expect(laterText).toContain("caseboard");
  });

  it("keeps the RPG proof materially separate from both procedural lanes", () => {
    const hollowVale = adventureProductionShowcases.find(
      (showcase) => showcase.id === "the-hollow-vale",
    );
    if (!hollowVale) throw new Error("RPG showcase is missing.");

    expect(hollowVale).toMatchObject({
      profileId: "gothic-rpg-vga",
      title: "The Hollow Vale",
      originalAssetsOnly: true,
    });
    expect(hollowVale.puzzleBeats.map((beat) => beat.grammar)).toEqual([
      "multi-route",
      "hybrid-action",
    ]);
    expect(JSON.stringify(hollowVale)).toContain("resource");
    expect(JSON.stringify(hollowVale)).toContain("class");
  });

  it("keeps runtime showcase data free of commercial titles and publisher names", () => {
    const serialized = JSON.stringify(adventureProductionShowcases).toLocaleLowerCase("en-US");
    for (const term of [
      "king's quest",
      "space quest",
      "quest for glory",
      "gabriel knight",
      "police quest",
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
      expect(
        adventureProductionShowcaseByProfileId(
          showcase.profileId,
          adventureProductionShowcases,
        ),
      ).toBe(showcase);
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
