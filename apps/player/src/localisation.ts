import type { PlayerSystemTextResolver } from "@evavo/adventure-project-schema/localisation";
import {
  localiseRuntimeFrontEnd,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  localiseRuntimeBundle,
  resolveRuntimeLocale,
  runtimeLocaleOptions,
} from "@evavo/adventure-runtime-bundle/localisation";
import { createPlayerSystemText } from "./player-system-localisation.js";
import "./localisation.css";

export interface LocalePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const runtimeLocaleStorageKey = (projectId: string): string =>
  `evavo-adventure-locale:${projectId}`;

export const requestedRuntimeLocale = (
  bundle: RuntimeBundle,
  search: string,
  storage?: LocalePreferenceStorage | null,
): string | null => {
  if (!bundle.localisation) return null;
  const query = new URLSearchParams(search).get("locale");
  const stored = storage?.getItem(runtimeLocaleStorageKey(bundle.projectId)) ?? null;
  return resolveRuntimeLocale(
    bundle.localisation,
    query ?? stored ?? bundle.localisation.defaultLocale,
  );
};

const mountRuntimeLocaleSelector = (
  bundle: RuntimeBundle,
  selectedLocale: string,
  storage: LocalePreferenceStorage,
  text: PlayerSystemTextResolver,
): void => {
  const pack = bundle.localisation;
  if (!pack || typeof document === "undefined" || typeof window === "undefined") return;
  const status = document.querySelector<HTMLElement>(".player-status");
  if (!status || status.querySelector("[data-runtime-locale-selector]")) return;

  const label = document.createElement("label");
  label.className = "runtime-locale-selector";
  label.dataset["runtimeLocaleSelector"] = "true";
  label.title = text("description.languageReload");

  const caption = document.createElement("span");
  caption.textContent = text("label.language");
  const select = document.createElement("select");
  select.setAttribute("aria-label", text("aria.languageSelector"));

  for (const option of runtimeLocaleOptions(pack)) {
    const element = document.createElement("option");
    element.value = option.locale;
    element.textContent = option.label;
    element.selected = option.locale.toLowerCase() === selectedLocale.toLowerCase();
    select.appendChild(element);
  }

  select.addEventListener("change", () => {
    const locale = resolveRuntimeLocale(pack, select.value);
    storage.setItem(runtimeLocaleStorageKey(bundle.projectId), locale);
    const destination = new URL(window.location.href);
    destination.searchParams.set("locale", locale);
    window.location.assign(destination.href);
  });

  label.append(caption, select);
  status.appendChild(label);
};

export const localiseRuntimeBundleForBrowser = (bundle: RuntimeBundle): RuntimeBundle => {
  if (!bundle.localisation || typeof window === "undefined") return bundle;
  const locale = requestedRuntimeLocale(bundle, window.location.search, window.localStorage);
  const selected = locale ?? bundle.localisation.defaultLocale;
  if (typeof document !== "undefined") document.documentElement.lang = selected;
  const text = createPlayerSystemText(bundle, selected);
  mountRuntimeLocaleSelector(bundle, selected, window.localStorage, text);
  return localiseRuntimeFrontEnd(localiseRuntimeBundle(bundle, selected), selected);
};
