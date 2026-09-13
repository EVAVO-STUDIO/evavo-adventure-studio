import type {
  DynamixCinematicActionSequence,
  DynamixCinematicTimingContract,
  DynamixCinematicVisualContract,
} from "./dynamix-cinematic-types.js";

export const dynamixVisual = (
  panelLanguage: string,
  backgroundDoctrine: readonly string[],
  animationDoctrine: readonly string[],
): DynamixCinematicVisualContract => ({
  nativeWidth: 320,
  nativeHeight: 200,
  intendedDisplayAspect: "4:3",
  paletteMode: "indexed-8-bit",
  maxColours: 256,
  integerScale: true,
  textureSampling: "nearest",
  spriteTransparency: "binary",
  sceneConstruction: "native-first",
  panelLanguage,
  backgroundDoctrine,
  animationDoctrine,
  prohibitedShortcuts: [
    "Do not downsample a generic high-resolution concept image as the final background.",
    "Do not use linear filtering, fractional scaling or subpixel actor movement.",
    "Do not use bloom, motion blur, soft-alpha sprite edges or generic neon gradients.",
    "Do not distribute commercial art, dialogue, music, maps, characters or puzzle content.",
  ],
});

export const dynamixTiming = (
  clockMode: DynamixCinematicTimingContract["clockMode"],
  ticksPerGameMinute: number,
  values: Omit<
    DynamixCinematicTimingContract,
    "logicalTicksPerSecond" | "clockMode" | "ticksPerGameMinute"
  >,
): DynamixCinematicTimingContract => ({
  logicalTicksPerSecond: 60,
  clockMode,
  ticksPerGameMinute,
  ...values,
});

export const dynamixAction = (
  value: DynamixCinematicActionSequence,
): DynamixCinematicActionSequence => value;
