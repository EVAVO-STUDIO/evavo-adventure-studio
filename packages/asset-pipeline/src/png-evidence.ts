import sharp from "sharp";
import {
  assertRgbaImage,
  countUniqueRgbaColours,
  type RgbaImage,
} from "./rgba.js";

export type ImageAlphaMode = "opaque" | "binary" | "full";

export interface PngEvidence {
  readonly palette: boolean;
  readonly colourCount: number;
  readonly alphaMode: ImageAlphaMode;
}

export const classifyAlphaMode = (image: RgbaImage): ImageAlphaMode => {
  assertRgbaImage(image);
  let hasTransparent = false;
  for (let index = 3; index < image.data.length; index += 4) {
    const alpha = image.data[index] ?? 0;
    if (alpha > 0 && alpha < 255) return "full";
    if (alpha === 0) hasTransparent = true;
  }
  return hasTransparent ? "binary" : "opaque";
};

export const analysePngEvidence = async (
  encoded: Uint8Array,
): Promise<PngEvidence> => {
  if (encoded.byteLength === 0) {
    throw new RangeError("PNG evidence source cannot be empty.");
  }
  const input = new Uint8Array(encoded);
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  const decoded = await sharp(input, { failOn: "error" })
    .ensureAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (decoded.info.channels !== 4) {
    throw new Error(
      `PNG evidence decode produced ${decoded.info.channels} channels instead of RGBA.`,
    );
  }
  const image: RgbaImage = {
    width: decoded.info.width,
    height: decoded.info.height,
    data: new Uint8Array(decoded.data),
  };
  return {
    palette: metadata.isPalette ?? false,
    colourCount: countUniqueRgbaColours(image),
    alphaMode: classifyAlphaMode(image),
  };
};
