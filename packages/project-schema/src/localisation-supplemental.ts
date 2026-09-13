import type { AdventureProject } from "./index.js";
import { extractLocalisableText, localisationPlaceholders } from "./localisation-extract.js";
import {
  buildLocalisationMapsFromSources,
  resolveFromMaps,
  summariseLocalisationCoverageFromSources,
  type LocalisationCoverageSummary,
  type ResolvedLocalisedText,
} from "./localisation-resolve.js";
import type {
  LocalisationEntry,
  LocalisationLocale,
  LocalisationManifest,
  LocalisationSourceEntry,
} from "./localisation-types.js";
import {
  type LocalisationIssue,
  validateLocalisationManifest,
} from "./localisation-validate.js";

const equalStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const issue = (
  severity: LocalisationIssue["severity"],
  code: LocalisationIssue["code"],
  path: string,
  message: string,
  locale?: string,
  key?: string,
): LocalisationIssue => ({
  severity,
  code,
  path,
  message,
  ...(locale === undefined ? {} : { locale }),
  ...(key === undefined ? {} : { key }),
});

export const collectLocalisationSourceEntries = (
  project: AdventureProject,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): readonly LocalisationSourceEntry[] =>
  [...extractLocalisableText(project), ...supplementalSourceEntries].sort((left, right) =>
    left.key.localeCompare(right.key),
  );

export const resolveLocalisedTextWithSupplementalSources = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  requestedLocale: string,
  key: string,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): ResolvedLocalisedText => {
  const sourceEntries = collectLocalisationSourceEntries(project, supplementalSourceEntries);
  return resolveFromMaps(
    manifest,
    buildLocalisationMapsFromSources(sourceEntries, manifest),
    requestedLocale,
    key,
  );
};

export const summariseLocalisationCoverageWithSupplementalSources = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): readonly LocalisationCoverageSummary[] =>
  summariseLocalisationCoverageFromSources(
    collectLocalisationSourceEntries(project, supplementalSourceEntries),
    manifest,
  );

const localeEntries = (
  locale: LocalisationLocale,
): ReadonlyMap<string, LocalisationEntry> => {
  const entries = new Map<string, LocalisationEntry>();
  for (const entry of locale.entries) {
    if (!entries.has(entry.key)) entries.set(entry.key, entry);
  }
  return entries;
};

export const validateLocalisationManifestWithSupplementalSources = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): readonly LocalisationIssue[] => {
  if (supplementalSourceEntries.length === 0) {
    return validateLocalisationManifest(project, manifest);
  }

  const supplementalKeys = new Set(supplementalSourceEntries.map((entry) => entry.key));
  const issues: LocalisationIssue[] = validateLocalisationManifest(project, manifest).filter(
    (candidate) =>
      !(
        candidate.code === "unknown-localisation-key" &&
        candidate.key !== undefined &&
        supplementalKeys.has(candidate.key)
      ),
  );

  const sourceByKey = new Map(
    extractLocalisableText(project).map((entry) => [entry.key, entry] as const),
  );
  const accepted: LocalisationSourceEntry[] = [];
  supplementalSourceEntries.forEach((entry, sourceIndex) => {
    if (sourceByKey.has(entry.key)) {
      issues.push(
        issue(
          "error",
          "duplicate-source-key",
          entry.sourcePath,
          `Supplemental localisation key '${entry.key}' is duplicated at source entry ${sourceIndex}.`,
          undefined,
          entry.key,
        ),
      );
      return;
    }
    sourceByKey.set(entry.key, entry);
    accepted.push(entry);
  });

  const sourceEntries = collectLocalisationSourceEntries(project, accepted);
  const maps = buildLocalisationMapsFromSources(sourceEntries, manifest);

  manifest.locales.forEach((locale, localeIndex) => {
    const entries = localeEntries(locale);
    for (const source of accepted) {
      const direct = entries.get(source.key);
      if (direct && direct.text.trim().length > 0) {
        const sourcePlaceholders = localisationPlaceholders(source.text);
        const translatedPlaceholders = localisationPlaceholders(direct.text);
        if (!equalStrings(sourcePlaceholders, translatedPlaceholders)) {
          issues.push(
            issue(
              "error",
              "placeholder-mismatch",
              `locales[${localeIndex}].entries`,
              [
                `Locale '${locale.locale}' must preserve placeholders`,
                `${JSON.stringify(sourcePlaceholders)} for '${source.key}',`,
                `found ${JSON.stringify(translatedPlaceholders)}.`,
              ].join(" "),
              locale.locale,
              source.key,
            ),
          );
        }
        continue;
      }

      const resolved = resolveFromMaps(manifest, maps, locale.locale, source.key);
      if (!resolved.sourceFallback) {
        if (locale.status === "release") {
          issues.push(
            issue(
              "warning",
              "fallback-localisation-used",
              `locales[${localeIndex}].entries`,
              [
                `Release locale '${locale.locale}' resolves '${source.key}'`,
                `through '${resolved.resolvedLocale}'.`,
              ].join(" "),
              locale.locale,
              source.key,
            ),
          );
        }
        continue;
      }
      if (locale.status === "draft") continue;
      issues.push(
        issue(
          locale.status === "release" ? "error" : "warning",
          "missing-localisation-key",
          `locales[${localeIndex}].entries`,
          `Locale '${locale.locale}' has no translated value for '${source.key}'.`,
          locale.locale,
          source.key,
        ),
      );
    }
  });

  return issues.sort((left, right) =>
    `${left.severity}:${left.locale ?? ""}:${left.path}:${left.code}`.localeCompare(
      `${right.severity}:${right.locale ?? ""}:${right.path}:${right.code}`,
    ),
  );
};
