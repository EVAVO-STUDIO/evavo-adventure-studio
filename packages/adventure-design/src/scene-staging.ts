import type { AdventureProject, Id, Scene } from "@evavo/adventure-project-schema";
import {
  type ObjectDefinition,
  type SceneComposition,
  type SceneInstanceIssue,
  type SceneInstanceManifest,
  validateSceneInstanceManifest,
} from "@evavo/adventure-scene-instances";
import type { SceneStagingManifest } from "@evavo/adventure-scene-instances/staging";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { evaluateSceneStagedActors } from "./scene-staging-actors.js";
import { addSceneStagingFinding, uniqueSortedSceneStagingFindings } from "./scene-staging-findings.js";
import { actorStagingMarker, objectStagingMarker, stageLayerOrder } from "./scene-staging-geometry.js";
import {
  evaluateSceneStagedLayers,
  evaluateSceneStagedObjects,
  evaluateSceneStagedPortals,
} from "./scene-staging-objects.js";
import {
  type AdventureActorStagingMarker,
  type AdventureObjectStagingMarker,
  type AdventurePortalStagingMarker,
  type AdventureSceneStagingDesignLink,
  AdventureSceneStagingError,
  type AdventureSceneStagingFinding,
  type AdventureSceneStagingOverlay,
  type AdventureSceneStagingReport,
  type AdventureSceneStagingStatus,
} from "./scene-staging-types.js";
import type { AdventureDesignDocument } from "./types.js";

export * from "./scene-staging-geometry.js";
export * from "./scene-staging-types.js";

const sceneSize = (scene: Scene) => ({
  width: scene.width,
  height: scene.height,
});

const designLinkFor = (
  design: AdventureDesignDocument | undefined,
  sceneId: Id<"scene">,
): AdventureSceneStagingDesignLink | null => {
  const location = design?.map.locations.find((candidate) => candidate.sceneId === sceneId);
  return location
    ? {
        locationId: location.id,
        locationName: location.name,
        artBrief: location.artBrief,
        arrivalBeat: location.arrivalBeat,
      }
    : null;
};

const canonicalContext = (project: AdventureProject) => ({
  projectId: project.id,
  scenes: project.scenes,
  actors: project.actors,
  assets: project.assets,
  inventoryItems: project.inventoryItems,
  dialogues: project.dialogues,
  sequences: project.sequences,
});

const issueRelevantToScene = (
  issue: SceneInstanceIssue,
  compositionIndex: number,
  definitionIndexes: ReadonlySet<number>,
): boolean => {
  if (issue.path === "projectId") return true;
  if (compositionIndex >= 0 && issue.path.startsWith(`scenes[${compositionIndex}]`)) {
    return true;
  }
  for (const index of definitionIndexes) {
    if (issue.path.startsWith(`objectDefinitions[${index}]`)) return true;
  }
  return false;
};

const appendCanonicalIssues = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  composition: SceneComposition | null,
  compositionIndex: number,
  findings: AdventureSceneStagingFinding[],
): void => {
  const definitionIds = new Set(composition?.objectInstances.map((instance) => instance.definitionId) ?? []);
  const definitionIndexes = new Set<number>();
  manifest.objectDefinitions.forEach((definition, index) => {
    if (definitionIds.has(definition.id)) definitionIndexes.add(index);
  });
  const issues = validateSceneInstanceManifest(canonicalContext(project), manifest);
  for (const issue of issues) {
    if (!issueRelevantToScene(issue, compositionIndex, definitionIndexes)) continue;
    addSceneStagingFinding(findings, {
      id: `canonical-${issue.code}-${issue.path}`,
      area: "manifest",
      severity: "error",
      impact: 18,
      path: issue.path,
      message: issue.message,
      recommendation:
        "Resolve the canonical scene-instance validation error before staging or runtime review.",
    });
  }
};

const appendDirectorStagingFindings = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  scene: Scene,
  composition: SceneComposition | null,
  actors: readonly AdventureActorStagingMarker[],
  objects: readonly AdventureObjectStagingMarker[],
  stagingManifest: SceneStagingManifest | undefined,
  findings: AdventureSceneStagingFinding[],
): void => {
  if (!stagingManifest) return;
  const stagingIndex = stagingManifest.scenes.findIndex((candidate) => candidate.sceneId === scene.id);
  const staging = stagingIndex >= 0 ? stagingManifest.scenes[stagingIndex] ?? null : null;

  for (const issue of validateSceneStagingManifest(
    {
      projectId: project.id,
      scenes: project.scenes,
      actors: project.actors,
      assets: project.assets,
      sequences: project.sequences,
      sceneInstances: manifest,
    },
    stagingManifest,
  )) {
    if (issue.path !== "projectId" && stagingIndex >= 0 && !issue.path.startsWith(`scenes[${stagingIndex}]`)) {
      continue;
    }
    if (issue.path !== "projectId" && stagingIndex < 0) continue;
    addSceneStagingFinding(findings, {
      id: `director-${issue.code}-${issue.path}`,
      area: "manifest",
      severity: "error",
      impact: 18,
      path: `sceneStaging.${issue.path}`,
      message: issue.message,
      recommendation: "Resolve the Scene Director staging error before packaging or final playtest.",
    });
  }

  if (!staging) {
    addSceneStagingFinding(findings, {
      id: "director-scene-staging-missing",
      area: "manifest",
      severity: scene.id === project.startSceneId ? "warning" : "note",
      impact: scene.id === project.startSceneId ? 6 : 2,
      path: "sceneStaging.scenes",
      message: `Scene '${scene.name}' has no Scene Director staging record.`,
      recommendation:
        "Add staging when the room needs authored clearance, approach, perspective, surface, lighting or entry behaviour.",
    });
    return;
  }

  for (const actor of actors.filter((candidate) => candidate.mobility === "walkable")) {
    if (staging.actorFootprints[actor.actorId]) continue;
    addSceneStagingFinding(findings, {
      id: `director-actor-footprint-${actor.instanceId}`,
      area: "actors",
      severity: "warning",
      impact: 6,
      path: `sceneStaging.scenes[${stagingIndex}].actorFootprints.${actor.actorId}`,
      message: `Walkable actor '${actor.actorName}' has no authored body-clearance footprint.`,
      recommendation:
        "Author width, floor depth and clearance so foot-point routing cannot visibly scrape scenery.",
    });
  }

  for (const object of objects.filter((candidate) => candidate.interactive && candidate.walkTo)) {
    if ((staging.approachSlotsByObject[object.instanceId] ?? []).length > 0) continue;
    addSceneStagingFinding(findings, {
      id: `director-object-approach-${object.instanceId}`,
      area: "interaction",
      severity: "note",
      impact: 2,
      path: `sceneStaging.scenes[${stagingIndex}].approachSlotsByObject.${object.instanceId}`,
      message: `Interactive object '${object.definitionName}' still relies on one legacy walk-to point.`,
      recommendation:
        "Add verb/item-specific approach slots when the object benefits from deliberate standing position or facing.",
    });
  }

  for (const entrance of scene.entrances) {
    if (staging.entryChoreographies.some((entry) => entry.entranceId === entrance.id)) continue;
    addSceneStagingFinding(findings, {
      id: `director-entry-${entrance.id}`,
      area: "entry",
      severity: "note",
      impact: 2,
      path: `sceneStaging.scenes[${stagingIndex}].entryChoreographies`,
      message: `Entrance '${entrance.id}' has no authored arrival choreography.`,
      recommendation:
        "Add a spawn/path/arrival beat when a direct placement would look abrupt or break foreground staging.",
    });
  }

  if (scene.depthBands.length > 0 && staging.navigationScaleOverrides.length === 0) {
    addSceneStagingFinding(findings, {
      id: "director-depth-legacy-only",
      area: "depth",
      severity: "note",
      impact: 2,
      path: `sceneStaging.scenes[${stagingIndex}].navigationScaleOverrides`,
      message: "The room still uses only legacy near/far depth interpolation.",
      recommendation:
        "Keep it when the painting is simple; add piecewise or fixed area scaling when the room uses stronger painted perspective.",
    });
  }

  if ((composition?.navigationPortals.length ?? 0) > 0 && staging.navigationStateModifiers.length === 0) {
    addSceneStagingFinding(findings, {
      id: "director-portals-without-state-modifier",
      area: "control",
      severity: "note",
      impact: 1,
      path: `sceneStaging.scenes[${stagingIndex}].navigationStateModifiers`,
      message: "The room has navigation portals but no object-state traversal modifiers.",
      recommendation:
        "No change is required for permanently open handoffs; bind doors, bridges or ladders when their visible state controls traversal.",
    });
  }
};

const portalMarkers = (composition: SceneComposition | null): readonly AdventurePortalStagingMarker[] =>
  composition?.navigationPortals.map((portal) => ({
    id: portal.id,
    fromAreaId: portal.fromAreaId,
    toAreaId: portal.toAreaId,
    fromPoint: { ...portal.fromPoint },
    toPoint: { ...portal.toPoint },
    bidirectional: portal.bidirectional,
    traversalCost: portal.traversalCost,
    traversalAnimationState: portal.traversalAnimationState ?? null,
  })) ?? [];

const createOverlay = (
  scene: Scene,
  actors: readonly AdventureActorStagingMarker[],
  objects: readonly AdventureObjectStagingMarker[],
  portals: readonly AdventurePortalStagingMarker[],
): AdventureSceneStagingOverlay => ({
  nativeSize: sceneSize(scene),
  navigationAreas: scene.navigationAreas.map((area) => ({
    id: area.id,
    elevation: area.elevation,
    points: area.shape.points.map((point) => ({ ...point })),
  })),
  entrances: scene.entrances.map((entrance) => ({
    id: entrance.id,
    position: { ...entrance.position },
    facing: entrance.facing,
  })),
  actors,
  objects,
  portals,
  layerOrder: stageLayerOrder(
    actors,
    objects.filter((object) => object.visible),
  ),
});

export const evaluateAdventureSceneStaging = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  sceneId: Id<"scene">,
  design?: AdventureDesignDocument,
  stagingManifest?: SceneStagingManifest,
): AdventureSceneStagingReport => {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new AdventureSceneStagingError(sceneId);
  const compositionIndex = manifest.scenes.findIndex((candidate) => candidate.sceneId === sceneId);
  const composition = compositionIndex >= 0 ? (manifest.scenes[compositionIndex] ?? null) : null;
  const definitions = new Map<string, ObjectDefinition>(
    manifest.objectDefinitions.map((definition) => [definition.id as string, definition] as const),
  );
  const actorDefinitions = new Map(project.actors.map((actor) => [actor.id as string, actor] as const));
  const actors =
    composition?.actorInstances.map((instance) =>
      actorStagingMarker(scene, actorDefinitions.get(instance.actorId), instance),
    ) ?? [];
  const objects =
    composition?.objectInstances.map((instance) =>
      objectStagingMarker(definitions.get(instance.definitionId), instance),
    ) ?? [];
  const portals = portalMarkers(composition);
  const findings: AdventureSceneStagingFinding[] = [];

  appendCanonicalIssues(project, manifest, composition, compositionIndex, findings);
  if (!composition) {
    addSceneStagingFinding(findings, {
      id: "manifest-scene-composition-missing",
      area: "manifest",
      severity: scene.id === project.startSceneId ? "error" : "note",
      impact: scene.id === project.startSceneId ? 28 : 4,
      path: "sceneInstances.scenes",
      message:
        scene.id === project.startSceneId
          ? "The start scene has no scene-composition record."
          : `Scene '${scene.name}' has no placed actor, object or portal composition.`,
      recommendation:
        scene.id === project.startSceneId
          ? "Author the start-scene composition and one unambiguous walkable player actor."
          : "Add a composition when this room needs actors, stateful props or navigation portals.",
    });
  }

  evaluateSceneStagedActors(project, scene, actors, findings);
  evaluateSceneStagedObjects(scene, objects, findings);
  evaluateSceneStagedPortals(scene, portals, objects, findings);
  evaluateSceneStagedLayers(actors, objects, findings);
  appendDirectorStagingFindings(
    project,
    manifest,
    scene,
    composition,
    actors,
    objects,
    stagingManifest,
    findings,
  );

  if (composition && actors.length + objects.length + portals.length === 0) {
    addSceneStagingFinding(findings, {
      id: "manifest-empty-scene-composition",
      area: "manifest",
      severity: "note",
      impact: 3,
      path: `scenes[${compositionIndex}]`,
      message: `Scene '${scene.name}' has an empty composition record.`,
      recommendation:
        "Remove the empty sidecar record or use it to author the room's actual staged instances.",
    });
  }

  const designLink = design && design.projectId === project.id ? designLinkFor(design, scene.id) : null;
  if (design && !designLink) {
    addSceneStagingFinding(findings, {
      id: "manifest-scene-without-design-location",
      area: "manifest",
      severity: "note",
      impact: 3,
      path: "design.map.locations",
      message: `Scene '${scene.name}' is not linked to an Adventure Design location.`,
      recommendation: "Link the room to its visual promise and arrival beat before final staging review.",
    });
  }

  const sorted = uniqueSortedSceneStagingFindings(findings);
  const score = Math.max(0, 100 - sorted.reduce((total, finding) => total + finding.impact, 0));
  const status: AdventureSceneStagingStatus = sorted.some((finding) => finding.severity === "error")
    ? "blocked"
    : sorted.some((finding) => finding.severity === "warning") || score < 90
      ? "attention"
      : "ready";
  const visibleObjects = objects.filter((object) => object.visible);
  const occupiedLayers = new Set([
    ...(actors.length > 0 ? ["world"] : []),
    ...visibleObjects.map((object) => object.layer),
  ]);

  return {
    reportVersion: 1,
    projectId: project.id,
    sceneId: scene.id,
    sceneName: scene.name,
    score,
    maximumScore: 100,
    status,
    metrics: {
      actorCount: actors.length,
      walkableActorCount: actors.filter((actor) => actor.mobility === "walkable").length,
      fixedActorCount: actors.filter((actor) => actor.mobility === "fixed").length,
      objectCount: objects.length,
      visibleObjectCount: visibleObjects.length,
      interactiveObjectCount: objects.filter((object) => object.interactive).length,
      portalCount: portals.length,
      occupiedLayerCount: occupiedLayers.size,
      unresolvedVisualCount:
        actors.filter((actor) => !actor.bounds).length +
        objects.filter((object) => object.visible && !object.visualResolved).length,
    },
    findings: sorted,
    overlay: createOverlay(scene, actors, objects, portals),
    designLink,
  };
};

export const createAdventureSceneStagingReports = (
  project: AdventureProject,
  manifest: SceneInstanceManifest,
  design?: AdventureDesignDocument,
  stagingManifest?: SceneStagingManifest,
): readonly AdventureSceneStagingReport[] =>
  project.scenes.map((scene) =>
    evaluateAdventureSceneStaging(project, manifest, scene.id, design, stagingManifest),
  );
