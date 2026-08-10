import {
  audioMixManifestSchema,
  createDefaultAudioMixManifest,
} from "@evavo/adventure-audio";
import {
  parseAdventureProject,
  type Id,
} from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { parseAudioEditorCommand } from "../src/command-schema.js";
import {
  createAudioEditorHistory,
  executeAudioEditorCommand,
  isAudioEditorDocumentDirty,
  markAudioEditorHistorySaved,
  redoAudioEditorCommand,
  type AudioEditorCommandError,
  undoAudioEditorCommand,
} from "../src/index.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.audio-editor",
  title: "Audio Editor",
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
  sequences: [],
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
      startOffsetMilliseconds: 0,
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
      interruptGroup: null,
    },
    {
      id: "audio-cue.ambience.rain",
      name: "Rain loop",
      assetId: "asset.ambience.rain",
      bus: "ambience",
      volume: 0.75,
      startOffsetMilliseconds: 0,
      fadeInTicks: 18,
      fadeOutTicks: 18,
      loop: {
        startMilliseconds: 0,
        endMilliseconds: 20_000,
        crossfadeMilliseconds: 200,
      },
      polyphony: "restart",
      maxInstances: 1,
      priority: 0,
      interruptGroup: null,
    },
    {
      id: "audio-cue.speech.warning",
      name: "Caretaker warning",
      assetId: "asset.speech.warning",
      bus: "speech",
      volume: 1,
      startOffsetMilliseconds: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      loop: null,
      polyphony: "restart",
      maxInstances: 1,
      priority: 100,
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
          startDelayTicks: 0,
          fadeInTicks: 30,
          fadeOutTicks: 24,
          restartPolicy: "continue",
        },
        {
          id: "audio-scene-layer.office.rain",
          cueId: "audio-cue.ambience.rain",
          role: "ambience",
          startDelayTicks: 0,
          fadeInTicks: 18,
          fadeOutTicks: 18,
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
      ],
    },
  ],
});

describe("audio editor history", () => {
  it("edits buses and cues with undo, redo and save tracking", () => {
    let history = createAudioEditorHistory(project, manifest);
    const musicBus = manifest.buses.find((bus) => bus.id === "music")!;
    const musicCue = manifest.cues.find(
      (cue) => cue.id === "audio-cue.music.noir",
    )!;

    history = executeAudioEditorCommand(project, history, {
      kind: "replace-bus",
      busId: "music",
      bus: { ...musicBus, volume: 0.62 },
    });
    history = executeAudioEditorCommand(project, history, {
      kind: "replace-cue",
      cueId: musicCue.id,
      cue: { ...musicCue, fadeInTicks: 42 },
    });

    expect(
      history.document.manifest.buses.find((bus) => bus.id === "music")
        ?.volume,
    ).toBe(0.62);
    expect(
      history.document.manifest.cues.find((cue) => cue.id === musicCue.id)
        ?.fadeInTicks,
    ).toBe(42);
    expect(isAudioEditorDocumentDirty(history.document)).toBe(true);

    history = undoAudioEditorCommand(project, history);
    expect(
      history.document.manifest.cues.find((cue) => cue.id === musicCue.id)
        ?.fadeInTicks,
    ).toBe(30);

    history = redoAudioEditorCommand(project, history);
    expect(
      history.document.manifest.cues.find((cue) => cue.id === musicCue.id)
        ?.fadeInTicks,
    ).toBe(42);

    history = markAudioEditorHistorySaved(history);
    expect(isAudioEditorDocumentDirty(history.document)).toBe(false);
  });

  it("allows atomic cue replacement while blocking dangling references", () => {
    const rain = manifest.cues.find(
      (cue) => cue.id === "audio-cue.ambience.rain",
    )!;
    const office = manifest.soundscapes[0]!;
    let history = createAudioEditorHistory(project, manifest);

    expect(() =>
      executeAudioEditorCommand(project, history, {
        kind: "remove-cue",
        cueId: rain.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AudioEditorCommandError>>({
        code: "invalid-document",
      }),
    );

    const replacement = {
      ...rain,
      id: id<"audio-cue">("audio-cue.ambience.rain-soft"),
      name: "Soft rain loop",
      volume: 0.58,
    };
    const migratedSoundscape = {
      ...office,
      layers: office.layers.map((layer) =>
        layer.cueId === rain.id
          ? { ...layer, cueId: replacement.id }
          : layer,
      ),
    };

    history = executeAudioEditorCommand(project, history, {
      kind: "batch",
      commands: [
        {
          kind: "insert-cue",
          index: manifest.cues.length,
          cue: replacement,
        },
        {
          kind: "replace-soundscape",
          sceneId: office.sceneId,
          soundscape: migratedSoundscape,
        },
        { kind: "remove-cue", cueId: rain.id },
      ],
    });

    expect(
      history.document.manifest.cues.map((cue) => cue.id),
    ).not.toContain(rain.id);
    expect(
      history.document.manifest.soundscapes[0]?.layers[1]?.cueId,
    ).toBe(replacement.id);

    history = undoAudioEditorCommand(project, history);
    expect(history.document.manifest.cues.map((cue) => cue.id)).toContain(
      rain.id,
    );
    expect(
      history.document.manifest.soundscapes[0]?.layers[1]?.cueId,
    ).toBe(rain.id);
  });

  it("rejects scene layers whose role and cue bus disagree", () => {
    const history = createAudioEditorHistory(project, manifest);

    expect(() =>
      executeAudioEditorCommand(project, history, {
        kind: "insert-scene-layer",
        sceneId: id<"scene">("scene.office"),
        index: 2,
        layer: {
          id: id<"audio-scene-layer">(
            "audio-scene-layer.office.invalid",
          ),
          cueId: id<"audio-cue">("audio-cue.speech.warning"),
          role: "ambience",
          startDelayTicks: 0,
          fadeInTicks: 0,
          fadeOutTicks: 0,
          restartPolicy: "restart",
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AudioEditorCommandError>>({
        code: "invalid-document",
      }),
    );
  });

  it("rejects out-of-order speech performance markers", () => {
    const binding = manifest.speechBindings[0]!;
    const history = createAudioEditorHistory(project, manifest);

    expect(() =>
      executeAudioEditorCommand(project, history, {
        kind: "replace-speech-binding",
        bindingId: binding.id,
        binding: {
          ...binding,
          markers: [
            { atTick: 12, name: "mouth.open" },
            { atTick: 4, name: "mouth.rest" },
          ],
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AudioEditorCommandError>>({
        code: "invalid-document",
      }),
    );
  });
});

describe("audio editor command schema", () => {
  it("parses recursive bus, cue and layer edits", () => {
    const cue = manifest.cues[0]!;
    const layer = manifest.soundscapes[0]!.layers[0]!;
    expect(
      parseAudioEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-bus",
            busId: "music",
            bus: manifest.buses.find((bus) => bus.id === "music"),
          },
          {
            kind: "replace-cue",
            cueId: cue.id,
            cue,
          },
          {
            kind: "replace-scene-layer",
            sceneId: manifest.soundscapes[0]!.sceneId,
            layerId: layer.id,
            layer,
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty command batches", () => {
    expect(() =>
      parseAudioEditorCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});
