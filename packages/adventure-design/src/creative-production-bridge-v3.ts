import type {
  AdventureCreativeRepairScopeV3,
  AdventureCreativeTaskKindV3,
  AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";
import { validateAdventureCreativeWorkOrderV3 } from "./creative-production-handoff-v3.js";

const artTaskKinds = new Set<AdventureCreativeTaskKindV3>([
  "background-layout",
  "background-paint",
  "foreground-plate",
  "prop",
  "ui-art",
  "portrait-closeup",
]);
const celTaskKinds = new Set<AdventureCreativeTaskKindV3>([
  "character-model-sheet",
  "character-key-pose",
  "animation-sequence",
  "cutscene-shot",
  "effects-sequence",
]);

export interface AdventureArtStudioProductionRequestV3 {
  readonly requestVersion: 3;
  readonly workOrderId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly taskKind: "background-layout" | "background-paint" | "foreground-plate" | "prop" | "ui-art" | "portrait-closeup";
  readonly revision: number;
  readonly nativeSize: AdventureCreativeWorkOrderV3["nativeSize"];
  readonly authorities: AdventureCreativeWorkOrderV3["authorities"];
  readonly alphaAdmission: {
    readonly required: boolean;
    readonly checkerboardForbidden: true;
    readonly decodedAlphaRequired: boolean;
    readonly transparentCanvasEdgeRequired: boolean;
    readonly hostilePlateReviewRequired: boolean;
    readonly rejectMatteResidue: true;
    readonly rejectHaloFringe: true;
    readonly rejectTransparentRgbContamination: true;
  };
  readonly targetedRepairs: readonly AdventureCreativeRepairScopeV3[];
  readonly preserveNativeCanvas: boolean;
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
  readonly artDirection: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly rejectionRules: readonly string[];
  readonly iterationPolicy: AdventureCreativeWorkOrderV3["iterationPolicy"];
}

export interface AdventureCelStudioProductionRequestV3 {
  readonly requestVersion: 3;
  readonly workOrderId: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly taskKind: "character-model-sheet" | "character-key-pose" | "animation-sequence" | "cutscene-shot" | "effects-sequence";
  readonly revision: number;
  readonly nativeSize: AdventureCreativeWorkOrderV3["nativeSize"];
  readonly authorities: AdventureCreativeWorkOrderV3["authorities"];
  readonly framePlan: NonNullable<AdventureCreativeWorkOrderV3["framePlan"]>;
  readonly targetedRepairs: readonly AdventureCreativeRepairScopeV3[];
  readonly sequencePolicy: AdventureCreativeWorkOrderV3["sequencePolicy"] | null;
  readonly alphaAdmission: AdventureArtStudioProductionRequestV3["alphaAdmission"];
  readonly invariants: readonly string[];
  readonly forbiddenDrift: readonly string[];
  readonly artDirection: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly rejectionRules: readonly string[];
  readonly iterationPolicy: AdventureCreativeWorkOrderV3["iterationPolicy"];
}

const alphaAdmission = (order: AdventureCreativeWorkOrderV3): AdventureArtStudioProductionRequestV3["alphaAdmission"] => {
  const required = order.alphaPolicy !== "opaque";
  return {
    required,
    checkerboardForbidden: true,
    decodedAlphaRequired: required,
    transparentCanvasEdgeRequired: required,
    hostilePlateReviewRequired: required,
    rejectMatteResidue: true,
    rejectHaloFringe: true,
    rejectTransparentRgbContamination: true,
  };
};

const assertValid = (order: AdventureCreativeWorkOrderV3): void => {
  const issues = validateAdventureCreativeWorkOrderV3(order);
  if (issues.length > 0) throw new Error(`Cannot bridge invalid creative work order: ${issues.map((issue) => issue.message).join(" ")}`);
};

export const compileArtStudioProductionRequestV3 = (
  order: AdventureCreativeWorkOrderV3,
): AdventureArtStudioProductionRequestV3 => {
  assertValid(order);
  if (order.destinationStudio !== "art-studio" || !artTaskKinds.has(order.taskKind)) {
    throw new Error(`Work order '${order.workOrderId}' is not an Art Studio v3 task.`);
  }
  return {
    requestVersion: 3,
    workOrderId: order.workOrderId,
    projectId: order.projectId,
    assetId: order.assetId,
    taskKind: order.taskKind as AdventureArtStudioProductionRequestV3["taskKind"],
    revision: order.revision,
    nativeSize: order.nativeSize,
    authorities: order.authorities,
    alphaAdmission: alphaAdmission(order),
    targetedRepairs: order.requestedRepairs,
    preserveNativeCanvas: order.preserveNativeCanvas,
    invariants: order.invariants,
    forbiddenDrift: order.forbiddenDrift,
    artDirection: order.artDirection,
    reviewChecklist: order.reviewChecklist,
    rejectionRules: order.rejectionRules,
    iterationPolicy: order.iterationPolicy,
  };
};

export const compileCelAnimationStudioProductionRequestV3 = (
  order: AdventureCreativeWorkOrderV3,
): AdventureCelStudioProductionRequestV3 => {
  assertValid(order);
  if (order.destinationStudio !== "cel-animation-studio" || !celTaskKinds.has(order.taskKind)) {
    throw new Error(`Work order '${order.workOrderId}' is not a Cel Animation Studio v3 task.`);
  }
  return {
    requestVersion: 3,
    workOrderId: order.workOrderId,
    projectId: order.projectId,
    assetId: order.assetId,
    taskKind: order.taskKind as AdventureCelStudioProductionRequestV3["taskKind"],
    revision: order.revision,
    nativeSize: order.nativeSize,
    authorities: order.authorities,
    framePlan: order.framePlan ?? [],
    targetedRepairs: order.requestedRepairs,
    sequencePolicy: order.sequencePolicy ?? null,
    alphaAdmission: alphaAdmission(order),
    invariants: order.invariants,
    forbiddenDrift: order.forbiddenDrift,
    artDirection: order.artDirection,
    reviewChecklist: order.reviewChecklist,
    rejectionRules: order.rejectionRules,
    iterationPolicy: order.iterationPolicy,
  };
};

export type AdventureStudioProductionRequestV3 =
  | { readonly destination: "art-studio"; readonly request: AdventureArtStudioProductionRequestV3 }
  | { readonly destination: "cel-animation-studio"; readonly request: AdventureCelStudioProductionRequestV3 };

export const compileAdventureStudioProductionRequestV3 = (
  order: AdventureCreativeWorkOrderV3,
): AdventureStudioProductionRequestV3 =>
  order.destinationStudio === "art-studio"
    ? { destination: "art-studio", request: compileArtStudioProductionRequestV3(order) }
    : { destination: "cel-animation-studio", request: compileCelAnimationStudioProductionRequestV3(order) };
