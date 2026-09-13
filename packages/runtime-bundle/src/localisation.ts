import {
  type Action,
  type AdventureProject,
  idSchema,
} from "@evavo/adventure-project-schema";
import {
  canonicaliseLocalisationManifest,
  collectLocalisationSourceEntries,
  localeKey,
  type LocalisationIssue,
  type LocalisationLocale,
  type LocalisationManifest,
  type LocalisationSourceEntry,
  localisationLocaleSchema,
  localisationTextRoleSchema,
  localeTagSchema,
  validateLocalisationManifestWithSupplementalSources,
} from "@evavo/adventure-project-schema/localisation";
import { z } from "zod";
import type { RuntimeBundle } from "./index.js";
import { localiseGameLifecycleManifest } from "./lifecycle-localisation.js";

export const runtimeLocalisationSourceEntrySchema = z
  .object({
    key: z.string().min(1),
    role: localisationTextRoleSchema,
    ownerId: z.string().min(1),
    sourcePath: z.string().min(1),
    text: z.string(),
  })
  .strict();

export const runtimeLocalisationPackSchema = z
  .object({
    packVersion: z.literal(1),
    projectId: idSchema("project"),
    sourceLocale: localeTagSchema,
    defaultLocale: localeTagSchema,
    locales: z.array(localisationLocaleSchema),
    sourceEntries: z.array(runtimeLocalisationSourceEntrySchema),
  })
  .strict();

export interface RuntimeLocalisationPack {
  readonly packVersion: 1;
  readonly projectId: RuntimeBundle["projectId"];
  readonly sourceLocale: string;
  readonly defaultLocale: string;
  readonly locales: readonly LocalisationLocale[];
  readonly sourceEntries: readonly LocalisationSourceEntry[];
}

export const parseRuntimeLocalisationPack = (input: unknown): RuntimeLocalisationPack =>
  runtimeLocalisationPackSchema.parse(input) as RuntimeLocalisationPack;

export class RuntimeLocalisationCompilationError extends Error {
  readonly issues: readonly LocalisationIssue[];

  constructor(issues: readonly LocalisationIssue[]) {
    super(`Runtime localisation compilation failed with ${issues.length} issue(s).`);
    this.name = "RuntimeLocalisationCompilationError";
    this.issues = issues;
  }
}

const sameSourceEntry = (
  left: LocalisationSourceEntry,
  right: LocalisationSourceEntry,
): boolean =>
  left.key === right.key &&
  left.role === right.role &&
  left.ownerId === right.ownerId &&
  left.sourcePath === right.sourcePath &&
  left.text === right.text;

const packLocaleHasTranslation = (
  pack: RuntimeLocalisationPack,
  requestedLocale: string,
  key: string,
): boolean => {
  const locales = new Map(
    pack.locales.map((locale) => [localeKey(locale.locale), locale] as const),
  );
  const visited = new Set<string>();
  let currentTag = localeKey(requestedLocale);

  while (!visited.has(currentTag)) {
    visited.add(currentTag);
    const locale = locales.get(currentTag);
    if (!locale) break;
    const translated = locale.entries.find(
      (entry) => entry.key === key && entry.text.trim().length > 0,
    );
    if (translated) return true;
    if (
      !locale.fallbackLocale ||
      localeKey(locale.fallbackLocale) === localeKey(pack.sourceLocale)
    ) {
      break;
    }
    currentTag = localeKey(locale.fallbackLocale);
  }

  return false;
};

export const extendRuntimeLocalisationPack = (
  pack: RuntimeLocalisationPack,
  sourceEntries: readonly LocalisationSourceEntry[],
): RuntimeLocalisationPack => {
  if (sourceEntries.length === 0) return pack;
  const byKey = new Map(pack.sourceEntries.map((entry) => [entry.key, entry] as const));
  const additions: LocalisationSourceEntry[] = [];

  for (const entry of sourceEntries) {
    const existing = byKey.get(entry.key);
    if (existing && !sameSourceEntry(existing, entry)) {
      throw new Error(
        `Runtime localisation source key '${entry.key}' has conflicting canonical definitions.`,
      );
    }
    if (!existing) {
      byKey.set(entry.key, entry);
      additions.push(entry);
    }
  }

  if (additions.length === 0) return pack;
  const releaseIssues: LocalisationIssue[] = [];
  pack.locales.forEach((locale, localeIndex) => {
    if (locale.status !== "release") return;
    for (const entry of additions) {
      if (packLocaleHasTranslation(pack, locale.locale, entry.key)) continue;
      releaseIssues.push({
        severity: "error",
        code: "missing-localisation-key",
        path: `locales[${localeIndex}].entries`,
        message: `Release locale '${locale.locale}' has no translated value for '${entry.key}'.`,
        locale: locale.locale,
        key: entry.key,
      });
    }
  });
  if (releaseIssues.length > 0) {
    throw new RuntimeLocalisationCompilationError(releaseIssues);
  }

  return parseRuntimeLocalisationPack({
    ...pack,
    sourceEntries: [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
  });
};

const supportedLocale = (manifest: LocalisationManifest, locale: string): boolean => {
  const requested = localeKey(locale);
  return (
    requested === localeKey(manifest.sourceLocale) ||
    manifest.locales.some((candidate) => localeKey(candidate.locale) === requested)
  );
};

export const createRuntimeLocalisationPack = (
  project: AdventureProject,
  manifest: LocalisationManifest,
  defaultLocale = manifest.sourceLocale,
  supplementalSourceEntries: readonly LocalisationSourceEntry[] = [],
): RuntimeLocalisationPack => {
  const issues = validateLocalisationManifestWithSupplementalSources(
    project,
    manifest,
    supplementalSourceEntries,
  );
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new RuntimeLocalisationCompilationError(errors);
  if (!supportedLocale(manifest, defaultLocale)) {
    throw new RangeError(
      `Default locale '${defaultLocale}' is neither the source locale nor a declared target locale.`,
    );
  }

  const canonical = canonicaliseLocalisationManifest(manifest);
  return parseRuntimeLocalisationPack({
    packVersion: 1,
    projectId: project.id,
    sourceLocale: canonical.sourceLocale,
    defaultLocale,
    locales: canonical.locales,
    sourceEntries: collectLocalisationSourceEntries(project, supplementalSourceEntries),
  });
};

export interface RuntimeLocaleOption {
  readonly locale: string;
  readonly label: string;
  readonly source: boolean;
  readonly status: "source" | LocalisationLocale["status"];
}

export const runtimeLocaleOptions = (
  pack: RuntimeLocalisationPack,
): readonly RuntimeLocaleOption[] => [
  {
    locale: pack.sourceLocale,
    label: pack.sourceLocale,
    source: true,
    status: "source",
  },
  ...pack.locales.map((locale) => ({
    locale: locale.locale,
    label: locale.label ?? locale.locale,
    source: false,
    status: locale.status,
  })),
];

const sourceMap = (pack: RuntimeLocalisationPack): ReadonlyMap<string, LocalisationSourceEntry> =>
  new Map(pack.sourceEntries.map((entry) => [entry.key, entry] as const));

const localeMap = (pack: RuntimeLocalisationPack): ReadonlyMap<string, LocalisationLocale> =>
  new Map(pack.locales.map((locale) => [localeKey(locale.locale), locale] as const));

const localeEntryMap = (
  locale: LocalisationLocale,
): ReadonlyMap<string, string> =>
  new Map(
    locale.entries
      .filter((entry) => entry.text.trim().length > 0)
      .map((entry) => [entry.key, entry.text] as const),
  );

export interface ResolvedRuntimeLocalisedText {
  readonly key: string;
  readonly text: string;
  readonly requestedLocale: string;
  readonly resolvedLocale: string;
  readonly sourceFallback: boolean;
  readonly fallbackDepth: number;
}

export const resolveRuntimeLocalisedText = (
  pack: RuntimeLocalisationPack,
  requestedLocale: string,
  key: string,
): ResolvedRuntimeLocalisedText => {
  const source = sourceMap(pack).get(key);
  if (!source) throw new Error(`Runtime localisation key '${key}' does not exist.`);
  if (localeKey(requestedLocale) === localeKey(pack.sourceLocale)) {
    return {
      key,
      text: source.text,
      requestedLocale,
      resolvedLocale: pack.sourceLocale,
      sourceFallback: true,
      fallbackDepth: 0,
    };
  }

  const locales = localeMap(pack);
  const visited = new Set<string>();
  let currentTag = localeKey(requestedLocale);
  let depth = 0;
  while (!visited.has(currentTag)) {
    visited.add(currentTag);
    const locale = locales.get(currentTag);
    if (!locale) break;
    const translated = localeEntryMap(locale).get(key);
    if (translated !== undefined) {
      return {
        key,
        text: translated,
        requestedLocale,
        resolvedLocale: locale.locale,
        sourceFallback: false,
        fallbackDepth: depth,
      };
    }
    if (!locale.fallbackLocale || localeKey(locale.fallbackLocale) === localeKey(pack.sourceLocale)) {
      break;
    }
    currentTag = localeKey(locale.fallbackLocale);
    depth += 1;
  }

  if (
    localeKey(requestedLocale) !== localeKey(pack.defaultLocale) &&
    localeKey(pack.defaultLocale) !== localeKey(pack.sourceLocale)
  ) {
    const fallback = resolveRuntimeLocalisedText(pack, pack.defaultLocale, key);
    if (!fallback.sourceFallback) {
      return {
        ...fallback,
        requestedLocale,
        fallbackDepth: fallback.fallbackDepth + depth + 1,
      };
    }
  }

  return {
    key,
    text: source.text,
    requestedLocale,
    resolvedLocale: pack.sourceLocale,
    sourceFallback: true,
    fallbackDepth: depth,
  };
};

export const resolveRuntimeLocale = (
  pack: RuntimeLocalisationPack,
  requestedLocale: string | null | undefined,
): string => {
  if (!requestedLocale) return pack.defaultLocale;
  const requested = localeKey(requestedLocale);
  if (requested === localeKey(pack.sourceLocale)) return pack.sourceLocale;
  const exact = pack.locales.find((locale) => localeKey(locale.locale) === requested);
  return exact?.locale ?? pack.defaultLocale;
};

const localiseActions = (
  actions: readonly Action[],
  keyPrefix: string,
  resolve: (key: string) => string,
): readonly Action[] =>
  actions.map((action, actionIndex) =>
    action.kind === "say"
      ? {
          ...action,
          text: resolve(`${keyPrefix}.action.${actionIndex}.say`),
        }
      : action,
  );

export const localiseRuntimeBundle = (
  bundle: RuntimeBundle,
  requestedLocale?: string | null,
): RuntimeBundle => {
  const pack = bundle.localisation;
  if (!pack) return bundle;
  const locale = resolveRuntimeLocale(pack, requestedLocale);
  const sources = sourceMap(pack);
  const resolve = (key: string): string => resolveRuntimeLocalisedText(pack, locale, key).text;
  const resolveOptional = (key: string, sourceText: string): string =>
    sources.has(key) ? resolve(key) : sourceText;

  return {
    ...bundle,
    title: resolve("project.title"),
    scenes: bundle.scenes.map((scene) => ({
      ...scene,
      name: resolve(`${scene.id}.name`),
      fallbackText: resolve(`${scene.id}.fallback`),
      hotspots: scene.hotspots.map((hotspot) => ({
        ...hotspot,
        name: resolve(`${hotspot.id}.name`),
        ...(hotspot.fallbackText === undefined
          ? {}
          : { fallbackText: resolve(`${hotspot.id}.fallback`) }),
        interactions: hotspot.interactions.map((interaction) => ({
          ...interaction,
          actions: localiseActions(interaction.actions, interaction.id, resolve),
        })),
      })),
    })),
    actors: bundle.actors.map((actor) => ({
      ...actor,
      name: resolve(`${actor.id}.name`),
    })),
    dialogues: bundle.dialogues.map((dialogue) => ({
      ...dialogue,
      name: resolve(`${dialogue.id}.name`),
      nodes: dialogue.nodes.map((node) => ({
        ...node,
        enterActions: localiseActions(node.enterActions, `${node.id}.enter`, resolve),
        lines: node.lines.map((line) => ({
          ...line,
          text: resolve(`${line.id}.text`),
        })),
        choices: node.choices.map((choice) => ({
          ...choice,
          text: resolve(`${choice.id}.text`),
          actions: localiseActions(choice.actions, choice.id, resolve),
        })),
        exitActions: localiseActions(node.exitActions, `${node.id}.exit`, resolve),
      })),
    })),
    sequences: bundle.sequences.map((sequence) => ({
      ...sequence,
      name: resolve(`${sequence.id}.name`),
      skip: {
        ...sequence.skip,
        completionActions: localiseActions(
          sequence.skip.completionActions,
          `${sequence.id}.skip`,
          resolve,
        ),
      },
      tracks: sequence.tracks.map((track) => ({
        ...track,
        cues: track.cues.map((cue, cueIndex) => {
          if (cue.kind === "speech") {
            return {
              ...cue,
              text: resolve(`${sequence.id}.${track.id}.cue.${cueIndex}.speech`),
            };
          }
          if (cue.kind === "story-action" && cue.action.kind === "say") {
            return {
              ...cue,
              action: {
                ...cue.action,
                text: resolve(`${sequence.id}.${track.id}.cue.${cueIndex}.say`),
              },
            };
          }
          return cue;
        }),
      })),
    })),
    inventoryItems: bundle.inventoryItems.map((item) => ({
      ...item,
      name: resolve(`${item.id}.name`),
      description:
        item.description.length === 0
          ? item.description
          : resolve(`${item.id}.description`),
    })),
    ...(bundle.lifecycle
      ? { lifecycle: localiseGameLifecycleManifest(bundle.lifecycle, resolveOptional) }
      : {}),
  };
};

export const runtimeBundleSaveCompatibilityView = (bundle: RuntimeBundle): RuntimeBundle => {
  if (!bundle.localisation) return bundle;
  const sourceBundle = localiseRuntimeBundle(bundle, bundle.localisation.sourceLocale);
  const { localisation: _localisation, ...withoutLocalisation } = sourceBundle;
  return withoutLocalisation as RuntimeBundle;
};
