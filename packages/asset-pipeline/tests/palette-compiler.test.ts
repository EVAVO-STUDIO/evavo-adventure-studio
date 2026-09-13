import { describe, expect, it } from "vitest";
import { compileRgbaPalette, createPaletteAssetRecord } from "../src/palette-compiler.js";

const hash = "0".repeat(64);

const paletteAsset = {
  id: "asset.palette.test",
  path: "art/palette/test.rgba",
  kind: "palette" as const,
};

describe("RGBA palette compiler", () => {
  it("compiles immutable deterministic palette bytes with transparent index", async () => {
    const source = new Uint8Array([
      0, 0, 0, 255,
      24, 32, 48, 255,
      120, 90, 72, 255,
      240, 230, 210, 255,
    ]);
    const original = [...source];
    const first = await compileRgbaPalette(source, 0);
    const second = await compileRgbaPalette(source, 0);

    expect(first.entries).toBe(4);
    expect(first.transparentIndex).toBe(0);
    expect(first.sha256).toBe(second.sha256);
    expect([...first.data]).toEqual(original);
    expect(first.data).not.toBe(source);
    expect([...source]).toEqual(original);
  });

  it("rejects incomplete quads, more than 256 entries and invalid transparency", async () => {
    await expect(compileRgbaPalette(new Uint8Array(7))).rejects.toThrow(/RGBA quads/u);
    await expect(compileRgbaPalette(new Uint8Array(257 * 4))).rejects.toThrow(/1 to 256/u);
    await expect(compileRgbaPalette(new Uint8Array(4 * 4), 4)).rejects.toThrow(/0 to 3/u);
  });

  it("creates the existing palette asset-record shape with a primary binary output", async () => {
    const compiled = await compileRgbaPalette(new Uint8Array(8 * 4), 0);
    const record = createPaletteAssetRecord(paletteAsset as never, compiled, {
      sourceFiles: [
        {
          path: paletteAsset.path,
          sha256: hash,
          byteLength: 32,
        },
      ],
      runtimePath: "assets/palette/test.rgba",
    });

    expect(record).toMatchObject({
      assetId: "asset.palette.test",
      kind: "palette",
      outputFiles: [
        expect.objectContaining({
          role: "primary",
          runtimePath: "assets/palette/test.rgba",
          mediaType: "application/octet-stream",
          byteLength: 32,
        }),
      ],
      metadata: {
        kind: "palette",
        entries: 8,
        transparentIndex: 0,
      },
    });
    expect(record.outputFiles[0]?.sha256).toBe(compiled.sha256);
  });

  it("rejects non-palette assets and empty source evidence", async () => {
    const compiled = await compileRgbaPalette(new Uint8Array(4 * 4));
    expect(() =>
      createPaletteAssetRecord(
        { id: "asset.image.test", path: "art/test.png", kind: "image" } as never,
        compiled,
        {
          sourceFiles: [{ path: "art/test.png", sha256: hash, byteLength: 16 }],
          runtimePath: "assets/test.rgba",
        },
      ),
    ).toThrow(/expected 'palette'/u);

    expect(() =>
      createPaletteAssetRecord(paletteAsset as never, compiled, {
        sourceFiles: [],
        runtimePath: "assets/palette/test.rgba",
      }),
    ).toThrow(/at least one source file/u);
  });
});
