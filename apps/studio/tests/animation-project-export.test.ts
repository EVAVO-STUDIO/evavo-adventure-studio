import { describe, expect, it } from "vitest";
import { animationWorkspaceActors, projectFromAnimationWorkspace } from "../src/animation-project-export.js";
import {
  animationWorkspaceReducer,
  createAnimationWorkspace,
  selectedAnimationFrame,
} from "../src/animation-workspace.js";
import { studioProject } from "../src/fixture.js";

describe("animation workspace project export", () => {
  it("merges every focused actor document into canonical project order", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    const frame = selectedAnimationFrame(state)!;
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: {
        kind: "replace-frame",
        frameId: frame.id,
        frame: { ...frame, durationTicks: 21 },
      },
    });

    const merged = projectFromAnimationWorkspace(studioProject, state);
    expect(merged.actors.map((actor) => actor.id)).toEqual(studioProject.actors.map((actor) => actor.id));
    expect(merged.actors[0]?.frames[0]?.durationTicks).toBe(21);
    expect(merged.actors[1]).toEqual(studioProject.actors[1]);
    expect(studioProject.actors[0]?.frames[0]?.durationTicks).toBe(12);
  });

  it("returns actor documents in deterministic project order", () => {
    const state = createAnimationWorkspace(studioProject.actors);
    expect(animationWorkspaceActors(state).map((actor) => actor.id)).toEqual([
      "actor.detective",
      "actor.clerk",
    ]);
  });
});
