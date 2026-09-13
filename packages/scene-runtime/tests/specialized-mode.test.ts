import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import type { InteractiveRuntimeWorldState } from "../src/commands.js";
import {
  activateSpecializedAdventureMode,
  advanceSpecializedAdventureMode,
  enterSpecializedAdventureMode,
  type SpecializedAdventureModeDefinition,
} from "../src/specialized-mode.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const world = (
  tick = 10,
  sceneId: Id<"scene"> = id<"scene">("scene.office"),
  entranceId: Id<"entrance"> = id<"entrance">("entrance.office"),
): InteractiveRuntimeWorldState => ({
  story: {
    schemaVersion: 1,
    projectId: id<"project">("project.specialized"),
    tick,
    currentSceneId: sceneId,
    currentEntranceId: entranceId,
    flags: {},
    variables: {},
    inventory: [],
    awardedScoreIds: [],
    consumedInteractionIds: [],
    consumedDialogueChoiceIds: [],
    activeDialogue: null,
    activeSequences: [],
    objectStates: {},
    randomStreams: { main: 1 },
    score: 0,
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
});

const travelMode: SpecializedAdventureModeDefinition = {
  id: "specialized-mode.city-map",
  kind: "travel-map",
  sceneId: id<"scene">("scene.travel-map"),
  entranceId: id<"entrance">("entrance.travel-map"),
  startStateId: "choosing",
  return: { kind: "stay" },
  states: [
    {
      id: "choosing",
      inputRegions: [
        {
          id: "destination.archive",
          label: "Archive",
          shape: {
            points: [
              { x: 20, y: 20 },
              { x: 80, y: 20 },
              { x: 80, y: 60 },
              { x: 20, y: 60 },
            ],
          },
          actions: [
            { kind: "set-flag", flag: "travelledToArchive", value: true },
            {
              kind: "change-scene",
              sceneId: id<"scene">("scene.archive"),
              entranceId: id<"entrance">("entrance.archive"),
            },
          ],
          finishOutcomeId: "arrived.archive",
        },
      ],
    },
  ],
};

const quickResponseMode: SpecializedAdventureModeDefinition = {
  id: "specialized-mode.evade-cart",
  kind: "quick-response",
  sceneId: id<"scene">("scene.cart-inset"),
  entranceId: id<"entrance">("entrance.cart-inset"),
  startStateId: "danger",
  return: { kind: "previous-location" },
  states: [
    {
      id: "danger",
      inputRegions: [
        {
          id: "dodge.left",
          label: "Dodge left",
          shape: {
            points: [
              { x: 0, y: 0 },
              { x: 159, y: 0 },
              { x: 159, y: 199 },
              { x: 0, y: 199 },
            ],
          },
          actions: [{ kind: "set-flag", flag: "cartDodged", value: true }],
          finishOutcomeId: "dodged",
        },
      ],
      timeout: {
        afterTicks: 30,
        actions: [{ kind: "set-flag", flag: "cartHit", value: true }],
        finishOutcomeId: "hit",
      },
    },
  ],
};

describe("specialized adventure mode kernel", () => {
  it("uses the same deterministic lifecycle for a clickable travel-map destination", () => {
    const entered = enterSpecializedAdventureMode(world(), travelMode);
    expect(entered.world.story.currentSceneId).toBe("scene.travel-map");
    expect(entered.active).toMatchObject({
      modeId: "specialized-mode.city-map",
      kind: "travel-map",
      stateId: "choosing",
      returnSceneId: "scene.office",
      returnEntranceId: "entrance.office",
    });

    const ignored = activateSpecializedAdventureMode(
      entered.world,
      entered.active!,
      travelMode,
      { x: 200, y: 100 },
    );
    expect(ignored.active).not.toBeNull();
    expect(ignored.world.story.currentSceneId).toBe("scene.travel-map");

    const selected = activateSpecializedAdventureMode(
      entered.world,
      entered.active!,
      travelMode,
      { x: 40, y: 40 },
    );
    expect(selected.active).toBeNull();
    expect(selected.world.story.currentSceneId).toBe("scene.archive");
    expect(selected.world.story.currentEntranceId).toBe("entrance.archive");
    expect(selected.world.story.flags.travelledToArchive).toBe(true);
    expect(selected.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "specialized-mode-input", regionId: "destination.archive" }),
        expect.objectContaining({ kind: "specialized-mode-finished", outcomeId: "arrived.archive" }),
      ]),
    );
  });

  it("returns to the exact previous location on successful quick response", () => {
    const entered = enterSpecializedAdventureMode(world(5), quickResponseMode);
    const resolved = activateSpecializedAdventureMode(
      entered.world,
      entered.active!,
      quickResponseMode,
      { x: 80, y: 100 },
    );
    expect(resolved.active).toBeNull();
    expect(resolved.world.story.currentSceneId).toBe("scene.office");
    expect(resolved.world.story.currentEntranceId).toBe("entrance.office");
    expect(resolved.world.story.flags.cartDodged).toBe(true);
    expect(resolved.world.story.flags.cartHit).toBeUndefined();
  });

  it("uses logical ticks for timeout failure and returns through the same lifecycle", () => {
    const entered = enterSpecializedAdventureMode(world(5), quickResponseMode);
    const beforeDeadline = advanceSpecializedAdventureMode(
      { ...entered.world, story: { ...entered.world.story, tick: 34 } },
      entered.active!,
      quickResponseMode,
    );
    expect(beforeDeadline.active).not.toBeNull();

    const timedOut = advanceSpecializedAdventureMode(
      { ...entered.world, story: { ...entered.world.story, tick: 35 } },
      entered.active!,
      quickResponseMode,
    );
    expect(timedOut.active).toBeNull();
    expect(timedOut.world.story.currentSceneId).toBe("scene.office");
    expect(timedOut.world.story.flags.cartHit).toBe(true);
    expect(timedOut.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "specialized-mode-timeout", stateId: "danger" }),
        expect.objectContaining({ kind: "specialized-mode-finished", outcomeId: "hit" }),
      ]),
    );
  });
});
