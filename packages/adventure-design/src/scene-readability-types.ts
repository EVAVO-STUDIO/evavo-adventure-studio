import type { AdventureProject, Id, Point, Size } from "@evavo/adventure-project-schema";
import type { AdventureDesignId } from "./types.js";

export type AdventureSceneReadabilityArea =
  | "native-canvas"
  | "navigation"
  | "depth"
  | "entrances"
  | "hotspots"
  | "occlusion"
  | "composition";

export type AdventureSceneReadabilitySeverity = "error" | "warning" | "note";
export type AdventureSceneReadabilityStatus = "ready" | "attention" | "blocked";

export interface AdventureSceneReadabilityFinding {
  readonly id: string;
  readonly area: AdventureSceneReadabilityArea;
  readonly severity: AdventureSceneReadabilitySeverity;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
  readonly impact: number;
}

export interface AdventureSceneReadabilityMetrics {
  readonly canvasArea: number;
  readonly navigationCoveragePercent: number;
  readonly hotspotCoveragePercent: number;
  readonly walkableVerticalSpanPercent: number;
  readonly navigationAreaCount: number;
  readonly depthBandCount: number;
  readonly entranceCount: number;
  readonly hotspotCount: number;
  readonly exitHotspotCount: number;
  readonly occluderCount: number;
}

export interface AdventureSceneReadabilityOverlay {
  readonly nativeSize: Size;
  readonly navigationAreas: readonly {
    readonly id: Id<"navigation-area">;
    readonly elevation: number;
    readonly points: readonly Point[];
  }[];
  readonly depthBands: readonly {
    readonly id: Id<"depth-band">;
    readonly farY: number;
    readonly nearY: number;
    readonly farScale: number;
    readonly nearScale: number;
  }[];
  readonly entrances: readonly {
    readonly id: Id<"entrance">;
    readonly position: Point;
    readonly facing: string;
  }[];
  readonly hotspots: readonly {
    readonly id: Id<"hotspot">;
    readonly name: string;
    readonly points: readonly Point[];
    readonly walkTo?: Point;
    readonly interactionCount: number;
    readonly changesScene: boolean;
  }[];
  readonly occluders: readonly {
    readonly id: Id<"occluder">;
    readonly position: Point;
    readonly baselineY: number;
    readonly mask?: readonly Point[];
  }[];
}

export interface AdventureSceneDesignLink {
  readonly locationId: AdventureDesignId<"location">;
  readonly locationName: string;
  readonly artBrief: string;
  readonly arrivalBeat: string;
}

export interface AdventureSceneReadabilityReport {
  readonly reportVersion: 1;
  readonly projectId: Id<"project">;
  readonly sceneId: Id<"scene">;
  readonly sceneName: string;
  readonly score: number;
  readonly maximumScore: 100;
  readonly status: AdventureSceneReadabilityStatus;
  readonly metrics: AdventureSceneReadabilityMetrics;
  readonly findings: readonly AdventureSceneReadabilityFinding[];
  readonly overlay: AdventureSceneReadabilityOverlay;
  readonly designLink: AdventureSceneDesignLink | null;
}

export class AdventureSceneReadabilityError extends Error {
  readonly sceneId: string;

  constructor(sceneId: string) {
    super(`Scene '${sceneId}' does not exist in the project.`);
    this.name = "AdventureSceneReadabilityError";
    this.sceneId = sceneId;
  }
}

export type AdventureScene = AdventureProject["scenes"][number];

export const sceneReadabilitySeverityOrder = {
  error: 0,
  warning: 1,
  note: 2,
} as const;

export const addSceneReadabilityFinding = (
  findings: AdventureSceneReadabilityFinding[],
  finding: AdventureSceneReadabilityFinding,
): void => {
  findings.push(finding);
};
