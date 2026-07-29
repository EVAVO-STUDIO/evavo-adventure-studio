import { z } from "zod";
import {
  idSchema,
  pointSchema,
  rectangleSchema,
  sizeSchema,
  type AdventureProject,
  type Id,
} from "@evavo/adventure-project-schema";

export const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hexadecimal digest.");

const relativeRuntimePathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), {
    message: "Runtime paths must be relative.",
  })
  .refine((value) => !value.includes("\\"), {
    message: "Runtime paths must use forward slashes.",
  })
  .refine(
    (value) =>
      value
        .split("/")
        .every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
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
    trimOffset: pointSchema,
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

export const compiledAssetRecordSchema = z
  .object({
    assetId: idSchema("asset"),
    kind: z.enum(["image", "spritesheet", "audio", "font", "video", "palette"]),
    sourceFiles: z.array(compiledSourceFileSchema).min(1),
    outputFiles: z.array(compiledOutputFileSchema).min(1),
    metadata: compiledAssetMetadataSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind !== value.metadata.kind) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "kind"],
        message: `Metadata kind '${value.metadata.kind}' does not match asset kind '${value.kind}'.`,
      });
    }
  });
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

export interface RuntimeAssetRecord {
  readonly assetId: Id<"asset">;
  readonly kind: CompiledAssetRecord["kind"];
  readonly outputFiles: readonly CompiledOutputFile[];
  readonly metadata: CompiledAssetMetadata;
}

export const toRuntimeAssetRecord = (
  asset: CompiledAssetRecord,
): RuntimeAssetRecord => ({
  assetId: asset.assetId,
  kind: asset.kind,
  outputFiles: asset.outputFiles,
  metadata: asset.metadata,
});

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
  | "duplicate-frame";

export interface AssetManifestIssue {
  readonly severity: "error";
  readonly code: AssetManifestIssueCode;
  readonly path: string;
  readonly message: string;
}

const issue = (
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
  const roles = new Set<string>();
  for (let index = 0; index < asset.outputFiles.length; index += 1) {
    const output = asset.outputFiles[index];
    if (!output) {
      continue;
    }
    const outputPath = `${assetPath}.outputFiles[${index}]`;
    if (roles.has(output.role)) {
      issue(
        issues,
        "duplicate-output-role",
        `${outputPath}.role`,
        `Output role '${output.role}' is duplicated for asset '${asset.assetId}'.`,
      );
    }
    roles.add(output.role);

    const existing = runtimePaths.get(output.runtimePath);
    if (existing) {
      issue(
        issues,
        "duplicate-runtime-path",
        `${outputPath}.runtimePath`,
        `Runtime path '${output.runtimePath}' is already used at '${existing}'.`,
      );
    } else {
      runtimePaths.set(output.runtimePath, outputPath);
    }
  }

  if (asset.kind === "spritesheet") {
    if (!roles.has("atlas-manifest")) {
      issue(
        issues,
        "missing-output-role",
        `${assetPath}.outputFiles`,
        `Spritesheet '${asset.assetId}' requires an 'atlas-manifest' output.`,
      );
    }
    const frameIds = new Set<string>();
    for (let index = 0; index < asset.metadata.frames.length; index += 1) {
      const frame = asset.metadata.frames[index];
      if (!frame) {
        continue;
      }
      if (!roles.has(frame.pageOutputRole)) {
        issue(
          issues,
          "unknown-page-role",
          `${assetPath}.metadata.frames[${index}].pageOutputRole`,
          `Frame '${frame.frameId}' references missing output role '${frame.pageOutputRole}'.`,
        );
      }
      if (frameIds.has(frame.frameId)) {
        issue(
          issues,
          "duplicate-frame",
          `${assetPath}.metadata.frames[${index}].frameId`,
          `Frame '${frame.frameId}' is duplicated in spritesheet '${asset.assetId}'.`,
        );
      }
      frameIds.add(frame.frameId);
    }
    for (let index = 0; index < asset.metadata.pages.length; index += 1) {
      const page = asset.metadata.pages[index];
      if (page && !roles.has(page.outputRole)) {
        issue(
          issues,
          "unknown-page-role",
          `${assetPath}.metadata.pages[${index}].outputRole`,
          `Atlas page references missing output role '${page.outputRole}'.`,
        );
      }
    }
    return;
  }

  if (!roles.has("primary")) {
    issue(
      issues,
      "missing-output-role",
      `${assetPath}.outputFiles`,
      `Asset '${asset.assetId}' requires a 'primary' runtime output.`,
    );
  }
};

export const validateAssetBuildManifest = (
  project: AdventureProject,
  manifest: AssetBuildManifest,
): readonly AssetManifestIssue[] => {
  const issues: AssetManifestIssue[] = [];
  if (manifest.projectId !== project.id) {
    issue(
      issues,
      "project-mismatch",
      "projectId",
      `Asset manifest project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const authoredById = new Map(
    project.assets.map((asset) => [asset.id as string, asset]),
  );
  const compiledById = new Map<string, CompiledAssetRecord>();
  const runtimePaths = new Map<string, string>();

  manifest.assets.forEach((asset, index) => {
    const assetPath = `assets[${index}]`;
    if (compiledById.has(asset.assetId)) {
      issue(
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
      issue(
        issues,
        "unexpected-asset",
        `${assetPath}.assetId`,
        `Compiled asset '${asset.assetId}' is not declared by the project.`,
      );
    } else {
      if (authored.kind !== asset.kind) {
        issue(
          issues,
          "asset-kind-mismatch",
          `${assetPath}.kind`,
          `Compiled asset kind '${asset.kind}' does not match authored kind '${authored.kind}'.`,
        );
      }
      if (!asset.sourceFiles.some((source) => source.path === authored.path)) {
        issue(
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
      issue(
        issues,
        "missing-asset",
        `project.assets[${index}]`,
        `Authored asset '${asset.id}' has no compiled manifest record.`,
      );
    }
  });

  return issues;
};
