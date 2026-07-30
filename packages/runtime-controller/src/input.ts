import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  selectControlledActorInstance as selectBrowserControlledActorInstance,
  type ControlledActorSelection as BrowserControlledActorSelection,
} from "./input-base.js";

export {
  appendSoftwareCursor,
  createSoftwareCursorNodes,
  cursorIdForObjectTarget,
  mapClientPointToNative,
  nativeScreenPointToWorld,
  requestedActorFromSearch,
  verbForCursorId,
  walkDestinationForTarget,
  type ClientPoint,
  type HostBounds,
  type SoftwareCursorState,
} from "./input-base.js";

export type ControlledActorSelection =
  | BrowserControlledActorSelection
  | {
      readonly kind: "none";
      readonly reason: "explicit-view-only";
      readonly candidates: readonly Id<"actor-instance">[];
    };

const SAVE_ACTOR_PREFIX = "\u0000evavo-save-actor:";
const SAVE_VIEW_ONLY_REQUEST = "\u0000evavo-save-view-only";

export const controlledActorRequestFromSave = (
  actorInstanceId: Id<"actor-instance"> | null,
): string =>
  actorInstanceId === null
    ? SAVE_VIEW_ONLY_REQUEST
    : `${SAVE_ACTOR_PREFIX}${actorInstanceId}`;

const savedActorRequest = (request: string): string | null | undefined => {
  if (request === SAVE_VIEW_ONLY_REQUEST) return null;
  return request.startsWith(SAVE_ACTOR_PREFIX)
    ? request.slice(SAVE_ACTOR_PREFIX.length)
    : undefined;
};

const selectSavedControlledActor = (
  bundle: Pick<RuntimeBundle, "startSceneId" | "sceneInstances">,
  actorInstanceId: string | null,
): ControlledActorSelection => {
  if (actorInstanceId === null) {
    return {
      kind: "none",
      reason: "explicit-view-only",
      candidates: [],
    };
  }

  const placement = (bundle.sceneInstances?.scenes ?? [])
    .flatMap((scene) => scene.actorInstances)
    .find((candidate) => candidate.id === actorInstanceId);
  if (!placement) {
    return {
      kind: "invalid",
      reason: "unknown-requested-actor",
      requestedActorInstanceId: actorInstanceId,
    };
  }
  return {
    kind: "selected",
    actorInstanceId: placement.id,
    explicit: true,
  };
};

export const selectControlledActorInstance = (
  bundle: Pick<RuntimeBundle, "startSceneId" | "sceneInstances">,
  requestedActorInstanceId: string | null,
): ControlledActorSelection => {
  if (requestedActorInstanceId !== null) {
    const saved = savedActorRequest(requestedActorInstanceId);
    if (saved !== undefined) {
      return selectSavedControlledActor(bundle, saved);
    }
  }
  return selectBrowserControlledActorInstance(bundle, requestedActorInstanceId);
};
