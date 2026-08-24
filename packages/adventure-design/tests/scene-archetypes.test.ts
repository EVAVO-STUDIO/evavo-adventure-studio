import { describe, expect, it } from "vitest";
import { adventureSceneArchetypes, validateAdventureSceneArchetypes } from "../src/scene-archetypes.js";

describe("classic adventure scene archetypes", () => {
  it("defines a broad scene grammar rather than only fixed rooms", () => {
    expect(validateAdventureSceneArchetypes()).toEqual([]);
    expect(adventureSceneArchetypes.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "classic-room",
        "scrolling-exterior",
        "hub-location",
        "multi-level-interior",
        "state-variant-room",
        "dialogue-closeup",
        "investigation-research",
        "puzzle-closeup",
        "travel-map",
        "vehicle-interior",
        "vehicle-exterior",
        "combat-arena",
        "action-insert",
        "timed-danger",
        "cinematic-inset",
        "cutaway-montage",
        "multi-protagonist-cross-state",
        "day-night-location",
        "shop-economy",
        "training-practice",
        "chapter-transition",
        "failure-outcome",
      ]),
    );
  });

  it("makes specialized authoring requirements explicit", () => {
    const research = adventureSceneArchetypes.find((entry) => entry.id === "investigation-research")!;
    expect(research.requiredCapabilities).toEqual(
      expect.arrayContaining([
        "research-investigation-loop",
        "topic-dialogue",
        "dialogue-fact-unlocks",
        "chapter-day-progression",
      ]),
    );

    const combat = adventureSceneArchetypes.find((entry) => entry.id === "combat-arena")!;
    expect(combat.requiredCapabilities).toEqual(
      expect.arrayContaining(["real-time-combat", "health-stamina-mana", "equipment-money"]),
    );

    const multiCharacter = adventureSceneArchetypes.find(
      (entry) => entry.id === "multi-protagonist-cross-state",
    )!;
    expect(multiCharacter.requiredCapabilities).toContain("multi-protagonist-switching");
  });

  it("keeps DGDS cinematic/action scenes distinct from normal room staging", () => {
    const inset = adventureSceneArchetypes.find((entry) => entry.id === "cinematic-inset")!;
    const action = adventureSceneArchetypes.find((entry) => entry.id === "action-insert")!;
    expect(inset.referenceGames).toEqual(expect.arrayContaining(["heart-of-china", "rise-of-the-dragon"]));
    expect(action.requiredCapabilities).toEqual(
      expect.arrayContaining(["action-minigame", "quick-response-sequence", "failure-retry"]),
    );
  });

  it("models Quest for Glory scenes beyond normal point-and-click rooms", () => {
    const qfgArchetypes = adventureSceneArchetypes.filter((entry) =>
      entry.referenceGames.includes("quest-for-glory-vga"),
    );
    expect(qfgArchetypes.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "classic-room",
        "hub-location",
        "combat-arena",
        "day-night-location",
        "shop-economy",
        "training-practice",
      ]),
    );
  });
});
