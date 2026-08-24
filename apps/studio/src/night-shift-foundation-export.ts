import { createDeterministicStoredZip } from "./deterministic-binary-zip.js";
import { nightShiftFontGeneratedSource, nightShiftFontIndexBytes, nightShiftFontPngBytes } from "./night-shift-font-generated.js";
import { nightShiftActorLightingPaletteBytes } from "./night-shift-foundation-generated.js";
import { nightShiftGeneratedFoundationIcons } from "./night-shift-foundation-icon-outputs.js";
import {
  nightShiftOfficerMasterContract,
  nightShiftOfficerReviewGuide,
  nightShiftOfficerReviewGuidePngBytes,
} from "./night-shift-officer-master-contract.js";
import {
  nightShiftOfficerReviewTemplateFileName,
  nightShiftOfficerReviewTemplateJson,
} from "./night-shift-officer-review-template.js";

export const nightShiftFoundationTechnicalArchiveFileName =
  "night-shift.foundation-technical-sources.zip";

export const createNightShiftFoundationTechnicalArchive = (): Uint8Array => {
  const icons = nightShiftGeneratedFoundationIcons();
  const metadata = {
    manifestVersion: 1,
    projectId: "project.night-shift-director",
    label: "Night Shift generated Foundation technical sources",
    scope: {
      generatedRuntimeSources: [
        "asset.palette.night-shift.actor-lighting",
        "asset.night-shift.font.system",
        ...icons.map((icon) => icon.assetId),
      ],
      stillRequiresAuthoredMaster: ["asset.night-shift.actor.officer"],
    },
    palette: {
      path: "palettes/night-shift-actor-lighting.rgba",
      entries: 128,
      byteLength: 512,
    },
    font: {
      assetId: nightShiftFontGeneratedSource.assetId,
      pngPath: nightShiftFontGeneratedSource.pngPath,
      indexPath: nightShiftFontGeneratedSource.indexPath,
      width: nightShiftFontGeneratedSource.width,
      height: nightShiftFontGeneratedSource.height,
      glyphCount: nightShiftFontGeneratedSource.glyphCount,
      transparentIndex: nightShiftFontGeneratedSource.transparentIndex,
      maximumSourceIndex: nightShiftFontGeneratedSource.maximumSourceIndex,
    },
    icons: icons.map((icon) => ({
      assetId: icon.assetId,
      pngPath: icon.pngPath,
      indexPath: icon.indexPath,
      width: icon.width,
      height: icon.height,
      transparentIndex: icon.transparentIndex,
      maximumSourceIndex: icon.maximumSourceIndex,
    })),
    officer: {
      assetId: nightShiftOfficerMasterContract.assetId,
      authoredSourcePath: nightShiftOfficerMasterContract.sourcePath,
      masterSize: nightShiftOfficerMasterContract.masterSize,
      frameCount: nightShiftOfficerMasterContract.frameCount,
      horizontalStride: nightShiftOfficerMasterContract.horizontalStride,
      reviewGuidePath: `guides/${nightShiftOfficerReviewGuide.fileName}`,
      reviewGuidePurpose: nightShiftOfficerReviewGuide.purpose,
      reviewTemplatePath: `guides/${nightShiftOfficerReviewTemplateFileName}`,
      slots: nightShiftOfficerMasterContract.slots,
      reviewRules: nightShiftOfficerMasterContract.reviewRules,
    },
    warning:
      "This archive supplies reproducible technical sources and non-runtime officer drawing/review guides. Foundation is not complete until the generated sources and final officer art pass production intake and Period VGA review.",
  } as const;

  return createDeterministicStoredZip([
    {
      path: "foundation-generated.json",
      data: new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`),
    },
    {
      path: "palettes/night-shift-actor-lighting.rgba",
      data: nightShiftActorLightingPaletteBytes(),
    },
    {
      path: nightShiftFontGeneratedSource.pngPath,
      data: nightShiftFontPngBytes(),
    },
    {
      path: nightShiftFontGeneratedSource.indexPath,
      data: nightShiftFontIndexBytes(),
    },
    {
      path: `guides/${nightShiftOfficerReviewGuide.fileName}`,
      data: nightShiftOfficerReviewGuidePngBytes(),
    },
    {
      path: `guides/${nightShiftOfficerReviewTemplateFileName}`,
      data: new TextEncoder().encode(nightShiftOfficerReviewTemplateJson()),
    },
    ...icons.flatMap((icon) => [
      { path: icon.pngPath, data: icon.pngBytes },
      { path: icon.indexPath, data: icon.indexBytes },
    ]),
  ]);
};

export const downloadNightShiftFoundationTechnicalArchive = (): void => {
  const zip = new Uint8Array(createNightShiftFoundationTechnicalArchive());
  const url = URL.createObjectURL(new Blob([zip.buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nightShiftFoundationTechnicalArchiveFileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
