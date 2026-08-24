import { describe, expect, it } from "vitest";
import { roundAndClampNativePoint } from "../src/scene-director-components.js";

describe("Scene Director native pointer coordinates", () => {
  it("rounds responsive pointer positions onto native integer pixels", () => {
    expect(
      roundAndClampNativePoint({ x: 94.49, y: 148.51 }, { width: 320, height: 200 }),
    ).toEqual({ x: 94, y: 149 });
  });

  it("clamps drag positions to the native room bounds", () => {
    expect(
      roundAndClampNativePoint({ x: -18.2, y: 225.8 }, { width: 320, height: 200 }),
    ).toEqual({ x: 0, y: 200 });
    expect(
      roundAndClampNativePoint({ x: 342.2, y: -4.1 }, { width: 320, height: 200 }),
    ).toEqual({ x: 320, y: 0 });
  });
});
