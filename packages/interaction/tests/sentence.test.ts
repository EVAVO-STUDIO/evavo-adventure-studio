import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  classicScumm5SentenceGrammar,
  createSentenceState,
  formatSentence,
  resolveSentenceIntent,
  selectSentenceTarget,
  selectSentenceVerb,
} from "../src/sentence.js";

const grammar = classicScumm5SentenceGrammar([
  { id: "ui-verb.walk" as Id<"ui-verb">, verb: "walk", label: "Walk to" },
  { id: "ui-verb.open" as Id<"ui-verb">, verb: "open", label: "Open" },
  { id: "ui-verb.use" as Id<"ui-verb">, verb: "use", label: "Use" },
  { id: "ui-verb.give" as Id<"ui-verb">, verb: "give", label: "Give" },
]);

const door = {
  kind: "scene-object" as const,
  objectId: "object.door" as Id<"object">,
  label: "door",
};
const bernard = {
  kind: "scene-object" as const,
  objectId: "object.bernard" as Id<"object">,
  label: "Bernard",
};
const key = {
  kind: "inventory-item" as const,
  itemId: "item.key" as Id<"item">,
  label: "key",
};
const book = {
  kind: "inventory-item" as const,
  itemId: "item.book" as Id<"item">,
  label: "book",
};

describe("classic sentence grammar", () => {
  it("resolves a single-object verb into the existing room command", () => {
    const selectedVerb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.open" as Id<"ui-verb">);
    if (selectedVerb.kind !== "selected") throw new Error("Expected verb selection.");
    const selectedTarget = selectSentenceTarget(grammar, selectedVerb.state, door);
    if (selectedTarget.kind !== "selected") throw new Error("Expected target selection.");
    expect(formatSentence(grammar, selectedTarget.state)).toBe("Open door");
    expect(resolveSentenceIntent(grammar, selectedTarget.state)).toMatchObject({
      kind: "room-command",
      verb: "open",
      objectInstanceId: "object.door",
      itemId: null,
    });
  });

  it("holds an inventory-primary USE sentence until a second object is selected", () => {
    const selectedVerb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.use" as Id<"ui-verb">);
    if (selectedVerb.kind !== "selected") throw new Error("Expected verb selection.");
    const first = selectSentenceTarget(grammar, selectedVerb.state, key);
    if (first.kind !== "selected") throw new Error("Expected first object selection.");
    expect(formatSentence(grammar, first.state)).toBe("Use key with …");
    expect(resolveSentenceIntent(grammar, first.state).kind).toBe("incomplete");

    const second = selectSentenceTarget(grammar, first.state, door);
    if (second.kind !== "selected") throw new Error("Expected second object selection.");
    expect(resolveSentenceIntent(grammar, second.state)).toMatchObject({
      kind: "room-command",
      verb: "use",
      objectInstanceId: "object.door",
      itemId: "item.key",
      text: "Use key with door",
    });
  });

  it("preserves inventory-on-inventory combinations as their own intent", () => {
    const selectedVerb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.use" as Id<"ui-verb">);
    if (selectedVerb.kind !== "selected") throw new Error("Expected verb selection.");
    const first = selectSentenceTarget(grammar, selectedVerb.state, key);
    if (first.kind !== "selected") throw new Error("Expected first object selection.");
    const second = selectSentenceTarget(grammar, first.state, book);
    if (second.kind !== "selected") throw new Error("Expected second object selection.");
    expect(resolveSentenceIntent(grammar, second.state)).toMatchObject({
      kind: "item-combination",
      verb: "use",
      primaryItemId: "item.key",
      secondaryItemId: "item.book",
    });
  });

  it("supports GIVE item TO character and rejects invalid target order", () => {
    const selectedVerb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.give" as Id<"ui-verb">);
    if (selectedVerb.kind !== "selected") throw new Error("Expected verb selection.");
    const invalid = selectSentenceTarget(grammar, selectedVerb.state, bernard);
    expect(invalid.kind).toBe("invalid");

    const first = selectSentenceTarget(grammar, selectedVerb.state, book);
    if (first.kind !== "selected") throw new Error("Expected item selection.");
    const second = selectSentenceTarget(grammar, first.state, bernard);
    if (second.kind !== "selected") throw new Error("Expected recipient selection.");
    expect(formatSentence(grammar, second.state)).toBe("Give book to Bernard");
    expect(resolveSentenceIntent(grammar, second.state)).toMatchObject({
      kind: "room-command",
      verb: "give",
      objectInstanceId: "object.bernard",
      itemId: "item.book",
    });
  });

  it("prevents using an inventory item on itself", () => {
    const selectedVerb = selectSentenceVerb(grammar, createSentenceState(), "ui-verb.use" as Id<"ui-verb">);
    if (selectedVerb.kind !== "selected") throw new Error("Expected verb selection.");
    const first = selectSentenceTarget(grammar, selectedVerb.state, key);
    if (first.kind !== "selected") throw new Error("Expected first object selection.");
    const second = selectSentenceTarget(grammar, first.state, key);
    expect(second).toMatchObject({ kind: "invalid" });
  });
});
