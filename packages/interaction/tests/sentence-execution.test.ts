import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeState } from "@evavo/adventure-core";
import { describe, expect, it } from "vitest";
import { type ItemCombinationManifest } from "../src/item-combinations.js";
import { executeSentenceIntent } from "../src/sentence-execution.js";
import {
  classicScumm5SentenceGrammar,
  createSentenceState,
  selectSentenceTarget,
  selectSentenceVerb,
} from "../src/sentence.js";

const grammar = classicScumm5SentenceGrammar([
  { id: "ui-verb.open" as Id<"ui-verb">, verb: "open", label: "Open" },
  { id: "ui-verb.use" as Id<"ui-verb">, verb: "use", label: "Use" },
]);

const item = (id: string) => id as Id<"item">;
const story: RuntimeState = {
  schemaVersion: 1,
  projectId: "project.sentence-execution" as Id<"project">,
  tick: 0,
  currentSceneId: "scene.lab" as Id<"scene">,
  currentEntranceId: "entrance.lab" as Id<"entrance">,
  flags: {},
  variables: {},
  inventory: [item("item.battery"), item("item.radio")],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
};

const combinations: ItemCombinationManifest = {
  manifestVersion: 1,
  recipes: [{
    id: "item-combination.power-radio",
    verb: "use",
    primaryItemId: item("item.battery"),
    secondaryItemId: item("item.radio"),
    commutative: true,
    actions: [
      { kind: "remove-item", itemId: item("item.battery") },
      { kind: "remove-item", itemId: item("item.radio") },
      { kind: "give-item", itemId: item("item.powered-radio") },
    ],
  }],
};

describe("classic sentence execution", () => {
  it("hands room sentences to the existing object-command path", () => {
    const verb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.open" as Id<"ui-verb">);
    if (verb.kind !== "selected") throw new Error("Expected verb.");
    const target = selectSentenceTarget(grammar, verb.state, {
      kind: "scene-object",
      objectId: "object.door" as Id<"object">,
      label: "door",
    });
    if (target.kind !== "selected") throw new Error("Expected target.");
    expect(executeSentenceIntent(grammar, target.state, story, combinations)).toMatchObject({
      kind: "room-command",
      verb: "open",
      objectInstanceId: "object.door",
      itemId: null,
    });
  });

  it("executes item-on-item sentences through the recipe runtime", () => {
    const verb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.use" as Id<"ui-verb">);
    if (verb.kind !== "selected") throw new Error("Expected verb.");
    const first = selectSentenceTarget(grammar, verb.state, {
      kind: "inventory-item",
      itemId: item("item.battery"),
      label: "battery",
    });
    if (first.kind !== "selected") throw new Error("Expected first item.");
    const second = selectSentenceTarget(grammar, first.state, {
      kind: "inventory-item",
      itemId: item("item.radio"),
      label: "radio",
    });
    if (second.kind !== "selected") throw new Error("Expected second item.");
    const result = executeSentenceIntent(grammar, second.state, story, combinations);
    expect(result.kind).toBe("item-combination");
    if (result.kind !== "item-combination") return;
    expect(result.result.kind).toBe("executed");
    expect(result.story.inventory).toEqual([item("item.powered-radio")]);
  });
});
