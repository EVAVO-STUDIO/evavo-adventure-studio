import type {
  DepthBand,
  Id,
  Point,
  PresentationProfile,
  Size,
  SpriteFrame,
} from "@evavo/adventure-project-schema";
import {
  orderRenderNodes,
  validateResolvedFrame,
  type NativeCanvas,
  type RenderFrameIssue,
  type RenderLayer,
  type RenderNode,
  type ResolvedCamera,
  type ResolvedFrame,
  type SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import {
  quantizeNativePoint,
  resolveScaleAtY,
} from "@evavo/adventure-scene";

export interface ActorSpriteInput {
  readonly nodeId: Id<"render-node">;
  readonly stableId: string;
  readonly frame: SpriteFrame;
  readonly footPosition: Point;
  readonly depthBands: readonly DepthBand[];
  readonly presentation: PresentationProfile;
  readonly elevation: number;
  readonly layer?: RenderLayer;
  readonly zOffset?: number;
  readonly scaleMultiplier?: number;
  readonly mirrored?: boolean;
  readonly opacity?: number;
  readonly visible?: boolean;
}

export const resolveActorSprite = (
  input: ActorSpriteInput,
): SpriteRenderNode => {
  const position = quantizeNativePoint(
    input.footPosition,
    input.presentation.pixelMotionPolicy,
    "entity",
  );
  const scaleSolution = resolveScaleAtY(input.depthBands, position.y);
  const perspectiveScale = scaleSolution?.scale ?? 1;
  const scale = perspectiveScale * (input.scaleMultiplier ?? 1);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError("Resolved actor scale must be a positive finite number.");
  }

  return {
    kind: "sprite",
    id: input.nodeId,
    order: {
      layer: input.layer ?? "world",
      elevation: input.elevation,
      baselineY: position.y,
      zOffset: (scaleSolution?.zOffset ?? 0) + (input.zOffset ?? 0),
      stableId: input.stableId,
    },
    transform: {
      position,
      pivot: input.frame.footPoint,
      scale: {
        x: input.mirrored ? -scale : scale,
        y: scale,
      },
      rotationRadians: 0,
    },
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    assetId: input.frame.assetId,
    frameId: input.frame.id,
    sourceRect: input.frame.sourceRect,
    originalSize: input.frame.sourceSize,
    trimOffset: input.frame.trimOffset,
    sampling: input.presentation.textureSampling,
  };
};

export interface CameraInput {
  readonly position: Point;
  readonly viewport: Size;
  readonly shakeOffset?: Point;
  readonly presentation: PresentationProfile;
}

export const resolveCamera = (input: CameraInput): ResolvedCamera => ({
  position: quantizeNativePoint(
    input.position,
    input.presentation.pixelMotionPolicy,
    "camera",
  ),
  viewport: input.viewport,
  shakeOffset: quantizeNativePoint(
    input.shakeOffset ?? { x: 0, y: 0 },
    input.presentation.pixelMotionPolicy,
    "camera",
  ),
});

export interface FrameBuildInput {
  readonly tick: number;
  readonly canvas: NativeCanvas;
  readonly camera: ResolvedCamera;
  readonly nodes: readonly RenderNode[];
}

export interface FrameBuildResult {
  readonly frame: ResolvedFrame;
  readonly issues: readonly RenderFrameIssue[];
}

export const buildResolvedFrame = (
  input: FrameBuildInput,
): FrameBuildResult => {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
    throw new RangeError(
      "Resolved frame tick must be a non-negative safe integer.",
    );
  }

  const frame: ResolvedFrame = {
    frameVersion: 1,
    tick: input.tick,
    canvas: input.canvas,
    camera: input.camera,
    nodes: orderRenderNodes(input.nodes),
  };

  return {
    frame,
    issues: validateResolvedFrame(frame),
  };
};
