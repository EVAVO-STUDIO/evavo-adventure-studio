import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { controlledActorRequestFromSave, selectControlledActorInstance } from "../src/input.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const bundle = {
  startSceneId: id<"scene">("scene.start"),
  sceneInstances: {
    manifestVersion: 1 as const,
    projectId: id<"project">("project.save-selection"),
    objectDefinitions: [],
    scenes: [
      {
        sceneId: id<"scene">("scene.start"),
        actorInstances: [
          {
            id: id<"actor-instance">("actor-instance.start"),
            actorId: id<"actor">("actor.start"),
            position: { x: 20, y: 100 },
            facing: "east",
            animationState: "idle",
            mobility: "walkable" as const,
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
        ],
        objectInstances: [],
        navigationPortals: [],
      },
      {
        sceneId: id<"scene">("scene.later"),
        actorInstances: [
          {
            id: id<"actor-instance">("actor-instance.later"),
            actorId: id<"actor">("actor.later"),
            position: { x: 220, y: 100 },
            facing: "west",
            animationState: "idle",
            mobility: "fixed" as const,
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
        ],
        objectInstances: [],
        navigationPortals: [],
      },
    ],
  },
};

describe("save-boundary controlled actor selection", () => {
  it("preserves explicit view-only saves instead of auto-selecting an actor", () => {
    expect(selectControlledActorInstance(bundle, controlledActorRequestFromSave(null))).toEqual({
      kind: "none",
      reason: "explicit-view-only",
      candidates: [],
    });
  });

  it("restores an actor outside the start scene without changing browser rules", () => {
    expect(
      selectControlledActorInstance(
        bundle,
        controlledActorRequestFromSave(id<"actor-instance">("actor-instance.later")),
      ),
    ).toEqual({
      kind: "selected",
      actorInstanceId: "actor-instance.later",
      explicit: true,
    });
    expect(selectControlledActorInstance(bundle, "actor-instance.later")).toMatchObject({
      kind: "invalid",
      reason: "unknown-requested-actor",
    });
  });
});
