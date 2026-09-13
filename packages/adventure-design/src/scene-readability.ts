import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import {
  evaluateSceneCanvas,
  evaluateSceneDepth,
  evaluateSceneEntrances,
  evaluateSceneNavigation,
} from "./scene-readability-foundation.js";
import {
  adventurePolygonCoveragePercent,
  adventurePolygonVerticalSpanPercent,
  createAdventureSceneOverlay,
  hotspotChangesScene,
  pointInAdventurePolygon,
} from "./scene-readability-geometry.js";
import {
  evaluateSceneComposition,
  evaluateSceneHotspots,
  evaluateSceneOcclusion,
} from "./scene-readability-interaction.js";
import {
  type AdventureSceneDesignLink,
  AdventureSceneReadabilityError,
  type AdventureSceneReadabilityFinding,
  type AdventureSceneReadabilityReport,
  type AdventureSceneReadabilityStatus,
  sceneReadabilitySeverityOrder,
} from "./scene-readability-types.js";
import type { AdventureDesignDocument } from "./types.js";

export * from "./scene-readability-geometry.js";
export * from "./scene-readability-types.js";

const designLinkFor = (
  design: AdventureDesignDocument | undefined,
  sceneId: Id<"scene">,
): AdventureSceneDesignLink | null => {
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

export const evaluateAdventureSceneReadability = (
  project: AdventureProject,
  sceneId: Id<"scene">,
  design?: AdventureDesignDocument,
): AdventureSceneReadabilityReport => {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new AdventureSceneReadabilityError(sceneId);

  const size = { width: scene.width, height: scene.height };
  const navigationCoverage = adventurePolygonCoveragePercent(
    scene.navigationAreas.map((area) => area.shape),
    size,
  );
  const hotspotCoverage = adventurePolygonCoveragePercent(
    scene.hotspots.map((hotspot) => hotspot.shape),
    size,
  );
  const verticalSpan = adventurePolygonVerticalSpanPercent(
    scene.navigationAreas.map((area) => area.shape),
    size.height,
  );
  const exitHotspotCount = scene.hotspots.filter((_, index) => hotspotChangesScene(scene, index)).length;
  const findings: AdventureSceneReadabilityFinding[] = [];
  const designLink = design && design.projectId === project.id ? designLinkFor(design, scene.id) : null;

  evaluateSceneCanvas(project, scene, findings);
  evaluateSceneNavigation(scene, size, navigationCoverage, verticalSpan, findings);
  evaluateSceneEntrances(scene, size, findings);
  evaluateSceneDepth(scene, size, findings);
  evaluateSceneHotspots(project, scene, size, hotspotCoverage, findings);
  evaluateSceneOcclusion(scene, size, findings);
  evaluateSceneComposition(project, scene, design, designLink, findings);

  const sorted = [...findings].sort(
    (left, right) =>
      sceneReadabilitySeverityOrder[left.severity] - sceneReadabilitySeverityOrder[right.severity] ||
      left.area.localeCompare(right.area) ||
      left.path.localeCompare(right.path) ||
      left.id.localeCompare(right.id),
  );
  const score = Math.max(0, 100 - sorted.reduce((total, finding) => total + finding.impact, 0));
  const status: AdventureSceneReadabilityStatus = sorted.some((finding) => finding.severity === "error")
    ? "blocked"
    : sorted.some((finding) => finding.severity === "warning") || score < 90
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    projectId: project.id,
    sceneId: scene.id,
    sceneName: scene.name,
    score,
    maximumScore: 100,
    status,
    metrics: {
      canvasArea: scene.width * scene.height,
      navigationCoveragePercent: navigationCoverage,
      hotspotCoveragePercent: hotspotCoverage,
      walkableVerticalSpanPercent: verticalSpan,
      navigationAreaCount: scene.navigationAreas.length,
      depthBandCount: scene.depthBands.length,
      entranceCount: scene.entrances.length,
      hotspotCount: scene.hotspots.length,
      exitHotspotCount,
      occluderCount: scene.occluders.length,
    },
    findings: sorted,
    overlay: createAdventureSceneOverlay(scene),
    designLink,
  };
};

export const createAdventureSceneReadabilityReports = (
  project: AdventureProject,
  design?: AdventureDesignDocument,
): readonly AdventureSceneReadabilityReport[] =>
  project.scenes.map((scene) => evaluateAdventureSceneReadability(project, scene.id, design));
