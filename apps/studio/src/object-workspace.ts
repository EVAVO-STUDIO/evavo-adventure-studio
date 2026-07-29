import {
  createEditorHistory,
  executeEditorCommand,
  isEditorDocumentDirty,
  markEditorHistorySaved,
  redoEditorCommand,
  undoEditorCommand,
  type EditorCommand,
  type EditorHistoryState,
} from "@evavo/adventure-editor-core";
import type { AdventureProject, Id, Interaction } from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";

export interface ObjectWorkspaceState {
  readonly project: AdventureProject;
  readonly history: EditorHistoryState;
  readonly definitionId: Id<"object-definition"> | null;
  readonly stateId: Id<"object-state"> | null;
  readonly interactionId: Id<"interaction"> | null;
  readonly notice: string | null;
}

export type ObjectWorkspaceAction =
  | {
      readonly type: "select-definition";
      readonly definitionId: Id<"object-definition">;
    }
  | { readonly type: "select-state"; readonly stateId: Id<"object-state"> }
  | {
      readonly type: "select-interaction";
      readonly interactionId: Id<"interaction"> | null;
    }
  | {
      readonly type: "execute";
      readonly command: EditorCommand;
      readonly stateId?: Id<"object-state"> | null;
      readonly interactionId?: Id<"interaction"> | null;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" };

const firstDefinition = (
  manifest: SceneInstanceManifest,
): ObjectDefinition | null => manifest.objectDefinitions[0] ?? null;

const firstState = (definition: ObjectDefinition | null): ObjectStateDefinition | null =>
  definition?.states[0] ?? null;

export const createObjectWorkspace = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
): ObjectWorkspaceState => {
  const definition = firstDefinition(manifest);
  const state = firstState(definition);
  return {
    project,
    history: createEditorHistory(manifest),
    definitionId: definition?.id ?? null,
    stateId: state?.id ?? null,
    interactionId: null,
    notice: null,
  };
};

export const objectWorkspaceReducer = (
  state: ObjectWorkspaceState,
  action: ObjectWorkspaceAction,
): ObjectWorkspaceState => {
  switch (action.type) {
    case "select-definition": {
      const definition = state.history.document.manifest.objectDefinitions.find(
        (candidate) => candidate.id === action.definitionId,
      );
      return {
        ...state,
        definitionId: action.definitionId,
        stateId: definition?.states[0]?.id ?? null,
        interactionId: null,
        notice: null,
      };
    }
    case "select-state":
      return {
        ...state,
        stateId: action.stateId,
        interactionId: null,
        notice: null,
      };
    case "select-interaction":
      return { ...state, interactionId: action.interactionId, notice: null };
    case "execute":
      return {
        ...state,
        history: executeEditorCommand(state.history, action.command),
        stateId: action.stateId === undefined ? state.stateId : action.stateId,
        interactionId:
          action.interactionId === undefined
            ? state.interactionId
            : action.interactionId,
        notice: action.notice ?? null,
      };
    case "undo":
      return {
        ...state,
        history: undoEditorCommand(state.history),
        interactionId: null,
        notice: "Undid the last object-definition edit.",
      };
    case "redo":
      return {
        ...state,
        history: redoEditorCommand(state.history),
        interactionId: null,
        notice: "Redid the object-definition edit.",
      };
    case "mark-saved":
      return {
        ...state,
        history: markEditorHistorySaved(state.history),
        notice: "Object definitions marked as saved.",
      };
  }
};

export const objectManifest = (
  state: ObjectWorkspaceState,
): SceneInstanceManifest => state.history.document.manifest;

export const objectWorkspaceIsDirty = (state: ObjectWorkspaceState): boolean =>
  isEditorDocumentDirty(state.history.document);

export const selectedObjectDefinition = (
  state: ObjectWorkspaceState,
): ObjectDefinition | null =>
  objectManifest(state).objectDefinitions.find(
    (candidate) => candidate.id === state.definitionId,
  ) ?? null;

export const selectedObjectState = (
  state: ObjectWorkspaceState,
): ObjectStateDefinition | null =>
  selectedObjectDefinition(state)?.states.find(
    (candidate) => candidate.id === state.stateId,
  ) ?? null;

export const selectedObjectInteraction = (
  state: ObjectWorkspaceState,
): Interaction | null =>
  selectedObjectState(state)?.interactions.find(
    (candidate) => candidate.id === state.interactionId,
  ) ?? null;

const replaceDefinitionCommand = (
  definition: ObjectDefinition,
): EditorCommand => ({
  kind: "replace-object-definition",
  definitionId: definition.id,
  definition,
});

const manifestIds = (manifest: SceneInstanceManifest): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const definition of manifest.objectDefinitions) {
    ids.add(definition.id);
    for (const objectState of definition.states) {
      ids.add(objectState.id);
      for (const interaction of objectState.interactions) {
        ids.add(interaction.id);
      }
    }
  }
  for (const scene of manifest.scenes) {
    for (const actor of scene.actorInstances) ids.add(actor.id);
    for (const object of scene.objectInstances) ids.add(object.id);
    for (const portal of scene.navigationPortals) ids.add(portal.id);
  }
  return ids;
};

const uniqueId = (ids: ReadonlySet<string>, prefix: string): string => {
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

export const replaceSelectedObjectStateCommand = (
  state: ObjectWorkspaceState,
  nextState: ObjectStateDefinition,
): EditorCommand => {
  const definition = selectedObjectDefinition(state);
  if (!definition || !state.stateId) {
    throw new Error("Select an object state before editing it.");
  }
  if (nextState.id !== state.stateId) {
    throw new Error("Object-state replacement cannot change identity.");
  }
  return replaceDefinitionCommand({
    ...definition,
    states: definition.states.map((candidate) =>
      candidate.id === nextState.id ? nextState : candidate,
    ),
  });
};

export const insertObjectStateCommand = (
  state: ObjectWorkspaceState,
): {
  readonly command: EditorCommand;
  readonly stateId: Id<"object-state">;
} => {
  const definition = selectedObjectDefinition(state);
  if (!definition) {
    throw new Error("Select an object definition before adding a state.");
  }
  const stateId = asId<"object-state">(
    uniqueId(
      manifestIds(objectManifest(state)),
      `object-state.${definition.id}.state`,
    ),
  );
  const nextState: ObjectStateDefinition = {
    id: stateId,
    visible: false,
    interactions: [],
  };
  return {
    command: replaceDefinitionCommand({
      ...definition,
      states: [...definition.states, nextState],
    }),
    stateId,
  };
};

export const removeSelectedObjectStateCommand = (
  state: ObjectWorkspaceState,
): {
  readonly command: EditorCommand;
  readonly nextStateId: Id<"object-state">;
} => {
  const definition = selectedObjectDefinition(state);
  const selected = selectedObjectState(state);
  if (!definition || !selected) {
    throw new Error("Select an object state before removing it.");
  }
  if (definition.states.length <= 1) {
    throw new Error("Object definitions require at least one state.");
  }
  if (selected.id === definition.initialStateId) {
    throw new Error("Choose a different initial state before removing this state.");
  }
  const states = definition.states.filter((candidate) => candidate.id !== selected.id);
  const nextState = states[0];
  if (!nextState) {
    throw new Error("Object definitions require at least one state.");
  }
  return {
    command: replaceDefinitionCommand({ ...definition, states }),
    nextStateId: nextState.id,
  };
};

export const setInitialObjectStateCommand = (
  state: ObjectWorkspaceState,
  stateId: Id<"object-state">,
): EditorCommand => {
  const definition = selectedObjectDefinition(state);
  if (!definition) {
    throw new Error("Select an object definition first.");
  }
  if (!definition.states.some((candidate) => candidate.id === stateId)) {
    throw new Error(`Object state '${stateId}' does not exist.`);
  }
  return replaceDefinitionCommand({ ...definition, initialStateId: stateId });
};

export const insertStateInteractionCommand = (
  state: ObjectWorkspaceState,
): {
  readonly command: EditorCommand;
  readonly interactionId: Id<"interaction">;
} => {
  const objectState = selectedObjectState(state);
  if (!objectState) {
    throw new Error("Select an object state before adding an interaction.");
  }
  const interactionId = asId<"interaction">(
    uniqueId(
      manifestIds(objectManifest(state)),
      `interaction.${objectState.id}.verb`,
    ),
  );
  const interaction: Interaction = {
    id: interactionId,
    verb: "look",
    actions: [{ kind: "say", text: "Nothing unusual." }],
  };
  return {
    command: replaceSelectedObjectStateCommand(state, {
      ...objectState,
      interactions: [...objectState.interactions, interaction],
    }),
    interactionId,
  };
};

export const replaceSelectedInteractionCommand = (
  state: ObjectWorkspaceState,
  interaction: Interaction,
): EditorCommand => {
  const objectState = selectedObjectState(state);
  if (!objectState || !state.interactionId) {
    throw new Error("Select an interaction before editing it.");
  }
  if (interaction.id !== state.interactionId) {
    throw new Error("Interaction replacement cannot change identity.");
  }
  return replaceSelectedObjectStateCommand(state, {
    ...objectState,
    interactions: objectState.interactions.map((candidate) =>
      candidate.id === interaction.id ? interaction : candidate,
    ),
  });
};

export const removeSelectedInteractionCommand = (
  state: ObjectWorkspaceState,
): EditorCommand => {
  const objectState = selectedObjectState(state);
  if (!objectState || !state.interactionId) {
    throw new Error("Select an interaction before removing it.");
  }
  return replaceSelectedObjectStateCommand(state, {
    ...objectState,
    interactions: objectState.interactions.filter(
      (candidate) => candidate.id !== state.interactionId,
    ),
  });
};
