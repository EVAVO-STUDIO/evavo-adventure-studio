import type {
  AdventureProject,
  Size,
} from "@evavo/adventure-project-schema";
import {
  adventurePolygonArea,
  hotspotChangesScene,
  pointInsideSceneCanvas,
  pointInsideSceneNavigation,
  polygonInsideSceneCanvas,
} from "./scene-readability-geometry.js";
import {
  addSceneReadabilityFinding,
  type AdventureScene,
  type AdventureSceneDesignLink,
  type AdventureSceneReadabilityFinding,
} from "./scene-readability-types.js";
import type { AdventureDesignDocument } from "./types.js";

export const evaluateSceneHotspots = (
  project: AdventureProject,
  scene: AdventureScene,
  size: Size,
  hotspotCoverage: number,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  if (scene.hotspots.length === 0) {
    addSceneReadabilityFinding(findings, {
      id: "hotspots-not-yet-authored",
      area: "hotspots",
      severity: "note",
      path: `scenes.${scene.id}.hotspots`,
      message: "The scene has no source-project hotspots yet.",
      recommendation:
        "Add only consequential observations and actions; object-state interactions " +
        "may remain in the composition sidecar.",
      impact: 2,
    });
  }
  scene.hotspots.forEach((hotspot, index) => {
    const path = `scenes.${scene.id}.hotspots[${index}].shape`;
    const areaPixels = adventurePolygonArea(hotspot.shape);
    if (!polygonInsideSceneCanvas(hotspot.shape, size)) {
      addSceneReadabilityFinding(findings, {
        id: `hotspot-outside-canvas-${hotspot.id}`,
        area: "hotspots",
        severity: "error",
        path,
        message: `Hotspot '${hotspot.name}' extends outside the native canvas.`,
        recommendation: "Keep interaction geometry inside the visible authored scene.",
        impact: 8,
      });
    }
    if (areaPixels <= 0.5) {
      addSceneReadabilityFinding(findings, {
        id: `hotspot-degenerate-${hotspot.id}`,
        area: "hotspots",
        severity: "error",
        path,
        message: `Hotspot '${hotspot.name}' has no usable target area.`,
        recommendation: "Author a non-degenerate polygon that can be selected at native scale.",
        impact: 9,
      });
    } else if (areaPixels > size.width * size.height * 0.35) {
      addSceneReadabilityFinding(findings, {
        id: `hotspot-overbroad-${hotspot.id}`,
        area: "hotspots",
        severity: "warning",
        path,
        message: `Hotspot '${hotspot.name}' covers more than 35% of the native canvas.`,
        recommendation:
          "Tighten the target around the consequential object unless the whole region " +
          "is intentionally interactive.",
        impact: 4,
      });
    }
    if (hotspot.walkTo && !pointInsideSceneNavigation(scene, hotspot.walkTo)) {
      addSceneReadabilityFinding(findings, {
        id: `hotspot-walkto-unreachable-${hotspot.id}`,
        area: "hotspots",
        severity: "error",
        path: `scenes.${scene.id}.hotspots[${index}].walkTo`,
        message: `Hotspot '${hotspot.name}' has an unreachable walk-to point.`,
        recommendation:
          "Place the approach point inside navigation or remove it for an immediate interaction.",
        impact: 10,
      });
    }
    if (hotspot.interactions.length === 0 && !hotspot.fallbackText) {
      addSceneReadabilityFinding(findings, {
        id: `hotspot-without-response-${hotspot.id}`,
        area: "hotspots",
        severity: "note",
        path: `scenes.${scene.id}.hotspots[${index}]`,
        message: `Hotspot '${hotspot.name}' has no action or authored fallback response.`,
        recommendation:
          "Remove decorative hit geometry or give observation a project-specific response.",
        impact: 2,
      });
    }
  });
  if (hotspotCoverage > 55) {
    addSceneReadabilityFinding(findings, {
      id: "hotspot-coverage-heavy",
      area: "hotspots",
      severity: "warning",
      path: `scenes.${scene.id}.hotspots`,
      message: `Hotspots cover ${hotspotCoverage.toFixed(1)}% of the canvas.`,
      recommendation:
        "Check for giant invisible targets that replace observation with broad click-anywhere interaction.",
      impact: 5,
    });
  }
  const hasSceneChange = scene.hotspots.some((_, index) =>
    hotspotChangesScene(scene, index),
  );
  if (project.scenes.length > 1 && !hasSceneChange) {
    addSceneReadabilityFinding(findings, {
      id: "scene-exit-not-in-source-hotspots",
      area: "hotspots",
      severity: "note",
      path: `scenes.${scene.id}.hotspots`,
      message: "No source-project hotspot changes scene in this multi-scene project.",
      recommendation:
        "Confirm that exits are authored through object definitions, sequences or " +
        "another explicit runtime path.",
      impact: 1,
    });
  }
};

export const evaluateSceneOcclusion = (
  scene: AdventureScene,
  size: Size,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  scene.occluders.forEach((occluder, index) => {
    if (!pointInsideSceneCanvas(occluder.position, size)) {
      addSceneReadabilityFinding(findings, {
        id: `occluder-position-outside-${occluder.id}`,
        area: "occlusion",
        severity: "error",
        path: `scenes.${scene.id}.occluders[${index}].position`,
        message: `Occluder '${occluder.id}' is positioned outside the native canvas.`,
        recommendation: "Place the occlusion asset at a visible scene coordinate.",
        impact: 7,
      });
    }
    if (occluder.baselineY < 0 || occluder.baselineY > size.height) {
      addSceneReadabilityFinding(findings, {
        id: `occluder-baseline-outside-${occluder.id}`,
        area: "occlusion",
        severity: "error",
        path: `scenes.${scene.id}.occluders[${index}].baselineY`,
        message: `Occluder '${occluder.id}' has a baseline outside the scene.`,
        recommendation:
          "Set the baseline where the actor should pass behind the foreground element.",
        impact: 8,
      });
    }
    if (occluder.mask) {
      const path = `scenes.${scene.id}.occluders[${index}].mask`;
      if (!polygonInsideSceneCanvas(occluder.mask, size)) {
        addSceneReadabilityFinding(findings, {
          id: `occluder-mask-outside-${occluder.id}`,
          area: "occlusion",
          severity: "error",
          path,
          message: `Occluder '${occluder.id}' has mask points outside the native canvas.`,
          recommendation: "Keep foreground masks inside the authored composition.",
          impact: 7,
        });
      }
      if (adventurePolygonArea(occluder.mask) <= 0.5) {
        addSceneReadabilityFinding(findings, {
          id: `occluder-mask-degenerate-${occluder.id}`,
          area: "occlusion",
          severity: "error",
          path,
          message: `Occluder '${occluder.id}' has a mask with no usable area.`,
          recommendation:
            "Author a non-degenerate foreground mask or remove the mask and rely on the asset bounds.",
          impact: 7,
        });
      }
    }
  });
};

export const evaluateSceneComposition = (
  project: AdventureProject,
  scene: AdventureScene,
  design: AdventureDesignDocument | undefined,
  designLink: AdventureSceneDesignLink | null,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  if (design && design.projectId !== project.id) {
    addSceneReadabilityFinding(findings, {
      id: "composition-design-project-mismatch",
      area: "composition",
      severity: "error",
      path: "projectId",
      message: `Design document '${design.projectId}' does not match project '${project.id}'.`,
      recommendation: "Audit a design sidecar against the exact canonical project it belongs to.",
      impact: 15,
    });
    return;
  }
  if (design && !designLink) {
    addSceneReadabilityFinding(findings, {
      id: "composition-scene-not-linked",
      area: "composition",
      severity: "note",
      path: `scenes.${scene.id}`,
      message: "The scene has no linked Adventure Design location brief.",
      recommendation:
        "Link the scene to a map location so visual promise, arrival beat and production " +
        "geometry can be reviewed together.",
      impact: 2,
    });
  }
  if (designLink && (designLink.artBrief.length < 48 || designLink.arrivalBeat.length < 48)) {
    addSceneReadabilityFinding(findings, {
      id: "composition-linked-brief-thin",
      area: "composition",
      severity: "warning",
      path: `map.locations.${designLink.locationId}`,
      message: "The linked location does not provide enough scene or arrival direction.",
      recommendation:
        "Define value mass, actor entrance, focal prop, obstacle, exit hierarchy and first playable task.",
      impact: 5,
    });
  }
  if (scene.fallbackText.trim().length < 12) {
    addSceneReadabilityFinding(findings, {
      id: "composition-fallback-thin",
      area: "composition",
      severity: "note",
      path: `scenes.${scene.id}.fallbackText`,
      message: "The scene fallback response is too generic to reinforce voice or place.",
      recommendation: "Use a concise response that belongs to this protagonist and location.",
      impact: 1,
    });
  }
};
