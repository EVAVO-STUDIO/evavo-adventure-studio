import type { RuntimeState } from "@evavo/adventure-core";
import type { Id, Sequence } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { advanceSequence, skipSequence, startSequence } from "../src/index.js";

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

const sequence: Sequence = {
  id: id<"sequence">("sequence.office-intro"),
  name: "Office introduction",
  mode: "cutscene",
  durationTicks: 10,
  loop: false,
  blocking: true,
  savePolicy: "boundary-only",
  skip: {
    allowed: true,
    safeAfterTick: 3,
    completionActions: [{ kind: "set-flag", flag: "officeIntroComplete", value: true }],
  },
  tracks: [
    {
      id: id<"sequence-track">("track.story"),
      kind: "story",
      cues: [
        {
          kind: "story-action",
          atTick: 5,
          action: { kind: "set-flag", flag: "doorSlammed", value: true },
        },
      ],
    },
    {
      id: id<"sequence-track">("track.audio"),
      kind: "audio",
      cues: [
        {
          kind: "sound",
          atTick: 0,
          assetId: id<"asset">("asset.office-ambience"),
          bus: "ambience",
          volume: 1,
          loop: true,
        },
        {
          kind: "sound",
          atTick: 5,
          assetId: id<"asset">("asset.door-slam"),
          bus: "effects",
          volume: 1,
          loop: false,
        },
      ],
    },
  ],
};

describe("cinematic sequence runtime", () => {
  it("emits tick-zero cues when a sequence starts", () => {
    const started = startSequence(createState(), sequence);
    expect(started.kind).toBe("active");
    if (started.kind !== "active") {
      throw new Error("Expected sequence to start.");
    }

    expect(started.transition.events.map((event) => event.kind)).toEqual([
      "sequence-started",
      "sequence-cue-reached",
    ]);
    expect(started.transition.state.activeSequences[0]).toMatchObject({
      sequenceId: "sequence.office-intro",
      elapsedTicks: 0,
      iteration: 0,
    });
  });

  it("processes same-tick cues in stable track order and applies story state once", () => {
    const started = startSequence(createState(), sequence);
    if (started.kind !== "active") {
      throw new Error("Expected sequence to start.");
    }

    const advanced = advanceSequence(started.transition.state, sequence, 5);
    expect(advanced.kind).toBe("active");
    if (advanced.kind !== "active") {
      throw new Error("Expected sequence to remain active.");
    }

    const reached = advanced.transition.events.filter((event) => event.kind === "sequence-cue-reached");
    expect(reached.map((event) => (event.kind === "sequence-cue-reached" ? event.trackId : null))).toEqual([
      "track.audio",
      "track.story",
    ]);
    expect(advanced.transition.state.flags["doorSlammed"]).toBe(true);

    const completed = advanceSequence(advanced.transition.state, sequence, 5);
    expect(completed.kind).toBe("completed");
    if (completed.kind === "completed") {
      expect(completed.transition.state.activeSequences).toEqual([]);
    }
  });

  it("resumes from saved elapsed ticks without replaying earlier cues", () => {
    const started = startSequence(createState(), sequence);
    if (started.kind !== "active") {
      throw new Error("Expected sequence to start.");
    }
    const first = advanceSequence(started.transition.state, sequence, 3);
    if (first.kind !== "active") {
      throw new Error("Expected sequence to remain active.");
    }
    const resumed = advanceSequence(first.transition.state, sequence, 2);
    if (resumed.kind !== "active") {
      throw new Error("Expected sequence to remain active.");
    }

    expect(resumed.transition.events.filter((event) => event.kind === "sequence-cue-reached")).toHaveLength(
      2,
    );
    expect(resumed.transition.state.flags["doorSlammed"]).toBe(true);
  });

  it("enforces safe skip boundaries and authored completion state", () => {
    const started = startSequence(createState(), sequence);
    if (started.kind !== "active") {
      throw new Error("Expected sequence to start.");
    }

    expect(skipSequence(started.transition.state, sequence)).toMatchObject({
      kind: "rejected",
      reason: "skip-boundary-not-reached",
    });

    const advanced = advanceSequence(started.transition.state, sequence, 3);
    if (advanced.kind !== "active") {
      throw new Error("Expected sequence to remain active.");
    }
    const skipped = skipSequence(advanced.transition.state, sequence);

    expect(skipped.kind).toBe("skipped");
    if (skipped.kind === "skipped") {
      expect(skipped.transition.state.flags["officeIntroComplete"]).toBe(true);
      expect(skipped.transition.state.activeSequences).toEqual([]);
      expect(skipped.transition.events.map((event) => event.kind)).toEqual([
        "flag-changed",
        "sequence-skipped",
        "sequence-completed",
      ]);
    }
  });
});
