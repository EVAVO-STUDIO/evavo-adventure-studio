import type { RuntimeEvent, RuntimeState } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { applyDialogueRequestEvents, chooseActiveRuntimeDialogueOption } from "../src/dialogue.js";
import {
  advanceRuntimeNarrativeSequences,
  applyRuntimeNarrativeRequestEvents,
  RuntimeNarrativeRequestError,
} from "../src/narrative.js";
import { advanceInteractiveRuntimeWorld } from "../src/runtime-commands.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const story = (overrides: Partial<RuntimeState> = {}): RuntimeState => ({
  schemaVersion: 1,
  projectId: id<"project">("project.narrative"),
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
  ...overrides,
});

const routeSequence = {
  id: id<"sequence">("sequence.route"),
  name: "Route reveal",
  mode: "cutscene" as const,
  durationTicks: 2,
  loop: false,
  blocking: true,
  savePolicy: "boundary-only" as const,
  skip: {
    allowed: true,
    safeAfterTick: 0,
    completionActions: [
      {
        kind: "change-scene" as const,
        sceneId: id<"scene">("scene.quay"),
        entranceId: id<"entrance">("entrance.quay"),
      },
    ],
  },
  cueCount: 1,
  tracks: [
    {
      id: id<"sequence-track">("sequence-track.route.story"),
      kind: "story" as const,
      cues: [
        {
          kind: "story-action" as const,
          atTick: 0,
          action: {
            kind: "set-flag" as const,
            flag: "route.revealed",
            value: true,
          },
        },
      ],
    },
  ],
};

const witnessDialogue = {
  id: id<"dialogue">("dialogue.witness"),
  name: "Witness",
  startNodeId: id<"dialogue-node">("dialogue-node.witness"),
  nodes: [
    {
      id: id<"dialogue-node">("dialogue-node.witness"),
      enterActions: [],
      lines: [],
      choices: [
        {
          id: id<"dialogue-choice">("dialogue-choice.route"),
          text: "Show me the route",
          once: true,
          actions: [
            {
              kind: "play-sequence" as const,
              sequenceId: routeSequence.id,
            },
          ],
          closeDialogue: true,
        },
      ],
      exitActions: [],
    },
  ],
  nodeIndex: { "dialogue-node.witness": 0 },
};

const narrativeBundle = {
  dialogues: [witnessDialogue],
  sequences: [routeSequence],
} as Pick<RuntimeBundle, "dialogues" | "sequences">;

const requestSequence = (): RuntimeEvent => ({
  kind: "sequence-requested",
  sequenceId: routeSequence.id,
});

describe("runtime narrative request execution", () => {
  it("starts requested sequences and applies tick-zero story actions", () => {
    const result = applyRuntimeNarrativeRequestEvents(narrativeBundle, { story: story() }, [
      requestSequence(),
    ]);

    expect(result.state.story.activeSequences).toHaveLength(1);
    expect(result.state.story.flags["route.revealed"]).toBe(true);
    expect(result.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        "sequence-requested",
        "sequence-started",
        "sequence-cue-reached",
        "flag-changed",
      ]),
    );
  });

  it("advances active sequences and applies completion state", () => {
    const started = applyRuntimeNarrativeRequestEvents(narrativeBundle, { story: story() }, [
      requestSequence(),
    ]);
    const advanced = advanceRuntimeNarrativeSequences(narrativeBundle, started.state, 2);

    expect(advanced.state.story.activeSequences).toEqual([]);
    expect(advanced.state.story.currentSceneId).toBe("scene.quay");
    expect(advanced.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["scene-change-requested", "sequence-completed"]),
    );
  });

  it("preserves authored ordering across mixed narrative requests", () => {
    const result = applyDialogueRequestEvents(narrativeBundle, { story: story() }, [
      requestSequence(),
      {
        kind: "dialogue-requested",
        dialogueId: witnessDialogue.id,
        nodeId: null,
      },
    ]);
    const kinds = result.events.map((event) => event.kind);

    expect(kinds.indexOf("sequence-started")).toBeLessThan(kinds.indexOf("dialogue-node-entered"));
    expect(result.state.story.activeSequences).toHaveLength(1);
    expect(result.state.story.activeDialogue?.dialogueId).toBe(witnessDialogue.id);
  });

  it("keeps dialogue-only callers compatible when no sequence is requested", () => {
    const result = applyDialogueRequestEvents({ dialogues: [witnessDialogue] }, { story: story() }, [
      {
        kind: "dialogue-requested",
        dialogueId: witnessDialogue.id,
        nodeId: null,
      },
    ]);

    expect(result.state.story.activeDialogue?.dialogueId).toBe(witnessDialogue.id);
  });

  it("starts sequence requests emitted by dialogue choices", () => {
    const active = story({
      activeDialogue: {
        dialogueId: witnessDialogue.id,
        nodeId: witnessDialogue.startNodeId,
      },
    });
    const result = chooseActiveRuntimeDialogueOption(
      narrativeBundle,
      { story: active },
      id<"dialogue-choice">("dialogue-choice.route"),
    );

    expect(result.kind).toBe("ended");
    if (result.kind === "rejected") {
      throw new Error(`Dialogue choice was rejected: ${result.detail}`);
    }
    expect(result.state.story.activeSequences).toHaveLength(1);
    expect(result.events.map((event) => event.kind)).toContain("sequence-started");
  });

  it("freezes movement during blocking playback and clears it on scene change", () => {
    const started = applyRuntimeNarrativeRequestEvents(narrativeBundle, { story: story() }, [
      requestSequence(),
    ]);
    const bundle = {
      ...narrativeBundle,
      presentation: {
        logicalTicksPerSecond: 60,
      },
      actors: [],
      scenes: [],
      sceneInstances: null,
    } as unknown as RuntimeBundle;
    const movement = {
      actorInstanceId: id<"actor-instance">("actor-instance.detective"),
      route: {
        points: [],
        segments: [],
        distance: 10,
        startAreaId: id<"navigation-area">("navigation.office"),
        endAreaId: id<"navigation-area">("navigation.office"),
        snappedStart: false,
        snappedEnd: false,
      },
      nextSegmentIndex: 0,
      distanceAlongSegment: 0,
      speedPixelsPerSecond: 48,
      walkAnimationState: "walk",
      arrivalAnimationState: "idle",
    };
    const world = {
      story: started.state.story,
      actorInstances: {},
      movements: { "actor-instance.detective": movement },
      pendingObjectCommands: {},
    };

    const held = advanceInteractiveRuntimeWorld(bundle, world, 1);
    expect(held.state.movements["actor-instance.detective"]).toBeDefined();
    expect(held.state.story.activeSequences[0]?.elapsedTicks).toBe(1);

    const completed = advanceInteractiveRuntimeWorld(bundle, held.state, 1);
    expect(completed.state.story.currentSceneId).toBe("scene.quay");
    expect(completed.state.movements).toEqual({});
  });

  it("bounds recursive dialogue requests", () => {
    const dialogueA = {
      id: id<"dialogue">("dialogue.a"),
      name: "A",
      startNodeId: id<"dialogue-node">("node.a"),
      nodes: [
        {
          id: id<"dialogue-node">("node.a"),
          enterActions: [
            {
              kind: "start-dialogue" as const,
              dialogueId: id<"dialogue">("dialogue.b"),
            },
          ],
          lines: [],
          choices: [],
          exitActions: [],
        },
      ],
      nodeIndex: { "node.a": 0 },
    };
    const dialogueB = {
      id: id<"dialogue">("dialogue.b"),
      name: "B",
      startNodeId: id<"dialogue-node">("node.b"),
      nodes: [
        {
          id: id<"dialogue-node">("node.b"),
          enterActions: [
            {
              kind: "start-dialogue" as const,
              dialogueId: id<"dialogue">("dialogue.a"),
            },
          ],
          lines: [],
          choices: [],
          exitActions: [],
        },
      ],
      nodeIndex: { "node.b": 0 },
    };
    const bundle = {
      dialogues: [dialogueA, dialogueB],
      sequences: [],
    } as Pick<RuntimeBundle, "dialogues" | "sequences">;

    expect(() =>
      applyRuntimeNarrativeRequestEvents(
        bundle,
        { story: story() },
        [
          {
            kind: "dialogue-requested",
            dialogueId: dialogueA.id,
            nodeId: null,
          },
        ],
        { maximumRequests: 4 },
      ),
    ).toThrow(RuntimeNarrativeRequestError);
  });

  it("rejects missing narrative targets instead of silently dropping them", () => {
    expect(() =>
      applyRuntimeNarrativeRequestEvents({ dialogues: [], sequences: [] }, { story: story() }, [
        requestSequence(),
      ]),
    ).toThrow(/does not exist/);
  });
});
