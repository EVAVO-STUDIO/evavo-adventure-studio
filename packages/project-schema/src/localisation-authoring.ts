import type { AdventureProject, Id } from "./index.js";
import { extractLocalisableText } from "./localisation-extract.js";
import { localeKey } from "./localisation-resolve.js";
import { collectLocalisationSourceEntries } from "./localisation-supplemental.js";
import { localisationManifestSchema } from "./localisation-types.js";
import type {
  LocalisationEntry,
  LocalisationLocale,
  LocalisationManifest,
  LocalisationSourceEntry,
  LocalisationStatus,
} from "./localisation-types.js";

export interface LocalisationTargetDefinition {
  readonly locale: string;
  readonly label?: string;
  readonly status?: LocalisationStatus;
  readonly fallbackLocale?: string;
}

export const createLocalisationTemplate = (
  project: AdventureProject,
  sourceLocale: string,
  targets: readonly LocalisationTargetDefinition[],
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): LocalisationManifest => {
  const sourceEntries = collectLocalisationSourceEntries(project, supplementalSourceEntries);
  return localisationManifestSchema.parse({
    manifestVersion: 1,
    projectId: project.id,
    sourceLocale,
    locales: targets.map((target) => ({
      locale: target.locale,
      ...(target.label === undefined ? {} : { label: target.label }),
      status: target.status ?? "draft",
      ...(target.fallbackLocale === undefined ? {} : { fallbackLocale: target.fallbackLocale }),
      entries: sourceEntries.map((entry) => ({ key: entry.key, text: "" })),
    })),
  }) as LocalisationManifest;
};

export const canonicaliseLocalisationManifest = (
  manifest: LocalisationManifest,
): LocalisationManifest => ({
  ...manifest,
  locales: manifest.locales
    .map((locale) => ({
      ...locale,
      entries: [...locale.entries].sort((left, right) => left.key.localeCompare(right.key)),
    }))
    .sort((left, right) => localeKey(left.locale).localeCompare(localeKey(right.locale))),
});

export const upsertLocalisationEntry = (
  manifest: LocalisationManifest,
  localeTag: string,
  key: string,
  text: string,
): LocalisationManifest => {
  const targetTag = localeKey(localeTag);
  let found = false;
  const locales = manifest.locales.map((locale) => {
    if (localeKey(locale.locale) !== targetTag) return locale;
    found = true;
    const existingIndex = locale.entries.findIndex((entry) => entry.key === key);
    const entries = [...locale.entries];
    const nextEntry: LocalisationEntry = { key, text };
    if (existingIndex === -1) entries.push(nextEntry);
    else entries[existingIndex] = nextEntry;
    return { ...locale, entries };
  });
  if (!found) throw new Error(`Localisation locale '${localeTag}' does not exist.`);
  return canonicaliseLocalisationManifest({ ...manifest, locales });
};

export const localisationLocaleByTag = (
  manifest: LocalisationManifest,
  localeTag: string,
): LocalisationLocale => {
  const locale = manifest.locales.find(
    (candidate) => localeKey(candidate.locale) === localeKey(localeTag),
  );
  if (!locale) throw new Error(`Localisation locale '${localeTag}' does not exist.`);
  return locale;
};

export const localisationSourceByKey = (
  project: AdventureProject,
  key: string,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): LocalisationSourceEntry => {
  const entries =
    supplementalSourceEntries.length === 0
      ? extractLocalisableText(project)
      : collectLocalisationSourceEntries(project, supplementalSourceEntries);
  const entry = entries.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`Localisation key '${key}' does not exist.`);
  return entry;
};

export const localisationProjectId = (manifest: LocalisationManifest): Id<"project"> => manifest.projectId;
