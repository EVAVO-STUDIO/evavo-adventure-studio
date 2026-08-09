import {
  type AnimationEvent,
  type AnimationPlaybackState,
  advanceAnimation,
  currentAnimationFrame,
  startAnimation,
} from "@evavo/adventure-animation";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import { advanceTicks, applyActions, evaluateCondition, type RuntimeState } from "@evavo/adventure-core";
import { buildResolvedFrame, resolveActorSprite, resolveCamera } from "@evavo/adventure-frame-resolver";
import type { Actor, Id, Point, SpriteFrame } from "@evavo/adventure-project-schema";
import type {
  RenderLayer,
  ResolvedCamera,
  ResolvedFrame,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { quantizeNativePoint, resolveScaleAtY } from "@evavo/adventure-scene";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneActorInstance,
  SceneObjectInstance,
} from "@evavo/adventure-scene-instances";

export interface ActorInstanceRuntimeState {
  readonly instanceId: Id<"actor-instance">;
  readonly sceneId: Id<"scene">;
  readonly actorId: Id<"actor">;
  readonly position: Point;
  readonly facing: string;
  readonly animationState: string;
  readonly playback: AnimationPlaybackState;
  readonly visibleOverride: boolean | null;
}

export interface RuntimeWorldState {
  readonly story: RuntimeState;
  readonly actorInstances: Readonly<Record<string, ActorInstanceRuntimeState>>;
}

export interface ActorInstanceAnimationEvent {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly event: AnimationEvent;
}

export interface RuntimeWorldTransition {
  readonly state: RuntimeWorldState;
  readonly animationEvents: readonly ActorInstanceAnimationEvent[];
}

const normalizeSeed = (seed: number): number => {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
};

const assetsById = (bundle: RuntimeBundle): ReadonlyMap<string, RuntimeAssetRecord> =>
  new Map(bundle.assets.map((asset) => [asset.assetId as string, asset] as const));

const actorsById = (bundle: RuntimeBundle): ReadonlyMap<string, Actor> =>
  new Map(bundle.actors.map((actor) => [actor.id as string, actor] as const));

const objectDefinitionsById = (bundle: RuntimeBundle): ReadonlyMap<string, ObjectDefinition> =>
  new Map(
    (bundle.sceneInstances?.objectDefinitions ?? []).map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );

const actorInstancePlacementsById = (bundle: RuntimeBundle): ReadonlyMap<string, SceneActorInstance> =>
  new Map(
    (bundle.sceneInstances?.scenes ?? []).flatMap((composition) =>
      composition.actorInstances.map((instance) => [instance.id as string, instance] as const),
    ),
  );

const findAnimationClip = (actor: Actor, animationState: string, facing: string) => {
  const clip = actor.animations.find(
    (candidate) => candidate.state === animationState && candidate.facing === facing,
  );
  if (!clip) {
    throw new Error(`Actor '${actor.id}' has no '${animationState}' animation facing '${facing}'.`);
  }
  return clip;
};

const initialObjectStates = (bundle: RuntimeBundle): Readonly<Record<string, string>> => {
  const definitions = objectDefinitionsById(bundle);
  const states: Record<string, string> = {};

  for (const composition of bundle.sceneInstances?.scenes ?? []) {
    for (const instance of composition.objectInstances) {
      const definition = definitions.get(instance.definitionId);
      if (!definition) {
        throw new Error(
          `Object instance '${instance.id}' references missing definition '${instance.definitionId}'.`,
        );
      }
      states[instance.id] = instance.initialStateId ?? definition.initialStateId;
    }
  }

  return states;
};

const initialActorStates = (bundle: RuntimeBundle): Readonly<Record<string, ActorInstanceRuntimeState>> => {
  const actors = actorsById(bundle);
  const states: Record<string, ActorInstanceRuntimeState> = {};

  for (const composition of bundle.sceneInstances?.scenes ?? []) {
    for (const instance of composition.actorInstances) {
      const actor = actors.get(instance.actorId);
      if (!actor) {
        throw new Error(`Actor instance '${instance.id}' references missing actor '${instance.actorId}'.`);
      }
      const clip = findAnimationClip(actor, instance.animationState, instance.facing);
      states[instance.id] = {
        instanceId: instance.id,
        sceneId: composition.sceneId,
        actorId: instance.actorId,
        position: instance.position,
        facing: instance.facing,
        animationState: instance.animationState,
        playback: startAnimation(actor, clip.id).state,
        visibleOverride: null,
      };
    }
  }

  return states;
};

export const createInitialRuntimeWorldState = (
  bundle: RuntimeBundle,
  seed = 0x45564156,
): RuntimeWorldState => ({
  story: {
    schemaVersion: 1,
    projectId: bundle.projectId,
    tick: 0,
    currentSceneId: bundle.startSceneId,
    currentEntranceId: bundle.startEntranceId,
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: initialObjectStates(bundle),
    randomStreams: { main: normalizeSeed(seed) },
    score: 0,
  },
  actorInstances: initialActorStates(bundle),
});

export const advanceRuntimeWorld = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  ticks: number,
): RuntimeWorldTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("World advancement must be a non-negative safe integer.");
  }
  const actors = actorsById(bundle);
  const actorInstances: Record<string, ActorInstanceRuntimeState> = {};
  const animationEvents: ActorInstanceAnimationEvent[] = [];

  for (const state of Object.values(world.actorInstances)) {
    const actor = actors.get(state.actorId);
    if (!actor) {
      throw new Error(`Actor instance '${state.instanceId}' references missing actor '${state.actorId}'.`);
    }
    const transition = advanceAnimation(actor, state.playback, ticks);
    actorInstances[state.instanceId] = {
      ...state,
      playback: transition.state,
    };
    animationEvents.push(
      ...transition.events.map((event) => ({
        actorInstanceId: state.instanceId,
        event,
      })),
    );
  }

  return {
    state: {
      story: advanceTicks(world.story, ticks),
      actorInstances,
    },
    animationEvents,
  };
};

export const setActorInstancePosition = (
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  position: Point,
): RuntimeWorldState => {
  const current = world.actorInstances[actorInstanceId];
  if (!current) {
    throw new Error(`Actor instance '${actorInstanceId}' does not exist.`);
  }
  return {
    ...world,
    actorInstances: {
      ...world.actorInstances,
      [actorInstanceId]: { ...current, position },
    },
  };
};

export const setActorInstanceAnimation = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  animationState: string,
  facing?: string,
): RuntimeWorldState => {
  const current = world.actorInstances[actorInstanceId];
  if (!current) {
    throw new Error(`Actor instance '${actorInstanceId}' does not exist.`);
  }
  const actor = actorsById(bundle).get(current.actorId);
  if (!actor) {
    throw new Error(`Actor '${current.actorId}' does not exist.`);
  }
  const nextFacing = facing ?? current.facing;
  const clip = findAnimationClip(actor, animationState, nextFacing);

  return {
    ...world,
    actorInstances: {
      ...world.actorInstances,
      [actorInstanceId]: {
        ...current,
        facing: nextFacing,
        animationState,
        playback: startAnimation(actor, clip.id).state,
      },
    },
  };
};

export const setActorInstanceVisibility = (
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  visibleOverride: boolean | null,
): RuntimeWorldState => {
  const current = world.actorInstances[actorInstanceId];
  if (!current) {
    throw new Error(`Actor instance '${actorInstanceId}' does not exist.`);
  }
  return {
    ...world,
    actorInstances: {
      ...world.actorInstances,
      [actorInstanceId]: { ...current, visibleOverride },
    },
  };
};

const findObjectPlacement = (
  bundle: RuntimeBundle,
  objectInstanceId: Id<"object">,
): {
  readonly instance: SceneObjectInstance;
  readonly definition: ObjectDefinition;
} => {
  const definitions = objectDefinitionsById(bundle);
  for (const composition of bundle.sceneInstances?.scenes ?? []) {
    const instance = composition.objectInstances.find((candidate) => candidate.id === objectInstanceId);
    if (!instance) {
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition) {
      throw new Error(
        `Object instance '${objectInstanceId}' definition '${instance.definitionId}' is missing.`,
      );
    }
    return { instance, definition };
  }
  throw new Error(`Object instance '${objectInstanceId}' does not exist.`);
};

export const setObjectInstanceState = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  objectInstanceId: Id<"object">,
  stateId: Id<"object-state">,
): RuntimeWorldState => {
  const { definition } = findObjectPlacement(bundle, objectInstanceId);
  if (!definition.states.some((state) => state.id === stateId)) {
    throw new Error(`Object definition '${definition.id}' has no state '${stateId}'.`);
  }
  return {
    ...world,
    story: applyActions(world.story, [
      {
        kind: "set-object-state",
        objectId: objectInstanceId,
        state: stateId,
      },
    ]).state,
  };
};

const backgroundNode = (bundle: RuntimeBundle, scene: RuntimeBundle["scenes"][number]): SpriteRenderNode => {
  const asset = assetsById(bundle).get(scene.backgroundAssetId);
  if (asset?.kind !== "image") {
    throw new Error(`Scene '${scene.id}' background '${scene.backgroundAssetId}' is not a runtime image.`);
  }
  return {
    kind: "sprite",
    id: `render.scene.${scene.id}.background` as Id<"render-node">,
    order: {
      layer: "background",
      elevation: 0,
      baselineY: 0,
      zOffset: 0,
      stableId: `scene.${scene.id}.background`,
    },
    transform: {
      position: { x: 0, y: 0 },
      pivot: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotationRadians: 0,
    },
    opacity: 1,
    visible: true,
    assetId: scene.backgroundAssetId,
    sourceRect: { x: 0, y: 0, width: scene.width, height: scene.height },
    originalSize: {
      width: asset.metadata.width,
      height: asset.metadata.height,
    },
    trimOffset: { x: 0, y: 0 },
    sampling: bundle.presentation.textureSampling,
  };
};

const objectStateFor = (definition: ObjectDefinition, stateId: string): ObjectStateDefinition => {
  const state = definition.states.find((candidate) => candidate.id === stateId);
  if (!state) {
    throw new Error(`Object definition '${definition.id}' has no state '${stateId}'.`);
  }
  return state;
};

const objectNode = (
  bundle: RuntimeBundle,
  scene: RuntimeBundle["scenes"][number],
  instance: SceneObjectInstance,
  state: ObjectStateDefinition,
): SpriteRenderNode | null => {
  if (!state.visible || !state.visual) {
    return null;
  }
  const asset = assetsById(bundle).get(state.visual.assetId);
  if (!asset) {
    throw new Error(`Object visual asset '${state.visual.assetId}' does not exist.`);
  }

  const position = quantizeNativePoint(instance.position, bundle.presentation.pixelMotionPolicy, "entity");
  const perspective = resolveScaleAtY(scene.depthBands, position.y);
  const scale = (perspective?.scale ?? 1) * instance.scaleMultiplier;
  const common = {
    kind: "sprite" as const,
    id: `render.object.${instance.id}` as Id<"render-node">,
    order: {
      layer: instance.layer as RenderLayer,
      elevation: instance.elevation,
      baselineY: position.y,
      zOffset: (perspective?.zOffset ?? 0) + instance.zOffset,
      stableId: instance.id as string,
    },
    transform: {
      position,
      pivot: state.visual.pivot,
      scale: {
        x: instance.mirrored ? -scale : scale,
        y: scale,
      },
      rotationRadians: 0,
    },
    opacity: state.visual.opacity,
    visible: true,
    assetId: state.visual.assetId,
    sampling: bundle.presentation.textureSampling,
  };

  if (state.visual.kind === "sprite-frame") {
    return {
      ...common,
      frameId: state.visual.frameId,
      sourceRect: state.visual.sourceRect,
      originalSize: state.visual.sourceSize,
      trimOffset: state.visual.trimOffset,
    };
  }
  if (asset.kind !== "image") {
    throw new Error(`Object visual '${state.visual.assetId}' is not a runtime image.`);
  }
  return {
    ...common,
    sourceRect: {
      x: 0,
      y: 0,
      width: asset.metadata.width,
      height: asset.metadata.height,
    },
    originalSize: {
      width: asset.metadata.width,
      height: asset.metadata.height,
    },
    trimOffset: { x: 0, y: 0 },
  };
};

export interface ResolveRuntimeSceneFrameOptions {
  readonly sceneId?: Id<"scene">;
  readonly camera?: ResolvedCamera;
}

export const resolveRuntimeSceneFrame = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  options: ResolveRuntimeSceneFrameOptions = {},
): ResolvedFrame => {
  const sceneId = options.sceneId ?? world.story.currentSceneId;
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new Error(`Runtime scene '${sceneId}' does not exist.`);
  }
  const composition = bundle.sceneInstances?.scenes.find((candidate) => candidate.sceneId === sceneId);
  const definitions = objectDefinitionsById(bundle);
  const nodes: SpriteRenderNode[] = [backgroundNode(bundle, scene)];

  const actorPlacements = actorInstancePlacementsById(bundle);
  const activeActors = Object.values(world.actorInstances)
    .filter((runtime) => runtime.sceneId === sceneId)
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId));
  for (const runtime of activeActors) {
    const authored = actorPlacements.get(runtime.instanceId);
    if (!authored) {
      throw new Error(`Actor instance authoring data '${runtime.instanceId}' is missing.`);
    }
    if (authored.actorId !== runtime.actorId) {
      throw new Error(
        `Actor instance '${runtime.instanceId}' runtime actor '${runtime.actorId}' ` +
          `does not match authored actor '${authored.actorId}'.`,
      );
    }
    const conditionVisible = !authored.visibleWhen || evaluateCondition(authored.visibleWhen, world.story);
    const visible = runtime.visibleOverride ?? conditionVisible;
    if (!visible) {
      continue;
    }
    const actor = actorsById(bundle).get(runtime.actorId);
    if (!actor) {
      throw new Error(`Actor '${runtime.actorId}' does not exist.`);
    }
    const frame: SpriteFrame = currentAnimationFrame(actor, runtime.playback);
    nodes.push(
      resolveActorSprite({
        nodeId: `render.actor-instance.${runtime.instanceId}` as Id<"render-node">,
        stableId: runtime.instanceId,
        frame,
        footPosition: runtime.position,
        depthBands: scene.depthBands,
        presentation: bundle.presentation,
        elevation: authored.elevation,
        zOffset: authored.zOffset,
        scaleMultiplier: authored.scaleMultiplier,
        visible: true,
      }),
    );
  }

  for (const instance of composition?.objectInstances ?? []) {
    if (instance.visibleWhen && !evaluateCondition(instance.visibleWhen, world.story)) {
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition) {
      throw new Error(`Object instance '${instance.id}' definition '${instance.definitionId}' is missing.`);
    }
    const stateId =
      world.story.objectStates[instance.id] ?? instance.initialStateId ?? definition.initialStateId;
    const state = objectStateFor(definition, stateId);
    const resolved = objectNode(bundle, scene, instance, state);
    if (resolved) {
      nodes.push(resolved);
    }
  }

  const camera =
    options.camera ??
    resolveCamera({
      position: { x: 0, y: 0 },
      viewport: {
        width: bundle.presentation.nativeWidth,
        height: bundle.presentation.nativeHeight,
      },
      presentation: bundle.presentation,
    });
  const result = buildResolvedFrame({
    tick: world.story.tick,
    canvas: {
      width: bundle.presentation.nativeWidth,
      height: bundle.presentation.nativeHeight,
      clearColor: [0, 0, 0, 255],
    },
    camera,
    nodes,
  });
  if (result.issues.length > 0) {
    throw new Error(`Runtime scene '${scene.id}' resolved with ${result.issues.length} frame issue(s).`);
  }
  return result.frame;
};
