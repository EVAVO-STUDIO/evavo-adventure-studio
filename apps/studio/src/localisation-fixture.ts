import {
  type LocalisationTextFitProfile,
  localisationTextFitProfileSchema,
} from "@evavo/adventure-bitmap-font/localisation";
import {
  canonicaliseLocalisationManifest,
  collectLocalisationSourceEntries,
  createLocalisationTemplate,
  createPseudoLocalisationLocale,
  extractFrontEndLocalisableText,
  extractLifecycleLocalisableText,
  extractPlayerSystemLocalisableText,
  frontEndLocalisationKey,
  lifecycleLocalisationKey,
  type LocalisationManifest,
  type LocalisationSourceEntry,
  playerSystemLocalisationKey,
} from "@evavo/adventure-project-schema/localisation";
import { studioBitmapFonts, studioFontProject } from "./font-fixture.js";
import { studioFrontEndManifest } from "./front-end-fixture.js";
import { studioLifecycleManifest } from "./lifecycle-fixture.js";

export const studioLocalisationSupplementalSources: readonly LocalisationSourceEntry[] = [
  ...extractFrontEndLocalisableText(studioFrontEndManifest),
  ...extractLifecycleLocalisableText(studioLifecycleManifest),
  ...extractPlayerSystemLocalisableText(studioFontProject.id),
].sort((left, right) => left.key.localeCompare(right.key));

const sourceEntries = collectLocalisationSourceEntries(
  studioFontProject,
  studioLocalisationSupplementalSources,
);
const template = createLocalisationTemplate(
  studioFontProject,
  "en-AU",
  [{ locale: "fr-FR", label: "Français", status: "review" }],
  studioLocalisationSupplementalSources,
);
const french = template.locales[0];
if (!french) throw new Error("Studio localisation fixture requires a French locale.");

const frenchTranslations: Readonly<Record<string, string>> = {
  "project.title": "Le registre rouge",
  [frontEndLocalisationKey("publisher.presents")]: "ADVENTURE STUDIO PRÉSENTE",
  [frontEndLocalisationKey("title.kicker")]: "UNE AVENTURE POINT AND CLICK CLASSIQUE",
  [frontEndLocalisationKey("menu.newGame")]: "NOUVELLE PARTIE",
  [frontEndLocalisationKey("menu.loadGame")]: "CHARGER UNE PARTIE",
  [frontEndLocalisationKey("menu.options")]: "OPTIONS",
  [frontEndLocalisationKey("menu.credits")]: "GÉNÉRIQUE",
  [frontEndLocalisationKey("menu.quit")]: "QUITTER",
  [frontEndLocalisationKey("menu.back")]: "RETOUR",
  [lifecycleLocalisationKey("outcome.case-closed", "title")]: "Affaire classée",
  [lifecycleLocalisationKey("outcome.case-closed", "message")]:
    "La piste est froide. Mara ne peut plus terminer l'enquête.",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.quickRetry")]: "RÉESSAYER",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.loadGame")]: "CHARGER",
  [lifecycleLocalisationKey("outcome.case-closed", "menu.returnToTitle")]:
    "RETOUR AU TITRE",
  [playerSystemLocalisationKey("heading.paused")]: "JEU EN PAUSE",
  [playerSystemLocalisationKey("heading.save")]: "SAUVEGARDER",
  [playerSystemLocalisationKey("heading.load")]: "CHARGER",
  [playerSystemLocalisationKey("menu.resume")]: "REPRENDRE",
  [playerSystemLocalisationKey("menu.save")]: "SAUVEGARDER",
  [playerSystemLocalisationKey("menu.load")]: "CHARGER",
  [playerSystemLocalisationKey("menu.options")]: "OPTIONS",
  [playerSystemLocalisationKey("menu.returnToTitle")]: "RETOUR AU TITRE",
  [playerSystemLocalisationKey("menu.back")]: "RETOUR",
  [playerSystemLocalisationKey("slot.quick")]: "SAUVEGARDE RAPIDE",
  [playerSystemLocalisationKey("slot.numbered")]: "EMPLACEMENT {slot}",
  [playerSystemLocalisationKey("slot.empty")]: "{title} — VIDE",
  [playerSystemLocalisationKey("slot.valid")]: "{title} — {scene} TOUR {tick}",
  [playerSystemLocalisationKey("slot.itemSingular")]: "OBJET",
  [playerSystemLocalisationKey("slot.itemPlural")]: "OBJETS",
  [playerSystemLocalisationKey("status.quickSaveWritten")]:
    "SAUVEGARDE RAPIDE ENREGISTRÉE.",
  [playerSystemLocalisationKey("status.saveSlotWritten")]:
    "EMPLACEMENT {slot} ENREGISTRÉ.",
};

export const studioLocalisationManifest: LocalisationManifest = canonicaliseLocalisationManifest({
  ...template,
  locales: [
    {
      ...french,
      entries: sourceEntries.map((entry) => ({
        key: entry.key,
        text: frenchTranslations[entry.key] ?? "",
      })),
    },
    createPseudoLocalisationLocale(
      studioFontProject,
      {
        locale: "qps-ploc",
        label: "Pseudo-localised",
        status: "draft",
        expansionRatio: 0.35,
      },
      studioLocalisationSupplementalSources,
    ),
  ],
});

export const studioLocalisationTextFitProfile: LocalisationTextFitProfile =
  localisationTextFitProfileSchema.parse({
    profileVersion: 1,
    projectId: studioFontProject.id,
    rules: [
      {
        id: "text-fit.compact-label",
        roles: [
          "project-title",
          "scene-name",
          "hotspot-name",
          "actor-name",
          "dialogue-name",
          "sequence-name",
          "inventory-name",
          "lifecycle-title",
          "lifecycle-menu-label",
          "front-end-menu-label",
          "player-system-menu-label",
        ],
        fontId: "bitmap-font.dialogue",
        maxWidth: 180,
        maxHeight: 20,
        maxLines: 2,
        alignment: "left",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.front-end-heading",
        roles: [
          "front-end-publisher",
          "front-end-title",
          "player-system-heading",
        ],
        fontId: "bitmap-font.dialogue",
        maxWidth: 260,
        maxHeight: 30,
        maxLines: 3,
        alignment: "center",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.body-copy",
        roles: [
          "scene-fallback",
          "hotspot-fallback",
          "dialogue-line",
          "dialogue-choice",
          "sequence-speech",
          "action-say",
          "inventory-description",
          "lifecycle-message",
          "player-system-description",
          "player-system-status",
        ],
        fontId: "bitmap-font.dialogue",
        maxWidth: 284,
        maxHeight: 44,
        maxLines: 4,
        alignment: "left",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "error",
        glyphSeverity: "warning",
      },
      {
        id: "text-fit.front-end-credit",
        roles: ["front-end-credit", "player-system-footer"],
        fontId: "bitmap-font.dialogue",
        maxWidth: 300,
        maxHeight: 50,
        maxLines: 4,
        alignment: "center",
        lineSpacing: 1,
        tabSpaces: 4,
        overflowSeverity: "warning",
        glyphSeverity: "warning",
      },
    ],
  });

export { studioBitmapFonts, studioFontProject };
