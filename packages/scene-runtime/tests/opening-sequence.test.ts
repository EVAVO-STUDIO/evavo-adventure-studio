import type { RuntimeState } from "@evavo/adventure-core";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  skipRuntimeNarrativeSequence,
  startRuntimeNarrativeSequence,
} from "../src/narrative.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const story = (): RuntimeState => ({
  schemaVersion: 1,
  projectId: id<"project">("project.opening"),
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

const sequence = {
  id: id<"sequence">("sequence.opening"),
  name: "Opening",
  mode: "cutscene" as const,
  durationTicks: 60,
  loop: false,
  blocking: true,
  savePolicy: "disabled" as const,
  skip: {
    allowed: true,
    safeAfterTick: 12,
    completionActions: [
      {
        kind: "set-flag" as const,
        flag: "opening.complete",
        value: true,
      },
    ],
  },
  tracks: [
    {
      id: id<"sequence-track">("sequence-track.opening.story"),
      kind: "story" as const,
      cues: [
        {
          kind: "story-action" as const,
          atTick: 0,
          action: {
            kind: "set-flag" as const,
            flag: "opening.started",
            value: true,
          },
        },
      ],
    },
  ],
  cueCount: 1,
};

const bundle = {
  dialogues: [],
  sequences: [sequence],
} as Pick<RuntimeBundle, "dialogues" | "sequences">;

describe("opening sequence narrative helpers", () => {
  it("starts through the canonical request pipeline and applies tick-zero cues", () => {
    const result = startRuntimeNarrativeSequence(bundle, { story: story() }, sequence.id);

    expect(result.state.story.flags["opening.started"]).toBe(true);
    expect(result.state.story.activeSequences[0]).toMatchObject({
      sequenceId: sequence.id,
      elapsedTicks: 0,
    });
    expect(result.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        "sequence-requested",
        "sequence-started",
        "sequence-cue-reached",
        "flag-changed",
      ]),
    );
  });

  it("honours the authored safe skip boundary", () => {
    const started = startRuntimeNarrativeSequence(bundle, { story: story() }, sequence.id);
    const rejected = skipRuntimeNarrativeSequence(bundle, started.state, sequence.id);
    expect(rejected).toMatchObject({
      kind: "rejected",
      reason: "skip-boundary-not-reached",
    });

    const atBoundary = {
      ...started.state,
      story: {
        ...started.state.story,
        activeSequences: [
          {
            ...started.state.story.activeSequences[0],
            elapsedTicks: 12,
          },
        ],
      },
    };
    const skipped = skipRuntimeNarrativeSequence(bundle, atBoundary, sequence.id);
    expect(skipped.kind).toBe("skipped");
    expect(skipped.state.story.activeSequences).toEqual([]);
    expect(skipped.state.story.flags["opening.complete"]).toBe(true);
    expect(skipped.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["sequence-skipped", "sequence-completed", "flag-changed"]),
    );
  });
});
