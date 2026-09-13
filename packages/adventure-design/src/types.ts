import type { Action, AdventureProject, Id, Point, Size } from "@evavo/adventure-project-schema";

export type AdventureDesignId<T extends string> = string & {
  readonly __adventureDesignId: T;
};

export type AdventureProductionMode =
  | "painted-pixel"
  | "storybook-gouache"
  | "inked-comic"
  | "graphic-cel"
  | "cinematic-photocollage"
  | "custom";

export type AdventureCompositionMode = "stage" | "cinematic" | "storybook" | "comic-panel" | "travel";

export interface AdventurePaletteDirection {
  readonly maxColours: number;
  readonly keyColours: readonly string[];
  readonly shadowRule: string;
  readonly highlightRule: string;
  readonly ditherRule: string;
}

export interface AdventureCreativeDirection {
  readonly nativeSize: Size;
  readonly productionMode: AdventureProductionMode;
  readonly compositionMode: AdventureCompositionMode;
  readonly palette: AdventurePaletteDirection;
  readonly perspective: string;
  readonly lighting: string;
  readonly materialLanguage: string;
  readonly actorSilhouette: string;
  readonly backgroundHierarchy: string;
  readonly portraitTreatment: string;
  readonly animationCadence: string;
  readonly interfaceTreatment: string;
  readonly musicDirection: string;
  readonly ambienceDirection: string;
  readonly authenticityRules: readonly string[];
  readonly prohibitedShortcuts: readonly string[];
}

export type AdventureLocationKind = "hub" | "scene" | "interior" | "dungeon" | "travel" | "close-up";

export interface AdventureMapLocation {
  readonly id: AdventureDesignId<"location">;
  readonly name: string;
  readonly kind: AdventureLocationKind;
  readonly position: Point;
  readonly sceneId?: Id<"scene">;
  readonly chapterIds: readonly AdventureDesignId<"chapter">[];
  readonly unlockedByPuzzleIds: readonly AdventureDesignId<"puzzle">[];
  readonly artBrief: string;
  readonly arrivalBeat: string;
  readonly musicCue?: string;
}

export interface AdventureMapRoute {
  readonly id: AdventureDesignId<"route">;
  readonly fromLocationId: AdventureDesignId<"location">;
  readonly toLocationId: AdventureDesignId<"location">;
  readonly bidirectional: boolean;
  readonly travelMode: string;
  readonly transition: string;
  readonly requiredPuzzleIds: readonly AdventureDesignId<"puzzle">[];
}

export interface AdventureWorldMap {
  readonly title: string;
  readonly artBrief: string;
  readonly locations: readonly AdventureMapLocation[];
  readonly routes: readonly AdventureMapRoute[];
}

export type AdventureChapterMode = "act" | "day" | "mission" | "era" | "open-phase";

export interface AdventureChapter {
  readonly id: AdventureDesignId<"chapter">;
  readonly name: string;
  readonly mode: AdventureChapterMode;
  readonly ordinal: number;
  readonly playerObjective: string;
  readonly startLocationId: AdventureDesignId<"location">;
  readonly requiredPuzzleIds: readonly AdventureDesignId<"puzzle">[];
  readonly optionalPuzzleIds: readonly AdventureDesignId<"puzzle">[];
  readonly unlockedLocationIds: readonly AdventureDesignId<"location">[];
  readonly openingCutsceneId?: AdventureDesignId<"cutscene">;
  readonly closingCutsceneId?: AdventureDesignId<"cutscene">;
  readonly completionBeat: string;
}

export type AdventureClueDelivery =
  | "environment"
  | "dialogue"
  | "inventory"
  | "research"
  | "map"
  | "cutscene";

export interface AdventureClue {
  readonly id: AdventureDesignId<"clue">;
  readonly name: string;
  readonly delivery: AdventureClueDelivery;
  readonly locationId?: AdventureDesignId<"location">;
  readonly chapterId?: AdventureDesignId<"chapter">;
  readonly text: string;
  readonly guaranteed: boolean;
  readonly supportsPuzzleIds: readonly AdventureDesignId<"puzzle">[];
}

export interface AdventurePuzzleStep {
  readonly id: AdventureDesignId<"puzzle-step">;
  readonly verb: string;
  readonly target: string;
  readonly itemId?: Id<"item">;
  readonly result: string;
  readonly clueIds: readonly AdventureDesignId<"clue">[];
}

export interface AdventurePuzzleSolution {
  readonly id: AdventureDesignId<"puzzle-solution">;
  readonly label: string;
  readonly steps: readonly AdventurePuzzleStep[];
}

export interface AdventureHint {
  readonly level: number;
  readonly text: string;
}

export type AdventureFailureMode = "none" | "setback" | "death" | "alternate-branch";

export interface AdventureFailurePolicy {
  readonly mode: AdventureFailureMode;
  readonly warning: string;
  readonly recovery: string;
}

export interface AdventurePuzzle {
  readonly id: AdventureDesignId<"puzzle">;
  readonly name: string;
  readonly chapterId: AdventureDesignId<"chapter">;
  readonly locationId: AdventureDesignId<"location">;
  readonly goal: string;
  readonly storyPayoff: string;
  readonly problemIntroducedBeforeSolution: boolean;
  readonly dependencyIds: readonly AdventureDesignId<"puzzle">[];
  readonly clueIds: readonly AdventureDesignId<"clue">[];
  readonly solutions: readonly AdventurePuzzleSolution[];
  readonly hints: readonly AdventureHint[];
  readonly failure: AdventureFailurePolicy;
  readonly score: number;
  readonly optional: boolean;
  readonly rationale: string;
}

export type AdventureCutsceneTrigger =
  | {
      readonly kind: "chapter-open" | "chapter-close";
      readonly chapterId: AdventureDesignId<"chapter">;
    }
  | {
      readonly kind: "location-enter";
      readonly locationId: AdventureDesignId<"location">;
    }
  | {
      readonly kind: "puzzle-complete";
      readonly puzzleId: AdventureDesignId<"puzzle">;
    }
  | {
      readonly kind: "dialogue-choice";
      readonly dialogueChoiceId: Id<"dialogue-choice">;
    };

export interface AdventureCutsceneShot {
  readonly id: AdventureDesignId<"cutscene-shot">;
  readonly order: number;
  readonly durationTicks: number;
  readonly framing: string;
  readonly camera: string;
  readonly staging: string;
  readonly dialogue?: string;
  readonly sound?: string;
  readonly transition: string;
}

export interface AdventureCutscene {
  readonly id: AdventureDesignId<"cutscene">;
  readonly name: string;
  readonly chapterId: AdventureDesignId<"chapter">;
  readonly trigger: AdventureCutsceneTrigger;
  readonly skippable: boolean;
  readonly completionActions: readonly Action[];
  readonly shots: readonly AdventureCutsceneShot[];
}

export interface AdventureReviewItem {
  readonly id: AdventureDesignId<"review-item">;
  readonly label: string;
  readonly required: boolean;
}

export interface AdventureDesignDocument {
  readonly documentVersion: 1;
  readonly projectId: Id<"project">;
  readonly title: string;
  readonly pitch: string;
  readonly playerPromise: string;
  readonly creativeDirection: AdventureCreativeDirection;
  readonly map: AdventureWorldMap;
  readonly chapters: readonly AdventureChapter[];
  readonly clues: readonly AdventureClue[];
  readonly puzzles: readonly AdventurePuzzle[];
  readonly cutscenes: readonly AdventureCutscene[];
  readonly reviewChecklist: readonly AdventureReviewItem[];
}

export interface AdventureDesignIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type AdventureProjectShell = Pick<
  AdventureProject,
  "id" | "presentation" | "scenes" | "actors" | "inventoryItems" | "dialogues" | "sequences"
>;
