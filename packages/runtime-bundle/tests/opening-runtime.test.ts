import { parseGameOpeningManifest } from "@evavo/adventure-project-schema/opening";
import { describe, expect, it } from "vitest";
import { runtimeBundleSchema } from "../src/index.js";

const openingSequence = {
  id: "sequence.opening",
  name: "Opening",
  mode: "cutscene" as const,
  durationTicks: 60,
  loop: false,
  blocking: true,
  savePolicy: "disabled" as const,
  skip: {
    allowed: true,
    safeAfterTick: 12,
    completionActions: [],
  },
  tracks: [],
  cueCount: 0,
};

const bundleInput = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.opening-runtime",
  title: "Opening Runtime",
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
  assetManifestFingerprint: "0".repeat(64),
  assetCompilerVersion: "test",
  assets: [],
  inventoryItems: [],
  actors: [],
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
  dialogues: [],
  sequences: [openingSequence],
};

describe("runtime opening manifest", () => {
  it("accepts an opening sequence owned by the runtime bundle", () => {
    const opening = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: bundleInput.projectId,
      newGameSequenceId: openingSequence.id,
    });

    expect(runtimeBundleSchema.safeParse({ ...bundleInput, opening }).success).toBe(true);
  });

  it("rejects a missing or structurally unsuitable opening sequence", () => {
    const missing = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: bundleInput.projectId,
      newGameSequenceId: "sequence.missing",
    });
    expect(runtimeBundleSchema.safeParse({ ...bundleInput, opening: missing }).success).toBe(false);

    const ambient = {
      ...openingSequence,
      mode: "ambient" as const,
      loop: true,
      blocking: false,
      tracks: [
        {
          id: "sequence-track.opening.audio",
          kind: "audio" as const,
          cues: [
            {
              kind: "sound" as const,
              atTick: 0,
              assetId: "asset.opening",
              bus: "music" as const,
              volume: 1,
              loop: true,
            },
          ],
        },
      ],
      cueCount: 1,
    };
    const opening = parseGameOpeningManifest({
      manifestVersion: 1,
      projectId: bundleInput.projectId,
      newGameSequenceId: ambient.id,
    });
    const result = runtimeBundleSchema.safeParse({
      ...bundleInput,
      sequences: [ambient],
      opening,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.filter((issue) => issue.path[0] === "opening")).toHaveLength(4);
    }
  });
});
