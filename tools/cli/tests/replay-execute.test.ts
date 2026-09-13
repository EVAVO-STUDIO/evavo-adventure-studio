import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReplayLog } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame, parseSaveGame } from "@evavo/adventure-save-game";
import { afterEach, describe, expect, it } from "vitest";
import { runReplayExecuteCli } from "../src/replay-execute.js";

const directories: string[] = [];
const hash = "0".repeat(64);
const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.cli-replay-execute",
  title: "CLI Replay Execute",
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
        palette: false,
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
    },
  ],
  dialogues: [],
  sequences: [],
});

const save = createSaveGame(
  bundle,
  {
    story: {
      schemaVersion: 1,
      projectId: bundle.projectId,
      tick: 0,
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
  },
  {
    controlledActorInstanceId: null,
    selectedVerbId: null,
    selectedItemId: null,
    statusText: "READY",
    parser: { text: "", history: [] },
  },
);

const fixture = async (expected = save.saveFingerprint) => {
  const root = await mkdtemp(join(tmpdir(), "evavo-replay-execute-"));
  directories.push(root);
  const bundlePath = join(root, "game.bundle.json");
  const replayPath = join(root, "playtest.replay.json");
  const outputSavePath = join(root, "output", "final.save.json");
  const replay = createReplayLog(bundle, save, {
    events: [],
    finalTick: 0,
    expectedFinalSaveFingerprint: expected,
  });
  await writeFile(bundlePath, `${JSON.stringify(bundle)}\n`, "utf8");
  await writeFile(replayPath, `${JSON.stringify(replay)}\n`, "utf8");
  return { bundlePath, replayPath, outputSavePath, replay };
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("replay execute CLI", () => {
  it("executes a replay and writes the verified final save", async () => {
    const files = await fixture();
    let stdout = "";
    let stderr = "";

    const exitCode = await runReplayExecuteCli(
      [
        "replay-execute",
        "--bundle",
        files.bundlePath,
        "--replay",
        files.replayPath,
        "--output-save",
        files.outputSavePath,
        "--json",
      ],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      command: "replay-execute",
      valid: true,
      checkpointMatched: true,
      finalSaveFingerprint: save.saveFingerprint,
      outputSavePath: files.outputSavePath,
    });
    expect(parseSaveGame(JSON.parse(await readFile(files.outputSavePath, "utf8")))).toEqual(save);
  });

  it("reports deterministic divergence with a stable diagnostic code", async () => {
    const files = await fixture("fnv1a64:0000000000000000");
    let stdout = "";

    expect(
      await runReplayExecuteCli(
        ["replay-execute", "--bundle", files.bundlePath, "--replay", files.replayPath, "--json"],
        {
          stdout: (text) => {
            stdout += text;
          },
          stderr: () => undefined,
        },
      ),
    ).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: "replay-divergence" })],
    });
  });

  it("returns null for unrelated commands and exit 2 for bad usage", async () => {
    expect(await runReplayExecuteCli(["validate"])).toBeNull();
    let stdout = "";
    expect(
      await runReplayExecuteCli(["replay-execute", "--json"], {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      }),
    ).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({
      exitCode: 2,
      diagnostics: [expect.objectContaining({ code: "invalid-usage" })],
    });
  });
});
