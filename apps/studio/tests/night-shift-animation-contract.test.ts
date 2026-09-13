import { describe, expect, it } from "vitest";
import {
  nightShiftOfficerActor,
  nightShiftOfficerAnimationRequirements,
} from "../src/night-shift-animation-contract.js";
import {
  nightShiftProductionPoseRequirements,
  nightShiftRuntimeStaging,
} from "../src/night-shift-runtime-staging.js";

const animation = (state: string, facing: string) =>
  nightShiftOfficerActor.animations.find(
    (candidate) => candidate.state === state && candidate.facing === facing,
  );

describe("Night Shift production animation contract", () => {
  it("uses an eight-frame native walk cycle rather than the proof placeholder", () => {
    const walk = animation("walk", "east");
    expect(walk?.frameIds).toHaveLength(8);
    expect(nightShiftOfficerAnimationRequirements.walkFrameCount).toBe(8);
    expect(
      walk?.frameIds.every((frameId) =>
        nightShiftOfficerActor.frames.some((frame) => frame.id === frameId && frame.durationTicks === 6),
      ),
    ).toBe(true);
  });

  it("keeps authored foot, shadow and hand anchors on every production officer frame", () => {
    expect(nightShiftOfficerActor.frames.every((frame) => frame.footPoint.y === 49)).toBe(true);
    expect(nightShiftOfficerActor.frames.every((frame) => frame.shadowAnchor?.y === 48)).toBe(true);
    expect(
      nightShiftOfficerActor.frames.every(
        (frame) => frame.attachmentPoints?.handLeft && frame.attachmentPoints?.handRight,
      ),
    ).toBe(true);
  });

  it("provides every interaction pose required by runtime choreography", () => {
    for (const requirement of nightShiftProductionPoseRequirements) {
      expect(animation(requirement.state, requirement.facing), requirement.interactionId).toBeDefined();
      const choreography = nightShiftRuntimeStaging.scenes
        .flatMap((scene) => scene.interactionChoreographies)
        .find((candidate) => candidate.interactionId === requirement.interactionId);
      expect(choreography, requirement.interactionId).toBeDefined();
      expect(choreography?.beats[0]).toMatchObject({
        kind: "actor-animation",
        animationState: requirement.state,
        facing: requirement.facing,
      });
    }
  });

  it("marks only deliberate foot-contact moments in the eight-frame cycle", () => {
    const contactFrames = nightShiftOfficerActor.frames
      .filter((frame) => (frame.events?.length ?? 0) > 0)
      .map((frame) => frame.id);
    expect(contactFrames).toEqual(nightShiftOfficerAnimationRequirements.footContactFrameIds);
  });
});
