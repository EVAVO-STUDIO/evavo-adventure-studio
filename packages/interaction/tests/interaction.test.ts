import type { RuntimeState } from "@evavo/adventure-core";
import type { Hotspot, Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  executeHotspotCommand,
  type InteractionCommand,
  resolveCursor,
  resolveHotspotCommand,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const state = (): RuntimeState => ({
  schemaVersion: 1,
  projectId: id<"project">("project.fixture"),
  tick: 0,
  currentSceneId: id<"scene">("scene.office"),
  currentEntranceId: id<"entrance">("entrance.office"),
  flags: { drawerUnlocked: true },
  variables: {},
  inventory: [id<"item">("item.brass-key")],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

const drawer: Hotspot = {
  id: id<"hotspot">("hotspot.drawer"),
  name: "Desk drawer",
  shape: {
    points: [
      { x: 100, y: 80 },
      { x: 180, y: 80 },
      { x: 180, y: 130 },
      { x: 100, y: 130 },
    ],
  },
  cursor: "inspect",
  fallbackText: "That will not open the drawer.",
  interactions: [
    {
      id: id<"interaction">("interaction.look-drawer"),
      verb: "look",
      actions: [{ kind: "say", text: "The lock is scratched." }],
    },
    {
      id: id<"interaction">("interaction.unlock-drawer"),
      verb: "use",
      itemId: id<"item">("item.brass-key"),
      when: { kind: "flag", flag: "drawerUnlocked", equals: true },
      once: true,
      actions: [
        {
          kind: "set-object-state",
          objectId: id<"object">("object.drawer"),
          state: "open",
        },
      ],
    },
  ],
};

const command = (verb: string, itemId: Id<"item"> | null): InteractionCommand => ({
  actorId: id<"actor">("actor.player"),
  verb,
  targetHotspotId: drawer.id,
  itemId,
});

describe("interaction resolver", () => {
  it("selects an exact inventory interaction", () => {
    const resolution = resolveHotspotCommand(state(), drawer, command("use", id<"item">("item.brass-key")));

    expect(resolution.kind).toBe("matched");
    if (resolution.kind === "matched") {
      expect(resolution.interaction.id).toBe("interaction.unlock-drawer");
    }
  });

  it("returns authored feedback for the wrong item", () => {
    const resolution = resolveHotspotCommand(state(), drawer, command("use", id<"item">("item.wrong-key")));

    expect(resolution).toMatchObject({
      kind: "fallback",
      reason: "no-match",
      text: "That will not open the drawer.",
    });
  });

  it("filters one-time interactions after execution", () => {
    const first = executeHotspotCommand(state(), drawer, command("use", id<"item">("item.brass-key")));
    expect(first.kind).toBe("executed");
    if (first.kind !== "executed") {
      throw new Error("Expected first interaction to execute.");
    }

    const second = resolveHotspotCommand(
      first.result.transition.state,
      drawer,
      command("use", id<"item">("item.brass-key")),
    );
    expect(second).toMatchObject({ kind: "fallback", reason: "already-used" });
  });

  it("allows cursor presentation to differ from command semantics", () => {
    const resolution = resolveHotspotCommand(state(), drawer, command("look", null));
    const cursor = resolveCursor({
      activeVerb: "look",
      selectedItemId: null,
      hotspot: drawer,
      resolution,
    });

    expect(cursor).toEqual({
      cursorId: "inspect",
      valid: true,
      semanticAction: "look",
    });
  });
});
