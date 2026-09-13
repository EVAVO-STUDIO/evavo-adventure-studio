import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { Id, Point, Rectangle } from "@evavo/adventure-project-schema";
import type { UiRuntimeState } from "./compose.js";
import type { UiSkin, UiVerb } from "./index.js";

export type UiHitTarget =
  | { readonly kind: "verb"; readonly verb: UiVerb }
  | {
      readonly kind: "inventory-slot";
      readonly slotIndex: number;
      readonly itemId: Id<"item"> | null;
    }
  | { readonly kind: "parser" }
  | {
      readonly kind: "dialogue-choice";
      readonly choiceId: Id<"dialogue-choice">;
      readonly enabled: boolean;
    }
  | { readonly kind: "verb-coin"; readonly verb: UiVerb };

const containsPoint = (rect: Rectangle, point: Point): boolean =>
  point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;

const contentRect = (region: { readonly rect: Rectangle; readonly padding: number }): Rectangle => ({
  x: region.rect.x + region.padding,
  y: region.rect.y + region.padding,
  width: Math.max(1, region.rect.width - region.padding * 2),
  height: Math.max(1, region.rect.height - region.padding * 2),
});

export const uiVerbButtonRects = (skin: UiSkin): readonly Rectangle[] => {
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

export const uiInventorySlotRects = (skin: UiSkin): readonly Rectangle[] => {
  const inventory = skin.inventory;
  if (!inventory) return [];
  const content = contentRect(inventory.region);
  return Array.from({ length: inventory.visibleSlots }, (_, index) => ({
    x: content.x + index * (inventory.slotWidth + inventory.gap),
    y: content.y,
    width: inventory.slotWidth,
    height: inventory.slotHeight,
  }));
};

const fontLineHeight = (fonts: BitmapFontManifest, fontId: Id<"bitmap-font">): number =>
  fonts.fonts.find((font) => font.id === fontId)?.lineHeight ?? 1;

export const uiDialogueChoiceRects = (
  skin: UiSkin,
  fonts: BitmapFontManifest,
  state: UiRuntimeState,
): readonly Rectangle[] => {
  if (!skin.dialogueChoices || !skin.fonts.dialogue) return [];
  const choices = (state.dialogueChoices ?? []).slice(0, skin.dialogueChoices.maximumChoices);
  if (choices.length === 0) return [];
  const content = contentRect(skin.dialogueChoices.region);
  const lineHeight = fontLineHeight(fonts, skin.fonts.dialogue.fontId);
  const height = Math.max(
    lineHeight + 4,
    Math.floor((content.height - (choices.length - 1) * skin.dialogueChoices.gap) / choices.length),
  );
  return choices.map((_, index) => ({
    x: content.x,
    y: content.y + index * (height + skin.dialogueChoices!.gap),
    width: content.width,
    height,
  }));
};

export const uiVerbCoinRects = (skin: UiSkin, state: UiRuntimeState): readonly Rectangle[] => {
  if (!skin.verbCoin || !state.verbCoinPosition) return [];
  const count = skin.verbs.length;
  return skin.verbs.map((_, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
    const centerX = Math.round(state.verbCoinPosition!.x + Math.cos(angle) * skin.verbCoin!.radius);
    const centerY = Math.round(state.verbCoinPosition!.y + Math.sin(angle) * skin.verbCoin!.radius);
    const size = skin.verbCoin!.itemRadius * 2;
    return {
      x: centerX - skin.verbCoin!.itemRadius,
      y: centerY - skin.verbCoin!.itemRadius,
      width: size,
      height: size,
    };
  });
};

export const hitTestUiSkin = (
  skin: UiSkin,
  fonts: BitmapFontManifest,
  state: UiRuntimeState,
  point: Point,
): UiHitTarget | null => {
  const choiceRects = uiDialogueChoiceRects(skin, fonts, state);
  for (let index = choiceRects.length - 1; index >= 0; index -= 1) {
    const rect = choiceRects[index];
    const choice = state.dialogueChoices?.[index];
    if (rect && choice && containsPoint(rect, point)) {
      return {
        kind: "dialogue-choice",
        choiceId: choice.choiceId,
        enabled: choice.enabled,
      };
    }
  }

  const coinRects = uiVerbCoinRects(skin, state);
  for (let index = coinRects.length - 1; index >= 0; index -= 1) {
    const rect = coinRects[index];
    const verb = skin.verbs[index];
    if (rect && verb && containsPoint(rect, point)) {
      return { kind: "verb-coin", verb };
    }
  }

  if (skin.parser && containsPoint(skin.parser.region.rect, point)) {
    return { kind: "parser" };
  }

  const verbRects = uiVerbButtonRects(skin);
  for (let index = verbRects.length - 1; index >= 0; index -= 1) {
    const rect = verbRects[index];
    const verb = skin.verbs[index];
    if (rect && verb && containsPoint(rect, point)) {
      return { kind: "verb", verb };
    }
  }

  const inventoryRects = uiInventorySlotRects(skin);
  for (let index = inventoryRects.length - 1; index >= 0; index -= 1) {
    const rect = inventoryRects[index];
    if (rect && containsPoint(rect, point)) {
      return {
        kind: "inventory-slot",
        slotIndex: index,
        itemId: state.inventory?.[index]?.itemId ?? null,
      };
    }
  }

  return null;
};
