import type { AdventureProject, Id, Point, Polygon } from "@evavo/adventure-project-schema";
import {
  type ActorFootprint,
  type ApproachSlot,
  type EntryChoreography,
  type SceneStaging,
  type SceneStagingManifest,
  sceneStagingManifestSchema,
} from "@evavo/adventure-scene-instances/staging";

export type SceneDirectorEditCommand =
  | {
      readonly kind: "set-actor-footprint";
      readonly sceneId: Id<"scene">;
      readonly actorId: Id<"actor">;
      readonly footprint: ActorFootprint;
    }
  | {
      readonly kind: "set-walk-lane-points";
      readonly sceneId: Id<"scene">;
      readonly laneId: Id<"preferred-walk-lane">;
      readonly points: readonly Point[];
    }
  | {
      readonly kind: "move-approach-slot";
      readonly sceneId: Id<"scene">;
      readonly objectId: Id<"object">;
      readonly slotId: Id<"approach-slot">;
      readonly position: Point;
      readonly facing?: ApproachSlot["facing"];
    }
  | {
      readonly kind: "set-depth-key";
      readonly sceneId: Id<"scene">;
      readonly curveId: Id<"depth-scale-curve">;
      readonly keyIndex: number;
      readonly y: number;
      readonly scale: number;
    }
  | {
      readonly kind: "set-occlusion-baseline";
      readonly sceneId: Id<"scene">;
      readonly planeId: Id<"occlusion-plane">;
      readonly baselineY: number;
    }
  | {
      readonly kind: "set-light-zone-shape";
      readonly sceneId: Id<"scene">;
      readonly zoneId: Id<"palette-light-zone">;
      readonly shape: Polygon;
    }
  | {
      readonly kind: "set-surface-zone-shape";
      readonly sceneId: Id<"scene">;
      readonly zoneId: Id<"surface-zone">;
      readonly shape: Polygon;
    }
  | {
      readonly kind: "set-entry-path";
      readonly sceneId: Id<"scene">;
      readonly entranceId: Id<"entrance">;
      readonly spawnPosition?: Point;
      readonly entryPath: readonly Point[];
    };

export class SceneDirectorEditError extends Error {
  readonly command: SceneDirectorEditCommand;

  constructor(command: SceneDirectorEditCommand, message: string) {
    super(message);
    this.name = "SceneDirectorEditError";
    this.command = command;
  }
}

const sceneFor = (project: AdventureProject, sceneId: Id<"scene">) => {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Scene Director edit references unknown scene '${sceneId}'.`);
  return scene;
};

const stagingFor = (
  manifest: SceneStagingManifest,
  sceneId: Id<"scene">,
): { readonly staging: SceneStaging; readonly index: number } => {
  const index = manifest.scenes.findIndex((candidate) => candidate.sceneId === sceneId);
  const staging = manifest.scenes[index];
  if (!staging) throw new Error(`Scene Director staging does not contain scene '${sceneId}'.`);
  return { staging, index };
};

const finitePoint = (point: Point): boolean => Number.isFinite(point.x) && Number.isFinite(point.y);

const assertNativePoint = (
  command: SceneDirectorEditCommand,
  point: Point,
  width: number,
  height: number,
  label: string,
): void => {
  if (!finitePoint(point) || point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
    throw new SceneDirectorEditError(
      command,
      `${label} (${point.x}, ${point.y}) must remain inside native scene bounds 0..${width} × 0..${height}.`,
    );
  }
};

const assertNativePolygon = (
  command: SceneDirectorEditCommand,
  shape: Polygon,
  width: number,
  height: number,
  label: string,
): void => {
  for (const point of shape.points) assertNativePoint(command, point, width, height, label);
};

const replaceScene = (
  manifest: SceneStagingManifest,
  sceneIndex: number,
  staging: SceneStaging,
): SceneStagingManifest =>
  sceneStagingManifestSchema.parse({
    ...manifest,
    scenes: manifest.scenes.map((candidate, index) => (index === sceneIndex ? staging : candidate)),
  });

const requireItem = <T>(
  command: SceneDirectorEditCommand,
  value: T | undefined,
  message: string,
): T => {
  if (value === undefined) throw new SceneDirectorEditError(command, message);
  return value;
};

const replaceEntryPath = (
  entry: EntryChoreography,
  command: Extract<SceneDirectorEditCommand, { readonly kind: "set-entry-path" }>,
): EntryChoreography => {
  const { spawnPosition: _previousSpawn, ...withoutSpawn } = entry;
  return {
    ...withoutSpawn,
    entryPath: [...command.entryPath],
    ...(command.spawnPosition ? { spawnPosition: command.spawnPosition } : {}),
  };
};

export const applySceneDirectorEdit = (
  project: AdventureProject,
  manifest: SceneStagingManifest,
  command: SceneDirectorEditCommand,
): SceneStagingManifest => {
  const scene = sceneFor(project, command.sceneId);
  const { staging, index: sceneIndex } = stagingFor(manifest, command.sceneId);

  switch (command.kind) {
    case "set-actor-footprint":
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        actorFootprints: {
          ...staging.actorFootprints,
          [command.actorId]: command.footprint,
        },
      });

    case "set-walk-lane-points": {
      if (command.points.length < 2) {
        throw new SceneDirectorEditError(command, "A preferred walk lane requires at least two native points.");
      }
      command.points.forEach((point) =>
        assertNativePoint(command, point, scene.width, scene.height, "Walk-lane point"),
      );
      const laneIndex = staging.preferredWalkLanes.findIndex((lane) => lane.id === command.laneId);
      const lane = requireItem(
        command,
        staging.preferredWalkLanes[laneIndex],
        `Preferred walk lane '${command.laneId}' was not found.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        preferredWalkLanes: staging.preferredWalkLanes.map((candidate, index) =>
          index === laneIndex ? { ...lane, points: [...command.points] } : candidate,
        ),
      });
    }

    case "move-approach-slot": {
      assertNativePoint(command, command.position, scene.width, scene.height, "Approach position");
      const slots = staging.approachSlotsByObject[command.objectId];
      if (!slots) {
        throw new SceneDirectorEditError(command, `Object '${command.objectId}' has no authored approach slots.`);
      }
      const slotIndex = slots.findIndex((slot) => slot.id === command.slotId);
      const slot = requireItem(
        command,
        slots[slotIndex],
        `Approach slot '${command.slotId}' was not found on '${command.objectId}'.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        approachSlotsByObject: {
          ...staging.approachSlotsByObject,
          [command.objectId]: slots.map((candidate, index) =>
            index === slotIndex
              ? {
                  ...slot,
                  position: command.position,
                  ...(command.facing ? { facing: command.facing } : {}),
                }
              : candidate,
          ),
        },
      });
    }

    case "set-depth-key": {
      if (!Number.isSafeInteger(command.keyIndex) || command.keyIndex < 0) {
        throw new SceneDirectorEditError(command, "Depth key index must be a non-negative safe integer.");
      }
      if (!Number.isFinite(command.y) || command.y < 0 || command.y > scene.height) {
        throw new SceneDirectorEditError(command, `Depth key Y must remain inside 0..${scene.height}.`);
      }
      if (!Number.isFinite(command.scale) || command.scale <= 0) {
        throw new SceneDirectorEditError(command, "Depth scale must be a positive finite number.");
      }
      const curveIndex = staging.depthScaleCurves.findIndex((curve) => curve.id === command.curveId);
      const curve = requireItem(
        command,
        staging.depthScaleCurves[curveIndex],
        `Depth scale curve '${command.curveId}' was not found.`,
      );
      requireItem(command, curve.keys[command.keyIndex], `Depth key ${command.keyIndex} was not found.`);
      const keys = curve.keys.map((key, index) =>
        index === command.keyIndex ? { y: command.y, scale: command.scale } : key,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        depthScaleCurves: staging.depthScaleCurves.map((candidate, index) =>
          index === curveIndex ? { ...curve, keys } : candidate,
        ),
      });
    }

    case "set-occlusion-baseline": {
      if (!Number.isFinite(command.baselineY) || command.baselineY < 0 || command.baselineY > scene.height) {
        throw new SceneDirectorEditError(
          command,
          `Occlusion baseline must remain inside native Y range 0..${scene.height}.`,
        );
      }
      const planeIndex = staging.occlusionPlanes.findIndex((plane) => plane.id === command.planeId);
      const plane = requireItem(
        command,
        staging.occlusionPlanes[planeIndex],
        `Occlusion plane '${command.planeId}' was not found.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        occlusionPlanes: staging.occlusionPlanes.map((candidate, index) =>
          index === planeIndex ? { ...plane, baselineY: command.baselineY } : candidate,
        ),
      });
    }

    case "set-light-zone-shape": {
      assertNativePolygon(command, command.shape, scene.width, scene.height, "Light-zone point");
      const zoneIndex = staging.paletteLightZones.findIndex((zone) => zone.id === command.zoneId);
      const zone = requireItem(
        command,
        staging.paletteLightZones[zoneIndex],
        `Palette-light zone '${command.zoneId}' was not found.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        paletteLightZones: staging.paletteLightZones.map((candidate, index) =>
          index === zoneIndex ? { ...zone, shape: command.shape } : candidate,
        ),
      });
    }

    case "set-surface-zone-shape": {
      assertNativePolygon(command, command.shape, scene.width, scene.height, "Surface-zone point");
      const zoneIndex = staging.surfaceZones.findIndex((zone) => zone.id === command.zoneId);
      const zone = requireItem(
        command,
        staging.surfaceZones[zoneIndex],
        `Surface zone '${command.zoneId}' was not found.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        surfaceZones: staging.surfaceZones.map((candidate, index) =>
          index === zoneIndex ? { ...zone, shape: command.shape } : candidate,
        ),
      });
    }

    case "set-entry-path": {
      for (const point of command.entryPath) {
        if (!finitePoint(point)) throw new SceneDirectorEditError(command, "Entry path contains a non-finite point.");
      }
      if (command.spawnPosition && !finitePoint(command.spawnPosition)) {
        throw new SceneDirectorEditError(command, "Entry spawn position must contain finite coordinates.");
      }
      const entryIndex = staging.entryChoreographies.findIndex(
        (entry) => entry.entranceId === command.entranceId,
      );
      const entry = requireItem(
        command,
        staging.entryChoreographies[entryIndex],
        `Entry choreography '${command.entranceId}' was not found.`,
      );
      return replaceScene(manifest, sceneIndex, {
        ...staging,
        entryChoreographies: staging.entryChoreographies.map((candidate, index) =>
          index === entryIndex ? replaceEntryPath(entry, command) : candidate,
        ),
      });
    }
  }
};

export interface SceneDirectorEditHistory {
  readonly past: readonly SceneStagingManifest[];
  readonly present: SceneStagingManifest;
  readonly future: readonly SceneStagingManifest[];
}

export const createSceneDirectorEditHistory = (
  manifest: SceneStagingManifest,
): SceneDirectorEditHistory => ({ past: [], present: manifest, future: [] });

export const commitSceneDirectorEdit = (
  project: AdventureProject,
  history: SceneDirectorEditHistory,
  command: SceneDirectorEditCommand,
): SceneDirectorEditHistory => {
  const next = applySceneDirectorEdit(project, history.present, command);
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
};

export const undoSceneDirectorEdit = (
  history: SceneDirectorEditHistory,
): SceneDirectorEditHistory => {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
};

export const redoSceneDirectorEdit = (
  history: SceneDirectorEditHistory,
): SceneDirectorEditHistory => {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
};
