import type {
  Action,
  AdventureProject,
  Id,
  Polygon,
  Scene,
} from "@evavo/adventure-project-schema";
import { pointInPolygon } from "@evavo/adventure-scene";

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "duplicate-id"
  | "missing-start-scene"
  | "missing-start-entrance"
  | "missing-asset"
  | "missing-item"
  | "missing-scene"
  | "missing-entrance"
  | "missing-actor"
  | "missing-frame"
  | "invalid-walk-target"
  | "degenerate-polygon"
  | "invalid-depth-band"
  | "overlapping-depth-bands"
  | "invalid-sprite-trim"
  | "conflicting-score-award"
  | "unreachable-scene"
  | "linear-pixel-sampling"
  | "fractional-presentation-scale";

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: ValidationCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: ValidationIssue[],
  severity: ValidationSeverity,
  code: ValidationCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity, code, path, message });
};

const registerId = (
  ids: Map<string, string>,
  issues: ValidationIssue[],
  id: string,
  path: string,
): void => {
  const existing = ids.get(id);
  if (existing) {
    addIssue(
      issues,
      "error",
      "duplicate-id",
      path,
      `ID '${id}' is already declared at '${existing}'.`,
    );
    return;
  }
  ids.set(id, path);
};

const signedPolygonArea = (polygon: Polygon): number => {
  let sum = 0;
  const points = polygon.points;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current && next) {
      sum += current.x * next.y - next.x * current.y;
    }
  }

  return sum / 2;
};

const validatePolygon = (
  polygon: Polygon,
  path: string,
  issues: ValidationIssue[],
): void => {
  if (Math.abs(signedPolygonArea(polygon)) < 1e-6) {
    addIssue(
      issues,
      "error",
      "degenerate-polygon",
      path,
      "Polygon has no usable area.",
    );
  }
};

const rangesOverlap = (
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean => {
  const leftMinimum = Math.min(leftStart, leftEnd);
  const leftMaximum = Math.max(leftStart, leftEnd);
  const rightMinimum = Math.min(rightStart, rightEnd);
  const rightMaximum = Math.max(rightStart, rightEnd);
  return Math.max(leftMinimum, rightMinimum) <= Math.min(leftMaximum, rightMaximum);
};

interface ValidationContext {
  readonly project: AdventureProject;
  readonly issues: ValidationIssue[];
  readonly ids: Map<string, string>;
  readonly assetIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
  readonly actorIds: ReadonlySet<string>;
  readonly scenesById: ReadonlyMap<string, Scene>;
  readonly adjacency: Map<string, Set<string>>;
  readonly scoreAwards: Map<string, { readonly points: number; readonly path: string }>;
}

const requireAsset = (
  context: ValidationContext,
  assetId: Id<"asset">,
  path: string,
): void => {
  if (!context.assetIds.has(assetId)) {
    addIssue(
      context.issues,
      "error",
      "missing-asset",
      path,
      `Asset '${assetId}' is not declared.`,
    );
  }
};

const validateAction = (
  action: Action,
  path: string,
  sourceSceneId: Id<"scene">,
  context: ValidationContext,
): void => {
  switch (action.kind) {
    case "say":
      if (action.speakerId && !context.actorIds.has(action.speakerId)) {
        addIssue(
          context.issues,
          "error",
          "missing-actor",
          path,
          `Speaker '${action.speakerId}' is not declared.`,
        );
      }
      return;
    case "give-item":
    case "remove-item":
      if (!context.itemIds.has(action.itemId)) {
        addIssue(
          context.issues,
          "error",
          "missing-item",
          path,
          `Inventory item '${action.itemId}' is not declared.`,
        );
      }
      return;
    case "change-scene": {
      const destination = context.scenesById.get(action.sceneId);
      if (!destination) {
        addIssue(
          context.issues,
          "error",
          "missing-scene",
          path,
          `Destination scene '${action.sceneId}' is not declared.`,
        );
        return;
      }

      if (!destination.entrances.some((entrance) => entrance.id === action.entranceId)) {
        addIssue(
          context.issues,
          "error",
          "missing-entrance",
          path,
          `Entrance '${action.entranceId}' is not declared in scene '${action.sceneId}'.`,
        );
      }

      const destinations = context.adjacency.get(sourceSceneId) ?? new Set<string>();
      destinations.add(action.sceneId);
      context.adjacency.set(sourceSceneId, destinations);
      return;
    }
    case "award-score": {
      const existing = context.scoreAwards.get(action.awardId);
      if (existing && existing.points !== action.points) {
        addIssue(
          context.issues,
          "error",
          "conflicting-score-award",
          path,
          `Score award '${action.awardId}' uses ${action.points} points here but ${existing.points} points at '${existing.path}'.`,
        );
      } else if (!existing) {
        context.scoreAwards.set(action.awardId, { points: action.points, path });
      }
      return;
    }
    case "set-flag":
    case "set-variable":
    case "play-sequence":
    case "set-object-state":
      return;
  }
};

const validateScene = (
  scene: Scene,
  sceneIndex: number,
  context: ValidationContext,
): void => {
  const scenePath = `scenes[${sceneIndex}]`;
  registerId(context.ids, context.issues, scene.id, `${scenePath}.id`);
  requireAsset(context, scene.backgroundAssetId, `${scenePath}.backgroundAssetId`);

  scene.entrances.forEach((entrance, entranceIndex) => {
    registerId(
      context.ids,
      context.issues,
      entrance.id,
      `${scenePath}.entrances[${entranceIndex}].id`,
    );
  });

  scene.navigationAreas.forEach((area, areaIndex) => {
    const areaPath = `${scenePath}.navigationAreas[${areaIndex}]`;
    registerId(context.ids, context.issues, area.id, `${areaPath}.id`);
    validatePolygon(area.shape, `${areaPath}.shape`, context.issues);
  });

  scene.depthBands.forEach((band, bandIndex) => {
    const bandPath = `${scenePath}.depthBands[${bandIndex}]`;
    registerId(context.ids, context.issues, band.id, `${bandPath}.id`);
    if (Math.abs(band.nearY - band.farY) < 1e-6) {
      addIssue(
        context.issues,
        "error",
        "invalid-depth-band",
        bandPath,
        `Depth band '${band.id}' has identical near and far Y values.`,
      );
    }
  });

  for (let leftIndex = 0; leftIndex < scene.depthBands.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < scene.depthBands.length;
      rightIndex += 1
    ) {
      const left = scene.depthBands[leftIndex];
      const right = scene.depthBands[rightIndex];
      if (
        left &&
        right &&
        rangesOverlap(left.farY, left.nearY, right.farY, right.nearY)
      ) {
        addIssue(
          context.issues,
          "warning",
          "overlapping-depth-bands",
          `${scenePath}.depthBands[${rightIndex}]`,
          `Depth bands '${left.id}' and '${right.id}' overlap; the narrower band and stable ID determine resolution.`,
        );
      }
    }
  }

  scene.occluders.forEach((occluder, occluderIndex) => {
    const occluderPath = `${scenePath}.occluders[${occluderIndex}]`;
    registerId(context.ids, context.issues, occluder.id, `${occluderPath}.id`);
    requireAsset(context, occluder.assetId, `${occluderPath}.assetId`);
    if (occluder.mask) {
      validatePolygon(occluder.mask, `${occluderPath}.mask`, context.issues);
    }
  });

  scene.hotspots.forEach((hotspot, hotspotIndex) => {
    const hotspotPath = `${scenePath}.hotspots[${hotspotIndex}]`;
    registerId(context.ids, context.issues, hotspot.id, `${hotspotPath}.id`);
    validatePolygon(hotspot.shape, `${hotspotPath}.shape`, context.issues);

    if (
      hotspot.walkTo &&
      !scene.navigationAreas.some((area) => pointInPolygon(hotspot.walkTo!, area.shape))
    ) {
      addIssue(
        context.issues,
        "error",
        "invalid-walk-target",
        `${hotspotPath}.walkTo`,
        `Walk target for hotspot '${hotspot.id}' is outside every navigation area.`,
      );
    }

    hotspot.interactions.forEach((interaction, interactionIndex) => {
      const interactionPath = `${hotspotPath}.interactions[${interactionIndex}]`;
      registerId(
        context.ids,
        context.issues,
        interaction.id,
        `${interactionPath}.id`,
      );

      if (interaction.itemId && !context.itemIds.has(interaction.itemId)) {
        addIssue(
          context.issues,
          "error",
          "missing-item",
          `${interactionPath}.itemId`,
          `Inventory item '${interaction.itemId}' is not declared.`,
        );
      }

      interaction.actions.forEach((action, actionIndex) =>
        validateAction(
          action,
          `${interactionPath}.actions[${actionIndex}]`,
          scene.id,
          context,
        ),
      );
    });
  });
};

const validateReachability = (context: ValidationContext): void => {
  if (!context.scenesById.has(context.project.startSceneId)) {
    return;
  }

  const visited = new Set<string>();
  const pending = [context.project.startSceneId as string];

  while (pending.length > 0) {
    const sceneId = pending.shift();
    if (!sceneId || visited.has(sceneId)) {
      continue;
    }
    visited.add(sceneId);

    for (const destination of context.adjacency.get(sceneId) ?? []) {
      if (!visited.has(destination)) {
        pending.push(destination);
      }
    }
  }

  context.project.scenes.forEach((scene, sceneIndex) => {
    if (!visited.has(scene.id)) {
      addIssue(
        context.issues,
        "warning",
        "unreachable-scene",
        `scenes[${sceneIndex}]`,
        `Scene '${scene.id}' is not reachable from start scene '${context.project.startSceneId}' through authored scene-change actions.`,
      );
    }
  });
};

export const validateProjectSemantics = (
  project: AdventureProject,
): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const assetIds = new Set(project.assets.map((asset) => asset.id as string));
  const itemIds = new Set(project.inventoryItems.map((item) => item.id as string));
  const actorIds = new Set(project.actors.map((actor) => actor.id as string));
  const scenesById = new Map(project.scenes.map((scene) => [scene.id as string, scene]));

  const context: ValidationContext = {
    project,
    issues,
    ids,
    assetIds,
    itemIds,
    actorIds,
    scenesById,
    adjacency: new Map(),
    scoreAwards: new Map(),
  };

  registerId(ids, issues, project.id, "id");

  project.assets.forEach((asset, assetIndex) =>
    registerId(ids, issues, asset.id, `assets[${assetIndex}].id`),
  );

  project.inventoryItems.forEach((item, itemIndex) => {
    const itemPath = `inventoryItems[${itemIndex}]`;
    registerId(ids, issues, item.id, `${itemPath}.id`);
    requireAsset(context, item.iconAssetId, `${itemPath}.iconAssetId`);
  });

  project.actors.forEach((actor, actorIndex) => {
    const actorPath = `actors[${actorIndex}]`;
    registerId(ids, issues, actor.id, `${actorPath}.id`);
    const frameIds = new Set(actor.frames.map((frame) => frame.id as string));

    actor.frames.forEach((frame, frameIndex) => {
      const framePath = `${actorPath}.frames[${frameIndex}]`;
      registerId(ids, issues, frame.id, `${framePath}.id`);
      requireAsset(context, frame.assetId, `${framePath}.assetId`);

      if (
        frame.trimOffset.x < 0 ||
        frame.trimOffset.y < 0 ||
        frame.trimOffset.x + frame.sourceRect.width > frame.sourceSize.width ||
        frame.trimOffset.y + frame.sourceRect.height > frame.sourceSize.height
      ) {
        addIssue(
          issues,
          "error",
          "invalid-sprite-trim",
          framePath,
          `Sprite frame '${frame.id}' does not fit inside its declared untrimmed size.`,
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
            "error",
            "missing-frame",
            `${animationPath}.frameIds[${frameIndex}]`,
            `Animation '${animation.id}' references frame '${frameId}' outside actor '${actor.id}'.`,
          );
        }
      });
    });
  });

  project.scenes.forEach((scene, sceneIndex) =>
    validateScene(scene, sceneIndex, context),
  );

  const startScene = scenesById.get(project.startSceneId);
  if (!startScene) {
    addIssue(
      issues,
      "error",
      "missing-start-scene",
      "startSceneId",
      `Start scene '${project.startSceneId}' is not declared.`,
    );
  } else if (!startScene.entrances.some((entrance) => entrance.id === project.startEntranceId)) {
    addIssue(
      issues,
      "error",
      "missing-start-entrance",
      "startEntranceId",
      `Start entrance '${project.startEntranceId}' is not declared in scene '${startScene.id}'.`,
    );
  }

  if (project.presentation.textureSampling === "linear") {
    addIssue(
      issues,
      "warning",
      "linear-pixel-sampling",
      "presentation.textureSampling",
      "Linear texture sampling can blur authored pixel assets.",
    );
  }

  if (!project.presentation.integerScale) {
    addIssue(
      issues,
      "warning",
      "fractional-presentation-scale",
      "presentation.integerScale",
      "Fractional presentation scaling can produce uneven native pixels.",
    );
  }

  validateReachability(context);

  return issues;
};

export const hasValidationErrors = (
  issues: readonly ValidationIssue[],
): boolean => issues.some((issue) => issue.severity === "error");
