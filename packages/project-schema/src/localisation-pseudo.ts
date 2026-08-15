import type { AdventureProject } from "./index.js";
import { collectLocalisationSourceEntries } from "./localisation-supplemental.js";
import type {
  LocalisationLocale,
  LocalisationSourceEntry,
  LocalisationStatus,
} from "./localisation-types.js";

export interface PseudoLocalisationOptions {
  readonly expansionRatio?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly filler?: string;
}

const PSEUDO_CHARACTERS: Readonly<Record<string, string>> = {
  A: "Å",
  B: "Ɓ",
  C: "Ç",
  D: "Ð",
  E: "É",
  F: "Ƒ",
  G: "Ğ",
  H: "Ħ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ŀ",
  M: "Ḿ",
  N: "Ñ",
  O: "Ö",
  P: "Þ",
  Q: "Q",
  R: "Ŕ",
  S: "Š",
  T: "Ŧ",
  U: "Ü",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẋ",
  Y: "Ÿ",
  Z: "Ž",
  a: "å",
  b: "ƀ",
  c: "ç",
  d: "ð",
  e: "é",
  f: "ƒ",
  g: "ğ",
  h: "ħ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ŀ",
  m: "ḿ",
  n: "ñ",
  o: "ö",
  p: "þ",
  q: "q",
  r: "ŕ",
  s: "š",
  t: "ŧ",
  u: "ü",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ÿ",
  z: "ž",
};

const PLACEHOLDER_SEGMENT = /^\{[A-Za-z_][A-Za-z0-9_.-]*\}$/;

export const pseudoLocaliseText = (
  text: string,
  options: PseudoLocalisationOptions = {},
): string => {
  const expansionRatio = options.expansionRatio ?? 0.35;
  if (!Number.isFinite(expansionRatio) || expansionRatio < 0 || expansionRatio > 2) {
    throw new RangeError("Pseudo-localisation expansion ratio must be between 0 and 2.");
  }
  const prefix = options.prefix ?? "[!! ";
  const suffix = options.suffix ?? " !!]";
  const filler = options.filler ?? "~";
  if (filler.length === 0) throw new RangeError("Pseudo-localisation filler must not be empty.");

  const segments = text.split(/(\{[A-Za-z_][A-Za-z0-9_.-]*\})/g);
  let visibleCharacters = 0;
  const transformed = segments
    .map((segment) => {
      if (PLACEHOLDER_SEGMENT.test(segment)) return segment;
      return [...segment]
        .map((character) => {
          if (/\p{L}/u.test(character)) visibleCharacters += 1;
          return PSEUDO_CHARACTERS[character] ?? character;
        })
        .join("");
    })
    .join("");
  const paddingLength = Math.ceil(visibleCharacters * expansionRatio);
  return `${prefix}${transformed}${filler.repeat(paddingLength)}${suffix}`;
};

export interface PseudoLocalisationLocaleOptions extends PseudoLocalisationOptions {
  readonly locale?: string;
  readonly label?: string;
  readonly status?: LocalisationStatus;
}

export const createPseudoLocalisationLocale = (
  project: AdventureProject,
  options: PseudoLocalisationLocaleOptions = {},
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): LocalisationLocale => ({
  locale: options.locale ?? "qps-ploc",
  label: options.label ?? "Pseudo-localised",
  status: options.status ?? "draft",
  entries: collectLocalisationSourceEntries(project, supplementalSourceEntries).map((entry) => ({
    key: entry.key,
    text: pseudoLocaliseText(entry.text, options),
  })),
});
