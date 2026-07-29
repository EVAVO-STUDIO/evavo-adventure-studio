import { describe, expect, it } from "vitest";
import {
  parseRuntimeBundle,
  RuntimeBundleValidationError,
  runtimeBundleSchema,
} from "../src/index.js";

const hash = "0".repeat(64);

const createBundle = () => ({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.runtime-fixture",
  title: "Runtime Fixture",
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
  assetManifestFingerprint: hash,
  assetCompilerVersion: "0.1.0-test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 10,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: false,
        colourCount: 64,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective.atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 20,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective-000.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 30,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 128, height: 128 }],
        frames: [
          {
            frameId: "frame.detective.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 2, y: 2, width: 20, height: 40 },
            originalSize: { width: 24, height: 44 },
            trimOffset: { x: 2, y: 4 },
            padding: 2,
          },
        ],
      },
    },
  ],
  inventoryItems: [],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.detective.idle",
          assetId: "asset.detective",
          sourceRect: { x: 2, y: 2, width: 20, height: 40 },
          sourceSize: { width: 24, height: 44 },
          trimOffset: { x: 2, y: 4 },
          pivot: { x: 12, y: 44 },
          footPoint: { x: 12, y: 44 },
          durationTicks: 8,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle",
          state: "idle",
          facing: "south",
          frameIds: ["frame.detective.idle"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
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
          position: { x: 16, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [
    {
      id: "dialogue.detective",
      name: "Detective",
      startNodeId: "node.start",
      nodes: [
        {
          id: "node.start",
          enterActions: [],
          lines: [],
          choices: [],
          exitActions: [],
        },
      ],
      nodeIndex: { "node.start": 0 },
    },
  ],
  sequences: [
    {
      id: "sequence.intro",
      name: "Intro",
      mode: "cutscene",
      durationTicks: 10,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: {
        allowed: true,
        safeAfterTick: 0,
        completionActions: [],
      },
      tracks: [
        {
          id: "track.story",
          kind: "story",
          cues: [
            {
              kind: "story-action",
              atTick: 0,
              action: { kind: "set-flag", flag: "introSeen", value: true },
            },
          ],
        },
      ],
      cueCount: 1,
    },
  ],
});

describe("runtime bundle contract", () => {
  it("accepts a complete source-free bundle", () => {
    const parsed = parseRuntimeBundle(createBundle());

    expect(parsed.projectId).toBe("project.runtime-fixture");
    expect(parsed.assets[1]).toMatchObject({
      assetId: "asset.detective",
      kind: "spritesheet",
    });
  });

  it("structurally rejects source-file evidence in runtime assets", () => {
    const bundle = createBundle();
    const contaminated = {
      ...bundle,
      assets: bundle.assets.map((asset, index) =>
        index === 0
          ? {
              ...asset,
              sourceFiles: [
                {
                  path: "art/office-master.png",
                  sha256: hash,
                  byteLength: 12,
                },
              ],
            }
          : asset,
      ),
    };

    expect(() => runtimeBundleSchema.parse(contaminated)).toThrow();
  });

  it("rejects missing runtime start state", () => {
    const bundle = { ...createBundle(), startSceneId: "scene.missing" };

    expect(() => parseRuntimeBundle(bundle)).toThrow(
      RuntimeBundleValidationError,
    );
    try {
      parseRuntimeBundle(bundle);
    } catch (error) {
      if (!(error instanceof RuntimeBundleValidationError)) {
        throw error;
      }
      expect(error.issues.map((issue) => issue.code)).toContain(
        "missing-start-scene",
      );
    }
  });

  it("rejects stale dialogue indices and sequence cue counts", () => {
    const bundle = createBundle();
    const broken = {
      ...bundle,
      dialogues: bundle.dialogues.map((dialogue) => ({
        ...dialogue,
        nodeIndex: { "node.start": 4 },
      })),
      sequences: bundle.sequences.map((sequence) => ({
        ...sequence,
        cueCount: 7,
      })),
    };

    try {
      parseRuntimeBundle(broken);
      throw new Error("Expected runtime bundle validation to fail.");
    } catch (error) {
      if (!(error instanceof RuntimeBundleValidationError)) {
        throw error;
      }
      expect(error.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          "invalid-dialogue-node-index",
          "invalid-sequence-cue-count",
        ]),
      );
    }
  });

  it("rejects authored sprite geometry that differs from runtime atlas data", () => {
    const bundle = createBundle();
    const broken = {
      ...bundle,
      actors: bundle.actors.map((actor) => ({
        ...actor,
        frames: actor.frames.map((frame) => ({
          ...frame,
          trimOffset: { x: frame.trimOffset.x + 1, y: frame.trimOffset.y },
        })),
      })),
    };

    try {
      parseRuntimeBundle(broken);
      throw new Error("Expected runtime frame validation to fail.");
    } catch (error) {
      if (!(error instanceof RuntimeBundleValidationError)) {
        throw error;
      }
      expect(error.issues.map((issue) => issue.code)).toContain(
        "runtime-frame-geometry-mismatch",
      );
    }
  });
});
