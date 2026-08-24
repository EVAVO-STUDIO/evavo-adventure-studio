import type { RuntimeState } from "@evavo/adventure-core";
import type { RuntimeAdventureRpgManifest } from "@evavo/adventure-runtime-bundle/rpg";
import type { AdventureRpgState } from "./rpg.js";

const RPG_VARIABLE_PREFIXES = ["rpg.stat.", "rpg.skill.", "rpg.resource."] as const;
const RPG_FLAG_PREFIX = "rpg.class-tag.";

const withoutRpgProjection = (story: RuntimeState): RuntimeState => ({
  ...story,
  flags: Object.fromEntries(
    Object.entries(story.flags).filter(([key]) => !key.startsWith(RPG_FLAG_PREFIX)),
  ),
  variables: Object.fromEntries(
    Object.entries(story.variables).filter(
      ([key]) =>
        key !== "rpg.day" &&
        key !== "rpg.minute" &&
        key !== "rpg.class" &&
        !RPG_VARIABLE_PREFIXES.some((prefix) => key.startsWith(prefix)),
    ),
  ),
});

export const projectAdventureRpgIntoStory = (
  manifest: RuntimeAdventureRpgManifest,
  rpg: AdventureRpgState,
  story: RuntimeState,
): RuntimeState => {
  const clean = withoutRpgProjection(story);
  const classDefinition = manifest.classes.find((candidate) => candidate.id === rpg.classId);
  if (!classDefinition) throw new Error(`Unknown RPG class '${rpg.classId}'.`);
  const flags: Record<string, boolean> = { ...clean.flags };
  for (const tag of classDefinition.tags ?? []) {
    flags[`${RPG_FLAG_PREFIX}${tag}`] = true;
  }
  const variables: Record<string, string | number | boolean> = {
    ...clean.variables,
    "rpg.day": rpg.day,
    "rpg.minute": rpg.minuteOfDay,
    "rpg.class": rpg.classId,
  };
  for (const [id, value] of Object.entries(rpg.stats)) variables[`rpg.stat.${id}`] = value;
  for (const [id, value] of Object.entries(rpg.skills)) variables[`rpg.skill.${id}`] = value;
  for (const [id, value] of Object.entries(rpg.resources)) variables[`rpg.resource.${id}`] = value;
  return { ...clean, flags, variables };
};
