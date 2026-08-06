import { describe, expect, it } from "vitest";
import {
  parseRuntimeBundle,
  runtimePlayFeelProfileIdSchema,
} from "../src/index.js";

const hash = "0".repeat(64);

const bundleInput = () => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.play-feel-runtime",
  title: "Play Feel Runtime",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context" as const,
    integerScale: true,
    textureSampling: "nearest" as const,
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict" as const,
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.room",
      kind: "image" as const,
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/room.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image" as const,
        width: 320,
        height: 200,
        palette: true,
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.room",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
});

describe("runtime play-feel profile contract", () => {
  it("keeps legacy runtime bundles byte-shape compatible when no profile is set", () => {
    const bundle = parseRuntimeBundle(bundleInput());

    expect(bundle.playFeelProfileId).toBeUndefined();
    expect(Object.hasOwn(bundle, "playFeelProfileId")).toBe(false);
  });

  it("accepts every governed play-feel profile identifier", () => {
    const profileIds = [
      "classic-balanced",
      "storybook-deliberate",
      "comic-snappy",
      "gothic-measured",
      "verb-panel-responsive",
      "pulp-grounded",
      "cinematic-directed",
      "noir-restrained",
    ] as const;

    for (const playFeelProfileId of profileIds) {
      const bundle = parseRuntimeBundle({
        ...bundleInput(),
        playFeelProfileId,
      });
      expect(bundle.playFeelProfileId).toBe(playFeelProfileId);
      expect(runtimePlayFeelProfileIdSchema.parse(playFeelProfileId)).toBe(
        playFeelProfileId,
      );
    }
  });

  it("rejects unknown runtime timing profiles before gameplay starts", () => {
    expect(() =>
      parseRuntimeBundle({
        ...bundleInput(),
        playFeelProfileId: "unbounded-modern-glide",
      }),
    ).toThrow();
  });
});
