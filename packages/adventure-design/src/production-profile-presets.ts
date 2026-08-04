import type { AdventureProductionProfile } from "./production-profile-types.js";
import { cinematicProductionProfiles } from "./production-profile-cinematic-presets.js";
import { iconProductionProfiles } from "./production-profile-icon-presets.js";
import { verbProductionProfiles } from "./production-profile-verb-presets.js";

export const adventureProductionProfiles: readonly AdventureProductionProfile[] = [
  ...iconProductionProfiles,
  ...verbProductionProfiles,
  ...cinematicProductionProfiles,
];
