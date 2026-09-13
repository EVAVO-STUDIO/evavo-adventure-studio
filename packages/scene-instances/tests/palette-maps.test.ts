import { describe, expect, it } from "vitest";
import {
  paletteMapById,
  parsePaletteMapManifest,
} from "../src/palette-maps.js";

describe("palette map sidecar", () => {
  it("parses reusable palette map bindings", () => {
    const manifest = parsePaletteMapManifest({
      manifestVersion: 1,
      projectId: "project.palette-map-test",
      maps: [
        {
          id: "palette-map.office-warm",
          paletteAssetId: "asset.palette.office",
          paletteOffset: 32,
          description: "Warm practical-light actor ramp",
        },
      ],
    });
    expect(paletteMapById(manifest, "palette-map.office-warm")).toMatchObject({
      paletteAssetId: "asset.palette.office",
      paletteOffset: 32,
    });
  });

  it("defaults palette offset to zero", () => {
    const manifest = parsePaletteMapManifest({
      manifestVersion: 1,
      projectId: "project.palette-map-test",
      maps: [
        {
          id: "palette-map.neutral",
          paletteAssetId: "asset.palette.office",
        },
      ],
    });
    expect(manifest.maps[0]?.paletteOffset).toBe(0);
  });

  it("rejects duplicate map ids and out-of-byte-range offsets", () => {
    expect(() =>
      parsePaletteMapManifest({
        manifestVersion: 1,
        projectId: "project.palette-map-test",
        maps: [
          { id: "palette-map.same", paletteAssetId: "asset.palette.a" },
          { id: "palette-map.same", paletteAssetId: "asset.palette.b" },
        ],
      }),
    ).toThrow();

    expect(() =>
      parsePaletteMapManifest({
        manifestVersion: 1,
        projectId: "project.palette-map-test",
        maps: [
          { id: "palette-map.bad", paletteAssetId: "asset.palette.a", paletteOffset: 256 },
        ],
      }),
    ).toThrow();
  });
});
