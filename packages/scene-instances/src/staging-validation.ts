import type { Actor, Id, Scene, Sequence } from "@evavo/adventure-project-schema";
import { pointInPolygon } from "@evavo/adventure-scene";
import type { SceneInstanceManifest } from "./index.js";
import type { SceneStagingManifest } from "./staging.js";

export type SceneStagingIssueCode =
  | "scene-staging-project-mismatch"
  | "duplicate-scene-staging"
  | "missing-staging-scene"
  | "missing-staging-actor"
  | "missing-staging-navigation-area"
  | "missing-staging-object"
  | "invalid-staging-approach-position"
  | "missing-staging-approach-slot"
  | "missing-staging-interaction"
  | "missing-staging-sequence"
  | "missing-staging-entrance";

export interface SceneStagingIssue {
  readonly severity: "error";
  readonly code: SceneStagingIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface SceneStagingValidationContext {
  readonly projectId: Id<"project">;
  readonly scenes: readonly Pick<Scene, "id" | "navigationAreas" | "entrances">[];
  readonly actors: readonly Pick<Actor, "id">[];
  readonly sequences?: readonly Pick<Sequence, "id">[];
  readonly sceneInstances?: SceneInstanceManifest;
}

const addIssue = (
  issues: SceneStagingIssue[],
  code: SceneStagingIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

export const validateSceneStagingManifest = (
  context: SceneStagingValidationContext,
  manifest: SceneStagingManifest,
): readonly SceneStagingIssue[] => {
  const issues: SceneStagingIssue[] = [];
  if (manifest.projectId !== context.projectId) {
    addIssue(
      issues,
      "scene-staging-project-mismatch",
      "projectId",
      `Scene staging project '${manifest.projectId}' does not match '${context.projectId}'.`,
    );
  }

  const scenesById = new Map(context.scenes.map((scene) => [scene.id as string, scene] as const));
  const actors = new Set(context.actors.map((actor) => actor.id as string));
  const sequences = new Set((context.sequences ?? []).map((sequence) => sequence.id as string));
  const compositionsBySceneId = new Map(
    (context.sceneInstances?.scenes ?? []).map(
      (composition) => [composition.sceneId as string, composition] as const,
    ),
  );
  const definitionsById = new Map(
    (context.sceneInstances?.objectDefinitions ?? []).map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );
  const stagedScenes = new Set<string>();

  manifest.scenes.forEach((staging, stagingIndex) => {
    const path = `scenes[${stagingIndex}]`;
    if (stagedScenes.has(staging.sceneId)) {
      addIssue(
        issues,
        "duplicate-scene-staging",
        `${path}.sceneId`,
        `Scene '${staging.sceneId}' has more than one staging document.`,
      );
    }
    stagedScenes.add(staging.sceneId);

    const scene = scenesById.get(staging.sceneId);
    if (!scene) {
      addIssue(
        issues,
        "missing-staging-scene",
        `${path}.sceneId`,
        `Scene staging references missing scene '${staging.sceneId}'.`,
      );
      return;
    }
    const areaIds = new Set(scene.navigationAreas.map((area) => area.id as string));
    const composition = compositionsBySceneId.get(staging.sceneId);
    const objectsById = new Map(
      (composition?.objectInstances ?? []).map((instance) => [instance.id as string, instance] as const),
    );
    const approachSlots = new Set<string>();

    for (const actorId of Object.keys(staging.actorFootprints)) {
      if (!actors.has(actorId)) {
        addIssue(
          issues,
          "missing-staging-actor",
          `${path}.actorFootprints.${actorId}`,
          `Actor footprint references missing actor '${actorId}'.`,
        );
      }
    }

    staging.navigationScaleOverrides.forEach((override, index) => {
      if (!areaIds.has(override.areaId)) {
        addIssue(
          issues,
          "missing-staging-navigation-area",
          `${path}.navigationScaleOverrides[${index}].areaId`,
          `Scale override references missing navigation area '${override.areaId}'.`,
        );
      }
    });

    for (const [objectId, slots] of Object.entries(staging.approachSlotsByObject)) {
      if (!objectsById.has(objectId)) {
        addIssue(
          issues,
          "missing-staging-object",
          `${path}.approachSlotsByObject.${objectId}`,
          `Approach slots reference object '${objectId}' that is not placed in scene '${scene.id}'.`,
        );
      }
      slots.forEach((slot, slotIndex) => {
        approachSlots.add(slot.id);
        if (!scene.navigationAreas.some((area) => pointInPolygon(slot.position, area.shape))) {
          addIssue(
            issues,
            "invalid-staging-approach-position",
            `${path}.approachSlotsByObject.${objectId}[${slotIndex}].position`,
            `Approach slot '${slot.id}' is outside every navigation area in scene '${scene.id}'.`,
          );
        }
      });
    }

    for (const objectId of Object.keys(staging.interactionComfortRegionsByObject)) {
      if (!objectsById.has(objectId)) {
        addIssue(
          issues,
          "missing-staging-object",
          `${path}.interactionComfortRegionsByObject.${objectId}`,
          `Interaction comfort regions reference object '${objectId}' that is not placed in scene '${scene.id}'.`,
        );
      }
    }

    staging.interactionChoreographies.forEach((choreography, index) => {
      const choreographyPath = `${path}.interactionChoreographies[${index}]`;
      for (const slotId of choreography.approachSlotIds) {
        if (!approachSlots.has(slotId)) {
          addIssue(
            issues,
            "missing-staging-approach-slot",
            `${choreographyPath}.approachSlotIds`,
            `Choreography '${choreography.id}' references missing approach slot '${slotId}'.`,
          );
        }
      }

      const interactionExists = [...objectsById.values()].some((instance) => {
        const definition = definitionsById.get(instance.definitionId);
        return definition?.states.some((state) =>
          state.interactions.some((interaction) => interaction.id === choreography.interactionId),
        );
      });
      if (!interactionExists) {
        addIssue(
          issues,
          "missing-staging-interaction",
          `${choreographyPath}.interactionId`,
          `Choreography '${choreography.id}' references missing interaction '${choreography.interactionId}'.`,
        );
      }

      choreography.beats.forEach((beat, beatIndex) => {
        if (beat.kind === "sequence" && !sequences.has(beat.sequenceId)) {
          addIssue(
            issues,
            "missing-staging-sequence",
            `${choreographyPath}.beats[${beatIndex}].sequenceId`,
            `Choreography '${choreography.id}' references missing sequence '${beat.sequenceId}'.`,
          );
        }
        if (beat.kind === "object-state" && !objectsById.has(beat.objectId)) {
          addIssue(
            issues,
            "missing-staging-object",
            `${choreographyPath}.beats[${beatIndex}].objectId`,
            `Choreography '${choreography.id}' references object '${beat.objectId}' outside this scene.`,
          );
        }
      });
    });

    staging.entryChoreographies.forEach((entry, index) => {
      if (!scene.entrances.some((entrance) => entrance.id === entry.entranceId)) {
        addIssue(
          issues,
          "missing-staging-entrance",
          `${path}.entryChoreographies[${index}].entranceId`,
          `Entry choreography references missing entrance '${entry.entranceId}'.`,
        );
      }
    });
  });

  return issues;
};
