import { describe, expect, it } from "vitest";
import {
  assetBuildManifestSchema,
  type AssetBuildManifest,
} from "@evavo/adventure-asset-contract";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  createArtDirectionEditorHistory,
  createArtDirectionManifest,
  evaluateCompiledArtDirection,
  executeArtDirectionEditorCommand,
  isArtDirectionEditorDocumentDirty,
  markArtDirectionEditorHistorySaved,
  redoArtDirectionEditorCommand,
  undoArtDirectionEditorCommand,
  validateArtDirectionManifest,
} from "../src/index.js";
import { parseArtDirectionEditorCommand } from "../src/command-schema.js";

const hash = "0".repeat(64);

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.art-direction",
  title: "The Red Ledger",
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
      backgroundAssetId: "asset.background.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 18, y: 172 },
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
          assetId: "asset.actor.detective",
          sourceRect: { x: 2, y: 2, width: 18, height: 30 },
          sourceSize: { width: 24, height: 36 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 12, y: 35 },
          footPoint: { x: 12, y: 35 },
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
    {
      id: "asset.background.office",
      path: "art/office.png",
      kind: "image",
    },
    {
      id: "asset.actor.detective",
      path: "art/detective.aseprite",
      kind: "spritesheet",
    },
    {
      id: "asset.audio.rain",
      path: "audio/rain.ogg",
      kind: "audio",
    },
  ],
  inventoryItems: [],
});

const compiledManifest = (
  overrides: Partial<{
    readonly backgroundWidth: number;
    readonly backgroundHeight: number;
    readonly backgroundPalette: boolean;
    readonly backgroundColours: number;
    readonly actorPadding: number;
  }> = {},
): AssetBuildManifest =>
  assetBuildManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    compilerVersion: "0.1.0-test",
    fingerprint: hash,
    assets: [
      {
        assetId: "asset.background.office",
        kind: "image",
        sourceFiles: [
          { path: "art/office.png", sha256: hash, byteLength: 100 },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/office.png",
            mediaType: "image/png",
            sha256: hash,
            byteLength: 80,
          },
        ],
        metadata: {
          kind: "image",
          width: overrides.backgroundWidth ?? 320,
          height: overrides.backgroundHeight ?? 200,
          palette: overrides.backgroundPalette ?? true,
          colourCount: overrides.backgroundColours ?? 128,
        },
      },
      {
        assetId: "asset.actor.detective",
        kind: "spritesheet",
        sourceFiles: [
          {
            path: "art/detective.aseprite",
            sha256: hash,
            byteLength: 120,
          },
        ],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: "assets/detective/atlas.json",
            mediaType: "application/json",
            sha256: hash,
            byteLength: 30,
          },
          {
            role: "page-000",
            runtimePath: "assets/detective/page-000.png",
            mediaType: "image/png",
            sha256: hash,
            byteLength: 90,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 64, height: 64 }],
          frames: [
            {
              frameId: "frame.detective.idle",
              pageOutputRole: "page-000",
              sourceRect: { x: 2, y: 2, width: 18, height: 30 },
              originalSize: { width: 24, height: 36 },
              trimOffset: { x: 3, y: 4 },
              padding: overrides.actorPadding ?? 1,
            },
          ],
        },
      },
      {
        assetId: "asset.audio.rain",
        kind: "audio",
        sourceFiles: [
          { path: "audio/rain.ogg", sha256: hash, byteLength: 200 },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: "assets/rain.ogg",
            mediaType: "audio/ogg",
            sha256: hash,
            byteLength: 180,
          },
        ],
        metadata: {
          kind: "audio",
          durationMilliseconds: 12_000,
          channels: 2,
          sampleRate: 44_100,
        },
      },
    ],
  });

describe("art direction inference", () => {
  it("creates a complete VGA profile with inferred project roles", () => {
    const manifest = createArtDirectionManifest(project, "vga-256-320x200");

    expect(validateArtDirectionManifest(project, manifest)).toEqual([]);
    expect(manifest.profile).toMatchObject({
      preset: "vga-256-320x200",
      nativeSize: { width: 320, height: 200 },
      palette: { mode: "indexed", maxColours: 256 },
      transparency: "binary",
      nearestSamplingRequired: true,
      integerScaleRequired: true,
    });
    expect(manifest.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "asset.background.office",
          role: "background",
          trimMode: "none",
          sizePolicy: "exact",
          expectedSize: { width: 320, height: 200 },
        }),
        expect.objectContaining({
          assetId: "asset.actor.detective",
          role: "actor",
          trimMode: "alpha",
          atlasPaddingMinimum: 1,
        }),
        expect.objectContaining({
          assetId: "asset.audio.rain",
          role: "audio",
        }),
      ]),
    );
  });

  it("reports presentation and background-rule drift", () => {
    const manifest = createArtDirectionManifest(project, "vga-256-320x200");
    const brokenProject = {
      ...project,
      presentation: {
        ...project.presentation,
        integerScale: false,
        textureSampling: "linear" as const,
      },
    };
    const brokenManifest = {
      ...manifest,
      assets: manifest.assets.map((rule) => {
        if (rule.assetId !== "asset.background.office") return rule;
        const { expectedSize: _expectedSize, ...withoutExpectedSize } = rule;
        return {
          ...withoutExpectedSize,
          role: "other" as const,
          sizePolicy: "any" as const,
        };
      }),
    };

    expect(
      validateArtDirectionManifest(brokenProject, brokenManifest).map(
        (entry) => entry.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "sampling-policy-mismatch",
        "integer-scale-policy-mismatch",
        "background-role-mismatch",
        "background-size-rule-mismatch",
      ]),
    );
  });
});

describe("compiled art evidence", () => {
  it("accepts compliant image evidence and flags unmeasured atlas palettes", () => {
    const art = createArtDirectionManifest(project, "vga-256-320x200");
    const issues = evaluateCompiledArtDirection(project, art, compiledManifest());

    expect(issues.filter((entry) => entry.severity === "error")).toEqual([]);
    expect(issues.map((entry) => entry.code)).toContain(
      "compiled-palette-unverified",
    );
  });

  it("reports dimensions, output mode, colour budget and atlas padding", () => {
    const art = createArtDirectionManifest(project, "vga-256-320x200");
    const issues = evaluateCompiledArtDirection(
      project,
      art,
      compiledManifest({
        backgroundWidth: 640,
        backgroundHeight: 400,
        backgroundPalette: false,
        backgroundColours: 300,
        actorPadding: 0,
      }),
    );

    expect(issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "compiled-size-mismatch",
        "compiled-palette-mismatch",
        "compiled-colour-budget-exceeded",
        "compiled-atlas-padding-too-small",
      ]),
    );
  });
});

describe("art direction editor history", () => {
  it("edits per-asset budgets with undo, redo and save tracking", () => {
    const manifest = createArtDirectionManifest(project, "vga-256-320x200");
    const background = manifest.assets.find(
      (rule) => rule.assetId === "asset.background.office",
    )!;
    let history = createArtDirectionEditorHistory(project, manifest);

    history = executeArtDirectionEditorCommand(project, history, {
      kind: "replace-asset-rule",
      assetId: background.assetId,
      rule: { ...background, maxColours: 96, dither: 0.15 },
    });

    expect(
      history.document.manifest.assets.find(
        (rule) => rule.assetId === background.assetId,
      ),
    ).toMatchObject({ maxColours: 96, dither: 0.15 });
    expect(isArtDirectionEditorDocumentDirty(history.document)).toBe(true);

    history = undoArtDirectionEditorCommand(project, history);
    expect(
      history.document.manifest.assets.find(
        (rule) => rule.assetId === background.assetId,
      )?.maxColours,
    ).toBeUndefined();
    expect(isArtDirectionEditorDocumentDirty(history.document)).toBe(false);

    history = redoArtDirectionEditorCommand(project, history);
    expect(
      history.document.manifest.assets.find(
        (rule) => rule.assetId === background.assetId,
      )?.maxColours,
    ).toBe(96);

    history = markArtDirectionEditorHistorySaved(history);
    expect(isArtDirectionEditorDocumentDirty(history.document)).toBe(false);
  });
});

describe("art direction command schema", () => {
  it("parses recursive profile and rule edits", () => {
    const manifest = createArtDirectionManifest(project, "vga-256-320x200");
    expect(
      parseArtDirectionEditorCommand({
        kind: "batch",
        commands: [
          { kind: "replace-profile", profile: manifest.profile },
          {
            kind: "replace-asset-rule",
            assetId: manifest.assets[0]!.assetId,
            rule: manifest.assets[0],
          },
        ],
      }),
    ).toMatchObject({ kind: "batch" });
  });

  it("rejects empty art-direction batches", () => {
    expect(() =>
      parseArtDirectionEditorCommand({ kind: "batch", commands: [] }),
    ).toThrow();
  });
});
