import type {
  ClassicAdventureCreatorFamily,
  ClassicAdventureCreatorProject,
} from "./classic-game-creator-types.js";

export type ClassicExperiencePrincipleId =
  | "clear-objective"
  | "visible-subgoals"
  | "discover-before-use"
  | "recoverable-required-items"
  | "no-mandatory-death"
  | "hollywood-time"
  | "story-advancing-puzzles"
  | "reward-player-intent"
  | "incremental-rewards"
  | "parallel-options"
  | "native-readability"
  | "responsive-input";

export type ClassicExperienceFindingSeverity = "error" | "warning" | "note";

export type ClassicExperienceFindingCode =
  | "unclear-objective"
  | "thin-puzzle-causality"
  | "solution-before-problem"
  | "unsafe-puzzle-state"
  | "mandatory-failure"
  | "hostile-time-pressure"
  | "detached-puzzle-result"
  | "punitive-feedback-delay"
  | "missing-progress-reward"
  | "single-thread-cage"
  | "weak-native-proof"
  | "sluggish-input";

export interface ClassicExperienceContract {
  readonly contractVersion: 1;
  readonly family: ClassicAdventureCreatorFamily;
  readonly label: string;
  readonly designPromise: string;
  readonly inputDoctrine: string;
  readonly puzzleDoctrine: string;
  readonly failureDoctrine: string;
  readonly hintDoctrine: string;
  readonly timingDoctrine: string;
  readonly nativeReviewDoctrine: string;
  readonly minimumInteractiveTargets: number;
  readonly maximumPointerAcknowledgeTicks: number;
  readonly maximumHoverCommitTicks: number;
  readonly maximumWrongActionHoldTicks: number;
  readonly minimumPuzzleSteps: number;
  readonly minimumReviewProofsPerGameplayScene: number;
  readonly principles: readonly ClassicExperiencePrincipleId[];
}

export interface ClassicExperienceFinding {
  readonly severity: ClassicExperienceFindingSeverity;
  readonly code: ClassicExperienceFindingCode;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
  readonly impact: number;
}

export interface ClassicExperiencePrincipleResult {
  readonly id: ClassicExperiencePrincipleId;
  readonly passed: boolean;
  readonly evidence: readonly string[];
}

export interface ClassicExperienceReport {
  readonly reportVersion: 1;
  readonly projectId: ClassicAdventureCreatorProject["id"];
  readonly family: ClassicAdventureCreatorFamily;
  readonly status: "ready" | "attention" | "blocked";
  readonly score: number;
  readonly contract: ClassicExperienceContract;
  readonly principles: readonly ClassicExperiencePrincipleResult[];
  readonly findings: readonly ClassicExperienceFinding[];
  readonly metrics: {
    readonly gameplaySceneCount: number;
    readonly interactiveTargetCount: number;
    readonly puzzleCount: number;
    readonly recoverablePuzzleCount: number;
    readonly dialogueTopicCount: number;
    readonly nativeReviewProofCount: number;
    readonly averageWrongActionSeconds: number;
  };
}
