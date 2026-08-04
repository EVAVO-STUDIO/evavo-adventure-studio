import type { PresentationProfile } from "@evavo/adventure-project-schema";
import type {
  AdventureDialoguePresentation,
  AdventureInterfaceFamily,
  AdventureOriginalShowcaseBrief,
  AdventureProductionProfile,
  AdventureProductionProfileId,
  AdventurePuzzleGrammar,
  AdventureSplashProfile,
} from "./production-profile-types.js";
import type {
  AdventureCompositionMode,
  AdventureProductionMode,
} from "./types.js";

export const palette = (
  maxColours: number,
  keyColours: readonly string[],
  shadowRule: string,
  highlightRule: string,
  reservedInterfaceColours = 12,
) => ({
  maxColours,
  keyColours,
  shadowRule,
  highlightRule,
  ditherRule: "Use hand-directed dither only for material, atmosphere or controlled gradients.",
  reservedInterfaceColours,
});

export const scene = (
  cameraDoctrine: string,
  stageLane: string,
  focalHierarchy: string,
  revisitDoctrine: string,
) => ({
  cameraDoctrine,
  stageLane,
  focalHierarchy,
  depthDoctrine: "Use scale, value and overlap without sacrificing actor or target readability.",
  foregroundDoctrine: "Frame action and tension without concealing routes or consequential targets.",
  revisitDoctrine,
});

export const actors = (
  silhouette: string,
  relativeHeightPercent: readonly [number, number],
  portraitTreatment: string,
  performanceDoctrine: string,
) => ({
  silhouette,
  relativeHeightPercent,
  portraitTreatment,
  costumeDoctrine: "Build identity from large value masses, practical shapes and one memorable accent.",
  performanceDoctrine,
});

export const animation = (
  cadence: string,
  walkFrames: readonly [number, number],
  idleDoctrine: string,
  transitionDoctrine: string,
) => ({
  cadence,
  walkFrames,
  idleDoctrine,
  transitionDoctrine,
  environmentalDoctrine: "Keep environmental loops local, sparse and tied to place or state.",
});

export const interfaceGrammar = (
  family: AdventureInterfaceFamily,
  primaryInteractionMode: PresentationProfile["interactionMode"],
  allowedInteractionModes: readonly PresentationProfile["interactionMode"][],
  persistentChromePercent: number,
  sentenceLine: boolean,
  dialoguePresentation: AdventureDialoguePresentation,
  inventoryPresentation: string,
  statusPresentation: string,
  cursorDoctrine: string,
  showScore: boolean,
) => ({
  family,
  primaryInteractionMode,
  allowedInteractionModes,
  persistentChromePercent,
  sentenceLine,
  inventoryPresentation,
  statusPresentation,
  dialoguePresentation,
  cursorDoctrine,
  showScore,
});

export const audio = (
  music: string,
  ambience: string,
  transitionSting: string,
  interfaceSound: string,
) => ({ music, ambience, transitionSting, interfaceSound });

export const showcase = (
  id: string,
  title: string,
  genre: string,
  logline: string,
  sceneBriefs: readonly [string, string, string],
  featuredSystems: readonly string[],
): AdventureOriginalShowcaseBrief => ({
  id,
  title,
  genre,
  logline,
  sceneBriefs,
  featuredSystems,
  originalityStatement: "Original setting, cast, scenes, puzzles, interface artwork and publisher mark.",
});

export interface ProfileSpec {
  readonly id: AdventureProductionProfileId;
  readonly label: string;
  readonly family: AdventureProductionProfile["family"];
  readonly summary: string;
  readonly productionModes: readonly AdventureProductionMode[];
  readonly compositionModes: readonly AdventureCompositionMode[];
  readonly pixelMotionPolicy?: PresentationProfile["pixelMotionPolicy"];
  readonly palette: AdventureProductionProfile["palette"];
  readonly scene: AdventureProductionProfile["scene"];
  readonly actors: AdventureProductionProfile["actors"];
  readonly animation: AdventureProductionProfile["animation"];
  readonly interface: AdventureProductionProfile["interface"];
  readonly puzzleGrammars: readonly AdventurePuzzleGrammar[];
  readonly audio: AdventureProductionProfile["audio"];
  readonly splash: AdventureSplashProfile;
  readonly showcase: AdventureOriginalShowcaseBrief;
  readonly rule: string;
  readonly prohibition: string;
  readonly reviewQuestions: readonly [string, string, string];
}

export const profile = (spec: ProfileSpec): AdventureProductionProfile => ({
  profileVersion: 1,
  id: spec.id,
  label: spec.label,
  family: spec.family,
  summary: spec.summary,
  nativeSize: { width: 320, height: 200 },
  productionModes: spec.productionModes,
  compositionModes: spec.compositionModes,
  pixelMotionPolicy: spec.pixelMotionPolicy ?? "strict",
  palette: spec.palette,
  scene: spec.scene,
  actors: spec.actors,
  animation: spec.animation,
  interface: spec.interface,
  puzzleGrammars: spec.puzzleGrammars,
  audio: spec.audio,
  splash: spec.splash,
  showcase: spec.showcase,
  authenticityRules: [
    "Author and review every screen at final native resolution.",
    "Protect actor, clue, obstacle and exit readability before decoration.",
    spec.rule,
  ],
  prohibitedShortcuts: [
    "Do not downsample generic high-resolution art as final pixel work.",
    "Do not copy commercial characters, rooms, logos, dialogue or puzzle solutions.",
    spec.prohibition,
  ],
  reviewQuestions: spec.reviewQuestions,
});

