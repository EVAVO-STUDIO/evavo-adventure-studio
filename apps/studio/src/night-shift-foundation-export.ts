import { createDeterministicStoredZip } from "./deterministic-binary-zip.js";
import { nightShiftActorLightingPaletteBytes } from "./night-shift-foundation-generated.js";
import { nightShiftGeneratedFoundationIcons } from "./night-shift-foundation-icon-outputs.js";

export const nightShiftFoundationTechnicalArchiveFileName =
  "night-shift.foundation-technical-sources.zip";

export const createNightShiftFoundationTechnicalArchive = (): Uint8Array => {
  const icons = nightShiftGeneratedFoundationIcons();
  const metadata = {
    manifestVersion: 1,
    projectId: "project.night-shift-director",
    label: "Night Shift generated Foundation technical sources",
    scope: {
      generated: [
        "asset.palette.night-shift.actor-lighting",
        ...icons.map((icon) => icon.assetId),
      ],
      stillRequiresAuthoredMaster: [
        "asset.night-shift.font.system",
        "asset.night-shift.actor.officer",
      ],
    },
    palette: {
      path: "palettes/night-shift-actor-lighting.rgba",
      entries: 128,
      byteLength: 512,
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
    warning:
      "This archive supplies reproducible technical sources only. Foundation is not complete until the bitmap-font and officer masters pass production intake and Period VGA review.",
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
