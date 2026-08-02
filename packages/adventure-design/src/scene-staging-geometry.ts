import type {
  Actor,
  DepthBand,
  Point,
  Polygon,
  Rectangle,
  Scene,
} from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneActorInstance,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";
import {
  pointInAdventurePolygon,
  pointInsideSceneCanvas,
  pointInsideSceneNavigation,
  polygonInsideSceneCanvas,
} from "./scene-readability-geometry.js";
import type {
  AdventureActorStagingMarker,
  AdventureObjectStagingMarker,
  AdventureSceneStagingLayerNode,
} from "./scene-staging-types.js";

export const adventurePointDistance = (left: Point, right: Point): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const depthScaleAtY = (bands: readonly DepthBand[], y: number): number => {
  const band = bands.find(
    (candidate) =>
      y >= Math.min(candidate.farY, candidate.nearY) &&
      y <= Math.max(candidate.farY, candidate.nearY),
  );
  if (!band) return 1;
  const range = band.nearY - band.farY;
  if (Math.abs(range) <= 0.000001) return band.nearScale;
  const progress = Math.max(0, Math.min(1, (y - band.farY) / range));
  return band.farScale + (band.nearScale - band.farScale) * progress;
};

const normalizeRectangle = (rectangle: Rectangle): Rectangle => ({
  x: Math.round(rectangle.x * 1000) / 1000,
  y: Math.round(rectangle.y * 1000) / 1000,
  width: Math.round(rectangle.width * 1000) / 1000,
  height: Math.round(rectangle.height * 1000) / 1000,
});

export const actorStagingMarker = (
  scene: Scene,
  actor: Actor | undefined,
  instance: SceneActorInstance,
): AdventureActorStagingMarker => {
  const clip = actor?.animations.find(
    (candidate) =>
      candidate.state === instance.animationState && candidate.facing === instance.facing,
  );
  const frameId = clip?.frameIds[0];
  const frame = frameId
    ? actor?.frames.find((candidate) => candidate.id === frameId)
    : undefined;
  const depthScale = depthScaleAtY(scene.depthBands, instance.position.y);
  const scale = depthScale * instance.scaleMultiplier;
  const bounds = frame
    ? normalizeRectangle({
        x: instance.position.x - frame.footPoint.x * scale,
        y: instance.position.y - frame.footPoint.y * scale,
        width: frame.sourceSize.width * scale,
        height: frame.sourceSize.height * scale,
      })
    : null;
  return {
    instanceId: instance.id,
    actorId: instance.actorId,
    actorName: actor?.name ?? String(instance.actorId),
    position: { ...instance.position },
    facing: instance.facing,
    animationState: instance.animationState,
    mobility: instance.mobility,
    elevation: instance.elevation,
    zOffset: instance.zOffset,
    depthScale,
    scaleMultiplier: instance.scaleMultiplier,
    bounds,
    controlledCandidate: instance.mobility === "walkable",
  };
};

export const objectStateForInstance = (
  definition: ObjectDefinition | undefined,
  instance: SceneObjectInstance,
): ObjectStateDefinition | null => {
  if (!definition) return null;
  const stateId = instance.initialStateId ?? definition.initialStateId;
  return definition.states.find((candidate) => candidate.id === stateId) ?? null;
};

const transformedPoint = (
  point: Point,
  instance: SceneObjectInstance,
): Point => ({
  x:
    instance.position.x +
    (instance.mirrored ? -point.x : point.x) * instance.scaleMultiplier,
  y: instance.position.y + point.y * instance.scaleMultiplier,
});

const transformedPolygon = (
  polygon: Polygon,
  instance: SceneObjectInstance,
): Polygon => ({
  points: polygon.points.map((point) => transformedPoint(point, instance)),
});

const spriteBounds = (
  state: ObjectStateDefinition,
  instance: SceneObjectInstance,
): Rectangle | null => {
  const visual = state.visual;
  if (!visual || visual.kind !== "sprite-frame") return null;
  const scale = instance.scaleMultiplier;
  return normalizeRectangle({
    x:
      instance.position.x -
      (instance.mirrored ? visual.sourceSize.width - visual.pivot.x : visual.pivot.x) *
        scale,
    y: instance.position.y - visual.pivot.y * scale,
    width: visual.sourceSize.width * scale,
    height: visual.sourceSize.height * scale,
  });
};

export const objectStagingMarker = (
  definition: ObjectDefinition | undefined,
  instance: SceneObjectInstance,
): AdventureObjectStagingMarker => {
  const state = objectStateForInstance(definition, instance);
  const opacity = state?.visual?.opacity ?? 1;
  const interactionShape = state?.interactionShape
    ? transformedPolygon(state.interactionShape, instance)
    : null;
  const walkTo = state?.walkToOffset
    ? transformedPoint(state.walkToOffset, instance)
    : null;
  return {
    instanceId: instance.id,
    definitionId: instance.definitionId,
    definitionName: definition?.name ?? String(instance.definitionId),
    stateId: state?.id ?? null,
    position: { ...instance.position },
    layer: instance.layer,
    elevation: instance.elevation,
    zOffset: instance.zOffset,
    scaleMultiplier: instance.scaleMultiplier,
    mirrored: instance.mirrored,
    visible: state?.visible ?? false,
    interactive:
      (state?.interactions.length ?? 0) > 0 || Boolean(state?.fallbackText),
    visualKind: state?.visual?.kind ?? null,
    visualResolved: Boolean(state && (!state.visible || state.visual)),
    opacity,
    bounds: state ? spriteBounds(state, instance) : null,
    interactionShape,
    walkTo,
  };
};

export const rectangleIntersectionRatio = (
  left: Rectangle,
  right: Rectangle,
): number => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - x,
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - y,
  );
  const intersection = width * height;
  const smaller = Math.min(left.width * left.height, right.width * right.height);
  return smaller <= 0 ? 0 : intersection / smaller;
};

export const rectangleOutsideFraction = (
  rectangle: Rectangle,
  width: number,
  height: number,
): number => {
  const clippedWidth = Math.max(
    0,
    Math.min(rectangle.x + rectangle.width, width) - Math.max(rectangle.x, 0),
  );
  const clippedHeight = Math.max(
    0,
    Math.min(rectangle.y + rectangle.height, height) - Math.max(rectangle.y, 0),
  );
  const total = rectangle.width * rectangle.height;
  if (total <= 0) return 1;
  return 1 - (clippedWidth * clippedHeight) / total;
};

export const objectMarkerInsideCanvas = (
  marker: AdventureObjectStagingMarker,
  scene: Scene,
): boolean =>
  pointInsideSceneCanvas(marker.position, {
    width: scene.width,
    height: scene.height,
  }) &&
  (!marker.interactionShape ||
    polygonInsideSceneCanvas(marker.interactionShape, {
      width: scene.width,
      height: scene.height,
    }));

export const objectWalkToIsReachable = (
  marker: AdventureObjectStagingMarker,
  scene: Scene,
): boolean => !marker.walkTo || pointInsideSceneNavigation(scene, marker.walkTo);

export const pointOccupiesObject = (
  point: Point,
  marker: AdventureObjectStagingMarker,
): boolean =>
  marker.interactionShape
    ? pointInAdventurePolygon(point, marker.interactionShape)
    : marker.bounds
      ? point.x >= marker.bounds.x &&
        point.y >= marker.bounds.y &&
        point.x <= marker.bounds.x + marker.bounds.width &&
        point.y <= marker.bounds.y + marker.bounds.height
      : adventurePointDistance(point, marker.position) <= 8;

const layerPriority = {
  "rear-ambient": 0,
  world: 1,
  occlusion: 2,
  "front-ambient": 3,
} as const;

export const stageLayerOrder = (
  actors: readonly AdventureActorStagingMarker[],
  objects: readonly AdventureObjectStagingMarker[],
): readonly AdventureSceneStagingLayerNode[] => {
  const nodes: AdventureSceneStagingLayerNode[] = [
    ...actors.map((actor) => ({
      id: String(actor.instanceId),
      kind: "actor" as const,
      label: actor.actorName,
      layer: "world" as const,
      elevation: actor.elevation,
      baselineY: actor.position.y,
      zOffset: actor.zOffset,
    })),
    ...objects.map((object) => ({
      id: String(object.instanceId),
      kind: "object" as const,
      label: object.definitionName,
      layer: object.layer,
      elevation: object.elevation,
      baselineY: object.position.y,
      zOffset: object.zOffset,
    })),
  ];
  return nodes.sort(
    (left, right) =>
      layerPriority[left.layer] - layerPriority[right.layer] ||
      left.elevation - right.elevation ||
      left.baselineY - right.baselineY ||
      left.zOffset - right.zOffset ||
      left.id.localeCompare(right.id),
  );
};
