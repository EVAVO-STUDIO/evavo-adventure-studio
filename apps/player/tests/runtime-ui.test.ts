import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import type { UiSkin } from "@evavo/adventure-ui-skin";
import {
  appendRuntimeInterface,
  createRuntimeUiGeometryResolver,
  runtimeUiState,
} from "../src/runtime-ui.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const font = {
  manifestVersion: 1,
  projectId: id<"project">("project.runtime-ui"),
  fonts: [
    {
      id: id<"bitmap-font">("bitmap-font.dialogue"),
      name: "Dialogue",
      atlasAssetId: id<"asset">("asset.font"),
      lineHeight: 8,
      baseline: 7,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: [
        {
          id: id<"font-glyph">("font-glyph.question"),
          codePoint: 63,
          sourceRect: { x: 0, y: 0, width: 4, height: 7 },
          bearing: { x: 0, y: -7 },
          advance: 5,
        },
      ],
      kernings: [],
    },
  ],
} as const;

const skin: UiSkin = {
  id: id<"ui-skin">("ui-skin.context"),
  name: "Context",
  interactionMode: "context",
  nativeSize: { width: 320, height: 200 },
  status: {
    id: id<"ui-region">("ui-region.status"),
    rect: { x: 0, y: 184, width: 320, height: 16 },
    padding: 3,
    panel: { fill: 0x08090e, border: 0xff244e, borderWidth: 1 },
  },
  verbs: [
    {
      id: id<"ui-verb">("ui-verb.look"),
      verb: "look",
      label: "LOOK",
      cursorId: "look",
      primary: true,
    },
  ],
  inventory: {
    region: {
      id: id<"ui-region">("ui-region.inventory"),
      rect: { x: 0, y: 150, width: 320, height: 32 },
      padding: 2,
      panel: { fill: 0x08090e, border: 0x343946, borderWidth: 1 },
    },
    slotWidth: 24,
    slotHeight: 24,
    gap: 2,
    visibleSlots: 4,
    slot: { fill: 0x11131a, border: 0x343946, borderWidth: 1 },
    selected: { fill: 0x4a1d2c, border: 0xff244e, borderWidth: 1 },
  },
  fonts: {
    status: {
      fontId: id<"bitmap-font">("bitmap-font.dialogue"),
      color: 0xffffff,
      align: "left",
    },
  },
};

const assets = [
  {
    assetId: id<"asset">("asset.font"),
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
    metadata: { kind: "image", width: 16, height: 8, palette: true, colourCount: 2 },
  },
  {
    assetId: id<"asset">("asset.notebook"),
    kind: "image",
    outputFiles: [
      {
        role: "primary",
        runtimePath: "assets/notebook.png",
        mediaType: "image/png",
        sha256: hash,
        byteLength: 1,
      },
    ],
    metadata: { kind: "image", width: 14, height: 14, palette: true, colourCount: 8 },
  },
] as RuntimeBundle["assets"];

const bundle = {
  projectId: id<"project">("project.runtime-ui"),
  assets,
  inventoryItems: [
    {
      id: id<"item">("item.notebook"),
      name: "Notebook",
      description: "Notes",
      iconAssetId: id<"asset">("asset.notebook"),
    },
  ],
  bitmapFonts: font,
  uiSkins: {
    manifestVersion: 1,
    projectId: id<"project">("project.runtime-ui"),
    defaultSkinId: skin.id,
    skins: [skin],
  },
} as unknown as RuntimeBundle;

const world = {
  story: {
    inventory: [id<"item">("item.notebook")],
    score: 14,
  },
} as unknown as InteractiveRuntimeWorldState;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [],
};

describe("packaged runtime interface", () => {
  it("resolves image geometry and maps canonical runtime state", () => {
    const resolver = createRuntimeUiGeometryResolver(bundle);
    expect(resolver.resolve(id<"asset">("asset.notebook"), null)).toEqual({
      sourceRect: { x: 0, y: 0, width: 14, height: 14 },
      originalSize: { width: 14, height: 14 },
      trimOffset: { x: 0, y: 0 },
    });

    expect(
      runtimeUiState(bundle, world, skin, "LEDGER MISSING", {
        position: null,
        cursorId: "look",
        pressed: false,
      }),
    ).toMatchObject({
      statusText: "LEDGER MISSING",
      activeVerbId: "ui-verb.look",
      score: 14,
      inventory: [{ itemId: "item.notebook", iconAssetId: "asset.notebook" }],
    });
  });

  it("appends selected skin nodes and preserves legacy fallback", () => {
    const composed = appendRuntimeInterface(
      frame,
      bundle,
      world,
      "LEDGER MISSING",
      { position: null, cursorId: "walk", pressed: false },
    );
    expect(composed.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "runtime.ui.status.fill",
        "runtime.ui.status.text",
        "runtime.ui.inventory.item.item.notebook",
      ]),
    );

    const legacy = {
      ...bundle,
      bitmapFonts: undefined,
      uiSkins: undefined,
    } as unknown as RuntimeBundle;
    expect(
      appendRuntimeInterface(
        frame,
        legacy,
        world,
        "LEGACY",
        { position: null, cursorId: "walk", pressed: false },
      ),
    ).toBe(frame);
  });
});
