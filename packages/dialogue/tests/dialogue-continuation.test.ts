import { describe, expect, it } from "vitest";
import type { DialogueGraph, Id } from "@evavo/adventure-project-schema";
import type { RuntimeState } from "@evavo/adventure-core";
import {
  beginDialogue,
  continueDialogue,
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
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

const automaticDialogue: DialogueGraph = {
  id: id<"dialogue">("dialogue.automatic"),
  name: "Automatic exchange",
  startNodeId: id<"dialogue-node">("node.first"),
  nodes: [
    {
      id: id<"dialogue-node">("node.first"),
      enterActions: [],
      lines: [
        {
          id: id<"dialogue-line">("line.first"),
          text: "The first line.",
          interruptible: true,
        },
      ],
      choices: [],
      autoNextNodeId: id<"dialogue-node">("node.second"),
      exitActions: [
        { kind: "set-flag", flag: "firstLineComplete", value: true },
      ],
    },
    {
      id: id<"dialogue-node">("node.second"),
      enterActions: [
        { kind: "set-flag", flag: "secondLineStarted", value: true },
      ],
      lines: [
        {
          id: id<"dialogue-line">("line.second"),
          text: "The second line.",
          interruptible: true,
        },
      ],
      choices: [],
      exitActions: [
        { kind: "set-flag", flag: "exchangeComplete", value: true },
      ],
    },
  ],
};

describe("automatic dialogue continuation", () => {
  it("moves between line-only nodes and commits boundary actions", () => {
    const started = beginDialogue(createState(), automaticDialogue);
    if (started.kind !== "active") {
      throw new Error("Expected dialogue to start.");
    }

    const continued = continueDialogue(
      started.transition.state,
      automaticDialogue,
    );
    expect(continued.kind).toBe("active");
    if (continued.kind !== "active") {
      throw new Error("Expected the second node to become active.");
    }

    expect(continued.view.nodeId).toBe("node.second");
    expect(continued.transition.state.flags).toMatchObject({
      firstLineComplete: true,
      secondLineStarted: true,
    });

    const ended = continueDialogue(
      continued.transition.state,
      automaticDialogue,
    );
    expect(ended.kind).toBe("ended");
    if (ended.kind === "ended") {
      expect(ended.transition.state.flags.exchangeComplete).toBe(true);
      expect(ended.transition.state.activeDialogue).toBeNull();
    }
  });

  it("does not auto-advance past a usable choice", () => {
    const graph: DialogueGraph = {
      ...automaticDialogue,
      nodes: [
        {
          ...automaticDialogue.nodes[0]!,
          choices: [
            {
              id: id<"dialogue-choice">("choice.answer"),
              text: "Answer",
              once: false,
              actions: [],
              closeDialogue: true,
            },
          ],
        },
        automaticDialogue.nodes[1]!,
      ],
    };
    const started = beginDialogue(createState(), graph);
    if (started.kind !== "active") {
      throw new Error("Expected dialogue to start.");
    }

    expect(continueDialogue(started.transition.state, graph)).toMatchObject({
      kind: "rejected",
      reason: "choices-pending",
    });
  });
});
