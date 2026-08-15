import {
  frontEndLocalisationKey,
  lifecycleLocalisationKey,
  playerSystemLocalisationKey,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import {
  studioBitmapFonts,
  studioFontProject,
  studioLocalisationManifest,
  studioLocalisationSupplementalSources,
  studioLocalisationTextFitProfile,
} from "../src/localisation-fixture.js";
import {
  createLocalisationWorkspace,
  filteredLocalisationSources,
  insertLocalisationLocaleCommand,
  localisationWorkspaceIsDirty,
  localisationWorkspaceReducer,
  localisationWorkspaceReport,
  localisationWorkspaceSourceEntries,
  removeSelectedLocaleCommand,
  replaceSelectedTranslationCommand,
  selectedLocalisationSource,
  selectedLocalisationText,
} from "../src/localisation-workspace.js";

const createState = () =>
  createLocalisationWorkspace(
    studioFontProject,
    studioLocalisationManifest,
    studioBitmapFonts,
    studioLocalisationTextFitProfile,
    studioLocalisationSupplementalSources,
  );

describe("localisation workspace", () => {
  it("edits translation text with undo, redo and dirty tracking", () => {
    const initial = createState();
    const edited = localisationWorkspaceReducer(initial, {
      type: "execute",
      command: replaceSelectedTranslationCommand(initial, "Translated title"),
      notice: "Edited translation.",
    });

    expect(selectedLocalisationText(edited)).toBe("Translated title");
    expect(localisationWorkspaceIsDirty(edited)).toBe(true);

    const undone = localisationWorkspaceReducer(edited, { type: "undo" });
    expect(selectedLocalisationText(undone)).toBe(selectedLocalisationText(initial));

    const redone = localisationWorkspaceReducer(undone, { type: "redo" });
    expect(selectedLocalisationText(redone)).toBe("Translated title");

    const saved = localisationWorkspaceReducer(redone, { type: "mark-saved" });
    expect(localisationWorkspaceIsDirty(saved)).toBe(false);
  });

  it("catalogues front-end, lifecycle and Player system sidecars with native fit rules", () => {
    const state = createState();
    const report = localisationWorkspaceReport(state);
    const keys = localisationWorkspaceSourceEntries(state).map((source) => source.key);
    const frontEndKey = frontEndLocalisationKey("menu.newGame");
    const lifecycleKey = lifecycleLocalisationKey("outcome.case-closed", "message");
    const playerSystemKey = playerSystemLocalisationKey("menu.resume");

    expect(keys).toEqual(
      expect.arrayContaining([frontEndKey, lifecycleKey, playerSystemKey]),
    );
    expect(report.sourceEntries.map((source) => source.key)).toEqual(keys);
    expect(
      report.issues.filter(
        (issue) =>
          issue.code === "missing-text-fit-rule" &&
          issue.key !== undefined &&
          (issue.key.startsWith("frontEnd.") ||
            issue.key.startsWith("lifecycle.") ||
            issue.key.startsWith("playerSystem.")),
      ),
    ).toEqual([]);
  });

  it("edits supplemental translations through normal history", () => {
    const frontEndKey = frontEndLocalisationKey("menu.newGame");
    const playerSystemKey = playerSystemLocalisationKey("menu.resume");
    let state = localisationWorkspaceReducer(createState(), {
      type: "select-key",
      key: frontEndKey,
    });
    expect(selectedLocalisationSource(state).role).toBe("front-end-menu-label");

    state = localisationWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedTranslationCommand(state, "COMMENCER"),
      notice: "Edited front-end translation.",
    });
    expect(selectedLocalisationText(state)).toBe("COMMENCER");

    state = localisationWorkspaceReducer(state, { type: "undo" });
    expect(selectedLocalisationText(state)).toBe("NOUVELLE PARTIE");
    state = localisationWorkspaceReducer(state, { type: "redo" });
    expect(selectedLocalisationText(state)).toBe("COMMENCER");

    state = localisationWorkspaceReducer(state, { type: "select-key", key: playerSystemKey });
    expect(selectedLocalisationSource(state).role).toBe("player-system-menu-label");
    expect(selectedLocalisationText(state)).toBe("REPRENDRE");
  });

  it("adds a complete draft locale and keeps selection stable", () => {
    const initial = createState();
    const addition = insertLocalisationLocaleCommand(initial, "de-DE", "Deutsch");
    const added = localisationWorkspaceReducer(initial, {
      type: "execute",
      command: addition.command,
      selectedLocale: addition.locale,
    });

    expect(added.selectedLocale).toBe("de-DE");
    expect(added.history.document.manifest.locales.some((locale) => locale.locale === "de-DE")).toBe(true);
    expect(
      added.history.document.manifest.locales.find((locale) => locale.locale === "de-DE")?.entries.length,
    ).toBe(localisationWorkspaceReport(added).sourceEntries.length);
  });

  it("filters the catalogue by core text, sidecar role and active findings", () => {
    let state = createState();
    state = localisationWorkspaceReducer(state, { type: "set-query", query: "project.title" });
    expect(filteredLocalisationSources(state).map((source) => source.key)).toEqual([
      "project.title",
    ]);

    state = localisationWorkspaceReducer(state, {
      type: "set-query",
      query: "front-end-menu-label",
    });
    const frontEndSources = filteredLocalisationSources(state);
    expect(frontEndSources.length).toBeGreaterThan(0);
    expect(frontEndSources.every((source) => source.role === "front-end-menu-label")).toBe(true);

    state = localisationWorkspaceReducer(state, {
      type: "set-query",
      query: "player-system-menu-label",
    });
    const systemSources = filteredLocalisationSources(state);
    expect(systemSources.length).toBeGreaterThan(0);
    expect(systemSources.every((source) => source.role === "player-system-menu-label")).toBe(true);

    state = localisationWorkspaceReducer(state, { type: "set-query", query: "" });
    state = localisationWorkspaceReducer(state, { type: "set-findings-only", value: true });
    const findings = filteredLocalisationSources(state);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.length).toBeLessThanOrEqual(localisationWorkspaceReport(state).sourceEntries.length);
  });

  it("removes unreferenced locales and falls back to a valid selection", () => {
    const initial = createState();
    const pseudo = localisationWorkspaceReducer(initial, {
      type: "select-locale",
      locale: "qps-ploc",
    });
    const removed = localisationWorkspaceReducer(pseudo, {
      type: "execute",
      command: removeSelectedLocaleCommand(pseudo),
    });

    expect(
      removed.history.document.manifest.locales.some((locale) => locale.locale === "qps-ploc"),
    ).toBe(false);
    expect(
      removed.history.document.manifest.locales.some(
        (locale) => locale.locale === removed.selectedLocale,
      ),
    ).toBe(true);
  });
});
