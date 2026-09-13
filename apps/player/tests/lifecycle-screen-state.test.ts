import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import { describe, expect, it } from "vitest";
import {
  createGameLifecycleScreenState,
  gameLifecycleScreenItems,
  transitionGameLifecycleScreen,
} from "../src/lifecycle-screen-state.js";
import type { SaveGameSlotSnapshot } from "../src/save-storage.js";

const outcome: GameLifecycleOutcome = {
  id: "outcome.failure",
  kind: "failure",
  priority: 10,
  when: { kind: "flag", flag: "failed", equals: true },
  title: "Case Closed",
  message: "The trail ends here.",
  menu: {
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
  },
};

const slots = (): readonly SaveGameSlotSnapshot[] =>
  Array.from({ length: 10 }, (_, slot) =>
    slot === 4
      ? {
          slot,
          status: "valid" as const,
          tick: 400,
          sceneId: "scene.office" as never,
          sceneName: "Office",
          score: 5,
          inventoryCount: 1,
          saveFingerprint: "fnv1a64:0000000000000000",
        }
      : { slot, status: "empty" as const },
  );

describe("game lifecycle recovery screen", () => {
  it("disables Quick Retry without slot zero or a dedicated checkpoint", () => {
    const items = gameLifecycleScreenItems(createGameLifecycleScreenState(), outcome, slots());
    expect(items.map((item) => [item.id, item.enabled])).toEqual([
      ["quick-retry", false],
      ["load", true],
      ["restart", true],
      ["title", true],
    ]);
  });

  it("enables Quick Retry from a dedicated checkpoint without requiring slot zero", () => {
    const state = createGameLifecycleScreenState();
    const capabilities = { quickRetryAvailable: true };
    expect(gameLifecycleScreenItems(state, outcome, slots(), capabilities)[0]).toMatchObject({
      id: "quick-retry",
      enabled: true,
    });
    expect(
      transitionGameLifecycleScreen(state, { kind: "activate" }, outcome, slots(), capabilities).effect,
    ).toEqual({ kind: "quick-retry" });
  });

  it("keeps the legacy slot-zero Quick Retry behavior when no dedicated checkpoint is supplied", () => {
    const snapshots = slots().map((snapshot) =>
      snapshot.slot === 0
        ? {
            slot: 0,
            status: "valid" as const,
            tick: 100,
            sceneId: "scene.office" as never,
            sceneName: "Office",
            score: 2,
            inventoryCount: 0,
            saveFingerprint: "fnv1a64:1111111111111111",
          }
        : snapshot,
    );
    const state = createGameLifecycleScreenState();
    expect(transitionGameLifecycleScreen(state, { kind: "activate" }, outcome, snapshots).effect).toEqual({
      kind: "load-slot",
      slot: 0,
    });
  });

  it("loads the exact selected manual slot", () => {
    const snapshots = slots();
    let state = createGameLifecycleScreenState();
    state = transitionGameLifecycleScreen(state, { kind: "set-selection", index: 1 }, outcome, snapshots).state;
    state = transitionGameLifecycleScreen(state, { kind: "activate" }, outcome, snapshots).state;
    expect(state.screen).toBe("load");

    state = transitionGameLifecycleScreen(state, { kind: "set-selection", index: 4 }, outcome, snapshots).state;
    expect(transitionGameLifecycleScreen(state, { kind: "activate" }, outcome, snapshots).effect).toEqual({
      kind: "load-slot",
      slot: 4,
    });
  });

  it("cannot dismiss a terminal outcome with Escape from the root screen", () => {
    const state = createGameLifecycleScreenState();
    expect(transitionGameLifecycleScreen(state, { kind: "back" }, outcome, slots())).toEqual({
      state,
      effect: null,
    });
  });
});
