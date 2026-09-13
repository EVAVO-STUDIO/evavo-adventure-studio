import type { Id } from "@evavo/adventure-project-schema";

export type ProtagonistId = Id<"actor">;

export interface ProtagonistLocationState {
  readonly sceneId: Id<"scene">;
  readonly entranceId: Id<"entrance">;
}

export interface ProtagonistRuntimeState {
  readonly protagonistId: ProtagonistId;
  readonly location: ProtagonistLocationState;
  readonly inventory: readonly Id<"item">[];
  readonly flags: Readonly<Record<string, boolean>>;
}

export interface MultiProtagonistState {
  readonly activeProtagonistId: ProtagonistId;
  readonly protagonists: Readonly<Record<string, ProtagonistRuntimeState>>;
  readonly sharedFlags: Readonly<Record<string, boolean>>;
  readonly sharedFacts: readonly string[];
}

export interface MultiProtagonistDefinition {
  readonly protagonistId: ProtagonistId;
  readonly startSceneId: Id<"scene">;
  readonly startEntranceId: Id<"entrance">;
  readonly startingInventory?: readonly Id<"item">[];
}

const uniqueSorted = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const createMultiProtagonistState = (
  definitions: readonly MultiProtagonistDefinition[],
  activeProtagonistId: ProtagonistId,
): MultiProtagonistState => {
  if (definitions.length < 2) {
    throw new RangeError("Multi-protagonist state requires at least two protagonists.");
  }
  const ids = new Set(definitions.map((definition) => definition.protagonistId as string));
  if (ids.size !== definitions.length) {
    throw new Error("Multi-protagonist definitions contain duplicate protagonist IDs.");
  }
  if (!ids.has(activeProtagonistId)) {
    throw new Error(`Active protagonist '${activeProtagonistId}' is not defined.`);
  }
  const protagonists: Record<string, ProtagonistRuntimeState> = {};
  for (const definition of definitions) {
    protagonists[definition.protagonistId] = {
      protagonistId: definition.protagonistId,
      location: {
        sceneId: definition.startSceneId,
        entranceId: definition.startEntranceId,
      },
      inventory: uniqueSorted(definition.startingInventory ?? []),
      flags: {},
    };
  }
  return {
    activeProtagonistId,
    protagonists,
    sharedFlags: {},
    sharedFacts: [],
  };
};

const protagonistFor = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
): ProtagonistRuntimeState => {
  const protagonist = state.protagonists[protagonistId];
  if (!protagonist) throw new Error(`Unknown protagonist '${protagonistId}'.`);
  return protagonist;
};

const replaceProtagonist = (
  state: MultiProtagonistState,
  protagonist: ProtagonistRuntimeState,
): MultiProtagonistState => ({
  ...state,
  protagonists: {
    ...state.protagonists,
    [protagonist.protagonistId]: protagonist,
  },
});

export const switchActiveProtagonist = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
): MultiProtagonistState => {
  protagonistFor(state, protagonistId);
  return protagonistId === state.activeProtagonistId
    ? state
    : { ...state, activeProtagonistId: protagonistId };
};

export const moveProtagonist = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
  location: ProtagonistLocationState,
): MultiProtagonistState =>
  replaceProtagonist(state, {
    ...protagonistFor(state, protagonistId),
    location,
  });

export const giveProtagonistItem = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
  itemId: Id<"item">,
): MultiProtagonistState => {
  const protagonist = protagonistFor(state, protagonistId);
  if (protagonist.inventory.includes(itemId)) return state;
  return replaceProtagonist(state, {
    ...protagonist,
    inventory: uniqueSorted([...protagonist.inventory, itemId]),
  });
};

export const removeProtagonistItem = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
  itemId: Id<"item">,
): MultiProtagonistState => {
  const protagonist = protagonistFor(state, protagonistId);
  if (!protagonist.inventory.includes(itemId)) return state;
  return replaceProtagonist(state, {
    ...protagonist,
    inventory: protagonist.inventory.filter((candidate) => candidate !== itemId),
  });
};

export const transferProtagonistItem = (
  state: MultiProtagonistState,
  fromProtagonistId: ProtagonistId,
  toProtagonistId: ProtagonistId,
  itemId: Id<"item">,
): MultiProtagonistState => {
  if (fromProtagonistId === toProtagonistId) return state;
  const source = protagonistFor(state, fromProtagonistId);
  protagonistFor(state, toProtagonistId);
  if (!source.inventory.includes(itemId)) {
    throw new Error(`Protagonist '${fromProtagonistId}' does not hold item '${itemId}'.`);
  }
  return giveProtagonistItem(
    removeProtagonistItem(state, fromProtagonistId, itemId),
    toProtagonistId,
    itemId,
  );
};

export const setProtagonistFlag = (
  state: MultiProtagonistState,
  protagonistId: ProtagonistId,
  flag: string,
  value: boolean,
): MultiProtagonistState => {
  const protagonist = protagonistFor(state, protagonistId);
  return replaceProtagonist(state, {
    ...protagonist,
    flags: { ...protagonist.flags, [flag]: value },
  });
};

export const setSharedWorldFlag = (
  state: MultiProtagonistState,
  flag: string,
  value: boolean,
): MultiProtagonistState => ({
  ...state,
  sharedFlags: { ...state.sharedFlags, [flag]: value },
});

export const discoverSharedWorldFact = (
  state: MultiProtagonistState,
  factId: string,
): MultiProtagonistState => ({
  ...state,
  sharedFacts: uniqueSorted([...state.sharedFacts, factId]),
});

export interface CrossProtagonistMutation {
  readonly setSharedFlags?: Readonly<Record<string, boolean>>;
  readonly addSharedFactIds?: readonly string[];
  readonly setTargetFlags?: Readonly<Record<string, boolean>>;
  readonly moveTargetTo?: ProtagonistLocationState;
}

export const applyCrossProtagonistMutation = (
  state: MultiProtagonistState,
  targetProtagonistId: ProtagonistId,
  mutation: CrossProtagonistMutation,
): MultiProtagonistState => {
  let next = state;
  for (const [flag, value] of Object.entries(mutation.setSharedFlags ?? {})) {
    next = setSharedWorldFlag(next, flag, value);
  }
  for (const factId of mutation.addSharedFactIds ?? []) {
    next = discoverSharedWorldFact(next, factId);
  }
  for (const [flag, value] of Object.entries(mutation.setTargetFlags ?? {})) {
    next = setProtagonistFlag(next, targetProtagonistId, flag, value);
  }
  if (mutation.moveTargetTo) {
    next = moveProtagonist(next, targetProtagonistId, mutation.moveTargetTo);
  }
  return next;
};
