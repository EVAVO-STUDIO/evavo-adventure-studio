export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface PixelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const checkedPixelCount = (width: number, height: number): number => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError("RGBA image dimensions must be positive safe integers.");
  }

  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > Math.floor(Number.MAX_SAFE_INTEGER / 4)) {
    throw new RangeError("RGBA image dimensions are too large.");
  }
  return pixels;
};

export const assertRgbaImage = (image: RgbaImage): void => {
  const pixels = checkedPixelCount(image.width, image.height);
  if (image.data.byteLength !== pixels * 4) {
    throw new RangeError(
      `RGBA data length ${image.data.byteLength} does not match ${image.width} x ${image.height}.`,
    );
  }
};

export const cloneRgbaImage = (image: RgbaImage): RgbaImage => {
  assertRgbaImage(image);
  return {
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data),
  };
};

export const normalizeTransparentRgb = (image: RgbaImage): RgbaImage => {
  const normalized = cloneRgbaImage(image);

  for (let index = 0; index < normalized.data.length; index += 4) {
    if (normalized.data[index + 3] === 0) {
      normalized.data[index] = 0;
      normalized.data[index + 1] = 0;
      normalized.data[index + 2] = 0;
    }
  }

  return normalized;
};

const assertAlphaThreshold = (threshold: number): void => {
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) {
    throw new RangeError("Alpha threshold must be an integer from 0 to 255.");
  }
};

export const findAlphaBounds = (image: RgbaImage, threshold = 0): PixelBounds | null => {
  assertRgbaImage(image);
  assertAlphaThreshold(threshold);

  let minimumX = image.width;
  let minimumY = image.height;
  let maximumX = -1;
  let maximumY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha !== undefined && alpha > threshold) {
        minimumX = Math.min(minimumX, x);
        minimumY = Math.min(minimumY, y);
        maximumX = Math.max(maximumX, x);
        maximumY = Math.max(maximumY, y);
      }
    }
  }

  if (maximumX < minimumX || maximumY < minimumY) {
    return null;
  }

  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  };
};

export const fullImageBounds = (image: RgbaImage): PixelBounds => {
  assertRgbaImage(image);
  return { x: 0, y: 0, width: image.width, height: image.height };
};

const assertBounds = (image: RgbaImage, bounds: PixelBounds): void => {
  assertRgbaImage(image);
  checkedPixelCount(bounds.width, bounds.height);

  if (
    !Number.isSafeInteger(bounds.x) ||
    !Number.isSafeInteger(bounds.y) ||
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.x + bounds.width > image.width ||
    bounds.y + bounds.height > image.height
  ) {
    throw new RangeError("Pixel bounds fall outside the source image.");
  }
};

export const cropRgba = (image: RgbaImage, bounds: PixelBounds): RgbaImage => {
  assertBounds(image, bounds);
  const output = new Uint8Array(bounds.width * bounds.height * 4);

  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.y + y) * image.width + bounds.x) * 4;
    const sourceEnd = sourceStart + bounds.width * 4;
    const destinationStart = y * bounds.width * 4;
    output.set(image.data.subarray(sourceStart, sourceEnd), destinationStart);
  }

  return {
    width: bounds.width,
    height: bounds.height,
    data: output,
  };
};

export const transparentPixelImage = (): RgbaImage => ({
  width: 1,
  height: 1,
  data: new Uint8Array(4),
});

const pixelOffset = (width: number, x: number, y: number): number => (y * width + x) * 4;

export const extrudeRgba = (image: RgbaImage, padding: number): RgbaImage => {
  assertRgbaImage(image);
  if (!Number.isSafeInteger(padding) || padding < 0) {
    throw new RangeError("Atlas extrusion padding must be a non-negative safe integer.");
  }
  if (padding === 0) {
    return cloneRgbaImage(image);
  }

  const width = image.width + padding * 2;
  const height = image.height + padding * 2;
  checkedPixelCount(width, height);
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.max(0, y - padding));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.max(0, x - padding));
      const source = pixelOffset(image.width, sourceX, sourceY);
      const destination = pixelOffset(width, x, y);
      data[destination] = image.data[source] ?? 0;
      data[destination + 1] = image.data[source + 1] ?? 0;
      data[destination + 2] = image.data[source + 2] ?? 0;
      data[destination + 3] = image.data[source + 3] ?? 0;
    }
  }

  return { width, height, data };
};

export const blitRgba = (
  destination: RgbaImage,
  source: RgbaImage,
  destinationX: number,
  destinationY: number,
): void => {
  assertRgbaImage(destination);
  assertRgbaImage(source);
  if (
    !Number.isSafeInteger(destinationX) ||
    !Number.isSafeInteger(destinationY) ||
    destinationX < 0 ||
    destinationY < 0 ||
    destinationX + source.width > destination.width ||
    destinationY + source.height > destination.height
  ) {
    throw new RangeError("RGBA blit falls outside the destination image.");
  }

  for (let y = 0; y < source.height; y += 1) {
    const sourceStart = y * source.width * 4;
    const sourceEnd = sourceStart + source.width * 4;
    const destinationStart = ((destinationY + y) * destination.width + destinationX) * 4;
    destination.data.set(source.data.subarray(sourceStart, sourceEnd), destinationStart);
  }
};

export const countUniqueRgbaColours = (image: RgbaImage, stopAfter = Number.POSITIVE_INFINITY): number => {
  assertRgbaImage(image);
  if (!(Number.isFinite(stopAfter) || stopAfter === Number.POSITIVE_INFINITY) || stopAfter < 1) {
    throw new RangeError("Colour-count limit must be positive.");
  }

  const colours = new Set<number>();
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    const alpha = image.data[index + 3] ?? 0;
    colours.add(red * 0x1000000 + green * 0x10000 + blue * 0x100 + alpha);
    if (colours.size >= stopAfter) {
      return colours.size;
    }
  }

  return colours.size;
};
