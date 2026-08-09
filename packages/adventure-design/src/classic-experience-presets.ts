import type { ClassicExperienceContract, ClassicExperiencePrincipleId } from "./classic-experience-types.js";
import type { ClassicAdventureCreatorFamily } from "./classic-game-creator-types.js";

const principles: readonly ClassicExperiencePrincipleId[] = [
  "clear-objective",
  "visible-subgoals",
  "discover-before-use",
  "recoverable-required-items",
  "no-mandatory-death",
  "hollywood-time",
  "story-advancing-puzzles",
  "reward-player-intent",
  "incremental-rewards",
  "parallel-options",
  "native-readability",
  "responsive-input",
];

export const classicExperienceContracts: Readonly<
  Record<ClassicAdventureCreatorFamily, ClassicExperienceContract>
> = {
  "storybook-icon": {
    contractVersion: 1,
    family: "storybook-icon",
    label: "Storybook discovery without punishment",
    designPromise:
      "A deliberate illustrated quest whose objectives remain readable and whose magical mistakes create clues, not dead ends.",
    inputDoctrine:
      "Acknowledge the pointer immediately, commit the selected icon clearly and never hide essential progress behind pixel hunting.",
    puzzleDoctrine:
      "Establish the environmental problem before its tool appears, then preserve a visible physical result in the world.",
    failureDoctrine:
      "Wrong notes, routes and item uses may change performance or atmosphere, but they never destroy required progress.",
    hintDoctrine:
      "Repeat visual motifs and character observations before offering optional explicit assistance.",
    timingDoctrine:
      "Keep storybook anticipation and fades, but let repeated traversal and failed actions resolve promptly.",
    nativeReviewDoctrine:
      "At one-times native size, the actor, current objective, usable prop and exit must separate by silhouette or value.",
    minimumInteractiveTargets: 2,
    maximumPointerAcknowledgeTicks: 2,
    maximumHoverCommitTicks: 4,
    maximumWrongActionHoldTicks: 60,
    minimumPuzzleSteps: 3,
    minimumReviewProofsPerGameplayScene: 3,
    principles,
  },
  "gothic-investigation": {
    contractVersion: 1,
    family: "gothic-investigation",
    label: "Evidence-led mystery without guesswork",
    designPromise:
      "A measured supernatural investigation where every accusation is supported by physical evidence, remembered topics and visible consequences.",
    inputDoctrine:
      "Use restrained contextual cursors, immediate click acknowledgement and explicit evidence topics rather than invisible verbs.",
    puzzleDoctrine:
      "Discovery, research, comparison and confrontation form one causal chain; the player sees the contradiction before being asked to prove it.",
    failureDoctrine:
      "Premature theories may alter dialogue temporarily, but researched evidence always restores a productive path.",
    hintDoctrine:
      "The ledger records observations and contradictions while optional assistance points to evidence categories, never the final answer.",
    timingDoctrine:
      "Portrait holds and room ambience may breathe, while cursor response, walking and repeated research remain brisk enough to preserve thought flow.",
    nativeReviewDoctrine:
      "Reserve evidence-red for consequential clues and keep faces, hands, documents and exits readable against rain-dark rooms.",
    minimumInteractiveTargets: 3,
    maximumPointerAcknowledgeTicks: 2,
    maximumHoverCommitTicks: 4,
    maximumWrongActionHoldTicks: 66,
    minimumPuzzleSteps: 4,
    minimumReviewProofsPerGameplayScene: 3,
    principles,
  },
  "verb-panel-comedy": {
    contractVersion: 1,
    family: "verb-panel-comedy",
    label: "Readable object comedy without parser friction",
    designPromise:
      "A fast sentence-building adventure where the interface exposes player intent and every failed experiment earns a concise authored response.",
    inputDoctrine:
      "Keep verbs, sentence construction and inventory continuously legible, with zero-delay hover and click acknowledgement.",
    puzzleDoctrine:
      "Use concrete objects and escalating comic consequences; combinations remain recoverable until their intended result is awarded.",
    failureDoctrine:
      "Never consume the only solution object, and never make repetition the price of understanding a joke.",
    hintDoctrine:
      "Wrong-action lines narrow the possibility space while preserving the comic voice and avoiding direct solution dumps.",
    timingDoctrine:
      "Favor quick turns, short recovery and compact lines so experimentation feels playful rather than laborious.",
    nativeReviewDoctrine:
      "The reduced gameplay viewport must still preserve the actor lane, object silhouettes and exit readability above persistent chrome.",
    minimumInteractiveTargets: 3,
    maximumPointerAcknowledgeTicks: 1,
    maximumHoverCommitTicks: 1,
    maximumWrongActionHoldTicks: 42,
    minimumPuzzleSteps: 4,
    minimumReviewProofsPerGameplayScene: 3,
    principles,
  },
};

export const classicExperienceContractByFamily = (
  family: ClassicAdventureCreatorFamily,
): ClassicExperienceContract => classicExperienceContracts[family];
