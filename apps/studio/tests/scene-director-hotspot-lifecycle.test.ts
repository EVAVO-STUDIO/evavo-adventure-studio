import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import { applySceneDirectorDocumentEdit } from "../src/scene-director-documents.js";

const documents = () => ({
  project: nightShiftDirectorProject,
  sceneInstances: nightShiftDirectorInstances,
  staging: nightShiftDirectorStaging,
});

describe("Scene Director state hotspot lifecycle", () => {
  it("can remove and restore exact interaction geometry for an object state", () => {
    const removed = applySceneDirectorDocumentEdit(documents(), {
      kind: "set-object-state-interaction-shape",
      definitionId: "object-definition.night-shift.radio" as never,
      stateId: "object-state.night-shift.radio.rack" as never,
      shape: null,
    });
    const removedState = removed.sceneInstances.objectDefinitions
      .find((definition) => definition.id === "object-definition.night-shift.radio")
      ?.states.find((state) => state.id === "object-state.night-shift.radio.rack");
    expect(removedState?.interactionShape).toBeUndefined();

    const restored = applySceneDirectorDocumentEdit(removed, {
      kind: "set-object-state-interaction-shape",
      definitionId: "object-definition.night-shift.radio" as never,
      stateId: "object-state.night-shift.radio.rack" as never,
      shape: {
        points: [
          { x: 1, y: 1 },
          { x: 17, y: 1 },
          { x: 17, y: 13 },
          { x: 1, y: 13 },
        ],
      },
    });
    const restoredState = restored.sceneInstances.objectDefinitions
      .find((definition) => definition.id === "object-definition.night-shift.radio")
      ?.states.find((state) => state.id === "object-state.night-shift.radio.rack");
    expect(restoredState?.interactionShape?.points).toHaveLength(4);
  });
});
