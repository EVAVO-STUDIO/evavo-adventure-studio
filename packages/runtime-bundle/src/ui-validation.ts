import type { AdventureProject } from "@evavo/adventure-project-schema";
import { type UiSkinIssue, validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import {
  type UiSkinCompiledIssue,
  validateCompiledUiSkinMappings,
} from "@evavo/adventure-ui-skin/compiled-mapping";
import type { RuntimeBundle } from "./index.js";

export type RuntimeUiSkinIssue = UiSkinIssue | UiSkinCompiledIssue;

export class RuntimeUiSkinValidationError extends Error {
  readonly issues: readonly RuntimeUiSkinIssue[];

  constructor(issues: readonly RuntimeUiSkinIssue[]) {
    super(`Runtime interface skins contain ${issues.length} validation issue(s).`);
    this.name = "RuntimeUiSkinValidationError";
    this.issues = issues;
  }
}

const runtimeProjectView = (
  bundle: Pick<RuntimeBundle, "projectId" | "presentation" | "assets">,
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
  bundle: Pick<RuntimeBundle, "projectId" | "presentation" | "assets" | "bitmapFonts" | "uiSkins">,
): readonly RuntimeUiSkinIssue[] => {
  if (!bundle.uiSkins) return [];
  return [
    ...validateUiSkinManifest(runtimeProjectView(bundle), bundle.bitmapFonts ?? null, bundle.uiSkins),
    ...validateCompiledUiSkinMappings(bundle.uiSkins, bundle),
  ];
};
