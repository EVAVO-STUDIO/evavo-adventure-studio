import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { compileProject, type ProjectCompilationError } from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.audio-compile",
  title: "Audio Compile",
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
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    { id: "asset.music", path: "audio/music.ogg", kind: "audio" },
    { id: "asset.rain", path: "audio/rain.ogg", kind: "audio" },
  ],
  inventoryItems: [],
});

const compiledAudioAsset = (
  assetId: string,
  sourcePath: string,
  runtimePath: string,
  durationMilliseconds: number,
) => ({
  assetId,
  kind: "audio" as const,
  sourceFiles: [{ path: sourcePath, sha256: hash, byteLength: 10 }],
  outputFiles: [
    {
      role: "primary",
      runtimePath,
      mediaType: "audio/ogg",
      sha256: hash,
      byteLength: 8,
    },
  ],
  metadata: {
    kind: "audio" as const,
    durationMilliseconds,
    channels: 2,
    sampleRate: 44_100,
  },
});

const assets = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [
        { path: "art/office.png", sha256: hash, byteLength: 1 },
      ],
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
        colourCount: 128,
      },
    },
    compiledAudioAsset(
      "asset.music",
      "audio/music.ogg",
      "assets/audio/music.ogg",
      12_000,
    ),
    compiledAudioAsset(
      "asset.rain",
      "audio/rain.ogg",
      "assets/audio/rain.ogg",
      20_000,
    ),
  ],
});

const bus = (id: string, volume: number, maxVoices: number) => ({
  id,
  volume,
  muted: false,
  maxVoices,
  stealPolicy: "lowest-priority" as const,
});

const audio = audioMixManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  logicalTicksPerSecond: 60,
  buses: [
    bus("speech", 1, 4),
    bus("master", 1, 128),
    bus("interface", 0.8, 8),
    bus("music", 0.8, 4),
    bus("effects", 0.9, 32),
    bus("ambience", 0.7, 16),
  ],
  ducking: [
    {
      id: "audio-ducking-rule.speech-over-music",
      sourceBus: "speech",
      targetBus: "music",
      targetVolume: 0.45,
      attackTicks: 6,
      releaseTicks: 18,
    },
  ],
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
      priority: 1,
      interruptGroup: null,
    },
    {
      id: "audio-cue.music",
      name: "Music",
      assetId: "asset.music",
      bus: "music",
      volume: 0.8,
      startOffsetMilliseconds: 0,
      fadeInTicks: 24,
      fadeOutTicks: 24,
      loop: {
        startMilliseconds: 1000,
        endMilliseconds: 11_000,
        crossfadeMilliseconds: 200,
      },
      polyphony: "restart",
      maxInstances: 1,
      priority: 2,
      interruptGroup: "music",
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
        {
          id: "audio-scene-layer.office.music",
          cueId: "audio-cue.music",
          role: "music",
          startDelayTicks: 0,
          fadeInTicks: 24,
          fadeOutTicks: 24,
          restartPolicy: "continue",
        },
      ],
    },
  ],
  speechBindings: [],
});

describe("audio mix compilation", () => {
  it("embeds a canonically ordered audio mix", () => {
    const compiled = compileProject(
      project,
      assets,
      undefined,
      undefined,
      audio,
    );

    expect(compiled.bundle.audioMix?.buses.map((entry) => entry.id)).toEqual([
      "ambience",
      "effects",
      "interface",
      "master",
      "music",
      "speech",
    ]);
    expect(compiled.bundle.audioMix?.cues.map((cue) => cue.id)).toEqual([
      "audio-cue.music",
      "audio-cue.rain",
    ]);
    expect(
      compiled.bundle.audioMix?.soundscapes[0]?.layers.map(
        (layer) => layer.id,
      ),
    ).toEqual([
      "audio-scene-layer.office.music",
      "audio-scene-layer.office.rain",
    ]);
    expect(compiled.canonicalJson).toContain("audio-cue.music");
  });

  it("is stable when authoring collections are reordered", () => {
    const reordered = audioMixManifestSchema.parse({
      ...audio,
      buses: [...audio.buses].reverse(),
      cues: [...audio.cues].reverse(),
      soundscapes: audio.soundscapes.map((soundscape) => ({
        ...soundscape,
        layers: [...soundscape.layers].reverse(),
      })),
    });
    const first = compileProject(
      project,
      assets,
      undefined,
      undefined,
      audio,
    );
    const second = compileProject(
      project,
      assets,
      undefined,
      undefined,
      reordered,
    );

    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("omits the optional audio mix when none is supplied", () => {
    expect(compileProject(project, assets).bundle.audioMix).toBeUndefined();
  });

  it("blocks compiled loop ranges beyond the encoded duration", () => {
    const broken = audioMixManifestSchema.parse({
      ...audio,
      cues: audio.cues.map((cue) =>
        cue.id === "audio-cue.music"
          ? {
              ...cue,
              loop: {
                startMilliseconds: 1000,
                endMilliseconds: 13_000,
                crossfadeMilliseconds: 100,
              },
            }
          : cue,
      ),
    });

    expect(() =>
      compileProject(project, assets, undefined, undefined, broken),
    ).toThrowError(
      expect.objectContaining<Partial<ProjectCompilationError>>({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "compiled-audio-loop-out-of-range",
          }),
        ]),
      }),
    );
  });
});
