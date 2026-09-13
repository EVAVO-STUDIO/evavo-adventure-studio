import { describe, expect, it } from "vitest";
import {
  classicPixelPresentationPolicy,
  defaultPixelPresentationPolicy,
  pixelPresentationPolicyForProfile,
  presentPixelPoint,
  resolvePixelSampling,
} from "../src/pixel-presentation.js";

describe("classic pixel presentation", () => {
  it("selects strict presentation only for the complete native-pixel contract", () => {
    expect(
      pixelPresentationPolicyForProfile({
        integerScale: true,
        textureSampling: "nearest",
        pixelMotionPolicy: "strict",
      }),
    ).toEqual(classicPixelPresentationPolicy);

    expect(
      pixelPresentationPolicyForProfile({
        integerScale: false,
        textureSampling: "nearest",
        pixelMotionPolicy: "strict",
      }),
    ).toEqual(defaultPixelPresentationPolicy);
  });

  it("quantizes presentation without changing canonical world state", () => {
    const point = { x: 42.49, y: 119.51 };
    const presented = presentPixelPoint(classicPixelPresentationPolicy, point);

    expect(presented).toEqual({ x: 42, y: 120 });
    expect(point).toEqual({ x: 42.49, y: 119.51 });
  });

  it("rejects linear sampling under a strict classic profile", () => {
    expect(() => resolvePixelSampling(classicPixelPresentationPolicy, "linear")).toThrow(
      "Strict native-pixel presentation",
    );
    expect(resolvePixelSampling(classicPixelPresentationPolicy, "nearest")).toBe("nearest");
  });

  it("preserves modern presentation when the project opts out", () => {
    expect(resolvePixelSampling(defaultPixelPresentationPolicy, "linear")).toBe("linear");
    expect(presentPixelPoint(defaultPixelPresentationPolicy, { x: 2.25, y: 7.75 })).toEqual({
      x: 2.25,
      y: 7.75,
    });
  });
});
