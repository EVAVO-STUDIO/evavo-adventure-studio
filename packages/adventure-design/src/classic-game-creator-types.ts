import type { Point, Size } from "@evavo/adventure-project-schema";
import type { AdventureProductionProfileId, AdventurePuzzleGrammar } from "./production-profile-types.js";
import type {
  AdventureProductionShowcaseId,
  AdventureShowcasePlateKind,
  AdventureShowcaseVisualMotif,
} from "./production-showcase-types.js";

export type ClassicAdventureCreatorFamily = "storybook-icon" | "gothic-investigation" | "verb-panel-comedy";

export type ClassicAdventureCreatorInterfaceFamily =
  | "temporary-icon-bar"
  | "portrait-topic-ledger"
  | "persistent-verb-panel";

export type ClassicAdventureCreatorLayerRole =
  | "backdrop"
  | "rear-architecture"
  | "interactive"
  | "actors"
  | "foreground"
  | "interface";

export type ClassicAdventureCreatorActorRole = "player" | "companion" | "npc" | "threat";

export type ClassicAdventureCreatorPropRole = "clue" | "exit" | "puzzle" | "ambience";

export interface ClassicAdventureCreatorRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ClassicAdventureCreatorLayer {
  readonly id: string;
  readonly role: ClassicAdventureCreatorLayerRole;
  readonly name: string;
  readonly depth: number;
  readonly locked: boolean;
  readonly artBrief: string;
}

export interface ClassicAdventureCreatorActor {
  readonly id: string;
  readonly role: ClassicAdventureCreatorActorRole;
  readonly name: string;
  readonly position: Point;
  readonly height: number;
  readonly facing: "left" | "right";
  readonly pose: string;
  readonly animationState: string;
  readonly silhouetteNote: string;
}

export interface ClassicAdventureCreatorProp {
  readonly id: string;
  readonly role: ClassicAdventureCreatorPropRole;
  readonly name: string;
  readonly position: Point;
  readonly size: Size;
  readonly state: string;
  readonly interactive: boolean;
  readonly verbs: readonly string[];
  readonly description: string;
}

export interface ClassicAdventureCreatorScene {
  readonly id: string;
  readonly sourcePlateId: string;
  readonly kind: AdventureShowcasePlateKind;
  readonly motif: AdventureShowcaseVisualMotif;
  readonly name: string;
  readonly playerGoal: string;
  readonly artBrief: string;
  readonly lightingBrief: string;
  readonly statusText: string;
  readonly horizonY: number;
  readonly focalPoint: Point;
  readonly walkLane: {
    readonly top: number;
    readonly bottom: number;
    readonly note: string;
  };
  readonly interfaceSafeRect: ClassicAdventureCreatorRect;
  readonly layers: readonly ClassicAdventureCreatorLayer[];
  readonly actors: readonly ClassicAdventureCreatorActor[];
  readonly props: readonly ClassicAdventureCreatorProp[];
  readonly musicCue: string;
  readonly ambienceCue: string;
  readonly reviewProofs: readonly string[];
}

export interface ClassicAdventureCreatorInterface {
  readonly family: ClassicAdventureCreatorInterfaceFamily;
  readonly gameplayViewportHeight: number;
  readonly chromeHeight: number;
  readonly overlayHeight: number;
  readonly openBehaviour: "temporary" | "persistent" | "modal";
  readonly verbs: readonly string[];
  readonly inventorySlots: number;
  readonly sentenceLine: boolean;
  readonly topicRows: number;
  readonly portraitSlots: number;
  readonly scoreVisible: boolean;
  readonly statusPlacement: string;
  readonly cursorDoctrine: string;
}

export interface ClassicAdventureCreatorTiming {
  readonly logicalTicksPerSecond: 60;
  readonly pointerAcknowledgeTicks: number;
  readonly hoverCommitTicks: number;
  readonly movementStartPoseTicks: number;
  readonly turnPoseTicks: number;
  readonly actionAnticipationTicks: number;
  readonly actionRecoveryTicks: number;
  readonly wrongActionHoldTicks: number;
  readonly lineMinimumTicks: number;
  readonly sceneFadeOutTicks: number;
  readonly sceneDarkHoldTicks: number;
  readonly sceneFadeInTicks: number;
}

export type ClassicAdventureCreatorTimingField = keyof Omit<
  ClassicAdventureCreatorTiming,
  "logicalTicksPerSecond"
>;

export interface ClassicAdventureCreatorPuzzle {
  readonly id: string;
  readonly title: string;
  readonly grammar: AdventurePuzzleGrammar;
  readonly setupSceneId: string;
  readonly resolutionSceneId: string;
  readonly requiredPropIds: readonly string[];
  readonly steps: readonly string[];
  readonly result: string;
  readonly recovery: string;
  readonly irreversibleFailure: false;
}

export interface ClassicAdventureCreatorDialogue {
  readonly id: string;
  readonly sceneId: string;
  readonly mode: "storybook-exchange" | "portrait-topics" | "in-scene-choices";
  readonly openingLine: string;
  readonly topics: readonly string[];
  readonly stateChanges: readonly string[];
}

export interface ClassicAdventureCreatorProject {
  readonly creatorVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly family: ClassicAdventureCreatorFamily;
  readonly profileId: AdventureProductionProfileId;
  readonly showcaseId: AdventureProductionShowcaseId;
  readonly nativeSize: Size;
  readonly palette: {
    readonly maxColours: number;
    readonly anchors: readonly string[];
    readonly actorValueRule: string;
    readonly interfaceReservation: number;
  };
  readonly interface: ClassicAdventureCreatorInterface;
  readonly timing: ClassicAdventureCreatorTiming;
  readonly scenes: readonly ClassicAdventureCreatorScene[];
  readonly puzzles: readonly ClassicAdventureCreatorPuzzle[];
  readonly dialogues: readonly ClassicAdventureCreatorDialogue[];
  readonly productionPromise: string;
  readonly originalityStatement: string;
}

export type ClassicAdventureCreatorIssueSeverity = "error" | "warning" | "note";

export type ClassicAdventureCreatorIssueCode =
  | "profile-family-mismatch"
  | "showcase-family-mismatch"
  | "invalid-native-size"
  | "invalid-interface-geometry"
  | "invalid-interface-family"
  | "invalid-timing"
  | "missing-scene-kind"
  | "invalid-scene-geometry"
  | "invalid-layer-stack"
  | "missing-player"
  | "invalid-actor-geometry"
  | "invalid-prop-geometry"
  | "unknown-puzzle-scene"
  | "unknown-puzzle-prop"
  | "unsupported-puzzle-grammar"
  | "irreversible-puzzle-failure"
  | "unknown-dialogue-scene"
  | "insufficient-production-proof"
  | "missing-originality-boundary";

export interface ClassicAdventureCreatorIssue {
  readonly severity: ClassicAdventureCreatorIssueSeverity;
  readonly code: ClassicAdventureCreatorIssueCode;
  readonly path: string;
  readonly message: string;
}
