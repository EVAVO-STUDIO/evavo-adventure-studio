import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import type { Id } from "@evavo/adventure-project-schema";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { appendUiSkinFrame, composeUiSkinNodes, type UiAssetGeometryResolver } from "../src/compose.js";
import { parseUiSkinManifest, uiSkinById, validateUiSkinManifest } from "../src/index.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.ui-skin",
  title: "UI Skin",
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
    {
      id: "asset.font.ui",
      path: "art/font-ui.png",
      kind: "image",
    },
    {
      id: "asset.icon.look",
      path: "art/icon-look.aseprite",
      kind: "spritesheet",
    },
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
  accent: 0xff244e,
};

const skinInput = {
  manifestVersion: 1,
  projectId: project.id,
  defaultSkinId: "ui-skin.verb-list",
  skins: [
    {
      id: "ui-skin.verb-list",
      name: "Noir verb list",
      interactionMode: "verb-list",
      nativeSize: { width: 320, height: 200 },
      status: {
        id: "ui-region.status",
        rect: { x: 0, y: 176, width: 320, height: 24 },
        padding: 6,
        panel,
      },
      verbs: [
        {
          id: "ui-verb.look",
          verb: "look",
          label: "LOOK",
          cursorId: "look",
          shortcut: "L",
          primary: true,
        },
        {
          id: "ui-verb.use",
          verb: "use",
          label: "USE",
          cursorId: "use",
          shortcut: "U",
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
        hover: { ...panel, fill: [28, 32, 43, 255] },
        pressed: { ...panel, fill: [50, 18, 28, 255] },
        disabled: { ...panel, fill: [12, 13, 17, 210] },
      },
      fonts: {
        status: {
          fontId: "bitmap-font.ui",
          color: 0xf5f5f7,
          outlineColor: 0,
          align: "left",
        },
        verb: {
          fontId: "bitmap-font.ui",
          color: 0xf5f5f7,
          align: "center",
        },
      },
    },
  ],
};

const [baseSkin] = skinInput.skins;
if (!baseSkin) {
  throw new Error("Expected the UI skin fixture to contain its base skin.");
}

const manifest = parseUiSkinManifest(skinInput);

describe("UI skin validation", () => {
  it("accepts a native verb-list skin", () => {
    expect(validateUiSkinManifest(project, fonts, manifest)).toEqual([]);
    expect(uiSkinById(manifest).interactionMode).toBe("verb-list");
  });

  it("reports native bounds, font and mode requirements", () => {
    const broken = parseUiSkinManifest({
      ...skinInput,
      skins: [
        {
          ...baseSkin,
          interactionMode: "parser-assisted",
          status: {
            ...baseSkin.status,
            rect: { x: 2, y: 190, width: 330, height: 20 },
          },
          fonts: {
            ...baseSkin.fonts,
            status: {
              ...baseSkin.fonts.status,
              fontId: "bitmap-font.missing",
            },
          },
        },
      ],
    });

    expect(validateUiSkinManifest(project, fonts, broken).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "default-mode-mismatch",
        "region-out-of-bounds",
        "unknown-font",
        "missing-parser",
      ]),
    );
  });

  it("enforces two-button primaries and icon-bar assets", () => {
    const twoButton = parseUiSkinManifest({
      ...skinInput,
      defaultSkinId: "ui-skin.two-button",
      skins: [
        {
          ...baseSkin,
          id: "ui-skin.two-button",
          interactionMode: "two-button",
          verbs: baseSkin.verbs.map((verb) => ({
            ...verb,
            primary: false,
          })),
        },
      ],
    });
    expect(
      validateUiSkinManifest(
        {
          ...project,
          presentation: {
            ...project.presentation,
            interactionMode: "two-button",
          },
        },
        fonts,
        twoButton,
      ).map((issue) => issue.code),
    ).toContain("insufficient-primary-verbs");

    const iconBar = parseUiSkinManifest({
      ...skinInput,
      defaultSkinId: "ui-skin.icon",
      skins: [
        {
          ...baseSkin,
          id: "ui-skin.icon",
          interactionMode: "icon-bar",
        },
      ],
    });
    expect(
      validateUiSkinManifest(
        {
          ...project,
          presentation: {
            ...project.presentation,
            interactionMode: "icon-bar",
          },
        },
        fonts,
        iconBar,
      ).map((issue) => issue.code),
    ).toContain("icon-bar-without-icons");
  });
});

describe("UI skin composition", () => {
  it("composes status and verb controls as native render nodes", () => {
    const nodes = composeUiSkinNodes(uiSkinById(manifest), fonts, {
      statusText: "Nothing useful happens.",
      activeVerbId: id<"ui-verb">("ui-verb.look"),
    });

    expect(nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["solid-rectangle", "bitmap-text"]),
    );
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "bitmap-text",
          text: "Nothing useful happens.",
          fontId: "bitmap-font.ui",
        }),
        expect.objectContaining({
          kind: "bitmap-text",
          text: "LOOK",
        }),
      ]),
    );
  });

  it("uses exact compiled icon geometry for icon bars", () => {
    const iconManifest = parseUiSkinManifest({
      ...skinInput,
      defaultSkinId: "ui-skin.icon",
      skins: [
        {
          ...baseSkin,
          id: "ui-skin.icon",
          interactionMode: "icon-bar",
          verbs: baseSkin.verbs.map((verb) => ({
            ...verb,
            iconAssetId: "asset.icon.look",
            iconFrameId: "frame.icon.look",
          })),
        },
      ],
    });
    const resolver: UiAssetGeometryResolver = {
      resolve: () => ({
        sourceRect: { x: 2, y: 2, width: 12, height: 12 },
        originalSize: { width: 16, height: 16 },
        trimOffset: { x: 2, y: 2 },
      }),
    };
    const nodes = composeUiSkinNodes(
      uiSkinById(iconManifest),
      fonts,
      { statusText: "ICON BAR" },
      { assets: resolver },
    );

    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "sprite",
          assetId: "asset.icon.look",
          frameId: "frame.icon.look",
          sampling: "nearest",
        }),
      ]),
    );
  });

  it("appends UI nodes without changing scene nodes", () => {
    const sceneFrame = {
      frameVersion: 1 as const,
      tick: 5,
      canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] as const },
      camera: {
        position: { x: 0, y: 0 },
        viewport: { width: 320, height: 200 },
        shakeOffset: { x: 0, y: 0 },
      },
      nodes: [
        {
          kind: "solid-rectangle" as const,
          id: id<"render-node">("scene.background"),
          order: {
            layer: "background" as const,
            elevation: 0,
            baselineY: 200,
            zOffset: 0,
            stableId: "scene.background",
          },
          transform: {
            position: { x: 0, y: 0 },
            pivot: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotationRadians: 0,
          },
          opacity: 1,
          visible: true,
          size: { width: 320, height: 200 },
          color: 0,
        },
      ],
    };
    const composed = appendUiSkinFrame(sceneFrame, uiSkinById(manifest), fonts, { statusText: "READY" });

    expect(composed.nodes[0]?.id).toBe("scene.background");
    expect(composed.nodes.length).toBeGreaterThan(sceneFrame.nodes.length);
  });
});
