import type { Actor, Id } from "@evavo/adventure-project-schema";
import {
  compileAnimationAdventureCreativeWorkOrder,
  compileStaticAdventureCreativeWorkOrder,
  type AdventureCreativeAuthority,
} from "./creative-handoff-compiler.js";
import type { AdventureCreativeWorkOrderV2 } from "./creative-handoff-v2.js";
import { adventureProductionProfiles } from "./production-profile-presets.js";
import type { AdventureProductionProfile } from "./production-profile-types.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const profile = (): AdventureProductionProfile => {
  const match = adventureProductionProfiles.find(
    (candidate) => candidate.id === "cinematic-handdrawn-conspiracy",
  );
  if (!match) throw new Error("Cinematic Hand-Drawn Conspiracy profile is unavailable.");
  return match;
};

const walkFrame = (
  index: number,
  role: "contact" | "passing" | "extreme",
  handX: number,
  event?: string,
) => ({
  id: id<"sprite-frame">(`frame.ninth-reliquary.mara.walk-east.${String(index + 1).padStart(2, "0")}`),
  assetId: id<"asset">("asset.ninth-reliquary.mara.walk-east"),
  sourceRect: { x: index * 32, y: 0, width: 32, height: 64 },
  sourceSize: { width: 32, height: 64 },
  trimOffset: { x: 0, y: 0 },
  pivot: { x: 16, y: 62 },
  footPoint: { x: 16, y: 62 },
  shadowAnchor: { x: 16, y: 61 },
  attachmentPoints: {
    hand: { x: handX, y: 37 },
  },
  durationTicks: 3,
  ...(event ? { events: [event] } : {}),
  mirrorEligible: true,
  role,
});

const frames = [
  walkFrame(0, "contact", 21, "footfall-left"),
  walkFrame(1, "passing", 20),
  walkFrame(2, "extreme", 18),
  walkFrame(3, "passing", 14),
  walkFrame(4, "contact", 11, "footfall-right"),
  walkFrame(5, "passing", 12),
  walkFrame(6, "extreme", 15),
  walkFrame(7, "passing", 19),
] as const;

export const ninthReliquaryMaraActor: Actor = {
  id: id<"actor">("actor.ninth-reliquary.mara"),
  name: "Mara Venn",
  frames: frames.map(({ role: _role, ...frame }) => frame),
  animations: [
    {
      id: id<"animation-clip">("animation.ninth-reliquary.mara.walk-east"),
      state: "walk",
      facing: "east",
      frameIds: frames.map((frame) => frame.id),
      loop: true,
      interruptible: true,
    },
  ],
};

export interface NinthReliquaryCreativeProofAuthority {
  readonly sourceRevisionDigest: string;
  readonly styleDigest: string;
  readonly paletteDigest: string;
  readonly environmentLayoutDigest: string;
  readonly modelSheetDigest: string;
  readonly xSheetDigest: string;
  readonly referenceDigests: readonly string[];
}

export interface NinthReliquaryCreativeProofWorkOrders {
  readonly background: AdventureCreativeWorkOrderV2;
  readonly maraWalkEast: AdventureCreativeWorkOrderV2;
}

export const compileNinthReliquaryCreativeProofWorkOrders = (
  authority: NinthReliquaryCreativeProofAuthority,
  revision = 1,
): NinthReliquaryCreativeProofWorkOrders => {
  const productionProfile = profile();
  const shared: AdventureCreativeAuthority = {
    sourceRevisionDigest: authority.sourceRevisionDigest,
    styleDigest: authority.styleDigest,
    paletteDigest: authority.paletteDigest,
    referenceDigests: authority.referenceDigests,
  };

  return {
    background: compileStaticAdventureCreativeWorkOrder({
      workOrderId: `creative.ninth-reliquary.old-city-square.background.r${revision}`,
      projectId: "project.ninth-reliquary-proof",
      assetId: "asset.ninth-reliquary.old-city-square.background",
      taskKind: "background",
      revision,
      ...(revision > 1 ? { replacesRevision: revision - 1 } : {}),
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
      profile: productionProfile,
      authority: {
        ...shared,
        environmentLayoutDigest: authority.environmentLayoutDigest,
      },
      artDirection: [
        "Original rain-cleared European old-city square and café; recognisable geography, readable exits and clue-bearing architecture.",
        "Modern hand-painted/cel production with anime-adjacent shape economy, but natural architectural perspective and no imitation of a named adventure game frame.",
        "Reserve clean foreground separations for later occlusion plates rather than baking characters into the environment.",
      ],
      rejectionRules: [
        "Reject invented text/signage gibberish, repeated façade motifs, impossible windows, merged furniture or generic generated-city substitutions.",
      ],
    }),
    maraWalkEast: compileAnimationAdventureCreativeWorkOrder({
      workOrderId: `creative.ninth-reliquary.mara.walk-east.r${revision}`,
      projectId: "project.ninth-reliquary-proof",
      assetId: "asset.ninth-reliquary.mara.walk-east",
      revision,
      ...(revision > 1 ? { replacesRevision: revision - 1 } : {}),
      nativeSize: { width: 256, height: 64 },
      alphaPolicy: "required",
      profile: productionProfile,
      actor: ninthReliquaryMaraActor,
      animationClipId: id<"animation-clip">("animation.ninth-reliquary.mara.walk-east"),
      authority: {
        ...shared,
        modelSheetDigest: authority.modelSheetDigest,
        xSheetDigest: authority.xSheetDigest,
      },
      roleByFrameId: Object.fromEntries(frames.map((frame) => [frame.id, frame.role])),
      artDirection: [
        "Mara is an original restoration researcher: observant, practical and physically grounded; modern cel/anime-adjacent construction without generic anime facial shorthand.",
        "Keep jacket seams, hair mass, nose/eye construction, limb lengths and hand scale locked to the approved model sheet.",
        "Animate a deliberate grounded walk with clear planted contacts and restrained vertical bob appropriate to a cinematic investigation game.",
      ],
      reviewChecklist: [
        "Flip frames at exact 3-tick exposure and verify the body does not pulse in width/height between drawings.",
        "Review the strip on black, white, grey, green and magenta hostile backgrounds to prove real alpha and clean edge colour.",
      ],
      rejectionRules: [
        "Reject a contact sheet pasted over an opaque/checkerboard background; each cel must have genuine decoded alpha.",
        "Reject regenerated-looking face, hair, jacket or hand construction in any one frame even if the pose is individually attractive.",
      ],
    }),
  };
};
