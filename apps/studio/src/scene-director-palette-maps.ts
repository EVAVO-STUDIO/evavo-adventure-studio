import { paletteMapManifestSchema } from "@evavo/adventure-scene-instances/palette-maps";
import { nightShiftDirectorProject } from "./night-shift-director-fixture.js";
import { studioProject } from "./fixture.js";

export const redLedgerDirectorPaletteMaps = paletteMapManifestSchema.parse({
  manifestVersion: 1,
  projectId: studioProject.id,
  maps: [
    {
      id: "palette-map.office-lamp-warm",
      paletteAssetId: "asset.palette.red-ledger.actor-lighting",
      paletteOffset: 64,
      description: "Warm desk-lamp actor ramp for the office pool.",
    },
    {
      id: "palette-map.alley-cool-shadow",
      paletteAssetId: "asset.palette.red-ledger.actor-lighting",
      paletteOffset: 96,
      description: "Cool wet-alley shadow ramp for actors and world props.",
    },
  ],
});

export const nightShiftDirectorPaletteMaps = paletteMapManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftDirectorProject.id,
  maps: [
    {
      id: "palette-map.night-shift.station-fluorescent",
      paletteAssetId: "asset.palette.night-shift.actor-lighting",
      paletteOffset: 32,
      description: "Cool municipal fluorescent actor ramp.",
    },
    {
      id: "palette-map.night-shift.roadside-headlamp",
      paletteAssetId: "asset.palette.night-shift.actor-lighting",
      paletteOffset: 64,
      description: "Headlamp-warm roadside ramp entered through ordered Bayer transition.",
    },
    {
      id: "palette-map.night-shift.diner-warm",
      paletteAssetId: "asset.palette.night-shift.actor-lighting",
      paletteOffset: 96,
      description: "Muted diner practical ramp for late-night faces, paper and cream surfaces.",
    },
  ],
});
