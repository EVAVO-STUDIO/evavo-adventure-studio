import {
  audioMixManifestSchema,
  createDefaultAudioMixManifest,
} from "@evavo/adventure-audio";
import {
  advanceAudioRuntimeState,
  createInitialAudioRuntimeState,
  enterAudioScene,
} from "@evavo/adventure-audio/runtime";
import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createInitialInteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  createSaveGame,
  loadSaveGame,
  SaveGameCompatibilityError,
  serializeSaveGame,
} from "../src/index.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const audioMix = audioMixManifestSchema.parse({
  ...createDefaultAudioMixManifest({
    id: id<"project">("project.audio-save"),
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
  }),
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
});

const bundleInput = (includeAudio = true) => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.audio-save",
  title: "Audio Save",
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
        colourCount: 16,
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
  ...(includeAudio ? { audioMix } : {}),
});

const interfaceState = {
  controlledActorInstanceId: null,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "RAIN AGAINST THE GLASS",
  parser: { text: "", history: [] },
} as const;

describe("audio save state", () => {
  it("round-trips active loops and resume offsets deterministically", () => {
    const bundle = parseRuntimeBundle(bundleInput());
    const initialWorld = createInitialInteractiveRuntimeWorldState(bundle);
    const world = {
      ...initialWorld,
      story: { ...initialWorld.story, tick: 60 },
    };
    let audio = createInitialAudioRuntimeState(
      audioMix,
      id<"scene">("scene.office"),
    );
    audio = enterAudioScene(
      audioMix,
      audio,
      id<"scene">("scene.office"),
      0,
    ).state;
    audio = advanceAudioRuntimeState(audioMix, audio, 60).state;

    const save = createSaveGame(bundle, world, {
      ...interfaceState,
      audio,
    });
    const loaded = loadSaveGame(
      bundle,
      JSON.parse(serializeSaveGame(save)) as unknown,
    );

    expect(loaded.audio).toEqual(audio);
    expect(loaded.audio?.voices[0]).toMatchObject({
      cueId: "audio-cue.rain",
      sceneId: undefined,
      startedAtTick: 0,
    });
    expect(serializeSaveGame(loaded)).toBe(serializeSaveGame(save));
  });

  it("allows legacy saves that omit optional audio state", () => {
    const bundle = parseRuntimeBundle(bundleInput());
    const save = createSaveGame(
      bundle,
      createInitialInteractiveRuntimeWorldState(bundle),
      interfaceState,
    );

    expect(save.audio).toBeUndefined();
    expect(() => loadSaveGame(bundle, save)).not.toThrow();
  });

  it("rejects audio state without a runtime audio mix", () => {
    const bundle = parseRuntimeBundle(bundleInput(false));
    const audio = createInitialAudioRuntimeState(
      audioMix,
      id<"scene">("scene.office"),
    );

    expect(() =>
      createSaveGame(
        bundle,
        createInitialInteractiveRuntimeWorldState(bundle),
        { ...interfaceState, audio },
      ),
    ).toThrow(SaveGameCompatibilityError);
  });

  it("rejects mismatched audio ticks and runtime assets", () => {
    const bundle = parseRuntimeBundle(bundleInput());
    const initialWorld = createInitialInteractiveRuntimeWorldState(bundle);
    const incompatible = {
      ...createInitialAudioRuntimeState(
        audioMix,
        id<"scene">("scene.office"),
      ),
      tick: 4,
      voices: [
        {
          id: id<"audio-voice">("audio-voice.invalid"),
          cueId: id<"audio-cue">("audio-cue.rain"),
          assetId: id<"asset">("asset.missing"),
          bus: "ambience" as const,
          volume: 1,
          priority: 0,
          startedAtTick: 0,
          startOffsetMilliseconds: 0,
          loop: null,
          interruptGroup: null,
          owner: { kind: "cue" as const },
        },
      ],
    };

    expect(() =>
      createSaveGame(bundle, initialWorld, {
        ...interfaceState,
        audio: incompatible,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SaveGameCompatibilityError>>({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "audio-tick-mismatch" }),
          expect.objectContaining({ code: "audio-voice-asset-missing" }),
          expect.objectContaining({ code: "audio-voice-cue-mismatch" }),
        ]),
      }),
    );
  });
});
