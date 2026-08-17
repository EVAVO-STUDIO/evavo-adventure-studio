import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  createPlayerPlaytestBridge,
  installPlayerPlaytestBridge,
  PLAYER_PLAYTEST_GLOBAL,
  playerPlaytestAutomationRequested,
  type PlayerPlaytestController,
  type PlayerPlaytestWindow,
  type PlayerPlaytestWorldState,
} from "../src/playtest-automation.js";

const bundle = {
  projectId: "project.playtest",
  presentation: { nativeWidth: 320, nativeHeight: 200 },
  lifecycle: {
    projectId: "project.playtest",
    outcomes: [
      {
        id: "outcome.complete",
        priority: 100,
        when: { kind: "flag", flag: "complete", equals: true },
      },
    ],
  },
} as unknown as RuntimeBundle;

const createFixtureController = (): PlayerPlaytestController & {
  readonly activations: { readonly x: number; readonly y: number }[];
} => {
  let world: PlayerPlaytestWorldState = {
    story: {
      projectId: "project.playtest",
      tick: 0,
      currentSceneId: "scene.office",
      flags: {},
      inventory: [],
      score: 0,
      objectStates: {},
      activeDialogue: null,
      activeSequences: [],
    },
    movements: {},
    pendingObjectCommands: {},
    actorInstances: {
      "actor-instance.player": {
        sceneId: "scene.office",
        position: { x: 20, y: 170 },
        facing: "east",
        animationState: "idle",
      },
    },
  };
  const activations: { x: number; y: number }[] = [];
  return {
    controlledActorInstanceId: "actor-instance.player",
    activations,
    worldState: () => world,
    createFrame: (tick) => {
      world = {
        ...world,
        story: { ...world.story, tick },
        movements: tick < 3 ? { player: true } : {},
        pendingObjectCommands: tick < 3 ? { command: true } : {},
      };
    },
    setPointer: () => undefined,
    activate: (position) => {
      activations.push(position);
      world = {
        ...world,
        movements: { player: true },
        pendingObjectCommands: { command: true },
        story: {
          ...world.story,
          flags: { complete: true },
          score: 25,
        },
      };
    },
    statusText: () => (world.story.flags["complete"] ? "COMPLETE" : "READY"),
  };
};

describe("Player playtest automation bridge", () => {
  it("requires an explicit playtest query value", () => {
    expect(playerPlaytestAutomationRequested("?playtest=1")).toBe(true);
    expect(playerPlaytestAutomationRequested("?playtest=true")).toBe(true);
    expect(playerPlaytestAutomationRequested("?playtest=ON")).toBe(true);
    expect(playerPlaytestAutomationRequested("?playtest=0")).toBe(false);
    expect(playerPlaytestAutomationRequested("")).toBe(false);
  });

  it("activates native input, advances deterministically and exposes bounded state", () => {
    const controller = createFixtureController();
    const bridge = createPlayerPlaytestBridge(bundle, controller);
    const snapshot = bridge.activateAndSettle({ x: 42, y: 90 }, 10);

    expect(controller.activations).toEqual([{ x: 42, y: 90 }]);
    expect(snapshot).toMatchObject({
      projectId: "project.playtest",
      tick: 3,
      sceneId: "scene.office",
      score: 25,
      motionSettled: true,
      lifecycleOutcomeId: "outcome.complete",
      statusText: "COMPLETE",
      controlledActor: {
        id: "actor-instance.player",
        sceneId: "scene.office",
        position: { x: 20, y: 170 },
      },
    });
    expect(bridge.nativeCanvas).toEqual({ width: 320, height: 200 });
  });

  it("rejects unsafe coordinates, backwards time and unbounded settling", () => {
    const controller = createFixtureController();
    const bridge = createPlayerPlaytestBridge(bundle, controller);

    expect(() => bridge.activate({ x: 320, y: 10 })).toThrow("outside the native");
    expect(() => bridge.advanceTo(-1)).toThrow("Playtest tick");
    expect(() => bridge.activateAndSettle({ x: 10, y: 10 }, 2)).toThrow(
      "did not settle within 2 ticks",
    );
  });

  it("installs only for opted-in pages and removes only its own bridge", () => {
    const controller = createFixtureController();
    const disabled: PlayerPlaytestWindow = { location: { search: "" } };
    installPlayerPlaytestBridge(disabled, bundle, controller);
    expect(disabled).not.toHaveProperty(PLAYER_PLAYTEST_GLOBAL);

    const enabled: PlayerPlaytestWindow = { location: { search: "?playtest=1" } };
    const remove = installPlayerPlaytestBridge(enabled, bundle, controller);
    expect(enabled[PLAYER_PLAYTEST_GLOBAL]?.projectId).toBe("project.playtest");
    remove();
    expect(enabled).not.toHaveProperty(PLAYER_PLAYTEST_GLOBAL);
  });
});
