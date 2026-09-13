import type { AdventureProductionProfileId } from "./production-profile-types.js";

export type DynamixCinematicContractId = "jade-horizon" | "dead-channel";

export type DynamixCinematicClockMode = "costed-only" | "continuous";

export type DynamixCinematicActionKind =
  | "combat"
  | "escape"
  | "driving"
  | "stealth"
  | "vehicle";

export type DynamixCinematicInput =
  | "left"
  | "right"
  | "up"
  | "down"
  | "act"
  | "guard"
  | "accelerate"
  | "brake";

export interface DynamixCinematicVisualContract {
  readonly nativeWidth: 320;
  readonly nativeHeight: 200;
  readonly intendedDisplayAspect: "4:3";
  readonly paletteMode: "indexed-8-bit";
  readonly maxColours: 256;
  readonly integerScale: true;
  readonly textureSampling: "nearest";
  readonly spriteTransparency: "binary";
  readonly sceneConstruction: "native-first";
  readonly panelLanguage: string;
  readonly backgroundDoctrine: readonly string[];
  readonly animationDoctrine: readonly string[];
  readonly prohibitedShortcuts: readonly string[];
}

export interface DynamixCinematicTimingContract {
  readonly logicalTicksPerSecond: 60;
  readonly clockMode: DynamixCinematicClockMode;
  readonly ticksPerGameMinute: number;
  readonly pointerAcknowledgeTicks: number;
  readonly hotspotCommitTicks: number;
  readonly portraitRevealTicks: number;
  readonly dialogueMinimumTicks: number;
  readonly locationCutTicks: number;
  readonly montagePanelTicks: number;
  readonly actionTelegraphTicks: number;
  readonly actionRecoveryTicks: number;
  readonly failureHoldTicks: number;
}

export interface DynamixCinematicProtagonist {
  readonly id: string;
  readonly name: string;
  readonly knowledgeFlags: readonly string[];
  readonly inventoryIds: readonly string[];
  readonly portraitDirection: string;
  readonly movementDirection: string;
}

export interface DynamixCinematicRelationship {
  readonly id: string;
  readonly label: string;
  readonly initialValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly visibleLabels: readonly {
    readonly maximumValue: number;
    readonly label: string;
  }[];
}

export interface DynamixCinematicRoute {
  readonly id: string;
  readonly label: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly allowedProtagonistIds: readonly string[];
  readonly costMinutes: number;
  readonly requiredFlags: readonly string[];
  readonly setFlags: readonly string[];
  readonly relationshipChanges: Readonly<Record<string, number>>;
  readonly montagePanels: readonly string[];
  readonly consequence: string;
}

export interface DynamixCinematicChoice {
  readonly id: string;
  readonly label: string;
  readonly requiredFlags: readonly string[];
  readonly setFlags: readonly string[];
  readonly relationshipChanges: Readonly<Record<string, number>>;
  readonly timeCostMinutes: number;
  readonly consequence: string;
}

export interface DynamixCinematicActionWindow {
  readonly id: string;
  readonly opensAtTick: number;
  readonly closesAtTick: number;
  readonly input: DynamixCinematicInput;
  readonly telegraph: string;
  readonly successBeat: string;
}

export interface DynamixCinematicActionSequence {
  readonly id: string;
  readonly label: string;
  readonly kind: DynamixCinematicActionKind;
  readonly locationId: string;
  readonly durationTicks: number;
  readonly safeAnchorId: string;
  readonly windows: readonly DynamixCinematicActionWindow[];
  readonly timeCostMinutes: number;
  readonly successFlags: readonly string[];
  readonly failureFlags: readonly string[];
  readonly successRelationshipChanges: Readonly<Record<string, number>>;
  readonly failureRelationshipChanges: Readonly<Record<string, number>>;
  readonly successConsequence: string;
  readonly failureConsequence: string;
}

export interface DynamixCinematicDeadline {
  readonly id: string;
  readonly gameMinute: number;
  readonly requiredFlag: string;
  readonly failureOutcomeId: string;
  readonly warningMinutes: readonly number[];
}

export interface DynamixCinematicOutcome {
  readonly id: string;
  readonly kind: "success" | "failure";
  readonly title: string;
  readonly message: string;
  readonly requiredFlags: readonly string[];
  readonly minimumRelationships: Readonly<Record<string, number>>;
}

export interface DynamixCinematicContract {
  readonly contractVersion: 1;
  readonly id: DynamixCinematicContractId;
  readonly label: string;
  readonly summary: string;
  readonly productionProfileId: AdventureProductionProfileId;
  readonly originalProofTitle: string;
  readonly originalAssetsOnly: true;
  readonly visual: DynamixCinematicVisualContract;
  readonly timing: DynamixCinematicTimingContract;
  readonly start: {
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly locationId: string;
    readonly protagonistId: string;
  };
  readonly protagonists: readonly DynamixCinematicProtagonist[];
  readonly relationships: readonly DynamixCinematicRelationship[];
  readonly routes: readonly DynamixCinematicRoute[];
  readonly choices: readonly DynamixCinematicChoice[];
  readonly actions: readonly DynamixCinematicActionSequence[];
  readonly deadlines: readonly DynamixCinematicDeadline[];
  readonly outcomes: readonly DynamixCinematicOutcome[];
  readonly designRules: readonly string[];
}

export interface DynamixCinematicAnchor {
  readonly tick: number;
  readonly gameMinute: number;
  readonly clockRemainderTicks: number;
  readonly locationId: string;
  readonly protagonistId: string;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly relationships: Readonly<Record<string, number>>;
  readonly routeHistory: readonly string[];
  readonly choiceHistory: readonly string[];
}

export interface DynamixCinematicActiveAction {
  readonly sequenceId: string;
  readonly startedAtTick: number;
  readonly acceptedWindowIds: readonly string[];
  readonly failed: boolean;
}

export interface DynamixCinematicActionResult {
  readonly sequenceId: string;
  readonly outcome: "success" | "failure";
  readonly resolvedAtTick: number;
  readonly consequence: string;
}

export interface DynamixCinematicState {
  readonly stateVersion: 1;
  readonly contractId: DynamixCinematicContractId;
  readonly tick: number;
  readonly gameMinute: number;
  readonly clockRemainderTicks: number;
  readonly locationId: string;
  readonly protagonistId: string;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly relationships: Readonly<Record<string, number>>;
  readonly routeHistory: readonly string[];
  readonly choiceHistory: readonly string[];
  readonly activeAction: DynamixCinematicActiveAction | null;
  readonly safeAnchor: DynamixCinematicAnchor | null;
  readonly lastActionResult: DynamixCinematicActionResult | null;
  readonly terminalOutcomeId: string | null;
}

export type DynamixCinematicCommand =
  | {
      readonly kind: "advance-ticks";
      readonly ticks: number;
    }
  | {
      readonly kind: "advance-minutes";
      readonly minutes: number;
    }
  | {
      readonly kind: "switch-protagonist";
      readonly protagonistId: string;
    }
  | {
      readonly kind: "travel";
      readonly routeId: string;
    }
  | {
      readonly kind: "choose";
      readonly choiceId: string;
    }
  | {
      readonly kind: "start-action";
      readonly sequenceId: string;
    }
  | {
      readonly kind: "action-input";
      readonly input: DynamixCinematicInput;
    }
  | {
      readonly kind: "retry-action";
    };

export interface DynamixCinematicReplay {
  readonly replayVersion: 1;
  readonly contractId: DynamixCinematicContractId;
  readonly commands: readonly DynamixCinematicCommand[];
  readonly expectedFingerprint?: string;
}

export type DynamixCinematicIssueCode =
  | "invalid-profile"
  | "invalid-visual-contract"
  | "invalid-timing"
  | "duplicate-id"
  | "invalid-start"
  | "invalid-protagonist"
  | "invalid-relationship"
  | "invalid-route"
  | "invalid-choice"
  | "invalid-action"
  | "overlapping-action-window"
  | "missing-safe-anchor"
  | "invalid-deadline"
  | "invalid-outcome"
  | "missing-originality-boundary";

export interface DynamixCinematicIssue {
  readonly severity: "error" | "warning";
  readonly code: DynamixCinematicIssueCode;
  readonly path: string;
  readonly message: string;
}
