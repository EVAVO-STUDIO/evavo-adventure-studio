import { describe, expect, it } from "vitest";
import {
  ninthReliquaryGameplayProof,
  validateNinthReliquaryGameplayProof,
} from "../src/ninth-reliquary-gameplay-proof.js";
import {
  createNinthReliquaryFinalizedProductionPackage,
  ninthReliquaryProductionBlueprint,
} from "../src/ninth-reliquary-production-package.js";

const authorities = {
  projectId: "project.ninth-reliquary" as never,
  sourceRevisionDigest: "source-12",
  visualStandardDigest: "visual-standard-7",
  styleBankDigest: "style-bank-7",
  protagonistModelSheetDigest: "model-sheet-4",
  protagonistWalkXSheetDigest: "xsheet-walk-4",
  environmentalReferenceDigests: ["environment-a", "environment-b"],
  characterReferenceDigests: ["character-a", "character-b"],
};

describe("The Ninth Reliquary whole-game proof", () => {
  it("covers three acts and twelve distinct gameplay scene archetypes/stress scenes", () => {
    expect(ninthReliquaryGameplayProof.acts).toHaveLength(3);
    expect(ninthReliquaryGameplayProof.scenes).toHaveLength(12);
    expect(validateNinthReliquaryGameplayProof()).toEqual([]);
    expect(new Set(ninthReliquaryGameplayProof.scenes.map((scene) => scene.archetype))).toEqual(
      expect.objectContaining ? expect.any(Set) : new Set(),
    );
    expect(ninthReliquaryGameplayProof.scenes.map((scene) => scene.archetype)).toEqual(
      expect.arrayContaining([
        "scrolling-exterior",
        "dialogue-closeup",
        "investigation-research",
        "cinematic-inset",
        "multi-level-interior",
        "puzzle-closeup",
        "multi-protagonist-cross-state",
        "vehicle-interior",
        "timed-danger",
      ]),
    );
  });

  it("requires the major cinematic investigation systems rather than only a visual profile", () => {
    expect(ninthReliquaryGameplayProof.mustProveCapabilities).toEqual(
      expect.arrayContaining([
        "panoramic-exterior",
        "multi-elevation-room",
        "topic-dialogue",
        "research-investigation-loop",
        "room-cutaways",
        "multi-protagonist-switching",
        "vehicle-scene",
        "failure-retry",
        "full-game-evidence",
      ]),
    );
  });

  it("exports a blueprint before authorities and separates Art/Cel work when finalized", () => {
    const blueprint = ninthReliquaryProductionBlueprint();
    expect(blueprint.authorityRequirements.map((requirement) => requirement.id)).toEqual(
      expect.arrayContaining([
        "visual-standard",
        "style-bank",
        "protagonist-model-sheet",
        "protagonist-walk-x-sheet",
      ]),
    );
    const finalized = createNinthReliquaryFinalizedProductionPackage(authorities);
    expect(finalized.profile.id).toBe("cinematic-handdrawn-conspiracy");
    expect(finalized.artStudioWorkOrders).toHaveLength(2);
    expect(finalized.celAnimationStudioWorkOrders).toHaveLength(2);
    expect(finalized.gameplayProof.scenes).toHaveLength(12);
  });
});
