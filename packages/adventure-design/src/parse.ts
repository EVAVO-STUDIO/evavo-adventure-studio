import type { Action, Id, Point, Scalar, Size } from "@evavo/adventure-project-schema";
import type {
  AdventureChapter,
  AdventureChapterMode,
  AdventureClue,
  AdventureClueDelivery,
  AdventureCompositionMode,
  AdventureCreativeDirection,
  AdventureCutscene,
  AdventureCutsceneShot,
  AdventureCutsceneTrigger,
  AdventureDesignDocument,
  AdventureDesignId,
  AdventureFailureMode,
  AdventureFailurePolicy,
  AdventureHint,
  AdventureLocationKind,
  AdventureMapLocation,
  AdventureMapRoute,
  AdventurePaletteDirection,
  AdventureProductionMode,
  AdventurePuzzle,
  AdventurePuzzleSolution,
  AdventurePuzzleStep,
  AdventureReviewItem,
  AdventureWorldMap,
} from "./types.js";

export class AdventureDesignParseError extends TypeError {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "AdventureDesignParseError";
    this.path = path;
  }
}

type JsonRecord = Record<string, unknown>;

const recordAt = (value: unknown, path: string): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdventureDesignParseError(path, "Expected an object.");
  }
  return value as JsonRecord;
};

const arrayAt = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new AdventureDesignParseError(path, "Expected an array.");
  }
  return value;
};

const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AdventureDesignParseError(path, "Expected a non-empty string.");
  }
  return value;
};

const optionalStringAt = (value: unknown, path: string): string | undefined =>
  value === undefined ? undefined : stringAt(value, path);

const booleanAt = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    throw new AdventureDesignParseError(path, "Expected a boolean.");
  }
  return value;
};

const finiteNumberAt = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AdventureDesignParseError(path, "Expected a finite number.");
  }
  return value;
};

const integerAt = (value: unknown, path: string): number => {
  const number = finiteNumberAt(value, path);
  if (!Number.isSafeInteger(number)) {
    throw new AdventureDesignParseError(path, "Expected a safe integer.");
  }
  return number;
};

const positiveIntegerAt = (value: unknown, path: string): number => {
  const number = integerAt(value, path);
  if (number <= 0) {
    throw new AdventureDesignParseError(path, "Expected a positive integer.");
  }
  return number;
};

const nonnegativeIntegerAt = (value: unknown, path: string): number => {
  const number = integerAt(value, path);
  if (number < 0) {
    throw new AdventureDesignParseError(path, "Expected a non-negative integer.");
  }
  return number;
};

const enumAt = <T extends string>(value: unknown, path: string, allowed: readonly T[]): T => {
  const string = stringAt(value, path);
  if (!allowed.includes(string as T)) {
    throw new AdventureDesignParseError(path, `Expected one of: ${allowed.join(", ")}.`);
  }
  return string as T;
};

const idAt = <T extends string>(value: unknown, path: string): AdventureDesignId<T> =>
  stringAt(value, path) as AdventureDesignId<T>;

const projectIdAt = <T extends string>(value: unknown, path: string): Id<T> => stringAt(value, path) as Id<T>;

const stringArrayAt = (value: unknown, path: string): readonly string[] =>
  arrayAt(value, path).map((entry, index) => stringAt(entry, `${path}[${index}]`));

const idArrayAt = <T extends string>(value: unknown, path: string): readonly AdventureDesignId<T>[] =>
  arrayAt(value, path).map((entry, index) => idAt<T>(entry, `${path}[${index}]`));

const pointAt = (value: unknown, path: string): Point => {
  const record = recordAt(value, path);
  return {
    x: finiteNumberAt(record["x"], `${path}.x`),
    y: finiteNumberAt(record["y"], `${path}.y`),
  };
};

const sizeAt = (value: unknown, path: string): Size => {
  const record = recordAt(value, path);
  return {
    width: positiveIntegerAt(record["width"], `${path}.width`),
    height: positiveIntegerAt(record["height"], `${path}.height`),
  };
};

const scalarAt = (value: unknown, path: string): Scalar => {
  if (
    typeof value !== "string" &&
    typeof value !== "boolean" &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new AdventureDesignParseError(path, "Expected a scalar value.");
  }
  return value as Scalar;
};

const parsePalette = (value: unknown, path: string): AdventurePaletteDirection => {
  const record = recordAt(value, path);
  return {
    maxColours: positiveIntegerAt(record["maxColours"], `${path}.maxColours`),
    keyColours: stringArrayAt(record["keyColours"], `${path}.keyColours`),
    shadowRule: stringAt(record["shadowRule"], `${path}.shadowRule`),
    highlightRule: stringAt(record["highlightRule"], `${path}.highlightRule`),
    ditherRule: stringAt(record["ditherRule"], `${path}.ditherRule`),
  };
};

const productionModes: readonly AdventureProductionMode[] = [
  "painted-pixel",
  "storybook-gouache",
  "inked-comic",
  "graphic-cel",
  "cinematic-photocollage",
  "custom",
];

const compositionModes: readonly AdventureCompositionMode[] = [
  "stage",
  "cinematic",
  "storybook",
  "comic-panel",
  "travel",
];

const parseCreativeDirection = (value: unknown, path: string): AdventureCreativeDirection => {
  const record = recordAt(value, path);
  return {
    nativeSize: sizeAt(record["nativeSize"], `${path}.nativeSize`),
    productionMode: enumAt(record["productionMode"], `${path}.productionMode`, productionModes),
    compositionMode: enumAt(record["compositionMode"], `${path}.compositionMode`, compositionModes),
    palette: parsePalette(record["palette"], `${path}.palette`),
    perspective: stringAt(record["perspective"], `${path}.perspective`),
    lighting: stringAt(record["lighting"], `${path}.lighting`),
    materialLanguage: stringAt(record["materialLanguage"], `${path}.materialLanguage`),
    actorSilhouette: stringAt(record["actorSilhouette"], `${path}.actorSilhouette`),
    backgroundHierarchy: stringAt(record["backgroundHierarchy"], `${path}.backgroundHierarchy`),
    portraitTreatment: stringAt(record["portraitTreatment"], `${path}.portraitTreatment`),
    animationCadence: stringAt(record["animationCadence"], `${path}.animationCadence`),
    interfaceTreatment: stringAt(record["interfaceTreatment"], `${path}.interfaceTreatment`),
    musicDirection: stringAt(record["musicDirection"], `${path}.musicDirection`),
    ambienceDirection: stringAt(record["ambienceDirection"], `${path}.ambienceDirection`),
    authenticityRules: stringArrayAt(record["authenticityRules"], `${path}.authenticityRules`),
    prohibitedShortcuts: stringArrayAt(record["prohibitedShortcuts"], `${path}.prohibitedShortcuts`),
  };
};

const locationKinds: readonly AdventureLocationKind[] = [
  "hub",
  "scene",
  "interior",
  "dungeon",
  "travel",
  "close-up",
];

const parseLocation = (value: unknown, path: string): AdventureMapLocation => {
  const record = recordAt(value, path);
  const sceneId = optionalStringAt(record["sceneId"], `${path}.sceneId`);
  const musicCue = optionalStringAt(record["musicCue"], `${path}.musicCue`);
  return {
    id: idAt<"location">(record["id"], `${path}.id`),
    name: stringAt(record["name"], `${path}.name`),
    kind: enumAt(record["kind"], `${path}.kind`, locationKinds),
    position: pointAt(record["position"], `${path}.position`),
    ...(sceneId ? { sceneId: sceneId as Id<"scene"> } : {}),
    chapterIds: idArrayAt<"chapter">(record["chapterIds"], `${path}.chapterIds`),
    unlockedByPuzzleIds: idArrayAt<"puzzle">(record["unlockedByPuzzleIds"], `${path}.unlockedByPuzzleIds`),
    artBrief: stringAt(record["artBrief"], `${path}.artBrief`),
    arrivalBeat: stringAt(record["arrivalBeat"], `${path}.arrivalBeat`),
    ...(musicCue ? { musicCue } : {}),
  };
};

const parseRoute = (value: unknown, path: string): AdventureMapRoute => {
  const record = recordAt(value, path);
  return {
    id: idAt<"route">(record["id"], `${path}.id`),
    fromLocationId: idAt<"location">(record["fromLocationId"], `${path}.fromLocationId`),
    toLocationId: idAt<"location">(record["toLocationId"], `${path}.toLocationId`),
    bidirectional: booleanAt(record["bidirectional"], `${path}.bidirectional`),
    travelMode: stringAt(record["travelMode"], `${path}.travelMode`),
    transition: stringAt(record["transition"], `${path}.transition`),
    requiredPuzzleIds: idArrayAt<"puzzle">(record["requiredPuzzleIds"], `${path}.requiredPuzzleIds`),
  };
};

const parseWorldMap = (value: unknown, path: string): AdventureWorldMap => {
  const record = recordAt(value, path);
  return {
    title: stringAt(record["title"], `${path}.title`),
    artBrief: stringAt(record["artBrief"], `${path}.artBrief`),
    locations: arrayAt(record["locations"], `${path}.locations`).map((entry, index) =>
      parseLocation(entry, `${path}.locations[${index}]`),
    ),
    routes: arrayAt(record["routes"], `${path}.routes`).map((entry, index) =>
      parseRoute(entry, `${path}.routes[${index}]`),
    ),
  };
};

const chapterModes: readonly AdventureChapterMode[] = ["act", "day", "mission", "era", "open-phase"];

const parseChapter = (value: unknown, path: string): AdventureChapter => {
  const record = recordAt(value, path);
  const openingCutsceneId = optionalStringAt(record["openingCutsceneId"], `${path}.openingCutsceneId`);
  const closingCutsceneId = optionalStringAt(record["closingCutsceneId"], `${path}.closingCutsceneId`);
  return {
    id: idAt<"chapter">(record["id"], `${path}.id`),
    name: stringAt(record["name"], `${path}.name`),
    mode: enumAt(record["mode"], `${path}.mode`, chapterModes),
    ordinal: positiveIntegerAt(record["ordinal"], `${path}.ordinal`),
    playerObjective: stringAt(record["playerObjective"], `${path}.playerObjective`),
    startLocationId: idAt<"location">(record["startLocationId"], `${path}.startLocationId`),
    requiredPuzzleIds: idArrayAt<"puzzle">(record["requiredPuzzleIds"], `${path}.requiredPuzzleIds`),
    optionalPuzzleIds: idArrayAt<"puzzle">(record["optionalPuzzleIds"], `${path}.optionalPuzzleIds`),
    unlockedLocationIds: idArrayAt<"location">(record["unlockedLocationIds"], `${path}.unlockedLocationIds`),
    ...(openingCutsceneId ? { openingCutsceneId: openingCutsceneId as AdventureDesignId<"cutscene"> } : {}),
    ...(closingCutsceneId ? { closingCutsceneId: closingCutsceneId as AdventureDesignId<"cutscene"> } : {}),
    completionBeat: stringAt(record["completionBeat"], `${path}.completionBeat`),
  };
};

const clueDeliveries: readonly AdventureClueDelivery[] = [
  "environment",
  "dialogue",
  "inventory",
  "research",
  "map",
  "cutscene",
];

const parseClue = (value: unknown, path: string): AdventureClue => {
  const record = recordAt(value, path);
  const locationId = optionalStringAt(record["locationId"], `${path}.locationId`);
  const chapterId = optionalStringAt(record["chapterId"], `${path}.chapterId`);
  return {
    id: idAt<"clue">(record["id"], `${path}.id`),
    name: stringAt(record["name"], `${path}.name`),
    delivery: enumAt(record["delivery"], `${path}.delivery`, clueDeliveries),
    ...(locationId ? { locationId: locationId as AdventureDesignId<"location"> } : {}),
    ...(chapterId ? { chapterId: chapterId as AdventureDesignId<"chapter"> } : {}),
    text: stringAt(record["text"], `${path}.text`),
    guaranteed: booleanAt(record["guaranteed"], `${path}.guaranteed`),
    supportsPuzzleIds: idArrayAt<"puzzle">(record["supportsPuzzleIds"], `${path}.supportsPuzzleIds`),
  };
};

const parsePuzzleStep = (value: unknown, path: string): AdventurePuzzleStep => {
  const record = recordAt(value, path);
  const itemId = optionalStringAt(record["itemId"], `${path}.itemId`);
  return {
    id: idAt<"puzzle-step">(record["id"], `${path}.id`),
    verb: stringAt(record["verb"], `${path}.verb`),
    target: stringAt(record["target"], `${path}.target`),
    ...(itemId ? { itemId: itemId as Id<"item"> } : {}),
    result: stringAt(record["result"], `${path}.result`),
    clueIds: idArrayAt<"clue">(record["clueIds"], `${path}.clueIds`),
  };
};

const parsePuzzleSolution = (value: unknown, path: string): AdventurePuzzleSolution => {
  const record = recordAt(value, path);
  const steps = arrayAt(record["steps"], `${path}.steps`).map((entry, index) =>
    parsePuzzleStep(entry, `${path}.steps[${index}]`),
  );
  if (steps.length === 0) {
    throw new AdventureDesignParseError(`${path}.steps`, "Expected at least one step.");
  }
  return {
    id: idAt<"puzzle-solution">(record["id"], `${path}.id`),
    label: stringAt(record["label"], `${path}.label`),
    steps,
  };
};

const parseHint = (value: unknown, path: string): AdventureHint => {
  const record = recordAt(value, path);
  return {
    level: positiveIntegerAt(record["level"], `${path}.level`),
    text: stringAt(record["text"], `${path}.text`),
  };
};

const failureModes: readonly AdventureFailureMode[] = ["none", "setback", "death", "alternate-branch"];

const parseFailurePolicy = (value: unknown, path: string): AdventureFailurePolicy => {
  const record = recordAt(value, path);
  return {
    mode: enumAt(record["mode"], `${path}.mode`, failureModes),
    warning: stringAt(record["warning"], `${path}.warning`),
    recovery: stringAt(record["recovery"], `${path}.recovery`),
  };
};

const parsePuzzle = (value: unknown, path: string): AdventurePuzzle => {
  const record = recordAt(value, path);
  const solutions = arrayAt(record["solutions"], `${path}.solutions`).map((entry, index) =>
    parsePuzzleSolution(entry, `${path}.solutions[${index}]`),
  );
  if (solutions.length === 0) {
    throw new AdventureDesignParseError(`${path}.solutions`, "Expected at least one solution.");
  }
  return {
    id: idAt<"puzzle">(record["id"], `${path}.id`),
    name: stringAt(record["name"], `${path}.name`),
    chapterId: idAt<"chapter">(record["chapterId"], `${path}.chapterId`),
    locationId: idAt<"location">(record["locationId"], `${path}.locationId`),
    goal: stringAt(record["goal"], `${path}.goal`),
    storyPayoff: stringAt(record["storyPayoff"], `${path}.storyPayoff`),
    problemIntroducedBeforeSolution: booleanAt(
      record["problemIntroducedBeforeSolution"],
      `${path}.problemIntroducedBeforeSolution`,
    ),
    dependencyIds: idArrayAt<"puzzle">(record["dependencyIds"], `${path}.dependencyIds`),
    clueIds: idArrayAt<"clue">(record["clueIds"], `${path}.clueIds`),
    solutions,
    hints: arrayAt(record["hints"], `${path}.hints`).map((entry, index) =>
      parseHint(entry, `${path}.hints[${index}]`),
    ),
    failure: parseFailurePolicy(record["failure"], `${path}.failure`),
    score: nonnegativeIntegerAt(record["score"], `${path}.score`),
    optional: booleanAt(record["optional"], `${path}.optional`),
    rationale: stringAt(record["rationale"], `${path}.rationale`),
  };
};

const parseTrigger = (value: unknown, path: string): AdventureCutsceneTrigger => {
  const record = recordAt(value, path);
  const kind = enumAt(record["kind"], `${path}.kind`, [
    "chapter-open",
    "chapter-close",
    "location-enter",
    "puzzle-complete",
    "dialogue-choice",
  ] as const);
  switch (kind) {
    case "chapter-open":
    case "chapter-close":
      return {
        kind,
        chapterId: idAt<"chapter">(record["chapterId"], `${path}.chapterId`),
      };
    case "location-enter":
      return {
        kind,
        locationId: idAt<"location">(record["locationId"], `${path}.locationId`),
      };
    case "puzzle-complete":
      return {
        kind,
        puzzleId: idAt<"puzzle">(record["puzzleId"], `${path}.puzzleId`),
      };
    case "dialogue-choice":
      return {
        kind,
        dialogueChoiceId: projectIdAt<"dialogue-choice">(
          record["dialogueChoiceId"],
          `${path}.dialogueChoiceId`,
        ),
      };
  }
};

const parseShot = (value: unknown, path: string): AdventureCutsceneShot => {
  const record = recordAt(value, path);
  const dialogue = optionalStringAt(record["dialogue"], `${path}.dialogue`);
  const sound = optionalStringAt(record["sound"], `${path}.sound`);
  return {
    id: idAt<"cutscene-shot">(record["id"], `${path}.id`),
    order: nonnegativeIntegerAt(record["order"], `${path}.order`),
    durationTicks: positiveIntegerAt(record["durationTicks"], `${path}.durationTicks`),
    framing: stringAt(record["framing"], `${path}.framing`),
    camera: stringAt(record["camera"], `${path}.camera`),
    staging: stringAt(record["staging"], `${path}.staging`),
    ...(dialogue ? { dialogue } : {}),
    ...(sound ? { sound } : {}),
    transition: stringAt(record["transition"], `${path}.transition`),
  };
};

const parseAction = (value: unknown, path: string): Action => {
  const record = recordAt(value, path);
  const kind = enumAt(record["kind"], `${path}.kind`, [
    "say",
    "set-flag",
    "set-variable",
    "give-item",
    "remove-item",
    "award-score",
    "change-scene",
    "play-sequence",
    "start-dialogue",
    "set-object-state",
  ] as const);
  switch (kind) {
    case "say": {
      const speakerId = optionalStringAt(record["speakerId"], `${path}.speakerId`);
      return {
        kind,
        ...(speakerId ? { speakerId: speakerId as Id<"actor"> } : {}),
        text: stringAt(record["text"], `${path}.text`),
      };
    }
    case "set-flag":
      return {
        kind,
        flag: stringAt(record["flag"], `${path}.flag`),
        value: booleanAt(record["value"], `${path}.value`),
      };
    case "set-variable":
      return {
        kind,
        variable: stringAt(record["variable"], `${path}.variable`),
        value: scalarAt(record["value"], `${path}.value`),
      };
    case "give-item":
    case "remove-item":
      return {
        kind,
        itemId: projectIdAt<"item">(record["itemId"], `${path}.itemId`),
      };
    case "award-score":
      return {
        kind,
        awardId: projectIdAt<"score-award">(record["awardId"], `${path}.awardId`),
        points: integerAt(record["points"], `${path}.points`),
      };
    case "change-scene":
      return {
        kind,
        sceneId: projectIdAt<"scene">(record["sceneId"], `${path}.sceneId`),
        entranceId: projectIdAt<"entrance">(record["entranceId"], `${path}.entranceId`),
      };
    case "play-sequence":
      return {
        kind,
        sequenceId: projectIdAt<"sequence">(record["sequenceId"], `${path}.sequenceId`),
      };
    case "start-dialogue": {
      const nodeId = optionalStringAt(record["nodeId"], `${path}.nodeId`);
      return {
        kind,
        dialogueId: projectIdAt<"dialogue">(record["dialogueId"], `${path}.dialogueId`),
        ...(nodeId ? { nodeId: nodeId as Id<"dialogue-node"> } : {}),
      };
    }
    case "set-object-state":
      return {
        kind,
        objectId: projectIdAt<"object">(record["objectId"], `${path}.objectId`),
        state: stringAt(record["state"], `${path}.state`),
      };
  }
};

const parseCutscene = (value: unknown, path: string): AdventureCutscene => {
  const record = recordAt(value, path);
  const shots = arrayAt(record["shots"], `${path}.shots`).map((entry, index) =>
    parseShot(entry, `${path}.shots[${index}]`),
  );
  if (shots.length === 0) {
    throw new AdventureDesignParseError(`${path}.shots`, "Expected at least one shot.");
  }
  return {
    id: idAt<"cutscene">(record["id"], `${path}.id`),
    name: stringAt(record["name"], `${path}.name`),
    chapterId: idAt<"chapter">(record["chapterId"], `${path}.chapterId`),
    trigger: parseTrigger(record["trigger"], `${path}.trigger`),
    skippable: booleanAt(record["skippable"], `${path}.skippable`),
    completionActions: arrayAt(record["completionActions"], `${path}.completionActions`).map((entry, index) =>
      parseAction(entry, `${path}.completionActions[${index}]`),
    ),
    shots,
  };
};

const parseReviewItem = (value: unknown, path: string): AdventureReviewItem => {
  const record = recordAt(value, path);
  return {
    id: idAt<"review-item">(record["id"], `${path}.id`),
    label: stringAt(record["label"], `${path}.label`),
    required: booleanAt(record["required"], `${path}.required`),
  };
};

export const parseAdventureDesignDocument = (input: unknown): AdventureDesignDocument => {
  const record = recordAt(input, "$");
  if (record["documentVersion"] !== 1) {
    throw new AdventureDesignParseError("$.documentVersion", "Expected document version 1.");
  }
  return {
    documentVersion: 1,
    projectId: projectIdAt<"project">(record["projectId"], "$.projectId"),
    title: stringAt(record["title"], "$.title"),
    pitch: stringAt(record["pitch"], "$.pitch"),
    playerPromise: stringAt(record["playerPromise"], "$.playerPromise"),
    creativeDirection: parseCreativeDirection(record["creativeDirection"], "$.creativeDirection"),
    map: parseWorldMap(record["map"], "$.map"),
    chapters: arrayAt(record["chapters"], "$.chapters").map((entry, index) =>
      parseChapter(entry, `$.chapters[${index}]`),
    ),
    clues: arrayAt(record["clues"], "$.clues").map((entry, index) => parseClue(entry, `$.clues[${index}]`)),
    puzzles: arrayAt(record["puzzles"], "$.puzzles").map((entry, index) =>
      parsePuzzle(entry, `$.puzzles[${index}]`),
    ),
    cutscenes: arrayAt(record["cutscenes"], "$.cutscenes").map((entry, index) =>
      parseCutscene(entry, `$.cutscenes[${index}]`),
    ),
    reviewChecklist: arrayAt(record["reviewChecklist"], "$.reviewChecklist").map((entry, index) =>
      parseReviewItem(entry, `$.reviewChecklist[${index}]`),
    ),
  };
};
