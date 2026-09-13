import { describe, expect, it } from "vitest";
import { validateNightShiftArtMaster } from "../src/night-shift-art-master-intake.js";
import {
  nightShiftGeneratedVisualMasterAssetIds,
  nightShiftGeneratedVisualMasterObservations,
} from "../src/night-shift-generated-art-intake.js";

describe("Night Shift generated visual master intake", () => {
  it("derives structural intake observations for the font and four verb icons", () => {
    const observations = nightShiftGeneratedVisualMasterObservations();
    expect(observations).toHaveLength(5);
    expect(nightShiftGeneratedVisualMasterAssetIds).toEqual([
      "asset.night-shift.font.system",
      "asset.night-shift.ui.walk",
      "asset.night-shift.ui.look",
      "asset.night-shift.ui.use",
      "asset.night-shift.ui.talk",
    ]);
  });

  it("passes every generated visual through structural native-size/palette/alpha intake", () => {
    for (const observation of nightShiftGeneratedVisualMasterObservations()) {
      expect(validateNightShiftArtMaster(observation)).toEqual([]);
    }
  });
});
