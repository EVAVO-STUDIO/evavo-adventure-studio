import type { Id } from "@evavo/adventure-project-schema";
import {
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
  type NightShiftProductionAssetRequirement,
} from "./night-shift-production-assets.js";

export type NightShiftArtAlphaMode = "opaque" | "binary" | "full";

export interface NightShiftArtMasterObservation {
  readonly assetId: Id<"asset">;
  readonly width: number;
  readonly height: number;
  readonly paletteIndexed: boolean;
  readonly colourCount: number;
  readonly alphaMode: NightShiftArtAlphaMode;
  readonly sourceFormat: "png" | "aseprite" | "other";
}

export type NightShiftArtMasterIssueCode =
  | "unknown-asset"
  | "not-period-vga-asset"
  | "invalid-dimensions"
  | "exact-size-mismatch"
  | "oversized-art-directed-master"
  | "non-indexed-colour"
  | "colour-budget-exceeded"
  | "soft-alpha"
  | "opaque-required"
  | "binary-alpha-required"
  | "source-format-mismatch";

export interface NightShiftArtMasterIssue {
  readonly severity: "error";
  readonly code: NightShiftArtMasterIssueCode;
  readonly assetId: Id<"asset">;
  readonly message: string;
}

const requirementFor = (
  assetId: Id<"asset">,
): NightShiftProductionAssetRequirement | null =>
  nightShiftProductionAssets.find((asset) => asset.assetId === assetId) ?? null;

const issue = (
  assetId: Id<"asset">,
  code: NightShiftArtMasterIssueCode,
  message: string,
): NightShiftArtMasterIssue => ({ severity: "error", code, assetId, message });

const expectedSourceFormat = (
  requirement: NightShiftProductionAssetRequirement,
): NightShiftArtMasterObservation["sourceFormat"] | null => {
  if (requirement.sourcePath.endsWith(".aseprite")) return "aseprite";
  if (requirement.sourcePath.endsWith(".png")) return "png";
  return null;
};

export const validateNightShiftArtMaster = (
  observation: NightShiftArtMasterObservation,
): readonly NightShiftArtMasterIssue[] => {
  const requirement = requirementFor(observation.assetId);
  if (!requirement) {
    return [issue(observation.assetId, "unknown-asset", `Asset '${observation.assetId}' is not part of the Night Shift production plan.`)];
  }
  if (!requirement.evidence.includes("period-vga")) {
    return [issue(observation.assetId, "not-period-vga-asset", `Asset '${observation.assetId}' is not a final Period VGA visual master.`)];
  }

  const issues: NightShiftArtMasterIssue[] = [];
  if (
    !Number.isSafeInteger(observation.width) ||
    !Number.isSafeInteger(observation.height) ||
    observation.width <= 0 ||
    observation.height <= 0
  ) {
    issues.push(issue(observation.assetId, "invalid-dimensions", "Art master dimensions must be positive native integers."));
  }

  if (requirement.sizePolicy === "exact" && requirement.nativeSize) {
    if (
      observation.width !== requirement.nativeSize.width ||
      observation.height !== requirement.nativeSize.height
    ) {
      issues.push(
        issue(
          observation.assetId,
          "exact-size-mismatch",
          `Art master is ${observation.width}×${observation.height}; contract requires exactly ${requirement.nativeSize.width}×${requirement.nativeSize.height}.`,
        ),
      );
    }
  } else if (requirement.sizePolicy === "art-directed") {
    if (observation.width > 320 || observation.height > 200) {
      issues.push(
        issue(
          observation.assetId,
          "oversized-art-directed-master",
          `Foreground/overlay master is ${observation.width}×${observation.height}; native room plates must remain within the 320×200 scene canvas.`,
        ),
      );
    }
  }

  if (!observation.paletteIndexed) {
    issues.push(
      issue(
        observation.assetId,
        "non-indexed-colour",
        "Final Period VGA master must be palette-indexed; RGBA true-colour output is not accepted as the approved master.",
      ),
    );
  }
  if (!Number.isSafeInteger(observation.colourCount) || observation.colourCount < 1 || observation.colourCount > 256) {
    issues.push(
      issue(
        observation.assetId,
        "colour-budget-exceeded",
        `Final master reports ${observation.colourCount} colours; Period VGA output requires 1–256 indexed colours.`,
      ),
    );
  }
  if (observation.alphaMode === "full") {
    issues.push(
      issue(
        observation.assetId,
        "soft-alpha",
        "Soft alpha is not permitted in a Night Shift Period VGA master.",
      ),
    );
  }
  if (requirement.alpha === "opaque" && observation.alphaMode !== "opaque") {
    issues.push(
      issue(observation.assetId, "opaque-required", "This production asset must be fully opaque at native resolution."),
    );
  }
  if (requirement.alpha === "binary" && observation.alphaMode !== "binary") {
    issues.push(
      issue(
        observation.assetId,
        "binary-alpha-required",
        "This production asset requires binary transparency; neither opaque padding nor soft alpha is accepted.",
      ),
    );
  }

  const expectedFormat = expectedSourceFormat(requirement);
  if (expectedFormat && observation.sourceFormat !== expectedFormat) {
    issues.push(
      issue(
        observation.assetId,
        "source-format-mismatch",
        `Production source is '${observation.sourceFormat}'; contract path '${requirement.sourcePath}' requires '${expectedFormat}'.`,
      ),
    );
  }

  return issues.sort((left, right) => left.code.localeCompare(right.code));
};

export interface NightShiftArtIntakeReport {
  readonly status: "ready" | "blocked";
  readonly expectedMasters: number;
  readonly observedMasters: number;
  readonly missingAssetIds: readonly Id<"asset">[];
  readonly issues: readonly NightShiftArtMasterIssue[];
}

export const evaluateNightShiftArtMasterIntake = (
  observations: readonly NightShiftArtMasterObservation[],
): NightShiftArtIntakeReport => {
  const observedIds = new Set(observations.map((observation) => observation.assetId as string));
  const missingAssetIds = nightShiftPeriodVgaProductionAssetIds.filter(
    (assetId) => !observedIds.has(assetId),
  );
  const issues = observations.flatMap(validateNightShiftArtMaster);
  const status = missingAssetIds.length === 0 && issues.length === 0 ? "ready" : "blocked";
  return {
    status,
    expectedMasters: nightShiftPeriodVgaProductionAssetIds.length,
    observedMasters: observations.length,
    missingAssetIds,
    issues,
  };
};
