import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLog } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { runRuntimeArtifactCli } from "../src/runtime-artifacts.js";

const directories: string[] = [];
const hash = "0".repeat(64);

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.cli-artifacts",
  title: "CLI Artifacts",
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
      interactionIndex: {},
    },
  ],
  dialogues: [],
  sequences: [],
});

const world: Parameters<typeof createSaveGame>[1] = {
  story: {
    schemaVersion: 1,
    projectId: bundle.projectId,
    tick: 12,
    currentSceneId: bundle.startSceneId,
    currentEntranceId: bundle.startEntranceId,
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
};

const save = createSaveGame(bundle, world, {
  controlledActorInstanceId: null,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "READY",
  parser: { text: "", history: [] },
});
const replay = createReplayLog(bundle, save, {
  events: [],
  finalTick: 12,
  expectedFinalSaveFingerprint: save.saveFingerprint,
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-runtime-artifacts-"));
  directories.push(root);
  const bundlePath = join(root, "game.bundle.json");
  const savePath = join(root, "quick.save.json");
  const replayPath = join(root, "playtest.replay.json");
  await writeFile(bundlePath, `${JSON.stringify(bundle)}\n`);
  await writeFile(savePath, `${JSON.stringify(save)}\n`);
  await writeFile(replayPath, `${JSON.stringify(replay)}\n`);
  return { root, bundlePath, savePath, replayPath };
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("runtime artifact CLI", () => {
  it("returns machine-readable save and replay reports", async () => {
    const files = await fixture();
    let saveOutput = "";
    let replayOutput = "";

    expect(
      await runRuntimeArtifactCli(
        [
          "save-validate",
          "--bundle",
          files.bundlePath,
          "--save",
          files.savePath,
          "--json",
        ],
        {
          stdout: (text) => {
            saveOutput += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(0);
    expect(JSON.parse(saveOutput)).toMatchObject({
      command: "save-validate",
      valid: true,
      projectId: "project.cli-artifacts",
      logicalTick: 12,
      saveFingerprint: save.saveFingerprint,
    });

    expect(
      await runRuntimeArtifactCli(
        [
          "replay-validate",
          "--bundle",
          files.bundlePath,
          "--replay",
          files.replayPath,
          "--json",
        ],
        {
          stdout: (text) => {
            replayOutput += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(0);
    expect(JSON.parse(replayOutput)).toMatchObject({
      command: "replay-validate",
      valid: true,
      eventCount: 0,
      initialTick: 12,
      finalTick: 12,
      replayFingerprint: replay.replayFingerprint,
    });
  });

  it("reports save and replay tampering with stable sources", async () => {
    const files = await fixture();
    await writeFile(
      files.savePath,
      `${JSON.stringify({
        ...save,
        interface: { ...save.interface, statusText: "TAMPERED" },
      })}\n`,
    );
    await writeFile(
      files.replayPath,
      `${JSON.stringify({ ...replay, finalTick: 13 })}\n`,
    );

    let saveOutput = "";
    let replayOutput = "";
    expect(
      await runRuntimeArtifactCli(
        [
          "save-validate",
          "--bundle",
          files.bundlePath,
          "--save",
          files.savePath,
          "--json",
        ],
        {
          stdout: (text) => {
            saveOutput += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(1);
    expect(JSON.parse(saveOutput)).toMatchObject({
      valid: false,
      diagnostics: [
        expect.objectContaining({ source: "save-game-integrity" }),
      ],
    });

    expect(
      await runRuntimeArtifactCli(
        [
          "replay-validate",
          "--bundle",
          files.bundlePath,
          "--replay",
          files.replayPath,
          "--json",
        ],
        {
          stdout: (text) => {
            replayOutput += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(1);
    expect(JSON.parse(replayOutput)).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ source: "replay-integrity" })],
    });
  });

  it("returns null for existing project commands and exit 2 for bad usage", async () => {
    expect(await runRuntimeArtifactCli(["validate", "--project", "project.json"])).toBeNull();

    let output = "";
    expect(
      await runRuntimeArtifactCli(["save-validate", "--json"], {
        stdout: (text) => {
          output += text;
        },
        stderr: () => undefined,
      }),
    ).toBe(2);
    expect(JSON.parse(output)).toMatchObject({
      valid: false,
      exitCode: 2,
      diagnostics: [expect.objectContaining({ code: "invalid-usage" })],
    });
  });

  it("reports missing and malformed files as validation failures", async () => {
    const files = await fixture();
    await writeFile(files.savePath, "not json");
    let output = "";

    expect(
      await runRuntimeArtifactCli(
        [
          "save-validate",
          "--bundle",
          files.bundlePath,
          "--save",
          files.savePath,
          "--json",
        ],
        {
          stdout: (text) => {
            output += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(1);
    expect(JSON.parse(output)).toMatchObject({
      diagnostics: [
        expect.objectContaining({
          source: "save-game-file",
          code: "invalid-json",
        }),
      ],
    });

    expect(await readFile(files.bundlePath, "utf8")).toContain(
      "project.cli-artifacts",
    );
  });
});
