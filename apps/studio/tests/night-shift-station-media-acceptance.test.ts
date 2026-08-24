import { describe, expect, it } from "vitest";
import { evaluateNightShiftFoundationAcceptance } from "../src/night-shift-foundation-acceptance.js";
import { nightShiftOfficerMasterSlots } from "../src/night-shift-officer-master-contract.js";
import { nightShiftProductionAssets } from "../src/night-shift-production-assets.js";
import { evaluateNightShiftStationMediaAcceptance } from "../src/night-shift-station-media-acceptance.js";
import { evaluateNightShiftStationMediaPreflight } from "../src/night-shift-station-media-preflight.js";

const foundation = () =>
  evaluateNightShiftFoundationAcceptance({
    officerArt: {
      assetId: "asset.night-shift.actor.officer" as never,
      width: 264,
      height: 50,
      paletteIndexed: true,
      colourCount: 48,
      alphaMode: "binary",
      sourceFormat: "aseprite",
    },
    officerReview: {
      fileName: "officer.aseprite",
      width: 264,
      height: 50,
      indexedColour: true,
      colourCount: 48,
      alphaMode: "binary",
      universalOutline: false,
      syntheticMicrotexture: false,
      frameReviews: nightShiftOfficerMasterSlots.map((slot) => ({
        frameId: slot.frameId,
        silhouetteReadsAtOneToOne: true,
        binaryAlpha: true,
        anchorsStable: true,
        paletteBanksReadable: true,
        ...(slot.footContact ? { footContactStable: true } : {}),
      })),
    },
  });

const visualMasters = () => {
  const preflight = evaluateNightShiftStationMediaPreflight();
  return preflight.visualMasterIds.map((assetId) => {
    const requirement = nightShiftProductionAssets.find((asset) => asset.assetId === assetId)!;
    const nativeSize = requirement.nativeSize ?? { width: 120, height: 80 };
    return {
      assetId: assetId as never,
      width: nativeSize.width,
      height: nativeSize.height,
      paletteIndexed: true,
      colourCount: 64,
      alphaMode: requirement.alpha === "opaque" ? ("opaque" as const) : ("binary" as const),
      sourceFormat: requirement.sourcePath.endsWith(".aseprite")
        ? ("aseprite" as const)
        : ("png" as const),
    };
  });
};

const audioMasters = () => {
  const preflight = evaluateNightShiftStationMediaPreflight();
  return preflight.audioMasterIds.map((assetId) => {
    const requirement = nightShiftProductionAssets.find((asset) => asset.assetId === assetId)!;
    const ambience = requirement.role === "audio-ambience";
    return {
      assetId: assetId as never,
      sourceFormat: "wav" as const,
      sampleRate: 44100,
      bitDepth: 24 as const,
      channels: ambience ? (2 as const) : (1 as const),
      durationMilliseconds: ambience ? 13000 : 850,
      peakDbfs: -6,
    };
  });
};

describe("Night Shift Station media acceptance", () => {
  it("accepts an approved Foundation plus the complete valid Station visual/audio set", () => {
    const report = evaluateNightShiftStationMediaAcceptance({
      foundation: foundation(),
      visualMasters: visualMasters(),
      audioMasters: audioMasters(),
    });
    expect(report).toMatchObject({
      status: "ready",
      foundationReady: true,
      visualMastersReady: true,
      audioMastersReady: true,
    });
    expect(report.missingVisualAssetIds).toEqual([]);
    expect(report.missingAudioAssetIds).toEqual([]);
    expect(report.issues).toEqual([]);
  });

  it("blocks when a Station visual is missing or an effect violates the audio master policy", () => {
    const visuals = visualMasters().slice(1);
    const audio = audioMasters().map((entry, index) =>
      index === 0 ? { ...entry, channels: 2 as const } : entry,
    );
    const report = evaluateNightShiftStationMediaAcceptance({
      foundation: foundation(),
      visualMasters: visuals,
      audioMasters: audio,
    });
    expect(report.status).toBe("blocked");
    expect(report.missingVisualAssetIds).toHaveLength(1);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing visual master"),
        expect.stringContaining("effect-not-mono"),
      ]),
    );
  });
});
