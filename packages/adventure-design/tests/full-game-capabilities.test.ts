import { describe, expect, it } from "vitest";
import {
  adventureCapabilityCatalog,
  adventureReferenceGameCapabilities,
  currentAdventureCapabilityCoverage,
  evaluateAdventureReferenceGameReadiness,
  validateAdventureCapabilityMatrix,
} from "../src/full-game-capabilities.js";

describe("full-game adventure capability matrix", () => {
  it("defines one coverage record for every capability and all requested reference games", () => {
    expect(validateAdventureCapabilityMatrix()).toEqual([]);
    expect(new Set(adventureCapabilityCatalog.map((capability) => capability.id)).size).toBe(
      adventureCapabilityCatalog.length,
    );
    expect(currentAdventureCapabilityCoverage).toHaveLength(adventureCapabilityCatalog.length);
    expect(adventureReferenceGameCapabilities.map((profile) => profile.id)).toEqual([
      "kings-quest-v",
      "gabriel-knight-sins-of-the-fathers",
      "quest-for-glory-vga",
      "day-of-the-tentacle",
      "leisure-suit-larry-vga",
      "heart-of-china",
      "rise-of-the-dragon",
      "indiana-jones-fate-of-atlantis",
    ]);
  });

  it("does not confuse whole-game readiness with a convincing room proof", () => {
    for (const profile of adventureReferenceGameCapabilities) {
      const readiness = evaluateAdventureReferenceGameReadiness(profile.id);
      expect(readiness.requiredCount).toBeGreaterThan(10);
      expect(readiness.stressScenes.length).toBeGreaterThanOrEqual(3);
      expect(readiness.ready).toBe(false);
      expect(readiness.gaps.length).toBeGreaterThan(0);
    }
  });

  it("tracks scrolling as proofed and elevation as implemented pending a full stress room", () => {
    const coverage = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));
    expect(coverage.get("scrolling-room")?.status).toBe("proofed");
    expect(coverage.get("multi-elevation-room")?.status).toBe("implemented");
    expect(coverage.get("panoramic-exterior")?.status).toBe("partial");
  });

  it("promotes only governed SCUMM, investigation, route and multi-character proofs", () => {
    const coverage = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));
    for (const capabilityId of [
      "verb-sentence-grammar",
      "item-on-item",
      "room-cutaways",
      "multi-protagonist-switching",
      "branching-route-topology",
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "alternate-puzzle-solutions",
    ] as const) {
      expect(coverage.get(capabilityId)?.status, capabilityId).toBe("proofed");
    }
    expect(coverage.get("chapter-day-progression")?.status).toBe("implemented");
    expect(coverage.get("research-investigation-loop")?.status).toBe("implemented");
  });

  it("promotes only the Quest for Glory systems exercised by the whole-loop stress", () => {
    const coverage = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));
    for (const capabilityId of [
      "time-of-day-clock",
      "character-stats",
      "skills-and-practice",
      "character-classes",
      "skill-gated-solutions",
      "health-stamina-mana",
      "real-time-combat",
    ] as const) {
      expect(coverage.get(capabilityId)?.status, capabilityId).toBe("proofed");
    }
    expect(coverage.get("character-import-export")?.status).toBe("implemented");
    expect(coverage.get("npc-schedules")?.status).toBe("partial");
    expect(coverage.get("equipment-money")?.status).toBe("missing");
  });

  it("keeps visually/specially distinct unproved modes below proofed status", () => {
    const coverage = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));
    for (const capabilityId of [
      "travel-map",
      "vehicle-scene",
      "cinematic-insets",
      "action-minigame",
      "quick-response-sequence",
      "full-game-evidence",
    ] as const) {
      expect(coverage.get(capabilityId)?.status, capabilityId).not.toBe("proofed");
    }
  });

  it("keeps Sierra investigation requirements distinct from Sierra storybook requirements", () => {
    const kingsQuest = adventureReferenceGameCapabilities.find((profile) => profile.id === "kings-quest-v")!;
    const gabrielKnight = adventureReferenceGameCapabilities.find(
      (profile) => profile.id === "gabriel-knight-sins-of-the-fathers",
    )!;
    expect(kingsQuest.required).toContain("panoramic-exterior");
    expect(kingsQuest.required).not.toContain("topic-dialogue");
    expect(gabrielKnight.required).toEqual(
      expect.arrayContaining([
        "topic-dialogue",
        "dialogue-fact-unlocks",
        "chapter-day-progression",
        "research-investigation-loop",
      ]),
    );
  });

  it("requires the actual Quest for Glory RPG simulation layer on the VGA icon lane", () => {
    const qfg = adventureReferenceGameCapabilities.find((profile) => profile.id === "quest-for-glory-vga")!;
    expect(qfg.required).toContain("verb-icon-interface");
    expect(qfg.required).not.toContain("parser-intent");
    expect(qfg.required).toEqual(
      expect.arrayContaining([
        "character-stats",
        "skills-and-practice",
        "character-classes",
        "skill-gated-solutions",
        "health-stamina-mana",
        "equipment-money",
        "real-time-combat",
        "time-of-day-clock",
        "npc-schedules",
        "character-import-export",
      ]),
    );
  });

  it("requires SCUMM-style sentence and multi-character grammar for Day of the Tentacle", () => {
    const dott = adventureReferenceGameCapabilities.find((profile) => profile.id === "day-of-the-tentacle")!;
    expect(dott.required).toEqual(
      expect.arrayContaining([
        "verb-sentence-grammar",
        "item-on-item",
        "room-cutaways",
        "multi-protagonist-switching",
      ]),
    );
  });

  it("requires branching and cinematic/action grammar for the Dynamix references", () => {
    const heart = adventureReferenceGameCapabilities.find((profile) => profile.id === "heart-of-china")!;
    const rise = adventureReferenceGameCapabilities.find((profile) => profile.id === "rise-of-the-dragon")!;
    expect(heart.required).toEqual(
      expect.arrayContaining([
        "branching-route-topology",
        "multi-protagonist-switching",
        "cinematic-insets",
        "travel-map",
      ]),
    );
    expect(rise.required).toEqual(
      expect.arrayContaining([
        "branching-route-topology",
        "cinematic-insets",
        "timed-puzzle",
        "action-minigame",
      ]),
    );
  });

  it("requires route branching and alternate solutions for Fate of Atlantis", () => {
    const fate = adventureReferenceGameCapabilities.find(
      (profile) => profile.id === "indiana-jones-fate-of-atlantis",
    )!;
    expect(fate.required).toEqual(
      expect.arrayContaining([
        "verb-sentence-grammar",
        "branching-route-topology",
        "alternate-puzzle-solutions",
        "travel-map",
      ]),
    );
  });
});
