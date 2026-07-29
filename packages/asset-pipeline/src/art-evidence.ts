import {
  artImageVisualEvidenceSchema,
  artSpritesheetVisualEvidenceSchema,
  artVisualEvidenceManifestSchema,
  type ArtImageVisualEvidence,
  type ArtSpritesheetVisualEvidence,
  type ArtVisualEvidenceManifest,
  type ArtVisualEvidenceRecord,
} from "@evavo/adventure-art-direction/evidence";
import type { Id } from "@evavo/adventure-project-schema";
import type { CompiledAtlas } from "./atlas-compiler.js";
import type { CompiledImage } from "./index.js";
import { analysePngEvidence } from "./png-evidence.js";

export const createImageArtVisualEvidence = async (
  compiled: CompiledImage,
): Promise<ArtImageVisualEvidence> => {
  const evidence = await analysePngEvidence(compiled.data);
  return artImageVisualEvidenceSchema.parse({
    assetId: compiled.manifest.assetId,
    kind: "image",
    ...evidence,
  });
};

export const createSpritesheetArtVisualEvidence = async (
  assetId: Id<"asset">,
  compiled: CompiledAtlas,
): Promise<ArtSpritesheetVisualEvidence> =>
  artSpritesheetVisualEvidenceSchema.parse({
    assetId,
    kind: "spritesheet",
    pages: await Promise.all(
      [...compiled.pages]
        .sort((left, right) => left.index - right.index)
        .map(async (page) => ({
          outputRole: `page-${page.index.toString().padStart(3, "0")}`,
          ...(await analysePngEvidence(page.data)),
        })),
    ),
  });

export const createArtVisualEvidenceManifest = (
  projectId: Id<"project">,
  assets: readonly ArtVisualEvidenceRecord[],
  compilerVersion = "0.1.0",
): ArtVisualEvidenceManifest => {
  if (!compilerVersion.trim()) {
    throw new RangeError("Art visual evidence compiler version cannot be empty.");
  }
  return artVisualEvidenceManifestSchema.parse({
    manifestVersion: 1,
    projectId,
    compilerVersion,
    assets: [...assets].sort((left, right) =>
      left.assetId.localeCompare(right.assetId),
    ),
  });
};
