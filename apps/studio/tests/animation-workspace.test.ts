import { describe, expect, it } from "vitest";
import {
  activeAnimationActor,
  animationWorkspaceIsDirty,
  animationWorkspaceReducer,
  appendSelectedFrameToClipCommand,
  createAnimationWorkspace,
  frameAtPlayhead,
  insertAnimationClipCommand,
  insertAnimationFrameCommand,
  removeSelectedClipFrameCommand,
  selectedAnimationClip,
  selectedAnimationFrame,
} from "../src/animation-workspace.js";
import { studioProject } from "../src/fixture.js";

describe("animation workspace", () => {
  it("switches actors without losing independent command histories", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    const detective = activeAnimationActor(state);
    const frame = detective.frames[0]!;

    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: {
        kind: "replace-frame",
        frameId: frame.id,
        frame: { ...frame, durationTicks: 20 },
      },
    });
    expect(animationWorkspaceIsDirty(state)).toBe(true);

    state = animationWorkspaceReducer(state, {
      type: "select-actor",
      actorId: studioProject.actors[1]!.id,
    });
    expect(activeAnimationActor(state).name).toBe("Night Clerk");

    state = animationWorkspaceReducer(state, {
      type: "select-actor",
      actorId: studioProject.actors[0]!.id,
    });
    expect(activeAnimationActor(state).frames[0]?.durationTicks).toBe(20);
  });

  it("advances the playhead using authored clip duration", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    expect(selectedAnimationClip(state)?.id).toBe(
      "animation.detective.idle-east",
    );

    state = animationWorkspaceReducer(state, { type: "toggle-playing" });
    state = animationWorkspaceReducer(state, {
      type: "advance-playhead",
      ticks: 13,
    });

    expect(state.playheadTick).toBe(1);
    expect(frameAtPlayhead(state)?.id).toBe("frame.detective.idle-east");
  });

  it("creates frames and clips through editor commands", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    const frameAddition = insertAnimationFrameCommand(state);
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: frameAddition.command,
      frameId: frameAddition.frameId,
    });

    expect(selectedAnimationFrame(state)?.id).toBe(frameAddition.frameId);
    expect(activeAnimationActor(state).frames).toHaveLength(3);

    const clipAddition = insertAnimationClipCommand(state);
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: clipAddition.command,
      animationId: clipAddition.animationId,
    });

    expect(selectedAnimationClip(state)?.id).toBe(clipAddition.animationId);
    expect(activeAnimationActor(state).animations).toHaveLength(5);
  });

  it("appends and removes selected frame occurrences with undo", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: appendSelectedFrameToClipCommand(state),
      notice: "Added cadence frame.",
    });
    const animation = selectedAnimationClip(state)!;
    expect(animation.frameIds).toHaveLength(2);

    state = animationWorkspaceReducer(state, {
      type: "select-clip-frame",
      animationId: animation.id,
      frameIndex: 1,
    });
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: removeSelectedClipFrameCommand(state),
      clipFrameIndex: null,
    });
    expect(selectedAnimationClip(state)?.frameIds).toHaveLength(1);

    state = animationWorkspaceReducer(state, { type: "undo" });
    expect(selectedAnimationClip(state)?.frameIds).toHaveLength(2);
  });

  it("marks all active actor edits saved independently", () => {
    let state = createAnimationWorkspace(studioProject.actors);
    const frame = selectedAnimationFrame(state)!;
    state = animationWorkspaceReducer(state, {
      type: "execute",
      command: {
        kind: "replace-frame",
        frameId: frame.id,
        frame: { ...frame, durationTicks: 15 },
      },
    });
    expect(animationWorkspaceIsDirty(state)).toBe(true);

    state = animationWorkspaceReducer(state, { type: "mark-saved" });
    expect(animationWorkspaceIsDirty(state)).toBe(false);
  });
});
