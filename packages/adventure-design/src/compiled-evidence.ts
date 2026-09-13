import type { ArtDirectionManifest } from "@evavo/adventure-art-direction";
import {
  type ArtVisualEvidenceManifest,
  type ArtVisualEvidenceRecord,
  evaluateArtDirectionWithVisualEvidence,
} from "@evavo/adventure-art-direction/evidence";
import type { AssetBuildManifest, CompiledAssetRecord } from "@evavo/adventure-asset-contract";
import { type BitmapFontManifest, validateBitmapFontManifest } from "@evavo/adventure-bitmap-font";
import type { AdventureProject, Id, Rectangle } from "@evavo/adventure-project-schema";
import { type UiSkin, type UiSkinManifest, validateUiSkinManifest } from "@evavo/adventure-ui-skin";
import type { AdventureAuthenticitySeverity } from "./authenticity-types.js";
import type { AdventureDesignDocument } from "./types.js";
import { validateAdventureDesignAgainstProject } from "./validation.js";

export type AdventureCompiledEvidenceArea =
  | "project-identity"
  | "native-output"
  | "compiled-contracts"
  | "backgrounds"
  | "actors"
  | "bitmap-fonts"
  | "interface";
export type AdventureCompiledEvidenceStatus = "ready" | "attention" | "blocked";

export interface AdventureCompiledEvidenceFinding {
  readonly id: string;
  readonly area: AdventureCompiledEvidenceArea;
  readonly severity: AdventureAuthenticitySeverity;
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

export interface AdventureCompiledEvidenceMetrics {
  readonly requiredVisualAssets: number;
  readonly compiledVisualAssets: number;
  readonly pixelEvidenceAssets: number;
  readonly backgroundAssets: number;
  readonly actorAtlases: number;
  readonly bitmapFonts: number;
  readonly uiSkins: number;
}

export interface AdventureCompiledEvidenceReport {
  readonly reportVersion: 1;
  readonly status: AdventureCompiledEvidenceStatus;
  readonly verified: boolean;
  readonly coveragePercent: number;
  readonly metrics: AdventureCompiledEvidenceMetrics;
  readonly findings: readonly AdventureCompiledEvidenceFinding[];
}

export interface AdventureCompiledEvidenceBundle {
  readonly project: AdventureProject;
  readonly artDirection: ArtDirectionManifest;
  readonly compiledAssets: AssetBuildManifest;
  readonly visualEvidence: ArtVisualEvidenceManifest;
  readonly bitmapFonts?: BitmapFontManifest;
  readonly uiSkins?: UiSkinManifest;
}

export interface AdventureAuthenticityEvidenceRequirement {
  readonly id: string;
  readonly label: string;
  readonly artifact: string;
  readonly required: boolean;
  readonly rationale: string;
}

interface ValidatorIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

const severityOrder = { error: 0, warning: 1, note: 2 } as const;
const add = (
  findings: AdventureCompiledEvidenceFinding[],
  finding: AdventureCompiledEvidenceFinding,
): void => {
  findings.push(finding);
};

const appendIssues = (
  findings: AdventureCompiledEvidenceFinding[],
  prefix: string,
  area: AdventureCompiledEvidenceArea,
  issues: readonly ValidatorIssue[],
  recommendation: string,
): void => {
  for (const issue of issues) {
    add(findings, {
      id: `${prefix}-${issue.code}`,
      area,
      severity: issue.severity,
      path: issue.path,
      message: issue.message,
      recommendation,
    });
  }
};

const byAssetId = <T extends { readonly assetId: unknown }>(assets: readonly T[]): ReadonlyMap<string, T> =>
  new Map(assets.map((asset) => [String(asset.assetId), asset] as const));

const visualPasses = (
  record: ArtVisualEvidenceRecord | undefined,
  maximumColours: number,
  alpha: "opaque" | "binary",
): boolean => {
  if (!record) return false;
  const pages = record.kind === "image" ? [record] : record.pages;
  return pages.every(
    (page) => page.palette && page.colourCount <= maximumColours && page.alphaMode === alpha,
  );
};

const actorAssetIds = (project: AdventureProject): ReadonlySet<string> =>
  new Set(project.actors.flatMap((actor) => actor.frames.map((frame) => frame.assetId as string)));

const persistentRegions = (skin: UiSkin): readonly Rectangle[] => [
  skin.status.rect,
  ...(skin.score ? [skin.score.rect] : []),
  ...(skin.verbBar ? [skin.verbBar.region.rect] : []),
  ...(skin.inventory ? [skin.inventory.region.rect] : []),
  ...(skin.parser ? [skin.parser.region.rect] : []),
];

const persistentCoverage = (skin: UiSkin): number => {
  const canvas = skin.nativeSize.width * skin.nativeSize.height;
  const occupied = persistentRegions(skin).reduce((total, rect) => total + rect.width * rect.height, 0);
  return canvas <= 0 ? 1 : occupied / canvas;
};

const uniqueSorted = (
  findings: readonly AdventureCompiledEvidenceFinding[],
): readonly AdventureCompiledEvidenceFinding[] => {
  const unique = new Map<string, AdventureCompiledEvidenceFinding>();
  for (const finding of findings) {
    unique.set([finding.id, finding.area, finding.path, finding.message].join("|"), finding);
  }
  return [...unique.values()].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.area.localeCompare(right.area) ||
      left.path.localeCompare(right.path) ||
      left.id.localeCompare(right.id),
  );
};

export const createAdventureAuthenticityEvidenceRequirements = (
  document: AdventureDesignDocument,
): readonly AdventureAuthenticityEvidenceRequirement[] => [
  {
    id: "canonical-project",
    label: "Canonical project",
    artifact: "project.json",
    required: true,
    rationale: "Proves native canvas, scenes, actors, inventory and narrative identity.",
  },
  {
    id: "art-direction",
    label: "Art-direction policy",
    artifact: "art-direction.json",
    required: true,
    rationale: `Proves that ${document.creativeDirection.productionMode} rules are executable policy.`,
  },
  {
    id: "asset-build",
    label: "Compiled asset manifest",
    artifact: "assets.manifest.json",
    required: true,
    rationale: "Proves exact dimensions, atlas geometry and source-to-output identity.",
  },
  {
    id: "pixel-evidence",
    label: "Encoded pixel evidence",
    artifact: "art-evidence.json",
    required: true,
    rationale: "Proves indexed colour counts and alpha from encoded PNG output.",
  },
  {
    id: "bitmap-fonts",
    label: "Bitmap-font manifest",
    artifact: "bitmap-fonts.json",
    required: true,
    rationale: "Proves authored glyph atlases, metrics and fallback coverage.",
  },
  {
    id: "ui-skins",
    label: "Interface-skin manifest",
    artifact: "ui-skins.json",
    required: true,
    rationale: "Proves native UI geometry, interaction mode and bitmap-font roles.",
  },
];

export const evaluateAdventureCompiledEvidence = (
  document: AdventureDesignDocument,
  bundle: AdventureCompiledEvidenceBundle,
): AdventureCompiledEvidenceReport => {
  const findings: AdventureCompiledEvidenceFinding[] = [];
  const { project, artDirection, compiledAssets, visualEvidence } = bundle;
  const expectedProjectId = String(document.projectId);
  const identities = [
    ["project.id", project.id],
    ["artDirection.projectId", artDirection.projectId],
    ["compiledAssets.projectId", compiledAssets.projectId],
    ["visualEvidence.projectId", visualEvidence.projectId],
    ...(bundle.bitmapFonts ? [["bitmapFonts.projectId", bundle.bitmapFonts.projectId] as const] : []),
    ...(bundle.uiSkins ? [["uiSkins.projectId", bundle.uiSkins.projectId] as const] : []),
  ] as const;
  for (const [path, identity] of identities) {
    if (String(identity) !== expectedProjectId) {
      add(findings, {
        id: "evidence-project-mismatch",
        area: "project-identity",
        severity: "error",
        path,
        message: `Artifact project '${identity}' does not match '${expectedProjectId}'.`,
        recommendation: "Regenerate every artifact from the same canonical project.",
      });
    }
  }

  appendIssues(
    findings,
    "design-project",
    "project-identity",
    validateAdventureDesignAgainstProject(project, document),
    "Repair design-to-project references before judging compiled evidence.",
  );
  appendIssues(
    findings,
    "art-evidence",
    "compiled-contracts",
    evaluateArtDirectionWithVisualEvidence(project, artDirection, compiledAssets, visualEvidence),
    "Rebuild the affected asset and regenerate its pixel evidence.",
  );

  const native = document.creativeDirection.nativeSize;
  const projectNative = project.presentation;
  const artNative = artDirection.profile.nativeSize;
  if (
    projectNative.nativeWidth !== native.width ||
    projectNative.nativeHeight !== native.height ||
    artNative.width !== native.width ||
    artNative.height !== native.height
  ) {
    add(findings, {
      id: "evidence-native-size-mismatch",
      area: "native-output",
      severity: "error",
      path: "creativeDirection.nativeSize",
      message: "Design, project and art policy do not share one native canvas.",
      recommendation: "Align all three before producing or reviewing assets.",
    });
  }
  if (
    !projectNative.integerScale ||
    projectNative.textureSampling !== "nearest" ||
    !artDirection.profile.integerScaleRequired ||
    !artDirection.profile.nearestSamplingRequired
  ) {
    add(findings, {
      id: "evidence-native-presentation-soft",
      area: "native-output",
      severity: "error",
      path: "project.presentation",
      message: "The packaged canvas is not protected by integer nearest-neighbour policy.",
      recommendation: "Require integer scaling and nearest sampling in project and art policy.",
    });
  }
  if (projectNative.pixelMotionPolicy === "free") {
    add(findings, {
      id: "evidence-pixel-motion-free",
      area: "native-output",
      severity: "warning",
      path: "project.presentation.pixelMotionPolicy",
      message: "The runtime permits unrestricted subpixel motion on a native-pixel canvas.",
      recommendation: "Use strict or camera-strict motion, or document the exception.",
    });
  }
  if (native.width === 320 && native.height === 200 && artDirection.profile.palette.mode !== "indexed") {
    add(findings, {
      id: "evidence-vga-not-indexed",
      area: "native-output",
      severity: "error",
      path: "artDirection.profile.palette.mode",
      message: "The 320 × 200 production is compiling through an RGBA profile.",
      recommendation: "Use an indexed profile and prove page-level colour counts.",
    });
  }

  const compiled = byAssetId<CompiledAssetRecord>(compiledAssets.assets);
  const visual = byAssetId<ArtVisualEvidenceRecord>(visualEvidence.assets);
  const budget = document.creativeDirection.palette.maxColours;
  const backgrounds = new Set(project.scenes.map((scene) => String(scene.backgroundAssetId)));
  project.scenes.forEach((scene, index) => {
    const assetId = String(scene.backgroundAssetId);
    const asset = compiled.get(assetId);
    if (
      !asset ||
      asset.kind !== "image" ||
      asset.metadata.width !== scene.width ||
      asset.metadata.height !== scene.height
    ) {
      add(findings, {
        id: "evidence-background-contract-invalid",
        area: "backgrounds",
        severity: "error",
        path: `project.scenes[${index}].backgroundAssetId`,
        message: `Background '${assetId}' lacks exact compiled image dimensions.`,
        recommendation: "Compile one exact native image without resampling or cropping.",
      });
    }
    if (!visualPasses(visual.get(assetId), budget, "opaque")) {
      add(findings, {
        id: "evidence-background-pixels-invalid",
        area: "backgrounds",
        severity: "error",
        path: `visualEvidence.${assetId}`,
        message: `Background '${assetId}' lacks indexed, opaque, budgeted pixel proof.`,
        recommendation: "Correct its palette or alpha and regenerate encoded evidence.",
      });
    }
  });

  const actorAssets = actorAssetIds(project);
  for (const assetId of actorAssets) {
    const asset = compiled.get(assetId);
    if (!asset || asset.kind !== "spritesheet") {
      add(findings, {
        id: "evidence-actor-atlas-missing",
        area: "actors",
        severity: "error",
        path: `compiledAssets.${assetId}`,
        message: `Actor asset '${assetId}' is not a compiled spritesheet.`,
        recommendation: "Compile complete actor frames into a padded deterministic atlas.",
      });
      continue;
    }
    const authored = new Set(
      project.actors.flatMap((actor) =>
        actor.frames.filter((frame) => String(frame.assetId) === assetId).map((frame) => String(frame.id)),
      ),
    );
    const built = new Set(asset.metadata.frames.map((frame) => String(frame.frameId)));
    if ([...authored].some((frameId) => !built.has(frameId))) {
      add(findings, {
        id: "evidence-actor-frame-missing",
        area: "actors",
        severity: "error",
        path: `compiledAssets.${assetId}.metadata.frames`,
        message: `Actor atlas '${assetId}' omits authored frames.`,
        recommendation: "Rebuild from the complete actor frame set.",
      });
    }
    if (asset.metadata.frames.some((frame) => frame.padding < 1)) {
      add(findings, {
        id: "evidence-actor-padding-missing",
        area: "actors",
        severity: "error",
        path: `compiledAssets.${assetId}.metadata.frames`,
        message: `Actor atlas '${assetId}' lacks one-pixel bleed protection.`,
        recommendation: "Repack with transparent padding around every frame.",
      });
    }
    if (!visualPasses(visual.get(assetId), budget, "binary")) {
      add(findings, {
        id: "evidence-actor-pixels-invalid",
        area: "actors",
        severity: "error",
        path: `visualEvidence.${assetId}`,
        message: `Actor atlas '${assetId}' lacks indexed binary-alpha pixel proof.`,
        recommendation: "Remove soft alpha or palette drift and regenerate evidence.",
      });
    }
  }

  const fonts = bundle.bitmapFonts;
  if (!fonts) {
    add(findings, {
      id: "evidence-bitmap-fonts-missing",
      area: "bitmap-fonts",
      severity: "warning",
      path: "bitmapFonts",
      message: "No bitmap-font manifest was supplied.",
      recommendation: "Load the canonical bitmap-font manifest and atlas evidence.",
    });
  } else {
    appendIssues(
      findings,
      "bitmap-font",
      "bitmap-fonts",
      validateBitmapFontManifest(project, fonts),
      "Repair bitmap glyphs, metrics or fallback coverage and rebuild the atlas.",
    );
    fonts.fonts.forEach((font, index) => {
      if (new Set(font.glyphs.map((glyph) => glyph.codePoint)).size < 64) {
        add(findings, {
          id: "evidence-font-coverage-thin",
          area: "bitmap-fonts",
          severity: "warning",
          path: `bitmapFonts.fonts[${index}].glyphs`,
          message: `Bitmap font '${font.id}' has fewer than 64 distinct glyphs.`,
          recommendation: "Prove the dialogue, punctuation and UI character set.",
        });
      }
      if (!visualPasses(visual.get(String(font.atlasAssetId)), budget, "binary")) {
        add(findings, {
          id: "evidence-font-pixels-invalid",
          area: "bitmap-fonts",
          severity: "error",
          path: `visualEvidence.${font.atlasAssetId}`,
          message: `Font atlas '${font.atlasAssetId}' lacks indexed binary-alpha proof.`,
          recommendation: "Recompile the glyph atlas and regenerate pixel evidence.",
        });
      }
    });
  }

  const skins = bundle.uiSkins;
  if (!skins) {
    add(findings, {
      id: "evidence-ui-skins-missing",
      area: "interface",
      severity: "warning",
      path: "uiSkins",
      message: "No interface-skin manifest was supplied.",
      recommendation: "Load the native UI skin and bitmap-font roles.",
    });
  } else {
    appendIssues(
      findings,
      "ui-skin",
      "interface",
      validateUiSkinManifest(project, fonts ?? null, skins),
      "Repair native UI geometry, interaction mode, icons or font bindings.",
    );
    const skin = skins.skins.find((candidate) => candidate.id === skins.defaultSkinId);
    if (skin && persistentCoverage(skin) > 0.45) {
      add(findings, {
        id: "evidence-ui-playfield-crowded",
        area: "interface",
        severity: "warning",
        path: `uiSkins.${skin.id}`,
        message: "Persistent UI consumes more than 45% of the native canvas.",
        recommendation: "Reduce chrome or prove the remaining playfield stays readable.",
      });
    }
  }

  const required = project.assets.filter((asset) => asset.kind === "image" || asset.kind === "spritesheet");
  const compiledCount = required.filter((asset) => compiled.has(String(asset.id))).length;
  const evidenceCount = required.filter((asset) => visual.has(String(asset.id))).length;
  const coveragePercent = required.length === 0 ? 100 : Math.round((evidenceCount / required.length) * 100);
  const ordered = uniqueSorted(findings);
  const status: AdventureCompiledEvidenceStatus = ordered.some((finding) => finding.severity === "error")
    ? "blocked"
    : ordered.some((finding) => finding.severity === "warning")
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    status,
    verified: status === "ready" && coveragePercent === 100,
    coveragePercent,
    metrics: {
      requiredVisualAssets: required.length,
      compiledVisualAssets: compiledCount,
      pixelEvidenceAssets: evidenceCount,
      backgroundAssets: backgrounds.size,
      actorAtlases: actorAssets.size,
      bitmapFonts: fonts?.fonts.length ?? 0,
      uiSkins: skins?.skins.length ?? 0,
    },
    findings: ordered,
  };
};
