import type { Id } from "@evavo/adventure-project-schema";

export interface NightShiftScenePaletteObservation {
  readonly assetId: Id<"asset">;
  readonly sourceFormat: "palette" | "other";
  readonly derivedFromAssetId: Id<"asset">;
  readonly entryCount: number;
  readonly rgbaByteLength: number;
  readonly opaqueEntries: boolean;
}

export type NightShiftScenePaletteIssueCode =
  | "unknown-scene-palette"
  | "source-format-mismatch"
  | "background-mismatch"
  | "entry-count-invalid"
  | "byte-length-mismatch"
  | "non-opaque-entry";

export interface NightShiftScenePaletteIssue {
  readonly severity: "error";
  readonly code: NightShiftScenePaletteIssueCode;
  readonly assetId: Id<"asset">;
  readonly message: string;
}

const sourceBackgroundByPalette = new Map<string, string>([
  ["asset.palette.night-shift.station", "asset.night-shift.background.station"],
  ["asset.palette.night-shift.roadside", "asset.night-shift.background.roadside"],
  ["asset.palette.night-shift.diner", "asset.night-shift.background.diner"],
]);

const add = (
  issues: NightShiftScenePaletteIssue[],
  observation: NightShiftScenePaletteObservation,
  code: NightShiftScenePaletteIssueCode,
  message: string,
): void => {
  issues.push({ severity: "error", code, assetId: observation.assetId, message });
};

export const validateNightShiftScenePalette = (
  observation: NightShiftScenePaletteObservation,
): readonly NightShiftScenePaletteIssue[] => {
  const issues: NightShiftScenePaletteIssue[] = [];
  const expectedBackground = sourceBackgroundByPalette.get(observation.assetId);
  if (!expectedBackground) {
    add(
      issues,
      observation,
      "unknown-scene-palette",
      `Palette '${observation.assetId}' is not a Night Shift Station/Roadside/Diner scene palette.`,
    );
    return issues;
  }
  if (observation.sourceFormat !== "palette") {
    add(
      issues,
      observation,
      "source-format-mismatch",
      "Scene palette master must remain an authored palette-table source rather than a screenshot or true-colour image.",
    );
  }
  if (observation.derivedFromAssetId !== expectedBackground) {
    add(
      issues,
      observation,
      "background-mismatch",
      `Palette '${observation.assetId}' must be locked from '${expectedBackground}', not '${observation.derivedFromAssetId}'.`,
    );
  }
  if (
    !Number.isSafeInteger(observation.entryCount) ||
    observation.entryCount < 1 ||
    observation.entryCount > 256
  ) {
    add(
      issues,
      observation,
      "entry-count-invalid",
      `Scene palette reports ${observation.entryCount} entries; VGA runtime palettes require 1–256 entries.`,
    );
  }
  if (observation.rgbaByteLength !== observation.entryCount * 4) {
    add(
      issues,
      observation,
      "byte-length-mismatch",
      `Scene palette has ${observation.rgbaByteLength} RGBA bytes; expected ${observation.entryCount * 4}.`,
    );
  }
  if (!observation.opaqueEntries) {
    add(
      issues,
      observation,
      "non-opaque-entry",
      "Scene palette tables must use opaque RGBA entries; sprite/object transparency is represented by the index sidecar transparentIndex.",
    );
  }
  return issues.sort((left, right) => left.code.localeCompare(right.code));
};

export const nightShiftScenePaletteSourceBackground = (
  paletteAssetId: Id<"asset"> | string,
): Id<"asset"> | null =>
  (sourceBackgroundByPalette.get(paletteAssetId as string) as Id<"asset"> | undefined) ?? null;
