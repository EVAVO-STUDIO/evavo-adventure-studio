import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import { type SceneInstanceIssue, validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type { RuntimeBundle } from "./index.js";

export type RuntimeSceneInstanceIssueCode =
  | SceneInstanceIssue["code"]
  | "runtime-object-visual-asset-missing"
  | "runtime-object-visual-kind-mismatch"
  | "runtime-object-frame-missing"
  | "runtime-object-frame-geometry-mismatch";

export interface RuntimeSceneInstanceIssue {
  readonly severity: "error";
  readonly code: RuntimeSceneInstanceIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: RuntimeSceneInstanceIssue[],
  code: RuntimeSceneInstanceIssueCode,
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
  left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;

const sameSize = (
  left: { readonly width: number; readonly height: number },
  right: { readonly width: number; readonly height: number },
): boolean => left.width === right.width && left.height === right.height;

const samePoint = (
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): boolean => left.x === right.x && left.y === right.y;

const runtimeAssetsById = (assets: readonly RuntimeAssetRecord[]): ReadonlyMap<string, RuntimeAssetRecord> =>
  new Map(assets.map((asset) => [asset.assetId as string, asset] as const));

export const validateRuntimeSceneInstances = (
  bundle: RuntimeBundle,
): readonly RuntimeSceneInstanceIssue[] => {
  const sceneInstances = bundle.sceneInstances;
  if (!sceneInstances) {
    return [];
  }

  const issues: RuntimeSceneInstanceIssue[] = [
    ...validateSceneInstanceManifest(
      {
        projectId: bundle.projectId,
        scenes: bundle.scenes,
        actors: bundle.actors,
        assets: bundle.assets.map((asset) => ({
          id: asset.assetId,
          kind: asset.kind,
        })),
        inventoryItems: bundle.inventoryItems,
        dialogues: bundle.dialogues,
        sequences: bundle.sequences,
      },
      sceneInstances,
    ),
  ];
  const assetsById = runtimeAssetsById(bundle.assets);

  sceneInstances.objectDefinitions.forEach((definition, definitionIndex) => {
    definition.states.forEach((state, stateIndex) => {
      const visual = state.visual;
      if (!visual) {
        return;
      }
      const path = `sceneInstances.objectDefinitions[${definitionIndex}].states[${stateIndex}].visual`;
      const asset = assetsById.get(visual.assetId);
      if (!asset) {
        addIssue(
          issues,
          "runtime-object-visual-asset-missing",
          `${path}.assetId`,
          `Object state '${state.id}' references missing runtime asset '${visual.assetId}'.`,
        );
        return;
      }

      if (visual.kind === "image") {
        if (asset.kind !== "image") {
          addIssue(
            issues,
            "runtime-object-visual-kind-mismatch",
            `${path}.assetId`,
            `Object state '${state.id}' requires a runtime image asset.`,
          );
        }
        return;
      }

      if (asset.kind !== "spritesheet") {
        addIssue(
          issues,
          "runtime-object-visual-kind-mismatch",
          `${path}.assetId`,
          `Object state '${state.id}' requires a runtime spritesheet asset.`,
        );
        return;
      }

      const compiledFrame = asset.metadata.frames.find((frame) => frame.frameId === visual.frameId);
      if (!compiledFrame) {
        addIssue(
          issues,
          "runtime-object-frame-missing",
          `${path}.frameId`,
          `Object frame '${visual.frameId}' is missing from runtime asset '${asset.assetId}'.`,
        );
        return;
      }

      if (
        !sameRectangle(compiledFrame.sourceRect, visual.sourceRect) ||
        !sameSize(compiledFrame.originalSize, visual.sourceSize) ||
        !samePoint(compiledFrame.trimOffset, visual.trimOffset)
      ) {
        addIssue(
          issues,
          "runtime-object-frame-geometry-mismatch",
          path,
          `Object frame '${visual.frameId}' does not match runtime atlas geometry.`,
        );
      }
    });
  });

  return issues;
};

export class RuntimeSceneInstanceValidationError extends Error {
  readonly issues: readonly RuntimeSceneInstanceIssue[];

  constructor(issues: readonly RuntimeSceneInstanceIssue[]) {
    super(`Runtime bundle contains ${issues.length} scene instance issue(s).`);
    this.name = "RuntimeSceneInstanceValidationError";
    this.issues = issues;
  }
}
