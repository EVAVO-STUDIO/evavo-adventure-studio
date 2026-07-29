import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  parseUiSkinManifest,
  type UiPanelStyle,
  type UiSkinManifest,
  type UiTextStyle,
} from "@evavo/adventure-ui-skin";
import { studioBitmapFonts, studioFontProject } from "./font-fixture.js";

export const studioUiProject = parseAdventureProject({
  ...studioFontProject,
  assets: [
    ...studioFontProject.assets,
    {
      id: "asset.ui.icons",
      path: "art/ui/action-icons.png",
      kind: "image",
    },
    {
      id: "asset.inventory.notebook",
      path: "art/ui/notebook-icon.png",
      kind: "image",
    },
    {
      id: "asset.inventory.key",
      path: "art/ui/key-icon.png",
      kind: "image",
    },
  ],
  inventoryItems: [
    {
      id: "item.notebook",
      name: "Notebook",
      description: "Rain-softened case notes.",
      iconAssetId: "asset.inventory.notebook",
    },
    {
      id: "item.office-key",
      name: "Office key",
      description: "A brass key marked 4B.",
      iconAssetId: "asset.inventory.key",
    },
  ],
});

export const studioUiBitmapFonts = studioBitmapFonts;

const PANEL: UiPanelStyle = {
  fill: [8, 10, 16, 244],
  border: 0x343946,
  borderWidth: 1,
  accent: 0xff244e,
};

const BUTTON: UiPanelStyle = {
  fill: 0x1a1d27,
  border: 0x3a3f4d,
  borderWidth: 1,
};

const BUTTON_HOVER: UiPanelStyle = {
  fill: 0x2a2230,
  border: 0xff6b88,
  borderWidth: 1,
  accent: 0xff244e,
};

const BUTTON_PRESSED: UiPanelStyle = {
  fill: 0x4a1d2c,
  border: 0xff8aa1,
  borderWidth: 1,
};

const BUTTON_DISABLED: UiPanelStyle = {
  fill: 0x11131a,
  border: 0x292d37,
  borderWidth: 1,
};

const STATUS_TEXT: UiTextStyle = {
  fontId: "bitmap-font.dialogue",
  color: 0xf3f4f7,
  outlineColor: 0x040508,
  align: "left",
};

const CENTER_TEXT: UiTextStyle = {
  ...STATUS_TEXT,
  align: "center",
};

const statusRegion = (id: string, width = 240) => ({
  id,
  rect: { x: 0, y: 0, width, height: 16 },
  padding: 3,
  panel: PANEL,
});

const scoreRegion = (id: string) => ({
  id,
  rect: { x: 240, y: 0, width: 80, height: 16 },
  padding: 3,
  panel: PANEL,
});

const inventoryRegion = (id: string, y: number, height: number) => ({
  region: {
    id,
    rect: { x: 0, y, width: 320, height },
    padding: 3,
    panel: PANEL,
  },
  slotWidth: 28,
  slotHeight: Math.max(18, height - 6),
  gap: 3,
  visibleSlots: 8,
  slot: BUTTON,
  selected: BUTTON_HOVER,
});

const verb = (
  prefix: string,
  id: string,
  label: string,
  shortcut: string,
  primary = false,
) => ({
  id: `ui-verb.${prefix}.${id}`,
  verb: id,
  label,
  cursorId: id,
  shortcut,
  primary,
});

const bar = (
  id: string,
  rect: { x: number; y: number; width: number; height: number },
  orientation: "horizontal" | "vertical" | "grid",
  buttonHeight: number,
  columns?: number,
) => ({
  region: { id, rect, padding: 3, panel: PANEL },
  orientation,
  gap: 3,
  ...(columns === undefined ? {} : { columns }),
  buttonHeight,
  normal: BUTTON,
  hover: BUTTON_HOVER,
  pressed: BUTTON_PRESSED,
  disabled: BUTTON_DISABLED,
});

const commonFonts = {
  status: STATUS_TEXT,
  score: CENTER_TEXT,
};

export const studioUiSkins: UiSkinManifest = parseUiSkinManifest({
  manifestVersion: 1,
  projectId: studioUiProject.id,
  defaultSkinId: "ui-skin.context-noir",
  skins: [
    {
      id: "ui-skin.context-noir",
      name: "Context Noir",
      interactionMode: "context",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.context.status"),
      score: scoreRegion("ui-region.context.score"),
      verbs: [],
      inventory: inventoryRegion("ui-region.context.inventory", 164, 36),
      dialogueChoices: {
        region: {
          id: "ui-region.context.dialogue",
          rect: { x: 20, y: 104, width: 280, height: 56 },
          padding: 4,
          panel: PANEL,
        },
        gap: 3,
        maximumChoices: 4,
        normal: BUTTON,
        hover: BUTTON_HOVER,
        disabled: BUTTON_DISABLED,
      },
      fonts: {
        ...commonFonts,
        inventory: STATUS_TEXT,
        dialogue: STATUS_TEXT,
      },
    },
    {
      id: "ui-skin.verb-list",
      name: "Verb List",
      interactionMode: "verb-list",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.verb-list.status"),
      score: scoreRegion("ui-region.verb-list.score"),
      verbs: [
        verb("list", "look", "LOOK", "L", true),
        verb("list", "use", "USE", "U", true),
        verb("list", "talk", "TALK", "T"),
        verb("list", "take", "TAKE", "G"),
        verb("list", "open", "OPEN", "O"),
        verb("list", "push", "PUSH", "P"),
      ],
      verbBar: bar(
        "ui-region.verb-list.verbs",
        { x: 0, y: 146, width: 178, height: 54 },
        "grid",
        20,
        3,
      ),
      inventory: {
        ...inventoryRegion("ui-region.verb-list.inventory", 146, 54),
        region: {
          id: "ui-region.verb-list.inventory",
          rect: { x: 182, y: 146, width: 138, height: 54 },
          padding: 3,
          panel: PANEL,
        },
        visibleSlots: 4,
      },
      fonts: {
        ...commonFonts,
        verb: CENTER_TEXT,
        inventory: STATUS_TEXT,
      },
    },
    {
      id: "ui-skin.icon-bar",
      name: "Icon Bar",
      interactionMode: "icon-bar",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.icon.status"),
      score: scoreRegion("ui-region.icon.score"),
      verbs: [
        {
          ...verb("icon", "look", "LOOK", "L", true),
          iconAssetId: "asset.ui.icons",
        },
        {
          ...verb("icon", "use", "USE", "U", true),
          iconAssetId: "asset.ui.icons",
        },
        {
          ...verb("icon", "talk", "TALK", "T"),
          iconAssetId: "asset.ui.icons",
        },
        {
          ...verb("icon", "take", "TAKE", "G"),
          iconAssetId: "asset.ui.icons",
        },
      ],
      verbBar: bar(
        "ui-region.icon.verbs",
        { x: 0, y: 16, width: 320, height: 38 },
        "horizontal",
        30,
      ),
      inventory: inventoryRegion("ui-region.icon.inventory", 164, 36),
      fonts: {
        ...commonFonts,
        verb: CENTER_TEXT,
        inventory: STATUS_TEXT,
      },
    },
    {
      id: "ui-skin.two-button",
      name: "Two Button",
      interactionMode: "two-button",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.two-button.status"),
      score: scoreRegion("ui-region.two-button.score"),
      verbs: [
        verb("two", "look", "LOOK", "L", true),
        verb("two", "use", "USE", "U", true),
      ],
      verbBar: bar(
        "ui-region.two-button.verbs",
        { x: 0, y: 164, width: 116, height: 36 },
        "horizontal",
        28,
      ),
      inventory: {
        ...inventoryRegion("ui-region.two-button.inventory", 164, 36),
        region: {
          id: "ui-region.two-button.inventory",
          rect: { x: 120, y: 164, width: 200, height: 36 },
          padding: 3,
          panel: PANEL,
        },
        visibleSlots: 6,
      },
      fonts: {
        ...commonFonts,
        verb: CENTER_TEXT,
        inventory: STATUS_TEXT,
      },
    },
    {
      id: "ui-skin.verb-coin",
      name: "Verb Coin",
      interactionMode: "verb-coin",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.coin.status"),
      score: scoreRegion("ui-region.coin.score"),
      verbs: [
        verb("coin", "look", "LOOK", "L", true),
        verb("coin", "use", "USE", "U", true),
        verb("coin", "talk", "TALK", "T"),
        verb("coin", "take", "TAKE", "G"),
      ],
      verbCoin: {
        radius: 40,
        itemRadius: 18,
        panel: BUTTON_HOVER,
      },
      inventory: inventoryRegion("ui-region.coin.inventory", 164, 36),
      fonts: {
        ...commonFonts,
        verb: CENTER_TEXT,
        inventory: STATUS_TEXT,
      },
    },
    {
      id: "ui-skin.parser-assisted",
      name: "Parser Assisted",
      interactionMode: "parser-assisted",
      nativeSize: { width: 320, height: 200 },
      status: statusRegion("ui-region.parser.status"),
      score: scoreRegion("ui-region.parser.score"),
      verbs: [],
      inventory: inventoryRegion("ui-region.parser.inventory", 128, 32),
      parser: {
        region: {
          id: "ui-region.parser.input",
          rect: { x: 0, y: 164, width: 320, height: 36 },
          padding: 5,
          panel: PANEL,
        },
        prompt: "> ",
        cursorCharacter: "_",
        historyLimit: 20,
      },
      fonts: {
        ...commonFonts,
        inventory: STATUS_TEXT,
        parser: STATUS_TEXT,
      },
    },
  ],
});
