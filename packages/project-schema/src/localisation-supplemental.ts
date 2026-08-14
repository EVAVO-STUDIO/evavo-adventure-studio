import type { AdventureProject } from "./index.js";
import { extractLocalisableText, localisationPlaceholders } from "./localisation-extract.js";
import { localeKey } from "./localisation-resolve.js";
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

interface SupplementalResolution {
  readonly sourceFallback: boolean;
  readonly resolvedLocale: string;
}

const localeEntries = (
  locale: LocalisationLocale,
): ReadonlyMap<string, LocalisationEntry> => {
  const entries = new Map<string, LocalisationEntry>();
  for (const entry of locale.entries) {
    if (!entries.has(entry.key)) entries.set(entry.key, entry);
  }
  return entries;
};

const resolveSupplementalEntry = (
  manifest: LocalisationManifest,
  requestedLocale: string,
  key: string,
): SupplementalResolution => {
  const locales = new Map(
    manifest.locales.map((locale) => [localeKey(locale.locale), locale] as const),
  );
  const entries = new Map(
    manifest.locales.map((locale) => [localeKey(locale.locale), localeEntries(locale)] as const),
  );
  const visited = new Set<string>();
  let currentTag = localeKey(requestedLocale);

  while (!visited.has(currentTag)) {
    visited.add(currentTag);
    const locale = locales.get(currentTag);
    if (!locale) break;
    const translated = entries.get(currentTag)?.get(key);
    if (translated && translated.text.trim().length > 0) {
      return { sourceFallback: false, resolvedLocale: locale.locale };
    }
    if (
      !locale.fallbackLocale ||
      localeKey(locale.fallbackLocale) === localeKey(manifest.sourceLocale)
    ) {
      break;
    }
    currentTag = localeKey(locale.fallbackLocale);
  }

  return { sourceFallback: true, resolvedLocale: manifest.sourceLocale };
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

      const resolved = resolveSupplementalEntry(manifest, locale.locale, source.key);
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
