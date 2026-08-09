import { describe, expect, it } from "vitest";
import { composeAtlasPage, packAtlas } from "../src/atlas.js";
import type { RgbaImage } from "../src/rgba.js";

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

describe("deterministic atlas packing", () => {
  it("produces the same layout regardless of request order", () => {
    const requests = [
      { id: "frame.small", width: 8, height: 8 },
      { id: "frame.wide", width: 20, height: 8 },
      { id: "frame.tall", width: 8, height: 20 },
    ] as const;
    const options = { pageWidth: 32, pageHeight: 32, padding: 1 } as const;

    expect(packAtlas(requests, options)).toEqual(packAtlas([...requests].reverse(), options));
  });

  it("creates additional pages when a shelf cannot fit", () => {
    const pages = packAtlas(
      [
        { id: "frame.a", width: 14, height: 14 },
        { id: "frame.b", width: 14, height: 14 },
        { id: "frame.c", width: 14, height: 14 },
      ],
      { pageWidth: 16, pageHeight: 16, padding: 1 },
    );

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.index)).toEqual([0, 1, 2]);
  });

  it("composes edge-extruded frame pixels into the declared outer bounds", () => {
    const pages = packAtlas([{ id: "frame.red", width: 2, height: 1 }], {
      pageWidth: 8,
      pageHeight: 4,
      padding: 1,
    });
    const layout = pages[0]!;
    const page = composeAtlasPage(layout, new Map([["frame.red", solid(2, 1, [255, 0, 0, 255])]]));
    const placement = layout.placements[0]!;

    for (let y = placement.outerY; y < placement.outerY + placement.outerHeight; y += 1) {
      for (let x = placement.outerX; x < placement.outerX + placement.outerWidth; x += 1) {
        const offset = (y * page.width + x) * 4;
        expect([...page.data.slice(offset, offset + 4)]).toEqual([255, 0, 0, 255]);
      }
    }
  });

  it("rejects duplicate IDs and oversized frames", () => {
    expect(() =>
      packAtlas(
        [
          { id: "frame.same", width: 4, height: 4 },
          { id: "frame.same", width: 4, height: 4 },
        ],
        { pageWidth: 16, pageHeight: 16, padding: 1 },
      ),
    ).toThrow();

    expect(() =>
      packAtlas([{ id: "frame.large", width: 16, height: 16 }], {
        pageWidth: 16,
        pageHeight: 16,
        padding: 1,
      }),
    ).toThrow(RangeError);
  });
});
