import { nightShiftOfficerMasterContract, nightShiftOfficerMasterSlots } from "./night-shift-officer-master-contract.js";

export const nightShiftOfficerReviewTemplate = {
  templateVersion: 1,
  assetId: nightShiftOfficerMasterContract.assetId,
  sourcePath: nightShiftOfficerMasterContract.sourcePath,
  masterSize: nightShiftOfficerMasterContract.masterSize,
  reviewScale: "raw-1x",
  comparisonScales: [2, 3, 4],
  frameReviews: nightShiftOfficerMasterSlots.map((slot) => ({
    frameId: slot.frameId,
    role: slot.role,
    sourceRect: { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
    requiredFootContact: slot.footContact,
    silhouetteReadsAtOneToOne: false,
    binaryAlpha: false,
    anchorsStable: false,
    paletteBanksReadable: false,
    ...(slot.footContact ? { footContactStable: false } : {}),
    notes: "",
  })),
  globalReview: {
    indexedColour: false,
    colourCount: null,
    alphaMode: "unreviewed",
    universalOutline: null,
    syntheticMicrotexture: null,
  },
  instructions: [
    "Review the Aseprite master at raw 1× first; integer scales are confirmation only.",
    "Set a frame field true only after the exact source rectangle has been reviewed against the guide overlay.",
    "Palette-bank readability means the face, uniform, cloth and leather still separate under neutral, fluorescent, headlamp and diner banks.",
    "Foot-contact stability is mandatory only for the two authored contact frames.",
    "Do not approve the master if cleanup depends on CRT simulation, blur, soft alpha or a universal outline.",
  ],
} as const;

export const nightShiftOfficerReviewTemplateFileName = "night-shift.officer-review-template.json";

export const nightShiftOfficerReviewTemplateJson = (): string =>
  `${JSON.stringify(nightShiftOfficerReviewTemplate, null, 2)}\n`;
