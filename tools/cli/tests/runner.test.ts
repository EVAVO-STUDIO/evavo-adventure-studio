import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-adventure-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const sourcePath = join(root, "art", "office-master.png");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const runtimePath = join(root, "build", "assets", "office.png");
  const outputPath = join(root, "dist", "game.bundle.json");
  const reportPath = join(root, "dist", "compile-report.json");

  const source = new TextEncoder().encode("authored-office-source");
  const output = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await mkdir(dirname(sourcePath), { recursive: true });
  await mkdir(dirname(runtimePath), { recursive: true });
  await writeFile(sourcePath, source);
  await writeFile(runtimePath, output);

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
        navigationAreas: [],
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
    actors: [],
    dialogues: [],
    sequences: [],
    assets: [
      {
        id: "asset.office",
        path: "art/office-master.png",
        kind: "image",
      },
    ],
    inventoryItems: [],
  };
  await writeJson(projectPath, project);

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
            sha256: sha256(source),
            byteLength: source.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/office.png",
            mediaType: "image/png",
            sha256: sha256(output),
            byteLength: output.byteLength,
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
  };
  const fingerprint = sha256(JSON.stringify(canonicalize(manifestPayload)));
  await writeJson(manifestPath, { ...manifestPayload, fingerprint });

  return {
    projectPath,
    manifestPath,
    runtimePath,
    outputPath,
    reportPath,
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("cli runner", () => {
  it("compiles verified evidence into a source-free runtime bundle", async () => {
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
    });

    const bundleText = await readFile(fixture.outputPath, "utf8");
    const bundle = JSON.parse(bundleText) as {
      readonly assets: readonly {
        readonly assetId: string;
        readonly sourceFiles?: unknown;
      }[];
    };
    expect(bundle.assets[0]?.assetId).toBe("asset.office");
    expect(bundle.assets[0]?.sourceFiles).toBeUndefined();
    expect(bundleText).not.toContain("office-master.png");
    expect(await readFile(fixture.reportPath, "utf8")).toContain(
      "bundleFingerprint",
    );
  });

  it("refuses changed runtime evidence", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.runtimePath, new Uint8Array([1, 2, 3]));
    let stdout = "";

    const exitCode = await runCli(
      [
        "validate",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
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
      readonly diagnostics: readonly { readonly code: string }[];
    };
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["byte-length-mismatch", "sha256-mismatch"]),
    );
  });
});
