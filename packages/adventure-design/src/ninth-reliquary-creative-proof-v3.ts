import type { Id, Point, Rectangle } from "@evavo/adventure-project-schema";
import {
  type AdventureCreativeFramePlanV3,
  type AdventureCreativeTaskKindV3,
  type AdventureCreativeWorkOrderV3,
  validateAdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

export interface NinthReliquaryCreativeAuthoritiesV3 {
  readonly projectId?: string;
  readonly sourceRevisionDigest: string;
  readonly styleDigest: string;
  readonly paletteDigest: string;
  readonly environmentLayoutDigest: string;
  readonly modelSheetDigest: string;
  readonly xSheetDigest: string;
  readonly referenceDigests?: readonly string[];
}

const neighbourIds = (frameIds: readonly string[], index: number, loop: boolean): readonly string[] => {
  const neighbours: string[] = [];
  const previous = index === 0 ? (loop ? frameIds.at(-1) : undefined) : frameIds[index - 1];
  const next = index === frameIds.length - 1 ? (loop ? frameIds[0] : undefined) : frameIds[index + 1];
  if (previous) neighbours.push(previous);
  if (next) neighbours.push(next);
  return neighbours;
};

const walkFrameIds = Array.from({ length: 10 }, (_, index) => `walk-east.${String(index + 1).padStart(2, "0")}`);
const walkRoles: readonly AdventureCreativeFramePlanV3["role"][] = [
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
const walkExposures = [3, 2, 2, 2, 3, 2, 2, 2, 3, 2] as const;

export const ninthReliquaryWalkFramePlanV3: readonly AdventureCreativeFramePlanV3[] = walkFrameIds.map(
  (frameId, index) => ({
    frameId,
    role: walkRoles[index] ?? "inbetween",
    exposureTicks: walkExposures[index] ?? 2,
    sourceRect: { x: index * 96, y: 0, width: 96, height: 192 },
    pivot: { x: 48, y: 178 },
    footPoint: { x: 48, y: 178 },
    handAnchors: { primary: { x: 56, y: 88 } },
    shadowAnchor: { x: 48, y: 180 },
    requiredNeighbourFrameIds: neighbourIds(walkFrameIds, index, true),
  }),
);

const inspectFrameIds = ["inspect.01", "inspect.02", "inspect.03", "inspect.04", "inspect.05", "inspect.06"] as const;
export const ninthReliquaryInspectFramePlanV3: readonly AdventureCreativeFramePlanV3[] = inspectFrameIds.map(
  (frameId, index) => ({
    frameId,
    role: index === 0 || index === inspectFrameIds.length - 1 ? "hold" : index === 3 ? "extreme" : "breakdown",
    exposureTicks: index === 3 ? 4 : 3,
    sourceRect: { x: index * 112, y: 0, width: 112, height: 192 },
    pivot: { x: 56, y: 178 },
    footPoint: { x: 56, y: 178 },
    handAnchors: { primary: { x: 65 + index * 2, y: 92 - index * 3 } },
    shadowAnchor: { x: 56, y: 180 },
    requiredNeighbourFrameIds: neighbourIds(inspectFrameIds, index, false),
  }),
);

const cutawayFrameIds = ["chapel-cutaway.01", "chapel-cutaway.02", "chapel-cutaway.03", "chapel-cutaway.04"] as const;
export const ninthReliquaryCutawayFramePlanV3: readonly AdventureCreativeFramePlanV3[] = cutawayFrameIds.map(
  (frameId, index) => ({
    frameId,
    role: index === 0 || index === cutawayFrameIds.length - 1 ? "hold" : "breakdown",
    exposureTicks: index === 0 ? 8 : index === 3 ? 10 : 5,
    requiredNeighbourFrameIds: neighbourIds(cutawayFrameIds, index, false),
  }),
);

const commonReview = [
  "Compare against the exact previous approved artifact and immutable style authority, not a memory of the style.",
  "Reject identity, proportion, costume, palette, perspective or layout drift even when the isolated candidate is attractive.",
  "For transparent work, inspect decoded alpha on black, white, grey, green and magenta hostile plates and reject checkerboard pixels, matte residue, halos or contaminated hidden RGB.",
] as const;

const commonRejection = [
  "Reject fake checkerboard transparency or any opaque background presented as alpha.",
  "Reject unexplained crop, canvas-size or source-reference changes.",
  "Reject generic anime facial shorthand that breaks the approved original character model.",
  "Reject whole-asset regeneration when a bounded targeted repair can close the documented issue.",
] as const;

const buildOrder = (input: {
  readonly workOrderId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly destinationStudio: AdventureCreativeWorkOrderV3["destinationStudio"];
  readonly taskKind: AdventureCreativeTaskKindV3;
  readonly revision: number;
  readonly sourceRevisionDigest: string;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: AdventureCreativeWorkOrderV3["alphaPolicy"];
  readonly authorities: AdventureCreativeWorkOrderV3["authorities"];
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
  readonly artDirection: readonly string[];
  readonly reviewChecklist?: readonly string[];
  readonly rejectionRules?: readonly string[];
  readonly framePlan?: readonly AdventureCreativeFramePlanV3[];
  readonly loopClosureReviewRequired?: boolean;
}): AdventureCreativeWorkOrderV3 => {
  const alphaRequired = input.alphaPolicy !== "opaque";
  const animation = input.taskKind === "animation-sequence" || input.taskKind === "cutscene-shot" || input.taskKind === "effects-sequence";
  const order: AdventureCreativeWorkOrderV3 = {
    contractVersion: 3,
    workOrderId: input.workOrderId,
    projectId: input.projectId,
    assetId: input.assetId,
    destinationStudio: input.destinationStudio,
    taskKind: input.taskKind,
    revision: input.revision,
    ...(input.revision > 1 ? { replacesRevision: input.revision - 1 } : {}),
    sourceRevisionDigest: input.sourceRevisionDigest,
    nativeSize: input.nativeSize,
    alphaPolicy: input.alphaPolicy,
    preserveNativeCanvas: true,
    authorities: {
      ...input.authorities,
      referenceDigests: [...new Set(input.authorities.referenceDigests)].sort((left, right) => left.localeCompare(right)),
    },
    invariants: input.invariants,
    forbiddenDrift: input.forbiddenDrift,
    artDirection: input.artDirection,
    reviewChecklist: input.reviewChecklist ?? commonReview,
    rejectionRules: [...commonRejection, ...(input.rejectionRules ?? [])],
    ...(input.framePlan ? { framePlan: input.framePlan } : {}),
    ...(animation
      ? {
          sequencePolicy: {
            independentFrameGenerationForbidden: true,
            exactExposureTimingRequired: true,
            modelSheetConformanceRequired: true,
            xSheetConformanceRequired: true,
            immediateNeighbourReviewRequired: true,
            loopClosureReviewRequired: input.loopClosureReviewRequired ?? false,
          },
        }
      : {}),
    transparencyPolicy: {
      checkerboardForbidden: true,
      decodedAlphaRequired: alphaRequired,
      transparentCanvasEdgeRequired: alphaRequired,
      matteResidueForbidden: true,
      haloFringeForbidden: true,
      transparentRgbContaminationForbidden: true,
      hostilePlateReviewRequired: alphaRequired,
    },
    iterationPolicy: {
      maximumRevisionPasses: 6,
      compareAgainstPreviousApproved: true,
      requireIssueClosureEvidence: true,
      preferTargetedRepair: true,
      fullRegenerationRequiresExplicitReason: true,
    },
    requestedRepairs: [],
  };
  const issues = validateAdventureCreativeWorkOrderV3(order);
  if (issues.length > 0) throw new Error(`Invalid Ninth Reliquary v3 work order: ${issues.map((issue) => issue.message).join(" ")}`);
  return order;
};

export interface NinthReliquaryCreativeProofV3 {
  readonly squareLayout: AdventureCreativeWorkOrderV3;
  readonly squareBackground: AdventureCreativeWorkOrderV3;
  readonly squareForeground: AdventureCreativeWorkOrderV3;
  readonly maraModelSheet: AdventureCreativeWorkOrderV3;
  readonly maraWalkEast: AdventureCreativeWorkOrderV3;
  readonly maraInspect: AdventureCreativeWorkOrderV3;
  readonly chapelCutaway: AdventureCreativeWorkOrderV3;
}

export const compileNinthReliquaryCreativeProofV3 = (
  authority: NinthReliquaryCreativeAuthoritiesV3,
  revision = 1,
): NinthReliquaryCreativeProofV3 => {
  const projectId = authority.projectId ?? "project.ninth-reliquary-proof";
  const references = authority.referenceDigests ?? [];
  const baseAuthorities = {
    profileId: "cinematic-handdrawn-conspiracy",
    styleDigest: authority.styleDigest,
    paletteDigest: authority.paletteDigest,
    referenceDigests: references,
  } as const;
  const environmentAuthorities = {
    ...baseAuthorities,
    environmentLayoutDigest: authority.environmentLayoutDigest,
  };
  const animationAuthorities = {
    ...baseAuthorities,
    modelSheetDigest: authority.modelSheetDigest,
    xSheetDigest: authority.xSheetDigest,
  };

  return {
    squareLayout: buildOrder({
      workOrderId: "creative.ninth-reliquary.square.layout.v3",
      projectId,
      assetId: "asset.ninth-reliquary.square.layout",
      destinationStudio: "art-studio",
      taskKind: "background-layout",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
      authorities: baseAuthorities,
      invariants: [
        "Playable walk lane, café entrance, archive sightline and foreground occlusion zones remain readable at native 640×360.",
        "Perspective and architecture remain coherent across the whole room; no locally plausible but globally impossible façade geometry.",
      ],
      forbiddenDrift: ["camera height", "vanishing structure", "café entrance position", "archive sightline", "walk lane width"],
      artDirection: [
        "Original contemporary European old-city square after rain, combining animated-feature layout discipline with modern clean anime-adjacent shape economy.",
        "Make the place observational and specific: believable shopfront proportions, drainage, street furniture, window rhythm, masonry repair and a readable café threshold.",
        "Do not copy a Broken Sword location, character, composition or landmark; the influence is the seriousness of layout craft and cinematic readability, not protected design content.",
      ],
    }),
    squareBackground: buildOrder({
      workOrderId: "creative.ninth-reliquary.square.background.v3",
      projectId,
      assetId: "asset.ninth-reliquary.square.background",
      destinationStudio: "art-studio",
      taskKind: "background-paint",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
      authorities: environmentAuthorities,
      invariants: [
        "Approved layout geometry remains unchanged.",
        "Clue-bearing architecture and exits remain readable before decorative texture.",
        "Painted gradients and texture stay subordinate to shape hierarchy and interaction readability.",
      ],
      forbiddenDrift: ["layout geometry", "vanishing points", "exit positions", "clue silhouettes", "light direction"],
      artDirection: [
        "Hand-painted environment with clean shape grouping, restrained surface texture and motivated wet-street reflections.",
        "Use modern cel/anime-adjacent colour clarity without generic glossy anime city styling, bloom or concept-art noise.",
        "Preserve distinct foreground/midground/background value groups so characters read without a universal outline.",
      ],
    }),
    squareForeground: buildOrder({
      workOrderId: "creative.ninth-reliquary.square.foreground.v3",
      projectId,
      assetId: "asset.ninth-reliquary.square.foreground-awning",
      destinationStudio: "art-studio",
      taskKind: "foreground-plate",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "required",
      authorities: environmentAuthorities,
      invariants: [
        "Only the authored awning/sign/near masonry occlusion pixels are opaque; every other pixel is genuinely transparent.",
        "Foreground plate registration matches the approved background exactly at native resolution.",
      ],
      forbiddenDrift: ["plate registration", "awning silhouette", "sign position", "edge colour", "light direction"],
      artDirection: [
        "Isolate only the foreground geometry required for character occlusion and cinematic depth.",
        "Preserve the background's exact painted edge language while keeping transparent RGB clean enough for hostile-plate review.",
      ],
    }),
    maraModelSheet: buildOrder({
      workOrderId: "creative.ninth-reliquary.mara.model-sheet.v3",
      projectId,
      assetId: "asset.ninth-reliquary.mara.model-sheet",
      destinationStudio: "cel-animation-studio",
      taskKind: "character-model-sheet",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 1024, height: 768 },
      alphaPolicy: "opaque",
      authorities: baseAuthorities,
      invariants: [
        "Adult restoration researcher with consistent head construction, facial landmarks, hand scale, footwear, shoulder width, hair mass, bag silhouette and costume seams across all views.",
        "Character remains original and cannot drift toward a named anime/adventure character or generic large-eye template.",
      ],
      forbiddenDrift: ["head proportion", "eye spacing", "nose construction", "hair mass", "jacket seams", "bag silhouette", "hand scale", "leg length"],
      artDirection: [
        "Natural adult proportions with clean cel line economy and expressive but restrained facial construction.",
        "Anime-adjacent means disciplined shape design, clear silhouettes and efficient facial/hand construction; avoid childlike proportions, giant eyes or fashion-illustration anatomy.",
      ],
    }),
    maraWalkEast: buildOrder({
      workOrderId: "creative.ninth-reliquary.mara.walk-east.v3",
      projectId,
      assetId: "asset.ninth-reliquary.mara.walk-east",
      destinationStudio: "cel-animation-studio",
      taskKind: "animation-sequence",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 960, height: 192 },
      alphaPolicy: "required",
      authorities: animationAuthorities,
      invariants: [
        "Ten authored drawings preserve the approved model sheet, planted foot contacts, stable ground plane and restrained vertical bob.",
        "Every drawing is reviewed against immediate neighbours; no independently regenerated frame may redefine face, hair, hands, costume or body mass.",
      ],
      forbiddenDrift: ["identity", "body height", "torso width", "foot contact", "hand scale", "hair mass", "jacket seams", "frame order", "exposure timing"],
      artDirection: [
        "Grounded contemporary walk with adult weight transfer and controlled hand/shoulder counter-motion.",
        "Use clean cel drawings and intentional holds/exposures; do not chase 60-fps smoothness by inventing unreviewed in-betweens.",
      ],
      framePlan: ninthReliquaryWalkFramePlanV3,
      loopClosureReviewRequired: true,
    }),
    maraInspect: buildOrder({
      workOrderId: "creative.ninth-reliquary.mara.inspect.v3",
      projectId,
      assetId: "asset.ninth-reliquary.mara.inspect",
      destinationStudio: "cel-animation-studio",
      taskKind: "animation-sequence",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 672, height: 192 },
      alphaPolicy: "required",
      authorities: animationAuthorities,
      invariants: [
        "Feet remain planted while upper-body reach, gaze and hand position communicate careful evidence inspection.",
        "Start/end holds match the gameplay idle construction closely enough for a clean state transition.",
      ],
      forbiddenDrift: ["foot position", "identity", "hand size", "gaze direction", "shoulder width", "exposure timing"],
      artDirection: [
        "Subtle evidence-inspection performance: anticipatory gaze, small torso lean, deliberate hand reach, short reading hold, controlled return.",
        "Preserve practical adult body mechanics rather than exaggerated anime reaction posing.",
      ],
      framePlan: ninthReliquaryInspectFramePlanV3,
    }),
    chapelCutaway: buildOrder({
      workOrderId: "creative.ninth-reliquary.chapel-cutaway.v3",
      projectId,
      assetId: "asset.ninth-reliquary.chapel-cutaway",
      destinationStudio: "cel-animation-studio",
      taskKind: "cutscene-shot",
      revision,
      sourceRevisionDigest: authority.sourceRevisionDigest,
      nativeSize: { width: 640, height: 360 },
      alphaPolicy: "opaque",
      authorities: animationAuthorities,
      invariants: [
        "Cutaway reads as a hard authored editorial insert and returns cleanly to gameplay state; it is not a free-running decorative video.",
        "Character construction and chapel layout remain bound to approved authorities throughout the shot.",
      ],
      forbiddenDrift: ["character identity", "chapel layout", "camera intent", "shot order", "exposure timing"],
      artDirection: [
        "Four-beat chapel discovery insert: establish reliquary alcove, controlled hand reveal, symbol recognition hold, return-look before gameplay resumes.",
        "Use held drawings and small controlled camera/cel changes rather than excessive motion; cinematic force should come from composition and timing.",
      ],
      framePlan: ninthReliquaryCutawayFramePlanV3,
    }),
  };
};
