import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import {
  parseAdventureProject,
  type Id,
} from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  audioMixManifestSchema,
  createDefaultAudioMixManifest,
  validateAudioMixManifest,
} from "../src/index.js";
import { validateCompiledAudioMappings } from "../src/compiled-mapping.js";
import {
  advanceAudioRuntimeState,
  completeAudioVoice,
  createInitialAudioRuntimeState,
  enterAudioScene,
  restoreAudioRuntimeCommands,
  setAudioBusRuntimeState,
  triggerAudioCue,
} from "../src/runtime.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.audio-fixture",
  title: "The Midnight Office",
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
      backgroundAssetId: "asset.background.office",
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
    {
      id: "scene.alley",
      name: "Alley",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.background.alley",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.alley",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [
    {
      id: "dialogue.caretaker",
      name: "Caretaker",
      startNodeId: "dialogue-node.caretaker.start",
      nodes: [
        {
          id: "dialogue-node.caretaker.start",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.caretaker.warning",
              text: "You should not be here after midnight.",
              durationTicks: 90,
              interruptible: true,
            },
          ],
          choices: [],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [
    {
      id: "sequence.office.blackout",
      name: "Office blackout",
      mode: "cutscene",
      durationTicks: 120,
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
          id: "sequence-track.office.audio",
          kind: "audio",
          cues: [
            {
              kind: "sound",
              atTick: 10,
              assetId: "asset.effect.thunder",
              bus: "effects",
              volume: 1,
              loop: false,
            },
            {
              kind: "stop-audio",
              atTick: 100,
              bus: "ambience",
              fadeTicks: 12,
            },
          ],
        },
      ],
    },
  ],
  assets: [
    {
      id: "asset.background.office",
      path: "art/office.png",
      kind: "image",
    },
    {
      id: "asset.background.alley",
      path: "art/alley.png",
      kind: "image",
    },
    {
      id: "asset.music.noir",
      path: "audio/noir.ogg",
      kind: "audio",
    },
    {
      id: "asset.ambience.rain",
      path: "audio/rain.ogg",
      kind: "audio",
    },
    {
      id: "asset.speech.warning",
      path: "audio/warning.ogg",
      kind: "audio",
    },
    {
      id: "asset.effect.thunder",
      path: "audio/thunder.ogg",
      kind: "audio",
    },
  ],
  inventoryItems: [],
});

const manifest = audioMixManifestSchema.parse({
  ...createDefaultAudioMixManifest(project),
  cues: [
    {
      id: "audio-cue.music.noir",
      name: "Noir underscore",
      assetId: "asset.music.noir",
      bus: "music",
      volume: 0.8,
      fadeInTicks: 30,
      fadeOutTicks: 30,
      loop: {
        startMilliseconds: 1000,
        endMilliseconds: 11_000,
        crossfadeMilliseconds: 250,
      },
      polyphony: "restart",
      maxInstances: 1,
      priority: 10,
    },
    {
      id: "audio-cue.ambience.rain",
      name: "Rain loop",
      assetId: "asset.ambience.rain",
      bus: "ambience",
      volume: 0.75,
      loop: {
        startMilliseconds: 0,
        endMilliseconds: 20_000,
        crossfadeMilliseconds: 200,
      },
      polyphony: "restart",
      maxInstances: 1,
    },
    {
      id: "audio-cue.speech.warning",
      name: "Caretaker warning",
      assetId: "asset.speech.warning",
      bus: "speech",
      volume: 1,
      polyphony: "restart",
      maxInstances: 1,
      interruptGroup: "dialogue",
    },
  ],
  soundscapes: [
    {
      sceneId: "scene.office",
      layers: [
        {
          id: "audio-scene-layer.office.music",
          cueId: "audio-cue.music.noir",
          role: "music",
          fadeInTicks: 30,
          fadeOutTicks: 24,
          restartPolicy: "continue",
        },
        {
          id: "audio-scene-layer.office.rain",
          cueId: "audio-cue.ambience.rain",
          role: "ambience",
          fadeInTicks: 18,
          fadeOutTicks: 18,
          restartPolicy: "resume",
        },
      ],
    },
    {
      sceneId: "scene.alley",
      layers: [
        {
          id: "audio-scene-layer.alley.rain",
          cueId: "audio-cue.ambience.rain",
          role: "ambience",
          startDelayTicks: 30,
          fadeInTicks: 12,
          fadeOutTicks: 12,
          restartPolicy: "resume",
        },
      ],
    },
  ],
  speechBindings: [
    {
      id: "audio-speech-binding.caretaker.warning",
      dialogueLineId: "dialogue-line.caretaker.warning",
      cueId: "audio-cue.speech.warning",
      leadInTicks: 2,
      tailTicks: 3,
      markers: [
        { atTick: 0, name: "mouth.rest" },
        { atTick: 8, name: "mouth.open" },
        { atTick: 20, name: "mouth.round" },
      ],
    },
  ],
});

describe("audio mix validation", () => {
  it("accepts a complete mixer, soundscape and speech contract", () => {
    expect(validateAudioMixManifest(project, manifest)).toEqual([]);
  });

  it("reports bus, loop, scene-role and speech errors", () => {
    const broken = audioMixManifestSchema.parse({
      ...manifest,
      buses: manifest.buses.filter((bus) => bus.id !== "speech"),
      cues: manifest.cues.map((cue) =>
        cue.id === "audio-cue.speech.warning"
          ? {
              ...cue,
              bus: "music" as const,
              loop: {
                startMilliseconds: 2000,
                endMilliseconds: 1000,
                crossfadeMilliseconds: 900,
              },
            }
          : cue,
      ),
      soundscapes: [
        {
          sceneId: "scene.office",
          layers: [
            {
              id: "audio-scene-layer.office.invalid",
              cueId: "audio-cue.speech.warning",
              role: "ambience",
              startDelayTicks: 0,
              fadeInTicks: 0,
              fadeOutTicks: 0,
              restartPolicy: "restart",
            },
          ],
        },
      ],
    });

    expect(
      validateAudioMixManifest(project, broken).map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "missing-bus",
        "invalid-loop-range",
        "invalid-loop-crossfade",
        "layer-bus-mismatch",
        "speech-binding-bus-mismatch",
      ]),
    );
  });
});

describe("deterministic audio runtime", () => {
  it("enters soundscapes and ducks music and ambience for speech", () => {
    let state = createInitialAudioRuntimeState(
      manifest,
      id<"scene">("scene.office"),
    );
    const entered = enterAudioScene(
      manifest,
      state,
      id<"scene">("scene.office"),
      0,
    );
    state = entered.state;
    expect(entered.commands.filter((command) => command.kind === "play")).toHaveLength(2);

    const speech = triggerAudioCue(
      manifest,
      state,
      id<"audio-cue">("audio-cue.speech.warning"),
      10,
    );
    state = speech.state;
    expect(
      speech.commands.find(
        (command) => command.kind === "set-bus" && command.bus === "music",
      ),
    ).toMatchObject({
      effectiveVolume: 0.78 * 0.46,
      fadeTicks: 6,
    });
    expect(
      speech.commands.find(
        (command) =>
          command.kind === "set-bus" && command.bus === "ambience",
      ),
    ).toMatchObject({
      effectiveVolume: 0.72 * 0.68,
      fadeTicks: 6,
    });

    const voice = state.voices.find(
      (candidate) => candidate.cueId === "audio-cue.speech.warning",
    );
    expect(voice).toBeDefined();
    const completed = completeAudioVoice(manifest, state, voice!.id, 70);
    expect(
      completed.commands.find(
        (command) => command.kind === "set-bus" && command.bus === "music",
      ),
    ).toMatchObject({ effectiveVolume: 0.78, fadeTicks: 18 });
  });

  it("preserves explicit bus fades instead of replacing them with ducking timing", () => {
    const state = createInitialAudioRuntimeState(
      manifest,
      id<"scene">("scene.office"),
    );
    const changed = setAudioBusRuntimeState(
      manifest,
      state,
      "music",
      { volume: 0.5, muted: false },
      20,
      12,
    );
    expect(
      changed.commands.filter(
        (command) => command.kind === "set-bus" && command.bus === "music",
      ),
    ).toEqual([
      {
        kind: "set-bus",
        atTick: 20,
        bus: "music",
        effectiveVolume: 0.5,
        fadeTicks: 12,
      },
    ]);
  });

  it("stores resume offsets across scene changes", () => {
    let state = createInitialAudioRuntimeState(
      manifest,
      id<"scene">("scene.office"),
    );
    state = enterAudioScene(
      manifest,
      state,
      id<"scene">("scene.office"),
      0,
    ).state;
    state = advanceAudioRuntimeState(manifest, state, 60).state;
    const alley = enterAudioScene(
      manifest,
      state,
      id<"scene">("scene.alley"),
      60,
    );
    expect(
      alley.state.resumeOffsetsMilliseconds["audio-cue.ambience.rain"],
    ).toBeCloseTo(1000);
  });

  it("restores delayed voices without seeking before their start", () => {
    let state = createInitialAudioRuntimeState(
      manifest,
      id<"scene">("scene.alley"),
    );
    state = enterAudioScene(
      manifest,
      state,
      id<"scene">("scene.alley"),
      0,
    ).state;
    const commands = restoreAudioRuntimeCommands(manifest, state, 10);
    expect(
      commands.find(
        (command) =>
          command.kind === "play" &&
          command.voice.owner.kind === "scene-layer",
      ),
    ).toMatchObject({
      kind: "play",
      atTick: 30,
      voice: { startedAtTick: 30, startOffsetMilliseconds: 0 },
    });
  });
});

describe("compiled audio evidence", () => {
  const compiled = assetBuildManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "test",
    fingerprint: hash,
    assets: [
      {
        assetId: "asset.music.noir",
        kind: "audio",
        sourceFiles: [
          {
            path: "audio/noir.ogg",
            sha256: hash,
            byteLength: 100,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/audio/noir.ogg",
            mediaType: "audio/ogg",
            sha256: hash,
            byteLength: 90,
          },
        ],
        metadata: {
          kind: "audio",
          durationMilliseconds: 12_000,
          channels: 2,
          sampleRate: 44_100,
        },
      },
      {
        assetId: "asset.ambience.rain",
        kind: "audio",
        sourceFiles: [
          {
            path: "audio/rain.ogg",
            sha256: hash,
            byteLength: 100,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/audio/rain.ogg",
            mediaType: "audio/ogg",
            sha256: hash,
            byteLength: 90,
          },
        ],
        metadata: {
          kind: "audio",
          durationMilliseconds: 21_000,
          channels: 2,
          sampleRate: 44_100,
        },
      },
      {
        assetId: "asset.speech.warning",
        kind: "audio",
        sourceFiles: [
          {
            path: "audio/warning.ogg",
            sha256: hash,
            byteLength: 100,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/audio/warning.ogg",
            mediaType: "audio/ogg",
            sha256: hash,
            byteLength: 90,
          },
        ],
        metadata: {
          kind: "audio",
          durationMilliseconds: 1500,
          channels: 1,
          sampleRate: 44_100,
        },
      },
    ],
  });

  it("proves cue offsets, loops, output types and speech timing", () => {
    expect(
      validateCompiledAudioMappings(project, manifest, compiled).filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
  });

  it("blocks loop ranges beyond encoded duration", () => {
    const broken = audioMixManifestSchema.parse({
      ...manifest,
      cues: manifest.cues.map((cue) =>
        cue.id === "audio-cue.music.noir"
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
    expect(
      validateCompiledAudioMappings(project, broken, compiled).map(
        (issue) => issue.code,
      ),
    ).toContain("compiled-audio-loop-out-of-range");
  });
});
