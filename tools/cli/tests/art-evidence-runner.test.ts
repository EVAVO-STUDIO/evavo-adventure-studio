import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArtVisualEvidenceManifest } from "@evavo/adventure-art-direction/evidence";
import { encodeRgbaPng, type RgbaImage } from "@evavo/adventure-asset-pipeline";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/runner.js";

const temporaryDirectories: string[] = [];

const image = (pixels: readonly (readonly [number, number, number, number])[]): RgbaImage => {
  const data = new Uint8Array(pixels.length * 4);
  pixels.forEach((pixel, index) => {
    data.set(pixel, index * 4);
  });
  return { width: pixels.length, height: 1, data };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-art-proof-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const proofPath = join(root, "build", "art-evidence.json");
  const backgroundSourcePath = join(root, "art", "office-source.png");
  const actorSourcePath = join(root, "art", "actor-source.png");
  const backgroundOutputPath = join(root, "build", "assets", "office.png");
  const atlasManifestPath = join(root, "build", "assets", "actor", "atlas.json");
  const atlasPagePath = join(root, "build", "assets", "actor", "page-000.png");

  const background = await encodeRgbaPng(
    image([
      [30, 40, 50, 255],
      [70, 80, 90, 255],
    ]),
    { mode: "indexed-png", colours: 16, dither: 0 },
  );
  const actorPage = await encodeRgbaPng(
    image([
      [255, 255, 255, 255],
      [0, 0, 0, 0],
    ]),
    { mode: "indexed-png", colours: 16, dither: 0 },
  );
  const atlasManifest = new TextEncoder().encode('{"atlas":1}\n');

  await mkdir(dirname(backgroundSourcePath), { recursive: true });
  await mkdir(dirname(backgroundOutputPath), { recursive: true });
  await mkdir(dirname(atlasPagePath), { recursive: true });
  await writeFile(backgroundSourcePath, background);
  await writeFile(actorSourcePath, actorPage);
  await writeFile(backgroundOutputPath, background);
  await writeFile(atlasManifestPath, atlasManifest);
  await writeFile(atlasPagePath, actorPage);

  const project = parseAdventureProject({
    schemaVersion: 1,
    id: "project.art-proof-runner",
    title: "Art Proof Runner",
    presentation: {
      nativeWidth: 2,
      nativeHeight: 1,
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
        width: 2,
        height: 1,
        backgroundAssetId: "asset.office",
        navigationAreas: [],
        depthBands: [],
        occluders: [],
        hotspots: [],
        entrances: [
          {
            id: "entrance.office",
            position: { x: 0, y: 0 },
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
            assetId: "asset.actor",
            sourceRect: { x: 0, y: 0, width: 2, height: 1 },
            sourceSize: { width: 2, height: 1 },
            trimOffset: { x: 0, y: 0 },
            pivot: { x: 1, y: 1 },
            footPoint: { x: 1, y: 1 },
            durationTicks: 12,
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
      { id: "asset.office", path: "art/office-source.png", kind: "image" },
      { id: "asset.actor", path: "art/actor-source.png", kind: "spritesheet" },
    ],
    inventoryItems: [],
  });
  await writeJson(projectPath, project);

  const payload = {
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        sourceFiles: [
          {
            path: "art/office-source.png",
            sha256: sha256(background),
            byteLength: background.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/office.png",
            mediaType: "image/png",
            sha256: sha256(background),
            byteLength: background.byteLength,
          },
        ],
        metadata: {
          kind: "image",
          width: 2,
          height: 1,
          palette: true,
          colourCount: 2,
        },
      },
      {
        assetId: "asset.actor",
        kind: "spritesheet",
        sourceFiles: [
          {
            path: "art/actor-source.png",
            sha256: sha256(actorPage),
            byteLength: actorPage.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: "assets/actor/atlas.json",
            mediaType: "application/json",
            sha256: sha256(atlasManifest),
            byteLength: atlasManifest.byteLength,
          },
          {
            role: "page-000",
            runtimePath: "assets/actor/page-000.png",
            mediaType: "image/png",
            sha256: sha256(actorPage),
            byteLength: actorPage.byteLength,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 2, height: 1 }],
          frames: [
            {
              frameId: "frame.detective.idle",
              pageOutputRole: "page-000",
              sourceRect: { x: 0, y: 0, width: 2, height: 1 },
              originalSize: { width: 2, height: 1 },
              trimOffset: { x: 0, y: 0 },
              padding: 0,
            },
          ],
        },
      },
    ],
  };
  await writeJson(manifestPath, {
    ...payload,
    fingerprint: sha256(JSON.stringify(canonicalize(payload))),
  });

  return { projectPath, manifestPath, proofPath };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("art evidence CLI command", () => {
  it("generates deterministic proof from verified PNG outputs", async () => {
    const files = await fixture();
    let stdout = "";
    let stderr = "";

    const exitCode = await runCli(
      [
        "art-evidence",
        "--project",
        files.projectPath,
        "--asset-manifest",
        files.manifestPath,
        "--out",
        files.proofPath,
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
      command: "art-evidence",
      valid: true,
      assetCount: 2,
      visualOutputCount: 2,
    });
    expect(parseArtVisualEvidenceManifest(JSON.parse(await readFile(files.proofPath, "utf8")))).toMatchObject(
      {
        projectId: "project.art-proof-runner",
        assets: [
          {
            assetId: "asset.actor",
            kind: "spritesheet",
            pages: [
              {
                outputRole: "page-000",
                palette: true,
                alphaMode: "binary",
              },
            ],
          },
          {
            assetId: "asset.office",
            kind: "image",
            palette: true,
            alphaMode: "opaque",
          },
        ],
      },
    );
  });

  it("refuses to overwrite the asset manifest", async () => {
    const files = await fixture();
    let stderr = "";

    const exitCode = await runCli(
      [
        "art-evidence",
        "--project",
        files.projectPath,
        "--asset-manifest",
        files.manifestPath,
        "--out",
        files.manifestPath,
      ],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("would overwrite an input or evidence file");
  });
});
