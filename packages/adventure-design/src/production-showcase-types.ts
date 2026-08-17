import type { Point } from "@evavo/adventure-project-schema";
import type { AdventureProductionProfileId, AdventurePuzzleGrammar } from "./production-profile-types.js";

export type AdventureProductionShowcaseId =
  | "the-glass-finch"
  | "vacuum-courtesy"
  | "the-red-ledger"
  | "the-hollow-vale"
  | "open-case"
  | "saltwake-island"
  | "the-sunken-dial"
  | "jade-horizon"
  | "cold-meridian";

export type AdventureShowcasePlateKind = "title" | "gameplay" | "dialogue" | "system";

export type AdventureShowcaseVisualMotif =
  | "enchanted-belltower"
  | "orbital-service-bay"
  | "rain-bookshop"
  | "island-harbour"
  | "museum-dig"
  | "night-airfield"
  | "rain-tenement";

export type AdventureShowcaseActorRole = "player" | "companion" | "npc" | "threat";

export type AdventureShowcasePropRole = "clue" | "exit" | "puzzle" | "ambience";

export interface AdventureShowcaseActorBeat {
  readonly id: string;
  readonly role: AdventureShowcaseActorRole;
  readonly position: Point;
  readonly height: number;
  readonly facing: "left" | "right";
  readonly pose: string;
  readonly silhouetteNote: string;
}

export interface AdventureShowcasePropBeat {
  readonly id: string;
  readonly role: AdventureShowcasePropRole;
  readonly position: Point;
  readonly size: {
    readonly width: number;
    readonly height: number;
  };
  readonly label: string;
  readonly state: string;
  readonly interactive: boolean;
}

export interface AdventureShowcasePlate {
  readonly id: string;
  readonly kind: AdventureShowcasePlateKind;
  readonly name: string;
  readonly playerGoal: string;
  readonly focalPoint: Point;
  readonly horizonY: number;
  readonly statusText: string;
  readonly actors: readonly AdventureShowcaseActorBeat[];
  readonly props: readonly AdventureShowcasePropBeat[];
  readonly visualProofs: readonly string[];
}

export interface AdventureShowcasePuzzleBeat {
  readonly id: string;
  readonly grammar: AdventurePuzzleGrammar;
  readonly setupPlateId: string;
  readonly prompt: string;
  readonly playerAction: string;
  readonly result: string;
  readonly recovery: string;
}

export interface AdventureProductionShowcase {
  readonly showcaseVersion: 1;
  readonly id: AdventureProductionShowcaseId;
  readonly profileId: AdventureProductionProfileId;
  readonly title: string;
  readonly genre: string;
  readonly logline: string;
  readonly motif: AdventureShowcaseVisualMotif;
  readonly titleTreatment: string;
  readonly dialogueTreatment: string;
  readonly systemTreatment: string;
  readonly plates: readonly AdventureShowcasePlate[];
  readonly puzzleBeats: readonly AdventureShowcasePuzzleBeat[];
  readonly originalAssetsOnly: true;
  readonly originalityStatement: string;
}

export type AdventureProductionShowcaseIssueCode =
  | "unknown-profile"
  | "profile-showcase-mismatch"
  | "duplicate-id"
  | "missing-plate-kind"
  | "invalid-focal-point"
  | "invalid-horizon"
  | "invalid-actor-position"
  | "invalid-actor-height"
  | "missing-player-actor"
  | "invalid-prop-geometry"
  | "unknown-puzzle-plate"
  | "unsupported-puzzle-grammar"
  | "insufficient-visual-proof"
  | "missing-originality-boundary";

export interface AdventureProductionShowcaseIssue {
  readonly severity: "error" | "warning";
  readonly code: AdventureProductionShowcaseIssueCode;
  readonly path: string;
  readonly message: string;
}
