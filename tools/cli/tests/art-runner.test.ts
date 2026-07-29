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
import { createArtDirectionManifest } from "@evavo/adventure-art-direction";
import { artVisualEvidenceManifestSchema } from "@evavo/adventure-art-direction/evidence";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { runCli } from "../src/runner.js";

const temporaryDirectories: string[] = [];

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-art-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const artPath = join(root, "art-direction.json");
  const evidencePath = join(root, "build", "art-evidence.json");
  const sourcePath = join(root, "art", "office.png");
  const outputPath = join(root, "build", "assets", "office.png");
  const bundlePath = join(root, "dist", "game.bundle.json");
  const reportPath = join(root, "dist", "compile-report.json");

  const source = new TextEncoder().encode("office-source");
  const output = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await mkdir(dirname(sourcePath), { recursive: true });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(sourcePath, source);
  await writeFile(outputPath, output);

  const project = parseAdventureProject({
    schemaVersion: 1,
    id: "project.art-runner",
    title: "Art Runner",
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
    assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
    inventoryItems: [],
  });
  await writeJson(projectPath, project);

  const manifestPayload = {
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        sourceFiles: [
          {
            path: "art/office.png",
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
          colourCount: 128,
        },
      },
    ],
  };
  await writeJson(manifestPath, {
    ...manifestPayload,
    fingerprint: sha256(JSON.stringify(canonicalize(manifestPayload))),
  });

  await writeJson(
    artPath,
    createArtDirectionManifest(project, "vga-256-320x200"),
  );
  const evidence = (colourCount: number) =>
    artVisualEvidenceManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      compilerVersion: "test",
      assets: [
        {
          assetId: "asset.office",
          kind: "image",
          palette: true,
          colourCount,
          alphaMode: "opaque",
        },
      ],
    });
  await writeJson(evidencePath, evidence(128));

  return {
    projectPath,
    manifestPath,
    artPath,
    evidencePath,
    bundlePath,
    reportPath,
    writeEvidence: (colourCount: number) =>
      writeJson(evidencePath, evidence(colourCount)),
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("art-gated CLI runner", () => {
  it("compiles and records art evidence provenance", async () => {
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
        "--art-direction",
        fixture.artPath,
        "--art-evidence",
        fixture.evidencePath,
        "--out",
        fixture.bundlePath,
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
      valid: true,
      command: "compile",
      artDirectionPath: fixture.artPath,
      artEvidencePath: fixture.evidencePath,
      artProfile: "vga-256-320x200",
    });
    expect(await readFile(fixture.bundlePath, "utf8")).toContain(
      "project.art-runner",
    );
    expect(await readFile(fixture.reportPath, "utf8")).toContain(
      "artEvidencePath",
    );
  });

  it("blocks validation when pixel proof exceeds the colour budget", async () => {
    const fixture = await createFixture();
    await fixture.writeEvidence(300);
    let stdout = "";

    const exitCode = await runCli(
      [
        "validate",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--art-direction",
        fixture.artPath,
        "--art-evidence",
        fixture.evidencePath,
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
    expect(
      (
        JSON.parse(stdout) as {
          readonly diagnostics: readonly {
            readonly source: string;
            readonly code: string;
          }[];
        }
      ).diagnostics,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "art-evidence-semantics",
          code: "visual-evidence-colour-budget-exceeded",
        }),
      ]),
    );
  });
});
