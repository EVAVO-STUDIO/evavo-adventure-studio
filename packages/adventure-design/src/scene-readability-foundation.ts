import type {
  AdventureProject,
  Size,
} from "@evavo/adventure-project-schema";
import {
  adventurePolygonArea,
  pointInsideSceneCanvas,
  pointInsideSceneNavigation,
  polygonInsideSceneCanvas,
} from "./scene-readability-geometry.js";
import {
  addSceneReadabilityFinding,
  type AdventureScene,
  type AdventureSceneReadabilityFinding,
} from "./scene-readability-types.js";

export const evaluateSceneCanvas = (
  project: AdventureProject,
  scene: AdventureScene,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  const native = project.presentation;
  if (scene.width !== native.nativeWidth || scene.height !== native.nativeHeight) {
    addSceneReadabilityFinding(findings, {
      id: "scene-native-size-mismatch",
      area: "native-canvas",
      severity: "error",
      path: `scenes.${scene.id}`,
      message: `Scene is ${scene.width} × ${scene.height}; project presentation is ${
        native.nativeWidth
      } × ${native.nativeHeight}.`,
      recommendation:
        "Compose and compile the background at the exact project canvas so geometry, " +
        "pixels and interface share one coordinate system.",
      impact: 20,
    });
  }
  if (scene.width !== 320 || scene.height !== 200) {
    addSceneReadabilityFinding(findings, {
      id: "scene-non-vga-canvas",
      area: "native-canvas",
      severity: "note",
      path: `scenes.${scene.id}`,
      message: "The scene is not using the classic 320 × 200 VGA canvas.",
      recommendation:
        "Keep the chosen canvas intentional and review every interaction at 1× native size.",
      impact: 1,
    });
  }
};

export const evaluateSceneNavigation = (
  scene: AdventureScene,
  size: Size,
  navigationCoverage: number,
  verticalSpan: number,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  if (scene.navigationAreas.length === 0) {
    addSceneReadabilityFinding(findings, {
      id: "navigation-missing",
      area: "navigation",
      severity: "error",
      path: `scenes.${scene.id}.navigationAreas`,
      message: "The scene has no authored walkable area.",
      recommendation:
        "Author a deliberate stage lane or traversal region instead of allowing " +
        "unconstrained screen movement.",
      impact: 20,
    });
    return;
  }
  scene.navigationAreas.forEach((area, index) => {
    const path = `scenes.${scene.id}.navigationAreas[${index}].shape`;
    const areaPixels = adventurePolygonArea(area.shape);
    if (!polygonInsideSceneCanvas(area.shape, size)) {
      addSceneReadabilityFinding(findings, {
        id: `navigation-outside-canvas-${area.id}`,
        area: "navigation",
        severity: "error",
        path,
        message: `Navigation area '${area.id}' extends outside the scene canvas.`,
        recommendation: "Keep every walk polygon point inside the native scene bounds.",
        impact: 10,
      });
    }
    if (areaPixels <= 0.5) {
      addSceneReadabilityFinding(findings, {
        id: `navigation-degenerate-${area.id}`,
        area: "navigation",
        severity: "error",
        path,
        message: `Navigation area '${area.id}' has no usable surface area.`,
        recommendation:
          "Remove repeated or collinear vertices and author a polygon with a visible walkable interior.",
        impact: 12,
      });
    } else if (areaPixels < size.width * size.height * 0.0025) {
      addSceneReadabilityFinding(findings, {
        id: `navigation-area-tiny-${area.id}`,
        area: "navigation",
        severity: "warning",
        path,
        message: `Navigation area '${area.id}' is too small for reliable actor staging.`,
        recommendation:
          "Confirm the surface can contain the actor foot point and route solver tolerance at native scale.",
        impact: 4,
      });
    }
  });
  if (navigationCoverage < 10 || navigationCoverage > 75) {
    addSceneReadabilityFinding(findings, {
      id: "navigation-coverage-extreme",
      area: "navigation",
      severity: "warning",
      path: `scenes.${scene.id}.navigationAreas`,
      message: `Walkable coverage is ${navigationCoverage.toFixed(1)}% of the canvas.`,
      recommendation:
        "Review whether the scene has a purposeful interaction lane rather than a " +
        "cramped strip or an undirected full-screen floor.",
      impact: 7,
    });
  }
  if (verticalSpan < 20) {
    addSceneReadabilityFinding(findings, {
      id: "navigation-depth-span-thin",
      area: "navigation",
      severity: "warning",
      path: `scenes.${scene.id}.navigationAreas`,
      message: `The walkable lane spans only ${verticalSpan.toFixed(1)}% of scene height.`,
      recommendation:
        "Confirm that the narrow stage is intentional and that actor scale changes remain readable.",
      impact: 5,
    });
  }
  const summedArea = scene.navigationAreas.reduce(
    (total, area) => total + adventurePolygonArea(area.shape),
    0,
  );
  const unionArea = (navigationCoverage / 100) * size.width * size.height;
  if (summedArea - unionArea > size.width * size.height * 0.12) {
    addSceneReadabilityFinding(findings, {
      id: "navigation-overlap-heavy",
      area: "navigation",
      severity: "note",
      path: `scenes.${scene.id}.navigationAreas`,
      message:
        "Walk areas overlap heavily and may make elevation or routing intent difficult to review.",
      recommendation:
        "Use separate areas only where elevation, conditions or portal routing require them.",
      impact: 2,
    });
  }
};

export const evaluateSceneEntrances = (
  scene: AdventureScene,
  size: Size,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  scene.entrances.forEach((entrance, index) => {
    if (!pointInsideSceneCanvas(entrance.position, size)) {
      addSceneReadabilityFinding(findings, {
        id: `entrance-outside-canvas-${entrance.id}`,
        area: "entrances",
        severity: "error",
        path: `scenes.${scene.id}.entrances[${index}].position`,
        message: `Entrance '${entrance.id}' is outside the native canvas.`,
        recommendation: "Place the actor's arrival point inside the visible scene.",
        impact: 10,
      });
    } else if (!pointInsideSceneNavigation(scene, entrance.position)) {
      addSceneReadabilityFinding(findings, {
        id: `entrance-outside-navigation-${entrance.id}`,
        area: "entrances",
        severity: "error",
        path: `scenes.${scene.id}.entrances[${index}].position`,
        message: `Entrance '${entrance.id}' does not land on a walkable area.`,
        recommendation:
          "Move the entrance into navigation or author a deterministic arrival handoff " +
          "before player control.",
        impact: 12,
      });
    }
  });
};

export const evaluateSceneDepth = (
  scene: AdventureScene,
  size: Size,
  findings: AdventureSceneReadabilityFinding[],
): void => {
  if (scene.depthBands.length === 0) {
    addSceneReadabilityFinding(findings, {
      id: "depth-bands-missing",
      area: "depth",
      severity: "warning",
      path: `scenes.${scene.id}.depthBands`,
      message: "The scene has no authored actor-scale depth band.",
      recommendation:
        "Add a depth band or explicitly document a fixed-scale stage so actor size does " +
        "not drift by accident.",
      impact: 7,
    });
    return;
  }
  scene.depthBands.forEach((band, index) => {
    if (band.farY < 0 || band.nearY > size.height || band.farY >= band.nearY) {
      addSceneReadabilityFinding(findings, {
        id: `depth-range-invalid-${band.id}`,
        area: "depth",
        severity: "error",
        path: `scenes.${scene.id}.depthBands[${index}]`,
        message: `Depth band '${band.id}' has an invalid far-to-near range.`,
        recommendation:
          "Keep farY above nearY numerically and both boundaries inside the native canvas.",
        impact: 10,
      });
    }
    if (band.farScale > band.nearScale) {
      addSceneReadabilityFinding(findings, {
        id: `depth-scale-reversed-${band.id}`,
        area: "depth",
        severity: "warning",
        path: `scenes.${scene.id}.depthBands[${index}]`,
        message: `Depth band '${band.id}' makes distant actors larger than near actors.`,
        recommendation:
          "Use increasing scale toward the foreground unless the reversal is a deliberate visual effect.",
        impact: 5,
      });
    }
  });
  const navigationYs = scene.navigationAreas.flatMap((area) =>
    area.shape.points.map((point) => point.y),
  );
  if (navigationYs.length > 0) {
    const minimum = Math.min(...navigationYs);
    const maximum = Math.max(...navigationYs);
    const spans = scene.depthBands
      .filter((band) => band.farY < band.nearY)
      .map((band) => ({
        start: Math.max(minimum, band.farY),
        end: Math.min(maximum, band.nearY),
      }))
      .filter((span) => span.start <= span.end)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    let cursor = minimum;
    let hasGap = false;
    for (const span of spans) {
      if (span.start > cursor + 0.000001) {
        hasGap = true;
        break;
      }
      cursor = Math.max(cursor, span.end);
    }
    if (cursor < maximum - 0.000001) hasGap = true;
    if (hasGap) {
      addSceneReadabilityFinding(findings, {
        id: "depth-does-not-cover-navigation",
        area: "depth",
        severity: "warning",
        path: `scenes.${scene.id}.depthBands`,
        message: "Depth bands leave reachable foot positions without scale coverage.",
        recommendation:
          "Cover the complete navigation Y range without gaps so actor scale remains deterministic.",
        impact: 6,
      });
    }
  }
};
