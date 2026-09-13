import type { AdventureProject, Point, Rectangle, Size } from "@evavo/adventure-project-schema";
import type { AssetBuildManifest, CompiledAssetRecord } from "./index.js";

export type FrameAssetMappingIssueCode =
  | "missing-compiled-frame"
  | "compiled-frame-geometry-mismatch"
  | "compiled-image-frame-out-of-bounds"
  | "non-renderable-frame-asset";

export interface FrameAssetMappingIssue {
  readonly severity: "error";
  readonly code: FrameAssetMappingIssueCode;
  readonly path: string;
  readonly message: string;
}

const samePoint = (left: Point, right: Point): boolean => left.x === right.x && left.y === right.y;

const sameSize = (left: Size, right: Size): boolean =>
  left.width === right.width && left.height === right.height;

const sameRectangle = (left: Rectangle, right: Rectangle): boolean =>
  left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;

const compiledAssetsById = (manifest: AssetBuildManifest): ReadonlyMap<string, CompiledAssetRecord> =>
  new Map(manifest.assets.map((asset) => [asset.assetId as string, asset]));

export const validateCompiledFrameMappings = (
  project: AdventureProject,
  manifest: AssetBuildManifest,
): readonly FrameAssetMappingIssue[] => {
  const issues: FrameAssetMappingIssue[] = [];
  const compiledAssets = compiledAssetsById(manifest);

  project.actors.forEach((actor, actorIndex) => {
    actor.frames.forEach((frame, frameIndex) => {
      const framePath = `actors[${actorIndex}].frames[${frameIndex}]`;
      const compiledAsset = compiledAssets.get(frame.assetId);
      if (!compiledAsset) {
        return;
      }

      if (compiledAsset.kind === "spritesheet") {
        const compiledFrame = compiledAsset.metadata.frames.find(
          (candidate) => candidate.frameId === frame.id,
        );
        if (!compiledFrame) {
          issues.push({
            severity: "error",
            code: "missing-compiled-frame",
            path: `${framePath}.id`,
            message: `Authored frame '${frame.id}' is missing from compiled spritesheet '${frame.assetId}'.`,
          });
          return;
        }

        if (
          !sameRectangle(compiledFrame.sourceRect, frame.sourceRect) ||
          !sameSize(compiledFrame.originalSize, frame.sourceSize) ||
          !samePoint(compiledFrame.trimOffset, frame.trimOffset)
        ) {
          issues.push({
            severity: "error",
            code: "compiled-frame-geometry-mismatch",
            path: framePath,
            message: `Authored frame '${frame.id}' geometry does not match its compiled atlas record. Rebuild assets before compiling the game.`,
          });
        }
        return;
      }

      if (compiledAsset.kind === "image") {
        if (
          frame.sourceRect.x + frame.sourceRect.width > compiledAsset.metadata.width ||
          frame.sourceRect.y + frame.sourceRect.height > compiledAsset.metadata.height
        ) {
          issues.push({
            severity: "error",
            code: "compiled-image-frame-out-of-bounds",
            path: `${framePath}.sourceRect`,
            message: `Authored frame '${frame.id}' exceeds compiled image '${frame.assetId}'.`,
          });
        }
        return;
      }

      issues.push({
        severity: "error",
        code: "non-renderable-frame-asset",
        path: `${framePath}.assetId`,
        message: `Authored frame '${frame.id}' references non-renderable compiled asset '${frame.assetId}' of kind '${compiledAsset.kind}'.`,
      });
    });
  });

  return issues;
};
