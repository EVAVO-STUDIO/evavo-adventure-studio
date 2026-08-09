import { classicExperienceContractByFamily } from "./classic-experience-presets.js";
import type {
  ClassicExperienceFinding,
  ClassicExperienceFindingCode,
  ClassicExperiencePrincipleId,
  ClassicExperiencePrincipleResult,
  ClassicExperienceReport,
} from "./classic-experience-types.js";
import type { ClassicAdventureCreatorProject } from "./classic-game-creator-types.js";

const addFinding = (
  findings: ClassicExperienceFinding[],
  severity: ClassicExperienceFinding["severity"],
  code: ClassicExperienceFindingCode,
  path: string,
  message: string,
  recommendation: string,
  impact: number,
): void => {
  findings.push({ severity, code, path, message, recommendation, impact });
};

const result = (
  id: ClassicExperiencePrincipleId,
  passed: boolean,
  evidence: readonly string[],
): ClassicExperiencePrincipleResult => ({ id, passed, evidence });

const discoveryLanguage = /inspect|read|notice|establish|discover|learn|compare/iu;

export const auditClassicExperience = (project: ClassicAdventureCreatorProject): ClassicExperienceReport => {
  const contract = classicExperienceContractByFamily(project.family);
  const findings: ClassicExperienceFinding[] = [];
  const gameplayScenes = project.scenes.filter((scene) => scene.kind === "gameplay");
  const interactiveTargets = gameplayScenes.flatMap((scene) =>
    scene.props.filter((prop) => prop.interactive),
  );
  const recoverablePuzzles = project.puzzles.filter(
    (puzzle) => !puzzle.irreversibleFailure && puzzle.recovery.trim().length >= 40,
  );
  const dialogueTopicCount = project.dialogues.reduce((total, dialogue) => total + dialogue.topics.length, 0);
  const nativeReviewProofCount = gameplayScenes.reduce(
    (total, scene) => total + scene.reviewProofs.length,
    0,
  );

  const objectivesClear = gameplayScenes.every((scene) => scene.playerGoal.trim().length >= 18);
  if (!objectivesClear) {
    addFinding(
      findings,
      "error",
      "unclear-objective",
      "scenes",
      "At least one gameplay scene lacks a concise player-facing objective.",
      "State the immediate objective in world terms without revealing the solution.",
      14,
    );
  }

  const subgoalsVisible = project.puzzles.every(
    (puzzle) => puzzle.steps.length >= contract.minimumPuzzleSteps,
  );
  if (!subgoalsVisible) {
    addFinding(
      findings,
      "error",
      "thin-puzzle-causality",
      "puzzles",
      "A puzzle does not expose enough causal subgoals for the selected family.",
      `Author at least ${contract.minimumPuzzleSteps} observable steps before resolution.`,
      14,
    );
  }

  const problemsPrecedeSolutions = project.puzzles.every((puzzle) =>
    discoveryLanguage.test(puzzle.steps[0] ?? ""),
  );
  if (!problemsPrecedeSolutions) {
    addFinding(
      findings,
      "warning",
      "solution-before-problem",
      "puzzles",
      "A puzzle introduces manipulation before the player discovers the problem.",
      "Begin with inspection, testimony or visible environmental evidence.",
      9,
    );
  }

  if (recoverablePuzzles.length !== project.puzzles.length) {
    addFinding(
      findings,
      "error",
      "unsafe-puzzle-state",
      "puzzles",
      "A required puzzle can lose its only productive state or lacks concrete recovery.",
      "Make every required item, topic and location recoverable until resolution.",
      20,
    );
  }

  const noMandatoryFailure = project.puzzles.every((puzzle) => puzzle.irreversibleFailure === false);
  if (!noMandatoryFailure) {
    addFinding(
      findings,
      "error",
      "mandatory-failure",
      "puzzles",
      "The authored route requires destructive failure or save restoration.",
      "Use consequence, alternate dialogue or score variation instead of mandatory death.",
      20,
    );
  }

  const hollywoodTime = project.timing.sceneDarkHoldTicks <= 12 && project.timing.lineMinimumTicks <= 150;
  if (!hollywoodTime) {
    addFinding(
      findings,
      "warning",
      "hostile-time-pressure",
      "timing",
      "Presentation holds are long enough to interrupt reasoning or repeated exploration.",
      "Keep dramatic time authored and forgiving; do not make wall-clock reaction mandatory.",
      8,
    );
  }

  const storyAdvancing = project.puzzles.every(
    (puzzle) => puzzle.result.trim().length >= 50 && puzzle.setupSceneId !== puzzle.resolutionSceneId,
  );
  if (!storyAdvancing) {
    addFinding(
      findings,
      "warning",
      "detached-puzzle-result",
      "puzzles",
      "A puzzle result is too small or self-contained to advance the world state.",
      "Change a location, testimony, route, relationship or visible system after resolution.",
      10,
    );
  }

  const rewardsIntent =
    project.timing.wrongActionHoldTicks <= contract.maximumWrongActionHoldTicks &&
    project.puzzles.every((puzzle) => puzzle.recovery.trim().length >= 40);
  if (!rewardsIntent) {
    addFinding(
      findings,
      "warning",
      "punitive-feedback-delay",
      "timing.wrongActionHoldTicks",
      "Failed experiments are held too long or do not teach the player anything.",
      "Use a brief authored response that confirms the attempted idea and narrows the search.",
      9,
    );
  }

  const incrementalRewards = project.puzzles.every(
    (puzzle) => puzzle.steps.length >= 3 && puzzle.result.trim().length >= 50,
  );
  if (!incrementalRewards) {
    addFinding(
      findings,
      "warning",
      "missing-progress-reward",
      "puzzles",
      "The route lacks visible intermediate acknowledgement before its final reward.",
      "Reward observation, acquisition, research and confrontation as separate state changes.",
      8,
    );
  }

  const parallelOptions =
    interactiveTargets.length >= contract.minimumInteractiveTargets || dialogueTopicCount >= 4;
  if (!parallelOptions) {
    addFinding(
      findings,
      "warning",
      "single-thread-cage",
      "scenes",
      "The player has only one productive thread and can become trapped in repetition.",
      "Provide another inspectable clue, conversation topic or reachable location.",
      10,
    );
  }

  const nativeReadable = gameplayScenes.every(
    (scene) =>
      scene.reviewProofs.length >= contract.minimumReviewProofsPerGameplayScene &&
      scene.actors.some((actor) => actor.role === "player") &&
      scene.props.some((prop) => prop.role === "exit"),
  );
  if (!nativeReadable) {
    addFinding(
      findings,
      "error",
      "weak-native-proof",
      "scenes",
      "A gameplay plate lacks one-times-native proof for its actor, target or exit.",
      "Review the final indexed frame at 1x and record silhouette, value and route evidence.",
      16,
    );
  }

  const responsiveInput =
    project.timing.pointerAcknowledgeTicks <= contract.maximumPointerAcknowledgeTicks &&
    project.timing.hoverCommitTicks <= contract.maximumHoverCommitTicks;
  if (!responsiveInput) {
    addFinding(
      findings,
      "warning",
      "sluggish-input",
      "timing",
      "Pointer acknowledgement or hover commitment exceeds the family contract.",
      "Keep acknowledgement immediate and place personality in animation, not input latency.",
      10,
    );
  }

  const principles: readonly ClassicExperiencePrincipleResult[] = [
    result("clear-objective", objectivesClear, [`${gameplayScenes.length} gameplay objective(s) reviewed`]),
    result("visible-subgoals", subgoalsVisible, [
      `${project.puzzles.length} causal puzzle route(s) reviewed`,
    ]),
    result("discover-before-use", problemsPrecedeSolutions, [
      "Opening puzzle steps establish evidence before manipulation",
    ]),
    result("recoverable-required-items", recoverablePuzzles.length === project.puzzles.length, [
      `${recoverablePuzzles.length}/${project.puzzles.length} puzzle route(s) recoverable`,
    ]),
    result("no-mandatory-death", noMandatoryFailure, [
      "Required progression does not depend on death or reload",
    ]),
    result("hollywood-time", hollywoodTime, [
      "Dramatic holds use logical ticks rather than reflex deadlines",
    ]),
    result("story-advancing-puzzles", storyAdvancing, [
      "Puzzle results alter a scene, route, testimony or world system",
    ]),
    result("reward-player-intent", rewardsIntent, [
      `${(project.timing.wrongActionHoldTicks / 60).toFixed(2)}s wrong-action hold`,
    ]),
    result("incremental-rewards", incrementalRewards, [
      "Observation, acquisition and resolution are separately authored",
    ]),
    result("parallel-options", parallelOptions, [
      `${interactiveTargets.length} interactive target(s), ${dialogueTopicCount} dialogue topic(s)`,
    ]),
    result("native-readability", nativeReadable, [
      `${nativeReviewProofCount} recorded native review proof(s)`,
    ]),
    result("responsive-input", responsiveInput, [
      `${project.timing.pointerAcknowledgeTicks} acknowledgement tick(s)`,
      `${project.timing.hoverCommitTicks} hover-commit tick(s)`,
    ]),
  ];

  const impact = findings.reduce((total, finding) => total + finding.impact, 0);
  const score = Math.max(0, 100 - impact);
  const status = findings.some((finding) => finding.severity === "error")
    ? "blocked"
    : findings.some((finding) => finding.severity === "warning")
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    projectId: project.id,
    family: project.family,
    status,
    score,
    contract,
    principles,
    findings: [...findings].sort((left, right) => {
      const path = left.path.localeCompare(right.path);
      return path !== 0 ? path : left.code.localeCompare(right.code);
    }),
    metrics: {
      gameplaySceneCount: gameplayScenes.length,
      interactiveTargetCount: interactiveTargets.length,
      puzzleCount: project.puzzles.length,
      recoverablePuzzleCount: recoverablePuzzles.length,
      dialogueTopicCount,
      nativeReviewProofCount,
      averageWrongActionSeconds: Number((project.timing.wrongActionHoldTicks / 60).toFixed(2)),
    },
  };
};
