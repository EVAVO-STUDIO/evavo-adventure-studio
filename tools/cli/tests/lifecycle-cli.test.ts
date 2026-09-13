import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseLifecycleCliArguments,
  runLifecycleCli,
  type LifecycleCliEnvironment,
} from "../src/lifecycle-cli.js";

const directories: string[] = [];
const hash = "0".repeat(64);

const project = {
  schemaVersion: 1,
  id: "project.lifecycle-cli",
  title: "The Red Ledger",
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
      entrances: [{ id: "entrance.office", position: { x: 20, y: 170 }, facing: "east" }],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
};

const runtimeBundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: project.id,
  title: project.title,
  presentation: project.presentation,
  startSceneId: project.startSceneId,
  startEntranceId: project.startEntranceId,
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
        colourCount: 32,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: project.scenes.map((scene) => ({ ...scene, hotspots: [] })),
  dialogues: [],
  sequences: [],
};

const environment = (): {
  readonly cli: LifecycleCliEnvironment;
  readonly stdout: string[];
  readonly stderr: string[];
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    cli: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    stdout,
    stderr,
  };
};

const json = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("lifecycle CLI", () => {
  it("parses lifecycle and endings command groups", () => {
    expect(
      parseLifecycleCliArguments([
        "lifecycle",
        "template",
        "--project",
        "project.json",
        "--kind",
        "failure",
        "--out",
        "game-lifecycle.json",
      ]),
    ).toMatchObject({ kind: "template", outcomeKind: "failure" });
    expect(
      parseLifecycleCliArguments([
        "endings",
        "validate",
        "--project",
        "project.json",
        "--lifecycle",
        "game-lifecycle.json",
      ]),
    ).toMatchObject({ kind: "validate" });
    expect(parseLifecycleCliArguments(["compile", "--project", "project.json"])).toBeNull();
  });

  it("templates, validates and attaches lifecycle data without mutating the source bundle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-lifecycle-cli-"));
    directories.push(directory);
    const projectPath = join(directory, "project.json");
    const lifecyclePath = join(directory, "game-lifecycle.json");
    const bundlePath = join(directory, "runtime.bundle.json");
    const outputPath = join(directory, "runtime.lifecycle.bundle.json");
    await writeFile(projectPath, JSON.stringify(project), "utf8");
    await writeFile(bundlePath, JSON.stringify(runtimeBundle), "utf8");

    expect(
      await runLifecycleCli(
        [
          "lifecycle",
          "template",
          "--project",
          projectPath,
          "--kind",
          "failure",
          "--out",
          lifecyclePath,
        ],
        environment().cli,
      ),
    ).toBe(0);
    expect(await json(lifecyclePath)).toMatchObject({
      projectId: project.id,
      outcomes: [{ id: "outcome.failure", kind: "failure" }],
    });

    expect(
      await runLifecycleCli(
        ["lifecycle", "validate", "--project", projectPath, "--lifecycle", lifecyclePath],
        environment().cli,
      ),
    ).toBe(0);

    expect(
      await runLifecycleCli(
        [
          "lifecycle",
          "attach",
          "--lifecycle",
          lifecyclePath,
          "--bundle",
          bundlePath,
          "--out",
          outputPath,
        ],
        environment().cli,
      ),
    ).toBe(0);
    expect(await json(outputPath)).toMatchObject({
      projectId: project.id,
      lifecycle: {
        projectId: project.id,
        outcomes: [{ id: "outcome.failure" }],
      },
    });
    expect(await json(bundlePath)).toEqual(runtimeBundle);
  });

  it("rejects output collisions before writing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evavo-lifecycle-collision-"));
    directories.push(directory);
    const projectPath = join(directory, "project.json");
    await writeFile(projectPath, JSON.stringify(project), "utf8");
    const output = environment();

    expect(
      await runLifecycleCli(
        [
          "lifecycle",
          "template",
          "--project",
          projectPath,
          "--kind",
          "success",
          "--out",
          projectPath,
        ],
        output.cli,
      ),
    ).toBe(2);
    expect(output.stderr.join("\n")).toContain("overwrite an input file");
  });
});