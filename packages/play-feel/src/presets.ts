import type {
  AdventurePlayFeelProfile,
  AdventurePlayFeelProfileId,
  AdventureProductionProfileReference,
} from "./types.js";
import { cinematicPlayFeelProfiles } from "./preset-cinematic.js";
import { foundationPlayFeelProfiles } from "./preset-foundation.js";
import { iconPlayFeelProfiles } from "./preset-icon.js";
import { interactionPlayFeelProfiles } from "./preset-interaction.js";

export const adventurePlayFeelProfiles: readonly AdventurePlayFeelProfile[] = [
  ...foundationPlayFeelProfiles,
  ...iconPlayFeelProfiles,
  ...interactionPlayFeelProfiles,
  ...cinematicPlayFeelProfiles,
];

const profilesById = new Map(
  adventurePlayFeelProfiles.map((profile) => [profile.id, profile] as const),
);

const productionProfileMap: Readonly<
  Record<AdventureProductionProfileReference, AdventurePlayFeelProfileId>
> = {
  "storybook-icon-vga": "storybook-deliberate",
  "comic-scifi-icon-vga": "comic-snappy",
  "gothic-investigation-vga": "gothic-measured",
  "verb-panel-cartoon-vga": "verb-panel-responsive",
  "pulp-archaeology-vga": "pulp-grounded",
  "cinematic-pulp-vga": "cinematic-directed",
  "neo-noir-lowres": "noir-restrained",
};

export const adventurePlayFeelProfileById = (
  id: AdventurePlayFeelProfileId,
): AdventurePlayFeelProfile => {
  const profile = profilesById.get(id);
  if (!profile) throw new RangeError(`Unknown adventure play-feel profile '${id}'.`);
  return profile;
};

export const adventurePlayFeelProfileForProductionProfile = (
  id: AdventureProductionProfileReference,
): AdventurePlayFeelProfile => adventurePlayFeelProfileById(productionProfileMap[id]);

export const adventurePlayFeelProfileIds = (): readonly AdventurePlayFeelProfileId[] =>
  adventurePlayFeelProfiles.map((profile) => profile.id);
