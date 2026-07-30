import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { UiRuntimeState } from "../src/compose.js";
import type { UiSkin } from "../src/index.js";
import {
  hitTestUiSkin,
  uiInventorySlotRects,
  uiVerbButtonRects,
  uiVerbCoinRects,
} from "../src/hit-testing.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const panel = { fill: 0, border: 0xffffff, borderWidth: 1 } as const;

const fonts = {
  manifestVersion: 1,
  projectId: id<"project">("project.ui-hit"),
  fonts: [
    {
      id: id<"bitmap-font">("bitmap-font.ui"),
      name: "UI",
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
} as BitmapFontManifest;

const verb = (name: string) => ({
  id: id<"ui-verb">(`ui-verb.${name}`),
  verb: name,
  label: name.toUpperCase(),
  cursorId: name,
  primary: false,
});

const skin = {
  id: id<"ui-skin">("ui-skin.hit"),
  name: "Hit",
  interactionMode: "verb-list",
  nativeSize: { width: 320, height: 200 },
  status: {
    id: id<"ui-region">("ui-region.status"),
    rect: { x: 0, y: 0, width: 320, height: 16 },
    padding: 2,
    panel,
  },
  verbs: [verb("look"), verb("use")],
  verbBar: {
    region: {
      id: id<"ui-region">("ui-region.verbs"),
      rect: { x: 0, y: 160, width: 120, height: 40 },
      padding: 2,
      panel,
    },
    orientation: "horizontal",
    gap: 2,
    buttonHeight: 30,
    normal: panel,
    hover: panel,
    pressed: panel,
    disabled: panel,
  },
  inventory: {
    region: {
      id: id<"ui-region">("ui-region.inventory"),
      rect: { x: 124, y: 160, width: 196, height: 40 },
      padding: 2,
      panel,
    },
    slotWidth: 28,
    slotHeight: 30,
    gap: 2,
    visibleSlots: 4,
    slot: panel,
    selected: panel,
  },
  fonts: {
    status: {
      fontId: id<"bitmap-font">("bitmap-font.ui"),
      color: 0xffffff,
      align: "left",
    },
    verb: {
      fontId: id<"bitmap-font">("bitmap-font.ui"),
      color: 0xffffff,
      align: "center",
    },
  },
} as UiSkin;

const state: UiRuntimeState = {
  statusText: "READY",
  inventory: [
    {
      itemId: id<"item">("item.key"),
      name: "Key",
      iconAssetId: id<"asset">("asset.key"),
    },
  ],
};

describe("interface skin hit testing", () => {
  it("hits persistent verb buttons and inventory slots", () => {
    const verbRect = uiVerbButtonRects(skin)[0]!;
    expect(
      hitTestUiSkin(skin, fonts, state, {
        x: verbRect.x + 1,
        y: verbRect.y + 1,
      }),
    ).toMatchObject({ kind: "verb", verb: { id: "ui-verb.look" } });

    const slotRect = uiInventorySlotRects(skin)[0]!;
    expect(
      hitTestUiSkin(skin, fonts, state, {
        x: slotRect.x + 1,
        y: slotRect.y + 1,
      }),
    ).toEqual({
      kind: "inventory-slot",
      slotIndex: 0,
      itemId: "item.key",
    });
  });

  it("prioritizes dialogue and coin targets above ordinary regions", () => {
    const { verbBar: _verbBar, ...skinWithoutBar } = skin;
    const coinSkin = {
      ...skinWithoutBar,
      interactionMode: "verb-coin",
      verbCoin: { radius: 34, itemRadius: 16, panel },
      dialogueChoices: {
        region: {
          id: id<"ui-region">("ui-region.dialogue"),
          rect: { x: 40, y: 40, width: 240, height: 50 },
          padding: 2,
          panel,
        },
        gap: 2,
        maximumChoices: 2,
        normal: panel,
        hover: panel,
        disabled: panel,
      },
      fonts: {
        ...skin.fonts,
        dialogue: {
          fontId: id<"bitmap-font">("bitmap-font.ui"),
          color: 0xffffff,
          align: "left",
        },
      },
    } as UiSkin;
    const coinState: UiRuntimeState = {
      ...state,
      verbCoinPosition: { x: 160, y: 110 },
      dialogueChoices: [
        {
          choiceId: id<"dialogue-choice">("choice.one"),
          text: "ONE",
          enabled: true,
        },
      ],
    };

    expect(
      hitTestUiSkin(coinSkin, fonts, coinState, { x: 42, y: 42 }),
    ).toEqual({
      kind: "dialogue-choice",
      choiceId: "choice.one",
      enabled: true,
    });

    const coinRect = uiVerbCoinRects(coinSkin, coinState)[0]!;
    expect(
      hitTestUiSkin(coinSkin, fonts, coinState, {
        x: coinRect.x + 1,
        y: coinRect.y + 1,
      }),
    ).toMatchObject({ kind: "verb-coin", verb: { id: "ui-verb.look" } });
  });
});
