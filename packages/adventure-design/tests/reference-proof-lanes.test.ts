import { describe, expect, it } from "vitest";
import { adventureProductionProfiles } from "../src/production-profile-presets.js";
import { adventureProductionShowcases } from "../src/production-showcase-presets.js";
import { adventureReferenceTitlePacks } from "../src/reference-fidelity-presets.js";
import {
  adventureReferenceProofLanes,
  referenceProofLaneForShowcase,
  validateAdventureReferenceProofLanes,
} from "../src/reference-proof-lanes.js";

const profile = (id: string) => adventureProductionProfiles.find((candidate) => candidate.id === id);
const showcase = (id: string) => adventureProductionShowcases.find((candidate) => candidate.id === id);
const fidelity = (id: string) => adventureReferenceTitlePacks.find((candidate) => candidate.id === id);

describe("reference proof lanes", () => {
  it("binds every lane to a real production profile and original showcase", () => {
    for (const lane of adventureReferenceProofLanes) {
      expect(profile(lane.profileId), lane.id).toBeDefined();
      expect(showcase(lane.showcaseId), lane.id).toBeDefined();
      expect(showcase(lane.showcaseId)?.profileId).toBe(lane.profileId);
    }
  });

  it("keeps historical PQ4 and LSL lanes bound to their exact fidelity packs", () => {
    for (const laneId of ["late-sierra-procedural", "sierra-social-comedy-vga"] as const) {
      const lane = adventureReferenceProofLanes.find((candidate) => candidate.id === laneId)!;
      const pack = fidelity(lane.fidelityPackId!);
      expect(lane.kind).toBe("historical-fidelity");
      expect(pack).toBeDefined();
      expect(pack?.profileId).toBe(lane.profileId);
      expect(pack?.originalProof.showcaseId).toBe(`showcase.${lane.showcaseId}`);
    }
  });

  it("keeps Cold Meridian a modern-retro benchmark rather than false historical fidelity", () => {
    const lane = referenceProofLaneForShowcase("cold-meridian");
    expect(lane).toMatchObject({
      id: "modern-retro-noir",
      kind: "modern-retro-benchmark",
      profileId: "neo-noir-lowres",
      fidelityPackId: null,
    });
    expect(lane?.authenticMustKeep.join(" ")).toMatch(/low-resolution pixel composition/iu);
    expect(lane?.qualityRepairs).toContain("pixel-hunting");
    expect(lane?.qualityRepairs).toContain("save-restriction");
  });

  it("keeps the three examples materially different instead of reskinning one grammar", () => {
    const open = referenceProofLaneForShowcase("open-case")!;
    const social = referenceProofLaneForShowcase("after-hours")!;
    const noir = referenceProofLaneForShowcase("cold-meridian")!;
    expect(new Set([open.profileId, social.profileId, noir.profileId]).size).toBe(3);
    expect(open.authenticMustKeep.join(" ")).toMatch(/evidence custody/iu);
    expect(social.authenticMustKeep.join(" ")).toMatch(/social puzzles/iu);
    expect(noir.authenticMustKeep.join(" ")).toMatch(/protagonist knowledge/iu);
  });

  it("keeps the proof-lane catalog internally valid", () => {
    expect(validateAdventureReferenceProofLanes()).toEqual([]);
  });
});
