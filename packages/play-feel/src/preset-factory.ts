import type { AdventurePlayFeelProfile } from "./types.js";

export const baseProfile = (
  input: Omit<AdventurePlayFeelProfile, "profileVersion">,
): AdventurePlayFeelProfile => ({ profileVersion: 1, ...input });

export const sharedInput = {
  hoverCommitTicks: 1,
  doubleActivationWindowTicks: 16,
  commandBufferTicks: 8,
  dragThresholdNativePixels: 3,
} as const;

export const sharedPresentation = {
  maximumCatchUpTicks: 5,
  maximumFrameDeltaMilliseconds: 120,
  statusMinimumTicks: 30,
  sceneFadeOutTicks: 12,
  sceneDarkHoldTicks: 4,
  sceneFadeInTicks: 16,
} as const;
