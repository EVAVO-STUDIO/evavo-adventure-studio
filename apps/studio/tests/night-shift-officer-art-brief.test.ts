import { describe, expect, it } from "vitest";
import { nightShiftOfficerMasterSlots } from "../src/night-shift-officer-master-contract.js";
import {
  nightShiftOfficerArtBrief,
  nightShiftOfficerArtBriefFileName,
  nightShiftOfficerArtBriefJson,
} from "../src/night-shift-officer-art-brief.js";

describe("Night Shift officer art brief", () => {
  it("covers every runtime slot and all four authored actor-lighting banks", () => {
    expect(nightShiftOfficerArtBrief.slots.map((slot) => slot.frameId)).toEqual(
      nightShiftOfficerMasterSlots.map((slot) => slot.frameId),
    );
    expect(nightShiftOfficerArtBrief.paletteBanks.map((bank) => bank.offset)).toEqual([0, 32, 64, 96]);
    expect(nightShiftOfficerArtBrief.master).toMatchObject({
      width: 264,
      height: 50,
      indexedColour: true,
      binaryAlpha: true,
      finalRuntimeScale: "native-1x-nearest",
    });
  });

  it("states the period-authentic rejection criteria explicitly", () => {
    expect(nightShiftOfficerArtBrief.rejectIf.join(" ")).toMatch(/universal outline/iu);
    expect(nightShiftOfficerArtBrief.rejectIf.join(" ")).toMatch(/AI-like pseudo-detail/iu);
    expect(nightShiftOfficerArtBrief.pixelRules.join(" ")).toMatch(/No antialiasing/iu);
    expect(nightShiftOfficerArtBrief.animationRules.join(" ")).toMatch(/Walk has eight authored phases/iu);
  });

  it("serialises deterministically with a stable handoff filename", () => {
    expect(nightShiftOfficerArtBriefJson()).toBe(nightShiftOfficerArtBriefJson());
    expect(nightShiftOfficerArtBriefFileName).toBe("night-shift.officer-art-brief.json");
  });
});
