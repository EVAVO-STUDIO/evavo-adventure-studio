import type { Id, Point, Rectangle, Size } from "@evavo/adventure-project-schema";

export type RenderLayer =
  | "sky"
  | "background"
  | "rear-ambient"
  | "world"
  | "occlusion"
  | "front-ambient"
  | "effects"
  | "speech"
  | "interface"
  | "cursor"
  | "display-treatment";

export const renderLayerOrder: Readonly<Record<RenderLayer, number>> = {
  sky: 0,
  background: 100,
  "rear-ambient": 200,
  world: 300,
  occlusion: 400,
  "front-ambient": 500,
  effects: 600,
  speech: 700,
  interface: 800,
  cursor: 900,
  "display-treatment": 1000,
};

export interface RenderTransform {
  readonly position: Point;
  readonly pivot: Point;
  readonly scale: Point;
  readonly rotationRadians: number;
}

export interface RenderOrder {
  readonly layer: RenderLayer;
  readonly elevation: number;
  readonly baselineY: number;
  readonly zOffset: number;
  readonly stableId: string;
}

interface BaseRenderNode {
  readonly id: Id<"render-node">;
  readonly order: RenderOrder;
  readonly transform: RenderTransform;
  readonly opacity: number;
  readonly visible: boolean;
  readonly maskNodeId?: Id<"render-node">;
}

export interface SpriteRenderNode extends BaseRenderNode {
  readonly kind: "sprite";
  readonly assetId: Id<"asset">;
  readonly frameId?: Id<"sprite-frame">;
  readonly sourceRect: Rectangle;
  readonly originalSize: Size;
  readonly trimOffset: Point;
  readonly sampling: "nearest" | "linear";
  readonly tintRgba?: readonly [number, number, number, number];
}

export interface IndexedPaletteDitherTransition {
  readonly targetPaletteAssetId: Id<"asset">;
  readonly targetPaletteOffset: number;
  readonly coverage: number;
  readonly matrix: "bayer-2" | "bayer-4" | "bayer-8";
  readonly origin: Point;
}

export interface IndexedSpriteRenderNode extends BaseRenderNode {
  readonly kind: "indexed-sprite";
  readonly indexAssetId: Id<"asset">;
  readonly paletteAssetId: Id<"asset">;
  readonly sourceRect: Rectangle;
  readonly originalSize: Size;
  readonly trimOffset: Point;
  readonly paletteOffset: number;
  readonly paletteDither?: IndexedPaletteDitherTransition;
}

export interface BitmapTextRenderNode extends BaseRenderNode {
  readonly kind: "bitmap-text";
  readonly fontAssetId: Id<"asset">;
  readonly fontId?: Id<"bitmap-font">;
  readonly text: string;
  readonly maximumWidth: number;
  readonly lineHeight: number;
  readonly align: "left" | "center" | "right";
  readonly color: number | readonly [number, number, number, number];
  readonly outlineColor?: number | readonly [number, number, number, number];
}

export interface SolidRectangleRenderNode extends BaseRenderNode {
  readonly kind: "solid-rectangle";
  readonly size: Size;
  readonly color: number | readonly [number, number, number, number];
}

export interface DitherFadeRenderNode extends BaseRenderNode {
  readonly kind: "dither-fade";
  readonly size: Size;
  readonly progress: number;
  readonly matrix: "bayer-2" | "bayer-4" | "bayer-8";
  readonly direction: "in" | "out";
  readonly color: number | readonly [number, number, number, number];
}

export type RenderNode =
  | SpriteRenderNode
  | IndexedSpriteRenderNode
  | BitmapTextRenderNode
  | SolidRectangleRenderNode
  | DitherFadeRenderNode;

export interface ResolvedCamera {
  readonly position: Point;
  readonly viewport: Size;
  readonly shakeOffset: Point;
}

export interface NativeCanvas {
  readonly width: number;
  readonly height: number;
  readonly clearColor: readonly [number, number, number, number];
}

export interface ResolvedFrame {
  readonly frameVersion: 1;
  readonly tick: number;
  readonly canvas: NativeCanvas;
  readonly camera: ResolvedCamera;
  readonly nodes: readonly RenderNode[];
}

export interface RenderFrameIssue {
  readonly severity: "error" | "warning";
  readonly code:
    | "duplicate-node-id"
    | "invalid-opacity"
    | "invalid-transform"
    | "invalid-canvas"
    | "unknown-mask"
    | "mask-cycle"
    | "invalid-dither-progress"
    | "invalid-indexed-palette-dither"
    | "invalid-bitmap-text";
  readonly nodeId: Id<"render-node"> | null;
  readonly message: string;
}

const isFinitePoint = (point: Point): boolean => Number.isFinite(point.x) && Number.isFinite(point.y);

const validateMaskCycles = (nodesById: ReadonlyMap<string, RenderNode>, node: RenderNode): boolean => {
  const visited = new Set<string>();
  let current: RenderNode | undefined = node;

  while (current?.maskNodeId) {
    if (visited.has(current.id)) {
      return false;
    }
    visited.add(current.id);
    current = nodesById.get(current.maskNodeId);
  }

  return true;
};

export const validateResolvedFrame = (frame: ResolvedFrame): readonly RenderFrameIssue[] => {
  const issues: RenderFrameIssue[] = [];
  const nodesById = new Map<string, RenderNode>();

  if (
    !Number.isSafeInteger(frame.canvas.width) ||
    !Number.isSafeInteger(frame.canvas.height) ||
    frame.canvas.width <= 0 ||
    frame.canvas.height <= 0
  ) {
    issues.push({
      severity: "error",
      code: "invalid-canvas",
      nodeId: null,
      message: "Native canvas dimensions must be positive safe integers.",
    });
  }

  for (const node of frame.nodes) {
    if (nodesById.has(node.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-node-id",
        nodeId: node.id,
        message: `Render node '${node.id}' is duplicated.`,
      });
    } else {
      nodesById.set(node.id, node);
    }

    if (!Number.isFinite(node.opacity) || node.opacity < 0 || node.opacity > 1) {
      issues.push({
        severity: "error",
        code: "invalid-opacity",
        nodeId: node.id,
        message: `Render node '${node.id}' has opacity outside the 0 to 1 range.`,
      });
    }

    if (
      !isFinitePoint(node.transform.position) ||
      !isFinitePoint(node.transform.pivot) ||
      !isFinitePoint(node.transform.scale) ||
      !Number.isFinite(node.transform.rotationRadians)
    ) {
      issues.push({
        severity: "error",
        code: "invalid-transform",
        nodeId: node.id,
        message: `Render node '${node.id}' contains a non-finite transform value.`,
      });
    }

    if (
      node.kind === "dither-fade" &&
      (!Number.isFinite(node.progress) || node.progress < 0 || node.progress > 1)
    ) {
      issues.push({
        severity: "error",
        code: "invalid-dither-progress",
        nodeId: node.id,
        message: `Dither fade '${node.id}' has progress outside the 0 to 1 range.`,
      });
    }

    if (node.kind === "indexed-sprite" && node.paletteDither) {
      const dither = node.paletteDither;
      if (
        !Number.isFinite(dither.coverage) ||
        dither.coverage < 0 ||
        dither.coverage > 1 ||
        !Number.isSafeInteger(dither.targetPaletteOffset) ||
        dither.targetPaletteOffset < 0 ||
        dither.targetPaletteOffset > 255 ||
        !isFinitePoint(dither.origin)
      ) {
        issues.push({
          severity: "error",
          code: "invalid-indexed-palette-dither",
          nodeId: node.id,
          message: `Indexed palette dither '${node.id}' requires 0–1 coverage, a byte-range target offset and finite native origin.`,
        });
      }
    }

    if (
      node.kind === "bitmap-text" &&
      (!Number.isSafeInteger(node.maximumWidth) ||
        node.maximumWidth <= 0 ||
        !Number.isSafeInteger(node.lineHeight) ||
        node.lineHeight <= 0)
    ) {
      issues.push({
        severity: "error",
        code: "invalid-bitmap-text",
        nodeId: node.id,
        message: `Bitmap text '${node.id}' requires positive integer width and line-height metrics.`,
      });
    }
  }

  for (const node of frame.nodes) {
    if (node.maskNodeId && !nodesById.has(node.maskNodeId)) {
      issues.push({
        severity: "error",
        code: "unknown-mask",
        nodeId: node.id,
        message: `Render node '${node.id}' references unknown mask '${node.maskNodeId}'.`,
      });
      continue;
    }

    if (!validateMaskCycles(nodesById, node)) {
      issues.push({
        severity: "error",
        code: "mask-cycle",
        nodeId: node.id,
        message: `Render node '${node.id}' participates in a mask cycle.`,
      });
    }
  }

  return issues;
};

export const compareRenderOrder = (left: RenderOrder, right: RenderOrder): number => {
  const layerDifference = renderLayerOrder[left.layer] - renderLayerOrder[right.layer];
  if (layerDifference !== 0) {
    return layerDifference;
  }
  if (left.elevation !== right.elevation) {
    return left.elevation - right.elevation;
  }
  if (left.baselineY !== right.baselineY) {
    return left.baselineY - right.baselineY;
  }
  if (left.zOffset !== right.zOffset) {
    return left.zOffset - right.zOffset;
  }
  return left.stableId.localeCompare(right.stableId);
};

export const orderRenderNodes = (nodes: readonly RenderNode[]): readonly RenderNode[] =>
  [...nodes].sort((left, right) => compareRenderOrder(left.order, right.order));

export interface RendererHost {
  readonly target: unknown;
  readonly devicePixelRatio: number;
}

export interface RendererAdapter {
  initialize(host: RendererHost, canvas: NativeCanvas): Promise<void>;
  render(frame: ResolvedFrame): void;
  resize(hostWidth: number, hostHeight: number): void;
  destroy(): Promise<void>;
}
