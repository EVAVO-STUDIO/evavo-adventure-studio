import { z } from "zod";
import {
  validateAssetBuildManifest,
  type AssetBuildManifest,
  type CompiledAssetRecord,
} from "@evavo/adventure-asset-contract";
import {
  idSchema,
  sizeSchema,
  type AdventureProject,
  type Id,
  type Size,
} from "@evavo/adventure-project-schema";

export const artPresetSchema = z.enum([
  "ega-16-320x200",
  "vga-256-320x200",
  "svga-256-640x480",
  "rgba-pixel",
  "custom",
]);
export type ArtPreset = z.infer<typeof artPresetSchema>;

export const artDirectionProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    preset: artPresetSchema,
    nativeSize: sizeSchema,
    pixelAspect: z.enum(["square", "dos-320x200"]),
    palette: z
      .object({
        mode: z.enum(["indexed", "rgba"]),
        maxColours: z.number().int().min(2).max(16_777_216),
        dither: z.number().min(0).max(1),
        reserveTransparentIndex: z.boolean(),
      })
      .strict(),
    transparency: z.enum(["opaque", "binary", "full"]),
    nearestSamplingRequired: z.boolean(),
    integerScaleRequired: z.boolean(),
    cadence: z.literal("fixed-ticks"),
  })
  .strict();
export type ArtDirectionProfile = z.infer<typeof artDirectionProfileSchema>;

export const artAssetRoleSchema = z.enum([
  "background",
  "actor",
  "object",
  "ui",
  "cursor",
  "font",
  "palette",
  "audio",
  "video",
  "other",
]);
export type ArtAssetRole = z.infer<typeof artAssetRoleSchema>;

export const artAssetRuleSchema = z
  .object({
    assetId: idSchema("asset"),
    role: artAssetRoleSchema,
    outputMode: z.enum(["inherit", "indexed", "rgba"]).default("inherit"),
    maxColours: z.number().int().min(2).max(16_777_216).optional(),
    dither: z.number().min(0).max(1).optional(),
    trimMode: z.enum(["none", "alpha", "either"]).default("either"),
    transparency: z
      .enum(["inherit", "opaque", "binary", "full"])
      .default("inherit"),
    sizePolicy: z.enum(["any", "exact", "minimum"]).default("any"),
    expectedSize: sizeSchema.optional(),
    nearestOnly: z.boolean().default(true),
    allowResample: z.boolean().default(false),
    atlasPaddingMinimum: z.number().int().min(0).max(64).default(1),
    notes: z.string().optional(),
  })
  .strict();
export type ArtAssetRule = z.infer<typeof artAssetRuleSchema>;

export const artDirectionManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    profile: artDirectionProfileSchema,
    assets: z.array(artAssetRuleSchema),
  })
  .strict();
export type ArtDirectionManifest = z.infer<typeof artDirectionManifestSchema>;

export const parseArtDirectionManifest = (input: unknown): ArtDirectionManifest =>
  artDirectionManifestSchema.parse(input);

const profileForPreset = (
  preset: ArtPreset,
  nativeSize: Size,
): ArtDirectionProfile => {
  switch (preset) {
    case "ega-16-320x200":
      return {
        id: "profile.ega-16-320x200",
        name: "EGA 16-colour 320 × 200",
        preset,
        nativeSize: { width: 320, height: 200 },
        pixelAspect: "dos-320x200",
        palette: {
          mode: "indexed",
          maxColours: 16,
          dither: 0.25,
          reserveTransparentIndex: true,
        },
        transparency: "binary",
        nearestSamplingRequired: true,
        integerScaleRequired: true,
        cadence: "fixed-ticks",
      };
    case "vga-256-320x200":
      return {
        id: "profile.vga-256-320x200",
        name: "VGA 256-colour 320 × 200",
        preset,
        nativeSize: { width: 320, height: 200 },
        pixelAspect: "dos-320x200",
        palette: {
          mode: "indexed",
          maxColours: 256,
          dither: 0.35,
          reserveTransparentIndex: true,
        },
        transparency: "binary",
        nearestSamplingRequired: true,
        integerScaleRequired: true,
        cadence: "fixed-ticks",
      };
    case "svga-256-640x480":
      return {
        id: "profile.svga-256-640x480",
        name: "SVGA 256-colour 640 × 480",
        preset,
        nativeSize: { width: 640, height: 480 },
        pixelAspect: "square",
        palette: {
          mode: "indexed",
          maxColours: 256,
          dither: 0.2,
          reserveTransparentIndex: true,
        },
        transparency: "binary",
        nearestSamplingRequired: true,
        integerScaleRequired: true,
        cadence: "fixed-ticks",
      };
    case "rgba-pixel":
      return {
        id: "profile.rgba-pixel",
        name: "RGBA pixel-art native canvas",
        preset,
        nativeSize,
        pixelAspect: "square",
        palette: {
          mode: "rgba",
          maxColours: 4096,
          dither: 0,
          reserveTransparentIndex: false,
        },
        transparency: "full",
        nearestSamplingRequired: true,
        integerScaleRequired: true,
        cadence: "fixed-ticks",
      };
    case "custom":
      return {
        id: "profile.custom",
        name: "Custom native-pixel profile",
        preset,
        nativeSize,
        pixelAspect: "square",
        palette: {
          mode: "rgba",
          maxColours: 16_777_216,
          dither: 0,
          reserveTransparentIndex: false,
        },
        transparency: "full",
        nearestSamplingRequired: true,
        integerScaleRequired: true,
        cadence: "fixed-ticks",
      };
  }
};

const sceneBackgroundSizes = (
  project: AdventureProject,
): ReadonlyMap<string, readonly Size[]> => {
  const mutable = new Map<string, Size[]>();
  for (const scene of project.scenes) {
    const sizes = mutable.get(scene.backgroundAssetId) ?? [];
    sizes.push({ width: scene.width, height: scene.height });
    mutable.set(scene.backgroundAssetId, sizes);
  }
  return mutable;
};

const actorAssetIds = (project: AdventureProject): ReadonlySet<string> =>
  new Set(
    project.actors.flatMap((actor) =>
      actor.frames.map((frame) => frame.assetId as string),
    ),
  );

const inventoryAssetIds = (project: AdventureProject): ReadonlySet<string> =>
  new Set(project.inventoryItems.map((item) => item.iconAssetId as string));

const occluderAssetIds = (project: AdventureProject): ReadonlySet<string> =>
  new Set(
    project.scenes.flatMap((scene) =>
      scene.occluders.map((occluder) => occluder.assetId as string),
    ),
  );

const paletteCycleAssetIds = (project: AdventureProject): ReadonlySet<string> =>
  new Set(
    project.sequences.flatMap((sequence) =>
      sequence.tracks.flatMap((track) =>
        track.cues.flatMap((cue) =>
          cue.kind === "palette-cycle" ? [cue.paletteAssetId as string] : [],
        ),
      ),
    ),
  );

const inferredRole = (
  project: AdventureProject,
  assetId: Id<"asset">,
): ArtAssetRole => {
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return "other";
  if (sceneBackgroundSizes(project).has(assetId)) return "background";
  if (actorAssetIds(project).has(assetId)) return "actor";
  if (inventoryAssetIds(project).has(assetId)) return "ui";
  if (occluderAssetIds(project).has(assetId)) return "object";
  if (paletteCycleAssetIds(project).has(assetId) || asset.kind === "palette") {
    return "palette";
  }
  switch (asset.kind) {
    case "audio":
      return "audio";
    case "font":
      return "font";
    case "video":
      return "video";
    case "image":
    case "spritesheet":
      return "other";
  }
};

const uniqueBackgroundSize = (
  project: AdventureProject,
  assetId: Id<"asset">,
): Size | undefined => {
  const sizes = sceneBackgroundSizes(project).get(assetId) ?? [];
  const unique = new Map(sizes.map((size) => [`${size.width}x${size.height}`, size]));
  return unique.size === 1 ? [...unique.values()][0] : undefined;
};

const defaultRule = (
  project: AdventureProject,
  assetId: Id<"asset">,
): ArtAssetRule => {
  const role = inferredRole(project, assetId);
  const backgroundSize = role === "background" ? uniqueBackgroundSize(project, assetId) : undefined;
  const visual = role === "background" || role === "actor" || role === "object" || role === "ui" || role === "cursor";
  return {
    assetId,
    role,
    outputMode: "inherit",
    trimMode: role === "background" ? "none" : visual ? "alpha" : "either",
    transparency:
      role === "background" ? "opaque" : visual ? "inherit" : "inherit",
    sizePolicy: backgroundSize ? "exact" : "any",
    ...(backgroundSize ? { expectedSize: backgroundSize } : {}),
    nearestOnly: visual,
    allowResample: false,
    atlasPaddingMinimum: role === "actor" || role === "object" || role === "cursor" ? 1 : 0,
  };
};

export const createArtDirectionManifest = (
  project: AdventureProject,
  preset: ArtPreset = "vga-256-320x200",
): ArtDirectionManifest =>
  artDirectionManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    profile: profileForPreset(preset, {
      width: project.presentation.nativeWidth,
      height: project.presentation.nativeHeight,
    }),
    assets: project.assets.map((asset) => defaultRule(project, asset.id)),
  });

export type ArtDirectionIssueCode =
  | "project-mismatch"
  | "duplicate-rule"
  | "missing-rule"
  | "unexpected-rule"
  | "native-size-mismatch"
  | "sampling-policy-mismatch"
  | "integer-scale-policy-mismatch"
  | "indexed-colour-limit-invalid"
  | "size-policy-missing-size"
  | "role-kind-mismatch"
  | "background-role-mismatch"
  | "background-size-rule-mismatch"
  | "asset-build-invalid"
  | "compiled-asset-missing"
  | "compiled-size-mismatch"
  | "compiled-palette-mismatch"
  | "compiled-colour-budget-exceeded"
  | "compiled-atlas-padding-too-small"
  | "compiled-palette-unverified"
  | "vector-font-source";

export interface ArtDirectionIssue {
  readonly severity: "error" | "warning";
  readonly code: ArtDirectionIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: ArtDirectionIssue[],
  severity: ArtDirectionIssue["severity"],
  code: ArtDirectionIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const roleAllowsKind = (
  role: ArtAssetRole,
  kind: AdventureProject["assets"][number]["kind"],
): boolean => {
  switch (role) {
    case "background":
      return kind === "image";
    case "actor":
    case "object":
    case "ui":
    case "cursor":
      return kind === "image" || kind === "spritesheet";
    case "font":
      return kind === "font" || kind === "image" || kind === "spritesheet";
    case "palette":
      return kind === "palette";
    case "audio":
      return kind === "audio";
    case "video":
      return kind === "video";
    case "other":
      return true;
  }
};

const sameSize = (left: Size, right: Size): boolean =>
  left.width === right.width && left.height === right.height;

export const validateArtDirectionManifest = (
  project: AdventureProject,
  manifest: ArtDirectionManifest,
): readonly ArtDirectionIssue[] => {
  const issues: ArtDirectionIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "error",
      "project-mismatch",
      "projectId",
      `Art direction project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const projectNative = {
    width: project.presentation.nativeWidth,
    height: project.presentation.nativeHeight,
  };
  if (!sameSize(manifest.profile.nativeSize, projectNative)) {
    addIssue(
      issues,
      "error",
      "native-size-mismatch",
      "profile.nativeSize",
      `Profile native size ${manifest.profile.nativeSize.width} × ${manifest.profile.nativeSize.height} does not match project ${projectNative.width} × ${projectNative.height}.`,
    );
  }
  if (
    manifest.profile.nearestSamplingRequired &&
    project.presentation.textureSampling !== "nearest"
  ) {
    addIssue(
      issues,
      "error",
      "sampling-policy-mismatch",
      "profile.nearestSamplingRequired",
      "The art profile requires nearest-neighbour texture sampling.",
    );
  }
  if (
    manifest.profile.integerScaleRequired &&
    !project.presentation.integerScale
  ) {
    addIssue(
      issues,
      "error",
      "integer-scale-policy-mismatch",
      "profile.integerScaleRequired",
      "The art profile requires integer presentation scaling.",
    );
  }
  if (
    manifest.profile.palette.mode === "indexed" &&
    manifest.profile.palette.maxColours > 256
  ) {
    addIssue(
      issues,
      "error",
      "indexed-colour-limit-invalid",
      "profile.palette.maxColours",
      "Indexed art profiles cannot exceed 256 colours.",
    );
  }

  const projectAssets = new Map(
    project.assets.map((asset) => [asset.id as string, asset] as const),
  );
  const ruleByAsset = new Map<string, ArtAssetRule>();
  manifest.assets.forEach((rule, ruleIndex) => {
    if (ruleByAsset.has(rule.assetId)) {
      addIssue(
        issues,
        "error",
        "duplicate-rule",
        `assets[${ruleIndex}].assetId`,
        `Asset rule '${rule.assetId}' is duplicated.`,
      );
    }
    ruleByAsset.set(rule.assetId, rule);
    const asset = projectAssets.get(rule.assetId);
    if (!asset) {
      addIssue(
        issues,
        "error",
        "unexpected-rule",
        `assets[${ruleIndex}].assetId`,
        `Art rule references unknown project asset '${rule.assetId}'.`,
      );
      return;
    }
    if (!roleAllowsKind(rule.role, asset.kind)) {
      addIssue(
        issues,
        "error",
        "role-kind-mismatch",
        `assets[${ruleIndex}].role`,
        `Role '${rule.role}' is incompatible with '${asset.kind}' asset '${asset.id}'.`,
      );
    }
    if (
      (rule.sizePolicy === "exact" || rule.sizePolicy === "minimum") &&
      !rule.expectedSize
    ) {
      addIssue(
        issues,
        "error",
        "size-policy-missing-size",
        `assets[${ruleIndex}].expectedSize`,
        `Size policy '${rule.sizePolicy}' requires expected dimensions.`,
      );
    }
    const resolvedMode =
      rule.outputMode === "inherit"
        ? manifest.profile.palette.mode
        : rule.outputMode;
    const resolvedMax = rule.maxColours ?? manifest.profile.palette.maxColours;
    if (resolvedMode === "indexed" && resolvedMax > 256) {
      addIssue(
        issues,
        "error",
        "indexed-colour-limit-invalid",
        `assets[${ruleIndex}].maxColours`,
        `Indexed asset '${rule.assetId}' cannot exceed 256 colours.`,
      );
    }
  });

  project.assets.forEach((asset, assetIndex) => {
    if (!ruleByAsset.has(asset.id)) {
      addIssue(
        issues,
        "error",
        "missing-rule",
        `project.assets[${assetIndex}]`,
        `Project asset '${asset.id}' has no art-direction rule.`,
      );
    }
  });

  const backgroundSizes = sceneBackgroundSizes(project);
  for (const [assetId, sizes] of backgroundSizes) {
    const rule = ruleByAsset.get(assetId);
    if (!rule) continue;
    if (rule.role !== "background") {
      addIssue(
        issues,
        "error",
        "background-role-mismatch",
        `assets.${assetId}.role`,
        `Scene background '${assetId}' must use the background role.`,
      );
    }
    const unique = new Map(sizes.map((size) => [`${size.width}x${size.height}`, size]));
    if (unique.size > 1) {
      addIssue(
        issues,
        "error",
        "background-size-rule-mismatch",
        `assets.${assetId}.expectedSize`,
        `Background '${assetId}' is reused by scenes with incompatible dimensions.`,
      );
      continue;
    }
    const expected = [...unique.values()][0];
    if (
      expected &&
      (rule.sizePolicy !== "exact" ||
        !rule.expectedSize ||
        !sameSize(rule.expectedSize, expected))
    ) {
      addIssue(
        issues,
        "error",
        "background-size-rule-mismatch",
        `assets.${assetId}.expectedSize`,
        `Background '${assetId}' must compile exactly to ${expected.width} × ${expected.height}.`,
      );
    }
  }

  return issues;
};

const compiledById = (
  manifest: AssetBuildManifest,
): ReadonlyMap<string, CompiledAssetRecord> =>
  new Map(manifest.assets.map((asset) => [asset.assetId as string, asset] as const));

const sizeMatches = (
  rule: ArtAssetRule,
  width: number,
  height: number,
): boolean => {
  if (rule.sizePolicy === "any" || !rule.expectedSize) return true;
  return rule.sizePolicy === "exact"
    ? width === rule.expectedSize.width && height === rule.expectedSize.height
    : width >= rule.expectedSize.width && height >= rule.expectedSize.height;
};

export const evaluateCompiledArtDirection = (
  project: AdventureProject,
  art: ArtDirectionManifest,
  compiled: AssetBuildManifest,
): readonly ArtDirectionIssue[] => {
  const issues: ArtDirectionIssue[] = [
    ...validateArtDirectionManifest(project, art),
  ];
  for (const assetIssue of validateAssetBuildManifest(project, compiled)) {
    addIssue(
      issues,
      "error",
      "asset-build-invalid",
      assetIssue.path,
      assetIssue.message,
    );
  }

  const evidence = compiledById(compiled);
  art.assets.forEach((rule, ruleIndex) => {
    const asset = evidence.get(rule.assetId);
    if (!asset) {
      addIssue(
        issues,
        "error",
        "compiled-asset-missing",
        `assets[${ruleIndex}]`,
        `Compiled evidence for '${rule.assetId}' is missing.`,
      );
      return;
    }
    const resolvedMode =
      rule.outputMode === "inherit" ? art.profile.palette.mode : rule.outputMode;
    const resolvedMax = rule.maxColours ?? art.profile.palette.maxColours;

    if (asset.kind === "image") {
      if (!sizeMatches(rule, asset.metadata.width, asset.metadata.height)) {
        addIssue(
          issues,
          "error",
          "compiled-size-mismatch",
          `compiled.assets.${rule.assetId}.metadata`,
          `Compiled image '${rule.assetId}' is ${asset.metadata.width} × ${asset.metadata.height}; expected ${rule.sizePolicy} ${rule.expectedSize?.width ?? "?"} × ${rule.expectedSize?.height ?? "?"}.`,
        );
      }
      if (
        (resolvedMode === "indexed" && !asset.metadata.palette) ||
        (resolvedMode === "rgba" && asset.metadata.palette)
      ) {
        addIssue(
          issues,
          "error",
          "compiled-palette-mismatch",
          `compiled.assets.${rule.assetId}.metadata.palette`,
          `Compiled image '${rule.assetId}' does not match '${resolvedMode}' output policy.`,
        );
      }
      if (asset.metadata.colourCount > resolvedMax) {
        addIssue(
          issues,
          "error",
          "compiled-colour-budget-exceeded",
          `compiled.assets.${rule.assetId}.metadata.colourCount`,
          `Compiled image '${rule.assetId}' uses ${asset.metadata.colourCount} colours; budget is ${resolvedMax}.`,
        );
      }
    }

    if (asset.kind === "spritesheet") {
      asset.metadata.frames.forEach((frame, frameIndex) => {
        if (frame.padding < rule.atlasPaddingMinimum) {
          addIssue(
            issues,
            "error",
            "compiled-atlas-padding-too-small",
            `compiled.assets.${rule.assetId}.metadata.frames[${frameIndex}].padding`,
            `Atlas frame '${frame.frameId}' has ${frame.padding}px padding; rule requires ${rule.atlasPaddingMinimum}px.`,
          );
        }
      });
      if (resolvedMode === "indexed") {
        addIssue(
          issues,
          "warning",
          "compiled-palette-unverified",
          `compiled.assets.${rule.assetId}.metadata`,
          `Runtime spritesheet metadata does not yet expose page palette counts for '${rule.assetId}'.`,
        );
      }
    }

    if (asset.kind === "palette" && asset.metadata.entries > resolvedMax) {
      addIssue(
        issues,
        "error",
        "compiled-colour-budget-exceeded",
        `compiled.assets.${rule.assetId}.metadata.entries`,
        `Palette '${rule.assetId}' contains ${asset.metadata.entries} entries; budget is ${resolvedMax}.`,
      );
    }

    if (
      asset.kind === "font" &&
      asset.metadata.format === "vector-source" &&
      (rule.role === "font" || rule.role === "ui")
    ) {
      addIssue(
        issues,
        "warning",
        "vector-font-source",
        `compiled.assets.${rule.assetId}.metadata.format`,
        `Font '${rule.assetId}' remains a vector source; authentic runtime text should use a bitmap atlas or binary bitmap font.`,
      );
    }
  });

  return issues;
};

export type ArtDirectionEditorCommand =
  | {
      readonly kind: "batch";
      readonly commands: readonly ArtDirectionEditorCommand[];
    }
  | {
      readonly kind: "replace-profile";
      readonly profile: ArtDirectionProfile;
    }
  | {
      readonly kind: "replace-asset-rule";
      readonly assetId: Id<"asset">;
      readonly rule: ArtAssetRule;
    };

export interface ArtDirectionEditorDocumentState {
  readonly manifest: ArtDirectionManifest;
  readonly savedManifest: ArtDirectionManifest;
  readonly operationRevision: number;
}

export interface ArtDirectionEditorHistoryEntry {
  readonly undo: ArtDirectionEditorCommand;
  readonly redo: ArtDirectionEditorCommand;
}

export interface ArtDirectionEditorHistoryState {
  readonly document: ArtDirectionEditorDocumentState;
  readonly undoStack: readonly ArtDirectionEditorHistoryEntry[];
  readonly redoStack: readonly ArtDirectionEditorHistoryEntry[];
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalArtDirectionJson = (value: unknown): string => {
  const output = JSON.stringify(canonicalize(value));
  if (output === undefined) {
    throw new TypeError("Art direction data cannot be represented as JSON.");
  }
  return output;
};

export class ArtDirectionEditorCommandError extends Error {
  readonly code: "empty-batch" | "missing-rule" | "identity-change" | "invalid-art-direction";
  readonly path: string;
  readonly issues: readonly ArtDirectionIssue[];

  constructor(
    code: ArtDirectionEditorCommandError["code"],
    path: string,
    message: string,
    issues: readonly ArtDirectionIssue[] = [],
  ) {
    super(message);
    this.name = "ArtDirectionEditorCommandError";
    this.code = code;
    this.path = path;
    this.issues = issues;
  }
}

const assertManifestValid = (
  project: AdventureProject,
  manifest: ArtDirectionManifest,
): void => {
  const issues = validateArtDirectionManifest(project, manifest).filter(
    (entry) => entry.severity === "error",
  );
  if (issues.length > 0) {
    throw new ArtDirectionEditorCommandError(
      "invalid-art-direction",
      issues[0]?.path ?? "$",
      `Art direction edit produced ${issues.length} error(s).`,
      issues,
    );
  }
};

export const applyArtDirectionEditorCommand = (
  project: AdventureProject,
  manifest: ArtDirectionManifest,
  command: ArtDirectionEditorCommand,
): { readonly manifest: ArtDirectionManifest; readonly inverse: ArtDirectionEditorCommand } => {
  switch (command.kind) {
    case "batch": {
      if (command.commands.length === 0) {
        throw new ArtDirectionEditorCommandError(
          "empty-batch",
          "commands",
          "Art direction command batches cannot be empty.",
        );
      }
      let next = manifest;
      const inverses: ArtDirectionEditorCommand[] = [];
      for (const child of command.commands) {
        const applied = applyArtDirectionEditorCommand(project, next, child);
        next = applied.manifest;
        inverses.unshift(applied.inverse);
      }
      return { manifest: next, inverse: { kind: "batch", commands: inverses } };
    }
    case "replace-profile": {
      const next = { ...manifest, profile: cloneJson(command.profile) };
      assertManifestValid(project, next);
      return {
        manifest: next,
        inverse: { kind: "replace-profile", profile: manifest.profile },
      };
    }
    case "replace-asset-rule": {
      if (command.assetId !== command.rule.assetId) {
        throw new ArtDirectionEditorCommandError(
          "identity-change",
          "rule.assetId",
          `Asset rule '${command.assetId}' cannot become '${command.rule.assetId}'.`,
        );
      }
      const index = manifest.assets.findIndex(
        (rule) => rule.assetId === command.assetId,
      );
      if (index < 0) {
        throw new ArtDirectionEditorCommandError(
          "missing-rule",
          "assetId",
          `Art rule '${command.assetId}' does not exist.`,
        );
      }
      const previous = manifest.assets[index];
      if (!previous) throw new Error("Art direction rule index is invalid.");
      const next = {
        ...manifest,
        assets: [
          ...manifest.assets.slice(0, index).map(cloneJson),
          cloneJson(command.rule),
          ...manifest.assets.slice(index + 1).map(cloneJson),
        ],
      };
      assertManifestValid(project, next);
      return {
        manifest: next,
        inverse: {
          kind: "replace-asset-rule",
          assetId: command.assetId,
          rule: previous,
        },
      };
    }
  }
};

export const createArtDirectionEditorHistory = (
  project: AdventureProject,
  manifest: ArtDirectionManifest,
): ArtDirectionEditorHistoryState => {
  assertManifestValid(project, manifest);
  const snapshot = cloneJson(manifest);
  return {
    document: {
      manifest: snapshot,
      savedManifest: cloneJson(snapshot),
      operationRevision: 0,
    },
    undoStack: [],
    redoStack: [],
  };
};

export const isArtDirectionEditorDocumentDirty = (
  document: ArtDirectionEditorDocumentState,
): boolean =>
  canonicalArtDirectionJson(document.manifest) !==
  canonicalArtDirectionJson(document.savedManifest);

const applyToArtDocument = (
  project: AdventureProject,
  document: ArtDirectionEditorDocumentState,
  command: ArtDirectionEditorCommand,
): {
  readonly document: ArtDirectionEditorDocumentState;
  readonly inverse: ArtDirectionEditorCommand;
} => {
  const applied = applyArtDirectionEditorCommand(project, document.manifest, command);
  return {
    document: {
      ...document,
      manifest: applied.manifest,
      operationRevision: document.operationRevision + 1,
    },
    inverse: applied.inverse,
  };
};

export const executeArtDirectionEditorCommand = (
  project: AdventureProject,
  history: ArtDirectionEditorHistoryState,
  command: ArtDirectionEditorCommand,
): ArtDirectionEditorHistoryState => {
  const applied = applyToArtDocument(project, history.document, command);
  return {
    document: applied.document,
    undoStack: [
      ...history.undoStack,
      { undo: applied.inverse, redo: cloneJson(command) },
    ],
    redoStack: [],
  };
};

export const undoArtDirectionEditorCommand = (
  project: AdventureProject,
  history: ArtDirectionEditorHistoryState,
): ArtDirectionEditorHistoryState => {
  const entry = history.undoStack.at(-1);
  if (!entry) return history;
  const applied = applyToArtDocument(project, history.document, entry.undo);
  return {
    document: applied.document,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry],
  };
};

export const redoArtDirectionEditorCommand = (
  project: AdventureProject,
  history: ArtDirectionEditorHistoryState,
): ArtDirectionEditorHistoryState => {
  const entry = history.redoStack.at(-1);
  if (!entry) return history;
  const applied = applyToArtDocument(project, history.document, entry.redo);
  return {
    document: applied.document,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1),
  };
};

export const markArtDirectionEditorHistorySaved = (
  history: ArtDirectionEditorHistoryState,
): ArtDirectionEditorHistoryState => ({
  ...history,
  document: {
    ...history.document,
    savedManifest: cloneJson(history.document.manifest),
  },
});
