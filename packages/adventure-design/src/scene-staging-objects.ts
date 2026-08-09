import type { Scene } from "@evavo/adventure-project-schema";
import { addSceneStagingFinding } from "./scene-staging-findings.js";
import {
  adventurePointDistance,
  objectMarkerInsideCanvas,
  objectWalkToIsReachable,
  pointOccupiesObject,
  stageLayerOrder,
} from "./scene-staging-geometry.js";
import type {
  AdventureActorStagingMarker,
  AdventureObjectStagingMarker,
  AdventurePortalStagingMarker,
  AdventureSceneStagingFinding,
} from "./scene-staging-types.js";

export const evaluateSceneStagedObjects = (
  scene: Scene,
  objects: readonly AdventureObjectStagingMarker[],
  findings: AdventureSceneStagingFinding[],
): void => {
  objects.forEach((object, index) => {
    const path = `objectInstances[${index}]`;
    if (!objectMarkerInsideCanvas(object, scene)) {
      addSceneStagingFinding(findings, {
        id: `object-outside-canvas-${object.instanceId}`,
        area: "objects",
        severity: object.visible || object.interactive ? "error" : "warning",
        impact: object.visible || object.interactive ? 15 : 7,
        path,
        message: `Object '${object.definitionName}' or its interaction geometry exceeds the native canvas.`,
        recommendation:
          "Move the object or correct its local geometry so visible and interactive " +
          "pixels share the scene coordinate system.",
      });
    }
    if (!objectWalkToIsReachable(object, scene)) {
      addSceneStagingFinding(findings, {
        id: `object-walk-to-unreachable-${object.instanceId}`,
        area: "interaction",
        severity: "error",
        impact: 16,
        path: `${path}.walkTo`,
        message: `Object '${object.definitionName}' has an approach point outside navigation.`,
        recommendation:
          "Move the approach point onto reachable walk geometry or make the " +
          "interaction intentionally remote.",
      });
    }
    if (object.interactive && !object.walkTo) {
      addSceneStagingFinding(findings, {
        id: `object-interactive-without-approach-${object.instanceId}`,
        area: "interaction",
        severity: "note",
        impact: 3,
        path,
        message: `Interactive object '${object.definitionName}' has no authored approach point.`,
        recommendation:
          "Confirm that immediate remote interaction is intentional; otherwise add " +
          "a walk-to offset and facing rule.",
      });
    }
    if (object.interactive && !object.visible) {
      addSceneStagingFinding(findings, {
        id: `object-hidden-but-interactive-${object.instanceId}`,
        area: "interaction",
        severity: "warning",
        impact: 10,
        path,
        message: `Object '${object.definitionName}' is hidden in its initial state but remains interactive.`,
        recommendation:
          "Remove the hidden target or provide explicit invisible-trigger intent and player feedback.",
      });
    }
    if (object.interactive && (object.layer === "rear-ambient" || object.layer === "front-ambient")) {
      addSceneStagingFinding(findings, {
        id: `object-interactive-on-ambient-layer-${object.instanceId}`,
        area: "layers",
        severity: "warning",
        impact: 8,
        path: `${path}.layer`,
        message:
          `Interactive object '${object.definitionName}' is placed on the ` +
          `'${object.layer}' ambient layer.`,
        recommendation:
          "Keep consequential targets in world or intentional occlusion layers so " +
          "hit testing and visual hierarchy agree.",
      });
    }
    if (object.interactive && object.opacity < 0.35) {
      addSceneStagingFinding(findings, {
        id: `object-interactive-low-opacity-${object.instanceId}`,
        area: "interaction",
        severity: "warning",
        impact: 7,
        path,
        message: `Interactive object '${object.definitionName}' begins below 35% opacity.`,
        recommendation:
          "Increase visual evidence or ensure another authored cue communicates " +
          "the target without hotspot markers.",
      });
    }
    if (object.scaleMultiplier < 0.5 || object.scaleMultiplier > 2) {
      addSceneStagingFinding(findings, {
        id: `object-scale-multiplier-extreme-${object.instanceId}`,
        area: "objects",
        severity: "warning",
        impact: 5,
        path: `${path}.scaleMultiplier`,
        message:
          `Object '${object.definitionName}' uses an extreme local scale multiplier ` +
          `of ${object.scaleMultiplier}.`,
        recommendation: "Confirm source dimensions and pivot before compensating with large local scale.",
      });
    }
    for (const entrance of scene.entrances) {
      if (
        adventurePointDistance(object.position, entrance.position) < 10 ||
        pointOccupiesObject(entrance.position, object)
      ) {
        addSceneStagingFinding(findings, {
          id: `object-blocks-entrance-${object.instanceId}-${entrance.id}`,
          area: "objects",
          severity: "warning",
          impact: 6,
          path,
          message: `Object '${object.definitionName}' overlaps entrance '${entrance.id}'.`,
          recommendation:
            "Protect arrival clearance or explicitly animate the obstruction before control begins.",
        });
      }
    }
  });
};

export const evaluateSceneStagedPortals = (
  scene: Scene,
  portals: readonly AdventurePortalStagingMarker[],
  objects: readonly AdventureObjectStagingMarker[],
  findings: AdventureSceneStagingFinding[],
): void => {
  portals.forEach((portal, index) => {
    const path = `navigationPortals[${index}]`;
    const distance = adventurePointDistance(portal.fromPoint, portal.toPoint);
    if (portal.fromAreaId === portal.toAreaId) {
      addSceneStagingFinding(findings, {
        id: `portal-same-area-${portal.id}`,
        area: "portals",
        severity: "error",
        impact: 14,
        path,
        message: `Portal '${portal.id}' connects a navigation area to itself.`,
        recommendation:
          "Remove the redundant portal or connect two distinct elevation or navigation regions.",
      });
    }
    if (distance > Math.max(72, scene.width * 0.25) && !portal.traversalAnimationState) {
      addSceneStagingFinding(findings, {
        id: `portal-long-handoff-without-animation-${portal.id}`,
        area: "portals",
        severity: "warning",
        impact: 7,
        path,
        message:
          `Portal '${portal.id}' moves the actor ${Math.round(distance)} native ` +
          "pixels without an authored traversal animation.",
        recommendation:
          "Add stairs, ladder, squeeze, climb or another traversal state so the " +
          "geometric handoff remains visually credible.",
      });
    }
    if (distance < 2) {
      addSceneStagingFinding(findings, {
        id: `portal-redundant-handoff-${portal.id}`,
        area: "portals",
        severity: "note",
        impact: 2,
        path,
        message: `Portal '${portal.id}' has effectively identical handoff points.`,
        recommendation: "Confirm that a portal is necessary rather than a direct shared navigation boundary.",
      });
    }
    if (portal.traversalCost > 10) {
      addSceneStagingFinding(findings, {
        id: `portal-high-traversal-cost-${portal.id}`,
        area: "portals",
        severity: "note",
        impact: 3,
        path: `${path}.traversalCost`,
        message: `Portal '${portal.id}' has a high traversal cost of ${portal.traversalCost}.`,
        recommendation:
          "Confirm route weighting does not make an obvious visual path feel arbitrarily unavailable.",
      });
    }
    for (const object of objects.filter((candidate) => candidate.visible)) {
      if (pointOccupiesObject(portal.fromPoint, object) || pointOccupiesObject(portal.toPoint, object)) {
        addSceneStagingFinding(findings, {
          id: `portal-obstructed-${portal.id}-${object.instanceId}`,
          area: "portals",
          severity: "warning",
          impact: 7,
          path,
          message: `Portal '${portal.id}' handoff intersects visible object '${object.definitionName}'.`,
          recommendation:
            "Move the handoff or author the object state change that clears the traversal path.",
        });
      }
    }
  });
};

export const evaluateSceneStagedLayers = (
  actors: readonly AdventureActorStagingMarker[],
  objects: readonly AdventureObjectStagingMarker[],
  findings: AdventureSceneStagingFinding[],
): void => {
  const layerOrder = stageLayerOrder(
    actors,
    objects.filter((object) => object.visible),
  );
  const occupied = new Map<string, string>();
  for (const node of layerOrder) {
    const key = [node.layer, node.elevation, node.baselineY, node.zOffset].join("|");
    const existing = occupied.get(key);
    if (existing) {
      addSceneStagingFinding(findings, {
        id: `layer-order-tie-${existing}-${node.id}`,
        area: "layers",
        severity: "note",
        impact: 3,
        path: "layerOrder",
        message:
          `Stage nodes '${existing}' and '${node.id}' share the same layer, ` +
          "elevation, baseline and z-offset.",
        recommendation:
          "Use intentional baselines or z-offsets when the visual overlap must not " +
          "depend on stable-ID tie breaking.",
      });
    } else {
      occupied.set(key, node.id);
    }
  }
  const frontAmbient = objects.filter((object) => object.visible && object.layer === "front-ambient");
  if (frontAmbient.length > 3) {
    addSceneStagingFinding(findings, {
      id: "layers-front-ambient-overloaded",
      area: "layers",
      severity: "warning",
      impact: 6,
      path: "objectInstances",
      message: `${frontAmbient.length} visible objects occupy the front-ambient layer.`,
      recommendation:
        "Reduce foreground decoration or confirm it frames rather than obscures " +
        "actors, targets and dialogue staging.",
    });
  }
  if (actors.length + objects.filter((object) => object.visible).length > 18) {
    addSceneStagingFinding(findings, {
      id: "layers-native-stage-density-high",
      area: "layers",
      severity: "warning",
      impact: 6,
      path: "sceneComposition",
      message: "The initial native stage contains more than eighteen visible actor and object nodes.",
      recommendation:
        "Group decorative motion into authored background layers and protect the " +
        "silhouettes that carry gameplay meaning.",
    });
  }
};
