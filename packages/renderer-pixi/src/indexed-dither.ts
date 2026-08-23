import type { Point } from "@evavo/adventure-project-schema";
import type { IndexedPaletteDitherTransition } from "@evavo/adventure-render-contract";
import {
  type IndexedPixelPalette,
  type IndexedPixelSurface,
  expandIndexedPixels,
} from "./indexed-pixels.js";

const BAYER_2 = [0, 2, 3, 1] as const;
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
] as const;

const matrixFor = (
  matrix: IndexedPaletteDitherTransition["matrix"],
): { readonly size: number; readonly values: readonly number[] } => {
  switch (matrix) {
    case "bayer-2":
      return { size: 2, values: BAYER_2 };
    case "bayer-4":
      return { size: 4, values: BAYER_4 };
    case "bayer-8":
      return { size: 8, values: BAYER_8 };
  }
};

const assertCoverage = (coverage: number): number => {
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 1) {
    throw new RangeError("Indexed dither coverage must be from 0 to 1.");
  }
  return coverage;
};

const positiveModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;

export const quantizeIndexedDitherCoverage = (
  coverage: number,
  matrix: IndexedPaletteDitherTransition["matrix"],
): number => {
  const normalized = assertCoverage(coverage);
  const { size } = matrixFor(matrix);
  const states = size * size;
  return Math.round(normalized * states) / states;
};

export const normalizeIndexedDitherOrigin = (
  origin: Point,
  matrix: IndexedPaletteDitherTransition["matrix"],
): Point => {
  const { size } = matrixFor(matrix);
  return {
    x: positiveModulo(Math.floor(origin.x), size),
    y: positiveModulo(Math.floor(origin.y), size),
  };
};

export interface IndexedDitherExpansionOptions {
  readonly basePaletteOffset: number;
  readonly targetPaletteOffset: number;
  readonly coverage: number;
  readonly matrix: IndexedPaletteDitherTransition["matrix"];
  readonly originX?: number;
  readonly originY?: number;
}

export const expandDitheredIndexedPixels = (
  surface: IndexedPixelSurface,
  basePalette: IndexedPixelPalette,
  targetPalette: IndexedPixelPalette,
  options: IndexedDitherExpansionOptions,
): Uint8Array => {
  const coverage = quantizeIndexedDitherCoverage(options.coverage, options.matrix);
  if (coverage === 0) {
    return expandIndexedPixels(surface, basePalette, options.basePaletteOffset);
  }
  if (coverage === 1) {
    return expandIndexedPixels(surface, targetPalette, options.targetPaletteOffset);
  }

  const base = expandIndexedPixels(surface, basePalette, options.basePaletteOffset);
  const target = expandIndexedPixels(surface, targetPalette, options.targetPaletteOffset);
  const output = new Uint8Array(base.length);
  const { size, values } = matrixFor(options.matrix);
  const thresholdCount = size * size;
  const origin = normalizeIndexedDitherOrigin(
    { x: options.originX ?? 0, y: options.originY ?? 0 },
    options.matrix,
  );

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const matrixX = positiveModulo(x + origin.x, size);
      const matrixY = positiveModulo(y + origin.y, size);
      const thresholdIndex = matrixY * size + matrixX;
      const threshold = ((values[thresholdIndex] ?? 0) + 0.5) / thresholdCount;
      const source = coverage >= threshold ? target : base;
      const byte = (y * surface.width + x) * 4;
      output[byte] = source[byte] ?? 0;
      output[byte + 1] = source[byte + 1] ?? 0;
      output[byte + 2] = source[byte + 2] ?? 0;
      output[byte + 3] = source[byte + 3] ?? 0;
    }
  }

  return output;
};
