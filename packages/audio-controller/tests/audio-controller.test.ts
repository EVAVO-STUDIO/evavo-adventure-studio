import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createAudioPackagedRuntimeController } from "../src/index.js";

const hash = "0".repeat(64);

const bus = (id: string, volume: number, maxVoices: number) => ({
  id,
  volume,
  muted: false,
  maxVoices,
  stealPolicy: "lowest-priority" as const,
});

const audioMix = audioMixManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.audio-controller",
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
      bus: "ambience",
      volume: 0.7,
      startOffsetMilliseconds: 0,
      fadeInTicks: 12,
      fadeOutTicks: 12,
      loop: {
        startMilliseconds: 0,
        endMilliseconds: 19_000,
        crossfadeMilliseconds: 100,
      },
      polyphony: "restart",
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
          role: "ambience",
          startDelayTicks: 0,
          fadeInTicks: 12,
          fadeOutTicks: 12,
          restartPolicy: "resume",
        },
      ],
    },
  ],
  speechBindings: [],
});

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.audio-controller",
  title: "Audio Controller",
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
  assetCompilerVersion: "test",
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
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 16,
      },
    },
    {
      assetId: "asset.rain",
      kind: "audio",
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
        kind: "audio",
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
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
  audioMix,
});

describe("audio-aware packaged runtime controller", () => {
  it("starts the initial scene soundscape and advances audio with world time", () => {
    const controller = createAudioPackagedRuntimeController(bundle);
    expect(controller.drainAudioCommands()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "play",
          voice: expect.objectContaining({ cueId: "audio-cue.rain" }),
        }),
      ]),
    );

    controller.createFrame(60);
    expect(controller.audioState()).toMatchObject({
      tick: 60,
      sceneId: "scene.office",
      voices: [expect.objectContaining({ cueId: "audio-cue.rain" })],
    });
  });

  it("embeds and restores audio through ordinary controller saves", () => {
    const controller = createAudioPackagedRuntimeController(bundle);
    controller.drainAudioCommands();
    controller.createFrame(45);
    const save = controller.createSaveGame();
    expect(save.audio).toMatchObject({ tick: 45, sceneId: "scene.office" });

    controller.createFrame(90);
    const restoredTick = controller.restoreSaveGame(save);
    expect(restoredTick).toBe(45);
    expect(controller.audioState()).toEqual(save.audio);
    expect(controller.drainAudioCommands()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "stop" }),
        expect.objectContaining({ kind: "play", atTick: 45 }),
      ]),
    );
  });

  it("preserves fontless and audioless bundle compatibility", () => {
    const { audioMix: _audioMix, ...withoutAudio } = bundle;
    const controller = createAudioPackagedRuntimeController(
      parseRuntimeBundle(withoutAudio),
    );

    expect(controller.audioState()).toBeNull();
    expect(controller.drainAudioCommands()).toEqual([]);
    expect(controller.createSaveGame().audio).toBeUndefined();
  });
});
