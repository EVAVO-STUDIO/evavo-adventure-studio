import { describe, expect, it } from "vitest";
import {
  AdventureDesignCommandError,
  adventureDesignHistoryIsDirty,
  applyAdventureDesignCommand,
  createAdventureDesignHistory,
  executeAdventureDesignCommand,
  markAdventureDesignSaved,
  redoAdventureDesignCommand,
  undoAdventureDesignCommand,
} from "../src/editor.js";
import {
  AdventureDesignParseError,
  AdventurePuzzleCycleError,
  adventurePuzzleDependencyOrder,
  parseAdventureDesignDocument,
  validateAdventureDesignAgainstProject,
  validateAdventureDesignDocument,
} from "../src/index.js";
import { showcaseAdventureDesigns, showcaseProjectShells } from "../src/showcases.js";

const forbiddenCommercialTokens = [
  "king's quest",
  "quest for glory",
  "gabriel knight",
  "sins of the fathers",
  "monkey island",
  "fate of atlantis",
  "heart of china",
  "rise of the dragon",
  "day of the tentacle",
  "space quest",
];

describe("adventure design showcases", () => {
  it("parses and validates every original production template", () => {
    expect(showcaseAdventureDesigns).toHaveLength(7);
    for (const document of showcaseAdventureDesigns) {
      expect(parseAdventureDesignDocument(document)).toEqual(document);
      expect(validateAdventureDesignDocument(document)).toEqual([]);
      expect(adventurePuzzleDependencyOrder(document)).toHaveLength(document.puzzles.length);
    }
  });

  it("keeps example content original rather than copying commercial games", () => {
    const serialized = JSON.stringify(showcaseAdventureDesigns).toLocaleLowerCase("en-US");
    for (const token of forbiddenCommercialTokens) {
      expect(serialized).not.toContain(token);
    }
  });

  it("matches each example's canonical project shell", () => {
    for (const [index, document] of showcaseAdventureDesigns.entries()) {
      const project = showcaseProjectShells[index];
      expect(project).toBeDefined();
      expect(validateAdventureDesignAgainstProject(project!, document)).toEqual([]);
    }
  });

  it("rejects malformed structural input before semantic review", () => {
    expect(() =>
      parseAdventureDesignDocument({
        ...showcaseAdventureDesigns[0],
        creativeDirection: {
          ...showcaseAdventureDesigns[0]!.creativeDirection,
          nativeSize: { width: 0, height: 200 },
        },
      }),
    ).toThrow(AdventureDesignParseError);
  });

  it("detects self-dependencies and backwards puzzle construction", () => {
    const source = showcaseAdventureDesigns[0]!;
    const puzzle = source.puzzles[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      puzzles: [
        {
          ...puzzle,
          dependencyIds: [puzzle.id],
          problemIntroducedBeforeSolution: false,
        },
      ],
    });
    const issues = validateAdventureDesignDocument(broken);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["puzzle-self-dependency", "puzzle-cycle", "backwards-puzzle"]),
    );
    expect(() => adventurePuzzleDependencyOrder(broken)).toThrow(AdventurePuzzleCycleError);
  });

  it("requires watched and skipped cinematics to converge", () => {
    const source = showcaseAdventureDesigns[0]!;
    const cutscene = source.cutscenes[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      cutscenes: [
        {
          ...cutscene,
          completionActions: [],
        },
      ],
    });
    expect(validateAdventureDesignDocument(broken).map((issue) => issue.code)).toContain(
      "skippable-cutscene-without-final-state",
    );
  });

  it("detects nested ID collisions and malformed hint ladders", () => {
    const source = showcaseAdventureDesigns[0]!;
    const puzzle = source.puzzles[0]!;
    const cutscene = source.cutscenes[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      puzzles: [
        {
          ...puzzle,
          hints: [
            { level: 1, text: "First hint." },
            { level: 1, text: "Duplicate first hint." },
            { level: 3, text: "Third hint." },
          ],
        },
      ],
      cutscenes: [
        {
          ...cutscene,
          shots: [cutscene.shots[0]!, { ...cutscene.shots[1]!, id: cutscene.shots[0]!.id }],
        },
      ],
    });

    expect(validateAdventureDesignDocument(broken).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-id", "hint-level-duplicate", "hint-level-gap"]),
    );
  });

  it("validates cutscene completion actions against the canonical project", () => {
    const source = showcaseAdventureDesigns[0]!;
    const project = showcaseProjectShells[0]!;
    const cutscene = source.cutscenes[0]!;
    const broken = parseAdventureDesignDocument({
      ...source,
      cutscenes: [
        {
          ...cutscene,
          completionActions: [
            { kind: "give-item", itemId: "item.missing" },
            {
              kind: "change-scene",
              sceneId: project.startSceneId,
              entranceId: "entrance.missing",
            },
          ],
        },
      ],
    });

    expect(validateAdventureDesignAgainstProject(project, broken).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing-item", "missing-entrance"]),
    );
  });
});

describe("adventure design editor history", () => {
  it("applies atomic batches and reverses them as one history entry", () => {
    const source = showcaseAdventureDesigns[0]!;
    const location = source.map.locations[1]!;
    const route = source.map.routes[0]!;
    const reduced = parseAdventureDesignDocument({
      ...source,
      map: {
        ...source.map,
        locations: [source.map.locations[0]],
        routes: [],
      },
      chapters: source.chapters.map((chapter) => ({
        ...chapter,
        unlockedLocationIds: [source.map.locations[0]!.id],
      })),
    });
    let history = createAdventureDesignHistory(reduced);
    history = executeAdventureDesignCommand(history, {
      kind: "batch",
      commands: [
        { kind: "insert-location", index: 1, value: location },
        { kind: "insert-route", index: 0, value: route },
      ],
    });
    expect(history.document.map.locations).toHaveLength(2);
    expect(history.document.map.routes).toHaveLength(1);
    expect(history.undoStack).toHaveLength(1);
    expect(adventureDesignHistoryIsDirty(history)).toBe(true);

    history = undoAdventureDesignCommand(history);
    expect(history.document.map.locations).toHaveLength(1);
    expect(history.document.map.routes).toHaveLength(0);

    history = redoAdventureDesignCommand(history);
    expect(history.document.map.locations).toHaveLength(2);
    expect(history.document.map.routes).toHaveLength(1);

    history = markAdventureDesignSaved(history);
    expect(adventureDesignHistoryIsDirty(history)).toBe(false);
  });

  it("protects referenced locations, clues, puzzles and cutscenes from deletion", () => {
    const source = showcaseAdventureDesigns[0]!;
    const commands = [
      { kind: "remove-location", id: source.map.locations[0]!.id },
      { kind: "remove-clue", id: source.clues[0]!.id },
      { kind: "remove-puzzle", id: source.puzzles[0]!.id },
      { kind: "remove-cutscene", id: source.cutscenes[0]!.id },
    ] as const;

    for (const command of commands) {
      expect(() => applyAdventureDesignCommand(source, command)).toThrow(AdventureDesignCommandError);
    }
  });

  it("preserves stable identity on replacement", () => {
    const source = showcaseAdventureDesigns[0]!;
    expect(() =>
      applyAdventureDesignCommand(source, {
        kind: "replace-location",
        id: source.map.locations[0]!.id,
        value: {
          ...source.map.locations[0]!,
          id: source.map.locations[1]!.id,
        },
      }),
    ).toThrow(/cannot change ID/i);
  });
});
