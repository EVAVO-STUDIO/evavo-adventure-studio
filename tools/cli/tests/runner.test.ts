import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/runner.js";

const temporaryDirectories: string[] = [];

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) {
        output[key] = canonicalize(child);
      }
    }
    return output;
  }
  return value;
};

const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-adventure-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const sceneInstancesPath = join(root, "scene-instances.json");
  const officeSourcePath = join(root, "art", "office-master.png");
  const detectiveSourcePath = join(root, "art", "detective.aseprite");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const officeRuntimePath = join(root, "build", "assets", "office.png");
  const detectiveAtlasPath = join(root, "build", "assets", "detective", "atlas.json");
  const detectivePagePath = join(root, "build", "assets", "detective", "page-000.png");
  const outputPath = join(root, "dist", "game.bundle.json");
  const reportPath = join(root, "dist", "compile-report.json");
  const releasePath = join(root, "release");

  const officeSource = new TextEncoder().encode("authored-office-source");
  const detectiveSource = new TextEncoder().encode("authored-detective-source");
  const officeOutput = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const atlasOutput = new TextEncoder().encode("{}\n");
  const pageOutput = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
  await mkdir(dirname(officeSourcePath), { recursive: true });
  await mkdir(dirname(officeRuntimePath), { recursive: true });
  await mkdir(dirname(detectiveAtlasPath), { recursive: true });
  await writeFile(officeSourcePath, officeSource);
  await writeFile(detectiveSourcePath, detectiveSource);
  await writeFile(officeRuntimePath, officeOutput);
  await writeFile(detectiveAtlasPath, atlasOutput);
  await writeFile(detectivePagePath, pageOutput);

  const project = {
    schemaVersion: 1,
    id: "project.cli-fixture",
    title: "CLI Fixture",
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
        navigationAreas: [
          {
            id: "navigation.office",
            shape: {
              points: [
                { x: 0, y: 100 },
                { x: 320, y: 100 },
                { x: 320, y: 200 },
                { x: 0, y: 200 },
              ],
            },
            elevation: 0,
          },
        ],
        depthBands: [],
        occluders: [],
        hotspots: [],
        entrances: [
          {
            id: "entrance.office",
            position: { x: 16, y: 168 },
            facing: "east",
          },
        ],
        fallbackText: "Nothing happens.",
      },
    ],
    actors: [
      {
        id: "actor.detective",
        name: "Detective",
        frames: [
          {
            id: "frame.detective.idle",
            assetId: "asset.detective",
            sourceRect: { x: 1, y: 1, width: 12, height: 20 },
            sourceSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            pivot: { x: 9, y: 23 },
            footPoint: { x: 9, y: 23 },
            durationTicks: 8,
            mirrorEligible: true,
          },
        ],
        animations: [
          {
            id: "animation.detective.idle-east",
            state: "idle",
            facing: "east",
            frameIds: ["frame.detective.idle"],
            loop: true,
            interruptible: true,
          },
        ],
      },
    ],
    dialogues: [],
    sequences: [],
    assets: [
      {
        id: "asset.office",
        path: "art/office-master.png",
        kind: "image",
      },
      {
        id: "asset.detective",
        path: "art/detective.aseprite",
        kind: "spritesheet",
      },
    ],
    inventoryItems: [],
  };
  await writeJson(projectPath, project);

  const sceneInstances = {
    manifestVersion: 1,
    projectId: project.id,
    objectDefinitions: [],
    scenes: [
      {
        sceneId: "scene.office",
        actorInstances: [
          {
            id: "actor-instance.office.detective",
            actorId: "actor.detective",
            position: { x: 50, y: 160 },
            facing: "east",
            animationState: "idle",
          },
        ],
        objectInstances: [],
      },
    ],
  };
  await writeJson(sceneInstancesPath, sceneInstances);

  const manifestPayload = {
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "0.1.0-test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        sourceFiles: [
          {
            path: "art/office-master.png",
            sha256: sha256(officeSource),
            byteLength: officeSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/office.png",
            mediaType: "image/png",
            sha256: sha256(officeOutput),
            byteLength: officeOutput.byteLength,
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
        assetId: "asset.detective",
        kind: "spritesheet",
        sourceFiles: [
          {
            path: "art/detective.aseprite",
            sha256: sha256(detectiveSource),
            byteLength: detectiveSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: "assets/detective/atlas.json",
            mediaType: "application/json",
            sha256: sha256(atlasOutput),
            byteLength: atlasOutput.byteLength,
          },
          {
            role: "page-000",
            runtimePath: "assets/detective/page-000.png",
            mediaType: "image/png",
            sha256: sha256(pageOutput),
            byteLength: pageOutput.byteLength,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 64, height: 64 }],
          frames: [
            {
              frameId: "frame.detective.idle",
              pageOutputRole: "page-000",
              sourceRect: { x: 1, y: 1, width: 12, height: 20 },
              originalSize: { width: 18, height: 24 },
              trimOffset: { x: 3, y: 4 },
              padding: 1,
            },
          ],
        },
      },
    ],
  };
  const fingerprint = sha256(JSON.stringify(canonicalize(manifestPayload)));
  await writeJson(manifestPath, { ...manifestPayload, fingerprint });

  return {
    root,
    projectPath,
    sceneInstancesPath,
    manifestPath,
    officeRuntimePath,
    officeRuntimeBytes: officeOutput,
    outputPath,
    reportPath,
    releasePath,
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("cli runner", () => {
  it("compiles verified evidence and placements into a source-free runtime bundle", async () => {
    const fixture = await createFixture();
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(
      [
        "compile",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--scene-instances",
        fixture.sceneInstancesPath,
        "--out",
        fixture.outputPath,
        "--report",
        fixture.reportPath,
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
      command: "compile",
      valid: true,
      projectId: "project.cli-fixture",
      sceneInstancesPath: fixture.sceneInstancesPath,
    });

    const bundleText = await readFile(fixture.outputPath, "utf8");
    const bundle = JSON.parse(bundleText) as {
      readonly assets: readonly {
        readonly assetId: string;
        readonly sourceFiles?: unknown;
      }[];
      readonly sceneInstances?: {
        readonly scenes: readonly {
          readonly actorInstances: readonly { readonly id: string }[];
        }[];
      };
    };
    expect(bundle.assets.map((asset) => asset.assetId)).toEqual(["asset.detective", "asset.office"]);
    expect(bundle.assets[0]?.sourceFiles).toBeUndefined();
    expect(bundle.sceneInstances?.scenes[0]?.actorInstances[0]?.id).toBe("actor-instance.office.detective");
    expect(bundleText).not.toContain("office-master.png");
    expect(await readFile(fixture.reportPath, "utf8")).toContain("bundleFingerprint");
  });

  it("packages a clean composed release and removes stale target files", async () => {
    const fixture = await createFixture();
    await mkdir(fixture.releasePath, { recursive: true });
    await writeFile(join(fixture.releasePath, "stale.txt"), "stale");
    let stdout = "";

    const exitCode = await runCli(
      [
        "package",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--scene-instances",
        fixture.sceneInstancesPath,
        "--out",
        fixture.releasePath,
        "--json",
      ],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      },
    );

    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout) as {
      readonly command: string;
      readonly releaseFingerprint: string;
      readonly fileCount: number;
    };
    expect(report.command).toBe("package");
    expect(report.releaseFingerprint).toHaveLength(64);
    expect(report.fileCount).toBe(5);

    expect(new Uint8Array(await readFile(join(fixture.releasePath, "assets", "office.png")))).toEqual(
      fixture.officeRuntimeBytes,
    );
    const bundleText = await readFile(join(fixture.releasePath, "game.bundle.json"), "utf8");
    expect(bundleText).not.toContain("office-master.png");
    expect(bundleText).toContain("actor-instance.office.detective");
    const releaseManifest = JSON.parse(
      await readFile(join(fixture.releasePath, "release.manifest.json"), "utf8"),
    ) as {
      readonly fingerprint: string;
      readonly bundle: { readonly sha256: string };
      readonly files: readonly { readonly path: string }[];
    };
    expect(releaseManifest.fingerprint).toBe(report.releaseFingerprint);
    expect(releaseManifest.bundle.sha256).toBe(sha256(new TextEncoder().encode(bundleText)));
    expect(releaseManifest.files.map((file) => file.path)).toEqual([
      "assets/detective/atlas.json",
      "assets/detective/page-000.png",
      "assets/office.png",
    ]);
    await expect(readFile(join(fixture.releasePath, "stale.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns scene-specific diagnostics for invalid placements", async () => {
    const fixture = await createFixture();
    const invalid = JSON.parse(await readFile(fixture.sceneInstancesPath, "utf8")) as {
      scenes: { actorInstances: { facing: string }[] }[];
    };
    invalid.scenes[0]!.actorInstances[0]!.facing = "west";
    await writeJson(fixture.sceneInstancesPath, invalid);
    let stdout = "";

    const exitCode = await runCli(
      [
        "validate",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--scene-instances",
        fixture.sceneInstancesPath,
        "--json",
      ],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      },
    );

    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout) as {
      readonly diagnostics: readonly {
        readonly source: string;
        readonly code: string;
      }[];
    };
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "scene-instances-semantics",
          code: "missing-instance-animation",
        }),
      ]),
    );
  });

  it("refuses release directories that contain build inputs", async () => {
    const fixture = await createFixture();
    let stderr = "";

    const exitCode = await runCli(
      [
        "package",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--scene-instances",
        fixture.sceneInstancesPath,
        "--out",
        fixture.root,
      ],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("contains input or evidence file");
  });

  it("refuses changed runtime evidence", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.officeRuntimePath, new Uint8Array([1, 2, 3]));
    let stdout = "";

    const exitCode = await runCli(
      ["validate", "--project", fixture.projectPath, "--asset-manifest", fixture.manifestPath, "--json"],
      {
        stdout: (text) => {
          stdout += text;
        },
        stderr: () => undefined,
      },
    );

    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout) as {
      readonly diagnostics: readonly { readonly code: string }[];
    };
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["byte-length-mismatch", "sha256-mismatch"]),
    );
  });

  it("returns machine-readable schema failures when requested", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.projectPath, "{ not json");
    let stdout = "";

    const exitCode = await runCli(["validate", "--project", fixture.projectPath, "--json"], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: () => undefined,
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({
      command: "validate",
      valid: false,
      exitCode: 1,
      diagnostics: [expect.objectContaining({ code: "invalid-json" })],
    });
  });
});
