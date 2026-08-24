import { describe, expect, it } from "vitest";
import {
  nightShiftDirectorInstances,
  nightShiftDirectorProject,
  nightShiftDirectorStaging,
} from "../src/night-shift-director-fixture.js";
import { auditSceneDirectorClearance, distanceToPolygonBoundary } from "../src/scene-director-clearance.js";
import { applySceneDirectorDocumentEdit } from "../src/scene-director-documents.js";

const documents = () => ({
  project: nightShiftDirectorProject,
  sceneInstances: nightShiftDirectorInstances,
  staging: nightShiftDirectorStaging,
});

describe("Scene Director footprint clearance", () => {
  it("measures native distance to a walk polygon boundary", () => {
    expect(
      distanceToPolygonBoundary(
        { x: 5, y: 5 },
        {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 },
          ],
        },
      ),
    ).toBe(5);
  });

  it("keeps the authored Night Shift proof clear of obvious body-edge collisions", () => {
    const issues = auditSceneDirectorClearance(
      documents(),
      "scene.night-shift.station" as never,
    );
    expect(issues.filter((issue) => issue.kind === "approach")).toEqual([]);
  });

  it("warns when an approach remains inside navigation but violates the actor footprint envelope", () => {
    const edited = applySceneDirectorDocumentEdit(documents(), {
      kind: "move-approach-slot",
      sceneId: "scene.night-shift.station" as never,
      objectId: "object.night-shift.radio" as never,
      slotId: "approach-slot.night-shift.radio.front" as never,
      position: { x: 22, y: 130 },
    });
    const issues = auditSceneDirectorClearance(
      edited,
      "scene.night-shift.station" as never,
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "approach",
          targetId: expect.stringContaining("approach-slot.night-shift.radio.front"),
        }),
      ]),
    );
  });
});
