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
  id: id<"sequence">("sequence.safe-completion"),
  name: "Safe completion",
  mode: "cutscene",
  durationTicks: 4,
  loop: false,
  blocking: true,
  savePolicy: "boundary-only",
  skip: {
    allowed: true,
    safeAfterTick: 0,
    completionActions: [
      { kind: "set-flag", flag: "cutsceneComplete", value: true },
      {
        kind: "set-object-state",
        objectId: id<"object">("object.office-door"),
        state: "open",
      },
    ],
  },
  tracks: [],
};

const start = (): RuntimeState => {
  const started = startSequence(createState(), sequence);
  if (started.kind !== "active") {
    throw new Error("Expected sequence to start.");
  }
  return started.transition.state;
};

describe("sequence completion equivalence", () => {
  it("produces the same canonical story state when watched or skipped", () => {
    const watched = advanceSequence(start(), sequence, sequence.durationTicks);
    const skipped = skipSequence(start(), sequence);

    expect(watched.kind).toBe("completed");
    expect(skipped.kind).toBe("skipped");
    if (watched.kind !== "completed" || skipped.kind !== "skipped") {
      throw new Error("Expected both completion paths to succeed.");
    }

    expect(watched.transition.state.flags).toEqual(skipped.transition.state.flags);
    expect(watched.transition.state.objectStates).toEqual(skipped.transition.state.objectStates);
    expect(watched.transition.state.activeSequences).toEqual([]);
    expect(skipped.transition.state.activeSequences).toEqual([]);
  });
});
