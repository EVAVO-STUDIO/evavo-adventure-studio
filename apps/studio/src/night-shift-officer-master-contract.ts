import { nightShiftOfficerActor, nightShiftOfficerAnimationRequirements } from "./night-shift-animation-contract.js";
import { encodeNativeRgbaPng } from "./native-png.js";

export interface NightShiftOfficerMasterSlot {
  readonly frameId: string;
  readonly role: "idle" | "walk" | "reach" | "inspect" | "notebook";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly footPoint: { readonly x: number; readonly y: number };
  readonly shadowAnchor: { readonly x: number; readonly y: number } | null;
  readonly handRight: { readonly x: number; readonly y: number } | null;
  readonly handLeft: { readonly x: number; readonly y: number } | null;
  readonly footContact: "left" | "right" | null;
}

const roleForFrame = (frameId: string): NightShiftOfficerMasterSlot["role"] => {
  if (frameId.includes(".walk-")) return "walk";
  if (frameId.endsWith(".reach")) return "reach";
  if (frameId.endsWith(".inspect")) return "inspect";
  if (frameId.endsWith(".notebook")) return "notebook";
  return "idle";
};

const contactForFrame = (events: readonly string[] | undefined): NightShiftOfficerMasterSlot["footContact"] =>
  events?.includes("foot-contact-left")
    ? "left"
    : events?.includes("foot-contact-right")
      ? "right"
      : null;

export const nightShiftOfficerMasterSlots: readonly NightShiftOfficerMasterSlot[] =
  nightShiftOfficerActor.frames.map((frame) => ({
    frameId: frame.id,
    role: roleForFrame(frame.id),
    x: frame.sourceRect.x,
    y: frame.sourceRect.y,
    width: frame.sourceRect.width,
    height: frame.sourceRect.height,
    pivot: frame.pivot,
    footPoint: frame.footPoint,
    shadowAnchor: frame.shadowAnchor ?? null,
    handRight: frame.attachmentPoints?.handRight ?? null,
    handLeft: frame.attachmentPoints?.handLeft ?? null,
    footContact: contactForFrame(frame.events),
  }));

export const nightShiftOfficerMasterContract = {
  assetId: "asset.night-shift.actor.officer",
  sourcePath: "art/night-shift/officer.aseprite",
  masterSize: { width: 264, height: 50 },
  frameSourceSize: nightShiftOfficerAnimationRequirements.nativeFrameSize,
  renderedFrameRect: { width: 20, height: 46 },
  horizontalStride: 22,
  horizontalGutter: 2,
  frameCount: nightShiftOfficerMasterSlots.length,
  requiredRoles: ["idle", "walk", "reach", "inspect", "notebook"],
  slots: nightShiftOfficerMasterSlots,
  reviewRules: [
    "Every rendered frame stays inside its 20×46 source rectangle; the 2-pixel gutter remains transparent.",
    "The authored 24×50 source-size coordinate system keeps pivot/foot/hand/shadow anchors stable across frames.",
    "Walk frames 03 and 07 are the left/right planted-foot contacts and must read as stable contacts at raw 1×.",
    "Do not draw a mechanical one-pixel outline around the full body; use selective silhouette contrast and internal material clusters.",
    "Uniform badge/nameplate asymmetry must not be mirrored into nonsense; create explicit west-facing art later if asymmetry becomes readable at native scale.",
    "Reach/inspect/notebook poses must feel like economical early-SCI1 animation, not high-frame-count modern tweening.",
  ],
} as const;

export const validateNightShiftOfficerMasterContract = (): readonly string[] => {
  const issues: string[] = [];
  const { width, height } = nightShiftOfficerMasterContract.masterSize;
  if (nightShiftOfficerMasterSlots.length !== 12) {
    issues.push(`Officer master must contain 12 slots; found ${nightShiftOfficerMasterSlots.length}.`);
  }
  const seen = new Set<string>();
  for (const slot of nightShiftOfficerMasterSlots) {
    if (seen.has(slot.frameId)) issues.push(`Duplicate officer master frame '${slot.frameId}'.`);
    seen.add(slot.frameId);
    if (slot.y !== 0 || slot.height !== 46 || slot.width !== 20) {
      issues.push(`Officer frame '${slot.frameId}' must use a 20×46 source rect at y=0.`);
    }
    if (slot.x < 0 || slot.x + slot.width > width || slot.y + slot.height > height) {
      issues.push(`Officer frame '${slot.frameId}' exceeds the ${width}×${height} master.`);
    }
    if (slot.x % nightShiftOfficerMasterContract.horizontalStride !== 0) {
      issues.push(`Officer frame '${slot.frameId}' is not aligned to the 22-pixel strip stride.`);
    }
    if (slot.footPoint.x !== 12 || slot.footPoint.y !== 49) {
      issues.push(`Officer frame '${slot.frameId}' moved the canonical foot point.`);
    }
    if (slot.pivot.x !== 12 || slot.pivot.y !== 49) {
      issues.push(`Officer frame '${slot.frameId}' moved the canonical pivot.`);
    }
    if (slot.shadowAnchor?.x !== 12 || slot.shadowAnchor?.y !== 48) {
      issues.push(`Officer frame '${slot.frameId}' moved the canonical shadow anchor.`);
    }
  }
  const walk = nightShiftOfficerMasterSlots.filter((slot) => slot.role === "walk");
  if (walk.length !== 8) issues.push(`Officer walk must contain eight slots; found ${walk.length}.`);
  const contacts = walk.filter((slot) => slot.footContact !== null);
  if (contacts.map((slot) => slot.footContact).join(",") !== "left,right") {
    issues.push("Officer walk must retain one left and one right authored foot-contact frame.");
  }
  return issues;
};

const setPixel = (
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  if (x < 0 || y < 0 || x >= width || y >= 50) return;
  const offset = (y * width + x) * 4;
  rgba[offset] = colour[0];
  rgba[offset + 1] = colour[1];
  rgba[offset + 2] = colour[2];
  rgba[offset + 3] = colour[3];
};

export const nightShiftOfficerReviewGuidePngBytes = (): Uint8Array => {
  const width = nightShiftOfficerMasterContract.masterSize.width;
  const height = nightShiftOfficerMasterContract.masterSize.height;
  const rgba = new Uint8Array(width * height * 4);
  const grid: readonly [number, number, number, number] = [80, 92, 105, 255];
  const contact: readonly [number, number, number, number] = [220, 185, 105, 255];
  const anchor: readonly [number, number, number, number] = [160, 205, 220, 255];

  for (const slot of nightShiftOfficerMasterSlots) {
    for (let y = 0; y < height; y += 1) {
      setPixel(rgba, width, slot.x, y, grid);
      setPixel(rgba, width, slot.x + slot.width - 1, y, grid);
    }
    for (let x = slot.x; x < slot.x + slot.width; x += 1) {
      setPixel(rgba, width, x, 0, grid);
      setPixel(rgba, width, x, slot.height - 1, grid);
    }
    const anchorX = slot.x + Math.min(slot.width - 1, slot.footPoint.x - 2);
    const footY = Math.min(height - 1, slot.footPoint.y);
    setPixel(rgba, width, anchorX, footY, slot.footContact ? contact : anchor);
    setPixel(rgba, width, anchorX - 1, footY, slot.footContact ? contact : anchor);
    setPixel(rgba, width, anchorX + 1, footY, slot.footContact ? contact : anchor);
  }
  return encodeNativeRgbaPng(width, height, rgba);
};

export const nightShiftOfficerReviewGuide = {
  fileName: "night-shift.officer-master-guide.png",
  width: 264,
  height: 50,
  purpose: "Non-runtime overlay guide for frame cells, native anchors and planted-foot review.",
} as const;
