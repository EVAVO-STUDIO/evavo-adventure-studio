import type {
  Actor,
  AdventureProject,
  Asset,
  Hotspot,
  Id,
  InventoryItem,
  Scene,
} from "@evavo/adventure-project-schema";
import {
  hasValidationErrors,
  validateProjectSemantics,
  type ValidationIssue,
} from "@evavo/adventure-validation";

export interface CompiledHotspot extends Hotspot {
  readonly interactionIndex: Readonly<Record<string, readonly Id<"interaction">[]>>;
}

export interface CompiledScene
  extends Omit<
    Scene,
    | "navigationAreas"
    | "depthBands"
    | "occluders"
    | "hotspots"
    | "entrances"
  > {
  readonly navigationAreas: Scene["navigationAreas"];
  readonly depthBands: Scene["depthBands"];
  readonly occluders: Scene["occluders"];
  readonly hotspots: readonly CompiledHotspot[];
  readonly entrances: Scene["entrances"];
}

export interface RuntimeBundle {
  readonly bundleVersion: 1;
  readonly sourceSchemaVersion: 1;
  readonly projectId: Id<"project">;
  readonly title: string;
  readonly presentation: AdventureProject["presentation"];
  readonly startSceneId: Id<"scene">;
  readonly startEntranceId: Id<"entrance">;
  readonly assets: readonly Asset[];
  readonly inventoryItems: readonly InventoryItem[];
  readonly actors: readonly Actor[];
  readonly scenes: readonly CompiledScene[];
}

export interface CompiledProject {
  readonly bundle: RuntimeBundle;
  readonly canonicalJson: string;
  readonly fingerprint: string;
  readonly warnings: readonly ValidationIssue[];
}

export class ProjectCompilationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Project compilation failed with ${issues.length} validation issue(s).`);
    this.name = "ProjectCompilationError";
    this.issues = issues;
  }
}

const sortById = <T extends { readonly id: string }>(values: readonly T[]): readonly T[] =>
  [...values].sort((left, right) => left.id.localeCompare(right.id));

export const interactionIndexKey = (
  verb: string,
  itemId: Id<"item"> | null,
): string => JSON.stringify([verb, itemId]);

const compileHotspot = (hotspot: Hotspot): CompiledHotspot => {
  const mutableIndex: Record<string, Id<"interaction">[]> = {};

  for (const interaction of hotspot.interactions) {
    const key = interactionIndexKey(interaction.verb, interaction.itemId ?? null);
    const existing = mutableIndex[key];
    if (existing) {
      existing.push(interaction.id);
    } else {
      mutableIndex[key] = [interaction.id];
    }
  }

  return {
    ...hotspot,
    interactionIndex: mutableIndex,
  };
};

const compileScene = (scene: Scene): CompiledScene => ({
  ...scene,
  navigationAreas: sortById(scene.navigationAreas),
  depthBands: sortById(scene.depthBands),
  occluders: sortById(scene.occluders),
  hotspots: scene.hotspots.map(compileHotspot),
  entrances: sortById(scene.entrances),
});

const compileActor = (actor: Actor): Actor => ({
  ...actor,
  frames: sortById(actor.frames),
  animations: sortById(actor.animations),
});

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) {
        result[key] = canonicalize(child);
      }
    }

    return result;
  }

  return value;
};

export const canonicalStringify = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("The supplied value cannot be represented as canonical JSON.");
  }
  return serialized;
};

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }

  return hash.toString(16).padStart(16, "0");
};

export const compileProject = (project: AdventureProject): CompiledProject => {
  const issues = validateProjectSemantics(project);
  if (hasValidationErrors(issues)) {
    throw new ProjectCompilationError(issues);
  }

  const bundle: RuntimeBundle = {
    bundleVersion: 1,
    sourceSchemaVersion: project.schemaVersion,
    projectId: project.id,
    title: project.title,
    presentation: project.presentation,
    startSceneId: project.startSceneId,
    startEntranceId: project.startEntranceId,
    assets: sortById(project.assets),
    inventoryItems: sortById(project.inventoryItems),
    actors: sortById(project.actors).map(compileActor),
    scenes: sortById(project.scenes).map(compileScene),
  };
  const canonicalJson = canonicalStringify(bundle);

  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
};

export type CompilationResult =
  | { readonly kind: "compiled"; readonly project: CompiledProject }
  | { readonly kind: "invalid"; readonly issues: readonly ValidationIssue[] };

export const tryCompileProject = (project: AdventureProject): CompilationResult => {
  try {
    return { kind: "compiled", project: compileProject(project) };
  } catch (error) {
    if (error instanceof ProjectCompilationError) {
      return { kind: "invalid", issues: error.issues };
    }
    throw error;
  }
};
