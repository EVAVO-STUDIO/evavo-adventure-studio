import type {
  ClassicAdventureCreatorCommand,
  ClassicAdventureCreatorHistory,
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorScene,
} from "./classic-game-creator-types.js";

const HISTORY_LIMIT = 100;

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

export const canonicalClassicAdventureCreatorJson = (project: ClassicAdventureCreatorProject): string =>
  JSON.stringify(canonicalize(project));

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

export const classicAdventureCreatorFingerprint = (project: ClassicAdventureCreatorProject): string =>
  fnv1a64(canonicalClassicAdventureCreatorJson(project));

const sceneIndex = (project: ClassicAdventureCreatorProject, sceneId: string): number => {
  const index = project.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) {
    throw new Error(`Creator scene '${sceneId}' does not exist.`);
  }
  return index;
};

const replaceScene = (
  project: ClassicAdventureCreatorProject,
  index: number,
  scene: ClassicAdventureCreatorScene,
): ClassicAdventureCreatorProject => ({
  ...project,
  scenes: project.scenes.map((candidate, candidateIndex) => (candidateIndex === index ? scene : candidate)),
});

const assertFinitePoint = (position: { readonly x: number; readonly y: number }): void => {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError("Creator positions must use finite native coordinates.");
  }
};

const moveActor = (
  project: ClassicAdventureCreatorProject,
  command: Extract<ClassicAdventureCreatorCommand, { readonly kind: "move-actor" }>,
): ClassicAdventureCreatorProject => {
  assertFinitePoint(command.position);
  const index = sceneIndex(project, command.sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  if (!scene.actors.some((actor) => actor.id === command.actorId)) {
    throw new Error(`Creator actor '${command.actorId}' does not exist in '${scene.id}'.`);
  }
  return replaceScene(project, index, {
    ...scene,
    actors: scene.actors.map((actor) =>
      actor.id === command.actorId ? { ...actor, position: command.position } : actor,
    ),
  });
};

const moveProp = (
  project: ClassicAdventureCreatorProject,
  command: Extract<ClassicAdventureCreatorCommand, { readonly kind: "move-prop" }>,
): ClassicAdventureCreatorProject => {
  assertFinitePoint(command.position);
  const index = sceneIndex(project, command.sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  if (!scene.props.some((prop) => prop.id === command.propId)) {
    throw new Error(`Creator prop '${command.propId}' does not exist in '${scene.id}'.`);
  }
  return replaceScene(project, index, {
    ...scene,
    props: scene.props.map((prop) =>
      prop.id === command.propId ? { ...prop, position: command.position } : prop,
    ),
  });
};

const setSceneHorizon = (
  project: ClassicAdventureCreatorProject,
  sceneId: string,
  horizonY: number,
): ClassicAdventureCreatorProject => {
  if (!Number.isFinite(horizonY)) {
    throw new RangeError("Creator horizon must be a finite native coordinate.");
  }
  const index = sceneIndex(project, sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  return replaceScene(project, index, { ...scene, horizonY });
};

const setWalkLane = (
  project: ClassicAdventureCreatorProject,
  sceneId: string,
  top: number,
  bottom: number,
): ClassicAdventureCreatorProject => {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    throw new RangeError("Creator walk-lane coordinates must be finite.");
  }
  const index = sceneIndex(project, sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  return replaceScene(project, index, {
    ...scene,
    walkLane: { ...scene.walkLane, top, bottom },
  });
};

const renameScene = (
  project: ClassicAdventureCreatorProject,
  sceneId: string,
  name: string,
): ClassicAdventureCreatorProject => {
  const normalized = name.trim();
  if (!normalized) throw new RangeError("Creator scene name cannot be empty.");
  const index = sceneIndex(project, sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  return replaceScene(project, index, { ...scene, name: normalized });
};

const setInterfaceChrome = (
  project: ClassicAdventureCreatorProject,
  chromeHeight: number,
): ClassicAdventureCreatorProject => {
  if (!Number.isSafeInteger(chromeHeight) || chromeHeight < 0) {
    throw new RangeError("Creator interface chrome height must be a non-negative integer.");
  }
  const gameplayViewportHeight = project.nativeSize.height - chromeHeight;
  if (gameplayViewportHeight <= 0) {
    throw new RangeError("Creator interface chrome consumes the native canvas.");
  }
  return {
    ...project,
    interface: {
      ...project.interface,
      chromeHeight,
      gameplayViewportHeight,
    },
    scenes: project.scenes.map((scene) => {
      const usesPersistentChrome =
        project.interface.openBehaviour === "persistent" &&
        (scene.kind === "gameplay" || scene.kind === "dialogue");
      const safeHeight = usesPersistentChrome ? gameplayViewportHeight : project.nativeSize.height;
      return {
        ...scene,
        interfaceSafeRect: {
          x: 0,
          y: 0,
          width: project.nativeSize.width,
          height: safeHeight,
        },
        walkLane: {
          ...scene.walkLane,
          top: Math.min(scene.walkLane.top, safeHeight - 2),
          bottom: Math.min(scene.walkLane.bottom, safeHeight),
        },
      };
    }),
  };
};

const setTiming = (
  project: ClassicAdventureCreatorProject,
  command: Extract<ClassicAdventureCreatorCommand, { readonly kind: "set-timing" }>,
): ClassicAdventureCreatorProject => {
  if (!Number.isSafeInteger(command.value) || command.value < 0) {
    throw new RangeError("Creator timing values must be non-negative integers.");
  }
  return {
    ...project,
    timing: {
      ...project.timing,
      [command.field]: command.value,
    },
  };
};

const duplicateScene = (
  project: ClassicAdventureCreatorProject,
  command: Extract<ClassicAdventureCreatorCommand, { readonly kind: "duplicate-scene" }>,
): ClassicAdventureCreatorProject => {
  const normalizedId = command.newSceneId.trim();
  const normalizedName = command.name.trim();
  if (!normalizedId || !normalizedName) {
    throw new RangeError("Duplicated scenes require a stable ID and name.");
  }
  if (project.scenes.some((scene) => scene.id === normalizedId)) {
    throw new Error(`Creator scene '${normalizedId}' already exists.`);
  }
  const source = project.scenes[sceneIndex(project, command.sceneId)];
  if (!source) throw new Error("Creator scene lookup failed.");
  const clone: ClassicAdventureCreatorScene = {
    ...source,
    id: normalizedId,
    sourcePlateId: `${normalizedId}.source`,
    name: normalizedName,
    layers: source.layers.map((layer, index) => ({
      ...layer,
      id: `${normalizedId}.layer.${index}`,
    })),
    actors: source.actors.map((actor, index) => ({
      ...actor,
      id: `${normalizedId}.actor.${index}`,
    })),
    props: source.props.map((prop, index) => ({
      ...prop,
      id: `${normalizedId}.prop.${index}`,
    })),
  };
  return { ...project, scenes: [...project.scenes, clone] };
};

export class ClassicAdventureCreatorReferenceError extends Error {
  readonly sceneId: string;
  readonly references: readonly string[];

  constructor(sceneId: string, references: readonly string[]) {
    super(
      `Creator scene '${sceneId}' cannot be removed because it is referenced ` +
        `by ${references.join(", ")}.`,
    );
    this.name = "ClassicAdventureCreatorReferenceError";
    this.sceneId = sceneId;
    this.references = references;
  }
}

const removeScene = (
  project: ClassicAdventureCreatorProject,
  sceneId: string,
): ClassicAdventureCreatorProject => {
  const index = sceneIndex(project, sceneId);
  const scene = project.scenes[index];
  if (!scene) throw new Error("Creator scene lookup failed.");
  const references = [
    ...project.puzzles.flatMap((puzzle) => {
      const paths: string[] = [];
      if (puzzle.setupSceneId === sceneId) {
        paths.push(`puzzle '${puzzle.id}' setup`);
      }
      if (puzzle.resolutionSceneId === sceneId) {
        paths.push(`puzzle '${puzzle.id}' resolution`);
      }
      return paths;
    }),
    ...project.dialogues
      .filter((dialogue) => dialogue.sceneId === sceneId)
      .map((dialogue) => `dialogue '${dialogue.id}'`),
  ];
  const sameKindCount = project.scenes.filter((candidate) => candidate.kind === scene.kind).length;
  if (sameKindCount <= 1) {
    references.push(`required '${scene.kind}' construction scene`);
  }
  if (references.length > 0) {
    throw new ClassicAdventureCreatorReferenceError(sceneId, references);
  }
  return {
    ...project,
    scenes: project.scenes.filter((candidate) => candidate.id !== sceneId),
  };
};

export const applyClassicAdventureCreatorCommand = (
  project: ClassicAdventureCreatorProject,
  command: ClassicAdventureCreatorCommand,
): ClassicAdventureCreatorProject => {
  switch (command.kind) {
    case "move-actor":
      return moveActor(project, command);
    case "move-prop":
      return moveProp(project, command);
    case "set-scene-horizon":
      return setSceneHorizon(project, command.sceneId, command.horizonY);
    case "set-walk-lane":
      return setWalkLane(project, command.sceneId, command.top, command.bottom);
    case "rename-scene":
      return renameScene(project, command.sceneId, command.name);
    case "set-interface-chrome":
      return setInterfaceChrome(project, command.chromeHeight);
    case "set-timing":
      return setTiming(project, command);
    case "duplicate-scene":
      return duplicateScene(project, command);
    case "remove-scene":
      return removeScene(project, command.sceneId);
  }
};

export const createClassicAdventureCreatorHistory = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorHistory => ({
  present: project,
  past: [],
  future: [],
  savedFingerprint: classicAdventureCreatorFingerprint(project),
});

export const executeClassicAdventureCreatorCommand = (
  history: ClassicAdventureCreatorHistory,
  command: ClassicAdventureCreatorCommand,
): ClassicAdventureCreatorHistory => {
  const next = applyClassicAdventureCreatorCommand(history.present, command);
  if (classicAdventureCreatorFingerprint(next) === classicAdventureCreatorFingerprint(history.present)) {
    return history;
  }
  return {
    ...history,
    present: next,
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    future: [],
  };
};

export const undoClassicAdventureCreatorCommand = (
  history: ClassicAdventureCreatorHistory,
): ClassicAdventureCreatorHistory => {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    ...history,
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
};

export const redoClassicAdventureCreatorCommand = (
  history: ClassicAdventureCreatorHistory,
): ClassicAdventureCreatorHistory => {
  const next = history.future[0];
  if (!next) return history;
  return {
    ...history,
    present: next,
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    future: history.future.slice(1),
  };
};

export const markClassicAdventureCreatorSaved = (
  history: ClassicAdventureCreatorHistory,
): ClassicAdventureCreatorHistory => ({
  ...history,
  savedFingerprint: classicAdventureCreatorFingerprint(history.present),
});

export const classicAdventureCreatorHistoryIsDirty = (history: ClassicAdventureCreatorHistory): boolean =>
  classicAdventureCreatorFingerprint(history.present) !== history.savedFingerprint;
