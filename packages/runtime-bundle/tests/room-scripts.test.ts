import { describe, expect, it } from "vitest";
import {
  runtimeRoomScriptManifestSchema,
  validateRuntimeRoomScripts,
} from "../src/room-scripts.js";

const context = {
  sceneIds: new Set(["scene.room", "scene.cutaway"]),
  entrancesByScene: new Map([
    ["scene.room", new Set(["entrance.room"])],
    ["scene.cutaway", new Set(["entrance.cutaway"])],
  ]),
  sequenceIds: new Set(["sequence.gag"]),
  interactionIds: new Set(["interaction.clock.pull"]),
  dialogueChoiceIds: new Set(["dialogue-choice.answer"]),
};

describe("runtime room-script manifest", () => {
  it("accepts valid room triggers and cutaway references", () => {
    const manifest = runtimeRoomScriptManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.room-scripts",
      scripts: [
        {
          id: "room-script.room.first",
          sceneId: "scene.room",
          trigger: { kind: "scene-first-enter" },
          once: true,
          actions: [],
        },
        {
          id: "room-script.room.gag",
          sceneId: "scene.room",
          trigger: { kind: "interaction-consumed", interactionId: "interaction.clock.pull" },
          once: true,
          actions: [],
          cutaway: {
            sceneId: "scene.cutaway",
            entranceId: "entrance.cutaway",
            sequenceId: "sequence.gag",
            returnToPreviousLocation: true,
          },
        },
      ],
    });
    expect(validateRuntimeRoomScripts(manifest, context)).toEqual([]);
  });

  it("rejects unknown trigger and cutaway references", () => {
    const manifest = runtimeRoomScriptManifestSchema.parse({
      manifestVersion: 1,
      projectId: "project.room-scripts",
      scripts: [
        {
          id: "room-script.bad",
          sceneId: "scene.missing",
          trigger: { kind: "dialogue-choice-consumed", choiceId: "dialogue-choice.missing" },
          once: true,
          actions: [],
          cutaway: {
            sceneId: "scene.cutaway",
            entranceId: "entrance.missing",
            sequenceId: "sequence.missing",
            returnToPreviousLocation: true,
          },
        },
      ],
    });
    expect(validateRuntimeRoomScripts(manifest, context)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-scene" }),
        expect.objectContaining({ code: "unknown-dialogue-choice" }),
        expect.objectContaining({ code: "unknown-entrance" }),
        expect.objectContaining({ code: "unknown-sequence" }),
      ]),
    );
  });
});
