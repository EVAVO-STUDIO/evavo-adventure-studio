import type { Action, AdventureProject } from "@evavo/adventure-project-schema";
import type {
  AdventureChapter,
  AdventureDesignDocument,
  AdventureDesignIssue,
  AdventureProjectShell,
  AdventurePuzzle,
} from "./types.js";

const addIssue = (
  issues: AdventureDesignIssue[],
  severity: AdventureDesignIssue["severity"],
  code: string,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const duplicateIds = (
  issues: AdventureDesignIssue[],
  entries: readonly { readonly id: string; readonly path: string }[],
): void => {
  const first = new Map<string, string>();
  for (const entry of entries) {
    const previous = first.get(entry.id);
    if (previous) {
      addIssue(
        issues,
        "error",
        "duplicate-id",
        entry.path,
        `ID '${entry.id}' is already declared at '${previous}'.`,
      );
    } else {
      first.set(entry.id, entry.path);
    }
  }
};

const allIdEntries = (
  document: AdventureDesignDocument,
): readonly { readonly id: string; readonly path: string }[] => [
  ...document.map.locations.map((location, index) => ({
    id: location.id,
    path: `map.locations[${index}].id`,
  })),
  ...document.map.routes.map((route, index) => ({
    id: route.id,
    path: `map.routes[${index}].id`,
  })),
  ...document.chapters.map((chapter, index) => ({
    id: chapter.id,
    path: `chapters[${index}].id`,
  })),
  ...document.clues.map((clue, index) => ({
    id: clue.id,
    path: `clues[${index}].id`,
  })),
  ...document.puzzles.flatMap((puzzle, puzzleIndex) => [
    { id: puzzle.id, path: `puzzles[${puzzleIndex}].id` },
    ...puzzle.solutions.flatMap((solution, solutionIndex) => [
      {
        id: solution.id,
        path: `puzzles[${puzzleIndex}].solutions[${solutionIndex}].id`,
      },
      ...solution.steps.map((step, stepIndex) => ({
        id: step.id,
        path: `puzzles[${puzzleIndex}].solutions[${solutionIndex}].steps[${stepIndex}].id`,
      })),
    ]),
  ]),
  ...document.cutscenes.flatMap((cutscene, cutsceneIndex) => [
    { id: cutscene.id, path: `cutscenes[${cutsceneIndex}].id` },
    ...cutscene.shots.map((shot, shotIndex) => ({
      id: shot.id,
      path: `cutscenes[${cutsceneIndex}].shots[${shotIndex}].id`,
    })),
  ]),
  ...document.reviewChecklist.map((item, index) => ({
    id: item.id,
    path: `reviewChecklist[${index}].id`,
  })),
];

export class AdventurePuzzleCycleError extends Error {
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Puzzle dependency cycle: ${cycle.join(" -> ")}.`);
    this.name = "AdventurePuzzleCycleError";
    this.cycle = cycle;
  }
}

export const adventurePuzzleDependencyOrder = (
  document: Pick<AdventureDesignDocument, "puzzles">,
): readonly AdventurePuzzle["id"][] => {
  const byId = new Map(document.puzzles.map((puzzle) => [puzzle.id, puzzle] as const));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const puzzle of document.puzzles) {
    incoming.set(puzzle.id, 0);
    outgoing.set(puzzle.id, []);
  }
  for (const puzzle of document.puzzles) {
    for (const dependencyId of puzzle.dependencyIds) {
      if (!byId.has(dependencyId)) continue;
      incoming.set(puzzle.id, (incoming.get(puzzle.id) ?? 0) + 1);
      outgoing.get(dependencyId)?.push(puzzle.id);
    }
  }

  const ready = [...incoming]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort((left, right) => left.localeCompare(right));
  const output: AdventurePuzzle["id"][] = [];

  while (ready.length > 0) {
    const id = ready.shift();
    if (!id) break;
    output.push(id as AdventurePuzzle["id"]);
    for (const dependentId of (outgoing.get(id) ?? []).sort((left, right) => left.localeCompare(right))) {
      const next = (incoming.get(dependentId) ?? 0) - 1;
      incoming.set(dependentId, next);
      if (next === 0) {
        ready.push(dependentId);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (output.length !== document.puzzles.length) {
    const cycle = [...incoming]
      .filter(([, count]) => count > 0)
      .map(([id]) => id)
      .sort((left, right) => left.localeCompare(right));
    throw new AdventurePuzzleCycleError(cycle);
  }
  return output;
};

const validateHintLadder = (issues: AdventureDesignIssue[], puzzle: AdventurePuzzle, path: string): void => {
  if (puzzle.hints.length < 3 || puzzle.hints.length > 6) {
    addIssue(
      issues,
      "warning",
      "hint-count-outside-guideline",
      `${path}.hints`,
      "A production hint ladder should normally contain three to six graduated hints.",
    );
  }
  const levels = puzzle.hints.map((hint) => hint.level);
  const unique = new Set(levels);
  if (unique.size !== levels.length) {
    addIssue(issues, "error", "hint-level-duplicate", `${path}.hints`, "Hint levels must be unique.");
  }
  const sorted = [...unique].sort((left, right) => left - right);
  sorted.forEach((level, index) => {
    if (level !== index + 1) {
      addIssue(
        issues,
        "error",
        "hint-level-gap",
        `${path}.hints`,
        "Hint levels must form a continuous sequence beginning at 1.",
      );
    }
  });
};

const reachableLocations = (
  document: AdventureDesignDocument,
  chapter: AdventureChapter,
): ReadonlySet<string> => {
  const adjacency = new Map<string, string[]>();
  for (const location of document.map.locations) adjacency.set(location.id, []);
  for (const route of document.map.routes) {
    adjacency.get(route.fromLocationId)?.push(route.toLocationId);
    if (route.bidirectional) {
      adjacency.get(route.toLocationId)?.push(route.fromLocationId);
    }
  }
  const visited = new Set<string>();
  const queue = [chapter.startLocationId as string];
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

export const validateAdventureDesignDocument = (
  document: AdventureDesignDocument,
): readonly AdventureDesignIssue[] => {
  const issues: AdventureDesignIssue[] = [];
  duplicateIds(issues, allIdEntries(document));

  const locations = new Set(document.map.locations.map((location) => location.id));
  const chapters = new Set(document.chapters.map((chapter) => chapter.id));
  const clues = new Map(document.clues.map((clue) => [clue.id, clue] as const));
  const puzzles = new Set(document.puzzles.map((puzzle) => puzzle.id));
  const cutscenes = new Set(document.cutscenes.map((cutscene) => cutscene.id));

  if (document.creativeDirection.palette.keyColours.length < 4) {
    addIssue(
      issues,
      "warning",
      "palette-roles-too-sparse",
      "creativeDirection.palette.keyColours",
      "Define at least four anchor colours so shadows, materials, actors and interface accents share a deliberate visual language.",
    );
  }
  if (document.creativeDirection.authenticityRules.length === 0) {
    addIssue(
      issues,
      "error",
      "missing-authenticity-rules",
      "creativeDirection.authenticityRules",
      "The production bible needs explicit authenticity rules.",
    );
  }
  if (document.creativeDirection.prohibitedShortcuts.length === 0) {
    addIssue(
      issues,
      "error",
      "missing-prohibited-shortcuts",
      "creativeDirection.prohibitedShortcuts",
      "Record the shortcuts that would break the intended period production language.",
    );
  }

  document.map.locations.forEach((location, index) => {
    location.chapterIds.forEach((chapterId, chapterIndex) => {
      if (!chapters.has(chapterId)) {
        addIssue(
          issues,
          "error",
          "missing-chapter",
          `map.locations[${index}].chapterIds[${chapterIndex}]`,
          `Location references unknown chapter '${chapterId}'.`,
        );
      }
    });
    location.unlockedByPuzzleIds.forEach((puzzleId, puzzleIndex) => {
      if (!puzzles.has(puzzleId)) {
        addIssue(
          issues,
          "error",
          "missing-puzzle",
          `map.locations[${index}].unlockedByPuzzleIds[${puzzleIndex}]`,
          `Location unlock references unknown puzzle '${puzzleId}'.`,
        );
      }
    });
  });

  document.map.routes.forEach((route, index) => {
    if (!locations.has(route.fromLocationId)) {
      addIssue(
        issues,
        "error",
        "missing-location",
        `map.routes[${index}].fromLocationId`,
        `Route starts at unknown location '${route.fromLocationId}'.`,
      );
    }
    if (!locations.has(route.toLocationId)) {
      addIssue(
        issues,
        "error",
        "missing-location",
        `map.routes[${index}].toLocationId`,
        `Route ends at unknown location '${route.toLocationId}'.`,
      );
    }
    route.requiredPuzzleIds.forEach((puzzleId, puzzleIndex) => {
      if (!puzzles.has(puzzleId)) {
        addIssue(
          issues,
          "error",
          "missing-puzzle",
          `map.routes[${index}].requiredPuzzleIds[${puzzleIndex}]`,
          `Route gate references unknown puzzle '${puzzleId}'.`,
        );
      }
    });
  });

  document.chapters.forEach((chapter, index) => {
    if (!locations.has(chapter.startLocationId)) {
      addIssue(
        issues,
        "error",
        "missing-location",
        `chapters[${index}].startLocationId`,
        `Chapter begins at unknown location '${chapter.startLocationId}'.`,
      );
    }
    for (const [field, ids] of [
      ["requiredPuzzleIds", chapter.requiredPuzzleIds],
      ["optionalPuzzleIds", chapter.optionalPuzzleIds],
    ] as const) {
      ids.forEach((puzzleId, puzzleIndex) => {
        if (!puzzles.has(puzzleId)) {
          addIssue(
            issues,
            "error",
            "missing-puzzle",
            `chapters[${index}].${field}[${puzzleIndex}]`,
            `Chapter references unknown puzzle '${puzzleId}'.`,
          );
        }
      });
    }
    chapter.unlockedLocationIds.forEach((locationId, locationIndex) => {
      if (!locations.has(locationId)) {
        addIssue(
          issues,
          "error",
          "missing-location",
          `chapters[${index}].unlockedLocationIds[${locationIndex}]`,
          `Chapter unlock references unknown location '${locationId}'.`,
        );
      }
    });
    for (const [field, cutsceneId] of [
      ["openingCutsceneId", chapter.openingCutsceneId],
      ["closingCutsceneId", chapter.closingCutsceneId],
    ] as const) {
      if (cutsceneId && !cutscenes.has(cutsceneId)) {
        addIssue(
          issues,
          "error",
          "missing-cutscene",
          `chapters[${index}].${field}`,
          `Chapter references unknown cutscene '${cutsceneId}'.`,
        );
      }
    }

    const reachable = reachableLocations(document, chapter);
    chapter.unlockedLocationIds.forEach((locationId, locationIndex) => {
      if (locations.has(locationId) && !reachable.has(locationId)) {
        addIssue(
          issues,
          "warning",
          "unreachable-location",
          `chapters[${index}].unlockedLocationIds[${locationIndex}]`,
          `Location '${locationId}' has no authored route from chapter start '${chapter.startLocationId}'.`,
        );
      }
    });
  });

  document.clues.forEach((clue, index) => {
    if (clue.locationId && !locations.has(clue.locationId)) {
      addIssue(
        issues,
        "error",
        "missing-location",
        `clues[${index}].locationId`,
        `Clue references unknown location '${clue.locationId}'.`,
      );
    }
    if (clue.chapterId && !chapters.has(clue.chapterId)) {
      addIssue(
        issues,
        "error",
        "missing-chapter",
        `clues[${index}].chapterId`,
        `Clue references unknown chapter '${clue.chapterId}'.`,
      );
    }
    clue.supportsPuzzleIds.forEach((puzzleId, puzzleIndex) => {
      if (!puzzles.has(puzzleId)) {
        addIssue(
          issues,
          "error",
          "missing-puzzle",
          `clues[${index}].supportsPuzzleIds[${puzzleIndex}]`,
          `Clue supports unknown puzzle '${puzzleId}'.`,
        );
      }
    });
  });

  document.puzzles.forEach((puzzle, index) => {
    const path = `puzzles[${index}]`;
    if (!chapters.has(puzzle.chapterId)) {
      addIssue(
        issues,
        "error",
        "missing-chapter",
        `${path}.chapterId`,
        `Puzzle references unknown chapter '${puzzle.chapterId}'.`,
      );
    }
    if (!locations.has(puzzle.locationId)) {
      addIssue(
        issues,
        "error",
        "missing-location",
        `${path}.locationId`,
        `Puzzle references unknown location '${puzzle.locationId}'.`,
      );
    }
    puzzle.dependencyIds.forEach((dependencyId, dependencyIndex) => {
      if (dependencyId === puzzle.id) {
        addIssue(
          issues,
          "error",
          "puzzle-self-dependency",
          `${path}.dependencyIds[${dependencyIndex}]`,
          "A puzzle cannot depend on itself.",
        );
      } else if (!puzzles.has(dependencyId)) {
        addIssue(
          issues,
          "error",
          "missing-puzzle",
          `${path}.dependencyIds[${dependencyIndex}]`,
          `Puzzle depends on unknown puzzle '${dependencyId}'.`,
        );
      }
    });
    puzzle.clueIds.forEach((clueId, clueIndex) => {
      if (!clues.has(clueId)) {
        addIssue(
          issues,
          "error",
          "missing-clue",
          `${path}.clueIds[${clueIndex}]`,
          `Puzzle references unknown clue '${clueId}'.`,
        );
      }
    });
    for (const [solutionIndex, solution] of puzzle.solutions.entries()) {
      for (const [stepIndex, step] of solution.steps.entries()) {
        step.clueIds.forEach((clueId, clueIndex) => {
          if (!clues.has(clueId)) {
            addIssue(
              issues,
              "error",
              "missing-clue",
              `${path}.solutions[${solutionIndex}].steps[${stepIndex}].clueIds[${clueIndex}]`,
              `Puzzle step references unknown clue '${clueId}'.`,
            );
          }
        });
      }
    }
    if (!puzzle.problemIntroducedBeforeSolution) {
      addIssue(
        issues,
        "error",
        "backwards-puzzle",
        `${path}.problemIntroducedBeforeSolution`,
        "Introduce the player's problem before casually presenting its solution.",
      );
    }
    const guaranteed = puzzle.clueIds.some((clueId) => clues.get(clueId)?.guaranteed);
    if (!puzzle.optional && !guaranteed) {
      addIssue(
        issues,
        "error",
        "required-puzzle-without-guaranteed-clue",
        `${path}.clueIds`,
        "A required puzzle needs at least one guaranteed clue delivery path.",
      );
    }
    validateHintLadder(issues, puzzle, path);
    if (
      puzzle.failure.mode === "death" &&
      (puzzle.failure.warning.trim().length < 8 || puzzle.failure.recovery.trim().length < 8)
    ) {
      addIssue(
        issues,
        "error",
        "unfair-death-policy",
        `${path}.failure`,
        "Authored death requires an intelligible warning and a practical recovery policy.",
      );
    }
  });

  document.cutscenes.forEach((cutscene, index) => {
    const path = `cutscenes[${index}]`;
    if (!chapters.has(cutscene.chapterId)) {
      addIssue(
        issues,
        "error",
        "missing-chapter",
        `${path}.chapterId`,
        `Cutscene references unknown chapter '${cutscene.chapterId}'.`,
      );
    }
    switch (cutscene.trigger.kind) {
      case "chapter-open":
      case "chapter-close":
        if (!chapters.has(cutscene.trigger.chapterId)) {
          addIssue(
            issues,
            "error",
            "missing-chapter",
            `${path}.trigger.chapterId`,
            `Cutscene trigger references unknown chapter '${cutscene.trigger.chapterId}'.`,
          );
        }
        break;
      case "location-enter":
        if (!locations.has(cutscene.trigger.locationId)) {
          addIssue(
            issues,
            "error",
            "missing-location",
            `${path}.trigger.locationId`,
            `Cutscene trigger references unknown location '${cutscene.trigger.locationId}'.`,
          );
        }
        break;
      case "puzzle-complete":
        if (!puzzles.has(cutscene.trigger.puzzleId)) {
          addIssue(
            issues,
            "error",
            "missing-puzzle",
            `${path}.trigger.puzzleId`,
            `Cutscene trigger references unknown puzzle '${cutscene.trigger.puzzleId}'.`,
          );
        }
        break;
      case "dialogue-choice":
        break;
    }
    if (cutscene.skippable && cutscene.completionActions.length === 0) {
      addIssue(
        issues,
        "error",
        "skippable-cutscene-without-final-state",
        `${path}.completionActions`,
        "A skippable cutscene needs deterministic completion actions so watched and skipped paths converge.",
      );
    }
    const orders = cutscene.shots.map((shot) => shot.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      addIssue(
        issues,
        "error",
        "duplicate-shot-order",
        `${path}.shots`,
        "Cutscene shot order values must be unique.",
      );
    }
  });

  try {
    adventurePuzzleDependencyOrder(document);
  } catch (error) {
    if (error instanceof AdventurePuzzleCycleError) {
      addIssue(issues, "error", "puzzle-cycle", "puzzles", error.message);
    } else {
      throw error;
    }
  }

  return issues.sort((left, right) => {
    const severity = left.severity.localeCompare(right.severity);
    if (severity !== 0) return severity;
    const path = left.path.localeCompare(right.path);
    return path !== 0 ? path : left.code.localeCompare(right.code);
  });
};

const projectActionIssues = (
  project: AdventureProjectShell,
  action: Action,
  path: string,
  issues: AdventureDesignIssue[],
): void => {
  const itemIds = new Set(project.inventoryItems.map((item) => item.id));
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene] as const));
  const sequenceIds = new Set(project.sequences.map((sequence) => sequence.id));
  const dialogueById = new Map(project.dialogues.map((dialogue) => [dialogue.id, dialogue] as const));
  const actorIds = new Set(project.actors.map((actor) => actor.id));

  switch (action.kind) {
    case "give-item":
    case "remove-item":
      if (!itemIds.has(action.itemId)) {
        addIssue(
          issues,
          "error",
          "missing-item",
          `${path}.itemId`,
          `Completion action references unknown item '${action.itemId}'.`,
        );
      }
      break;
    case "change-scene": {
      const scene = sceneById.get(action.sceneId);
      if (!scene) {
        addIssue(
          issues,
          "error",
          "missing-scene",
          `${path}.sceneId`,
          `Completion action references unknown scene '${action.sceneId}'.`,
        );
      } else if (!scene.entrances.some((entrance) => entrance.id === action.entranceId)) {
        addIssue(
          issues,
          "error",
          "missing-entrance",
          `${path}.entranceId`,
          `Scene '${action.sceneId}' has no entrance '${action.entranceId}'.`,
        );
      }
      break;
    }
    case "play-sequence":
      if (!sequenceIds.has(action.sequenceId)) {
        addIssue(
          issues,
          "error",
          "missing-sequence",
          `${path}.sequenceId`,
          `Completion action references unknown sequence '${action.sequenceId}'.`,
        );
      }
      break;
    case "start-dialogue": {
      const dialogue = dialogueById.get(action.dialogueId);
      if (!dialogue) {
        addIssue(
          issues,
          "error",
          "missing-dialogue",
          `${path}.dialogueId`,
          `Completion action references unknown dialogue '${action.dialogueId}'.`,
        );
      } else if (action.nodeId && !dialogue.nodes.some((node) => node.id === action.nodeId)) {
        addIssue(
          issues,
          "error",
          "missing-dialogue-node",
          `${path}.nodeId`,
          `Dialogue '${action.dialogueId}' has no node '${action.nodeId}'.`,
        );
      }
      break;
    }
    case "say":
      if (action.speakerId && !actorIds.has(action.speakerId)) {
        addIssue(
          issues,
          "error",
          "missing-actor",
          `${path}.speakerId`,
          `Completion action references unknown actor '${action.speakerId}'.`,
        );
      }
      break;
    case "set-flag":
    case "set-variable":
    case "award-score":
    case "set-object-state":
      break;
  }
};

export const validateAdventureDesignAgainstProject = (
  project: AdventureProjectShell,
  document: AdventureDesignDocument,
): readonly AdventureDesignIssue[] => {
  const issues: AdventureDesignIssue[] = [];
  if (project.id !== document.projectId) {
    addIssue(
      issues,
      "error",
      "project-mismatch",
      "projectId",
      `Adventure design project '${document.projectId}' does not match '${project.id}'.`,
    );
  }
  if (
    project.presentation.nativeWidth !== document.creativeDirection.nativeSize.width ||
    project.presentation.nativeHeight !== document.creativeDirection.nativeSize.height
  ) {
    addIssue(
      issues,
      "error",
      "native-size-mismatch",
      "creativeDirection.nativeSize",
      `Adventure design native size ${document.creativeDirection.nativeSize.width} × ${document.creativeDirection.nativeSize.height} does not match project ${project.presentation.nativeWidth} × ${project.presentation.nativeHeight}.`,
    );
  }

  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const itemIds = new Set(project.inventoryItems.map((item) => item.id));
  const dialogueChoiceIds = new Set(
    project.dialogues.flatMap((dialogue) =>
      dialogue.nodes.flatMap((node) => node.choices.map((choice) => choice.id)),
    ),
  );

  document.map.locations.forEach((location, index) => {
    if (location.sceneId && !sceneIds.has(location.sceneId)) {
      addIssue(
        issues,
        "error",
        "missing-scene",
        `map.locations[${index}].sceneId`,
        `Design location references unknown project scene '${location.sceneId}'.`,
      );
    }
  });
  document.puzzles.forEach((puzzle, puzzleIndex) => {
    puzzle.solutions.forEach((solution, solutionIndex) => {
      solution.steps.forEach((step, stepIndex) => {
        if (step.itemId && !itemIds.has(step.itemId)) {
          addIssue(
            issues,
            "error",
            "missing-item",
            `puzzles[${puzzleIndex}].solutions[${solutionIndex}].steps[${stepIndex}].itemId`,
            `Puzzle step references unknown project item '${step.itemId}'.`,
          );
        }
      });
    });
  });
  document.cutscenes.forEach((cutscene, cutsceneIndex) => {
    if (
      cutscene.trigger.kind === "dialogue-choice" &&
      !dialogueChoiceIds.has(cutscene.trigger.dialogueChoiceId)
    ) {
      addIssue(
        issues,
        "error",
        "missing-dialogue-choice",
        `cutscenes[${cutsceneIndex}].trigger.dialogueChoiceId`,
        `Cutscene trigger references unknown dialogue choice '${cutscene.trigger.dialogueChoiceId}'.`,
      );
    }
    cutscene.completionActions.forEach((action, actionIndex) => {
      projectActionIssues(
        project,
        action,
        `cutscenes[${cutsceneIndex}].completionActions[${actionIndex}]`,
        issues,
      );
    });
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path));
};

export const adventureDesignProjectShell = (project: AdventureProject): AdventureProjectShell => project;
