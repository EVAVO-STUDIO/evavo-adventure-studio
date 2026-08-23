import type { AdventureProject, Id, Point } from "@evavo/adventure-project-schema";
import type { SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import type {
  ActorFootprint,
  ApproachSlot,
  InteractionComfortRegion,
  SceneStaging,
  SceneStagingManifest,
} from "@evavo/adventure-scene-instances/staging";

export type SceneDirectorMode =
  | "art"
  | "walk"
  | "control"
  | "depth"
  | "occlusion"
  | "hotspots"
  | "approach"
  | "actors"
  | "surface"
  | "light"
  | "entry"
  | "debug";

export const sceneDirectorModes: readonly SceneDirectorMode[] = [
  "art",
  "walk",
  "control",
  "depth",
  "occlusion",
  "hotspots",
  "approach",
  "actors",
  "surface",
  "light",
  "entry",
  "debug",
] as const;

export interface SceneDirectorActor {
  readonly instanceId: Id<"actor-instance">;
  readonly actorId: Id<"actor">;
  readonly name: string;
  readonly position: Point;
  readonly facing: string;
  readonly mobility: "fixed" | "walkable";
  readonly footprint: ActorFootprint | null;
}

export interface SceneDirectorObject {
  readonly instanceId: Id<"object">;
  readonly definitionId: Id<"object-definition">;
  readonly name: string;
  readonly position: Point;
  readonly approachSlots: readonly ApproachSlot[];
  readonly comfortRegions: readonly InteractionComfortRegion[];
}

export interface SceneDirectorOverlay {
  readonly sceneId: Id<"scene">;
  readonly sceneName: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly navigationAreas: AdventureProject["scenes"][number]["navigationAreas"];
  readonly depthBands: AdventureProject["scenes"][number]["depthBands"];
  readonly entrances: AdventureProject["scenes"][number]["entrances"];
  readonly portals: SceneInstanceManifest["scenes"][number]["navigationPortals"];
  readonly actors: readonly SceneDirectorActor[];
  readonly objects: readonly SceneDirectorObject[];
  readonly staging: SceneStaging | null;
}

const sceneStagingFor = (
  staging: SceneStagingManifest | null | undefined,
  sceneId: Id<"scene">,
): SceneStaging | null => staging?.scenes.find((candidate) => candidate.sceneId === sceneId) ?? null;

export const createSceneDirectorOverlay = (
  project: AdventureProject,
  instances: SceneInstanceManifest,
  staging: SceneStagingManifest | null | undefined,
  sceneId: Id<"scene">,
): SceneDirectorOverlay => {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Scene Director cannot find scene '${sceneId}'.`);
  const composition = instances.scenes.find((candidate) => candidate.sceneId === sceneId);
  const staged = sceneStagingFor(staging, sceneId);
  const actorsById = new Map(project.actors.map((actor) => [actor.id as string, actor] as const));
  const definitionsById = new Map(
    instances.objectDefinitions.map((definition) => [definition.id as string, definition] as const),
  );

  const actors: SceneDirectorActor[] = (composition?.actorInstances ?? []).map((instance) => ({
    instanceId: instance.id,
    actorId: instance.actorId,
    name: actorsById.get(instance.actorId)?.name ?? instance.actorId,
    position: instance.position,
    facing: instance.facing,
    mobility: instance.mobility,
    footprint: staged?.actorFootprints[instance.actorId] ?? null,
  }));

  const objects: SceneDirectorObject[] = (composition?.objectInstances ?? []).map((instance) => ({
    instanceId: instance.id,
    definitionId: instance.definitionId,
    name: definitionsById.get(instance.definitionId)?.name ?? instance.definitionId,
    position: instance.position,
    approachSlots: staged?.approachSlotsByObject[instance.id] ?? [],
    comfortRegions: staged?.interactionComfortRegionsByObject[instance.id] ?? [],
  }));

  return {
    sceneId: scene.id,
    sceneName: scene.name,
    nativeSize: { width: scene.width, height: scene.height },
    navigationAreas: scene.navigationAreas,
    depthBands: scene.depthBands,
    entrances: scene.entrances,
    portals: composition?.navigationPortals ?? [],
    actors,
    objects,
    staging: staged,
  };
};

export interface SceneDirectorModeSummary {
  readonly label: string;
  readonly count: number;
  readonly note: string;
}

export const sceneDirectorModeSummary = (
  overlay: SceneDirectorOverlay,
  mode: SceneDirectorMode,
): SceneDirectorModeSummary => {
  const staging = overlay.staging;
  switch (mode) {
    case "art":
      return { label: "Art", count: 1, note: "Native room composition and final-pixel review." };
    case "walk":
      return {
        label: "Walk",
        count: overlay.navigationAreas.length + (staging?.preferredWalkLanes.length ?? 0),
        note: "Reachable floor, portals, preferred lanes and actor clearance.",
      };
    case "control":
      return {
        label: "Control",
        count: overlay.portals.length + (staging?.navigationStateModifiers.length ?? 0),
        note: "Traversal gates and state-driven room geometry.",
      };
    case "depth":
      return {
        label: "Depth",
        count: (staging?.depthScaleCurves.length ?? 0) + (staging?.navigationScaleOverrides.length ?? 0),
        note: "Painted perspective, scale curves and area overrides.",
      };
    case "occlusion":
      return {
        label: "Occlusion",
        count: staging?.occlusionPlanes.length ?? 0,
        note: "Foreground priority planes and actor baseline crossings.",
      };
    case "hotspots":
      return {
        label: "Hotspots",
        count: overlay.objects.reduce((total, object) => total + object.comfortRegions.length, 0),
        note: "Exact targets plus invisible native click comfort.",
      };
    case "approach":
      return {
        label: "Approach",
        count: overlay.objects.reduce((total, object) => total + object.approachSlots.length, 0),
        note: "Verb/item-specific standing positions and arrival facing.",
      };
    case "actors":
      return {
        label: "Actors",
        count: overlay.actors.length,
        note: "Foot anchors, footprints, facing and mobility.",
      };
    case "surface":
      return {
        label: "Surface",
        count: staging?.surfaceZones.length ?? 0,
        note: "Material zones, footstep cues and movement treatment.",
      };
    case "light":
      return {
        label: "Light",
        count: staging?.paletteLightZones.length ?? 0,
        note: "Palette-remap regions and ordered-dither transitions.",
      };
    case "entry":
      return {
        label: "Entry",
        count: staging?.entryChoreographies.length ?? 0,
        note: "Spawn, entry path, arrival pose and control handoff.",
      };
    case "debug":
      return {
        label: "Debug",
        count: overlay.actors.length + overlay.objects.length + overlay.portals.length,
        note: "Stable IDs and all authored scene contracts together.",
      };
  }
};
