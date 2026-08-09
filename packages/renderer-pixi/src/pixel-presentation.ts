import type { Point, PresentationProfile } from "@evavo/adventure-project-schema";

export interface PixelPresentationPolicy {
  readonly strictNativePixels: boolean;
  readonly roundPixels: boolean;
  readonly forceNearestSampling: boolean;
  readonly disableMipmaps: boolean;
  readonly rejectLinearSampling: boolean;
}

export const defaultPixelPresentationPolicy: PixelPresentationPolicy = {
  strictNativePixels: false,
  roundPixels: false,
  forceNearestSampling: false,
  disableMipmaps: false,
  rejectLinearSampling: false,
};

export const classicPixelPresentationPolicy: PixelPresentationPolicy = {
  strictNativePixels: true,
  roundPixels: true,
  forceNearestSampling: true,
  disableMipmaps: true,
  rejectLinearSampling: true,
};

export class PixiPixelPresentationError extends Error {
  readonly sampling: "nearest" | "linear";

  constructor(sampling: "nearest" | "linear") {
    super(`Strict native-pixel presentation cannot render '${sampling}' sampled artwork.`);
    this.name = "PixiPixelPresentationError";
    this.sampling = sampling;
  }
}

export const pixelPresentationPolicyForProfile = (
  presentation: Pick<PresentationProfile, "integerScale" | "textureSampling" | "pixelMotionPolicy">,
): PixelPresentationPolicy =>
  presentation.integerScale &&
  presentation.textureSampling === "nearest" &&
  presentation.pixelMotionPolicy === "strict"
    ? classicPixelPresentationPolicy
    : defaultPixelPresentationPolicy;

export const resolvePixelSampling = (
  policy: PixelPresentationPolicy,
  sampling: "nearest" | "linear",
): "nearest" | "linear" => {
  if (policy.rejectLinearSampling && sampling !== "nearest") {
    throw new PixiPixelPresentationError(sampling);
  }
  return policy.forceNearestSampling ? "nearest" : sampling;
};

export const presentPixelCoordinate = (policy: PixelPresentationPolicy, value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError("Pixel presentation coordinates must be finite.");
  }
  return policy.roundPixels ? Math.round(value) : value;
};

export const presentPixelPoint = (policy: PixelPresentationPolicy, point: Point): Point => ({
  x: presentPixelCoordinate(policy, point.x),
  y: presentPixelCoordinate(policy, point.y),
});
