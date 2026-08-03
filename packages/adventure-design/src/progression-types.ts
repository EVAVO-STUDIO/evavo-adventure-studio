import type { Id, Scalar } from "@evavo/adventure-project-schema";

export type AdventureProgressionSeverity = "error" | "warning" | "note";
export type AdventureProgressionStatus = "ready" | "attention" | "blocked";

export type AdventureProgressionStepKind =
  | "scene-interaction"
  | "object-interaction"
  | "dialogue-choice"
  | "dialogue-continue";

export interface AdventureProgressionStep {
  readonly id: string;
  readonly kind: AdventureProgressionStepKind;
  readonly label: string;
  readonly sourcePath: string;
  readonly sceneId: Id<"scene">;
  readonly actionSummary: readonly string[];
}

export interface AdventureProgressionWitness {
  readonly steps: readonly AdventureProgressionStep[];
}

export type AdventureProgressionMilestoneKind =
  | "scene"
  | "item"
  | "dialogue"
  | "sequence"
  | "object-state";

export interface AdventureProgressionMilestone {
  readonly kind: AdventureProgressionMilestoneKind;
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly witness: AdventureProgressionWitness;
}

export interface AdventureProgressionSceneEdge {
  readonly id: string;
  readonly fromSceneId: Id<"scene">;
  readonly toSceneId: Id<"scene">;
  readonly via: string;
  readonly witness: AdventureProgressionWitness;
}

export interface AdventureProgressionTerminalState {
  readonly stateId: string;
  readonly currentSceneId: Id<"scene">;
  readonly depth: number;
  readonly coveragePercent: number;
  readonly objectiveCoverage: number;
  readonly objectiveTotal: number;
  readonly visitedSceneIds: readonly Id<"scene">[];
  readonly inventoryItemIds: readonly Id<"item">[];
  readonly acquiredItemIds: readonly Id<"item">[];
  readonly activeDialogueId: Id<"dialogue"> | null;
  readonly witness: AdventureProgressionWitness;
}

export type AdventureProgressionFindingCode =
  | "canonical-project-error"
  | "canonical-scene-instance-error"
  | "analysis-truncated"
  | "analysis-sequence-recursion"
  | "analysis-dialogue-recursion"
  | "analysis-looping-sequence"
  | "required-scene-unreachable"
  | "project-scene-unreachable"
  | "required-item-unobtainable"
  | "project-item-unobtainable"
  | "dialogue-unreachable"
  | "sequence-unreachable"
  | "potential-soft-lock"
  | "no-progress-interaction"
  | "terminal-states-omitted"
  | "design-project-mismatch";

export interface AdventureProgressionFinding {
  readonly code: AdventureProgressionFindingCode;
  readonly severity: AdventureProgressionSeverity;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
  readonly witness?: AdventureProgressionWitness;
}

export interface AdventureProgressionMetrics {
  readonly exploredStates: number;
  readonly exploredTransitions: number;
  readonly maximumDepth: number;
  readonly reachableSceneCount: number;
  readonly totalSceneCount: number;
  readonly obtainableItemCount: number;
  readonly totalItemCount: number;
  readonly reachableDialogueCount: number;
  readonly totalDialogueCount: number;
  readonly reachableSequenceCount: number;
  readonly totalSequenceCount: number;
  readonly terminalStateCount: number;
  readonly objectiveCoverage: number;
  readonly objectiveTotal: number;
  readonly objectiveCoveragePercent: number;
}

export interface AdventureProgressionReport {
  readonly reportVersion: 1;
  readonly status: AdventureProgressionStatus;
  readonly complete: boolean;
  readonly truncated: boolean;
  readonly metrics: AdventureProgressionMetrics;
  readonly reachableSceneIds: readonly Id<"scene">[];
  readonly obtainableItemIds: readonly Id<"item">[];
  readonly reachableDialogueIds: readonly Id<"dialogue">[];
  readonly reachableSequenceIds: readonly Id<"sequence">[];
  readonly reachedObjectStates: Readonly<Record<string, readonly string[]>>;
  readonly milestones: readonly AdventureProgressionMilestone[];
  readonly sceneEdges: readonly AdventureProgressionSceneEdge[];
  readonly terminalStates: readonly AdventureProgressionTerminalState[];
  readonly findings: readonly AdventureProgressionFinding[];
}

export interface AdventureProgressionOptions {
  readonly maximumStates?: number;
  readonly maximumDepth?: number;
  readonly maximumWitnessSteps?: number;
  readonly maximumNestedRequests?: number;
  /** @deprecated Use maximumNestedRequests. */
  readonly maximumNestedSequences?: number;
  readonly maximumTerminalStates?: number;
}

export interface AdventureProgressionRuntimeState {
  readonly currentSceneId: Id<"scene">;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly variables: Readonly<Record<string, Scalar>>;
  readonly inventoryItemIds: readonly Id<"item">[];
  readonly consumedInteractionIds: readonly Id<"interaction">[];
  readonly consumedDialogueChoiceIds: readonly Id<"dialogue-choice">[];
  readonly objectStates: Readonly<Record<string, string>>;
  readonly activeDialogue: {
    readonly dialogueId: Id<"dialogue">;
    readonly nodeId: Id<"dialogue-node">;
  } | null;
  readonly visitedSceneIds: readonly Id<"scene">[];
  readonly acquiredItemIds: readonly Id<"item">[];
  readonly reachedDialogueIds: readonly Id<"dialogue">[];
  readonly reachedSequenceIds: readonly Id<"sequence">[];
}
