import type { GameLifecycleManifest } from "./lifecycle.js";
import type { LocalisationSourceEntry } from "./localisation-types.js";

export const lifecycleMenuLabelKeys = [
  "quickRetry",
  "loadGame",
  "restartGame",
  "returnToTitle",
  "back",
] as const;
export type LifecycleMenuLabelKey = (typeof lifecycleMenuLabelKeys)[number];

export type LifecycleLocalisationField =
  | "title"
  | "message"
  | `menu.${LifecycleMenuLabelKey}`;

export const lifecycleLocalisationKey = (
  outcomeId: string,
  field: LifecycleLocalisationField,
): string => `lifecycle.${outcomeId}.${field}`;

export const extractLifecycleLocalisableText = (
  manifest: GameLifecycleManifest,
): readonly LocalisationSourceEntry[] => {
  const entries: LocalisationSourceEntry[] = [];

  manifest.outcomes.forEach((outcome, outcomeIndex) => {
    const outcomePath = `lifecycle.outcomes[${outcomeIndex}]`;
    entries.push(
      {
        key: lifecycleLocalisationKey(outcome.id, "title"),
        role: "lifecycle-title",
        ownerId: outcome.id,
        sourcePath: `${outcomePath}.title`,
        text: outcome.title,
      },
      {
        key: lifecycleLocalisationKey(outcome.id, "message"),
        role: "lifecycle-message",
        ownerId: outcome.id,
        sourcePath: `${outcomePath}.message`,
        text: outcome.message,
      },
    );

    for (const label of lifecycleMenuLabelKeys) {
      entries.push({
        key: lifecycleLocalisationKey(outcome.id, `menu.${label}`),
        role: "lifecycle-menu-label",
        ownerId: outcome.id,
        sourcePath: `${outcomePath}.menu.labels.${label}`,
        text: outcome.menu.labels[label],
      });
    }
  });

  return entries.sort((left, right) => left.key.localeCompare(right.key));
};
