import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { afterEach, describe, expect, it } from "vitest";
import { CliDataError } from "../src/diagnostics.js";
import { loadUiSkins } from "../src/ui-inputs.js";

const temporaryDirectories: string[] = [];

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.cli-ui",
  title: "CLI UI",
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
    { id: "asset.font.ui", path: "art/font.png", kind: "image" },
  ],
  inventoryItems: [],
});

const fonts = bitmapFontManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: "bitmap-font.ui",
      name: "UI",
      atlasAssetId: "asset.font.ui",
      lineHeight: 8,
      baseline: 7,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 4, height: 7 },
          bearing: { x: 0, y: -7 },
          advance: 5,
        },
      ],
      kernings: [],
    },
  ],
});

const skinManifest = (
  overrides: Partial<{
    readonly interactionMode: "context" | "verb-list";
    readonly fontId: string;
  }> = {},
) => ({
  manifestVersion: 1,
  projectId: project.id,
  defaultSkinId: "ui-skin.default",
  skins: [
    {
      id: "ui-skin.default",
      name: "Default",
      interactionMode: overrides.interactionMode ?? "context",
      nativeSize: { width: 320, height: 200 },
      status: {
        id: "ui-region.status",
        rect: { x: 0, y: 184, width: 320, height: 16 },
        padding: 2,
        panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
      },
      verbs: [],
      fonts: {
        status: {
          fontId: overrides.fontId ?? "bitmap-font.ui",
          color: 0xffffff,
          align: "left",
        },
      },
    },
  ],
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("CLI interface skin inputs", () => {
  it("loads a valid project-scoped skin document", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-ui-"));
    temporaryDirectories.push(root);
    const path = join(root, "ui-skins.json");
    await writeJson(path, skinManifest());

    const loaded = await loadUiSkins(path, project, fonts);
    expect(loaded.path).toBe(path);
    expect(loaded.manifest?.defaultSkinId).toBe("ui-skin.default");
    expect(loaded.diagnostics).toEqual([]);
  });

  it("reports mode drift and missing bitmap font roles", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-ui-"));
    temporaryDirectories.push(root);
    const path = join(root, "ui-skins.json");
    await writeJson(
      path,
      skinManifest({
        interactionMode: "verb-list",
        fontId: "bitmap-font.missing",
      }),
    );

    const loaded = await loadUiSkins(path, project, fonts);
    expect(loaded.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["unknown-font", "missing-verb-bar", "default-mode-mismatch"]),
    );
    expect(loaded.diagnostics.every((diagnostic) => diagnostic.source === "ui-skins-semantics")).toBe(true);
  });

  it("returns stable schema diagnostics and file errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "evavo-cli-ui-"));
    temporaryDirectories.push(root);
    const invalidPath = join(root, "invalid.json");
    await writeJson(invalidPath, { manifestVersion: 1, skins: [] });

    await expect(loadUiSkins(invalidPath, project, fonts)).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([expect.objectContaining({ source: "ui-skins-schema" })]),
    });

    await expect(loadUiSkins(join(root, "missing.json"), project, fonts)).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([expect.objectContaining({ source: "ui-skins-file" })]),
    });
  });
});
