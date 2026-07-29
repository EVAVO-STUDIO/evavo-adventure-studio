import {
  assetBuildManifestSchema,
  compiledAssetRecordSchema,
  type AssetBuildManifest,
  type CompiledAssetRecord,
  type CompiledSourceFile,
} from "@evavo/adventure-asset-contract";
import type { Asset, Id } from "@evavo/adventure-project-schema";
import type { CompiledAtlas } from "./atlas-compiler.js";
import {
  canonicalStringify,
  sha256Hex,
  type CompiledImage,
} from "./index.js";

const assertAssetKind = <T extends Asset["kind"]>(
  asset: Asset,
  kind: T,
): asserts asset is Asset & { readonly kind: T } => {
  if (asset.kind !== kind) {
    throw new TypeError(
      `Asset '${asset.id}' has kind '${asset.kind}', expected '${kind}'.`,
    );
  }
};

export const createImageAssetRecord = (
  asset: Asset,
  compiled: CompiledImage,
  runtimePath: string,
): Extract<CompiledAssetRecord, { readonly kind: "image" }> => {
  assertAssetKind(asset, "image");
  if (compiled.manifest.assetId !== asset.id) {
    throw new Error(
      `Compiled image '${compiled.manifest.assetId}' does not match authored asset '${asset.id}'.`,
    );
  }

  return compiledAssetRecordSchema.parse({
    assetId: asset.id,
    kind: "image",
    sourceFiles: [
      {
        path: asset.path,
        sha256: compiled.manifest.source.sha256,
        byteLength: compiled.manifest.source.byteLength,
      },
    ],
    outputFiles: [
      {
        role: "primary",
        runtimePath,
        mediaType: "image/png",
        sha256: compiled.manifest.output.sha256,
        byteLength: compiled.manifest.output.byteLength,
      },
    ],
    metadata: {
      kind: "image",
      width: compiled.manifest.output.width,
      height: compiled.manifest.output.height,
      palette: compiled.manifest.output.palette,
      colourCount: compiled.manifest.output.colourCount,
    },
  }) as Extract<CompiledAssetRecord, { readonly kind: "image" }>;
};

export interface SpritesheetAssetRecordOptions {
  readonly sourceFiles: readonly CompiledSourceFile[];
  readonly runtimeDirectory: string;
  readonly manifestFileName?: string;
}

const joinRuntimePath = (directory: string, fileName: string): string => {
  const normalizedDirectory = directory.replace(/\/+$/g, "");
  return normalizedDirectory ? `${normalizedDirectory}/${fileName}` : fileName;
};

const pageRole = (index: number): string =>
  `page-${index.toString().padStart(3, "0")}`;

export const createSpritesheetAssetRecord = (
  asset: Asset,
  compiled: CompiledAtlas,
  options: SpritesheetAssetRecordOptions,
): Extract<CompiledAssetRecord, { readonly kind: "spritesheet" }> => {
  assertAssetKind(asset, "spritesheet");
  const manifestFileName =
    options.manifestFileName ?? `${asset.id}.atlas.json`;
  const manifestRuntimePath = joinRuntimePath(
    options.runtimeDirectory,
    manifestFileName,
  );

  return compiledAssetRecordSchema.parse({
    assetId: asset.id,
    kind: "spritesheet",
    sourceFiles: options.sourceFiles,
    outputFiles: [
      {
        role: "atlas-manifest",
        runtimePath: manifestRuntimePath,
        mediaType: "application/json",
        sha256: compiled.manifestSha256,
        byteLength: compiled.manifestData.byteLength,
      },
      ...compiled.pages.map((page) => ({
        role: pageRole(page.index),
        runtimePath: joinRuntimePath(options.runtimeDirectory, page.fileName),
        mediaType: "image/png",
        sha256: page.sha256,
        byteLength: page.data.byteLength,
      })),
    ],
    metadata: {
      kind: "spritesheet",
      pages: compiled.pages.map((page) => ({
        outputRole: pageRole(page.index),
        width: page.width,
        height: page.height,
      })),
      frames: compiled.manifest.frames.map((frame) => ({
        frameId: frame.frameId,
        pageOutputRole: pageRole(frame.pageIndex),
        sourceRect: frame.sourceRect,
        originalSize: frame.originalSize,
        trimOffset: frame.trimOffset,
        padding: frame.padding,
      })),
    },
  }) as Extract<CompiledAssetRecord, { readonly kind: "spritesheet" }>;
};

const sortSourceFiles = (
  files: readonly CompiledSourceFile[],
): readonly CompiledSourceFile[] =>
  [...files].sort((left, right) => left.path.localeCompare(right.path));

const sortOutputFiles = (
  files: CompiledAssetRecord["outputFiles"],
): CompiledAssetRecord["outputFiles"] =>
  [...files].sort((left, right) => {
    const roleDifference = left.role.localeCompare(right.role);
    return roleDifference !== 0
      ? roleDifference
      : left.runtimePath.localeCompare(right.runtimePath);
  });

const canonicalAssetRecord = (asset: CompiledAssetRecord): CompiledAssetRecord => {
  const sourceFiles = sortSourceFiles(asset.sourceFiles);
  const outputFiles = sortOutputFiles(asset.outputFiles);

  if (asset.kind === "spritesheet") {
    return {
      ...asset,
      sourceFiles,
      outputFiles,
      metadata: {
        ...asset.metadata,
        pages: [...asset.metadata.pages].sort((left, right) =>
          left.outputRole.localeCompare(right.outputRole),
        ),
        frames: [...asset.metadata.frames].sort((left, right) =>
          left.frameId.localeCompare(right.frameId),
        ),
      },
    };
  }

  return { ...asset, sourceFiles, outputFiles };
};

export const createAssetBuildManifest = async (
  projectId: Id<"project">,
  assets: readonly CompiledAssetRecord[],
  compilerVersion = "0.1.0",
): Promise<AssetBuildManifest> => {
  if (!compilerVersion.trim()) {
    throw new RangeError("Asset compiler version cannot be empty.");
  }

  const canonicalAssets = [...assets]
    .map(canonicalAssetRecord)
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  const payload = {
    manifestVersion: 1 as const,
    projectId,
    compilerVersion,
    assets: canonicalAssets,
  };
  const fingerprint = await sha256Hex(
    new TextEncoder().encode(canonicalStringify(payload)),
  );

  return assetBuildManifestSchema.parse({ ...payload, fingerprint });
};
