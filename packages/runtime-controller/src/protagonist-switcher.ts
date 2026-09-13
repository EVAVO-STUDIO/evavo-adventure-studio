import type { Id, Point, Rectangle } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  RenderNode,
  ResolvedFrame,
  SolidRectangleRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { uiSkinById, type UiColor, type UiPanelStyle } from "@evavo/adventure-ui-skin";

export interface RuntimeProtagonistSwitchSlot {
  readonly protagonistId: Id<"actor">;
  readonly label: string;
  readonly rect: Rectangle;
}

const contains = (rect: Rectangle, point: Point): boolean =>
  point.x >= rect.x &&
  point.y >= rect.y &&
  point.x < rect.x + rect.width &&
  point.y < rect.y + rect.height;

const alpha = (color: UiColor): number =>
  typeof color === "number" ? 1 : color[3] / 255;

const solid = (
  id: string,
  rect: Rectangle,
  color: UiColor,
  zOffset: number,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: id as Id<"render-node">,
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
  opacity: alpha(color),
  visible: true,
  size: { width: rect.width, height: rect.height },
  color: typeof color === "number" ? color : [color[0], color[1], color[2], 255],
});

const panel = (
  id: string,
  rect: Rectangle,
  style: UiPanelStyle,
  zOffset: number,
): readonly SolidRectangleRenderNode[] => {
  const nodes: SolidRectangleRenderNode[] = [solid(`${id}.fill`, rect, style.fill, zOffset)];
  const border = Math.min(style.borderWidth, Math.floor(rect.width / 2), Math.floor(rect.height / 2));
  if (border <= 0) return nodes;
  nodes.push(
    solid(`${id}.top`, { x: rect.x, y: rect.y, width: rect.width, height: border }, style.border, zOffset + 1),
    solid(
      `${id}.bottom`,
      { x: rect.x, y: rect.y + rect.height - border, width: rect.width, height: border },
      style.border,
      zOffset + 1,
    ),
    solid(`${id}.left`, { x: rect.x, y: rect.y, width: border, height: rect.height }, style.border, zOffset + 1),
    solid(
      `${id}.right`,
      { x: rect.x + rect.width - border, y: rect.y, width: border, height: rect.height },
      style.border,
      zOffset + 1,
    ),
  );
  return nodes;
};

export const protagonistSwitchSlots = (
  bundle: RuntimeBundle,
): readonly RuntimeProtagonistSwitchSlot[] => {
  const manifest = bundle.multiProtagonist;
  const switcher = manifest?.switcher;
  if (!manifest || !switcher) return [];
  const { region, orientation, gap } = switcher;
  const count = manifest.protagonists.length;
  const actors = new Map(bundle.actors.map((actor) => [actor.id as string, actor.name] as const));
  const totalGap = Math.max(0, count - 1) * gap;
  const slotWidth = orientation === "horizontal"
    ? Math.max(1, Math.floor((region.width - totalGap) / count))
    : region.width;
  const slotHeight = orientation === "vertical"
    ? Math.max(1, Math.floor((region.height - totalGap) / count))
    : region.height;
  return manifest.protagonists.map((entry, index) => ({
    protagonistId: entry.protagonistId,
    label: actors.get(entry.protagonistId) ?? entry.protagonistId,
    rect: {
      x: region.x + (orientation === "horizontal" ? index * (slotWidth + gap) : 0),
      y: region.y + (orientation === "vertical" ? index * (slotHeight + gap) : 0),
      width: slotWidth,
      height: slotHeight,
    },
  }));
};

export const validateProtagonistSwitcherRuntime = (bundle: RuntimeBundle): void => {
  const switcher = bundle.multiProtagonist?.switcher;
  if (!switcher) return;
  const { region } = switcher;
  const { nativeWidth, nativeHeight } = bundle.presentation;
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > nativeWidth ||
    region.y + region.height > nativeHeight
  ) {
    throw new Error(`Protagonist switcher must stay inside the ${nativeWidth}×${nativeHeight} native canvas.`);
  }
  if (!bundle.uiSkins || !bundle.bitmapFonts) {
    throw new Error("Protagonist switcher requires a packaged UI skin and bitmap fonts.");
  }
  if (protagonistSwitchSlots(bundle).some((slot) => slot.rect.width < 8 || slot.rect.height < 8)) {
    throw new Error("Protagonist switcher slots must be at least 8×8 native pixels.");
  }
};

export const hitTestProtagonistSwitcher = (
  bundle: RuntimeBundle,
  point: Point,
): Id<"actor"> | null =>
  protagonistSwitchSlots(bundle).find((slot) => contains(slot.rect, point))?.protagonistId ?? null;

export const appendProtagonistSwitcher = (
  frame: ResolvedFrame,
  bundle: RuntimeBundle,
  activeProtagonistId: Id<"actor">,
): ResolvedFrame => {
  const slots = protagonistSwitchSlots(bundle);
  if (slots.length === 0) return frame;
  validateProtagonistSwitcherRuntime(bundle);
  const skin = uiSkinById(bundle.uiSkins!);
  const fontStyle = skin.fonts.status;
  const font = bundle.bitmapFonts!.fonts.find((candidate) => candidate.id === fontStyle.fontId);
  if (!font) throw new Error(`Protagonist switcher font '${fontStyle.fontId}' is unavailable.`);
  const style = skin.status.panel;
  const nodes: RenderNode[] = [];
  for (const [index, slot] of slots.entries()) {
    nodes.push(...panel(`runtime.ui.protagonist.${index}`, slot.rect, style, 70));
    if (slot.protagonistId === activeProtagonistId) {
      const markerColor = style.accent ?? style.border;
      nodes.push(
        solid(
          `runtime.ui.protagonist.${index}.active`,
          { x: slot.rect.x + 1, y: slot.rect.y + 1, width: Math.max(1, slot.rect.width - 2), height: Math.min(2, Math.max(1, slot.rect.height - 2)) },
          markerColor,
          73,
        ),
      );
    }
    const text: BitmapTextRenderNode = {
      kind: "bitmap-text",
      id: `runtime.ui.protagonist.${index}.label` as Id<"render-node">,
      order: {
        layer: "interface",
        elevation: 0,
        baselineY: slot.rect.y + slot.rect.height,
        zOffset: 75,
        stableId: `runtime.ui.protagonist.${index}.label`,
      },
      transform: {
        position: { x: slot.rect.x + 2, y: slot.rect.y + Math.max(2, Math.floor((slot.rect.height - font.lineHeight) / 2)) },
        pivot: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
      fontAssetId: font.atlasAssetId,
      fontId: font.id,
      text: slot.label,
      maximumWidth: Math.max(1, slot.rect.width - 4),
      lineHeight: font.lineHeight,
      align: "center",
      color: fontStyle.color,
      ...(fontStyle.outlineColor === undefined ? {} : { outlineColor: fontStyle.outlineColor }),
    };
    nodes.push(text);
  }
  return { ...frame, nodes: [...frame.nodes, ...nodes] };
};
