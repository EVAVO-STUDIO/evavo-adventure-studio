import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import {
  artDirectionManifestSchema,
  createArtDirectionManifest,
} from "@evavo/adventure-art-direction";
import { artVisualEvidenceManifestSchema } from "@evavo/adventure-art-direction/evidence";
import type {
  Id,
  Rectangle,
  Size,
} from "@evavo/adventure-project-schema";
import { studioProject, studioSceneInstances } from "./fixture.js";

const hash = "0".repeat(64);

export const studioArtDirectionManifest = artDirectionManifestSchema.parse({
  ...createArtDirectionManifest(studioProject, "vga-256-320x200"),
  assets: createArtDirectionManifest(
    studioProject,
    "vga-256-320x200",
  ).assets.map((rule) =>
    rule.assetId === "asset.object.lamp" ||
    rule.assetId === "asset.object.door"
      ? {
          ...rule,
          role: "object",
          trimMode: "alpha",
          nearestOnly: true,
          atlasPaddingMinimum: 1,
        }
      : rule,
  ),
});

interface CompiledFrameFixture {
  readonly frameId: Id<"sprite-frame">;
  readonly sourceRect: Rectangle;
  readonly originalSize: Size;
  readonly trimOffset: { readonly x: number; readonly y: number };
}

const framesForAsset = (assetId: Id<"asset">): readonly CompiledFrameFixture[] => {
  const actorFrames = studioProject.actors.flatMap((actor) =>
    actor.frames.flatMap((frame) =>
      frame.assetId === assetId
        ? [
            {
              frameId: frame.id,
              sourceRect: frame.sourceRect,
              originalSize: frame.sourceSize,
              trimOffset: frame.trimOffset,
            },
          ]
        : [],
    ),
  );
  const objectFrames = studioSceneInstances.objectDefinitions.flatMap(
    (definition) =>
      definition.states.flatMap((state) => {
        const visual = state.visual;
        return visual?.kind === "sprite-frame" && visual.assetId === assetId
          ? [
              {
                frameId: visual.frameId,
                sourceRect: visual.sourceRect,
                originalSize: visual.sourceSize,
                trimOffset: visual.trimOffset,
              },
            ]
          : [];
      }),
  );
  return [...actorFrames, ...objectFrames];
};

const safeName = (assetId: string): string =>
  assetId.replace(/^asset\./, "").replace(/[^a-zA-Z0-9_-]+/g, "-");

const atlasColourCount = (assetId: Id<"asset">): number => {
  switch (assetId) {
    case "asset.actor.detective":
      return 96;
    case "asset.actor.clerk":
      return 72;
    case "asset.object.lamp":
      return 32;
    case "asset.object.door":
      return 48;
    default:
      return 64;
  }
};

export const studioCompiledAssetManifest = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: studioProject.id,
  compilerVersion: "0.1.0-studio-fixture",
  fingerprint: hash,
  assets: studioProject.assets.map((asset) => {
    const name = safeName(asset.id);
    if (asset.kind === "image") {
      return {
        assetId: asset.id,
        kind: "image",
        sourceFiles: [
          { path: asset.path, sha256: hash, byteLength: 64_000 },
        ],
        outputFiles: [
          {
            role: "primary",
            runtimePath: `assets/${name}.png`,
            mediaType: "image/png",
            sha256: hash,
            byteLength: 18_000,
          },
        ],
        metadata: {
          kind: "image",
          width: 320,
          height: 200,
          palette: true,
          colourCount:
            asset.id === "asset.background.office" ? 224 : 196,
        },
      };
    }

    if (asset.kind === "spritesheet") {
      const frames = framesForAsset(asset.id);
      if (frames.length === 0) {
        throw new Error(`Studio spritesheet '${asset.id}' has no fixture frames.`);
      }
      return {
        assetId: asset.id,
        kind: "spritesheet",
        sourceFiles: [
          { path: asset.path, sha256: hash, byteLength: 24_000 },
        ],
        outputFiles: [
          {
            role: "atlas-manifest",
            runtimePath: `assets/${name}/atlas.json`,
            mediaType: "application/json",
            sha256: hash,
            byteLength: 1_200,
          },
          {
            role: "page-000",
            runtimePath: `assets/${name}/page-000.png`,
            mediaType: "image/png",
            sha256: hash,
            byteLength: 12_000,
          },
        ],
        metadata: {
          kind: "spritesheet",
          pages: [{ outputRole: "page-000", width: 512, height: 512 }],
          frames: frames.map((frame) => ({
            ...frame,
            pageOutputRole: "page-000",
            padding: 1,
          })),
        },
      };
    }

    throw new Error(`Unexpected Studio fixture asset kind '${asset.kind}'.`);
  }),
});

export const studioArtVisualEvidence = artVisualEvidenceManifestSchema.parse({
  manifestVersion: 1,
  projectId: studioProject.id,
  compilerVersion: "0.1.0-studio-fixture",
  assets: studioCompiledAssetManifest.assets.flatMap((asset) => {
    if (asset.kind === "image") {
      return [
        {
          assetId: asset.assetId,
          kind: "image",
          palette: asset.metadata.palette,
          colourCount: asset.metadata.colourCount,
          alphaMode: "opaque",
        },
      ];
    }
    if (asset.kind === "spritesheet") {
      return [
        {
          assetId: asset.assetId,
          kind: "spritesheet",
          pages: asset.metadata.pages.map((page) => ({
            outputRole: page.outputRole,
            palette: true,
            colourCount: atlasColourCount(asset.assetId),
            alphaMode: "binary",
          })),
        },
      ];
    }
    return [];
  }),
});

export const studioCompiledArtEvidence = {
  manifest: studioCompiledAssetManifest,
  visualEvidence: studioArtVisualEvidence,
} as const;
