import type { ClassicFrontEndManifest } from "./front-end.js";
import type { LocalisationSourceEntry } from "./localisation-types.js";

export const frontEndMenuLabelKeys = [
  "newGame",
  "continueGame",
  "loadGame",
  "options",
  "credits",
  "quit",
  "quickSave",
  "back",
  "fullscreen",
] as const;
export type FrontEndMenuLabelKey = (typeof frontEndMenuLabelKeys)[number];

export type FrontEndLocalisationField =
  | "publisher.name"
  | "publisher.presents"
  | "title.kicker"
  | `menu.${FrontEndMenuLabelKey}`
  | `credits.line.${number}`;

export const frontEndLocalisationKey = (
  field: FrontEndLocalisationField,
): string => `frontEnd.${field}`;

export const extractFrontEndLocalisableText = (
  manifest: ClassicFrontEndManifest,
): readonly LocalisationSourceEntry[] => {
  const ownerId = manifest.projectId as string;
  const entries: LocalisationSourceEntry[] = [
    {
      key: frontEndLocalisationKey("publisher.name"),
      role: "front-end-publisher",
      ownerId,
      sourcePath: "frontEnd.publisher.name",
      text: manifest.publisher.name,
    },
    {
      key: frontEndLocalisationKey("publisher.presents"),
      role: "front-end-publisher",
      ownerId,
      sourcePath: "frontEnd.publisher.presents",
      text: manifest.publisher.presents,
    },
    {
      key: frontEndLocalisationKey("title.kicker"),
      role: "front-end-title",
      ownerId,
      sourcePath: "frontEnd.title.kicker",
      text: manifest.title.kicker,
    },
  ];

  for (const label of frontEndMenuLabelKeys) {
    entries.push({
      key: frontEndLocalisationKey(`menu.${label}`),
      role: "front-end-menu-label",
      ownerId,
      sourcePath: `frontEnd.menu.labels.${label}`,
      text: manifest.menu.labels[label],
    });
  }

  manifest.credits.lines.forEach((line, index) => {
    entries.push({
      key: frontEndLocalisationKey(`credits.line.${index}`),
      role: "front-end-credit",
      ownerId,
      sourcePath: `frontEnd.credits.lines[${index}]`,
      text: line,
    });
  });

  return entries.sort((left, right) => left.key.localeCompare(right.key));
};
