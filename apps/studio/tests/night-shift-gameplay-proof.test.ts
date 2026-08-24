import { createInitialState, runInteraction } from "@evavo/adventure-core";
import { resolveHotspotCommand } from "@evavo/adventure-interaction";
import { validateSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { validateSceneStagingManifest } from "@evavo/adventure-scene-instances/staging-validation";
import { describe, expect, it } from "vitest";
import {
  nightShiftGameplayInstances,
  nightShiftGameplayProject,
  nightShiftGameplayStaging,
} from "../src/night-shift-gameplay-proof.js";

const definition = (id: string) => {
  const result = nightShiftGameplayInstances.objectDefinitions.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing object definition '${id}'.`);
  return result;
};

const interaction = (definitionId: string, stateId: string, interactionId: string) => {
  const state = definition(definitionId).states.find((candidate) => candidate.id === stateId);
  const result = state?.interactions.find((candidate) => candidate.id === interactionId);
  if (!result) throw new Error(`Missing interaction '${interactionId}'.`);
  return result;
};

const stationDoorHotspot = () => {
  const state = definition("object-definition.night-shift.station-door").states[0]!;
  return {
    id: "hotspot.night-shift.station-door" as never,
    name: "Station exit",
    shape: state.interactionShape!,
    cursor: state.cursor,
    interactions: state.interactions,
    fallbackText: state.fallbackText,
  };
};

describe("Night Shift playable proof", () => {
  it("keeps project, composition and staging semantics valid", () => {
    expect(
      validateSceneInstanceManifest(
        {
          projectId: nightShiftGameplayProject.id,
          scenes: nightShiftGameplayProject.scenes,
          actors: nightShiftGameplayProject.actors,
          assets: nightShiftGameplayProject.assets,
          inventoryItems: nightShiftGameplayProject.inventoryItems,
          dialogues: nightShiftGameplayProject.dialogues,
          sequences: nightShiftGameplayProject.sequences,
        },
        nightShiftGameplayInstances,
      ),
    ).toEqual([]);

    expect(
      validateSceneStagingManifest(
        {
          projectId: nightShiftGameplayProject.id,
          scenes: nightShiftGameplayProject.scenes,
          actors: nightShiftGameplayProject.actors,
          assets: nightShiftGameplayProject.assets,
          sequences: nightShiftGameplayProject.sequences,
          sceneInstances: nightShiftGameplayInstances,
        },
        nightShiftGameplayStaging,
      ),
    ).toEqual([]);
  });

  it("requires briefing, radio and keys before the station exit can transition", () => {
    let state = createInitialState(nightShiftGameplayProject);
    const hotspot = stationDoorHotspot();
    const command = {
      actorId: "actor.night-shift.officer" as never,
      verb: "use",
      targetHotspotId: hotspot.id,
      itemId: null,
    };

    const early = resolveHotspotCommand(state, hotspot, command);
    expect(early).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.station-door.not-ready" },
    });

    for (const [definitionId, stateId, interactionId] of [
      [
        "object-definition.night-shift.briefing",
        "object-state.night-shift.briefing.unread",
        "interaction.night-shift.briefing.read",
      ],
      [
        "object-definition.night-shift.radio",
        "object-state.night-shift.radio.rack",
        "interaction.night-shift.radio.take",
      ],
      [
        "object-definition.night-shift.keys",
        "object-state.night-shift.keys.hook",
        "interaction.night-shift.keys.take",
      ],
    ] as const) {
      const result = runInteraction(state, interaction(definitionId, stateId, interactionId));
      if (result.kind !== "accepted") throw new Error(`${interactionId} was rejected.`);
      state = result.transition.state;
    }

    expect(state.flags).toMatchObject({ briefingRead: true, radioReady: true, keysReady: true });
    expect(state.score).toBe(12);
    const ready = resolveHotspotCommand(state, hotspot, command);
    expect(ready).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.station-door.ready" },
    });
  });

  it("keeps the roadside interaction order explicit and recoverable", () => {
    let state = createInitialState(nightShiftGameplayProject);
    const stopped = definition("object-definition.night-shift.sedan").states[0]!;
    const hotspot = {
      id: "hotspot.night-shift.sedan" as never,
      name: "Stopped sedan",
      shape: stopped.interactionShape!,
      cursor: stopped.cursor,
      interactions: stopped.interactions,
      fallbackText: stopped.fallbackText,
    };
    const command = (verb: string) => ({
      actorId: "actor.night-shift.officer" as never,
      verb,
      targetHotspotId: hotspot.id,
      itemId: null,
    });

    expect(resolveHotspotCommand(state, hotspot, command("talk"))).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.sedan.talk-too-soon" },
    });
    expect(resolveHotspotCommand(state, hotspot, command("use"))).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.sedan.unsafe-action" },
    });

    const observe = runInteraction(
      state,
      interaction(
        "object-definition.night-shift.sedan",
        "object-state.night-shift.sedan.stopped",
        "interaction.night-shift.sedan.observe",
      ),
    );
    if (observe.kind !== "accepted") throw new Error("Observe was rejected.");
    state = observe.transition.state;
    expect(state.flags.vehicleObserved).toBe(true);

    const talk = resolveHotspotCommand(state, hotspot, command("talk"));
    expect(talk).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.sedan.talk-after-observe" },
    });
    if (talk.kind !== "matched") throw new Error("Talk did not resolve.");
    const talked = runInteraction(state, talk.interaction);
    if (talked.kind !== "accepted") throw new Error("Talk was rejected.");
    state = talked.transition.state;
    expect(state.flags.driverSpoken).toBe(true);

    expect(resolveHotspotCommand(state, hotspot, command("use"))).toMatchObject({
      kind: "matched",
      interaction: { id: "interaction.night-shift.sedan.resolve-safe" },
    });
  });

  it("adds the briefing prop and choreography expected by the canonical showcase", () => {
    const station = nightShiftGameplayInstances.scenes.find(
      (scene) => scene.sceneId === "scene.night-shift.station",
    );
    expect(station?.objectInstances.some((object) => object.id === "object.night-shift.briefing")).toBe(true);
    const staging = nightShiftGameplayStaging.scenes.find(
      (scene) => scene.sceneId === "scene.night-shift.station",
    );
    expect(staging?.approachSlotsByObject["object.night-shift.briefing"]).toHaveLength(1);
    expect(staging?.interactionChoreographies.map((candidate) => candidate.interactionId)).toEqual(
      expect.arrayContaining([
        "interaction.night-shift.briefing.read",
        "interaction.night-shift.radio.take",
        "interaction.night-shift.keys.take",
        "interaction.night-shift.station-door.ready",
      ]),
    );
  });
});
