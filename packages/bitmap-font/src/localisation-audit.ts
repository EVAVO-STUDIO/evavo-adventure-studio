import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import {
  type LocalisationManifest,
  type LocalisationTextRole,
  extractLocalisableText,
  resolveLocalisedText,
  summariseLocalisationCoverage,
  validateLocalisationManifest,
} from "@evavo/adventure-project-schema/localisation";
import type { BitmapFontDefinition, BitmapFontManifest } from "./index.js";
import { layoutBitmapText } from "./layout.js";
import type {
  LocalisationAuditIssue,
  LocalisationAuditReport,
  LocalisationTextFitIssue,
  LocalisationTextFitIssueCode,
  LocalisationTextFitProfile,
  LocalisationTextFitResult,
  LocalisationTextFitRule,
} from "./localisation-types.js";

const addFitIssue = (
  issues: LocalisationTextFitIssue[],
  severity: LocalisationTextFitIssue["severity"],
  code: LocalisationTextFitIssueCode,
  path: string,
  message: string,
  locale?: string,
  key?: string,
  ruleId?: string,
): void => {
  issues.push({
    severity,
    code,
    path,
    message,
    ...(locale === undefined ? {} : { locale }),
    ...(key === undefined ? {} : { key }),
    ...(ruleId === undefined ? {} : { ruleId }),
  });
};

const roleRules = (
  profile: LocalisationTextFitProfile,
  issues: LocalisationTextFitIssue[],
): ReadonlyMap<LocalisationTextRole, LocalisationTextFitRule> => {
  const ruleIds = new Set<string>();
  const rules = new Map<LocalisationTextRole, LocalisationTextFitRule>();
  profile.rules.forEach((rule, ruleIndex) => {
    if (ruleIds.has(rule.id)) {
      addFitIssue(
        issues,
        "error",
        "duplicate-text-fit-rule-id",
        `rules[${ruleIndex}].id`,
        `Text-fit rule '${rule.id}' is declared more than once.`,
        undefined,
        undefined,
        rule.id,
      );
    }
    ruleIds.add(rule.id);
    rule.roles.forEach((role, roleIndex) => {
      const previous = rules.get(role);
      if (previous) {
        addFitIssue(
          issues,
          "warning",
          "duplicate-text-fit-role",
          `rules[${ruleIndex}].roles[${roleIndex}]`,
          `Text role '${role}' is already governed by '${previous.id}'; '${rule.id}' will not replace it.`,
          undefined,
          undefined,
          rule.id,
        );
      } else {
        rules.set(role, rule);
      }
    });
  });
  return rules;
};

const fontById = (
  manifest: BitmapFontManifest,
): ReadonlyMap<Id<"bitmap-font">, BitmapFontDefinition> =>
  new Map(manifest.fonts.map((font) => [font.id, font] as const));

export const auditLocalisedTextFit = (
  project: AdventureProject,
  localisation: LocalisationManifest,
  fonts: BitmapFontManifest,
  profile: LocalisationTextFitProfile,
): LocalisationAuditReport => {
  const fitIssues: LocalisationTextFitIssue[] = [];
  if (profile.projectId !== project.id) {
    addFitIssue(
      fitIssues,
      "error",
      "text-fit-project-mismatch",
      "projectId",
      `Text-fit project '${profile.projectId}' does not match '${project.id}'.`,
    );
  }
  if (fonts.projectId !== project.id) {
    addFitIssue(
      fitIssues,
      "error",
      "text-fit-font-project-mismatch",
      "fonts.projectId",
      `Bitmap font project '${fonts.projectId}' does not match '${project.id}'.`,
    );
  }

  const rules = roleRules(profile, fitIssues);
  const fontsById = fontById(fonts);
  profile.rules.forEach((rule, ruleIndex) => {
    if (!fontsById.has(rule.fontId)) {
      addFitIssue(
        fitIssues,
        "error",
        "missing-text-fit-font",
        `rules[${ruleIndex}].fontId`,
        `Text-fit rule '${rule.id}' references missing font '${rule.fontId}'.`,
        undefined,
        undefined,
        rule.id,
      );
    }
  });

  const sourceEntries = extractLocalisableText(project);
  const fitResults: LocalisationTextFitResult[] = [];
  localisation.locales.forEach((locale, localeIndex) => {
    sourceEntries.forEach((source) => {
      const rule = rules.get(source.role);
      if (!rule) {
        addFitIssue(
          fitIssues,
          "warning",
          "missing-text-fit-rule",
          `locales[${localeIndex}].entries`,
          `No native text-fit rule governs role '${source.role}' for '${source.key}'.`,
          locale.locale,
          source.key,
        );
        return;
      }
      const font = fontsById.get(rule.fontId);
      if (!font) return;
      const resolved = resolveLocalisedText(project, localisation, locale.locale, source.key);
      const layout = layoutBitmapText(font, resolved.text, {
        maxWidth: rule.maxWidth,
        alignment: rule.alignment,
        lineSpacing: rule.lineSpacing,
        tabSpaces: rule.tabSpaces,
      });
      const contentWidth = layout.lines.reduce((maximum, line) => Math.max(maximum, line.width), 0);
      const contentHeight = layout.height;
      const lineCount = layout.lines.length;
      const widthOverflow = Math.max(0, contentWidth - rule.maxWidth);
      const heightOverflow = Math.max(0, contentHeight - rule.maxHeight);
      const lineOverflow = Math.max(0, lineCount - rule.maxLines);
      const fits =
        widthOverflow === 0 &&
        heightOverflow === 0 &&
        lineOverflow === 0 &&
        layout.fallbackCodePoints.length === 0;
      const result: LocalisationTextFitResult = {
        locale: locale.locale,
        key: source.key,
        role: source.role,
        text: resolved.text,
        resolvedLocale: resolved.resolvedLocale,
        sourceFallback: resolved.sourceFallback,
        ruleId: rule.id,
        fontId: font.id,
        maxWidth: rule.maxWidth,
        maxHeight: rule.maxHeight,
        maxLines: rule.maxLines,
        contentWidth,
        contentHeight,
        lineCount,
        widthOverflow,
        heightOverflow,
        lineOverflow,
        fallbackCodePoints: layout.fallbackCodePoints,
        fits,
      };
      fitResults.push(result);

      if (widthOverflow > 0 || heightOverflow > 0 || lineOverflow > 0) {
        addFitIssue(
          fitIssues,
          rule.overflowSeverity,
          "localised-text-overflow",
          `locales[${localeIndex}].entries`,
          [
            `Text '${source.key}' occupies ${contentWidth}×${contentHeight}px across ${lineCount} line(s);`,
            `rule '${rule.id}' allows ${rule.maxWidth}×${rule.maxHeight}px and ${rule.maxLines} line(s).`,
          ].join(" "),
          locale.locale,
          source.key,
          rule.id,
        );
      }
      if (layout.fallbackCodePoints.length > 0) {
        addFitIssue(
          fitIssues,
          rule.glyphSeverity,
          "localised-text-missing-glyph",
          `locales[${localeIndex}].entries`,
          `Text '${source.key}' requires missing glyphs ${layout.fallbackCodePoints
            .map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`)
            .join(", ")} in '${font.name}'.`,
          locale.locale,
          source.key,
          rule.id,
        );
      }
    });
  });

  const issues: LocalisationAuditIssue[] = [
    ...validateLocalisationManifest(project, localisation),
    ...fitIssues,
  ].sort((left, right) =>
    `${left.severity}:${left.locale ?? ""}:${left.key ?? ""}:${left.path}:${left.code}`.localeCompare(
      `${right.severity}:${right.locale ?? ""}:${right.key ?? ""}:${right.path}:${right.code}`,
    ),
  );
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    projectId: project.id,
    sourceLocale: localisation.sourceLocale,
    sourceEntries,
    coverage: summariseLocalisationCoverage(project, localisation),
    fitResults: fitResults.sort((left, right) =>
      `${left.locale}:${left.key}`.localeCompare(`${right.locale}:${right.key}`),
    ),
    issues,
    errorCount,
    warningCount,
    verified: errorCount === 0,
  };
};

export const localisationFitResult = (
  report: LocalisationAuditReport,
  locale: string,
  key: string,
): LocalisationTextFitResult | null =>
  report.fitResults.find(
    (result) => result.locale.toLowerCase() === locale.toLowerCase() && result.key === key,
  ) ?? null;
