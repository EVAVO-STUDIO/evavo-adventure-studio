import type { Id } from "@evavo/adventure-project-schema";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compileImage, encodeRgbaPng, sha256Hex } from "../src/index.js";
import type { RgbaImage } from "../src/rgba.js";

const id = <T extends string>(value: string) => value as Id<T>;

const sourcePng = async (): Promise<Uint8Array> => {
  const data = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const offset = (y * 4 + x) * 4;
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
        data.set([40 + x * 20, 60 + y * 20, 120, 255], offset);
      } else {
        data.set([255, 0, 255, 0], offset);
      }
    }
  }

  return new Uint8Array(
    await sharp(data, {
      raw: { width: 4, height: 4, channels: 4 },
    })
      .png({ palette: false, compressionLevel: 9, effort: 10 })
      .toBuffer(),
  );
};

describe("image asset compiler", () => {
  it("trims transparent edges and records untrimmed geometry", async () => {
    const source = await sourcePng();
    const compiled = await compileImage(source, {
      assetId: id<"asset">("asset.detective.frame"),
      trim: { mode: "alpha", threshold: 0 },
      output: { mode: "rgba-png" },
    });

    expect(compiled.manifest.geometry).toEqual({
      untrimmedSize: { width: 4, height: 4 },
      trimBounds: { x: 1, y: 1, width: 2, height: 2 },
      empty: false,
    });
    expect(compiled.manifest.output).toMatchObject({
      format: "png",
      palette: false,
      width: 2,
      height: 2,
      colourCount: 4,
    });
    expect(compiled.manifest.source.sha256).toHaveLength(64);
    expect(compiled.manifest.output.sha256).toHaveLength(64);
    expect(compiled.manifest.recipeSha256).toHaveLength(64);
  });

  it("emits byte-stable indexed PNG output for the same source and recipe", async () => {
    const source = await sourcePng();
    const recipe = {
      assetId: id<"asset">("asset.detective.indexed"),
      trim: { mode: "none" as const },
      output: {
        mode: "indexed-png" as const,
        colours: 8,
        dither: 0,
      },
    };

    const left = await compileImage(source, recipe);
    const right = await compileImage(source, recipe);

    expect(left.data).toEqual(right.data);
    expect(left.manifest).toEqual(right.manifest);
    expect(left.manifest.output.palette).toBe(true);
    expect(left.manifest.output.colourCount).toBeLessThanOrEqual(8);
  });

  it("uses nearest-neighbour resizing for pixel assets", async () => {
    const source: RgbaImage = {
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
    };
    const encoded = await encodeRgbaPng(source);
    const compiled = await compileImage(encoded, {
      assetId: id<"asset">("asset.resize-nearest"),
      resize: { width: 4, height: 2 },
      trim: { mode: "none" },
      output: { mode: "rgba-png" },
    });
    const raw = await sharp(compiled.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(raw.info).toMatchObject({ width: 4, height: 2, channels: 4 });
    const firstRow = [...raw.data.slice(0, 16)];
    expect(firstRow).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
  });

  it("matches the standard SHA-256 test vector", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
