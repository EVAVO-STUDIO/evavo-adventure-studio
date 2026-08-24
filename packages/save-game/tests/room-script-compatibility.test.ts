import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGame } from "../src/schema.js";
import { describe, expect, it } from "vitest";
import { validateSavedRoomScripts } from "../src/room-script-compatibility.js";

const bundle = {
  scenes: [
    { id: "scene.room", entrances: [{ id: "entrance.room" }] },
    { id: "scene.cutaway", entrances: [{ id: "entrance.cutaway" }] },
  ],
  sequences: [{ id: "sequence.gag" }],
  roomScripts: {
    manifestVersion: 1,
    projectId: "project.room-script-save",
    scripts: [
      {
        id: "room-script.room.gag",
        sceneId: "scene.room",
        trigger: { kind: "scene-first-enter" },
        once: true,
        actions: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const save = {
  roomScripts: {
    sceneId: "scene.cutaway",
    enteredAtTick: 10,
    visitedSceneIds: ["scene.room", "scene.cutaway"],
    firedScriptIds: ["room-script.room.gag"],
    previousConsumedInteractionIds: [],
    previousConsumedDialogueChoiceIds: [],
    activeCutaway: {
      scriptId: "room-script.room.gag",
      sequenceId: "sequence.gag",
      returnSceneId: "scene.room",
      returnEntranceId: "entrance.room",
    },
  },
} as unknown as SaveGame;

describe("room-script save compatibility", () => {
  it("accepts a valid active cutaway return checkpoint", () => {
    expect(validateSavedRoomScripts(bundle, save)).toEqual([]);
  });

  it("rejects stale room-script, sequence and return-location references", () => {
    const stale = {
      ...save,
      roomScripts: {
        ...save.roomScripts!,
        firedScriptIds: ["room-script.missing"],
        activeCutaway: {
          scriptId: "room-script.missing",
          sequenceId: "sequence.missing",
          returnSceneId: "scene.room",
          returnEntranceId: "entrance.missing",
        },
      },
    } as SaveGame;
    expect(validateSavedRoomScripts(bundle, stale)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "room-script-id-missing" }),
        expect.objectContaining({ code: "room-script-sequence-missing" }),
        expect.objectContaining({ code: "room-script-return-location-invalid" }),
      ]),
    );
  });
});
