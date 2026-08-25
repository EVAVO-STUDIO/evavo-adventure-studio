import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import type { InteractiveRuntimeWorldState } from "../src/commands.js";
import {
  activateSpecializedAdventureModeSession,
  advanceSpecializedAdventureModeSession,
  createSpecializedAdventureModeSessionState,
  startSpecializedAdventureModeSession,
} from "../src/specialized-mode-session.js";

const asId = <T extends string>(value: string): Id<T> => value as Id<T>;

const worldAt = (tick = 0): InteractiveRuntimeWorldState => ({
  story: {
    schemaVersion: 1,
    projectId: asId<"project">("project.modes"),
    tick,
    currentSceneId: asId<"scene">("scene.room"),
    currentEntranceId: asId<"entrance">("entrance.room"),
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
  },
  actorInstances: {},
  movements: {},
  pendingObjectCommands: {},
  activeInteractionChoreographies: {},
  activeEntryChoreographies: {},
});

const mode = (
  id: string,
  kind: "vehicle" | "action" | "quick-response" | "cinematic-inset" | "puzzle-closeup",
) => ({
  id: `specialized-mode.${id}`,
  kind,
  once: true,
  sceneId: "scene.mode",
  entranceId: "entrance.mode",
  startStateId: "ready",
  return: { kind: "previous-location" as const },
  states: [
    {
      id: "ready",
      inputRegions: [
        {
          id: "finish",
          label: "Finish",
          shape: {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          actions: [{ kind: "set-flag" as const, flag: `mode.${id}.complete`, value: true }],
          finishOutcomeId: "complete",
        },
      ],
    },
  ],
});

const bundle = {
  projectId: "project.modes",
  specializedModes: {
    manifestVersion: 1,
    projectId: "project.modes",
    modes: [
      mode("vehicle", "vehicle"),
      mode("action", "action"),
      mode("quick", "quick-response"),
      mode("inset", "cinematic-inset"),
      mode("closeup", "puzzle-closeup"),
      {
        ...mode("triggered", "quick-response"),
        trigger: { kind: "interaction-consumed", interactionId: "interaction.trigger" },
      },
      {
        id: "specialized-mode.timeout",
        kind: "quick-response",
        once: true,
        sceneId: "scene.mode",
        entranceId: "entrance.mode",
        startStateId: "wait",
        return: { kind: "stay" },
        states: [
          {
            id: "wait",
            timeout: {
              afterTicks: 5,
              actions: [{ kind: "set-flag", flag: "timeout.complete", value: true }],
              finishOutcomeId: "late",
            },
          },
        ],
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("specialized mode session", () => {
  it("uses one deterministic lifecycle for every specialized mode kind", () => {
    for (const id of ["vehicle", "action", "quick", "inset", "closeup"] as const) {
      let world = worldAt();
      let state = createSpecializedAdventureModeSessionState(world);
      const started = startSpecializedAdventureModeSession(bundle, world, state, `specialized-mode.${id}`);
      world = started.world;
      state = started.state;
      expect(state.active?.kind).toBe(
        id === "quick" ? "quick-response" : id === "inset" ? "cinematic-inset" : id === "closeup" ? "puzzle-closeup" : id,
      );
      expect(world.story.currentSceneId).toBe("scene.mode");

      const finished = activateSpecializedAdventureModeSession(bundle, world, state, { x: 50, y: 50 });
      expect(finished.state.active).toBeNull();
      expect(finished.world.story.currentSceneId).toBe("scene.room");
      expect(finished.world.story.currentEntranceId).toBe("entrance.room");
      expect(finished.world.story.flags[`mode.${id}.complete`]).toBe(true);
      expect(finished.state.firedModeIds).toContain(`specialized-mode.${id}`);
    }
  });

  it("auto-starts from a newly consumed one-shot interaction and cannot retrigger it", () => {
    const initial = worldAt();
    const state = createSpecializedAdventureModeSessionState(initial);
    const consumed = {
      ...initial,
      story: {
        ...initial.story,
        consumedInteractionIds: [asId<"interaction">("interaction.trigger")],
      },
    };
    const started = advanceSpecializedAdventureModeSession(bundle, consumed, state);
    expect(started.state.active?.modeId).toBe("specialized-mode.triggered");

    const finished = activateSpecializedAdventureModeSession(
      bundle,
      started.world,
      started.state,
      { x: 50, y: 50 },
    );
    expect(finished.state.active).toBeNull();
    const repeated = advanceSpecializedAdventureModeSession(bundle, finished.world, finished.state);
    expect(repeated.state.active).toBeNull();
  });

  it("advances authored fixed-tick timeouts without normal room input", () => {
    const initial = worldAt(10);
    const state = createSpecializedAdventureModeSessionState(initial);
    const started = startSpecializedAdventureModeSession(bundle, initial, state, "specialized-mode.timeout");
    const advancedWorld = {
      ...started.world,
      story: { ...started.world.story, tick: 15 },
    };
    const finished = advanceSpecializedAdventureModeSession(bundle, advancedWorld, started.state);
    expect(finished.state.active).toBeNull();
    expect(finished.world.story.currentSceneId).toBe("scene.mode");
    expect(finished.world.story.flags["timeout.complete"]).toBe(true);
  });
});
