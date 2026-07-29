import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { CliDataError } from "../src/diagnostics.js";
import { loadBitmapFonts } from "../src/font-inputs.js";

const hash = "0".repeat(64);
const temporaryDirectories: string[] = [];

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.cli-fonts",
  title: "CLI Fonts",
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
    {
      id: "asset.font.dialogue",
      path: "art/font-dialogue.aseprite",
      kind: "spritesheet",
    },
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
      assetId: "asset.font.dialogue",
      kind: "spritesheet",
      sourceFiles: [
        {
          path: "art/font-dialogue.aseprite",
          sha256: hash,
          byteLength: 1,
        },
      ],
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/font-dialogue/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/font-dialogue/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 32, height: 16 }],
        frames: [
          {
            frameId: "frame.font.question",
            pageOutputRole: "page-000",
            sourceRect: { x: 1, y: 1, width: 4, height: 6 },
            originalSize: { width: 4, height: 6 },
            trimOffset: { x: 0, y: 0 },
            padding: 1,
          },
        ],
      },
    },
  ],
});

const fontManifest = (sourceRect = { x: 1, y: 1, width: 4, height: 6 }) => ({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.dialogue",
      name: "Dialogue",
      atlasAssetId: "asset.font.dialogue",
      lineHeight: 8,
      baseline: 6,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.question",
          codePoint: 63,
          frameId: "frame.font.question",
          sourceRect,
          bearing: { x: 0, y: -6 },
          advance: 5,
        },
      ],
      kernings: [],
    },
  ],
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("CLI bitmap font inputs", () => {
  it("loads a valid focused font document and compiled mapping", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-fonts-"));
    temporaryDirectories.push(root);
    const path = join(root, "bitmap-fonts.json");
    await writeJson(path, fontManifest());

    const loaded = await loadBitmapFonts(path, project, compiled);
    expect(loaded.path).toBe(path);
    expect(loaded.manifest?.fonts[0]?.id).toBe("bitmap-font.dialogue");
    expect(loaded.diagnostics).toEqual([]);
  });

  it("reports stale compiled glyph rectangles", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-fonts-"));
    temporaryDirectories.push(root);
    const path = join(root, "bitmap-fonts.json");
    await writeJson(path, fontManifest({ x: 2, y: 1, width: 4, height: 6 }));

    const loaded = await loadBitmapFonts(path, project, compiled);
    expect(loaded.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "bitmap-fonts-semantics",
          code: "compiled-font-frame-rectangle-mismatch",
        }),
      ]),
    );
  });

  it("returns stable schema diagnostics and file errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-fonts-"));
    temporaryDirectories.push(root);
    const invalidPath = join(root, "invalid.json");
    await writeJson(invalidPath, { manifestVersion: 1, fonts: [] });

    await expect(
      loadBitmapFonts(invalidPath, project, compiled),
    ).rejects.toMatchObject<Partial<CliDataError>>({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ source: "bitmap-fonts-schema" }),
      ]),
    });

    await expect(
      loadBitmapFonts(join(root, "missing.json"), project, compiled),
    ).rejects.toMatchObject<Partial<CliDataError>>({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ source: "bitmap-fonts-file" }),
      ]),
    });
  });
});
