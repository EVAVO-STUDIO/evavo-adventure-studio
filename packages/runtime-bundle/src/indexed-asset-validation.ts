import type { RuntimeBundle } from "./index.js";

export type RuntimeIndexedAssetIssueCode =
  | "missing-source-asset"
  | "invalid-source-asset-kind"
  | "missing-palette-asset"
  | "invalid-palette-asset-kind"
  | "palette-offset-overflow"
  | "duplicate-runtime-path";

export interface RuntimeIndexedAssetIssue {
  readonly severity: "error";
  readonly code: RuntimeIndexedAssetIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: RuntimeIndexedAssetIssue[],
  code: RuntimeIndexedAssetIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateRuntimeIndexedAssets = (
  bundle: RuntimeBundle,
): readonly RuntimeIndexedAssetIssue[] => {
  const issues: RuntimeIndexedAssetIssue[] = [];
  const assetsById = new Map(bundle.assets.map((asset) => [asset.assetId as string, asset] as const));
  const ordinaryPaths = new Set(
    bundle.assets.flatMap((asset) => asset.outputFiles.map((output) => output.runtimePath)),
  );
  const indexedPaths = new Set<string>();

  bundle.indexedAssets?.assets.forEach((record, recordIndex) => {
    const path = `indexedAssets.assets[${recordIndex}]`;
    const source = assetsById.get(record.assetId);
    if (!source) {
      addIssue(
        issues,
        "missing-source-asset",
        `${path}.assetId`,
        `Indexed asset '${record.assetId}' has no runtime source asset.`,
      );
    } else if (source.kind !== "image" && source.kind !== "spritesheet") {
      addIssue(
        issues,
        "invalid-source-asset-kind",
        `${path}.assetId`,
        `Indexed asset '${record.assetId}' decorates '${source.kind}', expected image or spritesheet.`,
      );
    }

    const palette = assetsById.get(record.defaultPalette.paletteAssetId);
    if (!palette) {
      addIssue(
        issues,
        "missing-palette-asset",
        `${path}.defaultPalette.paletteAssetId`,
        `Indexed asset '${record.assetId}' references missing palette '${record.defaultPalette.paletteAssetId}'.`,
      );
    } else if (palette.kind !== "palette") {
      addIssue(
        issues,
        "invalid-palette-asset-kind",
        `${path}.defaultPalette.paletteAssetId`,
        `Indexed asset '${record.assetId}' references '${palette.kind}', expected a palette asset.`,
      );
    } else {
      const resolvedMaximum =
        record.maximumSourceIndex === undefined
          ? null
          : record.maximumSourceIndex + record.defaultPalette.paletteOffset;
      if (
        (resolvedMaximum !== null && resolvedMaximum >= palette.metadata.entries) ||
        (resolvedMaximum === null && record.defaultPalette.paletteOffset >= palette.metadata.entries)
      ) {
        addIssue(
          issues,
          "palette-offset-overflow",
          `${path}.defaultPalette.paletteOffset`,
          resolvedMaximum === null
            ? `Indexed asset '${record.assetId}' palette offset ${record.defaultPalette.paletteOffset} is outside palette '${palette.assetId}'.`
            : `Indexed asset '${record.assetId}' maximum source index ${record.maximumSourceIndex} plus offset ${record.defaultPalette.paletteOffset} resolves to ${resolvedMaximum}; palette '${palette.assetId}' has ${palette.metadata.entries} entries.`,
        );
      }
    }

    if (ordinaryPaths.has(record.indexRuntimePath) || indexedPaths.has(record.indexRuntimePath)) {
      addIssue(
        issues,
        "duplicate-runtime-path",
        `${path}.indexRuntimePath`,
        `Indexed runtime path '${record.indexRuntimePath}' conflicts with another runtime file.`,
      );
    }
    indexedPaths.add(record.indexRuntimePath);
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeIndexedAssetValidationError extends Error {
  readonly issues: readonly RuntimeIndexedAssetIssue[];

  constructor(issues: readonly RuntimeIndexedAssetIssue[]) {
    super(`Runtime bundle contains ${issues.length} indexed-asset issue(s).`);
    this.name = "RuntimeIndexedAssetValidationError";
    this.issues = issues;
  }
}
