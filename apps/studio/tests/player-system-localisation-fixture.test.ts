import { playerSystemLocalisationKey } from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import {
  studioLocalisationManifest,
  studioLocalisationSupplementalSources,
} from "../src/localisation-fixture.js";

describe("Studio Player system localisation fixture", () => {
  it("authors representative runtime chrome, replay and cutscene translations", () => {
    const sourceKeys = new Set(
      studioLocalisationSupplementalSources.map((entry) => entry.key),
    );
    const french = studioLocalisationManifest.locales.find(
      (locale) => locale.locale === "fr-FR",
    );
    if (!french) throw new Error("Expected the Studio French locale fixture.");
    const translations = new Map(
      french.entries.map((entry) => [entry.key, entry.text] as const),
    );

    const loadingKey = playerSystemLocalisationKey("loading.game");
    const replayKey = playerSystemLocalisationKey("status.replayRecorded");
    const cutsceneKey = playerSystemLocalisationKey(
      "status.cutsceneNameSkippable",
    );

    expect(sourceKeys.has(loadingKey)).toBe(true);
    expect(sourceKeys.has(replayKey)).toBe(true);
    expect(sourceKeys.has(cutsceneKey)).toBe(true);
    expect(translations.get(loadingKey)).toBe("Chargement du jeu…");
    expect(translations.get(replayKey)).toBe(
      "REPLAY ENREGISTRÉ • {count} {eventLabel}",
    );
    expect(translations.get(cutsceneKey)).toBe(
      "{name} • ÉCHAP POUR PASSER",
    );
  });
});
