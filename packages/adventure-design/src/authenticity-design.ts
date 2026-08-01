import {
  addAuthenticityCheck,
  createAuthenticityDimension,
  type MutableAuthenticityDimension,
} from "./authenticity-types.js";
import {
  adventurePuzzleDependencyOrder,
  validateAdventureDesignDocument,
} from "./validation.js";
import type {
  AdventureDesignDocument,
  AdventureDesignId,
} from "./types.js";

const distinctStrings = (values: readonly string[]): boolean =>
  new Set(values.map((value) => value.trim().toLocaleLowerCase("en-US"))).size ===
  values.length;

const reachableLocationIds = (
  document: AdventureDesignDocument,
  startLocationId: string,
): ReadonlySet<string> => {
  const adjacency = new Map<string, string[]>();
  for (const location of document.map.locations) adjacency.set(location.id, []);
  for (const route of document.map.routes) {
    adjacency.get(route.fromLocationId)?.push(route.toLocationId);
    if (route.bidirectional) adjacency.get(route.toLocationId)?.push(route.fromLocationId);
  }
  const visited = new Set<string>();
  const queue = [startLocationId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
};

const worldCohesion = (
  document: AdventureDesignDocument,
): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("world-cohesion");
  addAuthenticityCheck(
    result,
    document.map.locations.length >= 2 && document.map.routes.length >= 1,
    2,
    {
      id: "world-map-too-small",
      severity: "note",
      path: "map",
      message: "The design has not demonstrated meaningful geography or travel consequence.",
      recommendation: "Author at least two distinct locations and one route before judging world flow.",
    },
  );
  addAuthenticityCheck(
    result,
    document.chapters.every((chapter) =>
      [...reachableLocationIds(document, chapter.startLocationId)].some((id) =>
        chapter.unlockedLocationIds.includes(id as AdventureDesignId<"location">),
      ),
    ),
    3,
    {
      id: "world-chapter-route-disconnected",
      severity: "warning",
      path: "chapters",
      message: "A chapter does not connect its start to a location it claims to unlock.",
      recommendation:
        "Align chapter progression, route access and puzzle gates so geography changes clearly.",
    },
  );
  addAuthenticityCheck(
    result,
    document.map.locations.every((location) => location.chapterIds.length > 0),
    2,
    {
      id: "world-location-without-chapter",
      severity: "warning",
      path: "map.locations",
      message: "One or more locations have no chapter availability.",
      recommendation: "Assign every location to at least one progression phase.",
    },
  );
  addAuthenticityCheck(
    result,
    distinctStrings(document.map.locations.map((location) => location.arrivalBeat)),
    1,
    {
      id: "world-arrival-beats-repeated",
      severity: "note",
      path: "map.locations",
      message: "Arrival beats repeat and weaken the rhythm of discovery.",
      recommendation: "Vary social pressure, camera emphasis, first task and world response.",
    },
  );
  addAuthenticityCheck(result, document.map.artBrief.length >= 48, 2, {
    id: "world-map-art-brief-thin",
    severity: "note",
    path: "map.artBrief",
    message: "The illustrated map lacks enough direction to become part of the visual identity.",
    recommendation:
      "Define material, projection, icon language, routes, state changes and non-GPS interaction.",
  });
  return result;
};

const requiredPuzzlesHaveGuaranteedClues = (
  document: AdventureDesignDocument,
): boolean => {
  const guaranteed = new Set(
    document.clues
      .filter((clue) => clue.guaranteed)
      .flatMap((clue) => clue.supportsPuzzleIds),
  );
  return document.puzzles.every((puzzle) => puzzle.optional || guaranteed.has(puzzle.id));
};

const puzzleCausality = (
  document: AdventureDesignDocument,
): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("puzzle-causality");
  let orderValid = true;
  try {
    adventurePuzzleDependencyOrder(document);
  } catch {
    orderValid = false;
  }
  addAuthenticityCheck(result, orderValid, 2, {
    id: "puzzle-dependency-cycle",
    severity: "error",
    path: "puzzles",
    message: "Puzzle dependencies contain a cycle.",
    recommendation: "Break the cycle or model a branch as an alternate solution.",
  });
  addAuthenticityCheck(
    result,
    document.puzzles.every((puzzle) => puzzle.problemIntroducedBeforeSolution),
    2,
    {
      id: "puzzle-backwards-construction",
      severity: "warning",
      path: "puzzles",
      message: "A puzzle presents its solution before the player understands the problem.",
      recommendation:
        "Establish the obstacle first so discoveries create recognition rather than hoarding.",
    },
  );
  addAuthenticityCheck(result, requiredPuzzlesHaveGuaranteedClues(document), 2, {
    id: "puzzle-required-clue-not-guaranteed",
    severity: "error",
    path: "puzzles",
    message: "A required puzzle lacks a guaranteed clue-delivery path.",
    recommendation:
      "Guarantee a clue through environment, dialogue, inventory, research, map or cutscene.",
  });
  addAuthenticityCheck(
    result,
    document.puzzles.every(
      (puzzle) => puzzle.storyPayoff.length >= 32 && puzzle.rationale.length >= 32,
    ),
    2,
    {
      id: "puzzle-dramatic-purpose-thin",
      severity: "warning",
      path: "puzzles",
      message: "A puzzle lacks a clear dramatic payoff or design rationale.",
      recommendation:
        "Tie every puzzle to story, access, character, relationship, knowledge or mastery.",
    },
  );
  addAuthenticityCheck(
    result,
    document.puzzles.every((puzzle) => puzzle.hints.length >= 3 && puzzle.hints.length <= 6),
    1,
    {
      id: "puzzle-hint-ladder-thin",
      severity: "note",
      path: "puzzles",
      message: "A puzzle lacks a three-to-six-stage hint ladder.",
      recommendation:
        "Escalate from restating the goal, to narrowing the domain, to the decisive link.",
    },
  );
  addAuthenticityCheck(
    result,
    document.puzzles.every((puzzle) =>
      puzzle.solutions.every((solution) =>
        solution.steps.every((step) => step.result.length >= 12),
      ),
    ),
    1,
    {
      id: "puzzle-feedback-thin",
      severity: "note",
      path: "puzzles",
      message: "A solution step lacks specific authored feedback.",
      recommendation: "Reward intent with visible, audible or narrative response.",
    },
  );
  return result;
};

const cinematicContinuity = (
  document: AdventureDesignDocument,
): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("cinematic-continuity");
  addAuthenticityCheck(
    result,
    document.cutscenes.every((cutscene) => cutscene.shots.length >= 2),
    2,
    {
      id: "cinematic-single-shot",
      severity: "note",
      path: "cutscenes",
      message: "A cutscene has fewer than two planned shots.",
      recommendation:
        "Add a shot only when it changes geography, information, power, reaction or handoff.",
    },
  );
  addAuthenticityCheck(
    result,
    document.cutscenes.every((cutscene) => {
      const orders = cutscene.shots
        .map((shot) => shot.order)
        .sort((left, right) => left - right);
      return orders.every((order, index) => order === index);
    }),
    2,
    {
      id: "cinematic-shot-order-gap",
      severity: "error",
      path: "cutscenes",
      message: "A storyboard has duplicate or non-contiguous shot order.",
      recommendation: "Number shots from zero without gaps for deterministic timeline conversion.",
    },
  );
  addAuthenticityCheck(
    result,
    document.cutscenes.every(
      (cutscene) => !cutscene.skippable || cutscene.completionActions.length > 0,
    ),
    2,
    {
      id: "cinematic-skip-state-missing",
      severity: "error",
      path: "cutscenes",
      message: "A skippable cutscene has no deterministic completion state.",
      recommendation: "Apply the same canonical outcome to watched and skipped paths.",
    },
  );
  addAuthenticityCheck(
    result,
    document.cutscenes.every(
      (cutscene) =>
        new Set(cutscene.shots.map((shot) => `${shot.framing}|${shot.camera}`)).size >=
        Math.min(2, cutscene.shots.length),
    ),
    2,
    {
      id: "cinematic-visual-progression-flat",
      severity: "note",
      path: "cutscenes",
      message: "A storyboard repeats the same framing and camera intent.",
      recommendation: "Change framing when it reveals information, eye line or power.",
    },
  );
  addAuthenticityCheck(
    result,
    document.cutscenes.every((cutscene) =>
      cutscene.shots.every(
        (shot) => shot.durationTicks > 0 && shot.transition.length >= 3,
      ),
    ),
    2,
    {
      id: "cinematic-timing-or-transition-thin",
      severity: "warning",
      path: "cutscenes",
      message: "A shot lacks usable timing or transition intent.",
      recommendation:
        "Author duration and the cut, dissolve, wipe, match action or gameplay handoff.",
    },
  );
  return result;
};

const productionDiscipline = (
  document: AdventureDesignDocument,
): MutableAuthenticityDimension => {
  const result = createAuthenticityDimension("production-discipline");
  const canonicalIssues = validateAdventureDesignDocument(document);
  addAuthenticityCheck(
    result,
    canonicalIssues.every((issue) => issue.severity !== "error"),
    3,
    {
      id: "production-canonical-errors",
      severity: "error",
      path: "$",
      message: "The canonical adventure-design validator reports errors.",
      recommendation: "Resolve references and deterministic invariants before visual polish.",
    },
  );
  addAuthenticityCheck(
    result,
    document.reviewChecklist.filter((item) => item.required).length >= 6,
    2,
    {
      id: "production-review-checklist-thin",
      severity: "warning",
      path: "reviewChecklist",
      message: "The required checklist cannot govern a multi-discipline adventure project.",
      recommendation:
        "Require native-size, palette, silhouette, puzzle, cinematic, audio, UI and access reviews.",
    },
  );
  addAuthenticityCheck(
    result,
    document.creativeDirection.authenticityRules.length >= 4 &&
      document.creativeDirection.prohibitedShortcuts.length >= 4,
    2,
    {
      id: "production-guardrails-thin",
      severity: "warning",
      path: "creativeDirection",
      message: "Positive guardrails or prohibited shortcuts are underdeveloped.",
      recommendation: "Record practical pass/fail rules rather than a general mood statement.",
    },
  );
  addAuthenticityCheck(
    result,
    document.chapters.length > 0 &&
      document.puzzles.length > 0 &&
      document.cutscenes.length > 0,
    2,
    {
      id: "production-pillar-missing",
      severity: "warning",
      path: "$",
      message: "Progression, puzzle causality and cinematic intent are not all demonstrated.",
      recommendation:
        "Author one chapter, puzzle thread and state-convergent cinematic before scaling.",
    },
  );
  addAuthenticityCheck(
    result,
    canonicalIssues.filter((issue) => issue.severity === "warning").length <= 2,
    1,
    {
      id: "production-warning-load-high",
      severity: "note",
      path: "$",
      message: "The canonical validator still reports several warnings.",
      recommendation: "Reduce warning debt before scaling asset production.",
    },
  );
  return result;
};

export const evaluateAdventureDesignDimensions = (
  document: AdventureDesignDocument,
): readonly MutableAuthenticityDimension[] => [
  worldCohesion(document),
  puzzleCausality(document),
  cinematicContinuity(document),
  productionDiscipline(document),
];
