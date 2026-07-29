import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import type { UiSkinManifest } from "./index.js";

type CompiledUiAsset = AssetBuildManifest["assets"][number] | RuntimeAssetRecord;

export type UiSkinCompiledIssueCode =
  | "compiled-ui-icon-asset-missing"
  | "compiled-ui-icon-asset-kind"
  | "compiled-ui-icon-frame-required"
  | "compiled-ui-icon-frame-unexpected"
  | "compiled-ui-icon-frame-missing";

export interface UiSkinCompiledIssue {
  readonly severity: "error";
  readonly code: UiSkinCompiledIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: UiSkinCompiledIssue[],
  code: UiSkinCompiledIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateCompiledUiSkinMappings = (
  manifest: UiSkinManifest,
  compiled: Pick<AssetBuildManifest, "assets"> | { readonly assets: readonly RuntimeAssetRecord[] },
): readonly UiSkinCompiledIssue[] => {
  const issues: UiSkinCompiledIssue[] = [];
  const assets = new Map(
    compiled.assets.map((asset) => [asset.assetId as string, asset as CompiledUiAsset] as const),
  );

  manifest.skins.forEach((skin, skinIndex) => {
    skin.verbs.forEach((verb, verbIndex) => {
      if (!verb.iconAssetId) return;
      const path = `skins[${skinIndex}].verbs[${verbIndex}]`;
      const asset = assets.get(verb.iconAssetId);
      if (!asset) {
        addIssue(
          issues,
          "compiled-ui-icon-asset-missing",
          `${path}.iconAssetId`,
          `Compiled verb icon asset '${verb.iconAssetId}' is missing.`,
        );
        return;
      }
      if (asset.kind !== "image" && asset.kind !== "spritesheet") {
        addIssue(
          issues,
          "compiled-ui-icon-asset-kind",
          `${path}.iconAssetId`,
          `Compiled verb icon asset '${verb.iconAssetId}' is '${asset.kind}', not an image or spritesheet.`,
        );
        return;
      }
      if (asset.kind === "image") {
        if (verb.iconFrameId) {
          addIssue(
            issues,
            "compiled-ui-icon-frame-unexpected",
            `${path}.iconFrameId`,
            `Image verb icon '${verb.iconAssetId}' cannot declare frame '${verb.iconFrameId}'.`,
          );
        }
        return;
      }
      if (!verb.iconFrameId) {
        addIssue(
          issues,
          "compiled-ui-icon-frame-required",
          `${path}.iconFrameId`,
          `Spritesheet verb icon '${verb.iconAssetId}' requires an exact frame ID.`,
        );
        return;
      }
      if (
        !asset.metadata.frames.some(
          (frame) => frame.frameId === verb.iconFrameId,
        )
      ) {
        addIssue(
          issues,
          "compiled-ui-icon-frame-missing",
          `${path}.iconFrameId`,
          `Verb icon frame '${verb.iconFrameId}' is missing from '${verb.iconAssetId}'.`,
        );
      }
    });
  });

  return issues;
};
