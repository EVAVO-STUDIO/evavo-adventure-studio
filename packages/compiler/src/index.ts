import {
  type AssetBuildManifest,
  type AssetManifestIssue,
  toRuntimeAssetRecord,
  validateAssetBuildManifest,
} from "@evavo/adventure-asset-contract";
import {
  type FrameAssetMappingIssue,
  validateCompiledFrameMappings,
} from "@evavo/adventure-asset-contract/frame-mapping";
import {
  type PortableRuntimePathIssue,
  validatePortableRuntimePaths,
} from "@evavo/adventure-asset-contract/portable-path";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import {
  type BitmapFontIssue,
  type BitmapFontManifest,
  validateBitmapFontManifest,
} from "@evavo/adventure-bitmap-font";
import {
  type BitmapFontCompiledIssue,
  validateCompiledBitmapFontMappings,
} from "@evavo/adventure-bitmap-font/compiled-mapping";
import type {
  Actor,
  AdventureProject,
  DialogueGraph,
  Hotspot,
  Id,
  Scene,
  Sequence,
} from "@evavo/adventure-project-schema";
import {
  type CompiledDialogue,
  type CompiledHotspot,
  type CompiledScene,
  type CompiledSequence,
  parseRuntimeBundle,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import { type UiSkinIssue, type UiSkinManifest, validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import {
  type UiSkinCompiledIssue,
  validateCompiledUiSkinMappings,
} from "@evavo/adventure-ui-skin/compiled-mapping";
import {
  hasValidationErrors,
  type ValidationIssue,
  validateProjectSemantics,
} from "@evavo/adventure-validation";

export type CompilationIssue =
  | ValidationIssue
  | AssetManifestIssue
  | PortableRuntimePathIssue
  | FrameAssetMappingIssue
  | BitmapFontIssue
  | BitmapFontCompiledIssue
  | UiSkinIssue
  | UiSkinCompiledIssue;

export interface CompiledProject {
  readonly bundle: RuntimeBundle;
  readonly canonicalJson: string;
  readonly fingerprint: string;
  readonly warnings: readonly ValidationIssue[];
}

export class ProjectCompilationError extends Error {
  readonly issues: readonly CompilationIssue[];

  constructor(issues: readonly CompilationIssue[]) {
    super(`Project compilation failed with ${issues.length} validation issue(s).`);
    this.name = "ProjectCompilationError";
    this.issues = issues;
  }
}

const sortById = <T extends { readonly id: string }>(values: readonly T[]): T[] =>
  [...values].sort((left, right) => left.id.localeCompare(right.id));

export const interactionIndexKey = (verb: string, itemId: Id<"item"> | null): string =>
  JSON.stringify([verb, itemId]);

const compileHotspot = (hotspot: Hotspot): CompiledHotspot => {
  const mutableIndex: Record<string, Id<"interaction">[]> = {};
  for (const interaction of hotspot.interactions) {
    const key = interactionIndexKey(interaction.verb, interaction.itemId ?? null);
    const existing = mutableIndex[key];
    if (existing) existing.push(interaction.id);
    else mutableIndex[key] = [interaction.id];
  }
  return { ...hotspot, interactionIndex: mutableIndex };
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

const compileDialogue = (dialogue: DialogueGraph): CompiledDialogue => {
  const nodes = sortById(dialogue.nodes);
  const nodeIndex: Record<string, number> = {};
  nodes.forEach((node, index) => {
    nodeIndex[node.id] = index;
  });
  return { ...dialogue, nodes, nodeIndex };
};

const compileSequence = (sequence: Sequence): CompiledSequence => ({
  ...sequence,
  tracks: sortById(sequence.tracks),
  cueCount: sequence.tracks.reduce((total, track) => total + track.cues.length, 0),
});

const compileBitmapFonts = (manifest: BitmapFontManifest): BitmapFontManifest => ({
  ...manifest,
  fonts: [...manifest.fonts]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((font) => ({
      ...font,
      glyphs: [...font.glyphs].sort((left, right) => {
        const codePointDifference = left.codePoint - right.codePoint;
        return codePointDifference !== 0 ? codePointDifference : left.id.localeCompare(right.id);
      }),
      kernings: [...font.kernings].sort((left, right) => {
        const leftDifference = left.leftCodePoint - right.leftCodePoint;
        return leftDifference !== 0 ? leftDifference : left.rightCodePoint - right.rightCodePoint;
      }),
    })),
});

const compileUiSkins = (manifest: UiSkinManifest): UiSkinManifest => ({
  ...manifest,
  skins: [...manifest.skins].sort((left, right) => left.id.localeCompare(right.id)),
});

const canonicalRuntimeAsset = (asset: RuntimeAssetRecord): RuntimeAssetRecord => {
  const outputFiles = [...asset.outputFiles].sort((left, right) => {
    const roleDifference = left.role.localeCompare(right.role);
    return roleDifference !== 0 ? roleDifference : left.runtimePath.localeCompare(right.runtimePath);
  });
  if (asset.kind === "spritesheet") {
    return {
      ...asset,
      outputFiles,
      metadata: {
        ...asset.metadata,
        pages: [...asset.metadata.pages].sort((left, right) =>
          left.outputRole.localeCompare(right.outputRole),
        ),
        frames: [...asset.metadata.frames].sort((left, right) => left.frameId.localeCompare(right.frameId)),
      },
    };
  }
  return { ...asset, outputFiles };
};

const compileRuntimeAssets = (manifest: AssetBuildManifest): readonly RuntimeAssetRecord[] =>
  manifest.assets
    .map(toRuntimeAssetRecord)
    .map((asset) => canonicalRuntimeAsset(asset as RuntimeAssetRecord))
    .sort((left, right) => left.assetId.localeCompare(right.assetId));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) => left.localeCompare(right))) {
      const child = source[key];
      if (child !== undefined) result[key] = canonicalize(child);
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

export const compileProject = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  bitmapFonts?: BitmapFontManifest,
  uiSkins?: UiSkinManifest,
): CompiledProject => {
  const projectIssues = validateProjectSemantics(project);
  const assetIssues = validateAssetBuildManifest(project, assetManifest);
  const pathIssues = validatePortableRuntimePaths(assetManifest);
  const frameIssues = validateCompiledFrameMappings(project, assetManifest);
  const bitmapFontIssues = bitmapFonts ? validateBitmapFontManifest(project, bitmapFonts) : [];
  const bitmapFontMappingIssues = bitmapFonts
    ? validateCompiledBitmapFontMappings(bitmapFonts, assetManifest)
    : [];
  const uiSkinIssues = uiSkins ? validateUiSkinManifest(project, bitmapFonts ?? null, uiSkins) : [];
  const uiSkinMappingIssues = uiSkins ? validateCompiledUiSkinMappings(uiSkins, assetManifest) : [];
  const issues: CompilationIssue[] = [
    ...projectIssues,
    ...assetIssues,
    ...pathIssues,
    ...frameIssues,
    ...bitmapFontIssues,
    ...bitmapFontMappingIssues,
    ...uiSkinIssues,
    ...uiSkinMappingIssues,
  ];
  if (
    hasValidationErrors(projectIssues) ||
    assetIssues.length > 0 ||
    pathIssues.length > 0 ||
    frameIssues.length > 0 ||
    bitmapFontIssues.length > 0 ||
    bitmapFontMappingIssues.length > 0 ||
    uiSkinIssues.some((issue) => issue.severity === "error") ||
    uiSkinMappingIssues.length > 0
  ) {
    throw new ProjectCompilationError(issues);
  }

  const bundle = parseRuntimeBundle({
    bundleVersion: 1,
    sourceSchemaVersion: project.schemaVersion,
    projectId: project.id,
    title: project.title,
    presentation: project.presentation,
    startSceneId: project.startSceneId,
    startEntranceId: project.startEntranceId,
    assetManifestFingerprint: assetManifest.fingerprint,
    assetCompilerVersion: assetManifest.compilerVersion,
    assets: compileRuntimeAssets(assetManifest),
    inventoryItems: sortById(project.inventoryItems),
    actors: sortById(project.actors).map(compileActor),
    scenes: sortById(project.scenes).map(compileScene),
    dialogues: sortById(project.dialogues).map(compileDialogue),
    sequences: sortById(project.sequences).map(compileSequence),
    ...(bitmapFonts ? { bitmapFonts: compileBitmapFonts(bitmapFonts) } : {}),
    ...(uiSkins ? { uiSkins: compileUiSkins(uiSkins) } : {}),
  });
  const canonicalJson = canonicalStringify(bundle);
  return {
    bundle,
    canonicalJson,
    fingerprint: `fnv1a64:${fnv1a64(canonicalJson)}`,
    warnings: projectIssues.filter((issue) => issue.severity === "warning"),
  };
};

export type CompilationResult =
  | { readonly kind: "compiled"; readonly project: CompiledProject }
  | { readonly kind: "invalid"; readonly issues: readonly CompilationIssue[] };

export const tryCompileProject = (
  project: AdventureProject,
  assetManifest: AssetBuildManifest,
  bitmapFonts?: BitmapFontManifest,
  uiSkins?: UiSkinManifest,
): CompilationResult => {
  try {
    return {
      kind: "compiled",
      project: compileProject(project, assetManifest, bitmapFonts, uiSkins),
    };
  } catch (error) {
    if (error instanceof ProjectCompilationError) {
      return { kind: "invalid", issues: error.issues };
    }
    throw error;
  }
};
