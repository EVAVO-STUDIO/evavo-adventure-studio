import type {
  AdventureProductionShowcase,
  AdventureShowcaseActorBeat,
  AdventureShowcasePlate,
  AdventureShowcasePlateKind,
  AdventureShowcasePropBeat,
  AdventureShowcasePuzzleBeat,
  AdventureShowcaseVisualMotif,
} from "./production-showcase-types.js";
import type {
  AdventureProductionProfileId,
  AdventurePuzzleGrammar,
} from "./production-profile-types.js";

export const actor = (
  id: string,
  role: AdventureShowcaseActorBeat["role"],
  x: number,
  y: number,
  height: number,
  facing: AdventureShowcaseActorBeat["facing"],
  pose: string,
  silhouetteNote: string,
): AdventureShowcaseActorBeat => ({
  id,
  role,
  position: { x, y },
  height,
  facing,
  pose,
  silhouetteNote,
});

export const prop = (
  id: string,
  role: AdventureShowcasePropBeat["role"],
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  state: string,
  interactive = true,
): AdventureShowcasePropBeat => ({
  id,
  role,
  position: { x, y },
  size: { width, height },
  label,
  state,
  interactive,
});

export const plate = (
  id: string,
  kind: AdventureShowcasePlateKind,
  name: string,
  playerGoal: string,
  focalX: number,
  focalY: number,
  horizonY: number,
  statusText: string,
  actors: readonly AdventureShowcaseActorBeat[],
  props: readonly AdventureShowcasePropBeat[],
  visualProofs: readonly string[],
): AdventureShowcasePlate => ({
  id,
  kind,
  name,
  playerGoal,
  focalPoint: { x: focalX, y: focalY },
  horizonY,
  statusText,
  actors,
  props,
  visualProofs,
});

export const puzzle = (
  id: string,
  grammar: AdventurePuzzleGrammar,
  setupPlateId: string,
  prompt: string,
  playerAction: string,
  result: string,
  recovery: string,
): AdventureShowcasePuzzleBeat => ({
  id,
  grammar,
  setupPlateId,
  prompt,
  playerAction,
  result,
  recovery,
});

export const showcase = (input: {
  readonly id: AdventureProductionShowcase["id"];
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
  readonly originalityStatement: string;
}): AdventureProductionShowcase => ({
  showcaseVersion: 1,
  ...input,
  originalAssetsOnly: true,
});
