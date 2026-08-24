import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  createItemCombinationRuntimeState,
  createSentenceState,
  executeSentenceIntent,
  selectSentenceTarget,
  selectSentenceVerb,
  type SentenceGrammar,
} from "@evavo/adventure-scene-runtime/sentence-execution";
import {
  createMultiProtagonistState,
  switchActiveProtagonist,
} from "@evavo/adventure-scene-runtime/multi-protagonist";
import { advanceRuntimeNarrativeSequences } from "@evavo/adventure-scene-runtime/narrative";
import {
  advanceRuntimeRoomScripts,
  createRuntimeRoomScriptState,
} from "@evavo/adventure-scene-runtime/room-scripts";
import { describe, expect, it } from "vitest";
import { applyNewMultiProtagonistBindings } from "../src/multi-protagonist-bindings-runtime.js";
import { projectMultiProtagonistIntoWorld } from "../src/multi-protagonist-projection.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const story = {
  schemaVersion: 1 as const,
  projectId: id<"project">("project.cross-stress"),
  tick: 0,
  currentSceneId: id<"scene">("scene.present"),
  currentEntranceId: id<"entrance">("entrance.present"),
  flags: {},
  variables: {},
  inventory: [id<"item">("item.battery"), id<"item">("item.radio")],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
};

const world = (currentStory = story): InteractiveRuntimeWorldState => ({
  story: currentStory,
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
});

const grammar: SentenceGrammar = {
  emptyObjectText: "…",
  verbs: [
    {
      id: id<"ui-verb">("ui-verb.use"),
      verb: "use",
      label: "USE",
      primaryKinds: ["scene-object", "inventory-item"],
      secondaryRule: "inventory-primary",
      secondaryKinds: ["scene-object", "inventory-item"],
      preposition: "with",
    },
  ],
};

const bundle = {
  projectId: "project.cross-stress",
  scenes: [
    { id: "scene.present", entrances: [{ id: "entrance.present" }] },
    { id: "scene.future", entrances: [{ id: "entrance.future" }] },
    { id: "scene.cutaway", entrances: [{ id: "entrance.cutaway" }] },
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.future-door-gag",
      name: "Future Door Gag",
      mode: "cutscene",
      durationTicks: 2,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
  ],
  multiProtagonistBindings: {
    manifestVersion: 1,
    projectId: "project.cross-stress",
    bindings: [
      {
        id: "multi-binding.power-future-door",
        source: { kind: "item-combination-used", recipeId: "item-combination.power-radio" },
        effects: [
          { kind: "set-shared-flag", flag: "powerRestored", value: true },
          {
            kind: "set-protagonist-flag",
            protagonistId: "actor.future",
            flag: "cellDoorPowered",
            value: true,
          },
        ],
      },
    ],
  },
  roomScripts: {
    manifestVersion: 1,
    projectId: "project.cross-stress",
    scripts: [
      {
        id: "room-script.future.powered-door-gag",
        sceneId: "scene.future",
        trigger: {
          kind: "condition",
          condition: {
            kind: "flag",
            flag: "multi.local.actor.future.cellDoorPowered",
            equals: true,
          },
        },
        once: true,
        actions: [{ kind: "set-flag", flag: "futureDoorGagSeen", value: true }],
        cutaway: {
          sceneId: "scene.cutaway",
          entranceId: "entrance.cutaway",
          sequenceId: "sequence.future-door-gag",
          returnToPreviousLocation: true,
        },
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("cross-character whole-game grammar stress", () => {
  it("chains sentence puzzle, remote world mutation, character switch and returning cutaway", () => {
    let sentence = createSentenceState();
    const selectedVerb = selectSentenceVerb(grammar, sentence, id<"ui-verb">("ui-verb.use"));
    if (selectedVerb.kind !== "selected") throw new Error(selectedVerb.reason);
    sentence = selectedVerb.state;
    const battery = selectSentenceTarget(grammar, sentence, {
      kind: "inventory-item",
      itemId: id<"item">("item.battery"),
      label: "Battery",
    });
    if (battery.kind !== "selected") throw new Error(battery.reason);
    sentence = battery.state;
    const radio = selectSentenceTarget(grammar, sentence, {
      kind: "inventory-item",
      itemId: id<"item">("item.radio"),
      label: "Radio",
    });
    if (radio.kind !== "selected") throw new Error(radio.reason);
    sentence = radio.state;

    const combination = executeSentenceIntent(
      grammar,
      sentence,
      story,
      {
        manifestVersion: 1,
        recipes: [
          {
            id: "item-combination.power-radio",
            verb: "use",
            primaryItemId: id<"item">("item.battery"),
            secondaryItemId: id<"item">("item.radio"),
            commutative: true,
            once: true,
            actions: [
              { kind: "remove-item", itemId: id<"item">("item.battery") },
              { kind: "remove-item", itemId: id<"item">("item.radio") },
              { kind: "give-item", itemId: id<"item">("item.powered-radio") },
            ],
          },
        ],
      },
      createItemCombinationRuntimeState(),
    );
    expect(combination.kind).toBe("item-combination");
    if (combination.kind !== "item-combination") return;
    expect(combination.story.inventory).toEqual(["item.powered-radio"]);

    let protagonists = createMultiProtagonistState(
      [
        {
          protagonistId: id<"actor">("actor.present"),
          startSceneId: id<"scene">("scene.present"),
          startEntranceId: id<"entrance">("entrance.present"),
          startingInventory: [id<"item">("item.battery"), id<"item">("item.radio")],
        },
        {
          protagonistId: id<"actor">("actor.future"),
          startSceneId: id<"scene">("scene.future"),
          startEntranceId: id<"entrance">("entrance.future"),
        },
      ],
      id<"actor">("actor.present"),
    );
    const crossState = applyNewMultiProtagonistBindings(
      bundle,
      { world: world(story), usedRecipeIds: [] },
      { world: world(combination.story), usedRecipeIds: combination.combinations.usedRecipeIds },
      protagonists,
    );
    protagonists = crossState.state;
    expect(crossState.firedBindingIds).toEqual(["multi-binding.power-future-door"]);
    expect(protagonists.protagonists["actor.future"]?.flags.cellDoorPowered).toBe(true);

    protagonists = switchActiveProtagonist(protagonists, id<"actor">("actor.future"));
    const projected = projectMultiProtagonistIntoWorld(world(combination.story), protagonists);
    expect(projected.story.currentSceneId).toBe("scene.future");
    expect(projected.story.flags["multi.shared.powerRestored"]).toBe(true);
    expect(projected.story.flags["multi.local.actor.future.cellDoorPowered"]).toBe(true);

    let roomState = createRuntimeRoomScriptState(projected);
    const cutaway = advanceRuntimeRoomScripts(bundle, projected, roomState);
    roomState = cutaway.state;
    expect(cutaway.world.story.currentSceneId).toBe("scene.cutaway");
    expect(cutaway.world.story.flags.futureDoorGagSeen).toBe(true);
    expect(roomState.activeCutaway?.returnSceneId).toBe("scene.future");

    const sequence = advanceRuntimeNarrativeSequences(bundle, cutaway.world, 2);
    const returned = advanceRuntimeRoomScripts(bundle, sequence.state as never, roomState);
    expect(returned.world.story.currentSceneId).toBe("scene.future");
    expect(returned.world.story.currentEntranceId).toBe("entrance.future");
    expect(returned.state.activeCutaway).toBeNull();
  });
});
