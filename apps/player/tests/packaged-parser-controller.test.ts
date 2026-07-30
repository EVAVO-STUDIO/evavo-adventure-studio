import { describe, expect, it } from "vitest";
import { createReplayLog, executeReplay } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createPackagedRuntimeController } from "../src/packaged-controller.js";

const hash = "0".repeat(64);

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.parser-controller",
  title: "Parser Controller",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "parser-assisted",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
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
        colourCount: 16,
      },
    },
    {
      assetId: "asset.font",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/font.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 8,
        height: 8,
        palette: true,
        colourCount: 2,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.office",
      name: "Rainy Office",
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
      interactionIndex: {},
    },
  ],
  dialogues: [],
  sequences: [],
  bitmapFonts: {
    manifestVersion: 1,
    projectId: "project.parser-controller",
    fonts: [
      {
        id: "bitmap-font.ui",
        name: "UI",
        atlasAssetId: "asset.font",
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
  },
  uiSkins: {
    manifestVersion: 1,
    projectId: "project.parser-controller",
    defaultSkinId: "ui-skin.parser",
    skins: [
      {
        id: "ui-skin.parser",
        name: "Parser",
        interactionMode: "parser-assisted",
        nativeSize: { width: 320, height: 200 },
        status: {
          id: "ui-region.status",
          rect: { x: 0, y: 0, width: 320, height: 16 },
          padding: 2,
          panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
        },
        verbs: [],
        parser: {
          region: {
            id: "ui-region.parser",
            rect: { x: 0, y: 164, width: 320, height: 36 },
            padding: 4,
            panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
          },
          prompt: "> ",
          cursorCharacter: "_",
          historyLimit: 20,
        },
        fonts: {
          status: {
            fontId: "bitmap-font.ui",
            color: 0xffffff,
            align: "left",
          },
          parser: {
            fontId: "bitmap-font.ui",
            color: 0xffffff,
            align: "left",
          },
        },
      },
    ],
  },
});

describe("packaged parser controller", () => {
  it("renders live parser input and submits command history", () => {
    const controller = createPackagedRuntimeController(bundle);

    expect(controller.handleKey({ kind: "focus" })).toBe(true);
    expect(controller.handleKey({ kind: "text", text: "help" })).toBe(true);

    const editingFrame = controller.createFrame(0);
    expect(
      editingFrame.nodes.find((node) => node.id === "runtime.ui.parser.text"),
    ).toMatchObject({
      kind: "bitmap-text",
      text: "> help_",
    });

    expect(controller.handleKey({ kind: "submit" })).toBe(true);
    expect(controller.statusText()).toContain("LOOK");
    expect(controller.parserState()).toMatchObject({
      text: "",
      history: ["help"],
      focused: true,
    });

    expect(controller.handleKey({ kind: "history-previous" })).toBe(true);
    expect(controller.parserState().text).toBe("help");
  });

  it("restores deliberate interface state and the exact logical tick", () => {
    const controller = createPackagedRuntimeController(bundle);
    controller.handleKey({ kind: "focus" });
    controller.handleKey({ kind: "text", text: "help" });
    controller.handleKey({ kind: "submit" });
    controller.createFrame(24);

    const savedStatus = controller.statusText();
    const save = controller.createSaveGame();

    controller.handleKey({ kind: "text", text: "inventory" });
    controller.handleKey({ kind: "submit" });
    controller.createFrame(48);
    expect(controller.parserState().history).toEqual(["help", "inventory"]);

    const restoredTick = controller.restoreSaveGame(save);

    expect(restoredTick).toBe(24);
    expect(controller.worldState().story.tick).toBe(24);
    expect(controller.statusText()).toBe(savedStatus);
    expect(controller.parserState()).toEqual({
      text: "",
      history: ["help"],
      historyIndex: null,
      draftBeforeHistory: "",
      focused: false,
    });
    expect(() => controller.createFrame(25)).not.toThrow();
  });

  it("replays the real packaged controller to an identical save fingerprint", () => {
    const uninterrupted = createPackagedRuntimeController(bundle);
    const initialSave = uninterrupted.createSaveGame();

    uninterrupted.handleKey({ kind: "focus" });
    uninterrupted.handleKey({ kind: "text", text: "help" });
    uninterrupted.createFrame(1);
    uninterrupted.handleKey({ kind: "submit" });
    uninterrupted.createFrame(10);
    const expected = uninterrupted.createSaveGame();

    const replay = createReplayLog(bundle, initialSave, {
      events: [
        {
          kind: "parser-key",
          tick: 0,
          sequence: 0,
          input: { kind: "focus" },
        },
        {
          kind: "parser-key",
          tick: 0,
          sequence: 1,
          input: { kind: "text", text: "help" },
        },
        {
          kind: "parser-key",
          tick: 1,
          sequence: 2,
          input: { kind: "submit" },
        },
      ],
      finalTick: 10,
      expectedFinalSaveFingerprint: expected.saveFingerprint,
    });

    const replayed = executeReplay(
      bundle,
      replay,
      createPackagedRuntimeController(bundle),
    );

    expect(replayed.finalSaveFingerprint).toBe(expected.saveFingerprint);
    expect(replayed.finalSave).toEqual(expected);
  });
});
