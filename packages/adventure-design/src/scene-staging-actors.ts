import type { AdventureProject, Scene } from "@evavo/adventure-project-schema";
import { pointInsideSceneCanvas } from "./scene-readability-geometry.js";
import { addSceneStagingFinding } from "./scene-staging-findings.js";
import {
  adventurePointDistance,
  rectangleIntersectionRatio,
  rectangleOutsideFraction,
} from "./scene-staging-geometry.js";
import type { AdventureActorStagingMarker, AdventureSceneStagingFinding } from "./scene-staging-types.js";

const actorPairFindings = (
  actors: readonly AdventureActorStagingMarker[],
  findings: AdventureSceneStagingFinding[],
): void => {
  for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) {
    const left = actors[leftIndex];
    if (!left?.bounds) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < actors.length; rightIndex += 1) {
      const right = actors[rightIndex];
      if (!right?.bounds) continue;
      if (rectangleIntersectionRatio(left.bounds, right.bounds) >= 0.35) {
        addSceneStagingFinding(findings, {
          id: `actor-silhouette-collision-${left.instanceId}-${right.instanceId}`,
          area: "actors",
          severity: "warning",
          impact: 8,
          path: "actorInstances",
          message:
            `Initial actor silhouettes '${left.actorName}' and ` +
            `'${right.actorName}' substantially overlap.`,
          recommendation:
            "Restage the opening pose, elevation or baseline so each actor reads " +
            "separately at 1× native size.",
        });
      }
    }
  }
};

export const evaluateSceneStagedActors = (
  project: AdventureProject,
  scene: Scene,
  actors: readonly AdventureActorStagingMarker[],
  findings: AdventureSceneStagingFinding[],
): void => {
  const walkable = actors.filter((actor) => actor.mobility === "walkable");
  if (scene.id === project.startSceneId) {
    if (walkable.length === 0) {
      addSceneStagingFinding(findings, {
        id: "control-start-scene-without-walkable-actor",
        area: "control",
        severity: "error",
        impact: 30,
        path: "actorInstances",
        message: "The start scene has no walkable actor and will open as a view-only runtime.",
        recommendation:
          "Place exactly one walkable player actor in the start scene or require " +
          "an explicit controlled actor selection.",
      });
    } else if (walkable.length > 1) {
      addSceneStagingFinding(findings, {
        id: "control-start-scene-ambiguous-walkable-actors",
        area: "control",
        severity: "error",
        impact: 24,
        path: "actorInstances",
        message:
          `The start scene has ${walkable.length} walkable actors, so automatic ` +
          "player control is ambiguous.",
        recommendation:
          "Keep one implicit player candidate or require an explicit actor instance " +
          "in the packaged-player launch contract.",
      });
    }
  }

  const size = { width: scene.width, height: scene.height };
  actors.forEach((actor, index) => {
    const path = `actorInstances[${index}]`;
    if (!pointInsideSceneCanvas(actor.position, size)) {
      addSceneStagingFinding(findings, {
        id: `actor-position-outside-canvas-${actor.instanceId}`,
        area: "actors",
        severity: "error",
        impact: 16,
        path: `${path}.position`,
        message: `Actor '${actor.actorName}' begins outside the native scene canvas.`,
        recommendation: "Move the actor foot point inside the authored canvas.",
      });
    }
    if (!actor.bounds) {
      addSceneStagingFinding(findings, {
        id: `actor-initial-visual-unresolved-${actor.instanceId}`,
        area: "actors",
        severity: "error",
        impact: 14,
        path,
        message:
          `Actor '${actor.actorName}' has no resolvable initial frame for ` +
          `'${actor.animationState}/${actor.facing}'.`,
        recommendation:
          "Provide a matching animation clip and a valid first sprite frame before staging review.",
      });
    } else {
      const outside = rectangleOutsideFraction(actor.bounds, scene.width, scene.height);
      if (outside > 0.6) {
        addSceneStagingFinding(findings, {
          id: `actor-mostly-outside-canvas-${actor.instanceId}`,
          area: "actors",
          severity: "error",
          impact: 14,
          path,
          message: `Most of '${actor.actorName}' is outside the native canvas in the initial pose.`,
          recommendation:
            "Move the foot point or correct frame pivots so the intended silhouette is visible.",
        });
      } else if (outside > 0.2) {
        addSceneStagingFinding(findings, {
          id: `actor-clipped-at-entry-${actor.instanceId}`,
          area: "actors",
          severity: "warning",
          impact: 7,
          path,
          message: `The initial pose for '${actor.actorName}' is visibly clipped by the native canvas.`,
          recommendation:
            "Confirm the crop is a deliberate entrance reveal rather than a pivot or placement error.",
        });
      }
    }
    if (actor.scaleMultiplier < 0.5 || actor.scaleMultiplier > 1.6) {
      addSceneStagingFinding(findings, {
        id: `actor-scale-multiplier-extreme-${actor.instanceId}`,
        area: "actors",
        severity: "warning",
        impact: 6,
        path: `${path}.scaleMultiplier`,
        message:
          `Actor '${actor.actorName}' uses an extreme local scale multiplier of ` +
          `${actor.scaleMultiplier}.`,
        recommendation:
          "Prefer scene depth bands for perspective and reserve local scale for " +
          "deliberate character differences.",
      });
    }
    for (const entrance of scene.entrances) {
      if (adventurePointDistance(actor.position, entrance.position) < 10) {
        addSceneStagingFinding(findings, {
          id: `actor-blocks-entrance-${actor.instanceId}-${entrance.id}`,
          area: "actors",
          severity: "warning",
          impact: 6,
          path: `${path}.position`,
          message:
            `Actor '${actor.actorName}' occupies entrance '${entrance.id}' at ` + "initial control handoff.",
          recommendation: "Protect enough arrival clearance for the entering actor and first readable pose.",
        });
      }
    }
  });
  actorPairFindings(actors, findings);
};
