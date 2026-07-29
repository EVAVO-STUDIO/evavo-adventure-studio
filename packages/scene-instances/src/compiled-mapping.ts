import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { SceneInstanceManifest } from "./index.js";

export type CompiledObjectVisualIssueCode =
  | "missing-compiled-object-asset"
  | "invalid-compiled-object-asset-kind"
  | "missing-compiled-object-frame"
  | "compiled-object-frame-geometry-mismatch";

export interface CompiledObjectVisualIssue {
  readonly severity: "error";
  readonly code: CompiledObjectVisualIssueCode;
  readonly path: string;
  readonly message: string;
}

const issue = (
  issues: CompiledObjectVisualIssue[],
  code: CompiledObjectVisualIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const sameRectangle = (
  left: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  right: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const sameSize = (
  left: { readonly width: number; readonly height: number },
  right: { readonly width: number; readonly height: number },
): boolean => left.width === right.width && left.height === right.height;

const samePoint = (
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean => left.x === right.x && left.y === right.y;

export const validateCompiledObjectVisualMappings = (
  sceneInstances: SceneInstanceManifest,
  assetManifest: AssetBuildManifest,
): readonly CompiledObjectVisualIssue[] => {
  const issues: CompiledObjectVisualIssue[] = [];
  const assetsById = new Map(
    assetManifest.assets.map((asset) => [asset.assetId as string, asset]),
  );

  sceneInstances.objectDefinitions.forEach((definition, definitionIndex) => {
    definition.states.forEach((state, stateIndex) => {
      const visual = state.visual;
      if (!visual) {
        return;
      }
      const path = `objectDefinitions[${definitionIndex}].states[${stateIndex}].visual`;
      const asset = assetsById.get(visual.assetId);
      if (!asset) {
        issue(
          issues,
          "missing-compiled-object-asset",
          `${path}.assetId`,
          `Object state '${state.id}' has no compiled asset '${visual.assetId}'.`,
        );
        return;
      }

      if (visual.kind === "image") {
        if (asset.kind !== "image") {
          issue(
            issues,
            "invalid-compiled-object-asset-kind",
            `${path}.assetId`,
            `Object state '${state.id}' requires a compiled image asset.`,
          );
        }
        return;
      }

      if (asset.kind !== "spritesheet") {
        issue(
          issues,
          "invalid-compiled-object-asset-kind",
          `${path}.assetId`,
          `Object state '${state.id}' requires a compiled spritesheet asset.`,
        );
        return;
      }

      const compiledFrame = asset.metadata.frames.find(
        (frame) => frame.frameId === visual.frameId,
      );
      if (!compiledFrame) {
        issue(
          issues,
          "missing-compiled-object-frame",
          `${path}.frameId`,
          `Object state '${state.id}' frame '${visual.frameId}' is missing from '${asset.assetId}'.`,
        );
        return;
      }

      if (
        !sameRectangle(compiledFrame.sourceRect, visual.sourceRect) ||
        !sameSize(compiledFrame.originalSize, visual.sourceSize) ||
        !samePoint(compiledFrame.trimOffset, visual.trimOffset)
      ) {
        issue(
          issues,
          "compiled-object-frame-geometry-mismatch",
          path,
          `Object state '${state.id}' does not match compiled frame '${compiledFrame.frameId}'.`,
        );
      }
    });
  });

  return issues;
};
