import {
  type AdventureProject,
  type Id,
  idSchema,
  rectangleSchema,
  sizeSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";

export const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hexadecimal digest.");

export const relativeRuntimePathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), {
    message: "Runtime paths must be relative.",
  })
  .refine((value) => !value.includes("\\"), {
    message: "Runtime paths must use forward slashes.",
  })
  .refine(
    (value) => value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    { message: "Runtime paths cannot contain empty, current or parent segments." },
  );

export const compiledSourceFileSchema = z
  .object({
    path: z.string().min(1),
    sha256: sha256Schema,
    byteLength: z.number().int().nonnegative(),
  })
  .strict();
export type CompiledSourceFile = z.infer<typeof compiledSourceFileSchema>;

export const compiledOutputFileSchema = z
  .object({
    role: z.string().min(1),
    runtimePath: relativeRuntimePathSchema,
    mediaType: z.string().min(1),
    sha256: sha256Schema,
    byteLength: z.number().int().nonnegative(),
  })
  .strict();
export type CompiledOutputFile = z.infer<typeof compiledOutputFileSchema>;

export const imageAssetMetadataSchema = z
  .object({
    kind: z.literal("image"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    palette: z.boolean(),
    colourCount: z.number().int().positive(),
  })
  .strict();

export const atlasPageMetadataSchema = z
  .object({
    outputRole: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const atlasFrameMetadataSchema = z
  .object({
    frameId: idSchema("sprite-frame"),
    pageOutputRole: z.string().min(1),
    sourceRect: rectangleSchema,
    originalSize: sizeSchema,
    trimOffset: z
      .object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
      })
      .strict(),
    padding: z.number().int().nonnegative(),
  })
  .strict();

export const spritesheetAssetMetadataSchema = z
  .object({
    kind: z.literal("spritesheet"),
    pages: z.array(atlasPageMetadataSchema).min(1),
    frames: z.array(atlasFrameMetadataSchema).min(1),
  })
  .strict();

export const audioAssetMetadataSchema = z
  .object({
    kind: z.literal("audio"),
    durationMilliseconds: z.number().int().nonnegative().optional(),
    channels: z.number().int().positive().optional(),
    sampleRate: z.number().int().positive().optional(),
  })
  .strict();

export const fontAssetMetadataSchema = z
  .object({
    kind: z.literal("font"),
    format: z.enum(["bitmap-atlas", "binary-font", "vector-source"]),
    glyphCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export const videoAssetMetadataSchema = z
  .object({
    kind: z.literal("video"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationMilliseconds: z.number().int().nonnegative().optional(),
  })
  .strict();

export const paletteAssetMetadataSchema = z
  .object({
    kind: z.literal("palette"),
    entries: z.number().int().min(1).max(256),
    transparentIndex: z.number().int().min(0).max(255).optional(),
  })
  .strict();

export const compiledAssetMetadataSchema = z.discriminatedUnion("kind", [
  imageAssetMetadataSchema,
  spritesheetAssetMetadataSchema,
  audioAssetMetadataSchema,
  fontAssetMetadataSchema,
  videoAssetMetadataSchema,
  paletteAssetMetadataSchema,
]);
export type CompiledAssetMetadata = z.infer<typeof compiledAssetMetadataSchema>;

const compiledAssetFields = {
  assetId: idSchema("asset"),
  sourceFiles: z.array(compiledSourceFileSchema).min(1),
  outputFiles: z.array(compiledOutputFileSchema).min(1),
} as const;

export const compiledAssetRecordSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("image"),
      metadata: imageAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("spritesheet"),
      metadata: spritesheetAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("audio"),
      metadata: audioAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("font"),
      metadata: fontAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("video"),
      metadata: videoAssetMetadataSchema,
    })
    .strict(),
  z
    .object({
      ...compiledAssetFields,
      kind: z.literal("palette"),
      metadata: paletteAssetMetadataSchema,
    })
    .strict(),
]);
export type CompiledAssetRecord = z.infer<typeof compiledAssetRecordSchema>;

export const assetBuildManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    compilerVersion: z.string().min(1),
    assets: z.array(compiledAssetRecordSchema),
    fingerprint: sha256Schema,
  })
  .strict();
export type AssetBuildManifest = z.infer<typeof assetBuildManifestSchema>;

export const parseAssetBuildManifest = (input: unknown): AssetBuildManifest =>
  assetBuildManifestSchema.parse(input);

export type RuntimeAssetRecord = CompiledAssetRecord extends infer T
  ? T extends CompiledAssetRecord
    ? Omit<T, "sourceFiles">
    : never
  : never;

export const toRuntimeAssetRecord = (asset: CompiledAssetRecord): RuntimeAssetRecord => {
  const { sourceFiles: _sourceFiles, ...runtime } = asset;
  return runtime as RuntimeAssetRecord;
};

export type AssetManifestIssueCode =
  | "project-mismatch"
  | "duplicate-asset"
  | "missing-asset"
  | "unexpected-asset"
  | "asset-kind-mismatch"
  | "source-path-missing"
  | "duplicate-output-role"
  | "duplicate-runtime-path"
  | "missing-output-role"
  | "unknown-page-role"
  | "duplicate-page-role"
  | "duplicate-frame"
  | "frame-out-of-bounds";

export interface AssetManifestIssue {
  readonly severity: "error";
  readonly code: AssetManifestIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: AssetManifestIssue[],
  code: AssetManifestIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const validateOutputRoles = (
  asset: CompiledAssetRecord,
  assetPath: string,
  issues: AssetManifestIssue[],
  runtimePaths: Map<string, string>,
): void => {
  const outputRoles = new Set<string>();
  for (let index = 0; index < asset.outputFiles.length; index += 1) {
    const output = asset.outputFiles[index];
    if (!output) {
      continue;
    }
    const outputPath = `${assetPath}.outputFiles[${index}]`;
    if (outputRoles.has(output.role)) {
      addIssue(
        issues,
        "duplicate-output-role",
        `${outputPath}.role`,
        `Output role '${output.role}' is duplicated for asset '${asset.assetId}'.`,
      );
    }
    outputRoles.add(output.role);

    const existing = runtimePaths.get(output.runtimePath);
    if (existing) {
      addIssue(
        issues,
        "duplicate-runtime-path",
        `${outputPath}.runtimePath`,
        `Runtime path '${output.runtimePath}' is already used at '${existing}'.`,
      );
    } else {
      runtimePaths.set(output.runtimePath, outputPath);
    }
  }

  if (asset.kind !== "spritesheet") {
    if (!outputRoles.has("primary")) {
      addIssue(
        issues,
        "missing-output-role",
        `${assetPath}.outputFiles`,
        `Asset '${asset.assetId}' requires a 'primary' runtime output.`,
      );
    }
    return;
  }

  if (!outputRoles.has("atlas-manifest")) {
    addIssue(
      issues,
      "missing-output-role",
      `${assetPath}.outputFiles`,
      `Spritesheet '${asset.assetId}' requires an 'atlas-manifest' output.`,
    );
  }

  const pageRoles = new Set<string>();
  const pageByRole = new Map(asset.metadata.pages.map((page) => [page.outputRole, page] as const));
  asset.metadata.pages.forEach((page, pageIndex) => {
    if (pageRoles.has(page.outputRole)) {
      addIssue(
        issues,
        "duplicate-page-role",
        `${assetPath}.metadata.pages[${pageIndex}].outputRole`,
        `Atlas page role '${page.outputRole}' is duplicated.`,
      );
    }
    pageRoles.add(page.outputRole);
    if (!outputRoles.has(page.outputRole)) {
      addIssue(
        issues,
        "unknown-page-role",
        `${assetPath}.metadata.pages[${pageIndex}].outputRole`,
        `Atlas page references missing output role '${page.outputRole}'.`,
      );
    }
  });

  const frameIds = new Set<string>();
  asset.metadata.frames.forEach((frame, frameIndex) => {
    const framePath = `${assetPath}.metadata.frames[${frameIndex}]`;
    if (frameIds.has(frame.frameId)) {
      addIssue(
        issues,
        "duplicate-frame",
        `${framePath}.frameId`,
        `Frame '${frame.frameId}' is duplicated in spritesheet '${asset.assetId}'.`,
      );
    }
    frameIds.add(frame.frameId);

    if (!outputRoles.has(frame.pageOutputRole)) {
      addIssue(
        issues,
        "unknown-page-role",
        `${framePath}.pageOutputRole`,
        `Frame '${frame.frameId}' references missing output role '${frame.pageOutputRole}'.`,
      );
    }

    const page = pageByRole.get(frame.pageOutputRole);
    if (
      page &&
      (frame.sourceRect.x + frame.sourceRect.width > page.width ||
        frame.sourceRect.y + frame.sourceRect.height > page.height)
    ) {
      addIssue(
        issues,
        "frame-out-of-bounds",
        `${framePath}.sourceRect`,
        `Frame '${frame.frameId}' exceeds atlas page '${frame.pageOutputRole}'.`,
      );
    }
  });
};

export const validateAssetBuildManifest = (
  project: AdventureProject,
  manifest: AssetBuildManifest,
): readonly AssetManifestIssue[] => {
  const issues: AssetManifestIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "project-mismatch",
      "projectId",
      `Asset manifest project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const authoredById = new Map(project.assets.map((asset) => [asset.id as string, asset] as const));
  const compiledById = new Map<string, CompiledAssetRecord>();
  const runtimePaths = new Map<string, string>();

  manifest.assets.forEach((asset, index) => {
    const assetPath = `assets[${index}]`;
    if (compiledById.has(asset.assetId)) {
      addIssue(
        issues,
        "duplicate-asset",
        `${assetPath}.assetId`,
        `Asset '${asset.assetId}' is duplicated in the build manifest.`,
      );
    } else {
      compiledById.set(asset.assetId, asset);
    }

    const authored = authoredById.get(asset.assetId);
    if (!authored) {
      addIssue(
        issues,
        "unexpected-asset",
        `${assetPath}.assetId`,
        `Compiled asset '${asset.assetId}' is not declared by the project.`,
      );
    } else {
      if (authored.kind !== asset.kind) {
        addIssue(
          issues,
          "asset-kind-mismatch",
          `${assetPath}.kind`,
          `Compiled asset kind '${asset.kind}' does not match authored kind '${authored.kind}'.`,
        );
      }
      if (!asset.sourceFiles.some((source) => source.path === authored.path)) {
        addIssue(
          issues,
          "source-path-missing",
          `${assetPath}.sourceFiles`,
          `Compiled asset '${asset.assetId}' does not include authored source '${authored.path}'.`,
        );
      }
    }

    validateOutputRoles(asset, assetPath, issues, runtimePaths);
  });

  project.assets.forEach((asset, index) => {
    if (!compiledById.has(asset.id)) {
      addIssue(
        issues,
        "missing-asset",
        `project.assets[${index}]`,
        `Authored asset '${asset.id}' has no compiled manifest record.`,
      );
    }
  });

  return issues;
};
