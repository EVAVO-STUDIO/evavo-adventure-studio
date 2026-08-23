import type { Id, Point } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { EntryChoreography } from "@evavo/adventure-scene-instances/staging";
import {
  setActorInstanceAnimation,
  setActorInstancePosition,
  type RuntimeWorldState,
} from "./index.js";
import { actorsById, resolveAnimationFacing } from "./movement-shared.js";
import { stagingForScene } from "./staging.js";

const EPSILON = 1e-7;

export interface ActiveEntryChoreography {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly sceneId: Id<"scene">;
  readonly entranceId: Id<"entrance">;
  readonly points: readonly Point[];
  readonly nextPointIndex: number;
  readonly speedPixelsPerSecond: number;
  readonly entryAnimationState: string | null;
  readonly arrivalFacing: string | null;
  readonly arrivalAnimationState: string | null;
  readonly unlockControlAt: "spawn" | "path-end" | "animation-end";
  readonly waitingForArrivalAnimation: boolean;
}

export type EntryChoreographyEvent =
  | {
      readonly kind: "entry-choreography-started";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    }
  | {
      readonly kind: "entry-choreography-completed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
    };

export interface EntryChoreographyTransition {
  readonly state: RuntimeWorldState;
  readonly active: ActiveEntryChoreography | null;
  readonly events: readonly EntryChoreographyEvent[];
}

export const entryChoreographyFor = (
  bundle: RuntimeBundle,
  sceneId: Id<"scene">,
  entranceId: Id<"entrance">,
): EntryChoreography | null => {
  const staging = stagingForScene(bundle.sceneStaging, sceneId);
  return staging?.entryChoreographies.find((entry) => entry.entranceId === entranceId) ?? null;
};

const directionName = (from: Point, to: Point): string => {
  const x = to.x - from.x;
  const y = to.y - from.y;
  if (Math.abs(x) <= EPSILON && Math.abs(y) <= EPSILON) return "south";
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "south-east";
  if (angle >= 67.5 && angle < 112.5) return "south";
  if (angle >= 112.5 && angle < 157.5) return "south-west";
  if (angle >= 157.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "north-west";
  if (angle >= -112.5 && angle < -67.5) return "north";
  return "north-east";
};

const orientEntryAnimation = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  animationState: string,
  desiredFacing: string,
): RuntimeWorldState => {
  const runtime = world.actorInstances[actorInstanceId];
  if (!runtime) return world;
  const actor = actorsById(bundle).get(runtime.actorId);
  if (!actor) return world;
  const facing = resolveAnimationFacing(actor, animationState, desiredFacing, runtime.facing);
  return setActorInstanceAnimation(bundle, world, actorInstanceId, animationState, facing);
};

const finishEntry = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveEntryChoreography,
): EntryChoreographyTransition => {
  let state = world;
  const runtime = state.actorInstances[active.actorInstanceId];
  if (runtime && active.arrivalAnimationState) {
    state = orientEntryAnimation(
      bundle,
      state,
      active.actorInstanceId,
      active.arrivalAnimationState,
      active.arrivalFacing ?? runtime.facing,
    );
    if (active.unlockControlAt === "animation-end") {
      return {
        state,
        active: { ...active, waitingForArrivalAnimation: true },
        events: [],
      };
    }
  } else if (runtime && active.arrivalFacing) {
    state = orientEntryAnimation(
      bundle,
      state,
      active.actorInstanceId,
      runtime.animationState,
      active.arrivalFacing,
    );
  }
  return {
    state,
    active: null,
    events: [
      {
        kind: "entry-choreography-completed",
        actorInstanceId: active.actorInstanceId,
        sceneId: active.sceneId,
        entranceId: active.entranceId,
      },
    ],
  };
};

export const beginEntryChoreography = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  actorInstanceId: Id<"actor-instance">,
  sceneId: Id<"scene">,
  entranceId: Id<"entrance">,
): EntryChoreographyTransition => {
  const choreography = entryChoreographyFor(bundle, sceneId, entranceId);
  const scene = bundle.scenes.find((candidate) => candidate.id === sceneId);
  const entrance = scene?.entrances.find((candidate) => candidate.id === entranceId);
  const runtime = world.actorInstances[actorInstanceId];
  if (!choreography || !scene || !entrance || !runtime) {
    return { state: world, active: null, events: [] };
  }

  const spawn = choreography.spawnPosition ?? entrance.position;
  const points = [...choreography.entryPath];
  if (points.length === 0 && (spawn.x !== entrance.position.x || spawn.y !== entrance.position.y)) {
    points.push(entrance.position);
  }
  let state = setActorInstancePosition(world, actorInstanceId, spawn);
  if (choreography.entryAnimationState && points[0]) {
    state = orientEntryAnimation(
      bundle,
      state,
      actorInstanceId,
      choreography.entryAnimationState,
      directionName(spawn, points[0]),
    );
  }

  const active: ActiveEntryChoreography = {
    actorInstanceId,
    sceneId,
    entranceId,
    points,
    nextPointIndex: 0,
    speedPixelsPerSecond: choreography.speedPixelsPerSecond,
    entryAnimationState: choreography.entryAnimationState ?? null,
    arrivalFacing: choreography.arrivalFacing ?? null,
    arrivalAnimationState: choreography.arrivalAnimationState ?? null,
    unlockControlAt: choreography.unlockControlAt,
    waitingForArrivalAnimation: false,
  };
  const started: EntryChoreographyEvent = {
    kind: "entry-choreography-started",
    actorInstanceId,
    sceneId,
    entranceId,
  };
  if (choreography.unlockControlAt === "spawn" || points.length === 0) {
    const finished = finishEntry(bundle, state, active);
    return { ...finished, events: [started, ...finished.events] };
  }
  return { state, active, events: [started] };
};

export const advanceEntryChoreography = (
  bundle: RuntimeBundle,
  world: RuntimeWorldState,
  active: ActiveEntryChoreography,
  ticks: number,
): EntryChoreographyTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Entry choreography advancement must use non-negative safe integer ticks.");
  }
  if (active.waitingForArrivalAnimation) {
    const runtime = world.actorInstances[active.actorInstanceId];
    if (!runtime?.playback.completed) return { state: world, active, events: [] };
    return {
      state: world,
      active: null,
      events: [
        {
          kind: "entry-choreography-completed",
          actorInstanceId: active.actorInstanceId,
          sceneId: active.sceneId,
          entranceId: active.entranceId,
        },
      ],
    };
  }
  if (ticks === 0) return { state: world, active, events: [] };

  let state = world;
  let next = active;
  let distanceBudget = (active.speedPixelsPerSecond * ticks) / bundle.presentation.logicalTicksPerSecond;

  while (distanceBudget > EPSILON) {
    const target = next.points[next.nextPointIndex];
    if (!target) return finishEntry(bundle, state, next);
    const runtime = state.actorInstances[next.actorInstanceId];
    if (!runtime) return { state, active: null, events: [] };
    const dx = target.x - runtime.position.x;
    const dy = target.y - runtime.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= EPSILON) {
      next = { ...next, nextPointIndex: next.nextPointIndex + 1 };
      continue;
    }
    if (next.entryAnimationState) {
      state = orientEntryAnimation(
        bundle,
        state,
        next.actorInstanceId,
        next.entryAnimationState,
        directionName(runtime.position, target),
      );
    }
    const travel = Math.min(distanceBudget, distance);
    state = setActorInstancePosition(state, next.actorInstanceId, {
      x: runtime.position.x + (dx / distance) * travel,
      y: runtime.position.y + (dy / distance) * travel,
    });
    distanceBudget -= travel;
    if (travel >= distance - EPSILON) {
      state = setActorInstancePosition(state, next.actorInstanceId, target);
      next = { ...next, nextPointIndex: next.nextPointIndex + 1 };
    }
  }

  if (next.nextPointIndex >= next.points.length) return finishEntry(bundle, state, next);
  return { state, active: next, events: [] };
};
