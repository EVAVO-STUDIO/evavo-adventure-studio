import { z } from "zod";
import type { AssetBuildManifest } from "@evavo/adventure-asset-contract";
import {
  idSchema,
  type AdventureProject,
  type Id,
} from "@evavo/adventure-project-schema";
import {
  evaluateCompiledArtDirection,
  type ArtAssetRule,
  type ArtDirectionIssue,
  type ArtDirectionManifest,
} from "./index.js";

export const imageAlphaModeSchema = z.enum(["opaque", "binary", "full"]);
export type ImageAlphaMode = z.infer<typeof imageAlphaModeSchema>;

export const artImageVisualEvidenceSchema = z
  .object({
    assetId: idSchema("asset"),
    kind: z.literal("image"),
    palette: z.boolean(),
    colourCount: z.number().int().positive(),
    alphaMode: imageAlphaModeSchema,
  })
  .strict();
export type ArtImageVisualEvidence = z.infer<
  typeof artImageVisualEvidenceSchema
>;

export const artAtlasPageVisualEvidenceSchema = z
  .object({
    outputRole: z.string().min(1),
    palette: z.boolean(),
    colourCount: z.number().int().positive(),
    alphaMode: imageAlphaModeSchema,
  })
  .strict();
export type ArtAtlasPageVisualEvidence = z.infer<
  typeof artAtlasPageVisualEvidenceSchema
>;

export const artSpritesheetVisualEvidenceSchema = z
  .object({
    assetId: idSchema("asset"),
    kind: z.literal("spritesheet"),
    pages: z.array(artAtlasPageVisualEvidenceSchema).min(1),
  })
  .strict();
export type ArtSpritesheetVisualEvidence = z.infer<
  typeof artSpritesheetVisualEvidenceSchema
>;

export const artVisualEvidenceRecordSchema = z.discriminatedUnion("kind", [
  artImageVisualEvidenceSchema,
  artSpritesheetVisualEvidenceSchema,
]);
export type ArtVisualEvidenceRecord = z.infer<
  typeof artVisualEvidenceRecordSchema
>;

export const artVisualEvidenceManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    compilerVersion: z.string().min(1),
    assets: z.array(artVisualEvidenceRecordSchema),
  })
  .strict();
export type ArtVisualEvidenceManifest = z.infer<
  typeof artVisualEvidenceManifestSchema
>;

export const parseArtVisualEvidenceManifest = (
  input: unknown,
): ArtVisualEvidenceManifest => artVisualEvidenceManifestSchema.parse(input);

export type ArtVisualEvidenceIssueCode =
  | "visual-evidence-project-mismatch"
  | "visual-evidence-duplicate-asset"
  | "visual-evidence-missing"
  | "visual-evidence-unexpected"
  | "visual-evidence-kind-mismatch"
  | "visual-evidence-duplicate-page"
  | "visual-evidence-page-missing"
  | "visual-evidence-page-unexpected"
  | "visual-evidence-palette-mismatch"
  | "visual-evidence-colour-budget-exceeded"
  | "visual-evidence-alpha-mismatch";

export interface ArtVisualEvidenceIssue {
  readonly severity: "error";
  readonly code: ArtVisualEvidenceIssueCode;
  readonly path: string;
  readonly message: string;
}

const addIssue = (
  issues: ArtVisualEvidenceIssue[],
  code: ArtVisualEvidenceIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const evidenceById = (
  evidence: ArtVisualEvidenceManifest,
  issues: ArtVisualEvidenceIssue[],
): ReadonlyMap<string, ArtVisualEvidenceRecord> => {
  const records = new Map<string, ArtVisualEvidenceRecord>();
  evidence.assets.forEach((record, index) => {
    if (records.has(record.assetId)) {
      addIssue(
        issues,
        "visual-evidence-duplicate-asset",
        `assets[${index}].assetId`,
        `Visual evidence for '${record.assetId}' is duplicated.`,
      );
    } else {
      records.set(record.assetId, record);
    }
  });
  return records;
};

const resolvedOutputMode = (
  manifest: ArtDirectionManifest,
  rule: ArtAssetRule,
): "indexed" | "rgba" =>
  rule.outputMode === "inherit"
    ? manifest.profile.palette.mode
    : rule.outputMode;

const resolvedMaxColours = (
  manifest: ArtDirectionManifest,
  rule: ArtAssetRule,
): number => rule.maxColours ?? manifest.profile.palette.maxColours;

const resolvedTransparency = (
  manifest: ArtDirectionManifest,
  rule: ArtAssetRule,
): "opaque" | "binary" | "full" =>
  rule.transparency === "inherit"
    ? manifest.profile.transparency
    : rule.transparency;

const alphaMatches = (
  expected: "opaque" | "binary" | "full",
  actual: ImageAlphaMode,
): boolean => {
  switch (expected) {
    case "opaque":
      return actual === "opaque";
    case "binary":
      return actual === "opaque" || actual === "binary";
    case "full":
      return true;
  }
};

const checkPixels = (
  issues: ArtVisualEvidenceIssue[],
  manifest: ArtDirectionManifest,
  rule: ArtAssetRule,
  evidence: {
    readonly palette: boolean;
    readonly colourCount: number;
    readonly alphaMode: ImageAlphaMode;
  },
  path: string,
  label: string,
): void => {
  const mode = resolvedOutputMode(manifest, rule);
  if (
    (mode === "indexed" && !evidence.palette) ||
    (mode === "rgba" && evidence.palette)
  ) {
    addIssue(
      issues,
      "visual-evidence-palette-mismatch",
      `${path}.palette`,
      `${label} is ${evidence.palette ? "indexed" : "RGBA"}; policy requires ${mode}.`,
    );
  }
  const maximum = resolvedMaxColours(manifest, rule);
  if (evidence.colourCount > maximum) {
    addIssue(
      issues,
      "visual-evidence-colour-budget-exceeded",
      `${path}.colourCount`,
      `${label} uses ${evidence.colourCount} colours; policy allows ${maximum}.`,
    );
  }
  const transparency = resolvedTransparency(manifest, rule);
  if (!alphaMatches(transparency, evidence.alphaMode)) {
    addIssue(
      issues,
      "visual-evidence-alpha-mismatch",
      `${path}.alphaMode`,
      `${label} uses '${evidence.alphaMode}' alpha; policy requires '${transparency}'.`,
    );
  }
};

export const evaluateArtDirectionWithVisualEvidence = (
  project: AdventureProject,
  manifest: ArtDirectionManifest,
  compiled: AssetBuildManifest,
  evidence: ArtVisualEvidenceManifest,
): readonly (ArtDirectionIssue | ArtVisualEvidenceIssue)[] => {
  const baseIssues = evaluateCompiledArtDirection(project, manifest, compiled).filter(
    (issue) => issue.code !== "compiled-palette-unverified",
  );
  const issues: ArtVisualEvidenceIssue[] = [];
  if (evidence.projectId !== project.id) {
    addIssue(
      issues,
      "visual-evidence-project-mismatch",
      "projectId",
      `Visual evidence project '${evidence.projectId}' does not match '${project.id}'.`,
    );
  }

  const compiledById = new Map(
    compiled.assets.map((asset) => [asset.assetId as string, asset] as const),
  );
  const records = evidenceById(evidence, issues);
  const rulesById = new Map(
    manifest.assets.map((rule) => [rule.assetId as string, rule] as const),
  );

  for (const rule of manifest.assets) {
    const compiledAsset = compiledById.get(rule.assetId);
    if (!compiledAsset || (compiledAsset.kind !== "image" && compiledAsset.kind !== "spritesheet")) {
      continue;
    }
    const record = records.get(rule.assetId);
    if (!record) {
      addIssue(
        issues,
        "visual-evidence-missing",
        `assets.${rule.assetId}`,
        `Visual pixel evidence for '${rule.assetId}' is missing.`,
      );
      continue;
    }
    if (record.kind !== compiledAsset.kind) {
      addIssue(
        issues,
        "visual-evidence-kind-mismatch",
        `assets.${rule.assetId}.kind`,
        `Visual evidence kind '${record.kind}' does not match compiled '${compiledAsset.kind}'.`,
      );
      continue;
    }
    if (record.kind === "image") {
      checkPixels(
        issues,
        manifest,
        rule,
        record,
        `assets.${rule.assetId}`,
        `Image '${rule.assetId}'`,
      );
      continue;
    }

    const pagesByRole = new Map<string, ArtAtlasPageVisualEvidence>();
    record.pages.forEach((page, pageIndex) => {
      if (pagesByRole.has(page.outputRole)) {
        addIssue(
          issues,
          "visual-evidence-duplicate-page",
          `assets.${rule.assetId}.pages[${pageIndex}].outputRole`,
          `Atlas page evidence '${page.outputRole}' is duplicated.`,
        );
      } else {
        pagesByRole.set(page.outputRole, page);
      }
    });
    const compiledRoles = new Set(
      compiledAsset.metadata.pages.map((page) => page.outputRole),
    );
    for (const page of compiledAsset.metadata.pages) {
      const pageEvidence = pagesByRole.get(page.outputRole);
      if (!pageEvidence) {
        addIssue(
          issues,
          "visual-evidence-page-missing",
          `assets.${rule.assetId}.pages`,
          `Pixel evidence for atlas page '${page.outputRole}' is missing.`,
        );
        continue;
      }
      checkPixels(
        issues,
        manifest,
        rule,
        pageEvidence,
        `assets.${rule.assetId}.pages.${page.outputRole}`,
        `Atlas page '${rule.assetId}/${page.outputRole}'`,
      );
    }
    for (const page of record.pages) {
      if (!compiledRoles.has(page.outputRole)) {
        addIssue(
          issues,
          "visual-evidence-page-unexpected",
          `assets.${rule.assetId}.pages.${page.outputRole}`,
          `Visual evidence references unknown atlas page '${page.outputRole}'.`,
        );
      }
    }
  }

  evidence.assets.forEach((record, index) => {
    if (!rulesById.has(record.assetId)) {
      addIssue(
        issues,
        "visual-evidence-unexpected",
        `assets[${index}].assetId`,
        `Visual evidence references asset '${record.assetId}' without an art rule.`,
      );
    }
  });

  return [...baseIssues, ...issues];
};
