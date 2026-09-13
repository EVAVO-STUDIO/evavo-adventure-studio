import { describe, expect, it } from "vitest";
import {
  parseRuntimeBundle,
  RuntimeAudioMixValidationError,
} from "../src/index.js";

const hash = "0".repeat(64);

const bus = (id: string, volume: number, maxVoices: number) => ({
  id,
  volume,
  muted: false,
  maxVoices,
  stealPolicy: "lowest-priority" as const,
});

const runtimeBundle = () => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.runtime-audio",
  title: "Runtime Audio",
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
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image" as const,
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
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
        colourCount: 128,
      },
    },
    {
      assetId: "asset.rain",
      kind: "audio" as const,
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/audio/rain.ogg",
          mediaType: "audio/ogg",
          sha256: hash,
          byteLength: 100,
        },
      ],
      metadata: {
        kind: "audio" as const,
        durationMilliseconds: 20_000,
        channels: 2,
        sampleRate: 44_100,
      },
    },
  ],
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
          facing: "east" as const,
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
  audioMix: {
    manifestVersion: 1 as const,
    projectId: "project.runtime-audio",
    logicalTicksPerSecond: 60,
    buses: [
      bus("master", 1, 128),
      bus("music", 0.8, 4),
      bus("speech", 1, 4),
      bus("ambience", 0.7, 16),
      bus("effects", 0.9, 32),
      bus("interface", 0.8, 8),
    ],
    ducking: [],
    cues: [
      {
        id: "audio-cue.rain",
        name: "Rain",
        assetId: "asset.rain",
        bus: "ambience" as const,
        volume: 0.75,
        startOffsetMilliseconds: 0,
        fadeInTicks: 12,
        fadeOutTicks: 12,
        loop: {
          startMilliseconds: 0,
          endMilliseconds: 19_000,
          crossfadeMilliseconds: 100,
        },
        polyphony: "restart" as const,
        maxInstances: 1,
        priority: 0,
        interruptGroup: null,
      },
    ],
    soundscapes: [
      {
        sceneId: "scene.office",
        layers: [
          {
            id: "audio-scene-layer.office.rain",
            cueId: "audio-cue.rain",
            role: "ambience" as const,
            startDelayTicks: 0,
            fadeInTicks: 12,
            fadeOutTicks: 12,
            restartPolicy: "resume" as const,
          },
        ],
      },
    ],
    speechBindings: [],
  },
});

describe("runtime audio mix", () => {
  it("accepts source-free audio assets and soundscapes", () => {
    const parsed = parseRuntimeBundle(runtimeBundle());
    expect(parsed.audioMix?.cues[0]?.id).toBe("audio-cue.rain");
    expect(parsed.audioMix?.soundscapes[0]?.sceneId).toBe("scene.office");
  });

  it("rejects audio primary outputs with non-audio media types", () => {
    const input = runtimeBundle();
    const rain = input.assets.find((asset) => asset.assetId === "asset.rain");
    if (!rain) throw new Error("Expected runtime rain asset.");
    rain.outputFiles[0]!.mediaType = "application/octet-stream";

    expect(() => parseRuntimeBundle(input)).toThrow(
      RuntimeAudioMixValidationError,
    );
  });

  it("rejects missing cue assets", () => {
    const input = runtimeBundle();
    input.audioMix.cues[0]!.assetId = "asset.missing";

    expect(() => parseRuntimeBundle(input)).toThrow(
      RuntimeAudioMixValidationError,
    );
  });

  it("preserves bundles that omit the optional audio mix", () => {
    const input = runtimeBundle();
    const { audioMix: _audioMix, ...withoutAudio } = input;
    expect(parseRuntimeBundle(withoutAudio).audioMix).toBeUndefined();
  });
});
