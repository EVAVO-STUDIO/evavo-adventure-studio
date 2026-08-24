import { createDeterministicStoredZip } from "./deterministic-binary-zip.js";
import {
  nightShiftStationCompositionGuide,
  nightShiftStationCompositionGuidePngBytes,
} from "./night-shift-station-composition-guide.js";
import {
  nightShiftStationProductionPacketFileName,
  nightShiftStationProductionPacketJson,
} from "./night-shift-station-production-packet.js";

export const nightShiftStationHandoffArchiveFileName =
  "night-shift.station-production-handoff.zip";

export const createNightShiftStationHandoffArchive = (): Uint8Array => {
  const summary = {
    manifestVersion: 1,
    projectId: "project.night-shift-director",
    sceneId: "scene.night-shift.station",
    packetPath: nightShiftStationProductionPacketFileName,
    compositionGuidePath: `guides/${nightShiftStationCompositionGuide.fileName}`,
    runtimeAsset: false,
    purpose:
      "Station production handoff derived from canonical project/composition/staging/audio data. Guide pixels are production-reference only and must not ship in the runtime bundle.",
  } as const;

  return createDeterministicStoredZip([
    {
      path: "station-handoff.json",
      data: new TextEncoder().encode(`${JSON.stringify(summary, null, 2)}\n`),
    },
    {
      path: nightShiftStationProductionPacketFileName,
      data: new TextEncoder().encode(nightShiftStationProductionPacketJson()),
    },
    {
      path: `guides/${nightShiftStationCompositionGuide.fileName}`,
      data: nightShiftStationCompositionGuidePngBytes(),
    },
  ]);
};

export const downloadNightShiftStationHandoffArchive = (): void => {
  const zip = new Uint8Array(createNightShiftStationHandoffArchive());
  const url = URL.createObjectURL(new Blob([zip.buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nightShiftStationHandoffArchiveFileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
