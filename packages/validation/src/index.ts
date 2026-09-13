import type {
  Action,
  Actor,
  AdventureProject,
  Condition,
  DialogueGraph,
  Id,
  Polygon,
  Scene,
  Sequence,
  SequenceCue,
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
  | "missing-interaction"
  | "missing-dialogue-choice"
  | "missing-dialogue"
  | "missing-dialogue-node"
  | "missing-sequence"
  | "invalid-walk-target"
  | "degenerate-polygon"
  | "invalid-depth-band"
  | "overlapping-depth-bands"
  | "invalid-sprite-trim"
  | "invalid-animation-state"
  | "conflicting-score-award"
  | "conflicting-dialogue-transition"
  | "unreachable-scene"
  | "unreachable-dialogue-node"
  | "invalid-sequence-timing"
  | "invalid-skip-boundary"
  | "invalid-palette-range"
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

const registerId = (ids: Map<string, string>, issues: ValidationIssue[], id: string, path: string): void => {
  const existing = ids.get(id);
  if (existing) {
    addIssue(issues, "error", "duplicate-id", path, `ID '${id}' is already declared at '${existing}'.`);
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

const validatePolygon = (polygon: Polygon, path: string, issues: ValidationIssue[]): void => {
  if (Math.abs(signedPolygonArea(polygon)) < 1e-6) {
    addIssue(issues, "error", "degenerate-polygon", path, "Polygon has no usable area.");
  }
};

const rangesOverlap = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean => {
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
  readonly actorsById: ReadonlyMap<string, Actor>;
  readonly interactionIds: ReadonlySet<string>;
  readonly dialogueChoiceIds: ReadonlySet<string>;
  readonly scenesById: ReadonlyMap<string, Scene>;
  readonly dialoguesById: ReadonlyMap<string, DialogueGraph>;
  readonly sequencesById: ReadonlyMap<string, Sequence>;
  readonly adjacency: Map<string, Set<string>>;
  readonly scoreAwards: Map<string, { readonly points: number; readonly path: string }>;
}

const requireAsset = (context: ValidationContext, assetId: Id<"asset">, path: string): void => {
  if (!context.assetIds.has(assetId)) {
    addIssue(context.issues, "error", "missing-asset", path, `Asset '${assetId}' is not declared.`);
  }
};

const validateConditionReferences = (
  condition: Condition,
  path: string,
  context: ValidationContext,
): void => {
  switch (condition.kind) {
    case "always":
    case "flag":
    case "variable":
      return;
    case "has-item":
      if (!context.itemIds.has(condition.itemId)) {
        addIssue(
          context.issues,
          "error",
          "missing-item",
          path,
          `Inventory item '${condition.itemId}' is not declared.`,
        );
      }
      return;
    case "interaction-used":
      if (!context.interactionIds.has(condition.interactionId)) {
        addIssue(
          context.issues,
          "error",
          "missing-interaction",
          path,
          `Interaction '${condition.interactionId}' is not declared.`,
        );
      }
      return;
    case "dialogue-choice-used":
      if (!context.dialogueChoiceIds.has(condition.choiceId)) {
        addIssue(
          context.issues,
          "error",
          "missing-dialogue-choice",
          path,
          `Dialogue choice '${condition.choiceId}' is not declared.`,
        );
      }
      return;
    case "all":
    case "any":
      condition.conditions.forEach((child, index) => {
        validateConditionReferences(child, `${path}.conditions[${index}]`, context);
      });
      return;
    case "not":
      validateConditionReferences(condition.condition, `${path}.condition`, context);
  }
};

const validateAction = (
  action: Action,
  path: string,
  sourceSceneId: Id<"scene"> | null,
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

      if (sourceSceneId) {
        const destinations = context.adjacency.get(sourceSceneId) ?? new Set<string>();
        destinations.add(action.sceneId);
        context.adjacency.set(sourceSceneId, destinations);
      }
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
    case "play-sequence":
      if (!context.sequencesById.has(action.sequenceId)) {
        addIssue(
          context.issues,
          "error",
          "missing-sequence",
          path,
          `Sequence '${action.sequenceId}' is not declared.`,
        );
      }
      return;
    case "start-dialogue": {
      const graph = context.dialoguesById.get(action.dialogueId);
      if (!graph) {
        addIssue(
          context.issues,
          "error",
          "missing-dialogue",
          path,
          `Dialogue '${action.dialogueId}' is not declared.`,
        );
        return;
      }
      if (action.nodeId && !graph.nodes.some((node) => node.id === action.nodeId)) {
        addIssue(
          context.issues,
          "error",
          "missing-dialogue-node",
          path,
          `Dialogue node '${action.nodeId}' is not declared in '${action.dialogueId}'.`,
        );
      }
      return;
    }
    case "set-flag":
    case "set-variable":
    case "set-object-state":
      return;
  }
};

const validateScene = (scene: Scene, sceneIndex: number, context: ValidationContext): void => {
  const scenePath = `scenes[${sceneIndex}]`;
  registerId(context.ids, context.issues, scene.id, `${scenePath}.id`);
  requireAsset(context, scene.backgroundAssetId, `${scenePath}.backgroundAssetId`);

  scene.entrances.forEach((entrance, entranceIndex) => {
    registerId(context.ids, context.issues, entrance.id, `${scenePath}.entrances[${entranceIndex}].id`);
  });

  scene.navigationAreas.forEach((area, areaIndex) => {
    const areaPath = `${scenePath}.navigationAreas[${areaIndex}]`;
    registerId(context.ids, context.issues, area.id, `${areaPath}.id`);
    validatePolygon(area.shape, `${areaPath}.shape`, context.issues);
    if (area.enabledWhen) {
      validateConditionReferences(area.enabledWhen, `${areaPath}.enabledWhen`, context);
    }
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
    for (let rightIndex = leftIndex + 1; rightIndex < scene.depthBands.length; rightIndex += 1) {
      const left = scene.depthBands[leftIndex];
      const right = scene.depthBands[rightIndex];
      if (left && right && rangesOverlap(left.farY, left.nearY, right.farY, right.nearY)) {
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
      registerId(context.ids, context.issues, interaction.id, `${interactionPath}.id`);

      if (interaction.itemId && !context.itemIds.has(interaction.itemId)) {
        addIssue(
          context.issues,
          "error",
          "missing-item",
          `${interactionPath}.itemId`,
          `Inventory item '${interaction.itemId}' is not declared.`,
        );
      }
      if (interaction.when) {
        validateConditionReferences(interaction.when, `${interactionPath}.when`, context);
      }

      interaction.actions.forEach((action, actionIndex) => {
        validateAction(action, `${interactionPath}.actions[${actionIndex}]`, scene.id, context);
      });
    });
  });
};

const validateDialogue = (graph: DialogueGraph, graphIndex: number, context: ValidationContext): void => {
  const graphPath = `dialogues[${graphIndex}]`;
  registerId(context.ids, context.issues, graph.id, `${graphPath}.id`);
  const nodesById = new Map(graph.nodes.map((node) => [node.id as string, node]));

  if (!nodesById.has(graph.startNodeId)) {
    addIssue(
      context.issues,
      "error",
      "missing-dialogue-node",
      `${graphPath}.startNodeId`,
      `Start node '${graph.startNodeId}' is not declared in dialogue '${graph.id}'.`,
    );
  }

  graph.nodes.forEach((node, nodeIndex) => {
    const nodePath = `${graphPath}.nodes[${nodeIndex}]`;
    registerId(context.ids, context.issues, node.id, `${nodePath}.id`);

    node.enterActions.forEach((action, actionIndex) => {
      validateAction(action, `${nodePath}.enterActions[${actionIndex}]`, null, context);
    });
    node.exitActions.forEach((action, actionIndex) => {
      validateAction(action, `${nodePath}.exitActions[${actionIndex}]`, null, context);
    });

    node.lines.forEach((line, lineIndex) => {
      const linePath = `${nodePath}.lines[${lineIndex}]`;
      registerId(context.ids, context.issues, line.id, `${linePath}.id`);
      if (line.speakerId && !context.actorIds.has(line.speakerId)) {
        addIssue(
          context.issues,
          "error",
          "missing-actor",
          `${linePath}.speakerId`,
          `Dialogue speaker '${line.speakerId}' is not declared.`,
        );
      }
    });

    if (node.autoNextNodeId && !nodesById.has(node.autoNextNodeId)) {
      addIssue(
        context.issues,
        "error",
        "missing-dialogue-node",
        `${nodePath}.autoNextNodeId`,
        `Automatic next node '${node.autoNextNodeId}' is not declared in dialogue '${graph.id}'.`,
      );
    }

    node.choices.forEach((choice, choiceIndex) => {
      const choicePath = `${nodePath}.choices[${choiceIndex}]`;
      registerId(context.ids, context.issues, choice.id, `${choicePath}.id`);

      if (choice.visibleWhen) {
        validateConditionReferences(choice.visibleWhen, `${choicePath}.visibleWhen`, context);
      }
      if (choice.enabledWhen) {
        validateConditionReferences(choice.enabledWhen, `${choicePath}.enabledWhen`, context);
      }
      choice.actions.forEach((action, actionIndex) => {
        validateAction(action, `${choicePath}.actions[${actionIndex}]`, null, context);
      });

      if (choice.nextNodeId && !nodesById.has(choice.nextNodeId)) {
        addIssue(
          context.issues,
          "error",
          "missing-dialogue-node",
          `${choicePath}.nextNodeId`,
          `Choice target '${choice.nextNodeId}' is not declared in dialogue '${graph.id}'.`,
        );
      }
      if (choice.closeDialogue && choice.nextNodeId) {
        addIssue(
          context.issues,
          "warning",
          "conflicting-dialogue-transition",
          choicePath,
          `Choice '${choice.id}' closes the dialogue and also declares a next node; closure takes precedence.`,
        );
      }
    });
  });

  if (!nodesById.has(graph.startNodeId)) {
    return;
  }

  const reachable = new Set<string>();
  const pending = [graph.startNodeId as string];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (!nodeId || reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    if (node.autoNextNodeId) {
      pending.push(node.autoNextNodeId);
    }
    node.choices.forEach((choice) => {
      if (!choice.closeDialogue && choice.nextNodeId) {
        pending.push(choice.nextNodeId);
      }
    });
  }

  graph.nodes.forEach((node, nodeIndex) => {
    if (!reachable.has(node.id)) {
      addIssue(
        context.issues,
        "warning",
        "unreachable-dialogue-node",
        `${graphPath}.nodes[${nodeIndex}]`,
        `Dialogue node '${node.id}' is unreachable from '${graph.startNodeId}'.`,
      );
    }
  });
};

const cueEndTick = (cue: SequenceCue): number => {
  switch (cue.kind) {
    case "actor-move":
    case "camera-shot":
      return cue.atTick + cue.durationTicks;
    case "speech":
      return cue.atTick + (cue.durationTicks ?? 0);
    case "story-action":
    case "actor-animation":
    case "sound":
    case "stop-audio":
    case "layer-visibility":
    case "palette-cycle":
      return cue.atTick;
  }
};

const validateSequenceCue = (
  cue: SequenceCue,
  path: string,
  sequence: Sequence,
  context: ValidationContext,
): void => {
  if (cueEndTick(cue) > sequence.durationTicks) {
    addIssue(
      context.issues,
      "error",
      "invalid-sequence-timing",
      path,
      `Cue ends at tick ${cueEndTick(cue)}, after sequence '${sequence.id}' ends at ${sequence.durationTicks}.`,
    );
  }

  switch (cue.kind) {
    case "story-action":
      validateAction(cue.action, `${path}.action`, null, context);
      return;
    case "speech":
      if (cue.speakerId && !context.actorIds.has(cue.speakerId)) {
        addIssue(
          context.issues,
          "error",
          "missing-actor",
          `${path}.speakerId`,
          `Sequence speaker '${cue.speakerId}' is not declared.`,
        );
      }
      return;
    case "actor-move":
      if (!context.actorIds.has(cue.actorId)) {
        addIssue(
          context.issues,
          "error",
          "missing-actor",
          `${path}.actorId`,
          `Sequence actor '${cue.actorId}' is not declared.`,
        );
      }
      return;
    case "actor-animation": {
      const actor = context.actorsById.get(cue.actorId);
      if (!actor) {
        addIssue(
          context.issues,
          "error",
          "missing-actor",
          `${path}.actorId`,
          `Sequence actor '${cue.actorId}' is not declared.`,
        );
      } else if (!actor.animations.some((animation) => animation.state === cue.animationState)) {
        addIssue(
          context.issues,
          "error",
          "invalid-animation-state",
          `${path}.animationState`,
          `Actor '${cue.actorId}' has no animation state '${cue.animationState}'.`,
        );
      }
      return;
    }
    case "sound":
      requireAsset(context, cue.assetId, `${path}.assetId`);
      return;
    case "palette-cycle":
      requireAsset(context, cue.paletteAssetId, `${path}.paletteAssetId`);
      if (cue.rangeEnd < cue.rangeStart) {
        addIssue(
          context.issues,
          "error",
          "invalid-palette-range",
          path,
          `Palette range ${cue.rangeStart} to ${cue.rangeEnd} is reversed.`,
        );
      }
      return;
    case "camera-shot":
    case "stop-audio":
    case "layer-visibility":
      return;
  }
};

const validateSequence = (sequence: Sequence, sequenceIndex: number, context: ValidationContext): void => {
  const sequencePath = `sequences[${sequenceIndex}]`;
  registerId(context.ids, context.issues, sequence.id, `${sequencePath}.id`);

  if (sequence.skip.safeAfterTick > sequence.durationTicks) {
    addIssue(
      context.issues,
      "error",
      "invalid-skip-boundary",
      `${sequencePath}.skip.safeAfterTick`,
      `Skip boundary ${sequence.skip.safeAfterTick} exceeds sequence duration ${sequence.durationTicks}.`,
    );
  }
  sequence.skip.completionActions.forEach((action, actionIndex) => {
    validateAction(action, `${sequencePath}.skip.completionActions[${actionIndex}]`, null, context);
  });

  sequence.tracks.forEach((track, trackIndex) => {
    const trackPath = `${sequencePath}.tracks[${trackIndex}]`;
    registerId(context.ids, context.issues, track.id, `${trackPath}.id`);
    track.cues.forEach((cue, cueIndex) => {
      validateSequenceCue(cue, `${trackPath}.cues[${cueIndex}]`, sequence, context);
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
        `Scene '${scene.id}' is not directly reachable from start scene '${context.project.startSceneId}' through authored scene-change actions.`,
      );
    }
  });
};

export const validateProjectSemantics = (project: AdventureProject): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const assetIds = new Set(project.assets.map((asset) => asset.id as string));
  const itemIds = new Set(project.inventoryItems.map((item) => item.id as string));
  const actorIds = new Set(project.actors.map((actor) => actor.id as string));
  const actorsById = new Map(project.actors.map((actor) => [actor.id as string, actor]));
  const interactionIds = new Set(
    project.scenes.flatMap((scene) =>
      scene.hotspots.flatMap((hotspot) =>
        hotspot.interactions.map((interaction) => interaction.id as string),
      ),
    ),
  );
  const dialogueChoiceIds = new Set(
    project.dialogues.flatMap((dialogue) =>
      dialogue.nodes.flatMap((node) => node.choices.map((choice) => choice.id as string)),
    ),
  );
  const scenesById = new Map(project.scenes.map((scene) => [scene.id as string, scene]));
  const dialoguesById = new Map(project.dialogues.map((dialogue) => [dialogue.id as string, dialogue]));
  const sequencesById = new Map(project.sequences.map((sequence) => [sequence.id as string, sequence]));

  const context: ValidationContext = {
    project,
    issues,
    ids,
    assetIds,
    itemIds,
    actorIds,
    actorsById,
    interactionIds,
    dialogueChoiceIds,
    scenesById,
    dialoguesById,
    sequencesById,
    adjacency: new Map(),
    scoreAwards: new Map(),
  };

  registerId(ids, issues, project.id, "id");

  project.assets.forEach((asset, assetIndex) => {
    registerId(ids, issues, asset.id, `assets[${assetIndex}].id`);
  });

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

  project.scenes.forEach((scene, sceneIndex) => {
    validateScene(scene, sceneIndex, context);
  });
  project.dialogues.forEach((dialogue, dialogueIndex) => {
    validateDialogue(dialogue, dialogueIndex, context);
  });
  project.sequences.forEach((sequence, sequenceIndex) => {
    validateSequence(sequence, sequenceIndex, context);
  });

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

export const hasValidationErrors = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((issue) => issue.severity === "error");
