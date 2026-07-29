import {
  portablePathKey,
  portableRelativePathError,
} from "@evavo/adventure-asset-contract/portable-path";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract/runtime-asset";
import type { RuntimeBundle } from "./index.js";

export type RuntimeBundleIssueCode =
  | "duplicate-runtime-id"
  | "duplicate-runtime-path"
  | "non-portable-runtime-path"
  | "duplicate-output-role"
  | "missing-primary-output"
  | "missing-atlas-manifest-output"
  | "missing-atlas-page-output"
  | "duplicate-atlas-page-role"
  | "duplicate-runtime-frame"
  | "runtime-frame-out-of-bounds"
  | "invalid-runtime-frame-geometry"
  | "missing-start-scene"
  | "missing-start-entrance"
  | "missing-runtime-asset"
  | "invalid-background-asset-kind"
  | "background-asset-too-small"
  | "invalid-occluder-asset-kind"
  | "invalid-inventory-icon-kind"
  | "missing-runtime-frame"
  | "runtime-frame-geometry-mismatch"
  | "image-frame-out-of-bounds"
  | "missing-animation-frame"
  | "missing-dialogue-start-node"
  | "missing-dialogue-node"
  | "invalid-dialogue-node-index"
  | "invalid-sequence-cue-count";

export interface RuntimeBundleIssue {
  readonly severity: "error";
  readonly code: RuntimeBundleIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: RuntimeBundleIssue[],
  code: RuntimeBundleIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const registerId = (
  ids: Map<string, string>,
  issues: RuntimeBundleIssue[],
  id: string,
  path: string,
): void => {
  const existing = ids.get(id);
  if (existing) {
    addIssue(
      issues,
      "duplicate-runtime-id",
      path,
      `Runtime ID '${id}' is already declared at '${existing}'.`,
    );
  } else {
    ids.set(id, path);
  }
};

const runtimeAssetsById = (
  assets: readonly RuntimeAssetRecord[],
): ReadonlyMap<string, RuntimeAssetRecord> =>
  new Map(assets.map((asset) => [asset.assetId as string, asset] as const));

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

const validateRuntimeAssets = (
  bundle: RuntimeBundle,
  issues: RuntimeBundleIssue[],
): void => {
  const paths = new Map<
    string,
    { readonly path: string; readonly location: string }
  >();

  bundle.assets.forEach((asset, assetIndex) => {
    const assetPath = `assets[${assetIndex}]`;
    const outputRoles = new Set<string>();

    asset.outputFiles.forEach((output, outputIndex) => {
      const outputPath = `${assetPath}.outputFiles[${outputIndex}]`;
      if (outputRoles.has(output.role)) {
        addIssue(
          issues,
          "duplicate-output-role",
          `${outputPath}.role`,
          `Runtime asset '${asset.assetId}' duplicates output role '${output.role}'.`,
        );
      }
      outputRoles.add(output.role);

      const pathError = portableRelativePathError(output.runtimePath);
      if (pathError) {
        addIssue(
          issues,
          "non-portable-runtime-path",
          `${outputPath}.runtimePath`,
          `Runtime path '${output.runtimePath}' is not portable: ${pathError}`,
        );
      }

      const key = portablePathKey(output.runtimePath);
      const existing = paths.get(key);
      if (existing) {
        addIssue(
          issues,
          "duplicate-runtime-path",
          `${outputPath}.runtimePath`,
          `Runtime path '${output.runtimePath}' collides with '${existing.path}' at '${existing.location}'.`,
        );
      } else {
        paths.set(key, {
          path: output.runtimePath,
          location: `${outputPath}.runtimePath`,
        });
      }
    });

    if (asset.kind !== "spritesheet") {
      if (!outputRoles.has("primary")) {
        addIssue(
          issues,
          "missing-primary-output",
          `${assetPath}.outputFiles`,
          `Runtime asset '${asset.assetId}' requires a primary output.`,
        );
      }
      return;
    }

    if (!outputRoles.has("atlas-manifest")) {
      addIssue(
        issues,
        "missing-atlas-manifest-output",
        `${assetPath}.outputFiles`,
        `Runtime spritesheet '${asset.assetId}' requires an atlas-manifest output.`,
      );
    }

    const pageRoles = new Set<string>();
    const pageByRole = new Map(
      asset.metadata.pages.map((page) => [page.outputRole, page] as const),
    );
    asset.metadata.pages.forEach((page, pageIndex) => {
      const pagePath = `${assetPath}.metadata.pages[${pageIndex}]`;
      if (pageRoles.has(page.outputRole)) {
        addIssue(
          issues,
          "duplicate-atlas-page-role",
          `${pagePath}.outputRole`,
          `Runtime spritesheet '${asset.assetId}' duplicates page role '${page.outputRole}'.`,
        );
      }
      pageRoles.add(page.outputRole);
      if (!outputRoles.has(page.outputRole)) {
        addIssue(
          issues,
          "missing-atlas-page-output",
          `${pagePath}.outputRole`,
          `Runtime atlas page role '${page.outputRole}' has no output file.`,
        );
      }
    });

    const frameIds = new Set<string>();
    asset.metadata.frames.forEach((frame, frameIndex) => {
      const framePath = `${assetPath}.metadata.frames[${frameIndex}]`;
      if (frameIds.has(frame.frameId)) {
        addIssue(
          issues,
          "duplicate-runtime-frame",
          `${framePath}.frameId`,
          `Runtime spritesheet '${asset.assetId}' duplicates frame '${frame.frameId}'.`,
        );
      }
      frameIds.add(frame.frameId);

      const page = pageByRole.get(frame.pageOutputRole);
      if (!page) {
        addIssue(
          issues,
          "missing-atlas-page-output",
          `${framePath}.pageOutputRole`,
          `Runtime frame '${frame.frameId}' references unknown page role '${frame.pageOutputRole}'.`,
        );
      } else if (
        frame.sourceRect.x + frame.sourceRect.width > page.width ||
        frame.sourceRect.y + frame.sourceRect.height > page.height
      ) {
        addIssue(
          issues,
          "runtime-frame-out-of-bounds",
          `${framePath}.sourceRect`,
          `Runtime frame '${frame.frameId}' exceeds atlas page '${frame.pageOutputRole}'.`,
        );
      }

      if (
        frame.trimOffset.x + frame.sourceRect.width >
          frame.originalSize.width ||
        frame.trimOffset.y + frame.sourceRect.height >
          frame.originalSize.height
      ) {
        addIssue(
          issues,
          "invalid-runtime-frame-geometry",
          framePath,
          `Runtime frame '${frame.frameId}' does not fit its original dimensions.`,
        );
      }
    });
  });
};

const validateActorFrames = (
  bundle: RuntimeBundle,
  assetsById: ReadonlyMap<string, RuntimeAssetRecord>,
  issues: RuntimeBundleIssue[],
  ids: Map<string, string>,
): void => {
  bundle.actors.forEach((actor, actorIndex) => {
    const actorPath = `actors[${actorIndex}]`;
    registerId(ids, issues, actor.id, `${actorPath}.id`);
    const frameIds = new Set<string>();

    actor.frames.forEach((frame, frameIndex) => {
      const framePath = `${actorPath}.frames[${frameIndex}]`;
      registerId(ids, issues, frame.id, `${framePath}.id`);
      frameIds.add(frame.id);
      const asset = assetsById.get(frame.assetId);
      if (!asset) {
        addIssue(
          issues,
          "missing-runtime-asset",
          `${framePath}.assetId`,
          `Frame '${frame.id}' references missing runtime asset '${frame.assetId}'.`,
        );
        return;
      }

      if (asset.kind === "spritesheet") {
        const compiledFrame = asset.metadata.frames.find(
          (candidate) => candidate.frameId === frame.id,
        );
        if (!compiledFrame) {
          addIssue(
            issues,
            "missing-runtime-frame",
            `${framePath}.id`,
            `Frame '${frame.id}' is missing from runtime spritesheet '${frame.assetId}'.`,
          );
        } else if (
          !sameRectangle(compiledFrame.sourceRect, frame.sourceRect) ||
          !sameSize(compiledFrame.originalSize, frame.sourceSize) ||
          !samePoint(compiledFrame.trimOffset, frame.trimOffset)
        ) {
          addIssue(
            issues,
            "runtime-frame-geometry-mismatch",
            framePath,
            `Frame '${frame.id}' does not match runtime atlas geometry.`,
          );
        }
      } else if (asset.kind === "image") {
        if (
          frame.sourceRect.x + frame.sourceRect.width > asset.metadata.width ||
          frame.sourceRect.y + frame.sourceRect.height > asset.metadata.height
        ) {
          addIssue(
            issues,
            "image-frame-out-of-bounds",
            `${framePath}.sourceRect`,
            `Frame '${frame.id}' exceeds runtime image '${frame.assetId}'.`,
          );
        }
      } else {
        addIssue(
          issues,
          "missing-runtime-frame",
          `${framePath}.assetId`,
          `Frame '${frame.id}' references non-renderable runtime asset '${frame.assetId}'.`,
        );
      }
    });

    actor.animations.forEach((animation, animationIndex) => {
      const animationPath = `${actorPath}.animations[${animationIndex}]`;
      registerId(ids, issues, animation.id, `${animationPath}.id`);
      animation.frameIds.forEach((frameId, frameIndex) => {
        if (!frameIds.has(frameId)) {
          addIssue(
            issues,
            "missing-animation-frame",
            `${animationPath}.frameIds[${frameIndex}]`,
            `Animation '${animation.id}' references missing actor frame '${frameId}'.`,
          );
        }
      });
    });
  });
};

const validateDialogues = (
  bundle: RuntimeBundle,
  issues: RuntimeBundleIssue[],
  ids: Map<string, string>,
): void => {
  bundle.dialogues.forEach((dialogue, dialogueIndex) => {
    const dialoguePath = `dialogues[${dialogueIndex}]`;
    registerId(ids, issues, dialogue.id, `${dialoguePath}.id`);
    const nodeIds = new Set(dialogue.nodes.map((node) => node.id as string));
    if (!nodeIds.has(dialogue.startNodeId)) {
      addIssue(
        issues,
        "missing-dialogue-start-node",
        `${dialoguePath}.startNodeId`,
        `Dialogue '${dialogue.id}' start node '${dialogue.startNodeId}' is missing.`,
      );
    }

    dialogue.nodes.forEach((node, nodeIndex) => {
      const nodePath = `${dialoguePath}.nodes[${nodeIndex}]`;
      registerId(ids, issues, node.id, `${nodePath}.id`);
      if (dialogue.nodeIndex[node.id] !== nodeIndex) {
        addIssue(
          issues,
          "invalid-dialogue-node-index",
          `${dialoguePath}.nodeIndex`,
          `Dialogue '${dialogue.id}' node index does not map '${node.id}' to ${nodeIndex}.`,
        );
      }
      if (node.autoNextNodeId && !nodeIds.has(node.autoNextNodeId)) {
        addIssue(
          issues,
          "missing-dialogue-node",
          `${nodePath}.autoNextNodeId`,
          `Dialogue node '${node.id}' references missing node '${node.autoNextNodeId}'.`,
        );
      }
      node.choices.forEach((choice, choiceIndex) => {
        registerId(
          ids,
          issues,
          choice.id,
          `${nodePath}.choices[${choiceIndex}].id`,
        );
        if (choice.nextNodeId && !nodeIds.has(choice.nextNodeId)) {
          addIssue(
            issues,
            "missing-dialogue-node",
            `${nodePath}.choices[${choiceIndex}].nextNodeId`,
            `Dialogue choice '${choice.id}' references missing node '${choice.nextNodeId}'.`,
          );
        }
      });
    });

    for (const indexedNodeId of Object.keys(dialogue.nodeIndex)) {
      if (!nodeIds.has(indexedNodeId)) {
        addIssue(
          issues,
          "invalid-dialogue-node-index",
          `${dialoguePath}.nodeIndex.${indexedNodeId}`,
          `Dialogue node index contains unknown node '${indexedNodeId}'.`,
        );
      }
    }
  });
};

export const validateRuntimeBundleSemantics = (
  bundle: RuntimeBundle,
): readonly RuntimeBundleIssue[] => {
  const issues: RuntimeBundleIssue[] = [];
  const ids = new Map<string, string>();
  const assetsById = runtimeAssetsById(bundle.assets);

  registerId(ids, issues, bundle.projectId, "projectId");
  bundle.assets.forEach((asset, assetIndex) =>
    registerId(ids, issues, asset.assetId, `assets[${assetIndex}].assetId`),
  );
  validateRuntimeAssets(bundle, issues);

  const startScene = bundle.scenes.find(
    (scene) => scene.id === bundle.startSceneId,
  );
  if (!startScene) {
    addIssue(
      issues,
      "missing-start-scene",
      "startSceneId",
      `Runtime start scene '${bundle.startSceneId}' is missing.`,
    );
  } else if (
    !startScene.entrances.some(
      (entrance) => entrance.id === bundle.startEntranceId,
    )
  ) {
    addIssue(
      issues,
      "missing-start-entrance",
      "startEntranceId",
      `Runtime start entrance '${bundle.startEntranceId}' is missing from scene '${startScene.id}'.`,
    );
  }

  bundle.inventoryItems.forEach((item, itemIndex) => {
    registerId(ids, issues, item.id, `inventoryItems[${itemIndex}].id`);
    const icon = assetsById.get(item.iconAssetId);
    if (!icon) {
      addIssue(
        issues,
        "missing-runtime-asset",
        `inventoryItems[${itemIndex}].iconAssetId`,
        `Inventory item '${item.id}' references missing icon '${item.iconAssetId}'.`,
      );
    } else if (icon.kind !== "image") {
      addIssue(
        issues,
        "invalid-inventory-icon-kind",
        `inventoryItems[${itemIndex}].iconAssetId`,
        `Inventory item '${item.id}' icon must be an image asset, not '${icon.kind}'.`,
      );
    }
  });

  bundle.scenes.forEach((scene, sceneIndex) => {
    const scenePath = `scenes[${sceneIndex}]`;
    registerId(ids, issues, scene.id, `${scenePath}.id`);
    const background = assetsById.get(scene.backgroundAssetId);
    if (!background) {
      addIssue(
        issues,
        "missing-runtime-asset",
        `${scenePath}.backgroundAssetId`,
        `Scene '${scene.id}' references missing runtime background '${scene.backgroundAssetId}'.`,
      );
    } else if (background.kind !== "image") {
      addIssue(
        issues,
        "invalid-background-asset-kind",
        `${scenePath}.backgroundAssetId`,
        `Scene '${scene.id}' background must be an image asset, not '${background.kind}'.`,
      );
    } else if (
      background.metadata.width < scene.width ||
      background.metadata.height < scene.height
    ) {
      addIssue(
        issues,
        "background-asset-too-small",
        `${scenePath}.backgroundAssetId`,
        `Scene '${scene.id}' is ${scene.width}x${scene.height}, but background '${background.assetId}' is ${background.metadata.width}x${background.metadata.height}.`,
      );
    }

    scene.entrances.forEach((entrance, entranceIndex) =>
      registerId(
        ids,
        issues,
        entrance.id,
        `${scenePath}.entrances[${entranceIndex}].id`,
      ),
    );
    scene.navigationAreas.forEach((area, areaIndex) =>
      registerId(
        ids,
        issues,
        area.id,
        `${scenePath}.navigationAreas[${areaIndex}].id`,
      ),
    );
    scene.depthBands.forEach((band, bandIndex) =>
      registerId(
        ids,
        issues,
        band.id,
        `${scenePath}.depthBands[${bandIndex}].id`,
      ),
    );
    scene.occluders.forEach((occluder, occluderIndex) => {
      registerId(
        ids,
        issues,
        occluder.id,
        `${scenePath}.occluders[${occluderIndex}].id`,
      );
      const asset = assetsById.get(occluder.assetId);
      if (!asset) {
        addIssue(
          issues,
          "missing-runtime-asset",
          `${scenePath}.occluders[${occluderIndex}].assetId`,
          `Occluder '${occluder.id}' references missing asset '${occluder.assetId}'.`,
        );
      } else if (asset.kind !== "image") {
        addIssue(
          issues,
          "invalid-occluder-asset-kind",
          `${scenePath}.occluders[${occluderIndex}].assetId`,
          `Occluder '${occluder.id}' must reference an image asset, not '${asset.kind}'.`,
        );
      }
    });
    scene.hotspots.forEach((hotspot, hotspotIndex) => {
      const hotspotPath = `${scenePath}.hotspots[${hotspotIndex}]`;
      registerId(ids, issues, hotspot.id, `${hotspotPath}.id`);
      hotspot.interactions.forEach((interaction, interactionIndex) =>
        registerId(
          ids,
          issues,
          interaction.id,
          `${hotspotPath}.interactions[${interactionIndex}].id`,
        ),
      );
    });
  });

  validateActorFrames(bundle, assetsById, issues, ids);
  validateDialogues(bundle, issues, ids);

  bundle.sequences.forEach((sequence, sequenceIndex) => {
    const sequencePath = `sequences[${sequenceIndex}]`;
    registerId(ids, issues, sequence.id, `${sequencePath}.id`);
    const actualCueCount = sequence.tracks.reduce(
      (total, track) => total + track.cues.length,
      0,
    );
    if (sequence.cueCount !== actualCueCount) {
      addIssue(
        issues,
        "invalid-sequence-cue-count",
        `${sequencePath}.cueCount`,
        `Sequence '${sequence.id}' declares ${sequence.cueCount} cues but contains ${actualCueCount}.`,
      );
    }
    sequence.tracks.forEach((track, trackIndex) =>
      registerId(
        ids,
        issues,
        track.id,
        `${sequencePath}.tracks[${trackIndex}].id`,
      ),
    );
  });

  return issues;
};

export class RuntimeBundleValidationError extends Error {
  readonly issues: readonly RuntimeBundleIssue[];

  constructor(issues: readonly RuntimeBundleIssue[]) {
    super(`Runtime bundle contains ${issues.length} semantic issue(s).`);
    this.name = "RuntimeBundleValidationError";
    this.issues = issues;
  }
}
