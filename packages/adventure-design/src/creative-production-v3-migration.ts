import type {
  AdventureCreativeTaskKind,
  AdventureCreativeWorkOrder,
} from "./creative-production-handoff.js";
import type {
  AdventureCreativeFramePlanV3,
  AdventureCreativeTaskKindV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

export interface AdventureCreativeV3MigrationOptions {
  readonly profileId: string;
  readonly environmentLayoutDigest?: string;
  readonly loopClosureReviewRequired?: boolean;
  readonly maximumRevisionPasses?: number;
}

const taskKindV3 = (kind: AdventureCreativeTaskKind): AdventureCreativeTaskKindV3 => {
  switch (kind) {
    case "background":
      return "background-paint";
    case "foreground-plate":
      return "foreground-plate";
    case "prop":
      return "prop";
    case "ui-art":
      return "ui-art";
    case "character-model-sheet":
      return "character-model-sheet";
    case "character-key-pose":
      return "character-key-pose";
    case "animation-sequence":
      return "animation-sequence";
  }
};

const isAnimation = (kind: AdventureCreativeTaskKindV3): boolean =>
  kind === "animation-sequence" || kind === "cutscene-shot" || kind === "effects-sequence";

const migrateFrames = (
  order: AdventureCreativeWorkOrder,
  loop: boolean,
): readonly AdventureCreativeFramePlanV3[] | undefined => {
  const frames = order.framePlan;
  if (!frames) return undefined;
  return frames.map((frame, index) => {
    const previous = index > 0 ? frames[index - 1] : loop ? frames.at(-1) : undefined;
    const next = index + 1 < frames.length ? frames[index + 1] : loop ? frames[0] : undefined;
    return {
      frameId: frame.frameId,
      role: frame.role,
      exposureTicks: frame.exposureTicks,
      ...(frame.sourceRect ? { sourceRect: frame.sourceRect } : {}),
      ...(frame.pivot ? { pivot: frame.pivot } : {}),
      ...(frame.footPoint ? { footPoint: frame.footPoint } : {}),
      ...(frame.handAnchor ? { handAnchors: { primary: frame.handAnchor } } : {}),
      ...(frame.shadowAnchor ? { shadowAnchor: frame.shadowAnchor } : {}),
      requiredNeighbourFrameIds: [previous?.frameId, next?.frameId].filter(
        (value): value is string => Boolean(value),
      ),
    } satisfies AdventureCreativeFramePlanV3;
  });
};

export const migrateAdventureCreativeWorkOrderV1ToV3 = (
  order: AdventureCreativeWorkOrder,
  options: AdventureCreativeV3MigrationOptions,
): AdventureCreativeWorkOrderV3 => {
  if (order.contractVersion !== 1) throw new Error("Legacy creative migration expects contractVersion=1.");
  if (!options.profileId.trim()) throw new Error("v3 migration requires a production profile ID.");
  const taskKind = taskKindV3(order.taskKind);
  const animated = isAnimation(taskKind);
  if (animated && !order.characterModelSheetDigest) {
    throw new Error(`Cannot migrate animation '${order.assetId}' to v3 without approved model-sheet authority.`);
  }
  if (animated && !order.xSheetDigest) {
    throw new Error(`Cannot migrate animation '${order.assetId}' to v3 without approved X-sheet authority.`);
  }
  const loop = options.loopClosureReviewRequired ?? animated;
  const framePlan = migrateFrames(order, loop);
  if (animated && (!framePlan || framePlan.length < 2)) {
    throw new Error(`Cannot migrate animation '${order.assetId}' to v3 without an authored frame plan.`);
  }
  const alphaRequired = order.alphaPolicy !== "opaque";
  return {
    contractVersion: 3,
    workOrderId: order.workOrderId,
    projectId: order.projectId,
    assetId: order.assetId,
    destinationStudio: order.destinationStudio,
    taskKind,
    revision: order.briefRevision,
    sourceRevisionDigest: order.sourceRevisionDigest,
    nativeSize: order.nativeSize,
    alphaPolicy: order.alphaPolicy,
    preserveNativeCanvas: order.preserveNativeCanvas,
    authorities: {
      profileId: options.profileId,
      styleDigest: order.visualStandardDigest,
      ...(order.styleBankDigest ? { paletteDigest: order.styleBankDigest } : {}),
      ...(order.characterModelSheetDigest
        ? { modelSheetDigest: order.characterModelSheetDigest }
        : {}),
      ...(options.environmentLayoutDigest
        ? { environmentLayoutDigest: options.environmentLayoutDigest }
        : {}),
      ...(order.xSheetDigest ? { xSheetDigest: order.xSheetDigest } : {}),
      referenceDigests: [...new Set(order.requiredReferenceDigests)].sort((a, b) => a.localeCompare(b)),
    },
    invariants: [
      "Preserve all approved v1 native geometry, identity and authored composition unless a v3 review issue explicitly targets it.",
      ...(animated
        ? ["Preserve v1 frame identity, order, exposure timing and anchor geometry during migration."]
        : []),
    ],
    forbiddenDrift: [
      "Do not reinterpret the legacy brief into a new visual design during migration.",
      "Do not replace real alpha with a painted transparency grid.",
      ...(animated ? ["Do not independently regenerate previously approved animation drawings."] : []),
    ],
    artDirection: order.artDirection,
    reviewChecklist: [
      "v1 authored direction preserved",
      "v3 style/reference authority bound",
      ...(alphaRequired ? ["decoded alpha and hostile-plate proof"] : []),
      ...(animated
        ? ["model-sheet conformance", "X-sheet timing", "neighbour continuity", "anchor stability"]
        : []),
    ],
    rejectionRules: order.rejectionRules,
    ...(framePlan ? { framePlan } : {}),
    ...(animated
      ? {
          sequencePolicy: {
            independentFrameGenerationForbidden: true,
            exactExposureTimingRequired: true,
            modelSheetConformanceRequired: true,
            xSheetConformanceRequired: true,
            immediateNeighbourReviewRequired: true,
            loopClosureReviewRequired: loop,
          },
        }
      : {}),
    transparencyPolicy: {
      checkerboardForbidden: true,
      decodedAlphaRequired: alphaRequired,
      transparentCanvasEdgeRequired: alphaRequired && order.canvasEdgeMustBeTransparent,
      matteResidueForbidden: true,
      haloFringeForbidden: true,
      transparentRgbContaminationForbidden: true,
      hostilePlateReviewRequired: alphaRequired,
    },
    iterationPolicy: {
      maximumRevisionPasses: options.maximumRevisionPasses ?? 5,
      compareAgainstPreviousApproved: true,
      requireIssueClosureEvidence: true,
      preferTargetedRepair: true,
      fullRegenerationRequiresExplicitReason: true,
    },
    requestedRepairs: [],
  };
};

export const migrateAdventureCreativePlanV1ToV3 = (
  workOrders: readonly AdventureCreativeWorkOrder[],
  options: AdventureCreativeV3MigrationOptions,
): readonly AdventureCreativeWorkOrderV3[] =>
  workOrders.map((workOrder) => migrateAdventureCreativeWorkOrderV1ToV3(workOrder, options));
