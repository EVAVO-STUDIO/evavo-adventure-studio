import type { AdventureProject } from "./index.js";
import { extractLocalisableText } from "./localisation-extract.js";
import type {
  LocalisationEntry,
  LocalisationLocale,
  LocalisationManifest,
  LocalisationSourceEntry,
  LocalisationStatus,
} from "./localisation-types.js";

export const localeKey = (locale: string): string => locale.toLowerCase();

export interface LocalisationMaps {
  readonly sourceByKey: ReadonlyMap<string, LocalisationSourceEntry>;
  readonly localeByTag: ReadonlyMap<string, LocalisationLocale>;
  readonly entriesByLocale: ReadonlyMap<string, ReadonlyMap<string, LocalisationEntry>>;
}

export const buildLocalisationMaps = (
  project: AdventureProject,
  manifest: LocalisationManifest,
): LocalisationMaps => {
  const sourceByKey = new Map<string, LocalisationSourceEntry>();
  for (const entry of extractLocalisableText(project)) {
    if (!sourceByKey.has(entry.key)) sourceByKey.set(entry.key, entry);
  }

  const localeByTag = new Map<string, LocalisationLocale>();
  const entriesByLocale = new Map<string, ReadonlyMap<string, LocalisationEntry>>();
  for (const locale of manifest.locales) {
    const tag = localeKey(locale.locale);
    if (localeByTag.has(tag)) continue;
    localeByTag.set(tag, locale);
    const entries = new Map<string, LocalisationEntry>();
    for (const entry of locale.entries) {
      if (!entries.has(entry.key)) entries.set(entry.key, entry);
    }
    entriesByLocale.set(tag, entries);
  }
  return { sourceByKey, localeByTag, entriesByLocale };
};

export interface ResolvedLocalisedText {
  readonly key: string;
  readonly text: string;
  readonly requestedLocale: string;
  readonly resolvedLocale: string;
  readonly sourceFallback: boolean;
  readonly fallbackDepth: number;
}

export const resolveFromMaps = (
  manifest: LocalisationManifest,
  maps: LocalisationMaps,
  requestedLocale: string,
  key: string,
): ResolvedLocalisedText => {
  const source = maps.sourceByKey.get(key);
  if (!source) throw new Error(`Localisation key '${key}' does not exist in the source project.`);

  const visited = new Set<string>();
  let currentTag = localeKey(requestedLocale);
  let depth = 0;
  while (!visited.has(currentTag)) {
    visited.add(currentTag);
    const locale = maps.localeByTag.get(currentTag);
    if (!locale) break;
    const entry = maps.entriesByLocale.get(currentTag)?.get(key);
    if (entry && entry.text.trim().length > 0) {
      return {
        key,
        text: entry.text,
        requestedLocale,
        resolvedLocale: locale.locale,
        sourceFallback: false,
        fallbackDepth: depth,
      };
    }
    if (!locale.fallbackLocale) break;
    if (localeKey(locale.fallbackLocale) === localeKey(manifest.sourceLocale)) break;
    currentTag = localeKey(locale.fallbackLocale);
    depth += 1;
  }

  return {
    key,
    text: source.text,
    requestedLocale,
    resolvedLocale: manifest.sourceLocale,
    sourceFallback: true,
    fallbackDepth: depth,
  };
};

export const resolveLocalisedText = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  locale: string,
  key: string,
): ResolvedLocalisedText => resolveFromMaps(manifest, buildLocalisationMaps(project, manifest), locale, key);

export interface LocalisationCoverageSummary {
  readonly locale: string;
  readonly status: LocalisationStatus;
  readonly total: number;
  readonly direct: number;
  readonly fallback: number;
  readonly sourceFallback: number;
  readonly directCoverage: number;
  readonly resolvedCoverage: number;
}

export const summariseLocalisationCoverage = (
  project: AdventureProject,
  manifest: LocalisationManifest,
): readonly LocalisationCoverageSummary[] => {
  const maps = buildLocalisationMaps(project, manifest);
  const sourceEntries = [...maps.sourceByKey.values()];
  return manifest.locales.map((locale) => {
    const directEntries = maps.entriesByLocale.get(localeKey(locale.locale));
    let direct = 0;
    let fallback = 0;
    let sourceFallback = 0;
    for (const source of sourceEntries) {
      const entry = directEntries?.get(source.key);
      if (entry && entry.text.trim().length > 0) {
        direct += 1;
        continue;
      }
      const resolved = resolveFromMaps(manifest, maps, locale.locale, source.key);
      if (resolved.sourceFallback) sourceFallback += 1;
      else fallback += 1;
    }
    const total = sourceEntries.length;
    return {
      locale: locale.locale,
      status: locale.status,
      total,
      direct,
      fallback,
      sourceFallback,
      directCoverage: total === 0 ? 1 : direct / total,
      resolvedCoverage: total === 0 ? 1 : (direct + fallback) / total,
    };
  });
};
