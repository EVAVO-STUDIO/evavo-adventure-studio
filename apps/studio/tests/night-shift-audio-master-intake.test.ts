import { describe, expect, it } from "vitest";
import {
  evaluateNightShiftAudioMasterIntake,
  type NightShiftAudioMasterObservation,
  validateNightShiftAudioMaster,
} from "../src/night-shift-audio-master-intake.js";

const observation = (
  assetId: string,
  overrides: Partial<NightShiftAudioMasterObservation> = {},
): NightShiftAudioMasterObservation => ({
  assetId: assetId as never,
  sourceFormat: "wav",
  sampleRate: 44100,
  bitDepth: 24,
  channels: 1,
  durationMilliseconds: 600,
  peakDbfs: -3,
  ...overrides,
});

describe("Night Shift audio master intake", () => {
  it("accepts a compact mono interaction effect", () => {
    expect(
      validateNightShiftAudioMaster(
        observation("asset.audio.night-shift.keys-jingle", {
          durationMilliseconds: 480,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects compressed/wrong-format style input, stereo effects and overlong Foley", () => {
    const issues = validateNightShiftAudioMaster(
      observation("asset.audio.night-shift.radio-lift", {
        sourceFormat: "other",
        sampleRate: 96000,
        bitDepth: 32,
        channels: 2,
        durationMilliseconds: 5200,
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "source-format-mismatch",
        "unsupported-sample-rate",
        "unsupported-bit-depth",
        "effect-not-mono",
        "effect-too-long",
      ]),
    );
  });

  it("requires ambience masters to cover their authored loop window", () => {
    const issues = validateNightShiftAudioMaster(
      observation("asset.audio.night-shift.roadside-rain", {
        channels: 2,
        durationMilliseconds: 12000,
      }),
    );
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ambience-too-short" })]),
    );

    expect(
      validateNightShiftAudioMaster(
        observation("asset.audio.night-shift.roadside-rain", {
          channels: 2,
          durationMilliseconds: 17000,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects invalid source peak metadata", () => {
    expect(
      validateNightShiftAudioMaster(
        observation("asset.audio.night-shift.notebook", {
          peakDbfs: 0.5,
        }),
      ).map((issue) => issue.code),
    ).toContain("invalid-peak");
  });

  it("blocks the proof until every required audio master is observed", () => {
    const report = evaluateNightShiftAudioMasterIntake([
      observation("asset.audio.night-shift.keys-jingle"),
    ]);
    expect(report.status).toBe("blocked");
    expect(report.expectedMasters).toBeGreaterThan(1);
    expect(report.missingAssetIds).toContain("asset.audio.night-shift.roadside-rain");
  });
});
