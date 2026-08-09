import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import type { Id } from "@evavo/adventure-project-schema";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseUiSkinManifest } from "@evavo/adventure-ui-skin";
import { describe, expect, it } from "vitest";
import { parseUiSkinEditorCommand } from "../src/command-schema.js";
import {
  createUiSkinEditorHistory,
  executeUiSkinEditorCommand,
  isUiSkinEditorDocumentDirty,
  markUiSkinEditorHistorySaved,
  redoUiSkinEditorCommand,
  type UiSkinEditorCommandError,
  undoUiSkinEditorCommand,
} from "../src/index.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.ui-editor",
  title: "UI Editor",
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
    { id: "asset.font.ui", path: "art/font-ui.png", kind: "image" },
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
};

const skinInput = {
  id: "ui-skin.context",
  name: "Context",
  interactionMode: "context" as const,
  nativeSize: { width: 320, height: 200 },
  status: {
    id: "ui-region.status",
    rect: { x: 0, y: 182, width: 320, height: 18 },
    padding: 4,
    panel,
  },
  verbs: [],
  fonts: {
    status: {
      fontId: "bitmap-font.ui",
      color: 0xffffff,
      align: "left" as const,
    },
  },
};

const manifest = parseUiSkinManifest({
  manifestVersion: 1,
  projectId: project.id,
  defaultSkinId: skinInput.id,
  skins: [skinInput],
});

const [skin] = manifest.skins;
if (!skin) {
  throw new Error("Expected the UI editor fixture to contain its base skin.");
}

describe("interface skin editor history", () => {
  it("edits skin regions with undo, redo and save tracking", () => {
    let history = createUiSkinEditorHistory(project, fonts, manifest);
    const current = manifest.skins[0]!;
    history = executeUiSkinEditorCommand(project, fonts, history, {
      kind: "replace-skin",
      skinId: current.id,
      skin: {
        ...current,
        status: {
          ...current.status,
          rect: { x: 0, y: 178, width: 320, height: 22 },
        },
      },
    });

    expect(history.document.manifest.skins[0]?.status.rect.height).toBe(22);
    expect(isUiSkinEditorDocumentDirty(history.document)).toBe(true);

    history = undoUiSkinEditorCommand(project, fonts, history);
    expect(history.document.manifest.skins[0]?.status.rect.height).toBe(18);
    expect(isUiSkinEditorDocumentDirty(history.document)).toBe(false);

    history = redoUiSkinEditorCommand(project, fonts, history);
    expect(history.document.manifest.skins[0]?.status.rect.height).toBe(22);
    history = markUiSkinEditorHistorySaved(history);
    expect(isUiSkinEditorDocumentDirty(history.document)).toBe(false);
  });

  it("preserves authored verb order through inserts and undo", () => {
    let history = createUiSkinEditorHistory(project, fonts, manifest);
    history = executeUiSkinEditorCommand(project, fonts, history, {
      kind: "insert-verb",
      skinId: skin.id,
      index: 0,
      verb: {
        id: id<"ui-verb">("ui-verb.look"),
        verb: "look",
        label: "LOOK",
        cursorId: "look",
        primary: true,
      },
    });
    history = executeUiSkinEditorCommand(project, fonts, history, {
      kind: "insert-verb",
      skinId: skin.id,
      index: 0,
      verb: {
        id: id<"ui-verb">("ui-verb.use"),
        verb: "use",
        label: "USE",
        cursorId: "use",
        primary: true,
      },
    });

    expect(history.document.manifest.skins[0]?.verbs.map((verb) => verb.verb)).toEqual(["use", "look"]);
    history = undoUiSkinEditorCommand(project, fonts, history);
    expect(history.document.manifest.skins[0]?.verbs.map((verb) => verb.verb)).toEqual(["look"]);
  });

  it("allows atomic default-skin migration and blocks invalid standalone removal", () => {
    const alternate = {
      ...skin,
      id: id<"ui-skin">("ui-skin.context.alternate"),
      name: "Context alternate",
      status: {
        ...skin.status,
        id: id<"ui-region">("ui-region.status.alternate"),
      },
    };
    let history = executeUiSkinEditorCommand(
      project,
      fonts,
      createUiSkinEditorHistory(project, fonts, manifest),
      {
        kind: "insert-skin",
        index: 1,
        skin: alternate,
      },
    );

    expect(() =>
      executeUiSkinEditorCommand(project, fonts, history, {
        kind: "remove-skin",
        skinId: skin.id,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<UiSkinEditorCommandError>>({
        code: "invalid-document",
      }),
    );

    history = executeUiSkinEditorCommand(project, fonts, history, {
      kind: "batch",
      commands: [
        { kind: "set-default-skin", skinId: alternate.id },
        { kind: "remove-skin", skinId: skin.id },
      ],
    });
    expect(history.document.manifest).toMatchObject({
      defaultSkinId: "ui-skin.context.alternate",
      skins: [{ id: "ui-skin.context.alternate" }],
    });
  });

  it("blocks missing fonts and native region overflow", () => {
    const current = manifest.skins[0]!;
    const history = createUiSkinEditorHistory(project, fonts, manifest);
    expect(() =>
      executeUiSkinEditorCommand(project, fonts, history, {
        kind: "replace-skin",
        skinId: current.id,
        skin: {
          ...current,
          status: {
            ...current.status,
            rect: { x: 0, y: 195, width: 320, height: 20 },
          },
          fonts: {
            ...current.fonts,
            status: {
              ...current.fonts.status,
              fontId: id<"bitmap-font">("bitmap-font.missing"),
            },
          },
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<UiSkinEditorCommandError>>({
        code: "invalid-document",
      }),
    );
  });
});

describe("interface skin editor command schema", () => {
  it("parses recursive skin and verb edits", () => {
    expect(
      parseUiSkinEditorCommand({
        kind: "batch",
        commands: [
          {
            kind: "replace-skin",
            skinId: skin.id,
            skin,
          },
          {
            kind: "insert-verb",
            skinId: skin.id,
            index: 0,
            verb: {
              id: "ui-verb.look",
              verb: "look",
              label: "LOOK",
              cursorId: "look",
              primary: true,
            },
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty batches", () => {
    expect(() => parseUiSkinEditorCommand({ kind: "batch", commands: [] })).toThrow();
  });
});
