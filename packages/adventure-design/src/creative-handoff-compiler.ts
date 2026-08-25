import type { Actor, Id, SpriteFrame } from "@evavo/adventure-project-schema";
import {
  type AdventureCreativeAlphaPolicy,
  type AdventureCreativeFramePlan,
  type AdventureCreativeTaskKind,
  type AdventureCreativeWorkOrderV2,
  validateAdventureCreativeWorkOrderV2,
} from "./creative-handoff-v2.js";
import type { AdventureProductionProfile } from "./production-profile-types.js";

export interface AdventureCreativeAuthority {
  readonly sourceRevisionDigest: string;
  readonly styleDigest: string;
  readonly paletteDigest?: string;
  readonly modelSheetDigest?: string;
  readonly environmentLayoutDigest?: string;
  readonly referenceDigests?: readonly string[];
  readonly xSheetDigest?: string;
}

export interface AdventureStaticCreativeWorkOrderInput {
  readonly workOrderId: string;
  readonly projectId: Id<"project"> | string;
  readonly assetId: Id<"asset"> | string;
  readonly taskKind: Extract<AdventureCreativeTaskKind, "background" | "foreground-plate" | "prop" | "ui-art">;
  readonly revision: number;
  readonly replacesRevision?: number;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: AdventureCreativeAlphaPolicy;
  readonly profile: AdventureProductionProfile;
  readonly authority: AdventureCreativeAuthority;
  readonly artDirection?: readonly string[];
  readonly reviewChecklist?: readonly string[];
  readonly rejectionRules?: readonly string[];
}

export interface AdventureAnimationCreativeWorkOrderInput {
  readonly workOrderId: string;
  readonly projectId: Id<"project"> | string;
  readonly assetId: Id<"asset"> | string;
  readonly revision: number;
  readonly replacesRevision?: number;
  readonly nativeSize: { readonly width: number; readonly height: number };
  readonly alphaPolicy: AdventureCreativeAlphaPolicy;
  readonly profile: AdventureProductionProfile;
  readonly actor: Actor;
  readonly animationClipId: Id<"animation-clip">;
  readonly authority: AdventureCreativeAuthority & {
    readonly modelSheetDigest: string;
    readonly xSheetDigest: string;
  };
  readonly roleByFrameId?: Readonly<Record<string, AdventureCreativeFramePlan["role"]>>;
  readonly artDirection?: readonly string[];
  readonly reviewChecklist?: readonly string[];
  readonly rejectionRules?: readonly string[];
}

const stableUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));

const transparencyPolicy = (alphaPolicy: AdventureCreativeAlphaPolicy) => {
  const transparent = alphaPolicy !== "opaque";
  return {
    checkerboardForbidden: true as const,
    decodedAlphaRequired: transparent,
    transparentCanvasEdgeRequired: transparent,
    matteResidueForbidden: true as const,
    haloFringeForbidden: true as const,
    hostilePlateReviewRequired: transparent,
  };
};

const commonReview = (profile: AdventureProductionProfile): readonly string[] => [
  "Review the accepted master at native 1x scale and at intended player presentation scale.",
  "Compare against the exact approved style/reference digests rather than a textual style approximation.",
  "Verify native crop, silhouette, focal hierarchy and authored scene/character readability.",
  ...profile.reviewQuestions,
];

const commonRejections = (profile: AdventureProductionProfile): readonly string[] => [
  "Reject baked transparency grids, unproven matte removal, fringe halos or hidden background colour in transparent pixels.",
  "Reject generic AI-like microtexture, repeated details, fake signage/text or decorative elements that break authored navigation/readability.",
  ...profile.prohibitions,
];

const styleInvariants = (profile: AdventureProductionProfile): readonly string[] => [
  profile.summary,
  profile.scene.cameraDoctrine,
  profile.scene.focalHierarchy,
  profile.actors.silhouette,
  profile.actors.costumeDoctrine,
  profile.animation.cadence,
  ...profile.rules,
];

const assertValid = (order: AdventureCreativeWorkOrderV2): AdventureCreativeWorkOrderV2 => {
  const issues = validateAdventureCreativeWorkOrderV2(order);
  if (issues.length > 0) {
    throw new Error(`Compiled adventure creative work order is invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ")}`);
  }
  return order;
};

export const compileStaticAdventureCreativeWorkOrder = (
  input: AdventureStaticCreativeWorkOrderInput,
): AdventureCreativeWorkOrderV2 =>
  assertValid({
    contractVersion: 2,
    workOrderId: input.workOrderId,
    projectId: input.projectId,
    assetId: input.assetId,
    destinationStudio: "art-studio",
    taskKind: input.taskKind,
    revision: input.revision,
    ...(input.replacesRevision !== undefined ? { replacesRevision: input.replacesRevision } : {}),
    sourceRevisionDigest: input.authority.sourceRevisionDigest,
    nativeSize: input.nativeSize,
    alphaPolicy: input.alphaPolicy,
    preserveNativeCanvas: true,
    style: {
      profileId: input.profile.id,
      styleDigest: input.authority.styleDigest,
      ...(input.authority.paletteDigest ? { paletteDigest: input.authority.paletteDigest } : {}),
      ...(input.authority.environmentLayoutDigest ? { environmentLayoutDigest: input.authority.environmentLayoutDigest } : {}),
      referenceDigests: stableUnique(input.authority.referenceDigests ?? []),
      invariants: stableUnique(styleInvariants(input.profile)),
      forbiddenDrift: stableUnique(input.profile.prohibitions),
    },
    artDirection: stableUnique([
      input.profile.scene.stageLane,
      input.profile.scene.depthDoctrine,
      input.profile.scene.foregroundDoctrine,
      ...(input.artDirection ?? []),
    ]),
    reviewChecklist: stableUnique([...(commonReview(input.profile)), ...(input.reviewChecklist ?? [])]),
    rejectionRules: stableUnique([...(commonRejections(input.profile)), ...(input.rejectionRules ?? [])]),
    iterationPolicy: {
      maximumRevisionPasses: 6,
      compareAgainstPreviousApproved: input.revision > 1,
      requireIssueClosureEvidence: true,
    },
    transparencyPolicy: transparencyPolicy(input.alphaPolicy),
  });

const frameForId = (actor: Actor, frameId: Id<"sprite-frame">): SpriteFrame => {
  const frame = actor.frames.find((candidate) => candidate.id === frameId);
  if (!frame) throw new Error(`Actor '${actor.id}' animation references missing frame '${frameId}'.`);
  return frame;
};

const handAnchor = (frame: SpriteFrame) =>
  frame.attachmentPoints?.hand ??
  frame.attachmentPoints?.["right-hand"] ??
  frame.attachmentPoints?.["left-hand"];

const inferredFrameRole = (
  frame: SpriteFrame,
  index: number,
  count: number,
): AdventureCreativeFramePlan["role"] => {
  if (frame.events?.some((event) => /footfall|contact/iu.test(event))) return "contact";
  if (count === 1) return "hold";
  if (index === 0 || index === Math.floor(count / 2)) return "extreme";
  return "inbetween";
};

const neighbourIds = (
  frameIds: readonly Id<"sprite-frame">[],
  index: number,
  loop: boolean,
): readonly string[] => {
  const previous = index > 0 ? frameIds[index - 1] : loop ? frameIds.at(-1) : undefined;
  const next = index < frameIds.length - 1 ? frameIds[index + 1] : loop ? frameIds[0] : undefined;
  return stableUnique([previous, next].filter((value): value is Id<"sprite-frame"> => Boolean(value)));
};

export const compileAnimationAdventureCreativeWorkOrder = (
  input: AdventureAnimationCreativeWorkOrderInput,
): AdventureCreativeWorkOrderV2 => {
  const clip = input.actor.animations.find((candidate) => candidate.id === input.animationClipId);
  if (!clip) throw new Error(`Actor '${input.actor.id}' has no animation clip '${input.animationClipId}'.`);
  const frames = clip.frameIds.map((frameId) => frameForId(input.actor, frameId));
  const framePlan: AdventureCreativeFramePlan[] = frames.map((frame, index) => ({
    frameId: frame.id,
    role: input.roleByFrameId?.[frame.id] ?? inferredFrameRole(frame, index, frames.length),
    exposureTicks: frame.durationTicks,
    sourceRect: frame.sourceRect,
    pivot: frame.pivot,
    footPoint: frame.footPoint,
    ...(handAnchor(frame) ? { handAnchor: handAnchor(frame) } : {}),
    ...(frame.shadowAnchor ? { shadowAnchor: frame.shadowAnchor } : {}),
    requiredNeighbourFrameIds: neighbourIds(clip.frameIds, index, clip.loop),
  }));

  return assertValid({
    contractVersion: 2,
    workOrderId: input.workOrderId,
    projectId: input.projectId,
    assetId: input.assetId,
    destinationStudio: "cel-animation-studio",
    taskKind: "animation-sequence",
    revision: input.revision,
    ...(input.replacesRevision !== undefined ? { replacesRevision: input.replacesRevision } : {}),
    sourceRevisionDigest: input.authority.sourceRevisionDigest,
    nativeSize: input.nativeSize,
    alphaPolicy: input.alphaPolicy,
    preserveNativeCanvas: true,
    style: {
      profileId: input.profile.id,
      styleDigest: input.authority.styleDigest,
      ...(input.authority.paletteDigest ? { paletteDigest: input.authority.paletteDigest } : {}),
      modelSheetDigest: input.authority.modelSheetDigest,
      referenceDigests: stableUnique(input.authority.referenceDigests ?? []),
      invariants: stableUnique([
        ...styleInvariants(input.profile),
        input.profile.actors.performanceDoctrine,
        input.profile.animation.transitionDoctrine,
      ]),
      forbiddenDrift: stableUnique([
        ...input.profile.prohibitions,
        "Do not regenerate frames independently; preserve identity, costume construction, body mass and line treatment across immediate neighbours.",
      ]),
    },
    framePlan,
    loop: clip.loop,
    artDirection: stableUnique([
      input.profile.actors.portraitTreatment,
      input.profile.actors.performanceDoctrine,
      input.profile.animation.idleDoctrine,
      input.profile.animation.transitionDoctrine,
      ...(input.artDirection ?? []),
    ]),
    reviewChecklist: stableUnique([
      ...commonReview(input.profile),
      "Review every planned frame against both immediate neighbours using onion-skin or registered flip comparison.",
      "Verify exact exposureTicks, sourceRect, pivot, planted foot, shadow anchor and declared attachment anchors.",
      "For loops, inspect the final-to-first transition with the same scrutiny as every internal neighbour pair.",
      ...(input.reviewChecklist ?? []),
    ]),
    rejectionRules: stableUnique([
      ...commonRejections(input.profile),
      "Reject missing, duplicated, reordered or extra animation frames.",
      "Reject foot skating, pivot drift, body-mass drift, face/costume redesign or inconsistent cel line/colour between neighbouring drawings.",
      ...(input.rejectionRules ?? []),
    ]),
    iterationPolicy: {
      maximumRevisionPasses: 6,
      compareAgainstPreviousApproved: input.revision > 1,
      requireIssueClosureEvidence: true,
    },
    transparencyPolicy: transparencyPolicy(input.alphaPolicy),
    sequencePolicy: {
      independentFrameGenerationForbidden: true,
      neighbourConditioningRequired: true,
      modelSheetConformanceRequired: true,
      xSheetDigest: input.authority.xSheetDigest,
      xSheetConformanceRequired: true,
      loopClosureReviewRequired: clip.loop,
      exactExposureTimingRequired: true,
    },
  });
};
