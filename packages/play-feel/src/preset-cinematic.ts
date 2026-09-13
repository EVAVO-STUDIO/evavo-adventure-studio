import { baseProfile, sharedInput, sharedPresentation } from "./preset-factory.js";
import type { AdventurePlayFeelProfile } from "./types.js";

export const cinematicPlayFeelProfiles: readonly AdventurePlayFeelProfile[] = [
  baseProfile({
    id: "cinematic-directed",
    label: "Cinematic Directed",
    summary:
      "Shot-led camera timing, controlled actor blocking, deliberate " +
      "transition beats and relationship-focused pauses.",
    logicalTicksPerSecond: 60,
    movement: {
      topSpeedPixelsPerSecond: 45,
      accelerationPixelsPerSecondSquared: 235,
      decelerationPixelsPerSecondSquared: 320,
      minimumStartSpeedPixelsPerSecond: 10,
      arrivalSpeedPixelsPerSecond: 6,
      arrivalRadiusPixels: 0.15,
      turnSlowdownDegrees: 54,
      turnSpeedMultiplier: 0.63,
      quantization: "subpixel",
      retargetPolicy: "finish-current-segment",
    },
    animation: {
      phaseMode: "distance",
      pixelsPerWalkCycle: 20,
      footfallPhases: [0.2, 0.7],
      startPoseTicks: 4,
      turnPoseTicks: 3,
      arrivalPoseTicks: 5,
      actionAnticipationTicks: 5,
      actionRecoveryTicks: 7,
      minimumIdleTicks: 34,
    },
    camera: {
      mode: "shot-led",
      deadZone: { left: 0.32, right: 0.68, top: 0.24, bottom: 0.74 },
      maximumSpeedPixelsPerSecond: 76,
      accelerationPixelsPerSecondSquared: 260,
      lookAheadPixels: 10,
      settleTicks: 5,
      quantization: "native-pixel",
    },
    input: { ...sharedInput, hoverCommitTicks: 1, commandBufferTicks: 10 },
    presentation: {
      ...sharedPresentation,
      renderInterpolation: "camera-only",
      statusMinimumTicks: 36,
      sceneFadeOutTicks: 8,
      sceneDarkHoldTicks: 2,
      sceneFadeInTicks: 10,
    },
    authenticityRules: [
      "Let authored sequence shots own the camera while canonical state remains tick-driven.",
      "Preserve blocking, eyelines and relationship beats across skip and replay.",
    ],
    prohibitedShortcuts: [
      "Do not replace shot design with a camera that continuously chases the player.",
      "Do not let cinematic presentation mutate story state outside sequence actions.",
    ],
    reviewQuestions: [
      "Does every camera move have a story or interaction purpose?",
      "Do watched and skipped sequences converge on identical canonical state?",
    ],
  }),
  baseProfile({
    id: "noir-restrained",
    label: "Noir Restrained",
    summary:
      "Sparse low-resolution motion, narrow camera response, long still " +
      "poses and precise minimal interaction feedback.",
    logicalTicksPerSecond: 60,
    movement: {
      topSpeedPixelsPerSecond: 37,
      accelerationPixelsPerSecondSquared: 150,
      decelerationPixelsPerSecondSquared: 215,
      minimumStartSpeedPixelsPerSecond: 6,
      arrivalSpeedPixelsPerSecond: 4,
      arrivalRadiusPixels: 0.15,
      turnSlowdownDegrees: 46,
      turnSpeedMultiplier: 0.52,
      quantization: "native-pixel",
      retargetPolicy: "cancel-and-settle",
    },
    animation: {
      phaseMode: "distance",
      pixelsPerWalkCycle: 22,
      footfallPhases: [0.2, 0.7],
      startPoseTicks: 5,
      turnPoseTicks: 4,
      arrivalPoseTicks: 5,
      actionAnticipationTicks: 4,
      actionRecoveryTicks: 7,
      minimumIdleTicks: 48,
    },
    camera: {
      mode: "dead-zone-follow",
      deadZone: { left: 0.38, right: 0.62, top: 0.3, bottom: 0.7 },
      maximumSpeedPixelsPerSecond: 58,
      accelerationPixelsPerSecondSquared: 175,
      lookAheadPixels: 6,
      settleTicks: 6,
      quantization: "native-pixel",
    },
    input: { ...sharedInput, hoverCommitTicks: 2, doubleActivationWindowTicks: 20 },
    presentation: {
      ...sharedPresentation,
      renderInterpolation: "none",
      statusMinimumTicks: 42,
      sceneFadeOutTicks: 6,
      sceneDarkHoldTicks: 5,
      sceneFadeInTicks: 9,
    },
    authenticityRules: [
      "Use stillness and negative space so small movement carries narrative weight.",
      "Keep minimal captions precise, persistent and tied to the attempted action.",
    ],
    prohibitedShortcuts: [
      "Do not add ambient motion to every surface merely to make the scene feel alive.",
      "Do not use neon camera bloom or smooth parallax as a substitute for composition.",
    ],
    reviewQuestions: [
      "Does each movement remain legible against a sparse low-colour background?",
      "Is every camera adjustment small enough to preserve negative-space composition?",
    ],
  }),
] as const;
