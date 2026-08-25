import type {
  AdventureCreativeFramePlanV3,
  AdventureCreativeTaskKindV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

export interface IllustratedConspiracyProductionAuthority {
  readonly sourceRevisionDigest: string;
  readonly styleDigest: string;
  readonly paletteDigest: string;
  readonly environmentLayoutDigest?: string;
  readonly modelSheetDigest?: string;
  readonly xSheetDigest?: string;
  readonly referenceDigests: readonly string[];
}

export interface IllustratedConspiracyAssetSpec {
  readonly assetId: string;
  readonly taskKind: AdventureCreativeTaskKindV3;
  readonly destinationStudio: "art-studio" | "cel-animation-studio";
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: "opaque" | "binary" | "soft" | "required";
  readonly artDirection: readonly string[];
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly rejectionRules: readonly string[];
  readonly frames?: readonly AdventureCreativeFramePlanV3[];
  readonly loop?: boolean;
}

const animationKind = (kind: AdventureCreativeTaskKindV3): boolean =>
  kind === "animation-sequence" || kind === "cutscene-shot" || kind === "effects-sequence";

export const compileIllustratedConspiracyWorkOrder = (
  projectId: string,
  workOrderId: string,
  spec: IllustratedConspiracyAssetSpec,
  authority: IllustratedConspiracyProductionAuthority,
  revision = 1,
): AdventureCreativeWorkOrderV3 => {
  const animated = animationKind(spec.taskKind);
  return {
    contractVersion: 3,
    workOrderId,
    projectId,
    assetId: spec.assetId,
    destinationStudio: spec.destinationStudio,
    taskKind: spec.taskKind,
    revision,
    sourceRevisionDigest: authority.sourceRevisionDigest,
    nativeSize: spec.nativeSize,
    alphaPolicy: spec.alphaPolicy,
    preserveNativeCanvas: true,
    authorities: {
      profileId: "cinematic-handdrawn-conspiracy",
      styleDigest: authority.styleDigest,
      paletteDigest: authority.paletteDigest,
      ...(authority.environmentLayoutDigest ? { environmentLayoutDigest: authority.environmentLayoutDigest } : {}),
      ...(authority.modelSheetDigest ? { modelSheetDigest: authority.modelSheetDigest } : {}),
      ...(authority.xSheetDigest ? { xSheetDigest: authority.xSheetDigest } : {}),
      referenceDigests: [...new Set(authority.referenceDigests)].sort((left, right) => left.localeCompare(right)),
    },
    invariants: spec.invariants,
    forbiddenDrift: spec.forbiddenDrift,
    artDirection: spec.artDirection,
    reviewChecklist: spec.reviewChecklist,
    rejectionRules: spec.rejectionRules,
    ...(spec.frames ? { framePlan: spec.frames } : {}),
    ...(animated
      ? {
          sequencePolicy: {
            independentFrameGenerationForbidden: true,
            exactExposureTimingRequired: true,
            modelSheetConformanceRequired: spec.taskKind !== "effects-sequence",
            xSheetConformanceRequired: true,
            immediateNeighbourReviewRequired: true,
            loopClosureReviewRequired: Boolean(spec.loop),
          },
        }
      : {}),
    transparencyPolicy: {
      checkerboardForbidden: true,
      decodedAlphaRequired: spec.alphaPolicy !== "opaque",
      transparentCanvasEdgeRequired: spec.alphaPolicy !== "opaque",
      matteResidueForbidden: true,
      haloFringeForbidden: true,
      transparentRgbContaminationForbidden: true,
      hostilePlateReviewRequired: spec.alphaPolicy !== "opaque",
    },
    iterationPolicy: {
      maximumRevisionPasses: 5,
      compareAgainstPreviousApproved: true,
      requireIssueClosureEvidence: true,
      preferTargetedRepair: true,
      fullRegenerationRequiresExplicitReason: true,
    },
    requestedRepairs: [],
  };
};

const walkFrames = (prefix: string): readonly AdventureCreativeFramePlanV3[] =>
  Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    const frameId = `${prefix}.${String(number).padStart(2, "0")}`;
    const previous = `${prefix}.${String(index === 0 ? 8 : index).padStart(2, "0")}`;
    const next = `${prefix}.${String(number === 8 ? 1 : number + 1).padStart(2, "0")}`;
    return {
      frameId,
      role: number === 1 || number === 5 ? "contact" : number === 3 || number === 7 ? "passing" : "inbetween",
      exposureTicks: 2,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      handAnchors: {
        left: { x: 14, y: 56 },
        right: { x: 34, y: 56 },
      },
      shadowAnchor: { x: 24, y: 92 },
      requiredNeighbourFrameIds: [previous, next],
    } satisfies AdventureCreativeFramePlanV3;
  });

const heldPerformanceFrames = (
  prefix: string,
  count: number,
  exposureTicks: number,
): readonly AdventureCreativeFramePlanV3[] =>
  Array.from({ length: count }, (_, index) => ({
    frameId: `${prefix}.${String(index + 1).padStart(2, "0")}`,
    role: index === 0 || index === count - 1 ? "extreme" : "breakdown",
    exposureTicks,
    pivot: { x: 24, y: 92 },
    footPoint: { x: 24, y: 92 },
    requiredNeighbourFrameIds: [
      ...(index > 0 ? [`${prefix}.${String(index).padStart(2, "0")}`] : []),
      ...(index + 1 < count ? [`${prefix}.${String(index + 2).padStart(2, "0")}`] : []),
    ],
  }));

export const ninthReliquaryAssetSpecs: readonly IllustratedConspiracyAssetSpec[] = [
  {
    assetId: "asset.ninth-reliquary.old-city.layout",
    taskKind: "background-layout",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: [
      "Rain-cleared European old-city square, cafe frontage and side street; cinematic but fully navigable.",
      "Cheat perspective for story readability while retaining explicit walk floor and exit alignment.",
      "Leave uncluttered action lanes for two full-height cel characters and foreground occlusion plates.",
    ],
    invariants: ["camera and vanishing relationships stay fixed after layout approval", "all authored exits remain visually readable"],
    forbiddenDrift: ["photoreal concept-art lens", "generic fantasy medieval street", "tourist postcard framing"],
    reviewChecklist: ["perspective", "navigation lane", "clue readability", "foreground separation", "character scale"],
    rejectionRules: ["walk lane hidden by decorative clutter", "unusable exit silhouette", "camera changed after approval"],
  },
  {
    assetId: "asset.ninth-reliquary.old-city.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: [
      "Paint from the approved old-city layout with controlled cool wet stone and warm cafe practicals.",
      "Use hand-painted gradients and sparse surface texture; do not bury clues in procedural noise.",
    ],
    invariants: ["approved layout geometry remains pixel-registered", "door/window/curb anchors do not move"],
    forbiddenDrift: ["AI microtexture", "global teal-orange grade", "bloom", "generic anime background blur"],
    reviewChecklist: ["layout registration", "light logic", "material separation", "clue contrast", "character integration zones"],
    rejectionRules: ["layout repaint changes geometry", "muddy global grading", "unmotivated lens effects"],
  },
  {
    assetId: "asset.ninth-reliquary.cafe.foreground",
    taskKind: "foreground-plate",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    artDirection: ["Transparent cafe chair/table/awning occlusion plate registered exactly to the approved background."],
    invariants: ["plate registration remains exact", "foreground silhouettes match approved background geometry"],
    forbiddenDrift: ["painted checkerboard", "white matte edge", "floating chair/table registration"],
    reviewChecklist: ["decoded alpha", "hostile plates", "halo", "registration", "occlusion silhouette"],
    rejectionRules: ["fake transparency", "matte fringe", "background pixels baked into transparent plate"],
  },
  {
    assetId: "asset.ninth-reliquary.mara.model-sheet",
    taskKind: "character-model-sheet",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 1024, height: 1024 },
    alphaPolicy: "opaque",
    artDirection: [
      "Original restoration researcher Mara Venn: modern European fieldwear, practical silhouette, expressive hands.",
      "Clean cel construction with restrained anime influence in shape economy and facial readability, not a copied anime archetype.",
    ],
    invariants: ["face landmarks", "body proportion", "coat length", "bag strap path", "hair mass"],
    forbiddenDrift: ["generic anime face", "fashion redesign between views", "oversized eyes", "franchise resemblance"],
    reviewChecklist: ["front/profile/three-quarter identity", "proportion", "costume anchors", "hand scale", "turnaround consistency"],
    rejectionRules: ["identity changes between views", "costume construction contradiction"],
  },
  {
    assetId: "asset.ninth-reliquary.mara.walk-east",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 384, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Eight-drawing restrained walk with confident heel/toe contacts, light coat overlap and stable head volume."],
    invariants: ["foot baseline y=92", "same model-sheet identity", "same coat and bag construction"],
    forbiddenDrift: ["independent regenerated frames", "rubber limbs", "sliding foot", "line weight flicker"],
    reviewChecklist: ["frame count", "x-sheet exposure", "neighbour continuity", "foot contacts", "model sheet", "alpha"],
    rejectionRules: ["anchor wobble", "frame order drift", "fake checkerboard", "loop pop"],
    frames: walkFrames("frame.mara.walk-east"),
    loop: true,
  },
  {
    assetId: "asset.ninth-reliquary.mara.inspect",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 192, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Four-drawing inspect action: settle, hand reach, focused hold, recover. Preserve planted feet."],
    invariants: ["foot baseline fixed", "right-hand evidence anchor readable", "head volume unchanged"],
    forbiddenDrift: ["generic pose morph", "feet shifting during held inspection"],
    reviewChecklist: ["hand arc", "eye line", "hold timing", "anchor stability", "alpha"],
    rejectionRules: ["hand/evidence anchor mismatch", "model drift"],
    frames: heldPerformanceFrames("frame.mara.inspect", 4, 3),
  },
  {
    assetId: "asset.ninth-reliquary.mara.closeup",
    taskKind: "portrait-closeup",
    destinationStudio: "art-studio",
    nativeSize: { width: 384, height: 216 },
    alphaPolicy: "opaque",
    artDirection: ["Cinematic dialogue close-up from approved Mara model sheet; restrained eyebrow/eye/mouth acting and motivated cafe window light."],
    invariants: ["same face construction as model sheet", "same costume and hair landmarks"],
    forbiddenDrift: ["generic anime portrait face", "glamour illustration pose", "unmotivated rim light"],
    reviewChecklist: ["identity", "eye line", "light motivation", "shot continuity"],
    rejectionRules: ["identity mismatch", "beautification that changes character"],
  },
  {
    assetId: "asset.ninth-reliquary.chapel-cutaway",
    taskKind: "cutscene-shot",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: [
      "Short chapel reveal cutaway: held architecture, one controlled camera move, Mara reaction, gloved hand entering frame, hard return to gameplay.",
      "Use animation economy and authored holds; the shot should feel illustrated and cinematic rather than video-like.",
    ],
    invariants: ["approved chapel layout", "Mara model identity", "exact sequence duration and return beat"],
    forbiddenDrift: ["camera drift", "new unapproved costume", "generic action-anime smear everywhere"],
    reviewChecklist: ["x-sheet", "camera timing", "identity", "hard return frame", "sound cue alignment"],
    rejectionRules: ["cutaway does not return on authored beat", "character identity changes between shot and gameplay"],
    frames: heldPerformanceFrames("frame.chapel-cutaway", 6, 4),
  },
] as const;

export const createNinthReliquaryProductionPlan = (
  authorityByAsset: Readonly<Record<string, IllustratedConspiracyProductionAuthority>>,
): readonly AdventureCreativeWorkOrderV3[] =>
  ninthReliquaryAssetSpecs.map((spec, index) => {
    const authority = authorityByAsset[spec.assetId];
    if (!authority) throw new Error(`Missing production authority for '${spec.assetId}'.`);
    return compileIllustratedConspiracyWorkOrder(
      "project.ninth-reliquary",
      `work.ninth-reliquary.${String(index + 1).padStart(2, "0")}.${spec.assetId.split(".").at(-1)}`,
      spec,
      authority,
    );
  });
