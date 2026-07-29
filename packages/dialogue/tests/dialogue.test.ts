import { describe, expect, it } from "vitest";
import type {
  DialogueGraph,
  Id,
} from "@evavo/adventure-project-schema";
import type { RuntimeState } from "@evavo/adventure-core";
import {
  beginDialogue,
  chooseDialogueOption,
  resolveDialogueView,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const createState = (): RuntimeState => ({
  schemaVersion: 1,
  projectId: id<"project">("project.fixture"),
  tick: 0,
  currentSceneId: id<"scene">("scene.office"),
  currentEntranceId: id<"entrance">("entrance.office"),
  flags: {},
  variables: {},
  inventory: [],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

const dialogue: DialogueGraph = {
  id: id<"dialogue">("dialogue.receptionist"),
  name: "Receptionist",
  startNodeId: id<"dialogue-node">("node.introduction"),
  nodes: [
    {
      id: id<"dialogue-node">("node.introduction"),
      enterActions: [],
      lines: [
        {
          id: id<"dialogue-line">("line.greeting"),
          speakerId: id<"actor">("actor.receptionist"),
          text: "Can I help you?",
          interruptible: true,
        },
      ],
      choices: [
        {
          id: id<"dialogue-choice">("choice.ask-ledger"),
          text: "Ask about the ledger",
          once: true,
          actions: [
            { kind: "set-flag", flag: "ledgerMentioned", value: true },
          ],
          nextNodeId: id<"dialogue-node">("node.introduction"),
          closeDialogue: false,
        },
        {
          id: id<"dialogue-choice">("choice.accuse"),
          text: "Make an accusation",
          enabledWhen: {
            kind: "flag",
            flag: "ledgerMentioned",
            equals: true,
          },
          once: false,
          actions: [],
          closeDialogue: true,
        },
        {
          id: id<"dialogue-choice">("choice.secret"),
          text: "Mention the hidden photograph",
          visibleWhen: {
            kind: "has-item",
            itemId: id<"item">("item.photograph"),
          },
          once: false,
          actions: [],
          closeDialogue: true,
        },
      ],
      exitActions: [],
    },
  ],
};

describe("dialogue runtime", () => {
  it("separates visible, enabled, and exhausted choice state", () => {
    const started = beginDialogue(createState(), dialogue);
    expect(started.kind).toBe("active");
    if (started.kind !== "active") {
      throw new Error("Expected dialogue to start.");
    }

    expect(started.view.choices).toEqual([
      expect.objectContaining({
        id: "choice.ask-ledger",
        visible: true,
        enabled: true,
        exhausted: false,
      }),
      expect.objectContaining({
        id: "choice.accuse",
        visible: true,
        enabled: false,
        exhausted: false,
      }),
      expect.objectContaining({
        id: "choice.secret",
        visible: false,
        enabled: false,
        exhausted: false,
      }),
    ]);
  });

  it("commits one-time choice memory before resolving the next node", () => {
    const started = beginDialogue(createState(), dialogue);
    if (started.kind !== "active") {
      throw new Error("Expected dialogue to start.");
    }

    const chosen = chooseDialogueOption(
      started.transition.state,
      dialogue,
      id<"dialogue-choice">("choice.ask-ledger"),
    );
    expect(chosen.kind).toBe("active");
    if (chosen.kind !== "active") {
      throw new Error("Expected dialogue to remain active.");
    }

    expect(chosen.transition.state.flags.ledgerMentioned).toBe(true);
    expect(chosen.transition.state.consumedDialogueChoiceIds).toContain(
      "choice.ask-ledger",
    );
    expect(
      chosen.view.choices.find((choice) => choice.id === "choice.ask-ledger"),
    ).toMatchObject({ exhausted: true, enabled: false });
    expect(
      chosen.view.choices.find((choice) => choice.id === "choice.accuse"),
    ).toMatchObject({ visible: true, enabled: true });
  });

  it("rejects an exhausted choice without changing state", () => {
    const activeState: RuntimeState = {
      ...createState(),
      activeDialogue: {
        dialogueId: dialogue.id,
        nodeId: dialogue.startNodeId,
      },
      consumedDialogueChoiceIds: [
        id<"dialogue-choice">("choice.ask-ledger"),
      ],
    };

    const result = chooseDialogueOption(
      activeState,
      dialogue,
      id<"dialogue-choice">("choice.ask-ledger"),
    );

    expect(result).toMatchObject({ kind: "rejected", reason: "choice-exhausted" });
    expect(result.kind === "rejected" ? result.state : null).toBe(activeState);
  });

  it("resolves save-loaded active dialogue views", () => {
    const state: RuntimeState = {
      ...createState(),
      activeDialogue: {
        dialogueId: dialogue.id,
        nodeId: dialogue.startNodeId,
      },
    };

    expect(resolveDialogueView(state, dialogue, dialogue.startNodeId)?.lines[0]?.text).toBe(
      "Can I help you?",
    );
  });
});
