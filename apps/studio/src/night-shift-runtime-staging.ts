import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";
import { nightShiftCompleteStaging } from "./night-shift-complete-proof.js";

const productionPoseForInteraction: Readonly<
  Record<string, { readonly state: "reach" | "inspect" | "notebook"; readonly facing: "east" | "west" }>
> = {
  "interaction.night-shift.briefing.read": { state: "inspect", facing: "east" },
  "interaction.night-shift.radio.take": { state: "reach", facing: "east" },
  "interaction.night-shift.keys.take": { state: "reach", facing: "east" },
  "interaction.night-shift.station-door.ready": { state: "reach", facing: "east" },
  "interaction.night-shift.sedan.observe": { state: "inspect", facing: "east" },
  "interaction.night-shift.sedan.resolve-safe": { state: "notebook", facing: "east" },
  "interaction.night-shift.receipt.inspect-after-talk": { state: "inspect", facing: "east" },
};

export const nightShiftRuntimeStaging = sceneStagingManifestSchema.parse({
  ...nightShiftCompleteStaging,
  scenes: nightShiftCompleteStaging.scenes.map((scene) => ({
    ...scene,
    interactionChoreographies: scene.interactionChoreographies.map((choreography) => {
      const pose = productionPoseForInteraction[choreography.interactionId];
      if (!pose) return choreography;
      const withoutGenericPose = choreography.beats.filter(
        (beat) => beat.kind !== "actor-animation",
      );
      return {
        ...choreography,
        beats: [
          {
            kind: "actor-animation",
            animationState: pose.state,
            facing: pose.facing,
            waitForCompletion: false,
          },
          ...withoutGenericPose,
        ],
        recoveryAnimationState: "idle",
      };
    }),
  })),
});

export const nightShiftProductionPoseRequirements = Object.entries(productionPoseForInteraction)
  .map(([interactionId, pose]) => ({ interactionId, ...pose }))
  .sort((left, right) => left.interactionId.localeCompare(right.interactionId));
