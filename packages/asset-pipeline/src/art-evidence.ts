import {
  type ArtImageVisualEvidence,
  type ArtSpritesheetVisualEvidence,
  type ArtVisualEvidenceManifest,
  type ArtVisualEvidenceRecord,
  artImageVisualEvidenceSchema,
  artSpritesheetVisualEvidenceSchema,
  artVisualEvidenceManifestSchema,
} from "@evavo/adventure-art-direction/evidence";
import type { AssetBuildManifest, CompiledOutputFile } from "@evavo/adventure-asset-contract";
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
    assets: [...assets].sort((left, right) => left.assetId.localeCompare(right.assetId)),
  });
};

export type CompiledArtOutputReader = (
  assetId: Id<"asset">,
  output: CompiledOutputFile,
) => Promise<Uint8Array>;

const outputByRole = (
  outputs: readonly CompiledOutputFile[],
  role: string,
  assetId: Id<"asset">,
): CompiledOutputFile => {
  const output = outputs.find((candidate) => candidate.role === role);
  if (!output) {
    throw new Error(`Compiled asset '${assetId}' has no output role '${role}'.`);
  }
  return output;
};

export const createArtVisualEvidenceFromAssetManifest = async (
  manifest: AssetBuildManifest,
  readOutput: CompiledArtOutputReader,
  compilerVersion = manifest.compilerVersion,
): Promise<ArtVisualEvidenceManifest> => {
  const records: ArtVisualEvidenceRecord[] = [];

  for (const asset of [...manifest.assets].sort((left, right) => left.assetId.localeCompare(right.assetId))) {
    if (asset.kind === "image") {
      const output = outputByRole(asset.outputFiles, "primary", asset.assetId);
      const evidence = await analysePngEvidence(await readOutput(asset.assetId, output));
      records.push(
        artImageVisualEvidenceSchema.parse({
          assetId: asset.assetId,
          kind: "image",
          ...evidence,
        }),
      );
      continue;
    }

    if (asset.kind === "spritesheet") {
      const pages = [];
      for (const page of [...asset.metadata.pages].sort((left, right) =>
        left.outputRole.localeCompare(right.outputRole),
      )) {
        const output = outputByRole(asset.outputFiles, page.outputRole, asset.assetId);
        pages.push({
          outputRole: page.outputRole,
          ...(await analysePngEvidence(await readOutput(asset.assetId, output))),
        });
      }
      records.push(
        artSpritesheetVisualEvidenceSchema.parse({
          assetId: asset.assetId,
          kind: "spritesheet",
          pages,
        }),
      );
    }
  }

  return createArtVisualEvidenceManifest(manifest.projectId, records, compilerVersion);
};
