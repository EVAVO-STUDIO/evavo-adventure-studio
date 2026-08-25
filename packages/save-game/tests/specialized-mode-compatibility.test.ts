import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { validateSavedSpecializedModes } from "../src/specialized-mode-compatibility.js";
import type { SaveGame } from "../src/schema.js";

const bundle = {
  scenes: [
    {
      id: "scene.room",
      entrances: [{ id: "entrance.room" }],
    },
    {
      id: "scene.mode",
      entrances: [{ id: "entrance.mode" }],
    },
  ],
  specializedModes: {
    manifestVersion: 1,
    projectId: "project.modes",
    modes: [
      {
        id: "specialized-mode.action",
        kind: "action",
        sceneId: "scene.mode",
        entranceId: "entrance.mode",
        startStateId: "ready",
        return: { kind: "previous-location" },
        states: [{ id: "ready" }],
      },
    ],
  },
} as unknown as RuntimeBundle;

const save = {
  specializedModes: {
    active: {
      modeId: "specialized-mode.action",
      kind: "action",
      stateId: "ready",
      enteredAtTick: 10,
      stateEnteredAtTick: 10,
      returnSceneId: "scene.room",
      returnEntranceId: "entrance.room",
    },
    firedModeIds: ["specialized-mode.action"],
    previousConsumedInteractionIds: [],
    previousConsumedDialogueChoiceIds: [],
  },
} as unknown as SaveGame;

describe("saved specialized modes", () => {
  it("accepts active mode state compatible with the current bundle", () => {
    expect(validateSavedSpecializedModes(bundle, save)).toEqual([]);
  });

  it("rejects stale mode/state and return-location references", () => {
    const stale = {
      ...save,
      specializedModes: {
        ...save.specializedModes!,
        active: {
          ...save.specializedModes!.active!,
          stateId: "deleted-state",
          returnEntranceId: "entrance.deleted",
        },
        firedModeIds: ["specialized-mode.deleted"],
      },
    } as SaveGame;
    expect(validateSavedSpecializedModes(bundle, stale)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "specialized-mode-state-missing" }),
        expect.objectContaining({ code: "specialized-mode-return-location-invalid" }),
        expect.objectContaining({ code: "specialized-mode-id-missing" }),
      ]),
    );
  });
});
