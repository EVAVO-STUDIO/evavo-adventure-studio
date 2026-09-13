import { cinematicProductionProfiles } from "./production-profile-cinematic-presets.js";
import { iconProductionProfiles } from "./production-profile-icon-presets.js";
import { socialComedyProductionProfiles } from "./production-profile-social-presets.js";
import { specialistProductionProfiles } from "./production-profile-specialist-presets.js";
import type { AdventureProductionProfile } from "./production-profile-types.js";
import { verbProductionProfiles } from "./production-profile-verb-presets.js";

export const adventureProductionProfiles: readonly AdventureProductionProfile[] = [
  ...iconProductionProfiles,
  ...socialComedyProductionProfiles,
  ...specialistProductionProfiles,
  ...verbProductionProfiles,
  ...cinematicProductionProfiles,
];
