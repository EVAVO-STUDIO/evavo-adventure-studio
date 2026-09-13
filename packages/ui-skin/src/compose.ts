import type { BitmapFontDefinition, BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { Id, Point, Rectangle, Size } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  RenderNode,
  ResolvedFrame,
  SolidRectangleRenderNode,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { UiColor, UiPanelStyle, UiRegion, UiSkin, UiTextStyle, UiVerb } from "./index.js";

export interface UiSpriteGeometry {
  readonly sourceRect: Rectangle;
  readonly originalSize: Size;
  readonly trimOffset: Point;
}

export interface UiAssetGeometryResolver {
  resolve(assetId: Id<"asset">, frameId: Id<"sprite-frame"> | null): UiSpriteGeometry | null;
}

export interface UiInventoryEntry {
  readonly itemId: Id<"item">;
  readonly name: string;
  readonly iconAssetId: Id<"asset">;
  readonly iconFrameId?: Id<"sprite-frame">;
}

export interface UiDialogueChoiceEntry {
  readonly choiceId: Id<"dialogue-choice">;
  readonly text: string;
  readonly enabled: boolean;
}

export interface UiRuntimeState {
  readonly statusText: string;
  readonly activeVerbId?: Id<"ui-verb">;
  readonly hoveredVerbId?: Id<"ui-verb">;
  readonly pressedVerbId?: Id<"ui-verb">;
  readonly disabledVerbIds?: readonly Id<"ui-verb">[];
  readonly inventory?: readonly UiInventoryEntry[];
  readonly selectedItemId?: Id<"item">;
  readonly score?: number;
  readonly maximumScore?: number;
  readonly parserText?: string;
  readonly parserCursorVisible?: boolean;
  readonly dialogueChoices?: readonly UiDialogueChoiceEntry[];
  readonly hoveredDialogueChoiceId?: Id<"dialogue-choice">;
  readonly verbCoinPosition?: Point;
}

export interface UiComposeOptions {
  readonly assets?: UiAssetGeometryResolver;
  readonly nodePrefix?: string;
}

export class UiSkinCompositionError extends Error {
  readonly code: "font-missing" | "icon-geometry-missing" | "inventory-geometry-missing";
  readonly path: string;

  constructor(code: UiSkinCompositionError["code"], path: string, message: string) {
    super(message);
    this.name = "UiSkinCompositionError";
    this.code = code;
    this.path = path;
  }
}

const renderNodeId = (value: string): Id<"render-node"> => value as Id<"render-node">;

const rgbaAlpha = (color: UiColor): number => (typeof color === "number" ? 1 : color[3] / 255);

const fontsById = (manifest: BitmapFontManifest): ReadonlyMap<string, BitmapFontDefinition> =>
  new Map(manifest.fonts.map((font) => [font.id as string, font] as const));

const requireFont = (
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  style: UiTextStyle,
  path: string,
): BitmapFontDefinition => {
  const font = fonts.get(style.fontId);
  if (!font) {
    throw new UiSkinCompositionError(
      "font-missing",
      path,
      `Bitmap font '${style.fontId}' is unavailable during UI composition.`,
    );
  }
  return font;
};

const rectangleNode = (
  id: string,
  rect: Rectangle,
  color: UiColor,
  zOffset: number,
  stableId = id,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: renderNodeId(id),
  order: {
    layer: "interface",
    elevation: 0,
    baselineY: rect.y + rect.height,
    zOffset,
    stableId,
  },
  transform: {
    position: { x: rect.x, y: rect.y },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: rgbaAlpha(color),
  visible: true,
  size: { width: rect.width, height: rect.height },
  color: typeof color === "number" ? color : [color[0], color[1], color[2], 255],
});

const panelNodes = (
  prefix: string,
  rect: Rectangle,
  panel: UiPanelStyle,
  zOffset: number,
): readonly SolidRectangleRenderNode[] => {
  const nodes: SolidRectangleRenderNode[] = [rectangleNode(`${prefix}.fill`, rect, panel.fill, zOffset)];
  const border = Math.min(panel.borderWidth, Math.floor(rect.width / 2), Math.floor(rect.height / 2));
  if (border > 0) {
    nodes.push(
      rectangleNode(
        `${prefix}.border.top`,
        { x: rect.x, y: rect.y, width: rect.width, height: border },
        panel.border,
        zOffset + 1,
      ),
      rectangleNode(
        `${prefix}.border.bottom`,
        {
          x: rect.x,
          y: rect.y + rect.height - border,
          width: rect.width,
          height: border,
        },
        panel.border,
        zOffset + 1,
      ),
      rectangleNode(
        `${prefix}.border.left`,
        { x: rect.x, y: rect.y, width: border, height: rect.height },
        panel.border,
        zOffset + 1,
      ),
      rectangleNode(
        `${prefix}.border.right`,
        {
          x: rect.x + rect.width - border,
          y: rect.y,
          width: border,
          height: rect.height,
        },
        panel.border,
        zOffset + 1,
      ),
    );
  }
  if (panel.accent !== undefined) {
    nodes.push(
      rectangleNode(
        `${prefix}.accent`,
        {
          x: rect.x + border,
          y: rect.y + border,
          width: Math.max(1, rect.width - border * 2),
          height: 1,
        },
        panel.accent,
        zOffset + 2,
      ),
    );
  }
  return nodes;
};

const textNode = (
  id: string,
  rect: Rectangle,
  text: string,
  style: UiTextStyle,
  font: BitmapFontDefinition,
  zOffset: number,
): BitmapTextRenderNode => ({
  kind: "bitmap-text",
  id: renderNodeId(id),
  order: {
    layer: "interface",
    elevation: 0,
    baselineY: rect.y + rect.height,
    zOffset,
    stableId: id,
  },
  transform: {
    position: { x: rect.x, y: rect.y },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: 1,
  visible: true,
  fontAssetId: font.atlasAssetId,
  fontId: font.id,
  text,
  maximumWidth: Math.max(1, rect.width),
  lineHeight: font.lineHeight,
  align: style.align,
  color: style.color,
  ...(style.outlineColor === undefined ? {} : { outlineColor: style.outlineColor }),
});

const contentRect = (region: UiRegion): Rectangle => ({
  x: region.rect.x + region.padding,
  y: region.rect.y + region.padding,
  width: Math.max(1, region.rect.width - region.padding * 2),
  height: Math.max(1, region.rect.height - region.padding * 2),
});

const buttonPanel = (skin: UiSkin, verb: UiVerb, state: UiRuntimeState): UiPanelStyle => {
  const bar = skin.verbBar;
  if (!bar) {
    throw new Error("Persistent verb button requested without a verb bar.");
  }
  if (state.disabledVerbIds?.includes(verb.id)) return bar.disabled;
  if (state.pressedVerbId === verb.id) return bar.pressed;
  if (state.hoveredVerbId === verb.id || state.activeVerbId === verb.id) {
    return bar.hover;
  }
  return bar.normal;
};

const buttonRects = (skin: UiSkin): readonly Rectangle[] => {
  const bar = skin.verbBar;
  if (!bar) return [];
  const content = contentRect(bar.region);
  const count = skin.verbs.length;
  if (count === 0) return [];

  if (bar.orientation === "vertical") {
    return skin.verbs.map((_, index) => ({
      x: content.x,
      y: content.y + index * (bar.buttonHeight + bar.gap),
      width: content.width,
      height: bar.buttonHeight,
    }));
  }

  const columns =
    bar.orientation === "grid" ? Math.max(1, bar.columns ?? Math.ceil(Math.sqrt(count))) : count;
  const rows = Math.ceil(count / columns);
  const width = Math.max(1, Math.floor((content.width - Math.max(0, columns - 1) * bar.gap) / columns));
  const height =
    bar.orientation === "horizontal"
      ? Math.min(content.height, bar.buttonHeight)
      : Math.max(
          1,
          Math.min(bar.buttonHeight, Math.floor((content.height - Math.max(0, rows - 1) * bar.gap) / rows)),
        );
  return skin.verbs.map((_, index) => ({
    x: content.x + (index % columns) * (width + bar.gap),
    y: content.y + Math.floor(index / columns) * (height + bar.gap),
    width,
    height,
  }));
};

const iconNode = (
  id: string,
  assetId: Id<"asset">,
  frameId: Id<"sprite-frame"> | null,
  geometry: UiSpriteGeometry,
  rect: Rectangle,
  zOffset: number,
): SpriteRenderNode => {
  const x = rect.x + Math.floor((rect.width - geometry.originalSize.width) / 2);
  const y = rect.y + Math.floor((rect.height - geometry.originalSize.height) / 2);
  return {
    kind: "sprite",
    id: renderNodeId(id),
    order: {
      layer: "interface",
      elevation: 0,
      baselineY: rect.y + rect.height,
      zOffset,
      stableId: id,
    },
    transform: {
      position: { x, y },
      pivot: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotationRadians: 0,
    },
    opacity: 1,
    visible: true,
    assetId,
    ...(frameId ? { frameId } : {}),
    sourceRect: geometry.sourceRect,
    originalSize: geometry.originalSize,
    trimOffset: geometry.trimOffset,
    sampling: "nearest",
  };
};

const composeStatus = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  prefix: string,
): readonly RenderNode[] => {
  const region = skin.status;
  const style = skin.fonts.status;
  const font = requireFont(fonts, style, "fonts.status");
  return [
    ...panelNodes(`${prefix}.status`, region.rect, region.panel, 0),
    textNode(`${prefix}.status.text`, contentRect(region), state.statusText, style, font, 3),
  ];
};

const composeScore = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  prefix: string,
): readonly RenderNode[] => {
  if (!skin.score || !skin.fonts.score || state.score === undefined) return [];
  const font = requireFont(fonts, skin.fonts.score, "fonts.score");
  const suffix = state.maximumScore === undefined ? `${state.score}` : `${state.score}/${state.maximumScore}`;
  return [
    ...panelNodes(`${prefix}.score`, skin.score.rect, skin.score.panel, 10),
    textNode(`${prefix}.score.text`, contentRect(skin.score), suffix, skin.fonts.score, font, 13),
  ];
};

const composeVerbBar = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  assets: UiAssetGeometryResolver | undefined,
  prefix: string,
): readonly RenderNode[] => {
  const verbTextStyle = skin.fonts.verb;
  if (!skin.verbBar || !verbTextStyle) return [];
  const nodes: RenderNode[] = [
    ...panelNodes(`${prefix}.verbs`, skin.verbBar.region.rect, skin.verbBar.region.panel, 20),
  ];
  const font = requireFont(fonts, verbTextStyle, "fonts.verb");
  const rects = buttonRects(skin);
  skin.verbs.forEach((verb, index) => {
    const rect = rects[index];
    if (!rect) return;
    nodes.push(...panelNodes(`${prefix}.verb.${verb.id}`, rect, buttonPanel(skin, verb, state), 23));
    if (verb.iconAssetId) {
      const geometry = assets?.resolve(verb.iconAssetId, verb.iconFrameId ?? null);
      if (!geometry) {
        throw new UiSkinCompositionError(
          "icon-geometry-missing",
          `verbs[${index}].iconAssetId`,
          `Verb '${verb.id}' icon geometry is unavailable.`,
        );
      }
      nodes.push(
        iconNode(
          `${prefix}.verb.${verb.id}.icon`,
          verb.iconAssetId,
          verb.iconFrameId ?? null,
          geometry,
          rect,
          26,
        ),
      );
    } else {
      nodes.push(
        textNode(
          `${prefix}.verb.${verb.id}.label`,
          {
            x: rect.x + 2,
            y: rect.y + Math.max(0, Math.floor((rect.height - font.lineHeight) / 2)),
            width: Math.max(1, rect.width - 4),
            height: font.lineHeight,
          },
          verb.label,
          verbTextStyle,
          font,
          26,
        ),
      );
    }
  });
  return nodes;
};

const composeInventory = (
  skin: UiSkin,
  state: UiRuntimeState,
  assets: UiAssetGeometryResolver | undefined,
  prefix: string,
): readonly RenderNode[] => {
  if (!skin.inventory) return [];
  const inventory = skin.inventory;
  const nodes: RenderNode[] = [
    ...panelNodes(`${prefix}.inventory`, inventory.region.rect, inventory.region.panel, 30),
  ];
  const entries = (state.inventory ?? []).slice(0, inventory.visibleSlots);
  const content = contentRect(inventory.region);
  for (let index = 0; index < inventory.visibleSlots; index += 1) {
    const entry = entries[index];
    const rect = {
      x: content.x + index * (inventory.slotWidth + inventory.gap),
      y: content.y,
      width: inventory.slotWidth,
      height: inventory.slotHeight,
    };
    nodes.push(
      ...panelNodes(
        `${prefix}.inventory.slot.${index}`,
        rect,
        entry && state.selectedItemId === entry.itemId ? inventory.selected : inventory.slot,
        33,
      ),
    );
    if (!entry) continue;
    const geometry = assets?.resolve(entry.iconAssetId, entry.iconFrameId ?? null);
    if (!geometry) {
      throw new UiSkinCompositionError(
        "inventory-geometry-missing",
        `inventory[${index}].iconAssetId`,
        `Inventory item '${entry.itemId}' icon geometry is unavailable.`,
      );
    }
    nodes.push(
      iconNode(
        `${prefix}.inventory.item.${entry.itemId}`,
        entry.iconAssetId,
        entry.iconFrameId ?? null,
        geometry,
        rect,
        36,
      ),
    );
  }
  return nodes;
};

const composeParser = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  prefix: string,
): readonly RenderNode[] => {
  if (!skin.parser || !skin.fonts.parser) return [];
  const font = requireFont(fonts, skin.fonts.parser, "fonts.parser");
  const cursor = state.parserCursorVisible === false ? "" : skin.parser.cursorCharacter;
  return [
    ...panelNodes(`${prefix}.parser`, skin.parser.region.rect, skin.parser.region.panel, 40),
    textNode(
      `${prefix}.parser.text`,
      contentRect(skin.parser.region),
      `${skin.parser.prompt}${state.parserText ?? ""}${cursor}`,
      skin.fonts.parser,
      font,
      43,
    ),
  ];
};

const composeDialogueChoices = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  prefix: string,
): readonly RenderNode[] => {
  const dialogueChoices = skin.dialogueChoices;
  const dialogueTextStyle = skin.fonts.dialogue;
  if (!dialogueChoices || !dialogueTextStyle) return [];
  const choices = (state.dialogueChoices ?? []).slice(0, dialogueChoices.maximumChoices);
  if (choices.length === 0) return [];
  const font = requireFont(fonts, dialogueTextStyle, "fonts.dialogue");
  const region = dialogueChoices.region;
  const content = contentRect(region);
  const height = Math.max(
    font.lineHeight + 4,
    Math.floor((content.height - (choices.length - 1) * dialogueChoices.gap) / choices.length),
  );
  const nodes: RenderNode[] = [...panelNodes(`${prefix}.dialogue`, region.rect, region.panel, 50)];
  choices.forEach((choice, index) => {
    const rect = {
      x: content.x,
      y: content.y + index * (height + dialogueChoices.gap),
      width: content.width,
      height,
    };
    const panel = !choice.enabled
      ? dialogueChoices.disabled
      : state.hoveredDialogueChoiceId === choice.choiceId
        ? dialogueChoices.hover
        : dialogueChoices.normal;
    nodes.push(
      ...panelNodes(`${prefix}.dialogue.choice.${choice.choiceId}`, rect, panel, 53),
      textNode(
        `${prefix}.dialogue.choice.${choice.choiceId}.text`,
        {
          x: rect.x + 3,
          y: rect.y + 2,
          width: Math.max(1, rect.width - 6),
          height: Math.max(1, rect.height - 4),
        },
        choice.text,
        dialogueTextStyle,
        font,
        56,
      ),
    );
  });
  return nodes;
};

const composeVerbCoin = (
  skin: UiSkin,
  fonts: ReadonlyMap<string, BitmapFontDefinition>,
  state: UiRuntimeState,
  prefix: string,
): readonly RenderNode[] => {
  const verbCoin = skin.verbCoin;
  const verbTextStyle = skin.fonts.verb;
  const position = state.verbCoinPosition;
  if (!verbCoin || !verbTextStyle || !position) return [];
  const font = requireFont(fonts, verbTextStyle, "fonts.verb");
  const nodes: RenderNode[] = [];
  const count = skin.verbs.length;
  skin.verbs.forEach((verb, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
    const centerX = Math.round(position.x + Math.cos(angle) * verbCoin.radius);
    const centerY = Math.round(position.y + Math.sin(angle) * verbCoin.radius);
    const size = verbCoin.itemRadius * 2;
    const rect = {
      x: centerX - verbCoin.itemRadius,
      y: centerY - verbCoin.itemRadius,
      width: size,
      height: size,
    };
    nodes.push(
      ...panelNodes(`${prefix}.coin.${verb.id}`, rect, verbCoin.panel, 60),
      textNode(
        `${prefix}.coin.${verb.id}.text`,
        {
          x: rect.x + 2,
          y: rect.y + Math.max(1, Math.floor((rect.height - font.lineHeight) / 2)),
          width: Math.max(1, rect.width - 4),
          height: font.lineHeight,
        },
        verb.label,
        verbTextStyle,
        font,
        63,
      ),
    );
  });
  return nodes;
};

export const composeUiSkinNodes = (
  skin: UiSkin,
  bitmapFonts: BitmapFontManifest,
  state: UiRuntimeState,
  options: UiComposeOptions = {},
): readonly RenderNode[] => {
  const fonts = fontsById(bitmapFonts);
  const prefix = options.nodePrefix ?? `ui.${skin.id}`;
  return [
    ...composeStatus(skin, fonts, state, prefix),
    ...composeScore(skin, fonts, state, prefix),
    ...composeVerbBar(skin, fonts, state, options.assets, prefix),
    ...composeInventory(skin, state, options.assets, prefix),
    ...composeParser(skin, fonts, state, prefix),
    ...composeDialogueChoices(skin, fonts, state, prefix),
    ...composeVerbCoin(skin, fonts, state, prefix),
  ];
};

export const appendUiSkinFrame = (
  frame: ResolvedFrame,
  skin: UiSkin,
  bitmapFonts: BitmapFontManifest,
  state: UiRuntimeState,
  options: UiComposeOptions = {},
): ResolvedFrame => ({
  ...frame,
  nodes: [...frame.nodes, ...composeUiSkinNodes(skin, bitmapFonts, state, options)],
});
