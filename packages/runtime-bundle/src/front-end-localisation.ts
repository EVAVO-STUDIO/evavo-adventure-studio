import type { ClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import {
  frontEndLocalisationKey,
  frontEndMenuLabelKeys,
} from "@evavo/adventure-project-schema/localisation";
import type { RuntimeBundle } from "./index.js";
import {
  resolveRuntimeLocale,
  resolveRuntimeLocalisedText,
} from "./localisation.js";

export type FrontEndTextResolver = (key: string, sourceText: string) => string;

export const localiseClassicFrontEndManifest = (
  manifest: ClassicFrontEndManifest,
  resolve: FrontEndTextResolver,
): ClassicFrontEndManifest => {
  const labels = { ...manifest.menu.labels };
  for (const label of frontEndMenuLabelKeys) {
    labels[label] = resolve(
      frontEndLocalisationKey(`menu.${label}`),
      manifest.menu.labels[label],
    );
  }

  return {
    ...manifest,
    publisher: {
      ...manifest.publisher,
      name: resolve(
        frontEndLocalisationKey("publisher.name"),
        manifest.publisher.name,
      ),
      presents: resolve(
        frontEndLocalisationKey("publisher.presents"),
        manifest.publisher.presents,
      ),
    },
    title: {
      ...manifest.title,
      kicker: resolve(
        frontEndLocalisationKey("title.kicker"),
        manifest.title.kicker,
      ),
    },
    menu: {
      ...manifest.menu,
      labels,
    },
    credits: {
      ...manifest.credits,
      lines: manifest.credits.lines.map((line, index) =>
        resolve(frontEndLocalisationKey(`credits.line.${index}`), line),
      ),
    },
  };
};

export const localiseRuntimeFrontEnd = (
  bundle: RuntimeBundle,
  requestedLocale?: string | null,
): RuntimeBundle => {
  const pack = bundle.localisation;
  if (!pack || !bundle.frontEnd) return bundle;
  const locale = resolveRuntimeLocale(pack, requestedLocale);
  const sourceKeys = new Set(pack.sourceEntries.map((entry) => entry.key));
  const resolve: FrontEndTextResolver = (key, sourceText) =>
    sourceKeys.has(key)
      ? resolveRuntimeLocalisedText(pack, locale, key).text
      : sourceText;

  return {
    ...bundle,
    frontEnd: localiseClassicFrontEndManifest(bundle.frontEnd, resolve),
  };
};
