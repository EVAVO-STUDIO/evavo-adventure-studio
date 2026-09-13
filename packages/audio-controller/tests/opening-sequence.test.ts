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
  projectId: "project.opening-audio",
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
      id: "audio-cue.opening",
      name: "Opening sting",
      assetId: "asset.opening-music",
      bus: "music",
      volume: 1,
      startOffsetMilliseconds: 0,
      fadeInTicks: 0,
      fadeOutTicks: 6,
      loop: null,
      polyphony: "restart",
      maxInstances: 1,
      priority: 10,
      interruptGroup: null,
    },
  ],
  soundscapes: [],
  speechBindings: [],
});

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.opening-audio",
  title: "Opening Audio",
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
      assetId: "asset.opening-music",
      kind: "audio",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/opening.ogg",
          mediaType: "audio/ogg",
          sha256: hash,
          byteLength: 100,
        },
      ],
      metadata: {
        kind: "audio",
        durationMilliseconds: 2_000,
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
        safeAfterTick: 0,
        completionActions: [
          {
            kind: "set-flag",
            flag: "opening.complete",
            value: true,
          },
        ],
      },
      tracks: [
        {
          id: "sequence-track.opening.audio",
          kind: "audio",
          cues: [
            {
              kind: "sound",
              atTick: 0,
              assetId: "asset.opening-music",
              bus: "music",
              volume: 1,
              loop: false,
            },
          ],
        },
      ],
      cueCount: 1,
    },
  ],
  audioMix,
});

describe("audio-aware opening sequence control", () => {
  it("starts tick-zero audio and skips through canonical completion actions", () => {
    const controller = createAudioPackagedRuntimeController(bundle);
    controller.drainAudioCommands();

    const events = controller.startNarrativeSequence("sequence.opening");
    expect(events.map((event) => event.kind)).toContain("sequence-started");
    expect(controller.activeBlockingSequenceId()).toBe("sequence.opening");
    expect(controller.drainAudioCommands()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "play",
          voice: expect.objectContaining({ cueId: "audio-cue.opening" }),
        }),
      ]),
    );

    expect(controller.skipNarrativeSequence("sequence.opening")).toEqual({
      kind: "skipped",
    });
    expect(controller.activeBlockingSequenceId()).toBeNull();
    expect(controller.worldState().story.flags["opening.complete"]).toBe(true);
  });

  it("rejects attempts to skip a sequence that this controller did not start", () => {
    const controller = createAudioPackagedRuntimeController(bundle);
    expect(controller.skipNarrativeSequence("sequence.opening")).toEqual({
      kind: "rejected",
      reason: "sequence-not-controller-started",
    });
  });
});
