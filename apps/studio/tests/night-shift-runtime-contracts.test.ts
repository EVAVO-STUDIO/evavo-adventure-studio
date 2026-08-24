import { validateAudioMixManifest } from "@evavo/adventure-audio";
import { describe, expect, it } from "vitest";
import {
  nightShiftRuntimeContracts,
  nightShiftRuntimeProject,
} from "../src/night-shift-runtime-contracts.js";
import { nightShiftRuntimeStaging } from "../src/night-shift-runtime-staging.js";
import {
  sceneDirectorStagingAudioCueUsages,
  validateSceneDirectorStagingAudioCues,
} from "../src/scene-director-audio-readiness.js";

describe("Night Shift runtime contracts", () => {
  it("keeps front-end, lifecycle, audio and palette maps on one project identity", () => {
    const projectId = nightShiftRuntimeProject.id;
    expect(nightShiftRuntimeContracts.frontEnd.projectId).toBe(projectId);
    expect(nightShiftRuntimeContracts.lifecycle.projectId).toBe(projectId);
    expect(nightShiftRuntimeContracts.audioMix.projectId).toBe(projectId);
    expect(nightShiftRuntimeContracts.paletteMaps.projectId).toBe(projectId);
  });

  it("validates the authored audio mix against declared audio assets", () => {
    expect(
      validateAudioMixManifest(nightShiftRuntimeProject, nightShiftRuntimeContracts.audioMix),
    ).toEqual([]);
  });

  it("gives station, roadside and diner distinct persistent room ambience", () => {
    expect(nightShiftRuntimeContracts.audioMix.soundscapes).toEqual([
      expect.objectContaining({
        sceneId: "scene.night-shift.station",
        layers: [
          expect.objectContaining({
            cueId: "audio-cue.night-shift.station-room",
            role: "room-tone",
          }),
        ],
      }),
      expect.objectContaining({
        sceneId: "scene.night-shift.roadside",
        layers: [
          expect.objectContaining({
            cueId: "audio-cue.night-shift.roadside-rain",
            role: "ambience",
          }),
        ],
      }),
      expect.objectContaining({
        sceneId: "scene.night-shift.diner",
        layers: [
          expect.objectContaining({
            cueId: "audio-cue.night-shift.diner-room",
            role: "room-tone",
          }),
        ],
      }),
    ]);
    expect(nightShiftRuntimeContracts.audioMix.ducking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceBus: "speech",
          targetBus: "ambience",
          targetVolume: 0.58,
        }),
      ]),
    );
  });

  it("covers every production-staging footstep and choreography cue", () => {
    expect(
      validateSceneDirectorStagingAudioCues(
        nightShiftRuntimeStaging,
        nightShiftRuntimeContracts.audioMix,
      ),
    ).toEqual([]);
    expect(sceneDirectorStagingAudioCueUsages(nightShiftRuntimeStaging).map((usage) => usage.cueId)).toEqual(
      expect.arrayContaining([
        "audio-cue.night-shift.footstep.vinyl",
        "audio-cue.night-shift.footstep.wet-asphalt",
        "audio-cue.night-shift.footstep.diner-tile",
        "audio-cue.night-shift.radio-lift",
        "audio-cue.night-shift.keys-jingle",
        "audio-cue.night-shift.door-latch",
        "audio-cue.night-shift.notebook",
        "audio-cue.night-shift.paper-touch",
      ]),
    );
  });

  it("fails closed when a production-staging cue is missing from the mix", () => {
    const mix = {
      ...nightShiftRuntimeContracts.audioMix,
      cues: nightShiftRuntimeContracts.audioMix.cues.filter(
        (cue) => cue.id !== "audio-cue.night-shift.paper-touch",
      ),
    };
    expect(validateSceneDirectorStagingAudioCues(nightShiftRuntimeStaging, mix)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cueId: "audio-cue.night-shift.paper-touch",
          source: "choreography",
        }),
      ]),
    );
  });
});
