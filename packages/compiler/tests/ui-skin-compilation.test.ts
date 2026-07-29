import { describe, expect, it } from "vitest";
import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseUiSkinManifest } from "@evavo/adventure-ui-skin";
import {
  compileProject,
  ProjectCompilationError,
} from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.ui-compile",
  title: "UI Compile",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "verb-list",
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
    { id: "asset.font.ui", path: "art/font-ui.png", kind: "image" },
  ],
  inventoryItems: [],
});

const assets = assetBuildManifestSchema.parse({
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
      assetId: "asset.font.ui",
      kind: "image",
      sourceFiles: [
        { path: "art/font-ui.png", sha256: hash, byteLength: 1 },
      ],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/font-ui.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 32,
        height: 16,
        palette: true,
        colourCount: 16,
      },
    },
  ],
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
      baseline: 6,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: "font-glyph.question",
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 4, height: 6 },
          bearing: { x: 0, y: -6 },
          advance: 5,
        },
      ],
      kernings: [],
    },
  ],
});

const panel = {
  fill: [8, 10, 16, 240] as const,
  border: 0x333744,
  borderWidth: 1,
};

const status = {
  id: "ui-region.status",
  rect: { x: 0, y: 176, width: 320, height: 24 },
  padding: 6,
  panel,
};

const skins = parseUiSkinManifest({
  manifestVersion: 1,
  projectId: project.id,
  defaultSkinId: "ui-skin.verb-list",
  skins: [
    {
      id: "ui-skin.context-alternate",
      name: "Context alternate",
      interactionMode: "context",
      nativeSize: { width: 320, height: 200 },
      status: { ...status, id: "ui-region.context.status" },
      verbs: [],
      fonts: {
        status: {
          fontId: "bitmap-font.ui",
          color: 0xffffff,
          align: "left",
        },
      },
    },
    {
      id: "ui-skin.verb-list",
      name: "Verb list",
      interactionMode: "verb-list",
      nativeSize: { width: 320, height: 200 },
      status,
      verbs: [
        {
          id: "ui-verb.use",
          verb: "use",
          label: "USE",
          cursorId: "use",
          primary: true,
        },
        {
          id: "ui-verb.look",
          verb: "look",
          label: "LOOK",
          cursorId: "look",
          primary: true,
        },
      ],
      verbBar: {
        region: {
          id: "ui-region.verbs",
          rect: { x: 0, y: 144, width: 320, height: 32 },
          padding: 4,
          panel,
        },
        orientation: "horizontal",
        gap: 4,
        buttonHeight: 22,
        normal: panel,
        hover: panel,
        pressed: panel,
        disabled: panel,
      },
      fonts: {
        status: {
          fontId: "bitmap-font.ui",
          color: 0xffffff,
          align: "left",
        },
        verb: {
          fontId: "bitmap-font.ui",
          color: 0xffffff,
          align: "center",
        },
      },
    },
  ],
});

describe("interface skin compilation", () => {
  it("embeds sorted skins while preserving authored verb order", () => {
    const compiled = compileProject(project, assets, fonts, skins);

    expect(compiled.bundle.uiSkins?.skins.map((skin) => skin.id)).toEqual([
      "ui-skin.context-alternate",
      "ui-skin.verb-list",
    ]);
    expect(
      compiled.bundle.uiSkins?.skins
        .find((skin) => skin.id === "ui-skin.verb-list")
        ?.verbs.map((verb) => verb.verb),
    ).toEqual(["use", "look"]);
    expect(compiled.canonicalJson).toContain("ui-skin.verb-list");
  });

  it("produces identical output when non-default skins are reordered", () => {
    const reordered = parseUiSkinManifest({
      ...skins,
      skins: [...skins.skins].reverse(),
    });
    const first = compileProject(project, assets, fonts, skins);
    const second = compileProject(project, assets, fonts, reordered);

    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("omits the optional skin document when none is supplied", () => {
    expect(compileProject(project, assets, fonts).bundle.uiSkins).toBeUndefined();
  });

  it("blocks unknown UI fonts and default mode drift", () => {
    const broken = parseUiSkinManifest({
      ...skins,
      defaultSkinId: "ui-skin.context-alternate",
      skins: skins.skins.map((skin) =>
        skin.id === "ui-skin.verb-list"
          ? {
              ...skin,
              fonts: {
                ...skin.fonts,
                status: {
                  ...skin.fonts.status,
                  fontId: "bitmap-font.missing",
                },
              },
            }
          : skin,
      ),
    });

    expect(() => compileProject(project, assets, fonts, broken)).toThrowError(
      expect.objectContaining<Partial<ProjectCompilationError>>({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "default-mode-mismatch" }),
          expect.objectContaining({ code: "unknown-font" }),
        ]),
      }),
    );
  });
});
