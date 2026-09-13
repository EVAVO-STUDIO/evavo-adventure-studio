import type { AdventureProject } from "./index.js";
import { extractLocalisableText, localisationPlaceholders } from "./localisation-extract.js";
import { buildLocalisationMaps, localeKey, resolveFromMaps } from "./localisation-resolve.js";
import type {
  LocalisationEntry,
  LocalisationLocale,
  LocalisationManifest,
  LocalisationSourceEntry,
} from "./localisation-types.js";

const equalStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export type LocalisationIssueCode =
  | "localisation-project-mismatch"
  | "duplicate-source-key"
  | "duplicate-locale"
  | "source-locale-targeted"
  | "duplicate-localisation-key"
  | "unknown-localisation-key"
  | "missing-localisation-key"
  | "fallback-localisation-used"
  | "placeholder-mismatch"
  | "missing-fallback-locale"
  | "fallback-locale-cycle";

export interface LocalisationIssue {
  readonly severity: "error" | "warning";
  readonly code: LocalisationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly locale?: string;
  readonly key?: string;
}

const addIssue = (
  issues: LocalisationIssue[],
  severity: LocalisationIssue["severity"],
  code: LocalisationIssueCode,
  path: string,
  message: string,
  locale?: string,
  key?: string,
): void => {
  issues.push({
    severity,
    code,
    path,
    message,
    ...(locale === undefined ? {} : { locale }),
    ...(key === undefined ? {} : { key }),
  });
};

export const validateLocalisationManifest = (
  project: AdventureProject,
  manifest: LocalisationManifest,
): readonly LocalisationIssue[] => {
  const issues: LocalisationIssue[] = [];
  if (manifest.projectId !== project.id) {
    addIssue(
      issues,
      "error",
      "localisation-project-mismatch",
      "projectId",
      `Localisation project '${manifest.projectId}' does not match '${project.id}'.`,
    );
  }

  const sourceEntries = extractLocalisableText(project);
  const sourceByKey = new Map<string, LocalisationSourceEntry>();
  sourceEntries.forEach((entry, sourceIndex) => {
    if (sourceByKey.has(entry.key)) {
      addIssue(
        issues,
        "error",
        "duplicate-source-key",
        entry.sourcePath,
        `Generated localisation key '${entry.key}' is duplicated at source entry ${sourceIndex}.`,
        undefined,
        entry.key,
      );
    } else {
      sourceByKey.set(entry.key, entry);
    }
  });

  const localeByTag = new Map<string, { readonly locale: LocalisationLocale; readonly index: number }>();
  manifest.locales.forEach((locale, localeIndex) => {
    const tag = localeKey(locale.locale);
    if (tag === localeKey(manifest.sourceLocale)) {
      addIssue(
        issues,
        "error",
        "source-locale-targeted",
        `locales[${localeIndex}].locale`,
        [
          `Source locale '${manifest.sourceLocale}' must remain canonical project text,`,
          "not a translated locale.",
        ].join(" "),
        locale.locale,
      );
    }
    if (localeByTag.has(tag)) {
      addIssue(
        issues,
        "error",
        "duplicate-locale",
        `locales[${localeIndex}].locale`,
        `Locale '${locale.locale}' is declared more than once.`,
        locale.locale,
      );
    } else {
      localeByTag.set(tag, { locale, index: localeIndex });
    }
  });

  for (const { locale, index } of localeByTag.values()) {
    if (
      locale.fallbackLocale &&
      localeKey(locale.fallbackLocale) !== localeKey(manifest.sourceLocale) &&
      !localeByTag.has(localeKey(locale.fallbackLocale))
    ) {
      addIssue(
        issues,
        "error",
        "missing-fallback-locale",
        `locales[${index}].fallbackLocale`,
        `Locale '${locale.locale}' references missing fallback '${locale.fallbackLocale}'.`,
        locale.locale,
      );
    }

    const visited = new Set<string>();
    let current: LocalisationLocale | undefined = locale;
    while (current) {
      const currentTag = localeKey(current.locale);
      if (visited.has(currentTag)) {
        addIssue(
          issues,
          "error",
          "fallback-locale-cycle",
          `locales[${index}].fallbackLocale`,
          `Locale '${locale.locale}' participates in a fallback cycle.`,
          locale.locale,
        );
        break;
      }
      visited.add(currentTag);
      if (!current.fallbackLocale || localeKey(current.fallbackLocale) === localeKey(manifest.sourceLocale)) {
        break;
      }
      current = localeByTag.get(localeKey(current.fallbackLocale))?.locale;
    }
  }

  const maps = buildLocalisationMaps(project, manifest);
  manifest.locales.forEach((locale, localeIndex) => {
    const entries = new Map<string, LocalisationEntry>();
    locale.entries.forEach((entry, entryIndex) => {
      const path = `locales[${localeIndex}].entries[${entryIndex}]`;
      if (entries.has(entry.key)) {
        addIssue(
          issues,
          "error",
          "duplicate-localisation-key",
          `${path}.key`,
          `Locale '${locale.locale}' declares key '${entry.key}' more than once.`,
          locale.locale,
          entry.key,
        );
      } else {
        entries.set(entry.key, entry);
      }
      const source = sourceByKey.get(entry.key);
      if (!source) {
        addIssue(
          issues,
          "error",
          "unknown-localisation-key",
          `${path}.key`,
          `Locale '${locale.locale}' contains unknown key '${entry.key}'.`,
          locale.locale,
          entry.key,
        );
      } else if (entry.text.trim().length > 0) {
        const sourcePlaceholders = localisationPlaceholders(source.text);
        const translatedPlaceholders = localisationPlaceholders(entry.text);
        if (!equalStrings(sourcePlaceholders, translatedPlaceholders)) {
          addIssue(
            issues,
            "error",
            "placeholder-mismatch",
            `${path}.text`,
            [
              `Locale '${locale.locale}' must preserve placeholders`,
              `${JSON.stringify(sourcePlaceholders)} for '${entry.key}',`,
              `found ${JSON.stringify(translatedPlaceholders)}.`,
            ].join(" "),
            locale.locale,
            entry.key,
          );
        }
      }
    });

    for (const source of sourceEntries) {
      const direct = entries.get(source.key);
      if (direct && direct.text.trim().length > 0) continue;
      const resolved = resolveFromMaps(manifest, maps, locale.locale, source.key);
      if (!resolved.sourceFallback) {
        if (locale.status === "release") {
          addIssue(
            issues,
            "warning",
            "fallback-localisation-used",
            `locales[${localeIndex}].entries`,
            [
              `Release locale '${locale.locale}' resolves '${source.key}'`,
              `through '${resolved.resolvedLocale}'.`,
            ].join(" "),
            locale.locale,
            source.key,
          );
        }
        continue;
      }
      if (locale.status === "draft") continue;
      addIssue(
        issues,
        locale.status === "release" ? "error" : "warning",
        "missing-localisation-key",
        `locales[${localeIndex}].entries`,
        `Locale '${locale.locale}' has no translated value for '${source.key}'.`,
        locale.locale,
        source.key,
      );
    }
  });

  return issues.sort((left, right) =>
    `${left.severity}:${left.locale ?? ""}:${left.path}:${left.code}`.localeCompare(
      `${right.severity}:${right.locale ?? ""}:${right.path}:${right.code}`,
    ),
  );
};

