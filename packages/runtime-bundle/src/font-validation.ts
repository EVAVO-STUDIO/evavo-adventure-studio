import {
  validateBitmapFontManifest,
  type BitmapFontIssue,
} from "@evavo/adventure-bitmap-font";
import {
  validateCompiledBitmapFontMappings,
  type BitmapFontCompiledIssue,
} from "@evavo/adventure-bitmap-font/compiled-mapping";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "./index.js";

export type RuntimeBitmapFontIssue =
  | BitmapFontIssue
  | BitmapFontCompiledIssue;

export class RuntimeBitmapFontValidationError extends Error {
  readonly issues: readonly RuntimeBitmapFontIssue[];

  constructor(issues: readonly RuntimeBitmapFontIssue[]) {
    super(`Runtime bitmap fonts contain ${issues.length} validation issue(s).`);
    this.name = "RuntimeBitmapFontValidationError";
    this.issues = issues;
  }
}

const runtimeAssetView = (
  bundle: Pick<RuntimeBundle, "projectId" | "assets">,
): Pick<AdventureProject, "id" | "assets"> => ({
  id: bundle.projectId,
  assets: bundle.assets.map((asset) => ({
    id: asset.assetId,
    kind: asset.kind,
    path: `runtime/${asset.assetId}`,
  })),
});

export const validateRuntimeBitmapFonts = (
  bundle: Pick<RuntimeBundle, "projectId" | "assets" | "bitmapFonts">,
): readonly RuntimeBitmapFontIssue[] => {
  if (!bundle.bitmapFonts) {
    return [];
  }
  return [
    ...validateBitmapFontManifest(runtimeAssetView(bundle), bundle.bitmapFonts),
    ...validateCompiledBitmapFontMappings(bundle.bitmapFonts, {
      assets: bundle.assets,
    }),
  ];
};
