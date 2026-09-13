import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { afterEach, describe, expect, it } from "vitest";
import { loadAudioMix } from "../src/audio-inputs.js";

const hash = "0".repeat(64);
const temporaryDirectories: string[] = [];

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.cli-audio",
  title: "CLI Audio",
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
    { id: "asset.rain", path: "audio/rain.ogg", kind: "audio" },
  ],
  inventoryItems: [],
});

const compiled = assetBuildManifestSchema.parse({
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
    {
      assetId: "asset.rain",
      kind: "audio",
      sourceFiles: [
        { path: "audio/rain.ogg", sha256: hash, byteLength: 10 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/audio/rain.ogg",
          mediaType: "audio/ogg",
          sha256: hash,
          byteLength: 8,
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
});

const audioManifest = (loopEnd = 19_000) => ({
  manifestVersion: 1,
  projectId: project.id,
  logicalTicksPerSecond: 60,
  buses: [
    {
      id: "master",
      volume: 1,
      muted: false,
      maxVoices: 64,
      stealPolicy: "lowest-priority",
    },
    {
      id: "music",
      volume: 0.8,
      muted: false,
      maxVoices: 4,
      stealPolicy: "lowest-priority",
    },
    {
      id: "speech",
      volume: 1,
      muted: false,
      maxVoices: 4,
      stealPolicy: "lowest-priority",
    },
    {
      id: "ambience",
      volume: 0.7,
      muted: false,
      maxVoices: 8,
      stealPolicy: "oldest",
    },
    {
      id: "effects",
      volume: 0.9,
      muted: false,
      maxVoices: 16,
      stealPolicy: "lowest-priority",
    },
    {
      id: "interface",
      volume: 0.8,
      muted: false,
      maxVoices: 8,
      stealPolicy: "oldest",
    },
  ],
  ducking: [],
  cues: [
    {
      id: "audio-cue.rain",
      name: "Rain",
      assetId: "asset.rain",
      bus: "ambience",
      volume: 0.75,
      startOffsetMilliseconds: 0,
      fadeInTicks: 12,
      fadeOutTicks: 12,
      loop: {
        startMilliseconds: 0,
        endMilliseconds: loopEnd,
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("CLI audio mix inputs", () => {
  it("loads semantic and compiled audio evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-audio-"));
    temporaryDirectories.push(root);
    const path = join(root, "audio-mix.json");
    await writeJson(path, audioManifest());

    const loaded = await loadAudioMix(path, project, compiled);
    expect(loaded.path).toBe(path);
    expect(loaded.manifest?.cues[0]?.id).toBe("audio-cue.rain");
    expect(loaded.diagnostics).toEqual([]);
  });

  it("reports encoded duration violations", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-audio-"));
    temporaryDirectories.push(root);
    const path = join(root, "audio-mix.json");
    await writeJson(path, audioManifest(21_000));

    const loaded = await loadAudioMix(path, project, compiled);
    expect(loaded.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "audio-mix-semantics",
          code: "compiled-audio-loop-out-of-range",
        }),
      ]),
    );
  });

  it("returns stable schema and file diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-audio-"));
    temporaryDirectories.push(root);
    const invalidPath = join(root, "invalid.json");
    await writeJson(invalidPath, { manifestVersion: 1, cues: [] });

    await expect(
      loadAudioMix(invalidPath, project, compiled),
    ).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ source: "audio-mix-schema" }),
      ]),
    });
    await expect(
      loadAudioMix(join(root, "missing.json"), project, compiled),
    ).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ source: "audio-mix-file" }),
      ]),
    });
  });
});
