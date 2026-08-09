import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { compileAtlas } from "../src/atlas-compiler.js";
import type { RgbaImage } from "../src/rgba.js";

const id = <T extends string>(value: string) => value as Id<T>;

const solid = (
  width: number,
  height: number,
  colour: readonly [number, number, number, number],
): RgbaImage => {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set(colour, index);
  }
  return { width, height, data };
};

const frames = [
  {
    id: id<"sprite-frame">("frame.detective.idle"),
    image: solid(12, 20, [40, 50, 70, 255]),
    originalSize: { width: 18, height: 24 },
    trimOffset: { x: 3, y: 4 },
  },
  {
    id: id<"sprite-frame">("frame.detective.blink"),
    image: solid(10, 19, [44, 54, 74, 255]),
    originalSize: { width: 18, height: 24 },
    trimOffset: { x: 4, y: 5 },
  },
] as const;

describe("compiled atlas artifacts", () => {
  it("produces byte-stable pages and manifests for reordered source frames", async () => {
    const options = {
      pageWidth: 32,
      pageHeight: 32,
      padding: 1,
      output: { mode: "rgba-png" as const },
      pageNamePrefix: "detective",
    };

    const left = await compileAtlas(frames, options);
    const right = await compileAtlas([...frames].reverse(), options);

    expect(left.pages.map((page) => page.data)).toEqual(right.pages.map((page) => page.data));
    expect(left.manifest).toEqual(right.manifest);
    expect(left.manifest.sha256).toHaveLength(64);
    expect(left.pages.every((page) => page.sha256.length === 64)).toBe(true);
  });

  it("preserves untrimmed geometry in each runtime frame record", async () => {
    const compiled = await compileAtlas(frames, {
      pageWidth: 64,
      pageHeight: 64,
      padding: 2,
      output: { mode: "indexed-png", colours: 16, dither: 0 },
    });
    const idle = compiled.manifest.frames.find((frame) => frame.frameId === "frame.detective.idle");

    expect(idle).toMatchObject({
      pageIndex: 0,
      sourceRect: { width: 12, height: 20 },
      originalSize: { width: 18, height: 24 },
      trimOffset: { x: 3, y: 4 },
      padding: 2,
    });
    expect(compiled.manifest.output).toEqual({
      mode: "indexed-png",
      colours: 16,
      dither: 0,
    });
  });

  it("rejects source geometry that cannot reconstruct the original frame", async () => {
    await expect(
      compileAtlas(
        [
          {
            id: id<"sprite-frame">("frame.invalid"),
            image: solid(20, 20, [255, 255, 255, 255]),
            originalSize: { width: 16, height: 16 },
            trimOffset: { x: 0, y: 0 },
          },
        ],
        { pageWidth: 32, pageHeight: 32, padding: 1 },
      ),
    ).rejects.toThrow(RangeError);
  });
});
