import type {
  AdventureChapter,
  AdventureClue,
  AdventureCreativeDirection,
  AdventureCutscene,
  AdventureDesignDocument,
  AdventureDesignId,
  AdventureMapLocation,
  AdventureMapRoute,
  AdventurePuzzle,
  AdventureWorldMap,
} from "./types.js";

export class AdventureDesignCommandError extends Error {
  readonly code:
    | "invalid-index"
    | "duplicate-id"
    | "missing-entity"
    | "identity-change"
    | "protected-entity"
    | "empty-batch";
  readonly path: string;

  constructor(code: AdventureDesignCommandError["code"], path: string, message: string) {
    super(message);
    this.name = "AdventureDesignCommandError";
    this.code = code;
    this.path = path;
  }
}

export type AdventureDesignCommand =
  | {
      readonly kind: "batch";
      readonly commands: readonly AdventureDesignCommand[];
    }
  | {
      readonly kind: "replace-creative-direction";
      readonly value: AdventureCreativeDirection;
    }
  | {
      readonly kind: "replace-world-map";
      readonly value: AdventureWorldMap;
    }
  | {
      readonly kind: "insert-location";
      readonly index: number;
      readonly value: AdventureMapLocation;
    }
  | {
      readonly kind: "replace-location";
      readonly id: AdventureDesignId<"location">;
      readonly value: AdventureMapLocation;
    }
  | {
      readonly kind: "remove-location";
      readonly id: AdventureDesignId<"location">;
    }
  | {
      readonly kind: "insert-route";
      readonly index: number;
      readonly value: AdventureMapRoute;
    }
  | {
      readonly kind: "replace-route";
      readonly id: AdventureDesignId<"route">;
      readonly value: AdventureMapRoute;
    }
  | {
      readonly kind: "remove-route";
      readonly id: AdventureDesignId<"route">;
    }
  | {
      readonly kind: "insert-chapter";
      readonly index: number;
      readonly value: AdventureChapter;
    }
  | {
      readonly kind: "replace-chapter";
      readonly id: AdventureDesignId<"chapter">;
      readonly value: AdventureChapter;
    }
  | {
      readonly kind: "remove-chapter";
      readonly id: AdventureDesignId<"chapter">;
    }
  | {
      readonly kind: "insert-clue";
      readonly index: number;
      readonly value: AdventureClue;
    }
  | {
      readonly kind: "replace-clue";
      readonly id: AdventureDesignId<"clue">;
      readonly value: AdventureClue;
    }
  | {
      readonly kind: "remove-clue";
      readonly id: AdventureDesignId<"clue">;
    }
  | {
      readonly kind: "insert-puzzle";
      readonly index: number;
      readonly value: AdventurePuzzle;
    }
  | {
      readonly kind: "replace-puzzle";
      readonly id: AdventureDesignId<"puzzle">;
      readonly value: AdventurePuzzle;
    }
  | {
      readonly kind: "remove-puzzle";
      readonly id: AdventureDesignId<"puzzle">;
    }
  | {
      readonly kind: "insert-cutscene";
      readonly index: number;
      readonly value: AdventureCutscene;
    }
  | {
      readonly kind: "replace-cutscene";
      readonly id: AdventureDesignId<"cutscene">;
      readonly value: AdventureCutscene;
    }
  | {
      readonly kind: "remove-cutscene";
      readonly id: AdventureDesignId<"cutscene">;
    };

export interface AppliedAdventureDesignCommand {
  readonly document: AdventureDesignDocument;
  readonly inverse: AdventureDesignCommand;
}

export interface AdventureDesignHistoryEntry {
  readonly undo: AdventureDesignCommand;
  readonly redo: AdventureDesignCommand;
}

export interface AdventureDesignHistoryState {
  readonly document: AdventureDesignDocument;
  readonly savedDocument: AdventureDesignDocument;
  readonly undoStack: readonly AdventureDesignHistoryEntry[];
  readonly redoStack: readonly AdventureDesignHistoryEntry[];
  readonly revision: number;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalAdventureDesignJson = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("Adventure design data cannot be represented as JSON.");
  }
  return serialized;
};

const insertAt = <T>(values: readonly T[], index: number, value: T, path: string): readonly T[] => {
  if (!Number.isSafeInteger(index) || index < 0 || index > values.length) {
    throw new AdventureDesignCommandError(
      "invalid-index",
      path,
      `Insert index ${index} is outside 0 to ${values.length}.`,
    );
  }
  return [...values.slice(0, index).map(cloneJson), cloneJson(value), ...values.slice(index).map(cloneJson)];
};

const replaceAt = <T>(values: readonly T[], index: number, value: T): readonly T[] => [
  ...values.slice(0, index).map(cloneJson),
  cloneJson(value),
  ...values.slice(index + 1).map(cloneJson),
];

const removeAt = <T>(values: readonly T[], index: number): readonly T[] => [
  ...values.slice(0, index).map(cloneJson),
  ...values.slice(index + 1).map(cloneJson),
];

const indexById = <T extends { readonly id: string }>(
  values: readonly T[],
  id: string,
  path: string,
): number => {
  const index = values.findIndex((value) => value.id === id);
  if (index < 0) {
    throw new AdventureDesignCommandError("missing-entity", path, `Entity '${id}' does not exist.`);
  }
  return index;
};

const assertInsertId = <T extends { readonly id: string }>(
  values: readonly T[],
  id: string,
  path: string,
): void => {
  if (values.some((value) => value.id === id)) {
    throw new AdventureDesignCommandError(
      "duplicate-id",
      path,
      `ID '${id}' already exists in this collection.`,
    );
  }
};

const assertStableIdentity = (expected: string, actual: string, path: string): void => {
  if (expected !== actual) {
    throw new AdventureDesignCommandError(
      "identity-change",
      path,
      `Replace commands cannot change ID '${expected}' to '${actual}'.`,
    );
  }
};

const protectedError = (path: string, message: string): never => {
  throw new AdventureDesignCommandError("protected-entity", path, message);
};

const assertLocationRemovable = (
  document: AdventureDesignDocument,
  id: AdventureDesignId<"location">,
): void => {
  const route = document.map.routes.find(
    (candidate) => candidate.fromLocationId === id || candidate.toLocationId === id,
  );
  if (route) {
    protectedError(
      "id",
      `Location '${id}' is used by route '${route.id}'. Remove or redirect the route first.`,
    );
  }
  const chapter = document.chapters.find(
    (candidate) => candidate.startLocationId === id || candidate.unlockedLocationIds.includes(id),
  );
  if (chapter) {
    protectedError("id", `Location '${id}' is used by chapter '${chapter.id}'.`);
  }
  const clue = document.clues.find((candidate) => candidate.locationId === id);
  if (clue) protectedError("id", `Location '${id}' is used by clue '${clue.id}'.`);
  const puzzle = document.puzzles.find((candidate) => candidate.locationId === id);
  if (puzzle) {
    protectedError("id", `Location '${id}' is used by puzzle '${puzzle.id}'.`);
  }
  const cutscene = document.cutscenes.find(
    (candidate) => candidate.trigger.kind === "location-enter" && candidate.trigger.locationId === id,
  );
  if (cutscene) {
    protectedError("id", `Location '${id}' triggers cutscene '${cutscene.id}'.`);
  }
};

const assertChapterRemovable = (
  document: AdventureDesignDocument,
  id: AdventureDesignId<"chapter">,
): void => {
  const location = document.map.locations.find((candidate) => candidate.chapterIds.includes(id));
  if (location) {
    protectedError("id", `Chapter '${id}' is assigned to location '${location.id}'.`);
  }
  const clue = document.clues.find((candidate) => candidate.chapterId === id);
  if (clue) protectedError("id", `Chapter '${id}' is used by clue '${clue.id}'.`);
  const puzzle = document.puzzles.find((candidate) => candidate.chapterId === id);
  if (puzzle) {
    protectedError("id", `Chapter '${id}' is used by puzzle '${puzzle.id}'.`);
  }
  const cutscene = document.cutscenes.find(
    (candidate) =>
      candidate.chapterId === id ||
      ((candidate.trigger.kind === "chapter-open" || candidate.trigger.kind === "chapter-close") &&
        candidate.trigger.chapterId === id),
  );
  if (cutscene) {
    protectedError("id", `Chapter '${id}' is used by cutscene '${cutscene.id}'.`);
  }
};

const assertClueRemovable = (document: AdventureDesignDocument, id: AdventureDesignId<"clue">): void => {
  for (const puzzle of document.puzzles) {
    if (puzzle.clueIds.includes(id)) {
      protectedError("id", `Clue '${id}' is used by puzzle '${puzzle.id}'.`);
    }
    for (const solution of puzzle.solutions) {
      const step = solution.steps.find((candidate) => candidate.clueIds.includes(id));
      if (step) {
        protectedError("id", `Clue '${id}' is used by puzzle step '${step.id}'.`);
      }
    }
  }
};

const assertPuzzleRemovable = (document: AdventureDesignDocument, id: AdventureDesignId<"puzzle">): void => {
  const location = document.map.locations.find((candidate) => candidate.unlockedByPuzzleIds.includes(id));
  if (location) {
    protectedError("id", `Puzzle '${id}' unlocks location '${location.id}'.`);
  }
  const route = document.map.routes.find((candidate) => candidate.requiredPuzzleIds.includes(id));
  if (route) protectedError("id", `Puzzle '${id}' gates route '${route.id}'.`);
  const chapter = document.chapters.find(
    (candidate) => candidate.requiredPuzzleIds.includes(id) || candidate.optionalPuzzleIds.includes(id),
  );
  if (chapter) {
    protectedError("id", `Puzzle '${id}' is assigned to chapter '${chapter.id}'.`);
  }
  const clue = document.clues.find((candidate) => candidate.supportsPuzzleIds.includes(id));
  if (clue) protectedError("id", `Puzzle '${id}' is supported by clue '${clue.id}'.`);
  const dependent = document.puzzles.find((candidate) => candidate.dependencyIds.includes(id));
  if (dependent) {
    protectedError("id", `Puzzle '${dependent.id}' depends on '${id}'.`);
  }
  const cutscene = document.cutscenes.find(
    (candidate) => candidate.trigger.kind === "puzzle-complete" && candidate.trigger.puzzleId === id,
  );
  if (cutscene) {
    protectedError("id", `Puzzle '${id}' triggers cutscene '${cutscene.id}'.`);
  }
};

const assertCutsceneRemovable = (
  document: AdventureDesignDocument,
  id: AdventureDesignId<"cutscene">,
): void => {
  const chapter = document.chapters.find(
    (candidate) => candidate.openingCutsceneId === id || candidate.closingCutsceneId === id,
  );
  if (chapter) {
    protectedError("id", `Cutscene '${id}' is used by chapter '${chapter.id}'.`);
  }
};

export const applyAdventureDesignCommand = (
  document: AdventureDesignDocument,
  command: AdventureDesignCommand,
): AppliedAdventureDesignCommand => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new AdventureDesignCommandError(
          "empty-batch",
          "commands",
          "Adventure design command batches cannot be empty.",
        );
      }
      let next = document;
      const inverses: AdventureDesignCommand[] = [];
      for (const child of command.commands) {
        const applied = applyAdventureDesignCommand(next, child);
        next = applied.document;
        inverses.unshift(applied.inverse);
      }
      return {
        document: next,
        inverse: { kind: "batch", commands: inverses },
      };
    }
    case "replace-creative-direction":
      return {
        document: { ...document, creativeDirection: cloneJson(command.value) },
        inverse: {
          kind: "replace-creative-direction",
          value: document.creativeDirection,
        },
      };
    case "replace-world-map":
      return {
        document: { ...document, map: cloneJson(command.value) },
        inverse: { kind: "replace-world-map", value: document.map },
      };
    case "insert-location":
      assertInsertId(document.map.locations, command.value.id, "value.id");
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            locations: insertAt(document.map.locations, command.index, command.value, "index"),
          },
        },
        inverse: { kind: "remove-location", id: command.value.id },
      };
    case "replace-location": {
      const index = indexById(document.map.locations, command.id, "id");
      const previous = document.map.locations[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            locations: replaceAt(document.map.locations, index, command.value),
          },
        },
        inverse: { kind: "replace-location", id: command.id, value: previous },
      };
    }
    case "remove-location": {
      assertLocationRemovable(document, command.id);
      const index = indexById(document.map.locations, command.id, "id");
      const previous = document.map.locations[index]!;
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            locations: removeAt(document.map.locations, index),
          },
        },
        inverse: { kind: "insert-location", index, value: previous },
      };
    }
    case "insert-route":
      assertInsertId(document.map.routes, command.value.id, "value.id");
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            routes: insertAt(document.map.routes, command.index, command.value, "index"),
          },
        },
        inverse: { kind: "remove-route", id: command.value.id },
      };
    case "replace-route": {
      const index = indexById(document.map.routes, command.id, "id");
      const previous = document.map.routes[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            routes: replaceAt(document.map.routes, index, command.value),
          },
        },
        inverse: { kind: "replace-route", id: command.id, value: previous },
      };
    }
    case "remove-route": {
      const index = indexById(document.map.routes, command.id, "id");
      const previous = document.map.routes[index]!;
      return {
        document: {
          ...document,
          map: {
            ...document.map,
            routes: removeAt(document.map.routes, index),
          },
        },
        inverse: { kind: "insert-route", index, value: previous },
      };
    }
    case "insert-chapter":
      assertInsertId(document.chapters, command.value.id, "value.id");
      return {
        document: {
          ...document,
          chapters: insertAt(document.chapters, command.index, command.value, "index"),
        },
        inverse: { kind: "remove-chapter", id: command.value.id },
      };
    case "replace-chapter": {
      const index = indexById(document.chapters, command.id, "id");
      const previous = document.chapters[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: {
          ...document,
          chapters: replaceAt(document.chapters, index, command.value),
        },
        inverse: { kind: "replace-chapter", id: command.id, value: previous },
      };
    }
    case "remove-chapter": {
      assertChapterRemovable(document, command.id);
      const index = indexById(document.chapters, command.id, "id");
      const previous = document.chapters[index]!;
      return {
        document: { ...document, chapters: removeAt(document.chapters, index) },
        inverse: { kind: "insert-chapter", index, value: previous },
      };
    }
    case "insert-clue":
      assertInsertId(document.clues, command.value.id, "value.id");
      return {
        document: {
          ...document,
          clues: insertAt(document.clues, command.index, command.value, "index"),
        },
        inverse: { kind: "remove-clue", id: command.value.id },
      };
    case "replace-clue": {
      const index = indexById(document.clues, command.id, "id");
      const previous = document.clues[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: { ...document, clues: replaceAt(document.clues, index, command.value) },
        inverse: { kind: "replace-clue", id: command.id, value: previous },
      };
    }
    case "remove-clue": {
      assertClueRemovable(document, command.id);
      const index = indexById(document.clues, command.id, "id");
      const previous = document.clues[index]!;
      return {
        document: { ...document, clues: removeAt(document.clues, index) },
        inverse: { kind: "insert-clue", index, value: previous },
      };
    }
    case "insert-puzzle":
      assertInsertId(document.puzzles, command.value.id, "value.id");
      return {
        document: {
          ...document,
          puzzles: insertAt(document.puzzles, command.index, command.value, "index"),
        },
        inverse: { kind: "remove-puzzle", id: command.value.id },
      };
    case "replace-puzzle": {
      const index = indexById(document.puzzles, command.id, "id");
      const previous = document.puzzles[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: {
          ...document,
          puzzles: replaceAt(document.puzzles, index, command.value),
        },
        inverse: { kind: "replace-puzzle", id: command.id, value: previous },
      };
    }
    case "remove-puzzle": {
      assertPuzzleRemovable(document, command.id);
      const index = indexById(document.puzzles, command.id, "id");
      const previous = document.puzzles[index]!;
      return {
        document: { ...document, puzzles: removeAt(document.puzzles, index) },
        inverse: { kind: "insert-puzzle", index, value: previous },
      };
    }
    case "insert-cutscene":
      assertInsertId(document.cutscenes, command.value.id, "value.id");
      return {
        document: {
          ...document,
          cutscenes: insertAt(document.cutscenes, command.index, command.value, "index"),
        },
        inverse: { kind: "remove-cutscene", id: command.value.id },
      };
    case "replace-cutscene": {
      const index = indexById(document.cutscenes, command.id, "id");
      const previous = document.cutscenes[index]!;
      assertStableIdentity(command.id, command.value.id, "value.id");
      return {
        document: {
          ...document,
          cutscenes: replaceAt(document.cutscenes, index, command.value),
        },
        inverse: { kind: "replace-cutscene", id: command.id, value: previous },
      };
    }
    case "remove-cutscene": {
      assertCutsceneRemovable(document, command.id);
      const index = indexById(document.cutscenes, command.id, "id");
      const previous = document.cutscenes[index]!;
      return {
        document: { ...document, cutscenes: removeAt(document.cutscenes, index) },
        inverse: { kind: "insert-cutscene", index, value: previous },
      };
    }
  }
};

export const createAdventureDesignHistory = (
  document: AdventureDesignDocument,
): AdventureDesignHistoryState => ({
  document: cloneJson(document),
  savedDocument: cloneJson(document),
  undoStack: [],
  redoStack: [],
  revision: 0,
});

export const executeAdventureDesignCommand = (
  state: AdventureDesignHistoryState,
  command: AdventureDesignCommand,
): AdventureDesignHistoryState => {
  const applied = applyAdventureDesignCommand(state.document, command);
  return {
    ...state,
    document: applied.document,
    undoStack: [...state.undoStack, { undo: applied.inverse, redo: command }],
    redoStack: [],
    revision: state.revision + 1,
  };
};

export const undoAdventureDesignCommand = (
  state: AdventureDesignHistoryState,
): AdventureDesignHistoryState => {
  const entry = state.undoStack.at(-1);
  if (!entry) return state;
  const applied = applyAdventureDesignCommand(state.document, entry.undo);
  return {
    ...state,
    document: applied.document,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, entry],
    revision: state.revision + 1,
  };
};

export const redoAdventureDesignCommand = (
  state: AdventureDesignHistoryState,
): AdventureDesignHistoryState => {
  const entry = state.redoStack.at(-1);
  if (!entry) return state;
  const applied = applyAdventureDesignCommand(state.document, entry.redo);
  return {
    ...state,
    document: applied.document,
    undoStack: [...state.undoStack, entry],
    redoStack: state.redoStack.slice(0, -1),
    revision: state.revision + 1,
  };
};

export const markAdventureDesignSaved = (
  state: AdventureDesignHistoryState,
): AdventureDesignHistoryState => ({
  ...state,
  savedDocument: cloneJson(state.document),
});

export const adventureDesignHistoryIsDirty = (state: AdventureDesignHistoryState): boolean =>
  canonicalAdventureDesignJson(state.document) !== canonicalAdventureDesignJson(state.savedDocument);
