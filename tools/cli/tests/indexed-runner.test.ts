import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/runner.js";

const temporaryDirectories: string[] = [];

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b))) {
      const child = (value as Record<string, unknown>)[key];
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
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const createIndexedFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "evavo-adventure-indexed-runner-"));
  temporaryDirectories.push(root);
  const projectPath = join(root, "project.json");
  const manifestPath = join(root, "build", "assets.manifest.json");
  const indexedPath = join(root, "build", "indexed-assets.json");
  const paletteMapsPath = join(root, "palette-maps.json");
  const stagingPath = join(root, "scene-staging.json");
  const releasePath = join(root, "release");

  const backgroundSource = new TextEncoder().encode("indexed-background-source");
  const paletteSource = new TextEncoder().encode("palette-source");
  const backgroundOutput = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const paletteOutput = new Uint8Array([
    0, 0, 0, 255,
    120, 150, 180, 255,
  ]);
  const indexOutput = new Uint8Array(320 * 200).fill(1);

  await mkdir(join(root, "art"), { recursive: true });
  await mkdir(join(root, "build", "assets"), { recursive: true });
  await mkdir(join(root, "build", "palettes"), { recursive: true });
  await mkdir(join(root, "build", "indexed"), { recursive: true });
  await writeFile(join(root, "art", "room.png"), backgroundSource);
  await writeFile(join(root, "art", "room.pal"), paletteSource);
  await writeFile(join(root, "build", "assets", "room.png"), backgroundOutput);
  await writeFile(join(root, "build", "palettes", "room.rgba"), paletteOutput);
  await writeFile(join(root, "build", "indexed", "room.idx"), indexOutput);

  const project = {
    schemaVersion: 1,
    id: "project.indexed-cli",
    title: "Indexed CLI",
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
    startSceneId: "scene.room",
    startEntranceId: "entrance.room",
    scenes: [
      {
        id: "scene.room",
        name: "Indexed room",
        width: 320,
        height: 200,
        backgroundAssetId: "asset.room",
        navigationAreas: [
          {
            id: "navigation.room",
            shape: {
              points: [
                { x: 0, y: 120 },
                { x: 320, y: 120 },
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
            id: "entrance.room",
            position: { x: 32, y: 170 },
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
      { id: "asset.room", path: "art/room.png", kind: "image" },
      { id: "asset.palette.room", path: "art/room.pal", kind: "palette" },
    ],
    inventoryItems: [],
  };
  await writeJson(projectPath, project);

  const manifestPayload = {
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "0.1.0-indexed-test",
    assets: [
      {
        assetId: "asset.room",
        kind: "image",
        sourceFiles: [
          {
            path: "art/room.png",
            sha256: sha256(backgroundSource),
            byteLength: backgroundSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/room.png",
            mediaType: "image/png",
            sha256: sha256(backgroundOutput),
            byteLength: backgroundOutput.byteLength,
          },
        ],
        metadata: {
          kind: "image",
          width: 320,
          height: 200,
          palette: true,
          colourCount: 2,
        },
      },
      {
        assetId: "asset.palette.room",
        kind: "palette",
        sourceFiles: [
          {
            path: "art/room.pal",
            sha256: sha256(paletteSource),
            byteLength: paletteSource.byteLength,
          },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "palettes/room.rgba",
            mediaType: "application/octet-stream",
            sha256: sha256(paletteOutput),
            byteLength: paletteOutput.byteLength,
          },
        ],
        metadata: {
          kind: "palette",
          entries: 2,
        },
      },
    ],
  };
  const fingerprint = sha256(JSON.stringify(canonicalize(manifestPayload)));
  await writeJson(manifestPath, { ...manifestPayload, fingerprint });

  await writeJson(indexedPath, {
    manifestVersion: 1,
    projectId: project.id,
    assets: [
      {
        assetId: "asset.room",
        width: 320,
        height: 200,
        indexRuntimePath: "indexed/room.idx",
        indexSha256: sha256(indexOutput),
        indexByteLength: indexOutput.byteLength,
        defaultPalette: {
          paletteAssetId: "asset.palette.room",
          paletteOffset: 0,
        },
        frames: [],
      },
    ],
  });

  await writeJson(paletteMapsPath, {
    manifestVersion: 1,
    projectId: project.id,
    maps: [
      {
        id: "palette-map.room.cool",
        paletteAssetId: "asset.palette.room",
        paletteOffset: 0,
        description: "Cool room treatment",
      },
    ],
  });

  await writeJson(stagingPath, {
    manifestVersion: 1,
    projectId: project.id,
    scenes: [
      {
        sceneId: "scene.room",
        paletteLightZones: [
          {
            id: "palette-light-zone.room.cool",
            shape: {
              points: [
                { x: 0, y: 120 },
                { x: 320, y: 120 },
                { x: 320, y: 200 },
                { x: 0, y: 200 },
              ],
            },
            paletteMapId: "palette-map.room.cool",
            blendMode: "ordered-dither",
            priority: 1,
          },
        ],
      },
    ],
  });

  return {
    projectPath,
    manifestPath,
    indexedPath,
    paletteMapsPath,
    stagingPath,
    releasePath,
    indexOutput,
  };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("indexed CLI packaging", () => {
  it("validates, embeds and releases indexed VGA assets with palette maps and staging", async () => {
    const fixture = await createIndexedFixture();
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      [
        "package",
        "--project",
        fixture.projectPath,
        "--asset-manifest",
        fixture.manifestPath,
        "--indexed-assets",
        fixture.indexedPath,
        "--palette-maps",
        fixture.paletteMapsPath,
        "--scene-staging",
        fixture.stagingPath,
        "--out",
        fixture.releasePath,
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
      command: "package",
      valid: true,
      indexedAssetCount: 1,
      paletteMapCount: 1,
    });

    const bundle = JSON.parse(
      await readFile(join(fixture.releasePath, "game.bundle.json"), "utf8"),
    ) as {
      readonly indexedAssets?: { readonly assets: readonly { readonly assetId: string }[] };
      readonly paletteMaps?: { readonly maps: readonly { readonly id: string }[] };
      readonly sceneStaging?: { readonly scenes: readonly { readonly paletteLightZones: readonly { readonly paletteMapId: string }[] }[] };
    };
    expect(bundle.indexedAssets?.assets[0]?.assetId).toBe("asset.room");
    expect(bundle.paletteMaps?.maps[0]?.id).toBe("palette-map.room.cool");
    expect(bundle.sceneStaging?.scenes[0]?.paletteLightZones[0]?.paletteMapId).toBe(
      "palette-map.room.cool",
    );

    expect(
      new Uint8Array(await readFile(join(fixture.releasePath, "indexed", "room.idx"))),
    ).toEqual(fixture.indexOutput);

    const releaseManifest = JSON.parse(
      await readFile(join(fixture.releasePath, "release.manifest.json"), "utf8"),
    ) as {
      readonly files: readonly {
        readonly role: string;
        readonly path: string;
        readonly sha256: string;
      }[];
    };
    expect(releaseManifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "index-map",
          path: "indexed/room.idx",
          sha256: sha256(fixture.indexOutput),
        }),
        expect.objectContaining({
          role: "primary",
          path: "palettes/room.rgba",
        }),
      ]),
    );
  });
});
