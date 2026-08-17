import { readFileSync } from "node:fs";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { resolveActiveGameLifecycleOutcome } from "../src/lifecycle-outcome.js";
import { createPackagedRuntimeController } from "../src/packaged-controller.js";

const bundleUrl = new URL("../public/demos/the-red-ledger/runtime.bundle.json", import.meta.url);
const lifecycleUrl = new URL("../public/demos/the-red-ledger/lifecycle.json", import.meta.url);

const loadBundle = () =>
  parseRuntimeBundle({
    ...JSON.parse(readFileSync(bundleUrl, "utf8")),
    lifecycle: JSON.parse(readFileSync(lifecycleUrl, "utf8")),
  });

const click = (controller, point) => {
  controller.setPointer(point);
  controller.activate(point);
};

const settle = (controller, fromTick, limit = 1800) => {
  let tick = fromTick;
  for (let step = 0; step < limit; step += 1) {
    const world = controller.worldState();
    if (
      Object.keys(world.movements).length === 0 &&
      Object.keys(world.pendingObjectCommands).length === 0
    ) {
      return tick;
    }
    tick += 1;
    controller.createFrame(tick);
  }
  throw new Error(`Red Ledger runtime did not settle within ${limit} ticks.`);
};

const activateAndSettle = (controller, tick, point) => {
  click(controller, point);
  return settle(controller, tick);
};

describe("The Red Ledger playable runtime slice", () => {
  it("plays the complete evidence chain into its governed ending without a dead end", () => {
    const bundle = loadBundle();
    const controller = createPackagedRuntimeController(bundle, {
      requestedActorInstanceId: "actor-instance.red-ledger.archivist",
    });
    let tick = 0;

    expect(resolveActiveGameLifecycleOutcome(bundle, controller.worldState().story)).toBeNull();

    tick = activateAndSettle(controller, tick, { x: 138, y: 123 });
    expect(controller.worldState().story.flags["red-ledger.account-inspected"]).toBe(true);

    tick = activateAndSettle(controller, tick, { x: 88, y: 137 });
    expect(controller.worldState().story.inventory).toContain("item.red-ledger.harbour-record");

    tick = activateAndSettle(controller, tick, { x: 294, y: 100 });
    expect(controller.worldState().story.currentSceneId).toBe("scene.red-ledger.chapel");
    expect(controller.worldState().actorInstances["actor-instance.red-ledger.archivist"]?.sceneId).toBe(
      "scene.red-ledger.chapel",
    );
    expect(
      controller
        .createFrame(tick)
        .nodes.some((node) => node.id === "render.actor-instance.actor-instance.red-ledger.archivist"),
    ).toBe(true);

    tick = activateAndSettle(controller, tick, { x: 250, y: 160 });
    expect(controller.worldState().actorInstances["actor-instance.red-ledger.archivist"]?.position).toEqual({
      x: 250,
      y: 160,
    });

    tick = activateAndSettle(controller, tick, { x: 172, y: 115 });
    expect(controller.worldState().story.inventory).toContain("item.red-ledger.chapel-copy");
    expect(controller.worldState().story.flags["red-ledger.chapel-proof"]).toBe(true);

    tick = activateAndSettle(controller, tick, { x: 15, y: 100 });
    expect(controller.worldState().story.currentSceneId).toBe("scene.red-ledger.archive");

    tick = activateAndSettle(controller, tick, { x: 208, y: 110 });
    expect(controller.worldState().story.activeDialogue?.nodeId).toBe(
      "dialogue-node.red-ledger.clerk.root",
    );

    click(controller, { x: 50, y: 147 });
    expect(controller.worldState().story.activeDialogue?.nodeId).toBe(
      "dialogue-node.red-ledger.clerk.confrontation",
    );
    expect(controller.worldState().story.flags["red-ledger.alley-unlocked"]).toBe(true);
    expect(controller.worldState().story.objectStates["object.red-ledger.archive.alley-door"]).toBe(
      "object-state.red-ledger.alley-door.open",
    );

    click(controller, { x: 50, y: 110 });
    expect(controller.worldState().story.activeDialogue).toBeNull();

    tick = activateAndSettle(controller, tick, { x: 17, y: 100 });
    expect(controller.worldState().story.currentSceneId).toBe("scene.red-ledger.alley");

    tick = activateAndSettle(controller, tick, { x: 229, y: 120 });
    const completed = controller.worldState();
    expect(completed.story.flags["red-ledger.slice-complete"]).toBe(true);
    expect(completed.story.score).toBe(100);
    expect(completed.story.inventory).toEqual([
      "item.red-ledger.harbour-record",
      "item.red-ledger.chapel-copy",
    ]);
    expect(resolveActiveGameLifecycleOutcome(bundle, completed.story)).toMatchObject({
      id: "outcome.red-ledger.case-proved",
      kind: "success",
      title: "CASE PROVED",
    });
    expect(controller.statusText()).toBe("CASE PROVED");

    controller.setPointer({ x: 17, y: 100 });
    controller.activate({ x: 17, y: 100 });
    expect(controller.worldState()).toEqual(completed);

    const save = controller.createSaveGame();
    const restored = createPackagedRuntimeController(bundle, {
      requestedActorInstanceId: "actor-instance.red-ledger.archivist",
    });
    expect(restored.restoreSaveGame(save)).toBe(completed.story.tick);
    expect(restored.worldState()).toEqual(completed);
    expect(restored.worldState().actorInstances["actor-instance.red-ledger.archivist"]?.sceneId).toBe(
      "scene.red-ledger.alley",
    );
    expect(resolveActiveGameLifecycleOutcome(bundle, restored.worldState().story)?.id).toBe(
      "outcome.red-ledger.case-proved",
    );
    restored.createFrame(completed.story.tick);
    expect(restored.statusText()).toBe("CASE PROVED");
  });
});
