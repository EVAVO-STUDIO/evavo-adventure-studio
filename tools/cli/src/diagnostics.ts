export interface CliDiagnostic {
  readonly severity: "error" | "warning";
  readonly source:
    | "cli"
    | "project-file"
    | "project-schema"
    | "project-semantics"
    | "asset-manifest-file"
    | "asset-manifest-schema"
    | "asset-manifest-semantics"
    | "scene-instances-file"
    | "scene-instances-schema"
    | "scene-instances-semantics"
    | "art-direction-file"
    | "art-direction-schema"
    | "art-direction-semantics"
    | "art-evidence-file"
    | "art-evidence-schema"
    | "art-evidence-semantics"
    | "bitmap-fonts-file"
    | "bitmap-fonts-schema"
    | "bitmap-fonts-semantics"
    | "ui-skins-file"
    | "ui-skins-schema"
    | "ui-skins-semantics"
    | "audio-mix-file"
    | "audio-mix-schema"
    | "audio-mix-semantics"
    | "localisation-file"
    | "localisation-schema"
    | "localisation-semantics"
    | "runtime-bundle-file"
    | "runtime-bundle-schema"
    | "runtime-bundle-semantics"
    | "save-game-file"
    | "save-game-schema"
    | "save-game-integrity"
    | "save-game-compatibility"
    | "replay-file"
    | "replay-schema"
    | "replay-integrity"
    | "replay-compatibility"
    | "asset-evidence";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export class CliDataError extends Error {
  readonly diagnostics: readonly CliDiagnostic[];

  constructor(diagnostics: readonly CliDiagnostic[]) {
    super(diagnostics[0]?.message ?? "Input validation failed.");
    this.name = "CliDataError";
    this.diagnostics = diagnostics;
  }
}

export const errorCode = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { readonly code: unknown }).code)
    : null;

export const sortDiagnostics = (
  diagnostics: readonly CliDiagnostic[],
): readonly CliDiagnostic[] =>
  [...diagnostics].sort((left, right) => {
    const severityDifference = left.severity.localeCompare(right.severity);
    if (severityDifference !== 0) {
      return severityDifference;
    }
    const sourceDifference = left.source.localeCompare(right.source);
    if (sourceDifference !== 0) {
      return sourceDifference;
    }
    const pathDifference = left.path.localeCompare(right.path);
    return pathDifference !== 0
      ? pathDifference
      : left.code.localeCompare(right.code);
  });

export const hasErrors = (
  diagnostics: readonly CliDiagnostic[],
): boolean => diagnostics.some((diagnostic) => diagnostic.severity === "error");

export const formatDiagnostic = (diagnostic: CliDiagnostic): string =>
  `${diagnostic.severity.toUpperCase()} ${diagnostic.source}:${
    diagnostic.code
  } ${diagnostic.path} — ${diagnostic.message}`;