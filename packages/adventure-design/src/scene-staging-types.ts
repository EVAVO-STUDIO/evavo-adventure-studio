import type { Id, Point, Polygon, Rectangle, Size } from "@evavo/adventure-project-schema";
import type { SceneObjectInstance } from "@evavo/adventure-scene-instances";
import type { AdventureDesignId } from "./types.js";

export type AdventureSceneStagingArea =
  | "manifest"
  | "control"
  | "actors"
  | "objects"
  | "portals"
  | "layers"
  | "interaction"
  | "depth"
  | "occlusion"
  | "surface"
  | "light"
  | "entry";

export type AdventureSceneStagingSeverity = "error" | "warning" | "note";
export type AdventureSceneStagingStatus = "ready" | "attention" | "blocked";

export interface AdventureSceneStagingFinding {
  readonly id: string;
  readonly area: AdventureSceneStagingArea;
  readonly severity: AdventureSceneStagingSeverity;
  readonly impact: number;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export interface AdventureActorStagingMarker {
  readonly instanceId: Id<"actor-instance">;
  readonly actorId: Id<"actor">;
  readonly actorName: string;
  readonly position: Point;
  readonly facing: string;
  readonly animationState: string;
  readonly mobility: "walkable" | "fixed";
  readonly elevation: number;
  readonly zOffset: number;
  readonly depthScale: number;
  readonly scaleMultiplier: number;
  readonly bounds: Rectangle | null;
  readonly controlledCandidate: boolean;
}

export interface AdventureObjectStagingMarker {
  readonly instanceId: Id<"object">;
  readonly definitionId: Id<"object-definition">;
  readonly definitionName: string;
  readonly stateId: Id<"object-state"> | null;
  readonly position: Point;
  readonly layer: SceneObjectInstance["layer"];
  readonly elevation: number;
  readonly zOffset: number;
  readonly scaleMultiplier: number;
  readonly mirrored: boolean;
  readonly visible: boolean;
  readonly interactive: boolean;
  readonly visualKind: "image" | "sprite-frame" | null;
  readonly visualResolved: boolean;
  readonly opacity: number;
  readonly bounds: Rectangle | null;
  readonly interactionShape: Polygon | null;
  readonly walkTo: Point | null;
}

export interface AdventurePortalStagingMarker {
  readonly id: Id<"navigation-portal">;
  readonly fromAreaId: Id<"navigation-area">;
  readonly toAreaId: Id<"navigation-area">;
  readonly fromPoint: Point;
  readonly toPoint: Point;
  readonly bidirectional: boolean;
  readonly traversalCost: number;
  readonly traversalAnimationState: string | null;
}

export interface AdventureSceneStagingLayerNode {
  readonly id: string;
  readonly kind: "actor" | "object";
  readonly label: string;
  readonly layer: "rear-ambient" | "world" | "occlusion" | "front-ambient";
  readonly elevation: number;
  readonly baselineY: number;
  readonly zOffset: number;
}

export interface AdventureSceneStagingOverlay {
  readonly nativeSize: Size;
  readonly navigationAreas: readonly {
    readonly id: Id<"navigation-area">;
    readonly elevation: number;
    readonly points: readonly Point[];
  }[];
  readonly entrances: readonly {
    readonly id: Id<"entrance">;
    readonly position: Point;
    readonly facing: string;
  }[];
  readonly actors: readonly AdventureActorStagingMarker[];
  readonly objects: readonly AdventureObjectStagingMarker[];
  readonly portals: readonly AdventurePortalStagingMarker[];
  readonly layerOrder: readonly AdventureSceneStagingLayerNode[];
}

export interface AdventureSceneStagingMetrics {
  readonly actorCount: number;
  readonly walkableActorCount: number;
  readonly fixedActorCount: number;
  readonly objectCount: number;
  readonly visibleObjectCount: number;
  readonly interactiveObjectCount: number;
  readonly portalCount: number;
  readonly occupiedLayerCount: number;
  readonly unresolvedVisualCount: number;
}

export interface AdventureSceneStagingDesignLink {
  readonly locationId: AdventureDesignId<"location">;
  readonly locationName: string;
  readonly artBrief: string;
  readonly arrivalBeat: string;
}

export interface AdventureSceneStagingReport {
  readonly reportVersion: 1;
  readonly projectId: Id<"project">;
  readonly sceneId: Id<"scene">;
  readonly sceneName: string;
  readonly score: number;
  readonly maximumScore: 100;
  readonly status: AdventureSceneStagingStatus;
  readonly metrics: AdventureSceneStagingMetrics;
  readonly findings: readonly AdventureSceneStagingFinding[];
  readonly overlay: AdventureSceneStagingOverlay;
  readonly designLink: AdventureSceneStagingDesignLink | null;
}

export class AdventureSceneStagingError extends Error {
  readonly sceneId: Id<"scene">;

  constructor(sceneId: Id<"scene">) {
    super(`Scene '${sceneId}' does not exist in the project.`);
    this.name = "AdventureSceneStagingError";
    this.sceneId = sceneId;
  }
}
