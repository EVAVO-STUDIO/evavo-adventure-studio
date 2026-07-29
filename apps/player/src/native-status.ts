import type { Id } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  ResolvedFrame,
  SolidRectangleRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

const renderNodeId = (value: string): Id<"render-node"> =>
  value as Id<"render-node">;

const selectDefaultBitmapFont = (
  bundle: Pick<RuntimeBundle, "bitmapFonts">,
) => {
  const fonts = bundle.bitmapFonts?.fonts ?? [];
  const dialogue = fonts
    .filter((font) =>
      `${font.id} ${font.name}`.toLocaleLowerCase("en-US").includes("dialogue"),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  return (
    dialogue ??
    [...fonts].sort((left, right) => left.id.localeCompare(right.id))[0] ??
    null
  );
};

const normalizeStatusText = (value: string): string =>
  value
    .trim()
    .replaceAll("•", "-")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replaceAll("…", "...");

const railRectangle = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number | readonly [number, number, number, number],
  zOffset: number,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: renderNodeId(id),
  order: {
    layer: "interface",
    elevation: 0,
    baselineY: y + height,
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
  size: { width, height },
  color,
});

export const appendNativeStatusPanel = (
  frame: ResolvedFrame,
  bundle: Pick<RuntimeBundle, "bitmapFonts">,
  text: string,
): ResolvedFrame => {
  const font = selectDefaultBitmapFont(bundle);
  const normalizedText = normalizeStatusText(text);
  if (!font || !normalizedText) {
    return frame;
  }

  const horizontalPadding = Math.min(8, Math.max(1, frame.canvas.width - 1));
  const verticalPadding = 4;
  const requestedHeight = Math.max(
    18,
    font.lineHeight + verticalPadding * 2,
  );
  const panelHeight = Math.min(frame.canvas.height, requestedHeight);
  const panelY = frame.canvas.height - panelHeight;
  const textY = Math.min(
    frame.canvas.height - Math.min(font.lineHeight, frame.canvas.height),
    panelY + verticalPadding,
  );
  const textNode: BitmapTextRenderNode = {
    kind: "bitmap-text",
    id: renderNodeId("runtime.status.text"),
    order: {
      layer: "interface",
      elevation: 0,
      baselineY: frame.canvas.height,
      zOffset: 3,
      stableId: "runtime.status.text",
    },
    transform: {
      position: { x: horizontalPadding, y: Math.max(0, textY) },
      pivot: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotationRadians: 0,
    },
    opacity: 1,
    visible: true,
    fontAssetId: font.atlasAssetId,
    fontId: font.id,
    text: normalizedText,
    maximumWidth: Math.max(1, frame.canvas.width - horizontalPadding * 2),
    lineHeight: Math.min(font.lineHeight, frame.canvas.height),
    align: "left",
    color: 0xf4f5f7,
    outlineColor: 0x05060a,
  };

  return {
    ...frame,
    nodes: [
      ...frame.nodes,
      railRectangle(
        "runtime.status.panel",
        0,
        panelY,
        frame.canvas.width,
        panelHeight,
        [7, 9, 14, 238],
        0,
      ),
      railRectangle(
        "runtime.status.rule",
        0,
        panelY,
        frame.canvas.width,
        1,
        0xff244e,
        1,
      ),
      textNode,
    ],
  };
};
