import type { AssetBuildManifest } from "./index.js";

const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const WINDOWS_INVALID_CHARACTERS = /[<>:"|?*]/;

const containsWindowsControlCharacter = (value: string): boolean =>
  [...value].some((character) => character.charCodeAt(0) <= 0x1f);

export const portablePathKey = (relativePath: string): string =>
  relativePath.normalize("NFC").toLocaleLowerCase("en-US");

export const portableRelativePathError = (relativePath: string): string | null => {
  if (!relativePath) {
    return "Runtime path cannot be empty.";
  }
  if (relativePath.startsWith("/") || relativePath.startsWith("\\") || relativePath.includes("\\")) {
    return "Runtime paths must be relative and use forward slashes.";
  }

  for (const segment of relativePath.split("/")) {
    if (!segment || segment === "." || segment === "..") {
      return "Runtime paths cannot contain empty, current or parent segments.";
    }
    if (segment.endsWith(".") || segment.endsWith(" ")) {
      return `Path segment '${segment}' cannot end with a dot or space.`;
    }
    if (WINDOWS_INVALID_CHARACTERS.test(segment) || containsWindowsControlCharacter(segment)) {
      return `Path segment '${segment}' contains a character that is invalid on Windows.`;
    }
    if (WINDOWS_RESERVED_SEGMENT.test(segment)) {
      return `Path segment '${segment}' is reserved on Windows.`;
    }
  }

  return null;
};

export type PortableRuntimePathIssueCode = "non-portable-runtime-path" | "portable-runtime-path-collision";

export interface PortableRuntimePathIssue {
  readonly severity: "error";
  readonly code: PortableRuntimePathIssueCode;
  readonly path: string;
  readonly message: string;
}

export const validatePortableRuntimePaths = (
  manifest: AssetBuildManifest,
): readonly PortableRuntimePathIssue[] => {
  const issues: PortableRuntimePathIssue[] = [];
  const paths = new Map<string, { readonly path: string; readonly location: string }>();

  manifest.assets.forEach((asset, assetIndex) => {
    asset.outputFiles.forEach((output, outputIndex) => {
      const location = `assets[${assetIndex}].outputFiles[${outputIndex}].runtimePath`;
      const pathError = portableRelativePathError(output.runtimePath);
      if (pathError) {
        issues.push({
          severity: "error",
          code: "non-portable-runtime-path",
          path: location,
          message: `Runtime path '${output.runtimePath}' is not portable: ${pathError}`,
        });
      }

      const key = portablePathKey(output.runtimePath);
      const existing = paths.get(key);
      if (existing && existing.path !== output.runtimePath) {
        issues.push({
          severity: "error",
          code: "portable-runtime-path-collision",
          path: location,
          message: `Runtime path '${output.runtimePath}' collides with '${existing.path}' at '${existing.location}' on a case-insensitive filesystem.`,
        });
      } else if (!existing) {
        paths.set(key, { path: output.runtimePath, location });
      }
    });
  });

  return issues;
};
