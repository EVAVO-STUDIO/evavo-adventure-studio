import { createInitialState, runInteraction } from "@evavo/adventure-core";
import { resolveHotspotCommand } from "@evavo/adventure-interaction";
import { validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { describe, expect, it } from "vitest";
import {
  nightShiftCompleteInstances,
  nightShiftCompleteProject,
  nightShiftCompleteStaging,
} from "../src/night-shift-complete-proof.js";

const definition = (id: string) => {
  const result = nightShiftCompleteInstances.objectDefinitions.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing object definition '${id}'.`);
  return result;
};

const interaction = (definitionId: string, stateId: string, interactionId: string) => {
  const state = definition(definitionId).states.find((candidate) => candidate.id === stateId);
  const result = state?.interactions.find((candidate) => candidate.id === interactionId);
  if (!result) throw new Error(`Missing interaction '${interactionId}'.`);
  return result;
};

const hotspotFor = (definitionId: string, stateId: string, hotspotId: string) => {
  const state = definition(definitionId).states.find((candidate) => candidate.id === stateId)!;
  return {
    id: hotspotId as never,
    name: definition(definitionId).name,
    shape: state.interactionShape!,
    cursor: state.cursor,
    interactions: state.interactions,
    fallbackText: state.fallbackText,
  };
};

describe("Night Shift complete three-room proof", () => {
  it("keeps project, scene-instance and staging semantics valid across all three rooms", () => {
    expect(nightShiftCompleteProject.scenes.map((scene) => scene.id)).toEqual([
      "scene.night-shift.station",
      "scene.night-shift.roadside",
      "scene.night-shift.diner",
    ]);
    expect(
      validateSceneInstanceManifest(
        {
          projectId: nightShiftCompleteProject.id,
          scenes: nightShiftCompleteProject.scenes,
          actors: nightShiftCompleteProject.actors,
          assets: nightShiftCompleteProject.assets,
          inventoryItems: nightShiftCompleteProject.inventoryItems,
          dialogues: nightShiftCompleteProject.dialogues,
          sequences: nightShiftCompleteProject.sequences,
        },
        nightShiftCompleteInstances,
      ),
    ).toEqual([]);
    expect(
      validateSceneStagingManifest(
        {
          projectId: nightShiftCompleteProject.id,
          scenes: nightShiftCompleteProject.scenes,
          actors: nightShiftCompleteProject.actors,
          assets: nightShiftCompleteProject.assets,
          sequences: nightShiftCompleteProject.sequences,
          sceneInstances: nightShiftCompleteInstances,
        },
        nightShiftCompleteStaging,
      ),
    ).toEqual([]);
  });

  it("transitions the safe roadside resolution into the diner proof", () => {
    let state = createInitialState(nightShiftCompleteProject);
    for (const [definitionId, stateId, interactionId] of [
      ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.observe"],
      ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.talk-after-observe"],
      ["object-definition.night-shift.sedan", "object-state.night-shift.sedan.stopped", "interaction.night-shift.sedan.resolve-safe"],
    ] as const) {
      const result = runInteraction(state, interaction(definitionId, stateId, interactionId));
      if (result.kind !== "accepted") throw new Error(`${interactionId} was rejected.`);
      state = result.transition.state;
      if (interactionId === "interaction.night-shift.sedan.resolve-safe") {
        expect(result.transition.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: "scene-change-requested",
              sceneId: "scene.night-shift.diner",
              entranceId: "entrance.night-shift.diner.front",
            }),
          ]),
        );
      }
    }
    expect(state.flags).toMatchObject({
      vehicleObserved: true,
      driverSpoken: true,
      roadsideResolved: true,
    });
    expect(state.score).toBe(10);
  });

  it("requires the witness conversation before the receipt becomes meaningful", () => {
    let state = createInitialState(nightShiftCompleteProject);
    const receiptHotspot = hotspotFor(
      "object-definition.night-shift.receipt",
      "object-state.night-shift.receipt.visible",
      "hotspot.night-shift.receipt",
    );
    const receiptCommand = {
      actorId: "actor.night-shift.officer" as never,
      verb: "look",
      targetHotspotId: receiptHotspot.id,
      itemId: null,
    };

    expect(resolveHotspotCommand(state, receiptHotspot, receiptCommand)).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.receipt.inspect-too-soon" },
    });

    const witness = runInteraction(
      state,
      interaction(
        "object-definition.night-shift.diner-server",
        "object-state.night-shift.diner-server.waiting",
        "interaction.night-shift.diner-server.ask-van",
      ),
    );
    if (witness.kind !== "accepted") throw new Error("Witness interaction was rejected.");
    state = witness.transition.state;
    expect(state.flags.dinerWitnessSpoken).toBe(true);

    expect(resolveHotspotCommand(state, receiptHotspot, receiptCommand)).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.receipt.inspect-after-talk" },
    });
  });

  it("blocks diner completion until witness and receipt corroboration are both complete", () => {
    let state = createInitialState(nightShiftCompleteProject);
    const exit = hotspotFor(
      "object-definition.night-shift.diner-exit",
      "object-state.night-shift.diner-exit.closed",
      "hotspot.night-shift.diner-exit",
    );
    const command = {
      actorId: "actor.night-shift.officer" as never,
      verb: "use",
      targetHotspotId: exit.id,
      itemId: null,
    };
    expect(resolveHotspotCommand(state, exit, command)).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.diner-exit.not-done" },
    });

    for (const [definitionId, stateId, interactionId] of [
      ["object-definition.night-shift.diner-server", "object-state.night-shift.diner-server.waiting", "interaction.night-shift.diner-server.ask-van"],
      ["object-definition.night-shift.receipt", "object-state.night-shift.receipt.visible", "interaction.night-shift.receipt.inspect-after-talk"],
    ] as const) {
      const result = runInteraction(state, interaction(definitionId, stateId, interactionId));
      if (result.kind !== "accepted") throw new Error(`${interactionId} was rejected.`);
      state = result.transition.state;
    }

    const complete = resolveHotspotCommand(state, exit, command);
    expect(complete).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.diner-exit.complete" },
    });
    if (complete.kind !== "matched") throw new Error("Diner exit did not resolve.");
    const result = runInteraction(state, complete.interaction);
    if (result.kind !== "accepted") throw new Error("Diner completion was rejected.");
    expect(result.transition.state.flags.nightShiftProofComplete).toBe(true);
    expect(result.transition.state.score).toBe(8);
  });

  it("stages the diner with approach slots, entry choreography, counter occlusion and warm Bayer light", () => {
    const staging = nightShiftCompleteStaging.scenes.find(
      (scene) => scene.sceneId === "scene.night-shift.diner",
    );
    expect(staging).toBeDefined();
    expect(staging?.approachSlotsByObject["object.night-shift.diner-server"]).toHaveLength(1);
    expect(staging?.approachSlotsByObject["object.night-shift.receipt"]).toHaveLength(1);
    expect(staging?.interactionComfortRegionsByObject["object.night-shift.receipt"]).toHaveLength(1);
    expect(staging?.entryChoreographies[0]).toMatchObject({
      entranceId: "entrance.night-shift.diner.front",
      unlockControlAt: "path-end",
    });
    expect(staging?.occlusionPlanes[0]?.id).toBe("occlusion-plane.night-shift.diner.counter");
    expect(staging?.paletteLightZones[0]).toMatchObject({
      paletteMapId: "palette-map.night-shift.diner-warm",
      blendMode: "ordered-dither",
    });
  });
});
