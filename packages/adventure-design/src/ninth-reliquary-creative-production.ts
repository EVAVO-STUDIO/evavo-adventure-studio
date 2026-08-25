import type { Id } from "@evavo/adventure-project-schema";
import type {
  AdventureAnimationFramePlan,
  AdventureCreativeWorkOrder,
} from "./creative-production-handoff.js";

export interface NinthReliquaryCreativeAuthorities {
  readonly projectId: Id<"project">;
  readonly sourceRevisionDigest: string;
  readonly visualStandardDigest: string;
  readonly styleBankDigest: string;
  readonly protagonistModelSheetDigest: string;
  readonly protagonistWalkXSheetDigest: string;
  readonly environmentalReferenceDigests: readonly string[];
  readonly characterReferenceDigests: readonly string[];
}

const walkFramePlan = (): readonly AdventureAnimationFramePlan[] => {
  const roles: readonly AdventureAnimationFramePlan["role"][] = [
    "contact",
    "breakdown",
    "passing",
    "breakdown",
    "contact",
    "breakdown",
    "passing",
    "breakdown",
    "contact",
    "breakdown",
  ];
  return roles.map((role, index) => ({
    frameId: `walk-east.${String(index + 1).padStart(2, "0")}`,
    exposureTicks: index === 0 || index === 4 || index === 8 ? 3 : 2,
    role,
    sourceRect: { x: index * 96, y: 0, width: 96, height: 192 },
    pivot: { x: 48, y: 178 },
    footPoint: { x: 48, y: 178 },
    handAnchor: { x: 56, y: 88 },
    shadowAnchor: { x: 48, y: 180 },
  }));
};

const sharedOrder = (
  authorities: NinthReliquaryCreativeAuthorities,
  workOrderId: string,
  assetId: string,
) => ({
  contractVersion: 1 as const,
  workOrderId,
  projectId: authorities.projectId,
  assetId: assetId as Id<"asset">,
  briefRevision: 1,
  sourceRevisionDigest: authorities.sourceRevisionDigest,
  visualStandardDigest: authorities.visualStandardDigest,
  styleBankDigest: authorities.styleBankDigest,
  checkerboardForbidden: true as const,
  preserveNativeCanvas: true,
});

export const createNinthReliquaryCreativeWorkOrders = (
  authorities: NinthReliquaryCreativeAuthorities,
): readonly AdventureCreativeWorkOrder[] => [
  {
    ...sharedOrder(
      authorities,
      "creative.ninth-reliquary.old-city-square.background",
      "asset.ninth-reliquary.old-city-square.background",
    ),
    destinationStudio: "art-studio",
    taskKind: "background",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    canvasEdgeMustBeTransparent: false,
    requiredReferenceDigests: authorities.environmentalReferenceDigests,
    artDirection: [
      "Hand-painted European old-city square after rain; composed as a playable cinematic shot, not a postcard.",
      "Cheat architectural perspective only where it improves mood, actor staging or clue readability; keep the authored walk floor coherent.",
      "Reserve visual hierarchy for the café entrance, damaged stone emblem and believable pedestrian incident area.",
      "Anime-adjacent influence is limited to clean shape/value organisation; environmental materials stay observational and specific.",
    ],
    rejectionRules: [
      "No generic tourism composition, fake lens bloom, random signage, AI microtexture or unreadable hotspot clutter.",
      "Do not paint debug walkmesh, hotspot outlines or interface labels into the final background.",
    ],
  },
  {
    ...sharedOrder(
      authorities,
      "creative.ninth-reliquary.old-city-square.foreground-awning",
      "asset.ninth-reliquary.old-city-square.foreground-awning",
    ),
    destinationStudio: "art-studio",
    taskKind: "foreground-plate",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    canvasEdgeMustBeTransparent: true,
    requiredReferenceDigests: authorities.environmentalReferenceDigests,
    artDirection: [
      "Separate café awning, hanging sign and near-frame masonry used for authored actor occlusion.",
      "Match the approved background perspective, palette, light direction and line/paint language exactly.",
      "Retain only the foreground forms required for occlusion; everything else must be transparent.",
    ],
    rejectionRules: [
      "No baked checkerboard, matte halo, opaque canvas corners or accidental duplicated background paint.",
      "Foreground silhouettes must not conceal the primary exit or evidence interaction lane when composited.",
    ],
  },
  {
    ...sharedOrder(
      authorities,
      "creative.ninth-reliquary.protagonist.model-sheet",
      "asset.ninth-reliquary.protagonist.model-sheet",
    ),
    destinationStudio: "cel-animation-studio",
    taskKind: "character-model-sheet",
    nativeSize: { width: 1024, height: 768 },
    alphaPolicy: "opaque",
    canvasEdgeMustBeTransparent: false,
    characterModelSheetDigest: authorities.protagonistModelSheetDigest,
    requiredReferenceDigests: authorities.characterReferenceDigests,
    artDirection: [
      "Original restoration researcher in practical contemporary European clothing; adult natural proportion with clean cel construction.",
      "Lock head shape, hair mass, facial landmarks, hand proportions, footwear, bag silhouette and costume seams before animation exposure.",
      "Anime-adjacent economy means intentional line/shape simplification and expressive pose clarity, not generic large-eye character design.",
    ],
    rejectionRules: [
      "No costume/detail drift between views, no generic anime face, no copied commercial silhouette or emblem.",
      "Do not approve animation before front/side/three-quarter/back construction and hand/face callouts agree.",
    ],
  },
  {
    ...sharedOrder(
      authorities,
      "creative.ninth-reliquary.protagonist.walk-east",
      "asset.ninth-reliquary.protagonist.walk-east",
    ),
    destinationStudio: "cel-animation-studio",
    taskKind: "animation-sequence",
    nativeSize: { width: 960, height: 192 },
    alphaPolicy: "required",
    canvasEdgeMustBeTransparent: true,
    characterModelSheetDigest: authorities.protagonistModelSheetDigest,
    xSheetDigest: authorities.protagonistWalkXSheetDigest,
    requiredReferenceDigests: [
      ...authorities.characterReferenceDigests,
      authorities.protagonistModelSheetDigest,
      authorities.protagonistWalkXSheetDigest,
    ],
    framePlan: walkFramePlan(),
    artDirection: [
      "Ten-drawing east walk authored as one sequence with controlled contact/passing poses and economical 2/3-tick exposures.",
      "Keep foot baseline, shadow anchor, head volume, bag placement and hand proportions locked across every drawing.",
      "Generate or repair bounded drawings against immediate neighbours and approved key poses; do not independently regenerate all ten frames.",
      "Review at gameplay scale in the old-city background as well as on hostile alpha plates.",
    ],
    rejectionRules: [
      "No independent-frame regeneration, foot skating, volume pumping, hair/costume redesign, lighting flicker or loop pop.",
      "No baked checkerboard, matte residue, soft opaque canvas edge or frame-by-frame palette drift.",
    ],
  },
];

export const ninthReliquaryWalkFramePlan = walkFramePlan;
