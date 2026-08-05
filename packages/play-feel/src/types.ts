export interface AdventureNativePoint {
  readonly x: number;
  readonly y: number;
}

export interface AdventureNativeSize {
  readonly width: number;
  readonly height: number;
}

export interface AdventureNormalizedDeadZone {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export type AdventurePlayFeelProfileId =
  | "classic-balanced"
  | "storybook-deliberate"
  | "comic-snappy"
  | "gothic-measured"
  | "verb-panel-responsive"
  | "pulp-grounded"
  | "cinematic-directed"
  | "noir-restrained";

export type AdventureProductionProfileReference =
  | "storybook-icon-vga"
  | "comic-scifi-icon-vga"
  | "gothic-investigation-vga"
  | "verb-panel-cartoon-vga"
  | "pulp-archaeology-vga"
  | "cinematic-pulp-vga"
  | "neo-noir-lowres";

export type AdventureNativeQuantization = "native-pixel" | "subpixel";
export type AdventureRetargetPolicy =
  | "replace-immediately"
  | "cancel-and-settle"
  | "finish-current-segment";
export type AdventureWalkPhaseMode = "distance";
export type AdventureCameraMode = "fixed" | "dead-zone-follow" | "shot-led";
export type AdventureRenderInterpolation = "none" | "camera-only";
export type AdventureMotionPhase =
  | "starting"
  | "moving"
  | "cornering"
  | "arriving"
  | "arrived";
export type AdventureFootfall = "left" | "right" | null;

export interface AdventureMovementFeel {
  readonly topSpeedPixelsPerSecond: number;
  readonly accelerationPixelsPerSecondSquared: number;
  readonly decelerationPixelsPerSecondSquared: number;
  readonly minimumStartSpeedPixelsPerSecond: number;
  readonly arrivalSpeedPixelsPerSecond: number;
  readonly arrivalRadiusPixels: number;
  readonly turnSlowdownDegrees: number;
  readonly turnSpeedMultiplier: number;
  readonly quantization: AdventureNativeQuantization;
  readonly retargetPolicy: AdventureRetargetPolicy;
}

export interface AdventureAnimationFeel {
  readonly phaseMode: AdventureWalkPhaseMode;
  readonly pixelsPerWalkCycle: number;
  readonly footfallPhases: readonly [number, number];
  readonly startPoseTicks: number;
  readonly turnPoseTicks: number;
  readonly arrivalPoseTicks: number;
  readonly actionAnticipationTicks: number;
  readonly actionRecoveryTicks: number;
  readonly minimumIdleTicks: number;
}

export interface AdventureCameraFeel {
  readonly mode: AdventureCameraMode;
  readonly deadZone: AdventureNormalizedDeadZone;
  readonly maximumSpeedPixelsPerSecond: number;
  readonly accelerationPixelsPerSecondSquared: number;
  readonly lookAheadPixels: number;
  readonly settleTicks: number;
  readonly quantization: AdventureNativeQuantization;
}

export interface AdventureInputFeel {
  readonly hoverCommitTicks: number;
  readonly doubleActivationWindowTicks: number;
  readonly commandBufferTicks: number;
  readonly dragThresholdNativePixels: number;
}

export interface AdventurePresentationFeel {
  readonly renderInterpolation: AdventureRenderInterpolation;
  readonly maximumCatchUpTicks: number;
  readonly maximumFrameDeltaMilliseconds: number;
  readonly statusMinimumTicks: number;
  readonly sceneFadeOutTicks: number;
  readonly sceneDarkHoldTicks: number;
  readonly sceneFadeInTicks: number;
}

export interface AdventurePlayFeelProfile {
  readonly profileVersion: 1;
  readonly id: AdventurePlayFeelProfileId;
  readonly label: string;
  readonly summary: string;
  readonly logicalTicksPerSecond: number;
  readonly movement: AdventureMovementFeel;
  readonly animation: AdventureAnimationFeel;
  readonly camera: AdventureCameraFeel;
  readonly input: AdventureInputFeel;
  readonly presentation: AdventurePresentationFeel;
  readonly authenticityRules: readonly string[];
  readonly prohibitedShortcuts: readonly string[];
  readonly reviewQuestions: readonly string[];
}

export type AdventurePlayFeelIssueSeverity = "error" | "warning" | "note";

export interface AdventurePlayFeelIssue {
  readonly severity: AdventurePlayFeelIssueSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface AdventurePlayFeelAuditInput {
  readonly logicalTicksPerSecond?: number;
  readonly pixelMotionPolicy?: "strict" | "camera-strict" | "free";
  readonly renderInterpolation?: AdventureRenderInterpolation;
}

export interface AdventurePlayFeelAuditReport {
  readonly reportVersion: 1;
  readonly profileId: AdventurePlayFeelProfileId;
  readonly status: "ready" | "attention" | "blocked";
  readonly score: number;
  readonly issues: readonly AdventurePlayFeelIssue[];
}

export interface AdventureKinematicRoute {
  readonly points: readonly AdventureNativePoint[];
  readonly segmentLengthsMicropixels: readonly number[];
  readonly cumulativeMicropixels: readonly number[];
  readonly totalMicropixels: number;
}

export interface AdventureMotionState {
  readonly stateVersion: 1;
  readonly tick: number;
  readonly phase: AdventureMotionPhase;
  readonly distanceMicropixels: number;
  readonly velocityMicropixelsPerSecond: number;
  readonly distanceRemainder: number;
  readonly segmentIndex: number;
  readonly distanceAlongSegmentMicropixels: number;
  readonly position: AdventureNativePoint;
  readonly unquantizedPosition: AdventureNativePoint;
  readonly walkCyclePhase: number;
}

export interface AdventureMotionAdvance {
  readonly state: AdventureMotionState;
  readonly crossedSegmentIndexes: readonly number[];
  readonly distanceAdvancedPixels: number;
  readonly arrived: boolean;
  readonly footfall: AdventureFootfall;
}

export interface AdventureMotionRuntimeTuning {
  readonly topSpeedPixelsPerSecond?: number;
}

export interface AdventureMotionTraceSample {
  readonly tick: number;
  readonly phase: AdventureMotionPhase;
  readonly position: AdventureNativePoint;
  readonly unquantizedPosition: AdventureNativePoint;
  readonly velocityPixelsPerSecond: number;
  readonly distancePixels: number;
  readonly walkCyclePhase: number;
  readonly footfall: AdventureFootfall;
}

export interface AdventureMotionTrace {
  readonly profileId: AdventurePlayFeelProfileId;
  readonly route: AdventureKinematicRoute;
  readonly samples: readonly AdventureMotionTraceSample[];
  readonly arrivalTick: number;
}

export interface AdventureCameraState {
  readonly stateVersion: 1;
  readonly tick: number;
  readonly position: AdventureNativePoint;
  readonly unquantizedPosition: AdventureNativePoint;
  readonly velocityPixelsPerSecond: AdventureNativePoint;
  readonly settledTicks: number;
}

export interface AdventureCameraTarget {
  readonly position: AdventureNativePoint;
  readonly velocityPixelsPerSecond?: AdventureNativePoint;
  readonly shotPosition?: AdventureNativePoint;
}

export interface AdventureCameraAdvance {
  readonly state: AdventureCameraState;
  readonly desiredPosition: AdventureNativePoint;
  readonly moved: boolean;
}

export interface AdventureFramePacingState {
  readonly logicalTick: number;
  readonly remainderMilliseconds: number;
  readonly totalDroppedMilliseconds: number;
}

export interface AdventureFramePacingAdvance {
  readonly state: AdventureFramePacingState;
  readonly ticksToRun: number;
  readonly interpolationAlpha: number;
  readonly droppedMilliseconds: number;
  readonly presentationTick: number;
}

export interface AdventureMotionRuntimeExtension {
  readonly extensionVersion: 1;
  readonly profileId: AdventurePlayFeelProfileId;
  readonly routeFingerprint: string;
  readonly motion: AdventureMotionState;
}
