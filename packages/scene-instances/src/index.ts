import { z } from "zod";
import {
  conditionSchema,
  idSchema,
  interactionSchema,
  pointSchema,
  polygonSchema,
  rectangleSchema,
  sizeSchema,
  type Action,
  type Actor,
  type DialogueGraph,
  type Id,
  type InventoryItem,
  type NavigationArea,
  type Scene,
  type Sequence,
} from "@evavo/adventure-project-schema";
import { pointInPolygon } from "@evavo/adventure-scene";

export const sceneActorInstanceSchema = z
  .object({
    id: idSchema("actor-instance"),
    actorId: idSchema("actor"),
    position: pointSchema,
    facing: z.string().min(1),
    animationState: z.string().min(1),
    mobility: z.enum(["walkable", "fixed"]).default("walkable"),
    elevation: z.number().finite().default(0),
    zOffset: z.number().finite().default(0),
    scaleMultiplier: z.number().positive().default(1),
    visibleWhen: conditionSchema.optional(),
  })
  .strict();
export type SceneActorInstance = z.infer<typeof sceneActorInstanceSchema>;

export const objectVisualSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("image"),
      assetId: idSchema("asset"),
      pivot: pointSchema,
      opacity: z.number().min(0).max(1).default(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("sprite-frame"),
      assetId: idSchema("asset"),
      frameId: idSchema("sprite-frame"),
      sourceRect: rectangleSchema,
      sourceSize: sizeSchema,
      trimOffset: pointSchema,
      pivot: pointSchema,
      opacity: z.number().min(0).max(1).default(1),
    })
    .strict(),
]);
export type ObjectVisual = z.infer<typeof objectVisualSchema>;

export const objectStateDefinitionSchema = z
  .object({
    id: idSchema("object-state"),
    visual: objectVisualSchema.optional(),
    visible: z.boolean().default(true),
    interactionShape: polygonSchema.optional(),
    walkToOffset: pointSchema.optional(),
    faceDirection: z.string().min(1).optional(),
    cursor: z.string().min(1).optional(),
    interactions: z.array(interactionSchema).default([]),
    fallbackText: z.string().min(1).optional(),
  })
  .strict();
export type ObjectStateDefinition = z.infer<typeof objectStateDefinitionSchema>;

export const objectDefinitionSchema = z
  .object({
    id: idSchema("object-definition"),
    name: z.string().min(1),
    initialStateId: idSchema("object-state"),
    states: z.array(objectStateDefinitionSchema).min(1),
  })
  .strict();
export type ObjectDefinition = z.infer<typeof objectDefinitionSchema>;

export const sceneObjectInstanceSchema = z
  .object({
    id: idSchema("object"),
    definitionId: idSchema("object-definition"),
    position: pointSchema,
    initialStateId: idSchema("object-state").optional(),
    layer: z
      .enum(["rear-ambient", "world", "occlusion", "front-ambient"])
      .default("world"),
    elevation: z.number().finite().default(0),
    zOffset: z.number().finite().default(0),
    scaleMultiplier: z.number().positive().default(1),
    mirrored: z.boolean().default(false),
    visibleWhen: conditionSchema.optional(),
  })
  .strict();
export type SceneObjectInstance = z.infer<typeof sceneObjectInstanceSchema>;

export const sceneNavigationPortalSchema = z
  .object({
    id: idSchema("navigation-portal"),
    fromAreaId: idSchema("navigation-area"),
    toAreaId: idSchema("navigation-area"),
    fromPoint: pointSchema,
    toPoint: pointSchema,
    bidirectional: z.boolean().default(true),
    traversalCost: z.number().finite().nonnegative().default(0),
    enabledWhen: conditionSchema.optional(),
    traversalAnimationState: z.string().min(1).optional(),
  })
  .strict();
export type SceneNavigationPortal = z.infer<
  typeof sceneNavigationPortalSchema
>;

export const sceneCompositionSchema = z
  .object({
    sceneId: idSchema("scene"),
    actorInstances: z.array(sceneActorInstanceSchema).default([]),
    objectInstances: z.array(sceneObjectInstanceSchema).default([]),
    navigationPortals: z.array(sceneNavigationPortalSchema).default([]),
  })
  .strict();
export type SceneComposition = z.infer<typeof sceneCompositionSchema>;

export const sceneInstanceManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    objectDefinitions: z.array(objectDefinitionSchema).default([]),
    scenes: z.array(sceneCompositionSchema).default([]),
  })
  .strict();
export type SceneInstanceManifest = z.infer<typeof sceneInstanceManifestSchema>;

export const parseSceneInstanceManifest = (input: unknown): SceneInstanceManifest =>
  sceneInstanceManifestSchema.parse(input);

export const emptySceneInstanceManifest = (
  projectId: Id<"project">,
): SceneInstanceManifest => ({
  manifestVersion: 1,
  projectId,
  objectDefinitions: [],
  scenes: [],
});

export interface SceneInstanceAssetReference {
  readonly id: Id<"asset">;
  readonly kind:
    | "image"
    | "spritesheet"
    | "audio"
    | "font"
    | "video"
    | "palette";
}

export interface SceneInstanceProjectContext {
  readonly projectId: Id<"project">;
  readonly scenes: readonly Pick<
    Scene,
    "id" | "navigationAreas" | "entrances"
  >[];
  readonly actors: readonly Actor[];
  readonly assets: readonly SceneInstanceAssetReference[];
  readonly inventoryItems?: readonly Pick<InventoryItem, "id">[];
  readonly dialogues?: readonly Pick<DialogueGraph, "id" | "nodes">[];
  readonly sequences?: readonly Pick<Sequence, "id">[];
}

export type SceneInstanceIssueCode =
  | "scene-instance-project-mismatch"
  | "duplicate-scene-instance-id"
  | "duplicate-scene-composition"
  | "missing-instance-scene"
  | "missing-instance-actor"
  | "missing-instance-animation"
  | "invalid-actor-instance-position"
  | "missing-object-definition"
  | "missing-object-state"
  | "missing-object-visual"
  | "missing-object-visual-asset"
  | "invalid-object-visual-asset-kind"
  | "degenerate-object-interaction-shape"
  | "missing-navigation-portal-area"
  | "invalid-navigation-portal-point"
  | "missing-interaction-actor"
  | "missing-interaction-item"
  | "missing-interaction-scene"
  | "missing-interaction-entrance"
  | "missing-interaction-dialogue"
  | "missing-interaction-dialogue-node"
  | "missing-interaction-sequence"
  | "missing-interaction-object"
  | "invalid-interaction-object-state";

export interface SceneInstanceIssue {
  readonly severity: "error";
  readonly code: SceneInstanceIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: SceneInstanceIssue[],
  code: SceneInstanceIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const registerId = (
  ids: Map<string, string>,
  issues: SceneInstanceIssue[],
  id: string,
  path: string,
): void => {
  const existing = ids.get(id);
  if (existing) {
    addIssue(
      issues,
      "duplicate-scene-instance-id",
      path,
      `ID '${id}' is already declared at '${existing}'.`,
    );
  } else {
    ids.set(id, path);
  }
};

const pointInsideNavigation = (
  position: { readonly x: number; readonly y: number },
  areas: readonly NavigationArea[],
): boolean => areas.some((area) => pointInPolygon(position, area.shape));

const polygonArea = (
  points: readonly { readonly x: number; readonly y: number }[],
): number => {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current && next) {
      total += current.x * next.y - next.x * current.y;
    }
  }
  return total / 2;
};

interface PlacedObjectReference {
  readonly instance: SceneObjectInstance;
  readonly definition: ObjectDefinition | null;
}

interface ActionValidationContext {
  readonly actorsById: ReadonlyMap<string, Actor>;
  readonly itemsById: ReadonlySet<string>;
  readonly scenesById: ReadonlyMap<
    string,
    Pick<Scene, "id" | "navigationAreas" | "entrances">
  >;
  readonly dialoguesById: ReadonlyMap<
    string,
    Pick<DialogueGraph, "id" | "nodes">
  >;
  readonly sequencesById: ReadonlySet<string>;
  readonly objectsById: ReadonlyMap<string, PlacedObjectReference>;
}

const validateInteractionAction = (
  action: Action,
  path: string,
  context: ActionValidationContext,
  issues: SceneInstanceIssue[],
): void => {
  switch (action.kind) {
    case "say":
      if (action.speakerId && !context.actorsById.has(action.speakerId)) {
        addIssue(
          issues,
          "missing-interaction-actor",
          `${path}.speakerId`,
          `Speech action references missing actor '${action.speakerId}'.`,
        );
      }
      return;
    case "give-item":
    case "remove-item":
      if (!context.itemsById.has(action.itemId)) {
        addIssue(
          issues,
          "missing-interaction-item",
          `${path}.itemId`,
          `Interaction action references missing item '${action.itemId}'.`,
        );
      }
      return;
    case "change-scene": {
      const scene = context.scenesById.get(action.sceneId);
      if (!scene) {
        addIssue(
          issues,
          "missing-interaction-scene",
          `${path}.sceneId`,
          `Interaction action references missing scene '${action.sceneId}'.`,
        );
      } else if (
        !scene.entrances.some((entrance) => entrance.id === action.entranceId)
      ) {
        addIssue(
          issues,
          "missing-interaction-entrance",
          `${path}.entranceId`,
          `Scene '${action.sceneId}' has no entrance '${action.entranceId}'.`,
        );
      }
      return;
    }
    case "play-sequence":
      if (!context.sequencesById.has(action.sequenceId)) {
        addIssue(
          issues,
          "missing-interaction-sequence",
          `${path}.sequenceId`,
          `Interaction action references missing sequence '${action.sequenceId}'.`,
        );
      }
      return;
    case "start-dialogue": {
      const dialogue = context.dialoguesById.get(action.dialogueId);
      if (!dialogue) {
        addIssue(
          issues,
          "missing-interaction-dialogue",
          `${path}.dialogueId`,
          `Interaction action references missing dialogue '${action.dialogueId}'.`,
        );
      } else if (
        action.nodeId &&
        !dialogue.nodes.some((node) => node.id === action.nodeId)
      ) {
        addIssue(
          issues,
          "missing-interaction-dialogue-node",
          `${path}.nodeId`,
          `Dialogue '${action.dialogueId}' has no node '${action.nodeId}'.`,
        );
      }
      return;
    }
    case "set-object-state": {
      const placed = context.objectsById.get(action.objectId);
      if (!placed) {
        addIssue(
          issues,
          "missing-interaction-object",
          `${path}.objectId`,
          `Interaction action references missing object '${action.objectId}'.`,
        );
      } else if (
        placed.definition &&
        !placed.definition.states.some((state) => state.id === action.state)
      ) {
        addIssue(
          issues,
          "invalid-interaction-object-state",
          `${path}.state`,
          `Object '${action.objectId}' definition '${placed.definition.id}' has no state '${action.state}'.`,
        );
      }
      return;
    }
    case "set-flag":
    case "set-variable":
    case "award-score":
      return;
  }
};

export const validateSceneInstanceManifest = (
  context: SceneInstanceProjectContext,
  manifest: SceneInstanceManifest,
): readonly SceneInstanceIssue[] => {
  const issues: SceneInstanceIssue[] = [];
  const ids = new Map<string, string>();
  const scenesById = new Map(
    context.scenes.map((scene) => [scene.id as string, scene]),
  );
  const actorsById = new Map(
    context.actors.map((actor) => [actor.id as string, actor]),
  );
  const assetsById = new Map(
    context.assets.map((asset) => [asset.id as string, asset]),
  );
  const definitionsById = new Map(
    manifest.objectDefinitions.map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );
  const objectsById = new Map<string, PlacedObjectReference>();

  for (const composition of manifest.scenes) {
    for (const instance of composition.objectInstances) {
      const definition = definitionsById.get(instance.definitionId) ?? null;
      if (!objectsById.has(instance.id)) {
        objectsById.set(instance.id, { instance, definition });
      }
    }
  }

  const actionContext: ActionValidationContext = {
    actorsById,
    itemsById: new Set((context.inventoryItems ?? []).map((item) => item.id)),
    scenesById,
    dialoguesById: new Map(
      (context.dialogues ?? []).map(
        (dialogue) => [dialogue.id as string, dialogue] as const,
      ),
    ),
    sequencesById: new Set(
      (context.sequences ?? []).map((sequence) => sequence.id),
    ),
    objectsById,
  };

  if (manifest.projectId !== context.projectId) {
    addIssue(
      issues,
      "scene-instance-project-mismatch",
      "projectId",
      `Scene instance project '${manifest.projectId}' does not match '${context.projectId}'.`,
    );
  }

  manifest.objectDefinitions.forEach((definition, definitionIndex) => {
    const definitionPath = `objectDefinitions[${definitionIndex}]`;
    registerId(ids, issues, definition.id, `${definitionPath}.id`);
    const stateIds = new Set<string>();

    definition.states.forEach((state, stateIndex) => {
      const statePath = `${definitionPath}.states[${stateIndex}]`;
      registerId(ids, issues, state.id, `${statePath}.id`);
      stateIds.add(state.id);

      if (state.visible && !state.visual) {
        addIssue(
          issues,
          "missing-object-visual",
          `${statePath}.visual`,
          `Visible object state '${state.id}' requires a visual.`,
        );
      }

      const visual = state.visual;
      if (visual) {
        const asset = assetsById.get(visual.assetId);
        if (!asset) {
          addIssue(
            issues,
            "missing-object-visual-asset",
            `${statePath}.visual.assetId`,
            `Object state '${state.id}' references missing asset '${visual.assetId}'.`,
          );
        } else {
          const expectedKind =
            visual.kind === "image" ? "image" : "spritesheet";
          if (asset.kind !== expectedKind) {
            addIssue(
              issues,
              "invalid-object-visual-asset-kind",
              `${statePath}.visual.assetId`,
              `Object state '${state.id}' requires a ${expectedKind} asset but '${asset.id}' is '${asset.kind}'.`,
            );
          }
        }
      }

      if (
        state.interactionShape &&
        Math.abs(polygonArea(state.interactionShape.points)) < 1e-7
      ) {
        addIssue(
          issues,
          "degenerate-object-interaction-shape",
          `${statePath}.interactionShape`,
          `Object state '${state.id}' interaction shape has no usable area.`,
        );
      }

      state.interactions.forEach((interaction, interactionIndex) => {
        const interactionPath = `${statePath}.interactions[${interactionIndex}]`;
        registerId(ids, issues, interaction.id, `${interactionPath}.id`);
        interaction.actions.forEach((action, actionIndex) =>
          validateInteractionAction(
            action,
            `${interactionPath}.actions[${actionIndex}]`,
            actionContext,
            issues,
          ),
        );
      });
    });

    if (!stateIds.has(definition.initialStateId)) {
      addIssue(
        issues,
        "missing-object-state",
        `${definitionPath}.initialStateId`,
        `Object definition '${definition.id}' initial state '${definition.initialStateId}' is missing.`,
      );
    }
  });

  const composedScenes = new Set<string>();
  manifest.scenes.forEach((composition, compositionIndex) => {
    const compositionPath = `scenes[${compositionIndex}]`;
    if (composedScenes.has(composition.sceneId)) {
      addIssue(
        issues,
        "duplicate-scene-composition",
        `${compositionPath}.sceneId`,
        `Scene '${composition.sceneId}' has more than one composition document.`,
      );
    }
    composedScenes.add(composition.sceneId);

    const scene = scenesById.get(composition.sceneId);
    if (!scene) {
      addIssue(
        issues,
        "missing-instance-scene",
        `${compositionPath}.sceneId`,
        `Scene composition references missing scene '${composition.sceneId}'.`,
      );
    }

    composition.actorInstances.forEach((instance, instanceIndex) => {
      const instancePath = `${compositionPath}.actorInstances[${instanceIndex}]`;
      registerId(ids, issues, instance.id, `${instancePath}.id`);
      const actor = actorsById.get(instance.actorId);
      if (!actor) {
        addIssue(
          issues,
          "missing-instance-actor",
          `${instancePath}.actorId`,
          `Actor instance '${instance.id}' references missing actor '${instance.actorId}'.`,
        );
      } else if (
        !actor.animations.some(
          (animation) =>
            animation.state === instance.animationState &&
            animation.facing === instance.facing,
        )
      ) {
        addIssue(
          issues,
          "missing-instance-animation",
          instancePath,
          `Actor '${actor.id}' has no '${instance.animationState}' animation facing '${instance.facing}'.`,
        );
      }

      if (
        scene &&
        instance.mobility === "walkable" &&
        !pointInsideNavigation(instance.position, scene.navigationAreas)
      ) {
        addIssue(
          issues,
          "invalid-actor-instance-position",
          `${instancePath}.position`,
          `Walkable actor instance '${instance.id}' is outside every navigation area in scene '${scene.id}'.`,
        );
      }
    });

    composition.objectInstances.forEach((instance, instanceIndex) => {
      const instancePath = `${compositionPath}.objectInstances[${instanceIndex}]`;
      registerId(ids, issues, instance.id, `${instancePath}.id`);
      const definition = definitionsById.get(instance.definitionId);
      if (!definition) {
        addIssue(
          issues,
          "missing-object-definition",
          `${instancePath}.definitionId`,
          `Object instance '${instance.id}' references missing definition '${instance.definitionId}'.`,
        );
        return;
      }

      const stateId = instance.initialStateId ?? definition.initialStateId;
      if (!definition.states.some((state) => state.id === stateId)) {
        addIssue(
          issues,
          "missing-object-state",
          `${instancePath}.initialStateId`,
          `Object instance '${instance.id}' references missing state '${stateId}'.`,
        );
      }
    });

    composition.navigationPortals.forEach((portal, portalIndex) => {
      const portalPath = `${compositionPath}.navigationPortals[${portalIndex}]`;
      registerId(ids, issues, portal.id, `${portalPath}.id`);
      if (!scene) {
        return;
      }
      const fromArea = scene.navigationAreas.find(
        (area) => area.id === portal.fromAreaId,
      );
      const toArea = scene.navigationAreas.find(
        (area) => area.id === portal.toAreaId,
      );
      if (!fromArea) {
        addIssue(
          issues,
          "missing-navigation-portal-area",
          `${portalPath}.fromAreaId`,
          `Navigation portal '${portal.id}' references missing area '${portal.fromAreaId}'.`,
        );
      } else if (!pointInPolygon(portal.fromPoint, fromArea.shape)) {
        addIssue(
          issues,
          "invalid-navigation-portal-point",
          `${portalPath}.fromPoint`,
          `Navigation portal '${portal.id}' start point is outside area '${fromArea.id}'.`,
        );
      }
      if (!toArea) {
        addIssue(
          issues,
          "missing-navigation-portal-area",
          `${portalPath}.toAreaId`,
          `Navigation portal '${portal.id}' references missing area '${portal.toAreaId}'.`,
        );
      } else if (!pointInPolygon(portal.toPoint, toArea.shape)) {
        addIssue(
          issues,
          "invalid-navigation-portal-point",
          `${portalPath}.toPoint`,
          `Navigation portal '${portal.id}' end point is outside area '${toArea.id}'.`,
        );
      }
    });
  });

  return issues;
};

export const sceneCompositionById = (
  manifest: SceneInstanceManifest,
): ReadonlyMap<string, SceneComposition> =>
  new Map(
    manifest.scenes.map(
      (composition) => [composition.sceneId as string, composition] as const,
    ),
  );
