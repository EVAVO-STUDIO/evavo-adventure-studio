import { readFileSync } from "node:fs";
import { createReplayLog, executeReplay } from "@evavo/adventure-replay";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { createPackagedRuntimeController } from "../src/packaged-controller.js";
import { createPlayerPlaytestBridge } from "../src/playtest-automation.js";

const demoUrl = new URL("../public/demos/the-red-ledger/", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, demoUrl), "utf8"));
const loadBundle = () =>
  parseRuntimeBundle({
    ...readJson("runtime.bundle.json"),
    frontEnd: readJson("front-end.json"),
    lifecycle: readJson("lifecycle.json"),
  });
const plan = readJson("playtest-plan.json");

const expectSubset = (actual, expected) => {
  for (const [key, value] of Object.entries(expected ?? {})) {
    expect(actual[key], key).toEqual(value);
  }
};

const expectCheckpoint = (snapshot, checkpoint) => {
  const expected = checkpoint.expect;
  if (expected.sceneId !== undefined) expect(snapshot.sceneId).toBe(expected.sceneId);
  if (expected.score !== undefined) expect(snapshot.score).toBe(expected.score);
  if (expected.inventory !== undefined) expect(snapshot.inventory).toEqual(expected.inventory);
  if (expected.flags !== undefined) expectSubset(snapshot.flags, expected.flags);
  if (expected.objectStates !== undefined) {
    expectSubset(snapshot.objectStates, expected.objectStates);
  }
  if (Object.hasOwn(expected, "activeDialogueNodeId")) {
    expect(snapshot.activeDialogueNodeId).toBe(expected.activeDialogueNodeId);
  }
  if (expected.lifecycleOutcomeId !== undefined) {
    expect(snapshot.lifecycleOutcomeId).toBe(expected.lifecycleOutcomeId);
  }
  if (expected.statusText !== undefined) expect(snapshot.statusText).toBe(expected.statusText);
  if (expected.controlledActor !== undefined) {
    expect(snapshot.controlledActor?.sceneId).toBe(expected.controlledActor.sceneId);
    if (expected.controlledActor.x !== undefined || expected.controlledActor.y !== undefined) {
      expect(snapshot.controlledActor?.position).toEqual({
        x: expected.controlledActor.x,
        y: expected.controlledActor.y,
      });
    }
  }
};

const executePlan = () => {
  const bundle = loadBundle();
  const controller = createPackagedRuntimeController(bundle, {
    requestedActorInstanceId: plan.runtime.actorInstanceId,
  });
  const bridge = createPlayerPlaytestBridge(bundle, controller);
  const initialSave = controller.createSaveGame();
  const events = [];
  const captures = [plan.shell.capture];

  for (const step of plan.runtime.steps) {
    if (step.kind === "activate") {
      events.push({
        kind: "activate",
        tick: bridge.snapshot().tick,
        sequence: events.length,
        position: step.position,
      });
      bridge.activateAndSettle(step.position, plan.runtime.maxSettleTicks);
      continue;
    }
    const snapshot = bridge.snapshot();
    expectCheckpoint(snapshot, step);
    if (step.capture) captures.push(step.capture);
  }

  return {
    bundle,
    controller,
    initialSave,
    events,
    captures,
    finalSave: controller.createSaveGame(),
  };
};

describe("The Red Ledger browser playtest plan", () => {
  it("executes every authored checkpoint and capture boundary", () => {
    expect(plan).toMatchObject({
      planVersion: 1,
      projectId: "project.red-ledger.playable-slice",
      route: "/?demo=red-ledger&playtest=1",
      shell: {
        title: "The Red Ledger: Impossible Date",
        primaryAction: "OPEN THE CASE",
      },
    });

    const run = executePlan();
    expect(run.events).toHaveLength(11);
    expect(run.captures).toEqual([
      "red-ledger-00-title",
      "red-ledger-01-archive-start",
      "red-ledger-02-archive-evidence",
      "red-ledger-03-river-chapel",
      "red-ledger-04-chapel-proof",
      "red-ledger-05-clerk-interview",
      "red-ledger-06-contradiction",
      "red-ledger-07-black-alley",
      "red-ledger-08-case-proved",
    ]);
    expect(run.finalSave.world.story.flags["red-ledger.slice-complete"]).toBe(true);
    expect(run.controller.statusText()).toBe("CASE PROVED");
  });

  it("closes the same plan as a deterministic renderer-free replay", () => {
    const run = executePlan();
    const replay = createReplayLog(run.bundle, run.initialSave, {
      events: run.events,
      finalTick: run.finalSave.world.story.tick,
      expectedFinalSaveFingerprint: run.finalSave.saveFingerprint,
    });
    const replayController = createPackagedRuntimeController(run.bundle, {
      requestedActorInstanceId: plan.runtime.actorInstanceId,
    });
    const result = executeReplay(run.bundle, replay, replayController);

    expect(result.eventCount).toBe(11);
    expect(result.finalTick).toBe(run.finalSave.world.story.tick);
    expect(result.finalSaveFingerprint).toBe(run.finalSave.saveFingerprint);
    expect(result.finalSave).toEqual(run.finalSave);
    expect(replayController.statusText()).toBe("CASE PROVED");
  });
});
