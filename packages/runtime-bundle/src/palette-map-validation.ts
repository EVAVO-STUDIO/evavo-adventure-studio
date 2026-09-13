import type { RuntimeBundle } from "./index.js";

export type RuntimePaletteMapIssueCode =
  | "missing-palette-asset"
  | "invalid-palette-asset-kind"
  | "missing-palette-primary-output"
  | "palette-offset-overflow"
  | "missing-palette-map";

export interface RuntimePaletteMapIssue {
  readonly severity: "error";
  readonly code: RuntimePaletteMapIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: RuntimePaletteMapIssue[],
  code: RuntimePaletteMapIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateRuntimePaletteMaps = (
  bundle: RuntimeBundle,
): readonly RuntimePaletteMapIssue[] => {
  const issues: RuntimePaletteMapIssue[] = [];
  const assetsById = new Map(bundle.assets.map((asset) => [asset.assetId as string, asset] as const));
  const mapIds = new Set(bundle.paletteMaps?.maps.map((map) => map.id) ?? []);

  bundle.paletteMaps?.maps.forEach((map, mapIndex) => {
    const path = `paletteMaps.maps[${mapIndex}]`;
    const palette = assetsById.get(map.paletteAssetId);
    if (!palette) {
      addIssue(
        issues,
        "missing-palette-asset",
        `${path}.paletteAssetId`,
        `Palette map '${map.id}' references missing runtime asset '${map.paletteAssetId}'.`,
      );
      return;
    }
    if (palette.kind !== "palette") {
      addIssue(
        issues,
        "invalid-palette-asset-kind",
        `${path}.paletteAssetId`,
        `Palette map '${map.id}' references '${palette.kind}', expected a palette asset.`,
      );
      return;
    }
    if (!palette.outputFiles.some((output) => output.role === "primary")) {
      addIssue(
        issues,
        "missing-palette-primary-output",
        `${path}.paletteAssetId`,
        `Palette '${palette.assetId}' has no primary runtime output.`,
      );
    }
    if (map.paletteOffset >= palette.metadata.entries) {
      addIssue(
        issues,
        "palette-offset-overflow",
        `${path}.paletteOffset`,
        `Palette map '${map.id}' offset ${map.paletteOffset} is outside palette '${palette.assetId}' entry range 0–${palette.metadata.entries - 1}.`,
      );
    }
  });

  bundle.sceneStaging?.scenes.forEach((scene, sceneIndex) => {
    scene.paletteLightZones.forEach((zone, zoneIndex) => {
      if (mapIds.has(zone.paletteMapId)) return;
      addIssue(
        issues,
        "missing-palette-map",
        `sceneStaging.scenes[${sceneIndex}].paletteLightZones[${zoneIndex}].paletteMapId`,
        `Palette light zone '${zone.id}' references unknown map '${zone.paletteMapId}'.`,
      );
    });
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimePaletteMapValidationError extends Error {
  readonly issues: readonly RuntimePaletteMapIssue[];

  constructor(issues: readonly RuntimePaletteMapIssue[]) {
    super(`Runtime bundle contains ${issues.length} palette-map issue(s).`);
    this.name = "RuntimePaletteMapValidationError";
    this.issues = issues;
  }
}
