import { z } from "zod";
import { type Id, idSchema } from "./index.js";

export const localeTagSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/,
    "Locale tags must use a deterministic BCP 47-compatible form such as en, en-AU or zh-Hant-TW.",
  );

export const localisationEntrySchema = z
  .object({
    key: z.string().min(1),
    text: z.string(),
  })
  .strict();
export interface LocalisationEntry {
  readonly key: string;
  readonly text: string;
}

export const localisationLocaleSchema = z
  .object({
    locale: localeTagSchema,
    label: z.string().min(1).optional(),
    status: z.enum(["draft", "review", "release"]).default("draft"),
    fallbackLocale: localeTagSchema.optional(),
    entries: z.array(localisationEntrySchema).default([]),
  })
  .strict();
export type LocalisationStatus = "draft" | "review" | "release";
export interface LocalisationLocale {
  readonly locale: string;
  readonly label?: string;
  readonly status: LocalisationStatus;
  readonly fallbackLocale?: string;
  readonly entries: readonly LocalisationEntry[];
}

export const localisationManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    sourceLocale: localeTagSchema,
    locales: z.array(localisationLocaleSchema).min(1),
  })
  .strict();
export interface LocalisationManifest {
  readonly manifestVersion: 1;
  readonly projectId: Id<"project">;
  readonly sourceLocale: string;
  readonly locales: readonly LocalisationLocale[];
}

export const parseLocalisationManifest = (input: unknown): LocalisationManifest =>
  localisationManifestSchema.parse(input) as LocalisationManifest;

export const localisationTextRoleSchema = z.enum([
  "project-title",
  "scene-name",
  "scene-fallback",
  "hotspot-name",
  "hotspot-fallback",
  "actor-name",
  "dialogue-name",
  "dialogue-line",
  "dialogue-choice",
  "sequence-name",
  "sequence-speech",
  "action-say",
  "inventory-name",
  "inventory-description",
  "lifecycle-title",
  "lifecycle-message",
  "lifecycle-menu-label",
  "front-end-publisher",
  "front-end-title",
  "front-end-menu-label",
  "front-end-credit",
  "player-system-heading",
  "player-system-description",
  "player-system-menu-label",
  "player-system-status",
  "player-system-footer",
]);
export type LocalisationTextRole =
  | "project-title"
  | "scene-name"
  | "scene-fallback"
  | "hotspot-name"
  | "hotspot-fallback"
  | "actor-name"
  | "dialogue-name"
  | "dialogue-line"
  | "dialogue-choice"
  | "sequence-name"
  | "sequence-speech"
  | "action-say"
  | "inventory-name"
  | "inventory-description"
  | "lifecycle-title"
  | "lifecycle-message"
  | "lifecycle-menu-label"
  | "front-end-publisher"
  | "front-end-title"
  | "front-end-menu-label"
  | "front-end-credit"
  | "player-system-heading"
  | "player-system-description"
  | "player-system-menu-label"
  | "player-system-status"
  | "player-system-footer";

export interface LocalisationSourceEntry {
  readonly key: string;
  readonly role: LocalisationTextRole;
  readonly ownerId: string;
  readonly sourcePath: string;
  readonly text: string;
}
