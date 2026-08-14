import { parseAdventureProject } from "../src/index.js";
import {
  parseGameOpeningManifest,
  validateGameOpeningManifest,
} from "../src/opening.js";
import { describe, expect, it } from "vitest";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.opening",
  title: "Opening",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [
    {
      id: "sequence.opening",
      name: "Opening",
      mode: "cutscene",
      durationTicks: 60,
      loop: false,
      blocking: true,
      savePolicy: "disabled",
      skip: {
        allowed: true,
        safeAfterTick: 12,
        completionActions: [],
      },
      tracks: [],
    },
    {
      id: "sequence.ambient",
      name: "Ambient",
      mode: "ambient",
      durationTicks: 60,
      loop: true,
      blocking: false,
      savePolicy: "allowed",
      skip: {
        allowed: false,
        safeAfterTick: 0,
        completionActions: [],
      },
      tracks: [],
    },
  ],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
});

describe("game opening manifest", () => {
  it("accepts a non-looping blocking cutscene owned by the project", () => {
    const manifest = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: project.id,
      newGameSequenceId: "sequence.opening",
    });

    expect(validateGameOpeningManifest(project, manifest)).toEqual([]);
  });

  it("rejects missing, ambient, looped and non-blocking opening sequences", () => {
    const missing = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: project.id,
      newGameSequenceId: "sequence.missing",
    });
    expect(validateGameOpeningManifest(project, missing).map((issue) => issue.code)).toEqual([
      "missing-opening-sequence",
    ]);

    const invalidProject = {
      ...project,
      sequences: [
        {
          ...project.sequences[1],
          loop: true,
          blocking: false,
          tracks: [
            {
              id: "sequence-track.ambient.audio",
              kind: "audio",
              cues: [
                {
                  kind: "sound",
                  atTick: 0,
                  assetId: "asset.opening-music",
                  bus: "music",
                  volume: 1,
                  loop: true,
                },
              ],
            },
          ],
        },
      ],
    };
    const ambient = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: project.id,
      newGameSequenceId: "sequence.ambient",
    });
    expect(validateGameOpeningManifest(invalidProject, ambient).map((issue) => issue.code)).toEqual([
      "opening-sequence-not-cutscene",
      "opening-sequence-looped",
      "opening-sequence-not-blocking",
      "opening-sequence-looping-audio",
    ]);
  });

  it("rejects a manifest owned by another project", () => {
    const manifest = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: "project.other",
      newGameSequenceId: "sequence.opening",
    });

    expect(validateGameOpeningManifest(project, manifest).map((issue) => issue.code)).toContain(
      "opening-project-mismatch",
    );
  });
});
