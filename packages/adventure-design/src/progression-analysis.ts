import type {
  Action,
  AdventureProject,
  Id,
} from "@evavo/adventure-project-schema";
import {
  emptySceneInstanceManifest,
  validateSceneInstanceManifest,
  type SceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import { validateProjectSemantics } from "@evavo/adventure-validation";
import { enumerateAdventureProgressionCandidates } from "./progression-candidates.js";
import {
  adventureProgressionStateHash,
  createAdventureProgressionRuntimeContext,
  createInitialAdventureProgressionState,
} from "./progression-runtime.js";
import type {
  AdventureProgressionFinding,
  AdventureProgressionMilestone,
  AdventureProgressionMilestoneKind,
  AdventureProgressionOptions,
  AdventureProgressionReport,
  AdventureProgressionRuntimeState,
  AdventureProgressionSceneEdge,
  AdventureProgressionStep,
  AdventureProgressionTerminalState,
  AdventureProgressionWitness,
} from "./progression-types.js";
import type { AdventureDesignDocument } from "./types.js";

interface ExplorerNode {
  readonly hash: string;
  readonly state: AdventureProgressionRuntimeState;
  readonly depth: number;
  readonly witness: readonly AdventureProgressionStep[];
}

interface ItemPathObjective {
  readonly puzzleId: string;
  readonly puzzleName: string;
  readonly puzzlePath: string;
  readonly alternatives: readonly (readonly Id<"item">[])[];
}

interface ProgressionObjectives {
  readonly requiredSceneIds: readonly Id<"scene">[];
  readonly itemPaths: readonly ItemPathObjective[];
}

const DEFAULT_MAXIMUM_STATES = 4096;
const DEFAULT_MAXIMUM_DEPTH = 64;
const DEFAULT_MAXIMUM_WITNESS_STEPS = 24;
const DEFAULT_MAXIMUM_NESTED_REQUESTS = 16;
const DEFAULT_MAXIMUM_TERMINAL_STATES = 64;

const severityOrder = { error: 0, warning: 1, note: 2 } as const;
const milestoneOrder: Readonly<Record<AdventureProgressionMilestoneKind, number>> = {
  scene: 0,
  item: 1,
  dialogue: 2,
  sequence: 3,
  "object-state": 4,
};

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const positiveSafeInteger = (
  value: number | undefined,
  fallback: number,
  label: string,
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return resolved;
};

const resolvedLimits = (options: AdventureProgressionOptions) => ({
  maximumStates: positiveSafeInteger(
    options.maximumStates,
    DEFAULT_MAXIMUM_STATES,
    "maximumStates",
  ),
  maximumDepth: positiveSafeInteger(
    options.maximumDepth,
    DEFAULT_MAXIMUM_DEPTH,
    "maximumDepth",
  ),
  maximumWitnessSteps: positiveSafeInteger(
    options.maximumWitnessSteps,
    DEFAULT_MAXIMUM_WITNESS_STEPS,
    "maximumWitnessSteps",
  ),
  maximumNestedRequests: positiveSafeInteger(
    options.maximumNestedRequests ?? options.maximumNestedSequences,
    DEFAULT_MAXIMUM_NESTED_REQUESTS,
    "maximumNestedRequests",
  ),
  maximumTerminalStates: positiveSafeInteger(
    options.maximumTerminalStates,
    DEFAULT_MAXIMUM_TERMINAL_STATES,
    "maximumTerminalStates",
  ),
});

const boundedWitness = (
  witness: readonly AdventureProgressionStep[],
  maximumSteps: number,
): readonly AdventureProgressionStep[] =>
  witness.length <= maximumSteps ? witness : witness.slice(0, maximumSteps);

const extendWitness = (
  witness: readonly AdventureProgressionStep[],
  step: AdventureProgressionStep,
  maximumSteps: number,
): readonly AdventureProgressionStep[] =>
  boundedWitness([...witness, step], maximumSteps);

const witness = (
  steps: readonly AdventureProgressionStep[],
): AdventureProgressionWitness => ({ steps });

const canonicalSceneInstanceContext = (project: AdventureProject) => ({
  projectId: project.id,
  scenes: project.scenes,
  actors: project.actors,
  assets: project.assets,
  inventoryItems: project.inventoryItems,
  dialogues: project.dialogues,
  sequences: project.sequences,
});

const deriveObjectives = (
  project: AdventureProject,
  design: AdventureDesignDocument | undefined,
): ProgressionObjectives => {
  if (!design || design.projectId !== project.id) {
    return {
      requiredSceneIds: project.scenes.map((scene) => scene.id),
      itemPaths: [],
    };
  }

  const projectSceneIds = new Set(project.scenes.map((scene) => scene.id as string));
  const requiredSceneIds = sortedUnique(
    design.map.locations.flatMap((location) =>
      location.sceneId && projectSceneIds.has(location.sceneId)
        ? [location.sceneId]
        : [],
    ),
  );

  const itemPaths: ItemPathObjective[] = [];
  design.puzzles.forEach((puzzle, puzzleIndex) => {
    if (puzzle.optional) return;
    const alternatives = puzzle.solutions.map((solution) =>
      sortedUnique(
        solution.steps.flatMap((step) => (step.itemId ? [step.itemId] : [])),
      ),
    );
    if (alternatives.some((alternative) => alternative.length === 0)) return;
    const uniqueAlternatives = new Map<string, readonly Id<"item">[]>();
    for (const alternative of alternatives) {
      uniqueAlternatives.set(alternative.join("\u0000"), alternative);
    }
    if (uniqueAlternatives.size === 0) return;
    itemPaths.push({
      puzzleId: puzzle.id,
      puzzleName: puzzle.name,
      puzzlePath: `design.puzzles[${puzzleIndex}].solutions`,
      alternatives: [...uniqueAlternatives.values()].sort((left, right) =>
        left.join("\u0000").localeCompare(right.join("\u0000")),
      ),
    });
  });

  return { requiredSceneIds, itemPaths };
};

const itemPathSatisfied = (
  objective: ItemPathObjective,
  acquiredItemIds: readonly Id<"item">[],
): boolean => {
  const acquired = new Set(acquiredItemIds);
  return objective.alternatives.some((alternative) =>
    alternative.every((itemId) => acquired.has(itemId)),
  );
};

const objectiveCoverage = (
  state: AdventureProgressionRuntimeState,
  objectives: ProgressionObjectives,
): number => {
  const visited = new Set(state.visitedSceneIds);
  return (
    objectives.requiredSceneIds.filter((sceneId) => visited.has(sceneId)).length +
    objectives.itemPaths.filter((objective) =>
      itemPathSatisfied(objective, state.acquiredItemIds),
    ).length
  );
};

const objectiveTotal = (objectives: ProgressionObjectives): number =>
  objectives.requiredSceneIds.length + objectives.itemPaths.length;

const coveragePercent = (coverage: number, total: number): number =>
  total === 0 ? 100 : Math.round((coverage / total) * 1000) / 10;

const milestoneKey = (
  kind: AdventureProgressionMilestoneKind,
  id: string,
): string => `${kind}:${id}`;

const objectLabels = (
  manifest: SceneInstanceManifest,
): ReadonlyMap<string, string> => {
  const definitions = new Map(
    manifest.objectDefinitions.map(
      (definition) => [definition.id as string, definition.name] as const,
    ),
  );
  return new Map(
    manifest.scenes.flatMap((composition) =>
      composition.objectInstances.map((instance) => [
        instance.id as string,
        definitions.get(instance.definitionId) ?? instance.id,
      ] as const),
    ),
  );
};

const collectMilestones = (
  node: ExplorerNode,
  project: AdventureProject,
  objectNames: ReadonlyMap<string, string>,
  milestones: Map<string, AdventureProgressionMilestone>,
): void => {
  const route = witness(node.witness);
  const sceneNames = new Map(
    project.scenes.map((scene) => [scene.id as string, scene.name] as const),
  );
  const itemNames = new Map(
    project.inventoryItems.map((item) => [item.id as string, item.name] as const),
  );
  const dialogueNames = new Map(
    project.dialogues.map((dialogue) => [dialogue.id as string, dialogue.name] as const),
  );
  const sequenceNames = new Map(
    project.sequences.map((sequence) => [sequence.id as string, sequence.name] as const),
  );

  for (const sceneId of node.state.visitedSceneIds) {
    const key = milestoneKey("scene", sceneId);
    if (!milestones.has(key)) {
      milestones.set(key, {
        kind: "scene",
        id: sceneId,
        label: sceneNames.get(sceneId) ?? sceneId,
        depth: node.depth,
        witness: route,
      });
    }
  }
  for (const itemId of node.state.acquiredItemIds) {
    const key = milestoneKey("item", itemId);
    if (!milestones.has(key)) {
      milestones.set(key, {
        kind: "item",
        id: itemId,
        label: itemNames.get(itemId) ?? itemId,
        depth: node.depth,
        witness: route,
      });
    }
  }
  for (const dialogueId of node.state.reachedDialogueIds) {
    const key = milestoneKey("dialogue", dialogueId);
    if (!milestones.has(key)) {
      milestones.set(key, {
        kind: "dialogue",
        id: dialogueId,
        label: dialogueNames.get(dialogueId) ?? dialogueId,
        depth: node.depth,
        witness: route,
      });
    }
  }
  for (const sequenceId of node.state.reachedSequenceIds) {
    const key = milestoneKey("sequence", sequenceId);
    if (!milestones.has(key)) {
      milestones.set(key, {
        kind: "sequence",
        id: sequenceId,
        label: sequenceNames.get(sequenceId) ?? sequenceId,
        depth: node.depth,
        witness: route,
      });
    }
  }
  for (const [objectId, stateId] of Object.entries(node.state.objectStates)) {
    const id = `${objectId}:${stateId}`;
    const key = milestoneKey("object-state", id);
    if (!milestones.has(key)) {
      milestones.set(key, {
        kind: "object-state",
        id,
        label: `${objectNames.get(objectId) ?? objectId} · ${stateId.split(".").at(-1) ?? stateId}`,
        depth: node.depth,
        witness: route,
      });
    }
  }
};

const actionReferences = (
  action: Action,
  dialogues: Set<string>,
  sequences: Set<string>,
): void => {
  if (action.kind === "start-dialogue") dialogues.add(action.dialogueId);
  if (action.kind === "play-sequence") sequences.add(action.sequenceId);
};

const referencedNarrative = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
): {
  readonly dialogues: ReadonlySet<string>;
  readonly sequences: ReadonlySet<string>;
} => {
  const dialogues = new Set<string>();
  const sequences = new Set<string>();
  const inspectActions = (actions: readonly Action[]): void => {
    for (const action of actions) actionReferences(action, dialogues, sequences);
  };

  for (const scene of project.scenes) {
    for (const hotspot of scene.hotspots) {
      for (const interaction of hotspot.interactions) inspectActions(interaction.actions);
    }
  }
  for (const definition of manifest.objectDefinitions) {
    for (const state of definition.states) {
      for (const interaction of state.interactions) inspectActions(interaction.actions);
    }
  }
  for (const dialogue of project.dialogues) {
    for (const node of dialogue.nodes) {
      inspectActions(node.enterActions);
      inspectActions(node.exitActions);
      for (const choice of node.choices) inspectActions(choice.actions);
    }
  }
  for (const sequence of project.sequences) {
    inspectActions(sequence.skip.completionActions);
    for (const track of sequence.tracks) {
      for (const cue of track.cues) {
        if (cue.kind === "story-action") inspectActions([cue.action]);
      }
    }
  }
  return { dialogues, sequences };
};

const findingKey = (finding: AdventureProgressionFinding): string =>
  [finding.code, finding.severity, finding.path, finding.message].join("|");

const uniqueSortedFindings = (
  findings: readonly AdventureProgressionFinding[],
): readonly AdventureProgressionFinding[] => {
  const unique = new Map<string, AdventureProgressionFinding>();
  for (const finding of findings) unique.set(findingKey(finding), finding);
  return [...unique.values()].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
};

const compactStateId = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `state-${hash.toString(16).padStart(16, "0")}`;
};

const terminalState = (
  node: ExplorerNode,
  objectives: ProgressionObjectives,
): AdventureProgressionTerminalState => {
  const coverage = objectiveCoverage(node.state, objectives);
  const total = objectiveTotal(objectives);
  return {
    stateId: compactStateId(node.hash),
    currentSceneId: node.state.currentSceneId,
    depth: node.depth,
    coveragePercent: coveragePercent(coverage, total),
    objectiveCoverage: coverage,
    objectiveTotal: total,
    visitedSceneIds: node.state.visitedSceneIds,
    inventoryItemIds: node.state.inventoryItemIds,
    acquiredItemIds: node.state.acquiredItemIds,
    activeDialogueId: node.state.activeDialogue?.dialogueId ?? null,
    witness: witness(node.witness),
  };
};

export const evaluateAdventureProgression = (
  project: AdventureProject,
  design?: AdventureDesignDocument,
  sceneInstances: SceneInstanceManifest = emptySceneInstanceManifest(project.id),
  options: AdventureProgressionOptions = {},
): AdventureProgressionReport => {
  const limits = resolvedLimits(options);
  const findings: AdventureProgressionFinding[] = [];
  const projectIssues = validateProjectSemantics(project);
  for (const issue of projectIssues) {
    if (issue.severity !== "error") continue;
    findings.push({
      code: "canonical-project-error",
      severity: "error",
      path: issue.path,
      message: issue.message,
      recommendation:
        "Resolve the canonical project error before relying on progression analysis.",
    });
  }
  const instanceIssues = validateSceneInstanceManifest(
    canonicalSceneInstanceContext(project),
    sceneInstances,
  );
  for (const issue of instanceIssues) {
    findings.push({
      code: "canonical-scene-instance-error",
      severity: "error",
      path: issue.path,
      message: issue.message,
      recommendation:
        "Resolve the canonical scene-instance error before relying on progression analysis.",
    });
  }
  if (design && design.projectId !== project.id) {
    findings.push({
      code: "design-project-mismatch",
      severity: "error",
      path: "design.projectId",
      message: `Adventure Design project '${design.projectId}' does not match '${project.id}'.`,
      recommendation: "Load the design sidecar that belongs to this canonical project.",
    });
  }

  const objectives = deriveObjectives(project, design);
  const totalObjectives = objectiveTotal(objectives);
  const runtimeContext = createAdventureProgressionRuntimeContext(
    project,
    sceneInstances,
    { maximumNestedRequests: limits.maximumNestedRequests },
  );
  const initialState = createInitialAdventureProgressionState(project, sceneInstances);
  const initialHash = adventureProgressionStateHash(initialState);
  const initialNode: ExplorerNode = {
    hash: initialHash,
    state: initialState,
    depth: 0,
    witness: [],
  };
  const nodes = new Map<string, ExplorerNode>([[initialHash, initialNode]]);
  const queue: string[] = [initialHash];
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  const terminalHashes = new Set<string>();
  const milestones = new Map<string, AdventureProgressionMilestone>();
  const sceneEdges = new Map<string, AdventureProgressionSceneEdge>();
  const objectNames = objectLabels(sceneInstances);
  const noProgressFindings = new Map<string, AdventureProgressionFinding>();
  let exploredTransitions = 0;
  let maximumDepthReached = 0;
  let truncated = false;

  while (queue.length > 0) {
    const hash = queue.shift();
    if (!hash) continue;
    const node = nodes.get(hash);
    if (!node) continue;
    maximumDepthReached = Math.max(maximumDepthReached, node.depth);
    collectMilestones(node, project, objectNames, milestones);
    const candidates = enumerateAdventureProgressionCandidates(
      project,
      sceneInstances,
      node.state,
      runtimeContext,
    );
    let changedCandidateCount = 0;

    for (const candidate of candidates) {
      const nextState = candidate.apply(node.state, runtimeContext);
      const nextHash = adventureProgressionStateHash(nextState);
      if (nextHash === hash) {
        const key = `${candidate.step.sourcePath}|${candidate.id}`;
        if (!noProgressFindings.has(key)) {
          noProgressFindings.set(key, {
            code: "no-progress-interaction",
            severity: "note",
            path: candidate.step.sourcePath,
            message:
              `Available action '${candidate.step.label}' produces no canonical ` +
              "progression-state change.",
            recommendation:
              "Keep feedback-only actions deliberate, or add a visible state " +
              "consequence when progression is intended.",
            witness: witness(
              extendWitness(node.witness, candidate.step, limits.maximumWitnessSteps),
            ),
          });
        }
        continue;
      }

      changedCandidateCount += 1;
      exploredTransitions += 1;
      const nextWitness = extendWitness(
        node.witness,
        candidate.step,
        limits.maximumWitnessSteps,
      );
      const edgeTargets = forward.get(hash) ?? new Set<string>();
      edgeTargets.add(nextHash);
      forward.set(hash, edgeTargets);
      const edgeSources = reverse.get(nextHash) ?? new Set<string>();
      edgeSources.add(hash);
      reverse.set(nextHash, edgeSources);

      if (nextState.currentSceneId !== node.state.currentSceneId) {
        const edgeKey = [
          node.state.currentSceneId,
          nextState.currentSceneId,
          candidate.id,
        ].join("|");
        if (!sceneEdges.has(edgeKey)) {
          sceneEdges.set(edgeKey, {
            id: `edge.${sceneEdges.size + 1}`,
            fromSceneId: node.state.currentSceneId,
            toSceneId: nextState.currentSceneId,
            via: candidate.step.label,
            witness: witness(nextWitness),
          });
        }
      }

      if (nodes.has(nextHash)) continue;
      if (node.depth >= limits.maximumDepth) {
        truncated = true;
        continue;
      }
      if (nodes.size >= limits.maximumStates) {
        truncated = true;
        continue;
      }
      const nextNode: ExplorerNode = {
        hash: nextHash,
        state: nextState,
        depth: node.depth + 1,
        witness: nextWitness,
      };
      nodes.set(nextHash, nextNode);
      queue.push(nextHash);
    }

    if (changedCandidateCount === 0) terminalHashes.add(hash);
  }

  findings.push(...noProgressFindings.values());
  const nodeValues = [...nodes.values()];
  const reachableSceneIds = project.scenes
    .map((scene) => scene.id)
    .filter((sceneId) =>
      nodeValues.some((node) => node.state.visitedSceneIds.includes(sceneId)),
    );
  const obtainableItemIds = project.inventoryItems
    .map((item) => item.id)
    .filter((itemId) =>
      nodeValues.some((node) => node.state.acquiredItemIds.includes(itemId)),
    );
  const reachableDialogueIds = project.dialogues
    .map((dialogue) => dialogue.id)
    .filter((dialogueId) =>
      nodeValues.some((node) => node.state.reachedDialogueIds.includes(dialogueId)),
    );
  const reachableSequenceIds = project.sequences
    .map((sequence) => sequence.id)
    .filter((sequenceId) =>
      nodeValues.some((node) => node.state.reachedSequenceIds.includes(sequenceId)),
    );

  const reachedObjectStatesMutable = new Map<string, Set<string>>();
  for (const node of nodeValues) {
    for (const [objectId, stateId] of Object.entries(node.state.objectStates)) {
      const states = reachedObjectStatesMutable.get(objectId) ?? new Set<string>();
      states.add(stateId);
      reachedObjectStatesMutable.set(objectId, states);
    }
  }
  const reachedObjectStates = Object.fromEntries(
    [...reachedObjectStatesMutable.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([objectId, states]) => [objectId, [...states].sort()] as const),
  );

  const requiredSceneSet = new Set(objectives.requiredSceneIds);
  const reachableSceneSet = new Set(reachableSceneIds);
  for (const sceneId of objectives.requiredSceneIds) {
    if (reachableSceneSet.has(sceneId)) continue;
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    findings.push({
      code: "required-scene-unreachable",
      severity: "error",
      path: "design.map.locations",
      message: `Required scene '${scene?.name ?? sceneId}' is unreachable from the canonical start state.`,
      recommendation:
        "Add a reachable interaction, dialogue or sequence consequence that enters this required scene.",
    });
  }
  for (const scene of project.scenes) {
    if (reachableSceneSet.has(scene.id) || requiredSceneSet.has(scene.id)) continue;
    findings.push({
      code: "project-scene-unreachable",
      severity: "warning",
      path: `project.scenes.${scene.id}`,
      message: `Project scene '${scene.name}' is not reached by the explored state graph.`,
      recommendation:
        "Connect the room, mark it as an intentional draft, or remove it from the release project.",
    });
  }

  const acquiredAcrossGraph = new Set(obtainableItemIds);
  for (const objective of objectives.itemPaths) {
    const satisfied = nodeValues.some((node) =>
      itemPathSatisfied(objective, node.state.acquiredItemIds),
    );
    if (satisfied) continue;
    const readable = objective.alternatives
      .map((alternative) => alternative.join(" + "))
      .join(" OR ");
    findings.push({
      code: "required-item-unobtainable",
      severity: "error",
      path: objective.puzzlePath,
      message:
        `Required puzzle '${objective.puzzleName}' has no fully obtainable ` +
        `item path (${readable}).`,
      recommendation:
        "Guarantee every item in at least one complete alternative solution " +
        "path before the puzzle is required.",
    });
  }
  for (const item of project.inventoryItems) {
    if (acquiredAcrossGraph.has(item.id)) continue;
    findings.push({
      code: "project-item-unobtainable",
      severity: "note",
      path: `project.inventoryItems.${item.id}`,
      message: `Inventory item '${item.name}' is never acquired in the explored graph.`,
      recommendation:
        "Author an acquisition route, mark the item as draft-only, or remove it from the release project.",
    });
  }

  const references = referencedNarrative(project, sceneInstances);
  const reachedDialogues = new Set(reachableDialogueIds);
  for (const dialogue of project.dialogues) {
    if (reachedDialogues.has(dialogue.id)) continue;
    const referenced = references.dialogues.has(dialogue.id);
    findings.push({
      code: "dialogue-unreachable",
      severity: referenced ? "warning" : "note",
      path: `project.dialogues.${dialogue.id}`,
      message: `Dialogue '${dialogue.name}' never starts in the explored graph.`,
      recommendation: referenced
        ? "Repair the triggering state conditions or interaction route."
        : "Connect the draft dialogue or exclude it from the release project.",
    });
  }
  const reachedSequences = new Set(reachableSequenceIds);
  for (const sequence of project.sequences) {
    if (reachedSequences.has(sequence.id)) continue;
    const referenced = references.sequences.has(sequence.id);
    findings.push({
      code: "sequence-unreachable",
      severity: referenced ? "warning" : "note",
      path: `project.sequences.${sequence.id}`,
      message: `Sequence '${sequence.name}' never starts in the explored graph.`,
      recommendation: referenced
        ? "Repair the requesting interaction or dialogue consequence."
        : "Connect the draft sequence or exclude it from the release project.",
    });
  }

  for (const sequenceId of [...runtimeContext.loopingSequenceIds].sort()) {
    findings.push({
      code: "analysis-looping-sequence",
      severity: "note",
      path: `project.sequences.${sequenceId}`,
      message: `Looping sequence '${sequenceId}' was explored for one timeline iteration only.`,
      recommendation:
        "Model progression-changing loop exits as explicit player or story transitions.",
    });
  }
  for (const sequenceId of [...runtimeContext.recursiveSequenceIds].sort()) {
    findings.push({
      code: "analysis-sequence-recursion",
      severity: "warning",
      path: `project.sequences.${sequenceId}`,
      message:
        `Sequence '${sequenceId}' recursively requests narrative playback or ` +
        "exceeds the nested-request bound.",
      recommendation:
        "Break the request cycle or introduce a deterministic state guard before re-entry.",
    });
  }
  for (const dialogueId of [...runtimeContext.recursiveDialogueIds].sort()) {
    findings.push({
      code: "analysis-dialogue-recursion",
      severity: "warning",
      path: `project.dialogues.${dialogueId}`,
      message:
        `Dialogue '${dialogueId}' recursively requests narrative playback or ` +
        "exceeds the nested-request bound.",
      recommendation:
        "Break the request cycle or introduce a deterministic state guard before re-entry.",
    });
  }
  if (truncated) {
    findings.push({
      code: "analysis-truncated",
      severity: "warning",
      path: "$",
      message:
        "Progression exploration reached a configured state or depth limit " +
        `(${nodes.size} states, depth ${maximumDepthReached}).`,
      recommendation:
        "Raise explicit bounds or reduce accidental state branching before claiming exhaustive coverage.",
    });
  }

  const coverages = new Map(
    nodeValues.map(
      (node) =>
        [node.hash, objectiveCoverage(node.state, objectives)] as const,
    ),
  );
  const maximumCoverage = Math.max(0, ...coverages.values());
  const recoverySeeds = nodeValues
    .filter((node) => coverages.get(node.hash) === maximumCoverage)
    .map((node) => node.hash);
  const recoverable = new Set<string>();
  const recoveryQueue = [...recoverySeeds];
  while (recoveryQueue.length > 0) {
    const hash = recoveryQueue.shift();
    if (!hash || recoverable.has(hash)) continue;
    recoverable.add(hash);
    for (const source of reverse.get(hash) ?? []) {
      if (!recoverable.has(source)) recoveryQueue.push(source);
    }
  }
  const softLockTargets = new Set<string>();
  for (const [source, targets] of forward) {
    if (!recoverable.has(source)) continue;
    for (const target of targets) {
      if (!recoverable.has(target)) softLockTargets.add(target);
    }
  }
  for (const hash of [...softLockTargets].sort((left, right) => {
    const leftNode = nodes.get(left);
    const rightNode = nodes.get(right);
    return (
      (leftNode?.depth ?? 0) - (rightNode?.depth ?? 0) ||
      left.localeCompare(right)
    );
  })) {
    const node = nodes.get(hash);
    if (!node) continue;
    findings.push({
      code: "potential-soft-lock",
      severity: "warning",
      path: `state.${compactStateId(hash)}`,
      message:
        `A reachable branch at depth ${node.depth} cannot return to the maximum ` +
        `explored objective coverage (${maximumCoverage}/${totalObjectives}).`,
      recommendation:
        "Add a recovery route, make the branch an explicit ending, or prevent " +
        "the irreversible choice before required progress is secure.",
      witness: witness(node.witness),
    });
  }

  const terminalNodes = [...terminalHashes]
    .map((hash) => nodes.get(hash))
    .filter((node): node is ExplorerNode => node !== undefined);
  const allTerminalStates = terminalNodes
    .map((node) => terminalState(node, objectives))
    .sort(
      (left, right) =>
        right.objectiveCoverage - left.objectiveCoverage ||
        left.depth - right.depth ||
        left.stateId.localeCompare(right.stateId),
    );
  const terminalStates = allTerminalStates.slice(
    0,
    limits.maximumTerminalStates,
  );
  if (allTerminalStates.length > terminalStates.length) {
    findings.push({
      code: "terminal-states-omitted",
      severity: "note",
      path: "terminalStates",
      message:
        `${allTerminalStates.length - terminalStates.length} terminal branch ` +
        "witnesses were omitted from the bounded report.",
      recommendation:
        "Increase maximumTerminalStates for a deeper release review or inspect " +
        "the retained highest-coverage branches first.",
    });
  }

  const finalFindings = uniqueSortedFindings(findings);
  const hasErrors = finalFindings.some(
    (finding) => finding.severity === "error",
  );
  const hasWarnings = finalFindings.some(
    (finding) => finding.severity === "warning",
  );
  const complete =
    !truncated && maximumCoverage === totalObjectives && !hasErrors;
  const status = hasErrors
    ? "blocked"
    : hasWarnings || !complete
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    status,
    complete,
    truncated,
    metrics: {
      exploredStates: nodes.size,
      exploredTransitions,
      maximumDepth: maximumDepthReached,
      reachableSceneCount: reachableSceneIds.length,
      totalSceneCount: project.scenes.length,
      obtainableItemCount: obtainableItemIds.length,
      totalItemCount: project.inventoryItems.length,
      reachableDialogueCount: reachableDialogueIds.length,
      totalDialogueCount: project.dialogues.length,
      reachableSequenceCount: reachableSequenceIds.length,
      totalSequenceCount: project.sequences.length,
      terminalStateCount: allTerminalStates.length,
      objectiveCoverage: maximumCoverage,
      objectiveTotal: totalObjectives,
      objectiveCoveragePercent: coveragePercent(maximumCoverage, totalObjectives),
    },
    reachableSceneIds,
    obtainableItemIds,
    reachableDialogueIds,
    reachableSequenceIds,
    reachedObjectStates,
    milestones: [...milestones.values()].sort(
      (left, right) =>
        left.depth - right.depth ||
        milestoneOrder[left.kind] - milestoneOrder[right.kind] ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    ),
    sceneEdges: [...sceneEdges.values()].sort(
      (left, right) =>
        left.fromSceneId.localeCompare(right.fromSceneId) ||
        left.toSceneId.localeCompare(right.toSceneId) ||
        left.via.localeCompare(right.via),
    ),
    terminalStates,
    findings: finalFindings,
  };
};
