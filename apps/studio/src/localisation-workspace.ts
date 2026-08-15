import type { BitmapFontManifest } from "@evavo/adventure-bitmap-font";
import {
  auditLocalisedTextFit,
  localisationFitResult,
  type LocalisationAuditIssue,
  type LocalisationAuditReport,
  type LocalisationTextFitProfile,
  type LocalisationTextFitResult,
} from "@evavo/adventure-bitmap-font/localisation";
import type { AdventureProject } from "@evavo/adventure-project-schema";
import {
  collectLocalisationSourceEntries,
  createLocalisationEditorHistory,
  createLocalisationTemplate,
  executeLocalisationEditorCommand,
  extractLocalisableText,
  isLocalisationEditorDocumentDirty,
  localisationLocaleByTag,
  markLocalisationEditorHistorySaved,
  redoLocalisationEditorCommand,
  type LocalisationEditorCommand,
  type LocalisationEditorHistoryState,
  type LocalisationLocale,
  type LocalisationManifest,
  type LocalisationSourceEntry,
  undoLocalisationEditorCommand,
} from "@evavo/adventure-project-schema/localisation";

export interface LocalisationWorkspaceState {
  readonly project: AdventureProject;
  readonly fonts: BitmapFontManifest;
  readonly fitProfile: LocalisationTextFitProfile;
  readonly supplementalSourceEntries: readonly LocalisationSourceEntry[];
  readonly history: LocalisationEditorHistoryState;
  readonly selectedLocale: string;
  readonly selectedKey: string;
  readonly query: string;
  readonly findingsOnly: boolean;
  readonly notice: string | null;
}

export type LocalisationWorkspaceAction =
  | { readonly type: "select-locale"; readonly locale: string }
  | { readonly type: "select-key"; readonly key: string }
  | { readonly type: "set-query"; readonly query: string }
  | { readonly type: "set-findings-only"; readonly value: boolean }
  | {
      readonly type: "execute";
      readonly command: LocalisationEditorCommand;
      readonly selectedLocale?: string;
      readonly selectedKey?: string;
      readonly notice?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "mark-saved" }
  | { readonly type: "clear-notice" };

const firstLocale = (manifest: LocalisationManifest): LocalisationLocale => {
  const locale = manifest.locales[0];
  if (!locale) throw new Error("Localisation manifests require at least one target locale.");
  return locale;
};

const firstSource = (
  project: AdventureProject,
  supplementalSourceEntries: readonly LocalisationSourceEntry[],
): LocalisationSourceEntry => {
  const source =
    extractLocalisableText(project)[0] ??
    collectLocalisationSourceEntries(project, supplementalSourceEntries)[0];
  if (!source) throw new Error("Adventure projects require at least one localisable source string.");
  return source;
};

export const createLocalisationWorkspace = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  fonts: BitmapFontManifest,
  fitProfile: LocalisationTextFitProfile,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): LocalisationWorkspaceState => {
  const history = createLocalisationEditorHistory(manifest);
  return {
    project,
    fonts,
    fitProfile,
    supplementalSourceEntries: [...supplementalSourceEntries],
    history,
    selectedLocale: firstLocale(history.document.manifest).locale,
    selectedKey: firstSource(project, supplementalSourceEntries).key,
    query: "",
    findingsOnly: false,
    notice: null,
  };
};

export const localisationWorkspaceManifest = (
  state: LocalisationWorkspaceState,
): LocalisationManifest => state.history.document.manifest;

export const localisationWorkspaceSourceEntries = (
  state: LocalisationWorkspaceState,
): readonly LocalisationSourceEntry[] =>
  collectLocalisationSourceEntries(state.project, state.supplementalSourceEntries);

export const selectedLocalisationLocale = (
  state: LocalisationWorkspaceState,
): LocalisationLocale => localisationLocaleByTag(localisationWorkspaceManifest(state), state.selectedLocale);

export const selectedLocalisationSource = (
  state: LocalisationWorkspaceState,
): LocalisationSourceEntry => {
  const source = localisationWorkspaceSourceEntries(state).find(
    (entry) => entry.key === state.selectedKey,
  );
  if (!source) throw new Error(`Localisation source '${state.selectedKey}' does not exist.`);
  return source;
};

export const selectedLocalisationText = (state: LocalisationWorkspaceState): string =>
  selectedLocalisationLocale(state).entries.find((entry) => entry.key === state.selectedKey)?.text ?? "";

export const localisationWorkspaceReport = (
  state: LocalisationWorkspaceState,
): LocalisationAuditReport =>
  auditLocalisedTextFit(
    state.project,
    localisationWorkspaceManifest(state),
    state.fonts,
    state.fitProfile,
    state.supplementalSourceEntries,
  );

export const selectedLocalisationFit = (
  state: LocalisationWorkspaceState,
  report = localisationWorkspaceReport(state),
): LocalisationTextFitResult | null => localisationFitResult(report, state.selectedLocale, state.selectedKey);

export const selectedLocalisationIssues = (
  state: LocalisationWorkspaceState,
  report = localisationWorkspaceReport(state),
): readonly LocalisationAuditIssue[] =>
  report.issues.filter(
    (issue) =>
      issue.key === state.selectedKey &&
      (issue.locale === undefined || issue.locale.toLowerCase() === state.selectedLocale.toLowerCase()),
  );

const issueKeySet = (
  state: LocalisationWorkspaceState,
  report: LocalisationAuditReport,
): ReadonlySet<string> =>
  new Set(
    report.issues
      .filter(
        (issue) =>
          issue.key &&
          (issue.locale === undefined || issue.locale.toLowerCase() === state.selectedLocale.toLowerCase()),
      )
      .map((issue) => issue.key)
      .filter((key): key is string => key !== undefined),
  );

export const filteredLocalisationSources = (
  state: LocalisationWorkspaceState,
  report = localisationWorkspaceReport(state),
): readonly LocalisationSourceEntry[] => {
  const query = state.query.trim().toLowerCase();
  const findings = state.findingsOnly ? issueKeySet(state, report) : null;
  return localisationWorkspaceSourceEntries(state).filter((source) => {
    if (findings && !findings.has(source.key)) return false;
    if (!query) return true;
    return [source.key, source.role, source.sourcePath, source.text].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
};

export const localisationWorkspaceIsDirty = (state: LocalisationWorkspaceState): boolean =>
  isLocalisationEditorDocumentDirty(state.history.document);

const selectionAfterHistory = (
  state: LocalisationWorkspaceState,
  history: LocalisationEditorHistoryState,
): Pick<LocalisationWorkspaceState, "selectedLocale" | "selectedKey"> => {
  const locale = history.document.manifest.locales.find(
    (candidate) => candidate.locale.toLowerCase() === state.selectedLocale.toLowerCase(),
  );
  const sources = localisationWorkspaceSourceEntries(state);
  const source = sources.find((candidate) => candidate.key === state.selectedKey);
  return {
    selectedLocale: (locale ?? firstLocale(history.document.manifest)).locale,
    selectedKey: (source ?? firstSource(state.project, state.supplementalSourceEntries)).key,
  };
};

export const localisationWorkspaceReducer = (
  state: LocalisationWorkspaceState,
  action: LocalisationWorkspaceAction,
): LocalisationWorkspaceState => {
  switch (action.type) {
    case "select-locale":
      if (
        !localisationWorkspaceManifest(state).locales.some(
          (locale) => locale.locale.toLowerCase() === action.locale.toLowerCase(),
        )
      ) {
        return state;
      }
      return { ...state, selectedLocale: action.locale, notice: null };
    case "select-key":
      if (!localisationWorkspaceSourceEntries(state).some((source) => source.key === action.key)) {
        return state;
      }
      return { ...state, selectedKey: action.key, notice: null };
    case "set-query":
      return { ...state, query: action.query, notice: null };
    case "set-findings-only":
      return { ...state, findingsOnly: action.value, notice: null };
    case "execute": {
      const history = executeLocalisationEditorCommand(state.history, action.command);
      return {
        ...state,
        history,
        ...selectionAfterHistory(state, history),
        ...(action.selectedLocale ? { selectedLocale: action.selectedLocale } : {}),
        ...(action.selectedKey ? { selectedKey: action.selectedKey } : {}),
        notice: action.notice ?? null,
      };
    }
    case "undo": {
      const history = undoLocalisationEditorCommand(state.history);
      return {
        ...state,
        history,
        ...selectionAfterHistory(state, history),
        notice: "Undid the last localisation edit.",
      };
    }
    case "redo": {
      const history = redoLocalisationEditorCommand(state.history);
      return {
        ...state,
        history,
        ...selectionAfterHistory(state, history),
        notice: "Redid the localisation edit.",
      };
    }
    case "mark-saved":
      return {
        ...state,
        history: markLocalisationEditorHistorySaved(state.history),
        notice: "Localisation manifest marked as exported.",
      };
    case "clear-notice":
      return { ...state, notice: null };
  }
};

export const replaceSelectedTranslationCommand = (
  state: LocalisationWorkspaceState,
  text: string,
): LocalisationEditorCommand => ({
  kind: "set-entry-text",
  locale: state.selectedLocale,
  key: state.selectedKey,
  text,
});

export const replaceSelectedLocaleCommand = (
  state: LocalisationWorkspaceState,
  locale: LocalisationLocale,
): LocalisationEditorCommand => ({
  kind: "replace-locale",
  locale: state.selectedLocale,
  nextLocale: locale,
});

export const insertLocalisationLocaleCommand = (
  state: LocalisationWorkspaceState,
  localeTag: string,
  label?: string,
): { readonly command: LocalisationEditorCommand; readonly locale: string } => {
  const template = createLocalisationTemplate(
    state.project,
    localisationWorkspaceManifest(state).sourceLocale,
    [{ locale: localeTag, ...(label ? { label } : {}), status: "draft" }],
    state.supplementalSourceEntries,
  );
  const locale = template.locales[0];
  if (!locale) throw new Error(`Unable to create localisation locale '${localeTag}'.`);
  return {
    command: { kind: "insert-locale", locale },
    locale: locale.locale,
  };
};

export const removeSelectedLocaleCommand = (
  state: LocalisationWorkspaceState,
): LocalisationEditorCommand => ({
  kind: "remove-locale",
  locale: state.selectedLocale,
});
