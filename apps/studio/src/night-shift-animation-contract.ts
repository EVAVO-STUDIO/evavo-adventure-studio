import { actorSchema, type Actor } from "@evavo/adventure-project-schema";
import { nightShiftCompleteProject } from "./night-shift-complete-proof.js";

const baseOfficer = nightShiftCompleteProject.actors.find(
  (actor) => actor.id === "actor.night-shift.officer",
);
if (!baseOfficer) throw new Error("Night Shift proof is missing the officer actor.");

const officerFrame = (
  id: string,
  sourceX: number,
  durationTicks: number,
  events: readonly string[] = [],
) => ({
  id,
  assetId: "asset.night-shift.actor.officer",
  sourceRect: { x: sourceX, y: 0, width: 20, height: 46 },
  sourceSize: { width: 24, height: 50 },
  trimOffset: { x: 2, y: 3 },
  pivot: { x: 12, y: 49 },
  footPoint: { x: 12, y: 49 },
  shadowAnchor: { x: 12, y: 48 },
  attachmentPoints: {
    handRight: { x: 17, y: 26 },
    handLeft: { x: 7, y: 27 },
  },
  durationTicks,
  ...(events.length > 0 ? { events } : {}),
  mirrorEligible: true,
});

const walkFrameIds = Array.from({ length: 8 }, (_, index) =>
  `frame.night-shift.officer.walk-${String(index + 1).padStart(2, "0")}`,
);

const frames = [
  officerFrame("frame.night-shift.officer.idle", 0, 12),
  ...walkFrameIds.map((id, index) =>
    officerFrame(
      id,
      22 * (index + 1),
      6,
      index === 2
        ? ["foot-contact-left"]
        : index === 6
          ? ["foot-contact-right"]
          : [],
    ),
  ),
  officerFrame("frame.night-shift.officer.reach", 198, 8),
  officerFrame("frame.night-shift.officer.inspect", 220, 10),
  officerFrame("frame.night-shift.officer.notebook", 242, 12),
] as const;

const directionalAnimation = (
  id: string,
  state: string,
  facing: string,
  frameIds: readonly string[],
  loop: boolean,
  interruptible: boolean,
) => ({ id, state, facing, frameIds, loop, interruptible });

export const nightShiftOfficerActor: Actor = actorSchema.parse({
  ...baseOfficer,
  frames,
  animations: [
    directionalAnimation(
      "animation.night-shift.officer.idle-east",
      "idle",
      "east",
      ["frame.night-shift.officer.idle"],
      true,
      true,
    ),
    directionalAnimation(
      "animation.night-shift.officer.idle-west",
      "idle",
      "west",
      ["frame.night-shift.officer.idle"],
      true,
      true,
    ),
    directionalAnimation(
      "animation.night-shift.officer.walk-east",
      "walk",
      "east",
      walkFrameIds,
      true,
      true,
    ),
    directionalAnimation(
      "animation.night-shift.officer.walk-west",
      "walk",
      "west",
      walkFrameIds,
      true,
      true,
    ),
    directionalAnimation(
      "animation.night-shift.officer.reach-east",
      "reach",
      "east",
      ["frame.night-shift.officer.reach"],
      false,
      false,
    ),
    directionalAnimation(
      "animation.night-shift.officer.reach-west",
      "reach",
      "west",
      ["frame.night-shift.officer.reach"],
      false,
      false,
    ),
    directionalAnimation(
      "animation.night-shift.officer.inspect-east",
      "inspect",
      "east",
      ["frame.night-shift.officer.inspect"],
      false,
      false,
    ),
    directionalAnimation(
      "animation.night-shift.officer.inspect-west",
      "inspect",
      "west",
      ["frame.night-shift.officer.inspect"],
      false,
      false,
    ),
    directionalAnimation(
      "animation.night-shift.officer.notebook-east",
      "notebook",
      "east",
      ["frame.night-shift.officer.notebook"],
      false,
      false,
    ),
    directionalAnimation(
      "animation.night-shift.officer.notebook-west",
      "notebook",
      "west",
      ["frame.night-shift.officer.notebook"],
      false,
      false,
    ),
  ],
});

export const nightShiftOfficerAnimationRequirements = {
  nativeFrameSize: { width: 24, height: 50 },
  walkFrameCount: 8,
  walkFrameDurationTicks: 6,
  requiredStates: ["idle", "walk", "reach", "inspect", "notebook"],
  footContactFrameIds: [walkFrameIds[2], walkFrameIds[6]],
  productionRules: [
    "Keep the planted foot within one native pixel across contiguous contact frames.",
    "Do not tween subpixel body motion; authored clusters must survive nearest-neighbour presentation.",
    "Walk silhouette should read at raw 1× without a universal black outline.",
    "Mirrored west-facing frames must not reverse badge/text details that require asymmetric authored variants.",
    "Hands, radio/notebook attachment anchors and foot point must remain stable enough for interaction choreography.",
  ],
} as const;
