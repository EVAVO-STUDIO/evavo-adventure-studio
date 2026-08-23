import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import { portablePathKey } from "@evavo/adventure-asset-contract/portable-path";
import type { CompiledProject } from "@evavo/adventure-compiler";
import { CliDataError, type CliDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { type AtomicDirectoryFile, withTrailingNewline } from "./filesystem.js";
import { canonicalStringify, sha256 } from "./hashing.js";
import type { IndexedRuntimeArtifact } from "./indexed-inputs.js";
import type { RuntimeOutputArtifact } from "./inputs.js";

export const BUNDLE_FILE_NAME = "game.bundle.json";
export const RELEASE_MANIFEST_FILE_NAME = "release.manifest.json";

const RESERVED_RELEASE_PATHS = new Set([BUNDLE_FILE_NAME, RELEASE_MANIFEST_FILE_NAME].map(portablePathKey));

const isReservedReleasePath = (runtimePath: string): boolean => {
  const firstSegment = runtimePath.split("/")[0] ?? "";
  return RESERVED_RELEASE_PATHS.has(portablePathKey(firstSegment));
};

export interface ReleaseBuild {
  readonly files: readonly AtomicDirectoryFile[];
  readonly fingerprint: string;
  readonly bundleData: Uint8Array;
  readonly manifestData: Uint8Array;
}

export const buildRelease = (
  compiled: CompiledProject,
  assetManifest: AssetBuildManifest,
  artifacts: readonly RuntimeOutputArtifact[],
  indexedArtifacts: readonly IndexedRuntimeArtifact[] = [],
): ReleaseBuild => {
  const diagnostics: CliDiagnostic[] = [];
  const releasePaths = new Map<string, string>();
  const registerPath = (runtimePath: string, logicalPath: string, source: CliDiagnostic["source"]): void => {
    if (isReservedReleasePath(runtimePath)) {
      diagnostics.push({
        severity: "error",
        source,
        code: "reserved-release-path",
        path: logicalPath,
        message: `Runtime path '${runtimePath}' conflicts with a reserved release file.`,
      });
    }
    const key = portablePathKey(runtimePath);
    const previous = releasePaths.get(key);
    if (previous) {
      diagnostics.push({
        severity: "error",
        source,
        code: "duplicate-release-path",
        path: logicalPath,
        message: `Runtime path '${runtimePath}' conflicts with '${previous}'.`,
      });
    } else {
      releasePaths.set(key, logicalPath);
    }
  };

  for (const artifact of artifacts) {
    registerPath(
      artifact.output.runtimePath,
      `${artifact.assetId}.output:${artifact.output.runtimePath}`,
      "asset-evidence",
    );
  }
  for (const artifact of indexedArtifacts) {
    registerPath(
      artifact.runtimePath,
      `${artifact.assetId}.index:${artifact.runtimePath}`,
      "indexed-assets-evidence",
    );
  }
  if (diagnostics.length > 0) {
    throw new CliDataError(sortDiagnostics(diagnostics));
  }

  const bundleData = new TextEncoder().encode(withTrailingNewline(compiled.canonicalJson));
  const ordinaryFiles = artifacts.map((artifact) => ({
    assetId: artifact.assetId,
    role: artifact.output.role,
    path: artifact.output.runtimePath,
    mediaType: artifact.output.mediaType,
    byteLength: artifact.data.byteLength,
    sha256: sha256(artifact.data),
  }));
  const indexedFiles = indexedArtifacts.map((artifact) => ({
    assetId: artifact.assetId,
    role: "index-map",
    path: artifact.runtimePath,
    mediaType: "application/octet-stream",
    byteLength: artifact.data.byteLength,
    sha256: sha256(artifact.data),
  }));
  const payload = {
    releaseVersion: 1 as const,
    projectId: compiled.bundle.projectId,
    bundle: {
      path: BUNDLE_FILE_NAME,
      byteLength: bundleData.byteLength,
      sha256: sha256(bundleData),
      fingerprint: compiled.fingerprint,
    },
    assetManifest: {
      fingerprint: assetManifest.fingerprint,
      compilerVersion: assetManifest.compilerVersion,
    },
    files: [...ordinaryFiles, ...indexedFiles].sort(
      (left, right) => left.path.localeCompare(right.path) || left.role.localeCompare(right.role),
    ),
  };
  const fingerprint = sha256(canonicalStringify(payload));
  const manifestData = new TextEncoder().encode(`${canonicalStringify({ ...payload, fingerprint })}\n`);
  const files: AtomicDirectoryFile[] = [
    ...artifacts.map((artifact) => ({
      relativePath: artifact.output.runtimePath,
      data: artifact.data,
    })),
    ...indexedArtifacts.map((artifact) => ({
      relativePath: artifact.runtimePath,
      data: artifact.data,
    })),
    { relativePath: BUNDLE_FILE_NAME, data: bundleData },
    { relativePath: RELEASE_MANIFEST_FILE_NAME, data: manifestData },
  ];

  return { files, fingerprint, bundleData, manifestData };
};
