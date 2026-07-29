import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  validateUiSkinManifest,
  type UiSkinIssue,
} from "@evavo/adventure-ui-skin";
import type { RuntimeBundle } from "./index.js";

export class RuntimeUiSkinValidationError extends Error {
  readonly issues: readonly UiSkinIssue[];

  constructor(issues: readonly UiSkinIssue[]) {
    super(`Runtime interface skins contain ${issues.length} validation issue(s).`);
    this.name = "RuntimeUiSkinValidationError";
    this.issues = issues;
  }
}

const runtimeProjectView = (
  bundle: Pick<
    RuntimeBundle,
    "projectId" | "presentation" | "assets"
  >,
): Pick<AdventureProject, "id" | "presentation" | "assets"> => ({
  id: bundle.projectId,
  presentation: bundle.presentation,
  assets: bundle.assets.map((asset) => ({
    id: asset.assetId,
    kind: asset.kind,
    path: `runtime/${asset.assetId}`,
  })),
});

export const validateRuntimeUiSkins = (
  bundle: Pick<
    RuntimeBundle,
    "projectId" | "presentation" | "assets" | "bitmapFonts" | "uiSkins"
  >,
): readonly UiSkinIssue[] => {
  if (!bundle.uiSkins) return [];
  return validateUiSkinManifest(
    runtimeProjectView(bundle),
    bundle.bitmapFonts ?? null,
    bundle.uiSkins,
  );
};
