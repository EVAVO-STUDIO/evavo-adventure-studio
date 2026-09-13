import { type ArtDirectionManifest, createArtDirectionManifest } from "@evavo/adventure-art-direction";
import type { ArtVisualEvidenceManifest } from "@evavo/adventure-art-direction/evidence";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import type { UiSkinManifest } from "@evavo/adventure-ui-skin";
import { describe, expect, it } from "vitest";
import {
  createAdventureAuthenticityEvidenceRequirements,
  evaluateAdventureCompiledEvidence,
} from "../src/compiled-evidence.js";
import { showcaseAdventureDesigns, showcaseProjectShells } from "../src/showcases.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const design = showcaseAdventureDesigns[0]!;
const sourceProject = showcaseProjectShells[0]!;
const fontAssetId = id<"asset">("asset.glass-finch.font");

const project = {
  ...sourceProject,
  assets: [
    ...sourceProject.assets,
    {
      id: fontAssetId,
      path: "art/glass-finch/font.png",
      kind: "image" as const,
    },
  ],
} as AdventureProject;

const imageRecord = (
  assetId: Id<"asset">,
  sourcePath: string,
  runtimePath: string,
  width: number,
  height: number,
  colourCount: number,
) => ({
  assetId,
  kind: "image" as const,
  sourceFiles: [{ path: sourcePath, sha256: hash, byteLength: 1 }],
  outputFiles: [
    {
      role: "primary",
      runtimePath,
      mediaType: "image/png",
      sha256: hash,
      byteLength: 1,
    },
  ],
  metadata: {
    kind: "image" as const,
    width,
    height,
    palette: true,
    colourCount,
  },
});

const backgroundId = project.scenes[0]!.backgroundAssetId;
const toolAsset = project.assets.find((asset) => asset.id !== backgroundId && asset.id !== fontAssetId)!;

const compiledAssets: AssetBuildManifest = {
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "0.1.0-test",
  assets: [
    imageRecord(
      backgroundId,
      project.assets.find((asset) => asset.id === backgroundId)!.path,
      "assets/background.png",
      320,
      200,
      128,
    ),
    imageRecord(toolAsset.id, toolAsset.path, "assets/tool.png", 16, 16, 12),
    imageRecord(fontAssetId, "art/glass-finch/font.png", "assets/font.png", 128, 64, 16),
  ],
  fingerprint: hash,
};

const baseArtDirection = createArtDirectionManifest(project, "vga-256-320x200");
const artDirection: ArtDirectionManifest = {
  ...baseArtDirection,
  assets: baseArtDirection.assets.map((rule) =>
    rule.assetId === fontAssetId
      ? {
          ...rule,
          role: "font" as const,
          outputMode: "indexed" as const,
          maxColours: 16,
          transparency: "binary" as const,
          trimMode: "alpha" as const,
          nearestOnly: true,
        }
      : rule,
  ),
};

const visualEvidence: ArtVisualEvidenceManifest = {
  manifestVersion: 1,
  projectId: project.id,
  compilerVersion: "0.1.0-test",
  assets: [
    {
      assetId: backgroundId,
      kind: "image",
      palette: true,
      colourCount: 128,
      alphaMode: "opaque",
    },
    {
      assetId: toolAsset.id,
      kind: "image",
      palette: true,
      colourCount: 12,
      alphaMode: "binary",
    },
    {
      assetId: fontAssetId,
      kind: "image",
      palette: true,
      colourCount: 16,
      alphaMode: "binary",
    },
  ],
};

const bitmapFonts: BitmapFontManifest = {
  manifestVersion: 1,
  projectId: project.id,
  fonts: [
    {
      id: id<"bitmap-font">("bitmap-font.glass-finch.ui"),
      name: "Glass Finch UI",
      atlasAssetId: fontAssetId,
      lineHeight: 8,
      baseline: 7,
      spaceAdvance: 3,
      letterSpacing: 0,
      fallbackCodePoint: 63,
      glyphs: Array.from({ length: 64 }, (_, index) => ({
        id: id<"font-glyph">(`font-glyph.glass-finch.${index}`),
        codePoint: index,
        sourceRect: { x: index % 16, y: Math.floor(index / 16), width: 1, height: 1 },
        bearing: { x: 0, y: -1 },
        advance: 1,
      })),
      kernings: [],
    },
  ],
};

const uiSkins: UiSkinManifest = {
  manifestVersion: 1,
  projectId: project.id,
  defaultSkinId: id<"ui-skin">("ui-skin.glass-finch.context"),
  skins: [
    {
      id: id<"ui-skin">("ui-skin.glass-finch.context"),
      name: "Glass Finch Context",
      interactionMode: project.presentation.interactionMode,
      nativeSize: { width: 320, height: 200 },
      status: {
        id: id<"ui-region">("ui-region.glass-finch.status"),
        rect: { x: 0, y: 184, width: 320, height: 16 },
        padding: 2,
        panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
      },
      score: {
        id: id<"ui-region">("ui-region.glass-finch.score"),
        rect: { x: 272, y: 0, width: 48, height: 16 },
        padding: 2,
        panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
      },
      verbs: [
        {
          id: id<"ui-verb">("ui-verb.glass-finch.use"),
          verb: "use",
          label: "USE",
          cursorId: "use",
          iconAssetId: toolAsset.id,
          primary: true,
        },
      ],
      verbBar: {
        region: {
          id: id<"ui-region">("ui-region.glass-finch.verbs"),
          rect: { x: 0, y: 160, width: 320, height: 24 },
          padding: 2,
          panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
        },
        orientation: "horizontal",
        gap: 2,
        buttonHeight: 20,
        normal: { fill: 0, border: 0xffffff, borderWidth: 1 },
        hover: { fill: 0x111111, border: 0xffffff, borderWidth: 1 },
        pressed: { fill: 0x222222, border: 0xffffff, borderWidth: 1 },
        disabled: { fill: 0, border: 0x666666, borderWidth: 1 },
      },
      fonts: {
        status: {
          fontId: bitmapFonts.fonts[0]!.id,
          color: 0xffffff,
          align: "left",
        },
        score: {
          fontId: bitmapFonts.fonts[0]!.id,
          color: 0xffffff,
          align: "right",
        },
        verb: {
          fontId: bitmapFonts.fonts[0]!.id,
          color: 0xffffff,
          align: "center",
        },
      },
    },
  ],
};

const evidence = {
  project,
  artDirection,
  compiledAssets,
  visualEvidence,
  bitmapFonts,
  uiSkins,
};

describe("compiled adventure authenticity evidence", () => {
  it("verifies a complete indexed VGA evidence set deterministically", () => {
    const report = evaluateAdventureCompiledEvidence(design, evidence);

    expect(report).toMatchObject({
      reportVersion: 1,
      status: "ready",
      verified: true,
      coveragePercent: 100,
      metrics: {
        requiredVisualAssets: 3,
        compiledVisualAssets: 3,
        pixelEvidenceAssets: 3,
        backgroundAssets: 1,
        actorAtlases: 0,
        bitmapFonts: 1,
        uiSkins: 1,
      },
      findings: [],
    });
    expect(evaluateAdventureCompiledEvidence(design, evidence)).toEqual(report);
  });

  it("blocks soft, unindexed or over-budget background output", () => {
    const broken: ArtVisualEvidenceManifest = {
      ...visualEvidence,
      assets: visualEvidence.assets.map((record) =>
        record.assetId === backgroundId && record.kind === "image"
          ? {
              ...record,
              palette: false,
              colourCount: 400,
              alphaMode: "full" as const,
            }
          : record,
      ),
    };

    const report = evaluateAdventureCompiledEvidence(design, {
      ...evidence,
      visualEvidence: broken,
    });
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toContain("evidence-background-pixels-invalid");
  });

  it("keeps missing font and interface proof visible as attention", () => {
    const report = evaluateAdventureCompiledEvidence(design, {
      project,
      artDirection,
      compiledAssets,
      visualEvidence,
    });

    expect(report.status).toBe("attention");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["evidence-bitmap-fonts-missing", "evidence-ui-skins-missing"]),
    );
  });

  it("describes the six artifacts required for compiled proof", () => {
    expect(createAdventureAuthenticityEvidenceRequirements(design)).toEqual([
      expect.objectContaining({ id: "canonical-project", required: true }),
      expect.objectContaining({ id: "art-direction", required: true }),
      expect.objectContaining({ id: "asset-build", required: true }),
      expect.objectContaining({ id: "pixel-evidence", required: true }),
      expect.objectContaining({ id: "bitmap-fonts", required: true }),
      expect.objectContaining({ id: "ui-skins", required: true }),
    ]);
  });
});
