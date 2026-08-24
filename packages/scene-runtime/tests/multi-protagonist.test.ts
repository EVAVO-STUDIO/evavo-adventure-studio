import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  applyCrossProtagonistMutation,
  createMultiProtagonistState,
  giveProtagonistItem,
  moveProtagonist,
  switchActiveProtagonist,
  transferProtagonistItem,
} from "../src/multi-protagonist.js";

const actor = (value: string) => value as Id<"actor">;
const scene = (value: string) => value as Id<"scene">;
const entrance = (value: string) => value as Id<"entrance">;
const item = (value: string) => value as Id<"item">;

const bernard = actor("actor.cross-state.bernard");
const laverne = actor("actor.cross-state.laverne");
const hoagie = actor("actor.cross-state.hoagie");

const initial = () =>
  createMultiProtagonistState(
    [
      {
        protagonistId: bernard,
        startSceneId: scene("scene.present.lab"),
        startEntranceId: entrance("entrance.present.lab"),
        startingInventory: [item("item.plan")],
      },
      {
        protagonistId: laverne,
        startSceneId: scene("scene.future.cell"),
        startEntranceId: entrance("entrance.future.cell"),
      },
      {
        protagonistId: hoagie,
        startSceneId: scene("scene.past.inn"),
        startEntranceId: entrance("entrance.past.inn"),
      },
    ],
    bernard,
  );

describe("multi-protagonist world state", () => {
  it("keeps location and inventory independent while switching control", () => {
    let state = initial();
    state = giveProtagonistItem(state, hoagie, item("item.hammer"));
    state = moveProtagonist(state, laverne, {
      sceneId: scene("scene.future.museum"),
      entranceId: entrance("entrance.future.museum"),
    });
    state = switchActiveProtagonist(state, laverne);

    expect(state.activeProtagonistId).toBe(laverne);
    expect(state.protagonists[bernard]?.inventory).toEqual(["item.plan"]);
    expect(state.protagonists[hoagie]?.inventory).toEqual(["item.hammer"]);
    expect(state.protagonists[laverne]?.location).toEqual({
      sceneId: "scene.future.museum",
      entranceId: "entrance.future.museum",
    });
  });

  it("transfers items without duplicating them", () => {
    let state = initial();
    state = giveProtagonistItem(state, bernard, item("item.battery"));
    state = transferProtagonistItem(state, bernard, hoagie, item("item.battery"));

    expect(state.protagonists[bernard]?.inventory).not.toContain("item.battery");
    expect(state.protagonists[hoagie]?.inventory).toContain("item.battery");
    expect(() =>
      transferProtagonistItem(state, bernard, laverne, item("item.battery")),
    ).toThrow(/does not hold/u);
  });

  it("applies cross-era consequences to shared world and another protagonist", () => {
    const state = applyCrossProtagonistMutation(initial(), laverne, {
      setSharedFlags: { constitutionChanged: true },
      addSharedFactIds: ["fact.cross-state.constitution-changed"],
      setTargetFlags: { cellDoorUnlocked: true },
      moveTargetTo: {
        sceneId: scene("scene.future.hall"),
        entranceId: entrance("entrance.future.hall"),
      },
    });

    expect(state.sharedFlags.constitutionChanged).toBe(true);
    expect(state.sharedFacts).toEqual(["fact.cross-state.constitution-changed"]);
    expect(state.protagonists[laverne]?.flags.cellDoorUnlocked).toBe(true);
    expect(state.protagonists[laverne]?.location.sceneId).toBe("scene.future.hall");
    expect(state.protagonists[bernard]?.location.sceneId).toBe("scene.present.lab");
    expect(state.protagonists[hoagie]?.location.sceneId).toBe("scene.past.inn");
  });
});
