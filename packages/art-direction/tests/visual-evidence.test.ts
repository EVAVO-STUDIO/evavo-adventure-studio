import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import { artVisualEvidenceManifestSchema, evaluateArtDirectionWithVisualEvidence } from "../src/evidence.js";
import { createArtDirectionManifest } from "../src/index.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.visual-evidence",
  title: "Visual Evidence",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.detective.idle",
          assetId: "asset.detective",
          sourceRect: { x: 1, y: 1, width: 12, height: 20 },
          sourceSize: { width: 16, height: 24 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 8, y: 23 },
          footPoint: { x: 8, y: 23 },
          durationTicks: 12,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.detective.idle"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    {
      id: "asset.detective",
      path: "art/detective.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

const compiled = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.office",
      kind: "image",
      sourceFiles: [{ path: "art/office.png", sha256: hash, byteLength: 10 }],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 10,
        },
      ],
      metadata: {
        kind: "image",
        width: 320,
        height: 200,
        palette: true,
        colourCount: 128,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      sourceFiles: [
        {
          path: "art/detective.aseprite",
          sha256: hash,
          byteLength: 10,
        },
      ],
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 10,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 10,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 64, height: 64 }],
        frames: [
          {
            frameId: "frame.detective.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 1, y: 1, width: 12, height: 20 },
            originalSize: { width: 16, height: 24 },
            trimOffset: { x: 2, y: 3 },
            padding: 1,
          },
        ],
      },
    },
  ],
});

const art = createArtDirectionManifest(project, "vga-256-320x200");

const evidence = (
  overrides: Partial<{
    readonly imageAlpha: "opaque" | "binary" | "full";
    readonly atlasPalette: boolean;
    readonly atlasColours: number;
    readonly atlasAlpha: "opaque" | "binary" | "full";
    readonly atlasPages: readonly unknown[];
  }> = {},
) =>
  artVisualEvidenceManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "test",
    assets: [
      {
        assetId: "asset.office",
        kind: "image",
        palette: true,
        colourCount: 128,
        alphaMode: overrides.imageAlpha ?? "opaque",
      },
      {
        assetId: "asset.detective",
        kind: "spritesheet",
        pages: overrides.atlasPages ?? [
          {
            outputRole: "page-000",
            palette: overrides.atlasPalette ?? true,
            colourCount: overrides.atlasColours ?? 48,
            alphaMode: overrides.atlasAlpha ?? "binary",
          },
        ],
      },
    ],
  });

describe("compiled visual evidence evaluation", () => {
  it("proves image and atlas palette, colour and alpha compliance", () => {
    const issues = evaluateArtDirectionWithVisualEvidence(project, art, compiled, evidence());

    expect(issues.filter((entry) => entry.severity === "error")).toEqual([]);
    expect(issues.map((entry) => entry.code)).not.toContain("compiled-palette-unverified");
  });

  it("blocks palette, colour and alpha violations", () => {
    const issues = evaluateArtDirectionWithVisualEvidence(
      project,
      art,
      compiled,
      evidence({
        imageAlpha: "binary",
        atlasPalette: false,
        atlasColours: 300,
        atlasAlpha: "full",
      }),
    );

    expect(issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "visual-evidence-alpha-mismatch",
        "visual-evidence-palette-mismatch",
        "visual-evidence-colour-budget-exceeded",
      ]),
    );
  });

  it("blocks missing and unexpected atlas page evidence", () => {
    const issues = evaluateArtDirectionWithVisualEvidence(
      project,
      art,
      compiled,
      evidence({
        atlasPages: [
          {
            outputRole: "page-001",
            palette: true,
            colourCount: 48,
            alphaMode: "binary",
          },
        ],
      }),
    );

    expect(issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["visual-evidence-page-missing", "visual-evidence-page-unexpected"]),
    );
  });
});
