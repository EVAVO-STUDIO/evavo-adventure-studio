import type { Id } from "@evavo/adventure-project-schema";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  createMultiProtagonistState,
  switchActiveProtagonist,
} from "@evavo/adventure-scene-runtime/multi-protagonist";
import { describe, expect, it } from "vitest";
import {
  commitWorldToActiveProtagonist,
  projectMultiProtagonistIntoWorld,
} from "../src/multi-protagonist-projection.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const world = {
  story: {
    schemaVersion: 1,
    projectId: id<"project">("project.multi"),
    tick: 10,
    currentSceneId: id<"scene">("scene.present"),
    currentEntranceId: id<"entrance">("entrance.present"),
    flags: { ordinaryFlag: true },
    variables: { globalCounter: 2 },
    inventory: [id<"item">("item.global")],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: { "object.clock": "open" },
    randomStreams: { main: 1 },
    score: 5,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
} as unknown as InteractiveRuntimeWorldState;

const companion = createMultiProtagonistState(
  [
    {
      protagonistId: id<"actor">("actor.bernard"),
      startSceneId: id<"scene">("scene.present"),
      startEntranceId: id<"entrance">("entrance.present"),
      startingInventory: [id<"item">("item.plan")],
    },
    {
      protagonistId: id<"actor">("actor.laverne"),
      startSceneId: id<"scene">("scene.future"),
      startEntranceId: id<"entrance">("entrance.future"),
      startingInventory: [id<"item">("item.badge")],
    },
  ],
  id<"actor">("actor.bernard"),
);

describe("multi-protagonist world projection", () => {
  it("projects active character location/inventory while preserving global story state", () => {
    const laverne = switchActiveProtagonist(companion, id<"actor">("actor.laverne"));
    const projected = projectMultiProtagonistIntoWorld(world, laverne);
    expect(projected.story.currentSceneId).toBe("scene.future");
    expect(projected.story.currentEntranceId).toBe("entrance.future");
    expect(projected.story.inventory).toEqual(["item.badge"]);
    expect(projected.story.variables).toEqual({ globalCounter: 2 });
    expect(projected.story.objectStates).toEqual({ "object.clock": "open" });
    expect(projected.story.score).toBe(5);
    expect(projected.story.flags.ordinaryFlag).toBe(true);
  });

  it("round-trips character-local/shared state through reserved story namespaces", () => {
    const projected = projectMultiProtagonistIntoWorld(world, companion);
    const changed = {
      ...projected,
      story: {
        ...projected.story,
        currentSceneId: id<"scene">("scene.present.attic"),
        currentEntranceId: id<"entrance">("entrance.attic"),
        inventory: [id<"item">("item.plan"), id<"item">("item.key")],
        flags: {
          ...projected.story.flags,
          "multi.shared.generatorRunning": true,
          "multi.fact.fact.temporal-loop": true,
          "multi.local.actor.bernard.readNote": true,
        },
      },
    } as InteractiveRuntimeWorldState;
    const committed = commitWorldToActiveProtagonist(companion, changed);
    expect(committed.protagonists["actor.bernard"]?.location).toEqual({
      sceneId: "scene.present.attic",
      entranceId: "entrance.attic",
    });
    expect(committed.protagonists["actor.bernard"]?.inventory).toEqual(["item.key", "item.plan"]);
    expect(committed.protagonists["actor.bernard"]?.flags).toEqual({ readNote: true });
    expect(committed.sharedFlags).toEqual({ generatorRunning: true });
    expect(committed.sharedFacts).toEqual(["fact.temporal-loop"]);
  });
});
