import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  moveProtagonist,
  type MultiProtagonistState,
  type ProtagonistId,
} from "@evavo/adventure-scene-runtime/multi-protagonist";

const SHARED_PREFIX = "multi.shared.";
const FACT_PREFIX = "multi.fact.";
const localPrefix = (protagonistId: ProtagonistId): string => `multi.local.${protagonistId}.`;

const withoutMultiFlags = (flags: Readonly<Record<string, boolean>>): Record<string, boolean> =>
  Object.fromEntries(Object.entries(flags).filter(([key]) => !key.startsWith("multi.")));

export const projectMultiProtagonistIntoWorld = (
  world: InteractiveRuntimeWorldState,
  state: MultiProtagonistState,
): InteractiveRuntimeWorldState => {
  const protagonist = state.protagonists[state.activeProtagonistId];
  if (!protagonist) throw new Error(`Active protagonist '${state.activeProtagonistId}' is missing.`);
  const projectedFlags: Record<string, boolean> = {};
  for (const [flag, value] of Object.entries(state.sharedFlags)) projectedFlags[`${SHARED_PREFIX}${flag}`] = value;
  for (const factId of state.sharedFacts) projectedFlags[`${FACT_PREFIX}${factId}`] = true;
  for (const [flag, value] of Object.entries(protagonist.flags)) {
    projectedFlags[`${localPrefix(state.activeProtagonistId)}${flag}`] = value;
  }
  return {
    ...world,
    story: {
      ...world.story,
      currentSceneId: protagonist.location.sceneId,
      currentEntranceId: protagonist.location.entranceId,
      inventory: [...protagonist.inventory],
      flags: { ...withoutMultiFlags(world.story.flags), ...projectedFlags },
    },
  };
};

const collectFlags = (
  flags: Readonly<Record<string, boolean>>,
  prefix: string,
): Readonly<Record<string, boolean>> =>
  Object.fromEntries(
    Object.entries(flags)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );

export const commitWorldToActiveProtagonist = (
  state: MultiProtagonistState,
  world: InteractiveRuntimeWorldState,
): MultiProtagonistState => {
  const protagonistId = state.activeProtagonistId;
  const protagonist = state.protagonists[protagonistId];
  if (!protagonist) throw new Error(`Active protagonist '${protagonistId}' is missing.`);
  const moved = moveProtagonist(state, protagonistId, {
    sceneId: world.story.currentSceneId,
    entranceId: world.story.currentEntranceId,
  });
  return {
    ...moved,
    protagonists: {
      ...moved.protagonists,
      [protagonistId]: {
        ...moved.protagonists[protagonistId]!,
        inventory: [...world.story.inventory].sort((left, right) => left.localeCompare(right)),
        flags: collectFlags(world.story.flags, localPrefix(protagonistId)),
      },
    },
    sharedFlags: collectFlags(world.story.flags, SHARED_PREFIX),
    sharedFacts: Object.entries(world.story.flags)
      .filter(([key, value]) => value && key.startsWith(FACT_PREFIX))
      .map(([key]) => key.slice(FACT_PREFIX.length))
      .sort((left, right) => left.localeCompare(right)),
  };
};
