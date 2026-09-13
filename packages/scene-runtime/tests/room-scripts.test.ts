import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { advanceRuntimeNarrativeSequences } from "../src/narrative.js";
import { advanceRuntimeRoomScripts, createRuntimeRoomScriptState } from "../src/room-scripts.js";

const baseWorld = {
  story: {
    schemaVersion: 1,
    projectId: "project.cutaway",
    tick: 0,
    currentSceneId: "scene.room",
    currentEntranceId: "entrance.room",
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
} as never;

const bundle = {
  projectId: "project.cutaway",
  scenes: [
    { id: "scene.room", entrances: [{ id: "entrance.room" }] },
    { id: "scene.cutaway", entrances: [{ id: "entrance.cutaway" }] },
  ],
  sequences: [
    {
      id: "sequence.cutaway",
      name: "Cutaway",
      mode: "cutscene",
      durationTicks: 2,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
  ],
  dialogues: [],
  roomScripts: {
    manifestVersion: 1,
    projectId: "project.cutaway",
    scripts: [
      {
        id: "room-script.room.first-enter",
        sceneId: "scene.room",
        trigger: { kind: "scene-first-enter" },
        once: true,
        actions: [{ kind: "set-flag", flag: "roomIntroduced", value: true }],
      },
      {
        id: "room-script.room.interaction-cutaway",
        sceneId: "scene.room",
        trigger: { kind: "interaction-consumed", interactionId: "interaction.clock.pull" },
        once: true,
        actions: [],
        cutaway: {
          sceneId: "scene.cutaway",
          entranceId: "entrance.cutaway",
          sequenceId: "sequence.cutaway",
          returnToPreviousLocation: true,
        },
      },
    ],
  },
} as unknown as RuntimeBundle;

describe("room scripts", () => {
  it("fires initial first-enter and returns after a blocking cutaway completes", () => {
    let world = baseWorld;
    let state = createRuntimeRoomScriptState(world);

    let room = advanceRuntimeRoomScripts(bundle, world, state);
    world = room.world;
    state = room.state;
    expect(world.story.flags.roomIntroduced).toBe(true);
    expect(state.firedScriptIds).toContain("room-script.room.first-enter");

    world = {
      ...world,
      story: {
        ...world.story,
        consumedInteractionIds: ["interaction.clock.pull"],
      },
    } as never;
    room = advanceRuntimeRoomScripts(bundle, world, state);
    world = room.world;
    state = room.state;
    expect(world.story.currentSceneId).toBe("scene.cutaway");
    expect(world.story.activeSequences.map((active) => active.sequenceId)).toContain("sequence.cutaway");
    expect(state.activeCutaway).toMatchObject({
      returnSceneId: "scene.room",
      returnEntranceId: "entrance.room",
    });

    const narrative = advanceRuntimeNarrativeSequences(bundle, world, 2);
    world = narrative.state as never;
    expect(world.story.activeSequences).toHaveLength(0);

    room = advanceRuntimeRoomScripts(bundle, world, state);
    expect(room.world.story.currentSceneId).toBe("scene.room");
    expect(room.world.story.currentEntranceId).toBe("entrance.room");
    expect(room.state.activeCutaway).toBeNull();
    expect(room.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "room-cutaway-returned", scriptId: "room-script.room.interaction-cutaway" }),
      ]),
    );
  });

  it("does not invent a return checkpoint for a non-returning cutaway", () => {
    const nonReturning = {
      ...bundle,
      roomScripts: {
        ...bundle.roomScripts!,
        scripts: [
          {
            id: "room-script.room.depart",
            sceneId: "scene.room",
            trigger: { kind: "condition", condition: { kind: "flag", flag: "depart", equals: true } },
            once: true,
            actions: [],
            cutaway: {
              sceneId: "scene.cutaway",
              entranceId: "entrance.cutaway",
              sequenceId: "sequence.cutaway",
              returnToPreviousLocation: false,
            },
          },
        ],
      },
    } as RuntimeBundle;
    const world = {
      ...baseWorld,
      story: { ...baseWorld.story, flags: { depart: true } },
    } as never;
    const result = advanceRuntimeRoomScripts(nonReturning, world, createRuntimeRoomScriptState(world));
    expect(result.world.story.currentSceneId).toBe("scene.cutaway");
    expect(result.state.activeCutaway).toBeNull();
  });

  it("fires a cyclic ambient script exactly once per authored room-time interval", () => {
    const ambientBundle = {
      ...bundle,
      roomScripts: {
        manifestVersion: 1,
        projectId: "project.cutaway",
        scripts: [
          {
            id: "room-script.room.waiter-cycle",
            sceneId: "scene.room",
            trigger: { kind: "room-tick-cycle", startTick: 2, intervalTicks: 5 },
            once: false,
            actions: [{ kind: "set-flag", flag: "waiterMoved", value: true }],
          },
        ],
      },
    } as RuntimeBundle;
    let world = baseWorld;
    let state = createRuntimeRoomScriptState(world);

    let result = advanceRuntimeRoomScripts(ambientBundle, world, state);
    state = result.state;
    expect(result.events).toHaveLength(0);

    world = { ...world, story: { ...world.story, tick: 2 } } as never;
    result = advanceRuntimeRoomScripts(ambientBundle, world, state);
    state = result.state;
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "room-script-cycle-fired",
          scriptId: "room-script.room.waiter-cycle",
          cycleIndex: 0,
        }),
      ]),
    );
    expect(state.lastFiredCycleByScriptId["room-script.room.waiter-cycle"]).toBe(0);

    result = advanceRuntimeRoomScripts(ambientBundle, result.world, state);
    state = result.state;
    expect(result.events).toHaveLength(0);

    world = { ...result.world, story: { ...result.world.story, tick: 6 } } as never;
    result = advanceRuntimeRoomScripts(ambientBundle, world, state);
    state = result.state;
    expect(result.events).toHaveLength(0);

    world = { ...result.world, story: { ...result.world.story, tick: 7 } } as never;
    result = advanceRuntimeRoomScripts(ambientBundle, world, state);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "room-script-cycle-fired", cycleIndex: 1 }),
      ]),
    );
  });
});
