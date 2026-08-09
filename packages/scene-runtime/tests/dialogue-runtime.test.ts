import { createInitialState, type RuntimeEvent } from "@evavo/adventure-core";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  applyDialogueRequestEvents,
  chooseActiveRuntimeDialogueOption,
  resolveActiveRuntimeDialogue,
} from "../src/dialogue.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.dialogue-runtime",
  title: "Dialogue Runtime",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [
    {
      id: "dialogue.clerk",
      name: "Clerk interview",
      startNodeId: "dialogue-node.clerk.opening",
      nodes: [
        {
          id: "dialogue-node.clerk.opening",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.clerk.opening",
              text: "The ledger left before the rain.",
              interruptible: true,
            },
          ],
          choices: [
            {
              id: "dialogue-choice.clerk.ledger",
              text: "Who took it?",
              once: true,
              actions: [
                {
                  kind: "set-flag",
                  flag: "clerk.asked-about-ledger",
                  value: true,
                },
              ],
              nextNodeId: "dialogue-node.clerk.answer",
              closeDialogue: false,
            },
          ],
          exitActions: [],
        },
        {
          id: "dialogue-node.clerk.answer",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.clerk.answer",
              text: "A man in a grey hat signed for it.",
              interruptible: true,
            },
          ],
          choices: [
            {
              id: "dialogue-choice.clerk.end",
              text: "That is all.",
              once: false,
              actions: [],
              closeDialogue: true,
            },
          ],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [],
  assets: [{ id: "asset.office", path: "art/office.png", kind: "image" }],
  inventoryItems: [],
});

const bundle = {
  dialogues: project.dialogues,
} as Pick<RuntimeBundle, "dialogues">;

describe("dialogue runtime world bridge", () => {
  it("activates requested dialogue and appends node-entry events", () => {
    const world = { story: createInitialState(project), marker: "unchanged" };
    const requested: RuntimeEvent[] = [
      {
        kind: "dialogue-requested",
        dialogueId: project.dialogues[0]!.id,
        nodeId: null,
      },
    ];

    const started = applyDialogueRequestEvents(bundle, world, requested);

    expect(started.state.marker).toBe("unchanged");
    expect(started.state.story.activeDialogue).toEqual({
      dialogueId: "dialogue.clerk",
      nodeId: "dialogue-node.clerk.opening",
    });
    expect(started.view?.lines[0]?.text).toBe("The ledger left before the rain.");
    expect(started.events.map((event) => event.kind)).toEqual([
      "dialogue-requested",
      "dialogue-node-entered",
    ]);
  });

  it("applies choice actions, consumes once choices and changes nodes", () => {
    const started = applyDialogueRequestEvents(bundle, { story: createInitialState(project) }, [
      {
        kind: "dialogue-requested",
        dialogueId: project.dialogues[0]!.id,
        nodeId: null,
      },
    ]);

    const chosen = chooseActiveRuntimeDialogueOption(
      bundle,
      started.state,
      project.dialogues[0]!.nodes[0]!.choices[0]!.id,
    );

    expect(chosen.kind).toBe("active");
    if (chosen.kind !== "active") return;
    expect(chosen.state.story.flags["clerk.asked-about-ledger"]).toBe(true);
    expect(chosen.state.story.consumedDialogueChoiceIds).toContain("dialogue-choice.clerk.ledger");
    expect(chosen.view.nodeId).toBe("dialogue-node.clerk.answer");
    expect(resolveActiveRuntimeDialogue(bundle, chosen.state)?.lines[0]?.text).toBe(
      "A man in a grey hat signed for it.",
    );
  });

  it("closes active dialogue through a close choice", () => {
    const started = applyDialogueRequestEvents(bundle, { story: createInitialState(project) }, [
      {
        kind: "dialogue-requested",
        dialogueId: project.dialogues[0]!.id,
        nodeId: project.dialogues[0]!.nodes[1]!.id,
      },
    ]);
    const ended = chooseActiveRuntimeDialogueOption(
      bundle,
      started.state,
      project.dialogues[0]!.nodes[1]!.choices[0]!.id,
    );

    expect(ended.kind).toBe("ended");
    if (ended.kind !== "ended") {
      throw new Error("Expected the close choice to end the active dialogue.");
    }
    expect(ended.state.story.activeDialogue).toBeNull();
    expect(ended.events.map((event) => event.kind)).toContain("dialogue-ended");
  });
});
