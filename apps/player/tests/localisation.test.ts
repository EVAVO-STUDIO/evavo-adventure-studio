import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  requestedRuntimeLocale,
  runtimeLocaleStorageKey,
  type LocalePreferenceStorage,
} from "../src/localisation.js";

class MemoryStorage implements LocalePreferenceStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const bundle = {
  projectId: "project.locale-player",
  localisation: {
    packVersion: 1,
    projectId: "project.locale-player",
    sourceLocale: "en-AU",
    defaultLocale: "fr-FR",
    locales: [
      { locale: "fr-FR", label: "Français", status: "release", entries: [] },
      { locale: "de-DE", label: "Deutsch", status: "review", entries: [] },
    ],
    sourceEntries: [],
  },
} as unknown as RuntimeBundle;

describe("player runtime locale preference", () => {
  it("prefers a supported URL locale over persisted preference", () => {
    const storage = new MemoryStorage();
    storage.setItem(runtimeLocaleStorageKey(bundle.projectId), "fr-FR");

    expect(requestedRuntimeLocale(bundle, "?locale=de-DE", storage)).toBe("de-DE");
  });

  it("uses persisted preference and falls back to the authored default", () => {
    const storage = new MemoryStorage();
    storage.setItem(runtimeLocaleStorageKey(bundle.projectId), "de-DE");

    expect(requestedRuntimeLocale(bundle, "", storage)).toBe("de-DE");
    expect(requestedRuntimeLocale(bundle, "?locale=unknown", new MemoryStorage())).toBe("fr-FR");
  });

  it("returns null when the runtime bundle has no locale pack", () => {
    expect(
      requestedRuntimeLocale({ ...bundle, localisation: undefined } as unknown as RuntimeBundle, ""),
    ).toBeNull();
  });
});
