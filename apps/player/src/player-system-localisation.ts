import {
  canonicalPlayerSystemText,
  formatPlayerSystemText,
  playerSystemLocalisationKey,
  playerSystemSourceText,
  type PlayerSystemTextResolver,
} from "@evavo/adventure-project-schema/localisation";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  resolveRuntimeLocale,
  resolveRuntimeLocalisedText,
} from "@evavo/adventure-runtime-bundle/localisation";

export type PlayerSystemLocalisationBundle = Pick<RuntimeBundle, "localisation">;

const browserLocale = (): string | null => {
  if (typeof document === "undefined") return null;
  const locale = document.documentElement.lang.trim();
  return locale.length > 0 ? locale : null;
};

export const createPlayerSystemText = (
  bundle?: PlayerSystemLocalisationBundle | null,
  requestedLocale?: string | null,
): PlayerSystemTextResolver => {
  const pack = bundle?.localisation;
  if (!pack) return canonicalPlayerSystemText;

  const locale = resolveRuntimeLocale(
    pack,
    requestedLocale?.trim() || browserLocale() || pack.defaultLocale,
  );
  const sourceKeys = new Set(pack.sourceEntries.map((entry) => entry.key));

  return (field, values = {}) => {
    const key = playerSystemLocalisationKey(field);
    const text = sourceKeys.has(key)
      ? resolveRuntimeLocalisedText(pack, locale, key).text
      : playerSystemSourceText[field];
    return formatPlayerSystemText(text, values);
  };
};
