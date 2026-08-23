export interface IndexedPixelPalette {
  readonly entries: Uint8Array;
  readonly transparentIndex?: number | null;
}

export interface IndexedPixelSurface {
  readonly width: number;
  readonly height: number;
  readonly indices: Uint8Array;
}

const assertDimension = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return value;
};

const paletteEntryCount = (palette: IndexedPixelPalette): number => {
  if (palette.entries.length === 0 || palette.entries.length % 4 !== 0) {
    throw new RangeError("Indexed palette entries must contain complete RGBA quads.");
  }
  const count = palette.entries.length / 4;
  if (count > 256) {
    throw new RangeError("Indexed VGA palettes may contain at most 256 RGBA entries.");
  }
  if (
    palette.transparentIndex !== undefined &&
    palette.transparentIndex !== null &&
    (!Number.isSafeInteger(palette.transparentIndex) ||
      palette.transparentIndex < 0 ||
      palette.transparentIndex >= count)
  ) {
    throw new RangeError("Transparent palette index is outside the palette entry range.");
  }
  return count;
};

export const expandIndexedPixels = (
  surface: IndexedPixelSurface,
  palette: IndexedPixelPalette,
  paletteOffset = 0,
): Uint8Array => {
  const width = assertDimension(surface.width, "Indexed surface width");
  const height = assertDimension(surface.height, "Indexed surface height");
  if (surface.indices.length !== width * height) {
    throw new RangeError(
      `Indexed surface contains ${surface.indices.length} pixels; expected ${width * height}.`,
    );
  }
  if (!Number.isSafeInteger(paletteOffset) || paletteOffset < 0 || paletteOffset > 255) {
    throw new RangeError("Palette offset must be a safe integer from 0 to 255.");
  }

  const count = paletteEntryCount(palette);
  const output = new Uint8Array(surface.indices.length * 4);
  const transparentIndex = palette.transparentIndex ?? null;

  for (let pixel = 0; pixel < surface.indices.length; pixel += 1) {
    const sourceIndex = surface.indices[pixel] ?? 0;
    const resolvedIndex = sourceIndex + paletteOffset;
    if (resolvedIndex >= count) {
      throw new RangeError(
        `Indexed pixel ${pixel} resolves palette index ${resolvedIndex}; palette contains ${count} entries.`,
      );
    }
    const paletteByte = resolvedIndex * 4;
    const outputByte = pixel * 4;
    output[outputByte] = palette.entries[paletteByte] ?? 0;
    output[outputByte + 1] = palette.entries[paletteByte + 1] ?? 0;
    output[outputByte + 2] = palette.entries[paletteByte + 2] ?? 0;
    output[outputByte + 3] = transparentIndex === sourceIndex ? 0 : (palette.entries[paletteByte + 3] ?? 255);
  }

  return output;
};
