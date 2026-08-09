import type { Action, AdventureProject, Id, Interaction } from "@evavo/adventure-project-schema";
import type {
  ObjectDefinition,
  ObjectStateDefinition,
  SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import {
  type AdventureProgressionRuntimeContext,
  activeAdventureProgressionDialogue,
  applyImmediateAdventureProgressionActions,
  canonicalAdventureProgressionState,
  continueAdventureProgressionDialogue,
  evaluateAdventureProgressionCondition,
  processAdventureProgressionRequests,
  transitionAdventureProgressionDialogueChoice,
} from "./progression-runtime.js";
import type { AdventureProgressionRuntimeState, AdventureProgressionStep } from "./progression-types.js";

export interface AdventureProgressionCandidate {
  readonly id: string;
  readonly step: AdventureProgressionStep;
  apply(
    state: AdventureProgressionRuntimeState,
    context: AdventureProgressionRuntimeContext,
  ): AdventureProgressionRuntimeState;
}

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const actionLabel = (action: Action): string => {
  switch (action.kind) {
    case "say":
      return "say";
    case "set-flag":
      return `flag ${action.flag}=${String(action.value)}`;
    case "set-variable":
      return `variable ${action.variable}=${String(action.value)}`;
    case "give-item":
      return `give ${action.itemId}`;
    case "remove-item":
      return `remove ${action.itemId}`;
    case "award-score":
      return `score ${action.awardId}`;
    case "change-scene":
      return `scene ${action.sceneId}`;
    case "play-sequence":
      return `sequence ${action.sequenceId}`;
    case "start-dialogue":
      return `dialogue ${action.dialogueId}`;
    case "set-object-state":
      return `state ${action.objectId}=${action.state}`;
  }
};

const interactionAvailable = (state: AdventureProgressionRuntimeState, interaction: Interaction): boolean =>
  (!interaction.once || !state.consumedInteractionIds.includes(interaction.id)) &&
  (!interaction.itemId || state.inventoryItemIds.includes(interaction.itemId)) &&
  (!interaction.when || evaluateAdventureProgressionCondition(interaction.when, state));

const executeInteraction = (
  state: AdventureProgressionRuntimeState,
  interaction: Interaction,
  context: AdventureProgressionRuntimeContext,
): AdventureProgressionRuntimeState => {
  const immediate = applyImmediateAdventureProgressionActions(state, interaction.actions);
  const consumed = interaction.once
    ? canonicalAdventureProgressionState({
        ...immediate.state,
        consumedInteractionIds: sortedUnique([...immediate.state.consumedInteractionIds, interaction.id]),
      })
    : immediate.state;
  return processAdventureProgressionRequests(consumed, immediate.requests, context, []);
};

const sceneInteractionCandidates = (
  project: AdventureProject,
  state: AdventureProgressionRuntimeState,
): AdventureProgressionCandidate[] => {
  const sceneIndex = project.scenes.findIndex((scene) => scene.id === state.currentSceneId);
  const scene = sceneIndex >= 0 ? project.scenes[sceneIndex] : undefined;
  if (!scene) return [];
  const candidates: AdventureProgressionCandidate[] = [];
  scene.hotspots.forEach((hotspot, hotspotIndex) => {
    hotspot.interactions.forEach((interaction, interactionIndex) => {
      if (!interactionAvailable(state, interaction)) return;
      const sourcePath = `scenes[${sceneIndex}].hotspots[${hotspotIndex}].interactions[${interactionIndex}]`;
      candidates.push({
        id: `scene:${scene.id}:${interaction.id}`,
        step: {
          id: `step.scene.${interaction.id}`,
          kind: "scene-interaction",
          label: `${hotspot.name} · ${interaction.verb}`,
          sourcePath,
          sceneId: scene.id,
          actionSummary: interaction.actions.map(actionLabel),
        },
        apply: (current, context) => executeInteraction(current, interaction, context),
      });
    });
  });
  return candidates;
};

const effectiveObjectState = (
  objectId: Id<"object">,
  definition: ObjectDefinition,
  initialStateId: Id<"object-state"> | undefined,
  state: AdventureProgressionRuntimeState,
): ObjectStateDefinition | undefined => {
  const stateId = state.objectStates[objectId] ?? initialStateId ?? definition.initialStateId;
  return definition.states.find((candidate) => candidate.id === stateId);
};

const objectInteractionCandidates = (
  manifest: SceneInstanceManifest,
  state: AdventureProgressionRuntimeState,
): AdventureProgressionCandidate[] => {
  const compositionIndex = manifest.scenes.findIndex(
    (composition) => composition.sceneId === state.currentSceneId,
  );
  const composition = compositionIndex >= 0 ? manifest.scenes[compositionIndex] : undefined;
  if (!composition) return [];
  const definitions = new Map(
    manifest.objectDefinitions.map((definition) => [definition.id as string, definition] as const),
  );
  const candidates: AdventureProgressionCandidate[] = [];
  composition.objectInstances.forEach((instance) => {
    if (instance.visibleWhen && !evaluateAdventureProgressionCondition(instance.visibleWhen, state)) {
      return;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition) return;
    const objectState = effectiveObjectState(instance.id, definition, instance.initialStateId, state);
    if (!objectState || objectState.visible === false || !objectState.interactionShape) {
      return;
    }
    const stateIndex = definition.states.findIndex((candidate) => candidate.id === objectState.id);
    objectState.interactions.forEach((interaction, interactionIndex) => {
      if (!interactionAvailable(state, interaction)) return;
      const sourcePath =
        `objectDefinitions.${definition.id}.states[${stateIndex}]` + `.interactions[${interactionIndex}]`;
      candidates.push({
        id: `object:${instance.id}:${objectState.id}:${interaction.id}`,
        step: {
          id: `step.object.${interaction.id}`,
          kind: "object-interaction",
          label: `${definition.name} · ${interaction.verb}`,
          sourcePath,
          sceneId: state.currentSceneId,
          actionSummary: interaction.actions.map(actionLabel),
        },
        apply: (current, context) => executeInteraction(current, interaction, context),
      });
    });
  });
  return candidates;
};

const dialogueCandidates = (
  state: AdventureProgressionRuntimeState,
  context: AdventureProgressionRuntimeContext,
): AdventureProgressionCandidate[] => {
  const active = activeAdventureProgressionDialogue(state, context);
  if (!active) return [];
  const { graph, node } = active;
  const enabled = node.choices.filter(
    (choice) =>
      (!choice.once || !state.consumedDialogueChoiceIds.includes(choice.id)) &&
      (!choice.visibleWhen || evaluateAdventureProgressionCondition(choice.visibleWhen, state)) &&
      (!choice.enabledWhen || evaluateAdventureProgressionCondition(choice.enabledWhen, state)),
  );
  if (enabled.length === 0) {
    return [
      {
        id: `dialogue:${graph.id}:${node.id}:continue`,
        step: {
          id: `step.dialogue.${graph.id}.${node.id}.continue`,
          kind: "dialogue-continue",
          label: `${graph.name} · continue`,
          sourcePath: `dialogues.${graph.id}.nodes.${node.id}`,
          sceneId: state.currentSceneId,
          actionSummary: [
            ...node.exitActions.map(actionLabel),
            ...(node.autoNextNodeId ? [`node ${node.autoNextNodeId}`] : ["end dialogue"]),
          ],
        },
        apply: (current, runtimeContext) =>
          continueAdventureProgressionDialogue(current, graph, node, runtimeContext),
      },
    ];
  }
  return enabled.map((choice) => ({
    id: `dialogue:${graph.id}:${node.id}:${choice.id}`,
    step: {
      id: `step.dialogue.${choice.id}`,
      kind: "dialogue-choice",
      label: `${graph.name} · ${choice.text}`,
      sourcePath: `dialogues.${graph.id}.nodes.${node.id}.choices.${choice.id}`,
      sceneId: state.currentSceneId,
      actionSummary: [
        ...choice.actions.map(actionLabel),
        ...(choice.closeDialogue
          ? ["end dialogue"]
          : choice.nextNodeId
            ? [`node ${choice.nextNodeId}`]
            : node.autoNextNodeId
              ? [`node ${node.autoNextNodeId}`]
              : ["end dialogue"]),
      ],
    },
    apply: (current, runtimeContext) =>
      transitionAdventureProgressionDialogueChoice(current, graph, node, choice.id, runtimeContext),
  }));
};

const candidateOrder: Readonly<Record<AdventureProgressionStep["kind"], number>> = {
  "scene-interaction": 0,
  "object-interaction": 1,
  "dialogue-choice": 2,
  "dialogue-continue": 3,
};

export const enumerateAdventureProgressionCandidates = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  state: AdventureProgressionRuntimeState,
  context: AdventureProgressionRuntimeContext,
): readonly AdventureProgressionCandidate[] => {
  const candidates = state.activeDialogue
    ? dialogueCandidates(state, context)
    : [...sceneInteractionCandidates(project, state), ...objectInteractionCandidates(manifest, state)];
  return candidates.sort(
    (left, right) =>
      candidateOrder[left.step.kind] - candidateOrder[right.step.kind] || left.id.localeCompare(right.id),
  );
};
