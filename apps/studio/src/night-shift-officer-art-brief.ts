import { nightShiftOfficerMasterContract, nightShiftOfficerMasterSlots } from "./night-shift-officer-master-contract.js";
import { nightShiftActorLightingPalette } from "./scene-director-palette-specs.js";

const poseIntent = (role: string, frameId: string): string => {
  if (role === "idle") return "Grounded neutral duty stance; readable small silhouette, no hero pose.";
  if (role === "reach") return "Economical one-arm practical reach for radio, keys and latch interactions.";
  if (role === "inspect") return "Brief attentive lean/read pose for briefing sheet, vehicle observation and receipt inspection.";
  if (role === "notebook") return "Compact notebook-writing pose with one hand stabilising the pad and the other marking it.";
  const match = /walk-(\d+)$/u.exec(frameId);
  const index = Number(match?.[1] ?? 0);
  if (index === 3) return "Left planted-foot contact; body weight settles without foot skating.";
  if (index === 7) return "Right planted-foot contact; mirror of gait rhythm, not a copied silhouette.";
  return "Intermediate walk phase preserving readable leg separation and stable body mass.";
};

export const nightShiftOfficerArtBrief = {
  briefVersion: 1,
  assetId: nightShiftOfficerMasterContract.assetId,
  project: "Night Shift",
  productionLanguage: "Original early-1990s procedural icon VGA",
  referenceIntent:
    "Grounded municipal adventure-game actor staging inspired by early SCI1-era production discipline without copying any proprietary character, costume or animation frame.",
  master: {
    path: nightShiftOfficerMasterContract.sourcePath,
    width: nightShiftOfficerMasterContract.masterSize.width,
    height: nightShiftOfficerMasterContract.masterSize.height,
    indexedColour: true,
    binaryAlpha: true,
    finalRuntimeScale: "native-1x-nearest",
  },
  characterDirection: [
    "Original anonymous municipal night officer in practical late-1980s/early-1990s duty clothing; avoid recognisable proprietary police-game character designs.",
    "Average working posture rather than action-hero proportions; actor remains deliberately small against 320×200 architecture.",
    "Dark navy uniform, restrained brown leather/equipment, natural skin and modest metal highlights mapped through the authored actor palette banks.",
    "Face is readable through a few intentional clusters; do not draw portrait-level facial detail into a 20×46 rendered body.",
    "Keep hat/hair, badge and equipment simple enough that mirroring remains plausible unless a readable asymmetric detail truly requires separate west-facing art.",
  ],
  paletteBanks: nightShiftActorLightingPalette.banks.map((bank) => ({
    label: bank.label,
    offset: bank.offset,
    role: bank.role,
    colours: bank.colours,
  })),
  slots: nightShiftOfficerMasterSlots.map((slot) => ({
    frameId: slot.frameId,
    role: slot.role,
    sourceRect: { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
    intent: poseIntent(slot.role, slot.frameId),
    footContact: slot.footContact,
    pivot: slot.pivot,
    footPoint: slot.footPoint,
    shadowAnchor: slot.shadowAnchor,
    handRight: slot.handRight,
    handLeft: slot.handLeft,
  })),
  pixelRules: [
    "Work at native resolution from the first committed pixel; do not finish at high resolution and downsample as the final workflow.",
    "No universal one-pixel black outline. Separate silhouette edges selectively using adjacent value contrast and material clusters.",
    "No antialiasing, soft alpha, subpixel strokes, blur, bloom, chromatic aberration, CRT simulation or post-sharpened pseudo-detail.",
    "Dither only where it explains material/lighting; do not texture the whole uniform or face with alternating single-pixel noise.",
    "Preserve clear negative space between arms/body and between legs where the pose requires it; avoid fused AI-like anatomy clusters.",
    "Hands and facial features may simplify aggressively at 1×, but attachment points and gaze/gesture direction must remain coherent.",
  ],
  animationRules: [
    "Walk has eight authored phases at six logical ticks each; do not tween extra frames between them.",
    "Frames 03 and 07 are the planted contacts and must not visibly slide against the floor when played in sequence.",
    "Torso/head bob should be subtle and purposeful; avoid modern smooth interpolation or exaggerated squash/stretch.",
    "Reach, inspect and notebook poses are short economical performance beats, not miniature cinematic animations.",
    "Every pose must recover cleanly to idle without changing foot anchor or perceived actor scale.",
  ],
  rejectIf: [
    "Looks like generic contemporary pixel-art character design rather than observed early-90s VGA production.",
    "Requires a thick outline to stay readable.",
    "Contains AI-like pseudo-detail, stray single-pixel anatomy/noise or inconsistent hands/limbs between frames.",
    "Loses face/uniform separation under any of the four authored palette banks.",
    "Walk contact frames skate, change leg length or move the canonical foot point.",
    "Equipment/badge details become obviously wrong when mirrored.",
  ],
} as const;

export const nightShiftOfficerArtBriefFileName = "night-shift.officer-art-brief.json";

export const nightShiftOfficerArtBriefJson = (): string =>
  `${JSON.stringify(nightShiftOfficerArtBrief, null, 2)}\n`;
