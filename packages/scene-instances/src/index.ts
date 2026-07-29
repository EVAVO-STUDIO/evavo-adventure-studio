import { z } from "zod";
import {
  conditionSchema,
  idSchema,
  interactionSchema,
  pointSchema,
  polygonSchema,
  rectangleSchema,
  sizeSchema,
  type Actor,
  type Id,
  type NavigationArea,
  type Scene,
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

export const sceneCompositionSchema = z
  .object({
    sceneId: idSchema("scene"),
    actorInstances: z.array(sceneActorInstanceSchema).default([]),
    objectInstances: z.array(sceneObjectInstanceSchema).default([]),
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
  readonly kind: "image" | "spritesheet" | "audio" | "font" | "video" | "palette";
}

export interface SceneInstanceProjectContext {
  readonly projectId: Id<"project">;
  readonly scenes: readonly Pick<Scene, "id" | "navigationAreas">[];
  readonly actors: readonly Actor[];
  readonly assets: readonly SceneInstanceAssetReference[];
}

export type SceneInstanceIssueCode =
  | "scene-instance-project-mismatch"
  | "duplicate-scene-instance-id"
  | "duplicate-scene-composition"
  | "missing-instance-scene"
  | "missing-instance-actor"
  | "duplicate-actor-placement"
  | "missing-instance-animation"
  | "invalid-actor-instance-position"
  | "missing-object-definition"
  | "missing-object-state"
  | "missing-object-visual"
  | "missing-object-visual-asset"
  | "invalid-object-visual-asset-kind";

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

export const validateSceneInstanceManifest = (
  context: SceneInstanceProjectContext,
  manifest: SceneInstanceManifest,
): readonly SceneInstanceIssue[] => {
  const issues: SceneInstanceIssue[] = [];
  const ids = new Map<string, string>();
  const scenesById = new Map(context.scenes.map((scene) => [scene.id as string, scene]));
  const actorsById = new Map(context.actors.map((actor) => [actor.id as string, actor]));
  const assetsById = new Map(context.assets.map((asset) => [asset.id as string, asset]));
  const definitionsById = new Map(
    manifest.objectDefinitions.map((definition) => [definition.id as string, definition]),
  );

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

      if (state.visual) {
        const asset = assetsById.get(state.visual.assetId);
        if (!asset) {
          addIssue(
            issues,
            "missing-object-visual-asset",
            `${statePath}.visual.assetId`,
            `Object state '${state.id}' references missing asset '${state.visual.assetId}'.`,
          );
        } else {
          const expectedKind = state.visual.kind === "image" ? "image" : "spritesheet";
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

      state.interactions.forEach((interaction, interactionIndex) =>
        registerId(
          ids,
          issues,
          interaction.id,
          `${statePath}.interactions[${interactionIndex}].id`,
        ),
      );
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

    const actorDefinitionsInScene = new Set<string>();
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

      if (actorDefinitionsInScene.has(instance.actorId)) {
        addIssue(
          issues,
          "duplicate-actor-placement",
          `${instancePath}.actorId`,
          `Actor '${instance.actorId}' is placed more than once in scene '${composition.sceneId}'.`,
        );
      }
      actorDefinitionsInScene.add(instance.actorId);

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
  });

  return issues;
};

export const sceneCompositionById = (
  manifest: SceneInstanceManifest,
): ReadonlyMap<string, SceneComposition> =>
  new Map(manifest.scenes.map((composition) => [composition.sceneId as string, composition]));
