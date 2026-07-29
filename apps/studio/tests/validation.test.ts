import { describe, expect, it } from "vitest";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { studioProject, studioSceneInstances } from "../src/fixture.js";
import { validateStudioManifest } from "../src/validation.js";

describe("studio validation", () => {
  it("accepts the representative editor fixture", () => {
    const summary = validateStudioManifest(studioProject, studioSceneInstances);

    expect(summary.valid).toBe(true);
    expect(summary.issueCount).toBe(0);
    expect(summary.groups).toEqual([]);
  });

  it("groups scene and object-definition issues deterministically", () => {
    const broken = parseSceneInstanceManifest({
      ...studioSceneInstances,
      objectDefinitions: [
        {
          ...studioSceneInstances.objectDefinitions[0],
          initialStateId: "object-state.missing",
        },
        ...studioSceneInstances.objectDefinitions.slice(1),
      ],
      scenes: [
        {
          ...studioSceneInstances.scenes[0],
          actorInstances: [
            {
              ...studioSceneInstances.scenes[0]!.actorInstances[0],
              position: { x: 2, y: 2 },
              facing: "north",
            },
            ...studioSceneInstances.scenes[0]!.actorInstances.slice(1),
          ],
        },
        ...studioSceneInstances.scenes.slice(1),
      ],
    });

    const summary = validateStudioManifest(studioProject, broken);

    expect(summary.valid).toBe(false);
    expect(summary.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-object-state",
        "invalid-actor-instance-position",
        "missing-instance-animation",
      ]),
    );
    expect(summary.groups.map((group) => `${group.kind}:${group.label}`)).toEqual(
      expect.arrayContaining([
        "object-definition:Desk lamp",
        "scene:Rain Office",
      ]),
    );
  });
});
