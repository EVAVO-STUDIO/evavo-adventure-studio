import { evaluateCondition } from "@evavo/adventure-core";
import {
  defaultInteractionPolicy,
  type ExecutedInteraction,
  executeHotspotCommand,
  type InteractionPolicy,
} from "@evavo/adventure-interaction";
import type { Hotspot, Id, Point, Polygon } from "@evavo/adventure-project-schema";
import { compareRenderOrder, type RenderOrder } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { pointInPolygon, quantizeNativePoint, resolveScaleAtY } from "@evavo/adventure-scene";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";
import type { RuntimeWorldState } from "./index.js";

export interface ResolvedSceneObjectHotspot {
  readonly objectInstanceId: Id<"object">;
  readonly definitionId: Id<"object-definition">;
  readonly stateId: Id<"object-state">;
  readonly hotspot: Hotspot;
  readonly order: RenderOrder;
}

export interface SceneObjectCommand {
  readonly actorId: Id<"actor">;
  readonly objectInstanceId: Id<"object">;
  readonly verb: string;
  readonly itemId: Id<"item"> | null;
}

export type SceneObjectCommandExecution =
  | {
      readonly kind: "executed";
      readonly state: RuntimeWorldState;
      readonly target: ResolvedSceneObjectHotspot;
      readonly execution: Extract<ExecutedInteraction, { readonly kind: "executed" }>;
    }
  | {
      readonly kind: "fallback";
      readonly state: RuntimeWorldState;
      readonly target: ResolvedSceneObjectHotspot;
      readonly execution: Extract<ExecutedInteraction, { readonly kind: "fallback" }>;
    }
  | {
      readonly kind: "rejected";
      readonly state: RuntimeWorldState;
      readonly target: ResolvedSceneObjectHotspot;
      readonly execution: Extract<ExecutedInteraction, { readonly kind: "rejected" }>;
    }
  | {
      readonly kind: "missing-target";
      readonly state: RuntimeWorldState;
      readonly objectInstanceId: Id<"object">;
    };

const objectDefinitionsById = (bundle: RuntimeBundle): ReadonlyMap<string, ObjectDefinition> =>
  new Map(
    (bundle.sceneInstances?.objectDefinitions ?? []).map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );

const objectStateFor = (definition: ObjectDefinition, stateId: string): ObjectStateDefinition => {
  const state = definition.states.find((candidate) => candidate.id === stateId);
  if (!state) {
    throw new Error(`Object definition '${definition.id}' has no state '${stateId}'.`);
  }
  return state;
};

const activeObjectState = (
  world: RuntimeWorldState,
  instance: SceneObjectInstance,
  definition: ObjectDefinition,
): ObjectStateDefinition =>
  objectStateFor(
    definition,
    world.story.objectStates[instance.id] ?? instance.initialStateId ?? definition.initialStateId,
  );

const localShapePivot = (state: ObjectStateDefinition): Point => state.visual?.pivot ?? { x: 0, y: 0 };

const transformLocalPoint = (
  point: Point,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Point => ({
  x: anchor.x + (point.x - pivot.x) * scale * (mirrored ? -1 : 1),
  y: anchor.y + (point.y - pivot.y) * scale,
});

const transformPolygon = (
  polygon: Polygon,
  anchor: Point,
  pivot: Point,
  scale: number,
  mirrored: boolean,
): Polygon => ({
  points: polygon.points.map((point) => transformLocalPoint(point, anchor, pivot, scale, mirrored)),
});

const hotspotId = (instance: SceneObjectInstance, state: ObjectStateDefinition): Id<"hotspot"> =>
  `hotspot.object.${instance.id}.${state.id}` as Id<"hotspot">;

const objectOrder = (
  scene: RuntimeBundle["scenes"][number],
  instance: SceneObjectInstance,
  position: Point,
): RenderOrder => {
  const perspective = resolveScaleAtY(scene.depthBands, position.y);
  return {
    layer: instance.layer,
    elevation: instance.elevation,
    baselineY: position.y,
    zOffset: (perspective?.zOffset ?? 0) + instance.zOffset,
    stableId: instance.id,
  };
};

export const resolveSceneObjectHotspots = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  sceneId: Id<"scene"> = world.story.currentSceneId,
): readonly ResolvedSceneObjectHotspot[] => {
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new Error(`Runtime scene '${sceneId}' does not exist.`);
  }
  const composition = bundle.sceneInstances?.scenes.find((candidate) => candidate.sceneId === sceneId);
  const definitions = objectDefinitionsById(bundle);
  const resolved: ResolvedSceneObjectHotspot[] = [];

  for (const instance of composition?.objectInstances ?? []) {
    if (instance.visibleWhen && !evaluateCondition(instance.visibleWhen, world.story)) {
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition) {
      throw new Error(`Object instance '${instance.id}' definition '${instance.definitionId}' is missing.`);
    }
    const state = activeObjectState(world, instance, definition);
    if (!state.visible || !state.interactionShape) {
      continue;
    }

    const anchor = quantizeNativePoint(instance.position, bundle.presentation.pixelMotionPolicy, "entity");
    const perspective = resolveScaleAtY(scene.depthBands, anchor.y);
    const scale = (perspective?.scale ?? 1) * instance.scaleMultiplier;
    const pivot = localShapePivot(state);
    const shape = transformPolygon(state.interactionShape, anchor, pivot, scale, instance.mirrored);
    const walkTo = state.walkToOffset
      ? {
          x: anchor.x + state.walkToOffset.x * scale * (instance.mirrored ? -1 : 1),
          y: anchor.y + state.walkToOffset.y * scale,
        }
      : undefined;

    resolved.push({
      objectInstanceId: instance.id,
      definitionId: definition.id,
      stateId: state.id,
      order: objectOrder(scene, instance, anchor),
      hotspot: {
        id: hotspotId(instance, state),
        name: definition.name,
        shape,
        ...(walkTo ? { walkTo } : {}),
        ...(state.cursor ? { cursor: state.cursor } : {}),
        interactions: state.interactions,
        ...(state.fallbackText ? { fallbackText: state.fallbackText } : {}),
      },
    });
  }

  return resolved.sort((left, right) => compareRenderOrder(left.order, right.order));
};

export const hitTestSceneObject = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  point: Point,
  sceneId: Id<"scene"> = world.story.currentSceneId,
): ResolvedSceneObjectHotspot | null => {
  const hotspots = resolveSceneObjectHotspots(bundle, world, sceneId);
  for (let index = hotspots.length - 1; index >= 0; index -= 1) {
    const target = hotspots[index];
    if (target && pointInPolygon(point, target.hotspot.shape)) {
      return target;
    }
  }
  return null;
};

export const executeSceneObjectCommand = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  command: SceneObjectCommand,
  policy: InteractionPolicy = defaultInteractionPolicy,
): SceneObjectCommandExecution => {
  const scene = bundle.scenes.find((candidate) => candidate.id === world.story.currentSceneId);
  if (!scene) {
    throw new Error(`Runtime scene '${world.story.currentSceneId}' does not exist.`);
  }
  const target = resolveSceneObjectHotspots(bundle, world).find(
    (candidate) => candidate.objectInstanceId === command.objectInstanceId,
  );
  if (!target) {
    return {
      kind: "missing-target",
      state: world,
      objectInstanceId: command.objectInstanceId,
    };
  }

  const execution = executeHotspotCommand(
    world.story,
    target.hotspot,
    {
      actorId: command.actorId,
      verb: command.verb,
      targetHotspotId: target.hotspot.id,
      itemId: command.itemId,
    },
    policy,
    scene.fallbackText,
  );

  if (execution.kind === "executed") {
    return {
      kind: "executed",
      target,
      execution,
      state: {
        ...world,
        story: execution.result.transition.state,
      },
    };
  }

  if (execution.kind === "fallback") {
    return {
      kind: "fallback",
      target,
      execution,
      state: world,
    };
  }

  return {
    kind: "rejected",
    target,
    execution,
    state: world,
  };
};
