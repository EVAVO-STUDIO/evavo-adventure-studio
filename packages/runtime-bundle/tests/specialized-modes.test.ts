import { describe, expect, it } from "vitest";
import {
  runtimeSpecializedAdventureModeManifestSchema,
  validateRuntimeSpecializedAdventureModes,
} from "../src/specialized-modes.js";

const manifest = () =>
  runtimeSpecializedAdventureModeManifestSchema.parse({
    manifestVersion: 1,
    projectId: "project.modes",
    modes: [
      {
        id: "specialized-mode.vehicle",
        kind: "vehicle",
        once: true,
        trigger: {
          kind: "interaction-consumed",
          interactionId: "interaction.start-car",
        },
        sceneId: "scene.car",
        entranceId: "entrance.car",
        startStateId: "drive",
        return: { kind: "previous-location" },
        states: [
          {
            id: "drive",
            inputRegions: [
              {
                id: "accelerate",
                label: "Accelerate",
                shape: {
                  points: [
                    { x: 0, y: 0 },
                    { x: 50, y: 0 },
                    { x: 50, y: 50 },
                  ],
                },
                nextStateId: "finish",
              },
            ],
          },
          {
            id: "finish",
            timeout: { afterTicks: 10, finishOutcomeId: "arrived" },
          },
        ],
      },
    ],
  });

const context = (oneShot = true) => ({
  entrancesByScene: new Map([["scene.car", new Set(["entrance.car"])]]),
  interactionIds: new Set(["interaction.start-car"]),
  oneShotInteractionIds: new Set(oneShot ? ["interaction.start-car"] : []),
  dialogueChoiceIds: new Set<string>(),
  oneShotDialogueChoiceIds: new Set<string>(),
});

describe("runtime specialized mode manifest", () => {
  it("accepts a valid state graph and one-shot gameplay trigger", () => {
    expect(validateRuntimeSpecializedAdventureModes(manifest(), context())).toEqual([]);
  });

  it("rejects repeatable consumed-interaction triggers", () => {
    expect(validateRuntimeSpecializedAdventureModes(manifest(), context(false))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "repeatable-interaction" }),
      ]),
    );
  });

  it("rejects transitions to missing mode states", () => {
    const broken = manifest();
    broken.modes[0]!.states[0]!.inputRegions![0]!.nextStateId = "missing";
    expect(validateRuntimeSpecializedAdventureModes(broken, context())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-next-state" }),
      ]),
    );
  });
});
