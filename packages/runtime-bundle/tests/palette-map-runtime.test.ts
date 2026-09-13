import type { RuntimeBundle } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { validateRuntimePaletteMaps } from "../src/palette-map-validation.js";

const hash = "0".repeat(64);

const baseBundle = (): RuntimeBundle =>
  ({
    projectId: "project.palette-runtime",
    assets: [
      {
        assetId: "asset.palette.scene",
        kind: "palette",
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/scene.rgba",
            mediaType: "application/octet-stream",
            sha256: hash,
            byteLength: 128,
          },
        ],
        metadata: { kind: "palette", entries: 32, transparentIndex: 0 },
      },
      {
        assetId: "asset.image.not-palette",
        kind: "image",
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/not-palette.png",
            mediaType: "image/png",
            sha256: hash,
            byteLength: 256,
          },
        ],
        metadata: { kind: "image", width: 16, height: 16, palette: true, colourCount: 16 },
      },
    ],
    paletteMaps: {
      manifestVersion: 1,
      projectId: "project.palette-runtime",
      maps: [
        {
          id: "palette-map.scene-warm",
          paletteAssetId: "asset.palette.scene",
          paletteOffset: 16,
        },
      ],
    },
    sceneStaging: {
      manifestVersion: 1,
      projectId: "project.palette-runtime",
      scenes: [
        {
          sceneId: "scene.room",
          actorFootprints: {},
          preferredWalkLanes: [],
          surfaceZones: [],
          depthScaleCurves: [],
          navigationScaleOverrides: [],
          navigationStateModifiers: [],
          approachSlotsByObject: {},
          interactionComfortRegionsByObject: {},
          interactionChoreographies: [],
          entryChoreographies: [],
          occlusionPlanes: [],
          paletteLightZones: [
            {
              id: "palette-light-zone.room.warm",
              shape: {
                points: [
                  { x: 0, y: 0 },
                  { x: 20, y: 0 },
                  { x: 20, y: 20 },
                ],
              },
              paletteMapId: "palette-map.scene-warm",
              blendMode: "hard",
              priority: 1,
            },
          ],
        },
      ],
    },
  }) as RuntimeBundle;

describe("runtime palette maps", () => {
  it("accepts staged light zones bound to compiled palette assets", () => {
    expect(validateRuntimePaletteMaps(baseBundle())).toEqual([]);
  });

  it("fails when a staged light zone references an unknown map", () => {
    const bundle = baseBundle();
    const invalid = {
      ...bundle,
      paletteMaps: { ...bundle.paletteMaps!, maps: [] },
    } as RuntimeBundle;
    expect(validateRuntimePaletteMaps(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-palette-map" })]),
    );
  });

  it("fails when a map references a non-palette runtime asset", () => {
    const bundle = baseBundle();
    const invalid = {
      ...bundle,
      paletteMaps: {
        ...bundle.paletteMaps!,
        maps: [
          {
            id: "palette-map.scene-warm",
            paletteAssetId: "asset.image.not-palette",
            paletteOffset: 0,
          },
        ],
      },
    } as RuntimeBundle;
    expect(validateRuntimePaletteMaps(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-palette-asset-kind" })]),
    );
  });

  it("fails when palette offset plus entries exceeds the byte palette space", () => {
    const bundle = baseBundle();
    const invalid = {
      ...bundle,
      paletteMaps: {
        ...bundle.paletteMaps!,
        maps: [
          {
            id: "palette-map.scene-warm",
            paletteAssetId: "asset.palette.scene",
            paletteOffset: 240,
          },
        ],
      },
    } as RuntimeBundle;
    expect(validateRuntimePaletteMaps(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "palette-offset-overflow" })]),
    );
  });
});
