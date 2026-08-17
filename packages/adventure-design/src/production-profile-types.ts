import type { AdventureProject, Id, PresentationProfile, Size } from "@evavo/adventure-project-schema";
import type {
  AdventureCompositionMode,
  AdventureCreativeDirection,
  AdventureDesignDocument,
  AdventureProductionMode,
  AdventureReviewItem,
} from "./types.js";

export type AdventureProductionProfileId =
  | "storybook-icon-vga"
  | "comic-scifi-icon-vga"
  | "gothic-investigation-vga"
  | "gothic-rpg-vga"
  | "procedural-investigation-vga"
  | "verb-panel-cartoon-vga"
  | "pulp-archaeology-vga"
  | "cinematic-pulp-vga"
  | "neo-noir-lowres";

export type AdventureProductionFamily =
  | "icon-storybook"
  | "icon-comic"
  | "portrait-investigation"
  | "gothic-rpg"
  | "procedural-investigation"
  | "verb-panel-comedy"
  | "verb-panel-pulp"
  | "cinematic-pulp"
  | "minimal-noir";

export type AdventureInterfaceFamily =
  | "top-icon-bar"
  | "bottom-verb-panel"
  | "portrait-topic-panel"
  | "cinematic-dossier"
  | "minimal-context";

export type AdventurePuzzleGrammar =
  | "inventory-chain"
  | "environmental-state"
  | "topic-investigation"
  | "multi-route"
  | "relationship-branch"
  | "comic-misapplication"
  | "research-deduction"
  | "hybrid-action";

export type AdventureDialoguePresentation =
  | "floating-subtitle"
  | "portrait-box"
  | "topic-ledger"
  | "cinematic-close-up"
  | "minimal-caption";

export type AdventureSplashFamily =
  | "lantern-reveal"
  | "celestial-mark"
  | "comic-transmission"
  | "kinetic-monolith"
  | "pulp-panel"
  | "noir-signal";

export type AdventureSplashBeatRole =
  | "dark-hold"
  | "mark-reveal"
  | "publisher-line"
  | "title-lockup"
  | "transition";

export interface AdventureSplashBeat {
  readonly id: string;
  readonly role: AdventureSplashBeatRole;
  readonly startTick: number;
  readonly durationTicks: number;
  readonly composition: string;
  readonly motion: string;
  readonly transition: string;
  readonly soundCue?: string;
}

export interface AdventureSplashProfile {
  readonly family: AdventureSplashFamily;
  readonly originalMarkName: string;
  readonly totalTicks: number;
  readonly skippableAfterTick: number;
  readonly audioDirection: string;
  readonly completion: "open-main-menu";
  readonly beats: readonly AdventureSplashBeat[];
}

export interface AdventureProfilePalette {
  readonly maxColours: number;
  readonly keyColours: readonly string[];
  readonly shadowRule: string;
  readonly highlightRule: string;
  readonly ditherRule: string;
  readonly reservedInterfaceColours: number;
}

export interface AdventureProfileSceneGrammar {
  readonly cameraDoctrine: string;
  readonly stageLane: string;
  readonly focalHierarchy: string;
  readonly depthDoctrine: string;
  readonly foregroundDoctrine: string;
  readonly revisitDoctrine: string;
}

export interface AdventureProfileActorGrammar {
  readonly silhouette: string;
  readonly relativeHeightPercent: readonly [number, number];
  readonly portraitTreatment: string;
  readonly costumeDoctrine: string;
  readonly performanceDoctrine: string;
}

export interface AdventureProfileAnimationGrammar {
  readonly cadence: string;
  readonly walkFrames: readonly [number, number];
  readonly idleDoctrine: string;
  readonly transitionDoctrine: string;
  readonly environmentalDoctrine: string;
}

export interface AdventureProfileInterfaceGrammar {
  readonly family: AdventureInterfaceFamily;
  readonly primaryInteractionMode: PresentationProfile["interactionMode"];
  readonly allowedInteractionModes: readonly PresentationProfile["interactionMode"][];
  readonly persistentChromePercent: number;
  readonly sentenceLine: boolean;
  readonly inventoryPresentation: string;
  readonly statusPresentation: string;
  readonly dialoguePresentation: AdventureDialoguePresentation;
  readonly cursorDoctrine: string;
  readonly showScore: boolean;
}

export interface AdventureProfileAudioGrammar {
  readonly music: string;
  readonly ambience: string;
  readonly transitionSting: string;
  readonly interfaceSound: string;
}

export interface AdventureOriginalShowcaseBrief {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly logline: string;
  readonly sceneBriefs: readonly string[];
  readonly featuredSystems: readonly string[];
  readonly originalityStatement: string;
}

export interface AdventureProductionProfile {
  readonly profileVersion: 1;
  readonly id: AdventureProductionProfileId;
  readonly label: string;
  readonly family: AdventureProductionFamily;
  readonly summary: string;
  readonly nativeSize: Size;
  readonly productionModes: readonly AdventureProductionMode[];
  readonly compositionModes: readonly AdventureCompositionMode[];
  readonly pixelMotionPolicy: PresentationProfile["pixelMotionPolicy"];
  readonly palette: AdventureProfilePalette;
  readonly scene: AdventureProfileSceneGrammar;
  readonly actors: AdventureProfileActorGrammar;
  readonly animation: AdventureProfileAnimationGrammar;
  readonly interface: AdventureProfileInterfaceGrammar;
  readonly puzzleGrammars: readonly AdventurePuzzleGrammar[];
  readonly audio: AdventureProfileAudioGrammar;
  readonly splash: AdventureSplashProfile;
  readonly showcase: AdventureOriginalShowcaseBrief;
  readonly authenticityRules: readonly string[];
  readonly prohibitedShortcuts: readonly string[];
  readonly reviewQuestions: readonly string[];
}

export interface AdventureProductionProfileSeed {
  readonly profileId: AdventureProductionProfileId;
  readonly presentation: PresentationProfile;
  readonly creativeDirection: AdventureCreativeDirection;
  readonly reviewChecklist: readonly AdventureReviewItem[];
  readonly splash: AdventureSplashProfile;
  readonly showcase: AdventureOriginalShowcaseBrief;
}

export type AdventureProductionProfileSeverity = "error" | "warning" | "note";

export type AdventureProductionProfileIssueCode =
  | "invalid-profile"
  | "native-size-mismatch"
  | "production-mode-mismatch"
  | "composition-mode-mismatch"
  | "palette-budget-exceeded"
  | "interaction-mode-mismatch"
  | "integer-scaling-disabled"
  | "linear-sampling"
  | "pixel-motion-mismatch"
  | "score-policy-mismatch"
  | "project-identity-mismatch";

export interface AdventureProductionProfileIssue {
  readonly severity: AdventureProductionProfileSeverity;
  readonly code: AdventureProductionProfileIssueCode;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export interface AdventureProductionProfileReport {
  readonly reportVersion: 1;
  readonly profileId: AdventureProductionProfileId;
  readonly projectId: Id<"project"> | null;
  readonly status: "ready" | "attention" | "blocked";
  readonly score: number;
  readonly issues: readonly AdventureProductionProfileIssue[];
  readonly seed: AdventureProductionProfileSeed;
}

export interface AdventureProductionProfileAuditInput {
  readonly design?: AdventureDesignDocument;
  readonly project?: Pick<AdventureProject, "id" | "presentation">;
}
