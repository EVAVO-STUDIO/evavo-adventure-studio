import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createMultiProtagonistState,
  switchActiveProtagonist,
} from "@evavo/adventure-scene-runtime/multi-protagonist";
import { describe, expect, it } from "vitest";
import { actorInstanceIdForProtagonist } from "../src/multi-protagonist-actor.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const state = createMultiProtagonistState(
  [
    {
      protagonistId: id<"actor">("actor.a"),
      startSceneId: id<"scene">("scene.a"),
      startEntranceId: id<"entrance">("entrance.a"),
    },
    {
      protagonistId: id<"actor">("actor.b"),
      startSceneId: id<"scene">("scene.b"),
      startEntranceId: id<"entrance">("entrance.b"),
    },
  ],
  id<"actor">("actor.a"),
);

const bundle = {
  sceneInstances: {
    scenes: [
      {
        sceneId: id<"scene">("scene.a"),
        actorInstances: [
          {
            id: id<"actor-instance">("actor-instance.a"),
            actorId: id<"actor">("actor.a"),
            mobility: "walkable",
          },
        ],
      },
      {
        sceneId: id<"scene">("scene.b"),
        actorInstances: [
          {
            id: id<"actor-instance">("actor-instance.b"),
            actorId: id<"actor">("actor.b"),
            mobility: "walkable",
          },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("multi-protagonist actor resolution", () => {
  it("resolves the unique walkable actor instance in the protagonist's current scene", () => {
    expect(actorInstanceIdForProtagonist(bundle, state)).toBe("actor-instance.a");
    expect(
      actorInstanceIdForProtagonist(
        bundle,
        switchActiveProtagonist(state, id<"actor">("actor.b")),
      ),
    ).toBe("actor-instance.b");
  });

  it("rejects ambiguous protagonist placement", () => {
    const ambiguous = structuredClone(bundle) as RuntimeBundle;
    ambiguous.sceneInstances!.scenes[0]!.actorInstances.push({
      ...ambiguous.sceneInstances!.scenes[0]!.actorInstances[0]!,
      id: id<"actor-instance">("actor-instance.a.duplicate"),
    });
    expect(() => actorInstanceIdForProtagonist(ambiguous, state)).toThrow(/exactly one walkable/u);
  });
});
