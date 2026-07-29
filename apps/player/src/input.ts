import type { Id, Point, Size } from "@evavo/adventure-project-schema";
import type {
  ResolvedCamera,
  ResolvedFrame,
  SolidRectangleRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createIntegerPresentationTransform,
  hostPointToNative,
} from "@evavo/adventure-scene";
import type { ResolvedSceneObjectHotspot } from "@evavo/adventure-scene-runtime/interactions";

export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

export interface HostBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type ControlledActorSelection =
  | {
      readonly kind: "selected";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly explicit: boolean;
    }
  | {
      readonly kind: "none";
      readonly reason: "no-walkable-actor" | "ambiguous-walkable-actors";
      readonly candidates: readonly Id<"actor-instance">[];
    }
  | {
      readonly kind: "invalid";
      readonly reason: "unknown-requested-actor" | "requested-actor-is-fixed";
      readonly requestedActorInstanceId: string;
    };

export interface SoftwareCursorState {
  readonly position: Point | null;
  readonly cursorId: string;
  readonly pressed: boolean;
}

const renderNodeId = (value: string): Id<"render-node"> =>
  value as Id<"render-node">;

const actorInstanceId = (value: string): Id<"actor-instance"> =>
  value as Id<"actor-instance">;

export const selectControlledActorInstance = (
  bundle: Pick<RuntimeBundle, "startSceneId" | "sceneInstances">,
  requestedActorInstanceId: string | null,
): ControlledActorSelection => {
  const composition = bundle.sceneInstances?.scenes.find(
    (candidate) => candidate.sceneId === bundle.startSceneId,
  );
  const placed = composition?.actorInstances ?? [];

  if (requestedActorInstanceId) {
    const requested = placed.find(
      (candidate) => candidate.id === requestedActorInstanceId,
    );
    if (!requested) {
      return {
        kind: "invalid",
        reason: "unknown-requested-actor",
        requestedActorInstanceId,
      };
    }
    if (requested.mobility !== "walkable") {
      return {
        kind: "invalid",
        reason: "requested-actor-is-fixed",
        requestedActorInstanceId,
      };
    }
    return {
      kind: "selected",
      actorInstanceId: requested.id,
      explicit: true,
    };
  }

  const candidates = placed
    .filter((candidate) => candidate.mobility === "walkable")
    .map((candidate) => candidate.id)
    .sort((left, right) => left.localeCompare(right));
  if (candidates.length === 1 && candidates[0]) {
    return {
      kind: "selected",
      actorInstanceId: candidates[0],
      explicit: false,
    };
  }
  return {
    kind: "none",
    reason:
      candidates.length === 0
        ? "no-walkable-actor"
        : "ambiguous-walkable-actors",
    candidates,
  };
};

export const mapClientPointToNative = (
  clientPoint: ClientPoint,
  hostBounds: HostBounds,
  nativeSize: Size,
): Point | null => {
  if (
    !Number.isFinite(hostBounds.left) ||
    !Number.isFinite(hostBounds.top) ||
    !Number.isFinite(hostBounds.width) ||
    !Number.isFinite(hostBounds.height) ||
    hostBounds.width <= 0 ||
    hostBounds.height <= 0
  ) {
    return null;
  }
  const transform = createIntegerPresentationTransform(
    nativeSize.width,
    nativeSize.height,
    hostBounds.width,
    hostBounds.height,
  );
  return hostPointToNative(
    {
      x: clientPoint.x - hostBounds.left,
      y: clientPoint.y - hostBounds.top,
    },
    transform,
  );
};

export const nativeScreenPointToWorld = (
  nativePoint: Point,
  camera: ResolvedCamera,
): Point => ({
  x: nativePoint.x + camera.position.x - camera.shakeOffset.x,
  y: nativePoint.y + camera.position.y - camera.shakeOffset.y,
});

export const cursorIdForObjectTarget = (
  target: ResolvedSceneObjectHotspot | null,
): string => target?.hotspot.cursor ?? (target ? "use" : "walk");

const cursorColour = (cursorId: string): number => {
  switch (cursorId) {
    case "look":
      return 0x79b9d1;
    case "talk":
      return 0xf4c26a;
    case "take":
      return 0xc9a465;
    case "enter":
      return 0xa6e3a1;
    case "use":
      return 0xff244e;
    case "walk":
      return 0xf5f5f7;
    default:
      return 0xff244e;
  }
};

const cursorRectangle = (
  nodeId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  zOffset: number,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: renderNodeId(nodeId),
  order: {
    layer: "cursor",
    elevation: 0,
    baselineY: y + height,
    zOffset,
    stableId: nodeId,
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

export const createSoftwareCursorNodes = (
  state: SoftwareCursorState,
): readonly SolidRectangleRenderNode[] => {
  if (!state.position) {
    return [];
  }
  const x = state.position.x + (state.pressed ? 1 : 0);
  const y = state.position.y + (state.pressed ? 1 : 0);
  const color = cursorColour(state.cursorId);
  const outline = 0x05060a;

  if (state.cursorId === "walk") {
    return [
      cursorRectangle("cursor.walk.outline.horizontal", x - 5, y - 1, 11, 3, outline, 0),
      cursorRectangle("cursor.walk.outline.vertical", x - 1, y - 5, 3, 11, outline, 1),
      cursorRectangle("cursor.walk.horizontal", x - 4, y, 9, 1, color, 2),
      cursorRectangle("cursor.walk.vertical", x, y - 4, 1, 9, color, 3),
      cursorRectangle("cursor.walk.center", x, y, 1, 1, 0xff244e, 4),
    ];
  }

  return [
    cursorRectangle("cursor.action.outline.shaft", x - 1, y - 1, 3, 10, outline, 0),
    cursorRectangle("cursor.action.outline.head", x - 1, y - 1, 8, 3, outline, 1),
    cursorRectangle("cursor.action.shaft", x, y, 1, 8, color, 2),
    cursorRectangle("cursor.action.head.horizontal", x, y, 6, 1, color, 3),
    cursorRectangle("cursor.action.head.vertical", x, y, 1, 6, color, 4),
  ];
};

export const appendSoftwareCursor = (
  frame: ResolvedFrame,
  state: SoftwareCursorState,
): ResolvedFrame => ({
  ...frame,
  nodes: [...frame.nodes, ...createSoftwareCursorNodes(state)],
});

export const requestedActorFromSearch = (
  search: string,
): string | null => new URLSearchParams(search).get("actor");

export const walkDestinationForTarget = (
  target: ResolvedSceneObjectHotspot | null,
  worldPoint: Point,
): Point | null => (target ? target.hotspot.walkTo ?? null : worldPoint);

export const castActorInstanceId = actorInstanceId;
