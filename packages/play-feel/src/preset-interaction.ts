import type { AdventurePlayFeelProfile } from "./types.js";
import { baseProfile, sharedInput, sharedPresentation } from "./preset-factory.js";

export const interactionPlayFeelProfiles: readonly AdventurePlayFeelProfile[] = [
  baseProfile({
    id: "verb-panel-responsive",
    label: "Verb Panel Responsive",
    summary:
      "Responsive command construction, brisk route replacement, " +
      "distance-synchronised walking and short feedback loops.",
    logicalTicksPerSecond: 60,
    movement: {
      topSpeedPixelsPerSecond: 53,
      accelerationPixelsPerSecondSquared: 430,
      decelerationPixelsPerSecondSquared: 500,
      minimumStartSpeedPixelsPerSecond: 16,
      arrivalSpeedPixelsPerSecond: 9,
      arrivalRadiusPixels: 0.25,
      turnSlowdownDegrees: 68,
      turnSpeedMultiplier: 0.78,
      quantization: "subpixel",
      retargetPolicy: "replace-immediately",
    },
    animation: {
      phaseMode: "distance",
      pixelsPerWalkCycle: 18,
      footfallPhases: [0.22, 0.72],
      startPoseTicks: 1,
      turnPoseTicks: 1,
      arrivalPoseTicks: 2,
      actionAnticipationTicks: 2,
      actionRecoveryTicks: 3,
      minimumIdleTicks: 16,
    },
    camera: {
      mode: "fixed",
      deadZone: { left: 0.26, right: 0.74, top: 0.22, bottom: 0.78 },
      maximumSpeedPixelsPerSecond: 96,
      accelerationPixelsPerSecondSquared: 520,
      lookAheadPixels: 0,
      settleTicks: 2,
      quantization: "native-pixel",
    },
    input: {
      hoverCommitTicks: 0,
      doubleActivationWindowTicks: 14,
      commandBufferTicks: 16,
      dragThresholdNativePixels: 3,
    },
    presentation: {
      ...sharedPresentation,
      renderInterpolation: "camera-only",
      statusMinimumTicks: 28,
      sceneFadeOutTicks: 10,
      sceneDarkHoldTicks: 3,
      sceneFadeInTicks: 12,
    },
    authenticityRules: [
      "Update the sentence line before execution so the player can verify intent.",
      "Allow route replacement without losing queued object-command identity.",
    ],
    prohibitedShortcuts: [
      "Do not infer a different verb after the sentence line has committed.",
      "Do not use hover delays that make the verb panel feel detached from the cursor.",
    ],
    reviewQuestions: [
      "Does the executed command always match the visible sentence line?",
      "Can a player redirect movement without creating stale pending actions?",
    ],
  }),
  baseProfile({
    id: "pulp-grounded",
    label: "Pulp Grounded",
    summary:
      "Grounded exploration speed, practical object handling, readable route " +
      "decisions and controlled travel transitions.",
    logicalTicksPerSecond: 60,
    movement: {
      topSpeedPixelsPerSecond: 47,
      accelerationPixelsPerSecondSquared: 275,
      decelerationPixelsPerSecondSquared: 350,
      minimumStartSpeedPixelsPerSecond: 11,
      arrivalSpeedPixelsPerSecond: 7,
      arrivalRadiusPixels: 0.2,
      turnSlowdownDegrees: 58,
      turnSpeedMultiplier: 0.67,
      quantization: "subpixel",
      retargetPolicy: "finish-current-segment",
    },
    animation: {
      phaseMode: "distance",
      pixelsPerWalkCycle: 20,
      footfallPhases: [0.2, 0.7],
      startPoseTicks: 3,
      turnPoseTicks: 2,
      arrivalPoseTicks: 3,
      actionAnticipationTicks: 4,
      actionRecoveryTicks: 5,
      minimumIdleTicks: 24,
    },
    camera: {
      mode: "dead-zone-follow",
      deadZone: { left: 0.34, right: 0.66, top: 0.26, bottom: 0.72 },
      maximumSpeedPixelsPerSecond: 82,
      accelerationPixelsPerSecondSquared: 300,
      lookAheadPixels: 12,
      settleTicks: 4,
      quantization: "native-pixel",
    },
    input: { ...sharedInput, commandBufferTicks: 12 },
    presentation: {
      ...sharedPresentation,
      renderInterpolation: "camera-only",
      statusMinimumTicks: 34,
      sceneFadeOutTicks: 12,
      sceneDarkHoldTicks: 4,
      sceneFadeInTicks: 14,
    },
    authenticityRules: [
      "Keep route, evidence and companion response readable as separate beats.",
      "Use camera follow only where room width genuinely exceeds the native viewport.",
    ],
    prohibitedShortcuts: [
      "Do not let camera smoothing move interactive geometry away from native hit coordinates.",
      "Do not use continuous camera drift in rooms composed as fixed shots.",
    ],
    reviewQuestions: [
      "Does the camera settle before a precision interaction begins?",
      "Do practical object actions have clear anticipation and recovery?",
    ],
  }),
] as const;
