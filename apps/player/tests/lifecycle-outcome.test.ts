import type { RuntimeState } from "@evavo/adventure-core";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { resolveActiveGameLifecycleOutcome } from "../src/lifecycle-outcome.js";

const story = {
  schemaVersion: 1,
  projectId: "project.lifecycle-player",
  tick: 10,
  currentSceneId: "scene.office",
  currentEntranceId: "entrance.office",
  flags: { failed: true, ended: true },
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
} as RuntimeState;

const menu = {
  allowQuickRetry: true,
  allowLoad: true,
  allowRestart: true,
  allowTitle: true,
  labels: {
    quickRetry: "QUICK RETRY",
    loadGame: "LOAD GAME",
    restartGame: "RESTART GAME",
    returnToTitle: "RETURN TO TITLE",
    back: "BACK",
  },
};

const bundle = {
  projectId: story.projectId,
  lifecycle: {
    manifestVersion: 1,
    projectId: story.projectId,
    outcomes: [
      {
        id: "outcome.z",
        kind: "failure",
        priority: 10,
        when: { kind: "flag", flag: "failed", equals: true },
        title: "Failure Z",
        message: "Z",
        menu,
      },
      {
        id: "outcome.a",
        kind: "success",
        priority: 10,
        when: { kind: "flag", flag: "ended", equals: true },
        title: "Ending A",
        message: "A",
        menu,
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("active game lifecycle outcome", () => {
  it("chooses highest priority then stable ID", () => {
    expect(resolveActiveGameLifecycleOutcome(bundle, story)?.id).toBe("outcome.a");
  });

  it("returns null when no condition matches", () => {
    expect(resolveActiveGameLifecycleOutcome(bundle, { ...story, flags: {} })).toBeNull();
  });
});