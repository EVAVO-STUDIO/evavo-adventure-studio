import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { sha256Schema } from "@evavo/adventure-asset-contract";
import { indexedAssetManifestSchema } from "@evavo/adventure-asset-contract/indexed-assets";
import { runtimeAssetRecordSchema } from "@evavo/adventure-asset-contract/runtime-asset";
import { bitmapFontManifestSchema } from "@evavo/adventure-bitmap-font";
import { registerBitmapFontsForAssetCollection } from "@evavo/adventure-bitmap-font/runtime-registry";
import {
  actorSchema,
  dialogueGraphSchema,
  hotspotSchema,
  idSchema,
  inventoryItemSchema,
  presentationProfileSchema,
  sceneSchema,
  sequenceSchema,
} from "@evavo/adventure-project-schema";
import { classicFrontEndManifestSchema } from "@evavo/adventure-project-schema/front-end";
import { gameLifecycleManifestSchema } from "@evavo/adventure-project-schema/lifecycle";
import {
  gameOpeningManifestSchema,
  validateGameOpeningManifest,
} from "@evavo/adventure-project-schema/opening";
import { sceneInstanceManifestSchema } from "@evavo/adventure-scene-instances";
import { paletteMapManifestSchema } from "@evavo/adventure-scene-instances/palette-maps";
import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";
import { uiSkinManifestSchema } from "@evavo/adventure-ui-skin";
import { z } from "zod";
import {
  RuntimeAudioMixValidationError,
  validateRuntimeAudioMix,
} from "./audio-validation.js";
import {
  RuntimeBitmapFontValidationError,
  validateRuntimeBitmapFonts,
} from "./font-validation.js";
import {
  RuntimeIndexedAssetValidationError,
  validateRuntimeIndexedAssets,
} from "./indexed-asset-validation.js";
import {
  RuntimeSceneInstanceValidationError,
  validateRuntimeSceneInstances,
} from "./instance-validation.js";
import {
  runtimeInvestigationBindingManifestSchema,
  type RuntimeInvestigationBindingIssue,
  validateRuntimeInvestigationBindings,
} from "./investigation-bindings.js";
import {
  RuntimeInvestigationValidationError,
  runtimeInvestigationManifestSchema,
  validateRuntimeInvestigation,
} from "./investigation.js";
import {
  RuntimeItemCombinationValidationError,
  runtimeItemCombinationManifestSchema,
  validateRuntimeItemCombinations,
} from "./item-combinations.js";
import { runtimeLocalisationPackSchema } from "./localisation.js";
import {
  runtimeMultiProtagonistBindingManifestSchema,
  type RuntimeMultiProtagonistBindingIssue,
  validateRuntimeMultiProtagonistBindings,
} from "./multi-protagonist-bindings.js";
import {
  runtimeMultiProtagonistManifestSchema,
  type RuntimeMultiProtagonistIssue,
  validateRuntimeMultiProtagonist,
} from "./multi-protagonist.js";
import {
  RuntimePaletteMapValidationError,
  validateRuntimePaletteMaps,
} from "./palette-map-validation.js";
import {
  RuntimeRoomScriptValidationError,
  runtimeRoomScriptManifestSchema,
  validateRuntimeRoomScripts,
} from "./room-scripts.js";
import {
  RuntimeAdventureRpgValidationError,
  runtimeAdventureRpgManifestSchema,
  validateRuntimeAdventureRpg,
} from "./rpg.js";
import {
  RuntimeUiSkinValidationError,
  validateRuntimeUiSkins,
} from "./ui-validation.js";
import {
  RuntimeBundleValidationError,
  validateRuntimeBundleSemantics,
} from "./validation.js";

export const compiledHotspotSchema = hotspotSchema.extend({
  interactionIndex: z.record(z.string().min(1), z.array(idSchema("interaction"))),
});
export type CompiledHotspot = z.infer<typeof compiledHotspotSchema>;

export const compiledSceneSchema = sceneSchema.extend({
  hotspots: z.array(compiledHotspotSchema),
});
export type CompiledScene = z.infer<typeof compiledSceneSchema>;

export const compiledDialogueSchema = dialogueGraphSchema.extend({
  nodeIndex: z.record(z.string().min(1), z.number().int().nonnegative()),
});
export type CompiledDialogue = z.infer<typeof compiledDialogueSchema>;

export const compiledSequenceSchema = sequenceSchema.extend({
  cueCount: z.number().int().nonnegative(),
});
export type CompiledSequence = z.infer<typeof compiledSequenceSchema>;

export const runtimePlayFeelProfileIdSchema = z.enum([
  "classic-balanced",
  "storybook-deliberate",
  "comic-snappy",
  "gothic-measured",
  "verb-panel-responsive",
  "pulp-grounded",
  "cinematic-directed",
  "noir-restrained",
]);
export type RuntimePlayFeelProfileId = z.infer<typeof runtimePlayFeelProfileIdSchema>;

export const runtimeBundleSchema = z
  .object({
    bundleVersion: z.literal(1),
    sourceSchemaVersion: z.literal(1),
    projectId: idSchema("project"),
    title: z.string().min(1),
    presentation: presentationProfileSchema,
    playFeelProfileId: runtimePlayFeelProfileIdSchema.optional(),
    startSceneId: idSchema("scene"),
    startEntranceId: idSchema("entrance"),
    assetManifestFingerprint: sha256Schema,
    assetCompilerVersion: z.string().min(1),
    assets: z.array(runtimeAssetRecordSchema),
    indexedAssets: indexedAssetManifestSchema.optional(),
    inventoryItems: z.array(inventoryItemSchema),
    actors: z.array(actorSchema),
    scenes: z.array(compiledSceneSchema).min(1),
    dialogues: z.array(compiledDialogueSchema),
    sequences: z.array(compiledSequenceSchema),
    sceneInstances: sceneInstanceManifestSchema.optional(),
    sceneStaging: sceneStagingManifestSchema.optional(),
    paletteMaps: paletteMapManifestSchema.optional(),
    bitmapFonts: bitmapFontManifestSchema.optional(),
    uiSkins: uiSkinManifestSchema.optional(),
    audioMix: audioMixManifestSchema.optional(),
    localisation: runtimeLocalisationPackSchema.optional(),
    frontEnd: classicFrontEndManifestSchema.optional(),
    lifecycle: gameLifecycleManifestSchema.optional(),
    opening: gameOpeningManifestSchema.optional(),
    investigation: runtimeInvestigationManifestSchema.optional(),
    investigationBindings: runtimeInvestigationBindingManifestSchema.optional(),
    itemCombinations: runtimeItemCombinationManifestSchema.optional(),
    multiProtagonist: runtimeMultiProtagonistManifestSchema.optional(),
    multiProtagonistBindings: runtimeMultiProtagonistBindingManifestSchema.optional(),
    roomScripts: runtimeRoomScriptManifestSchema.optional(),
    rpg: runtimeAdventureRpgManifestSchema.optional(),
  })
  .strict()
  .superRefine((bundle, context) => {
    const projectScoped = [
      ["indexedAssets", bundle.indexedAssets],
      ["sceneStaging", bundle.sceneStaging],
      ["paletteMaps", bundle.paletteMaps],
      ["frontEnd", bundle.frontEnd],
      ["lifecycle", bundle.lifecycle],
      ["investigation", bundle.investigation],
      ["investigationBindings", bundle.investigationBindings],
      ["itemCombinations", bundle.itemCombinations],
      ["multiProtagonist", bundle.multiProtagonist],
      ["multiProtagonistBindings", bundle.multiProtagonistBindings],
      ["roomScripts", bundle.roomScripts],
      ["rpg", bundle.rpg],
    ] as const;
    for (const [key, value] of projectScoped) {
      if (value && value.projectId !== bundle.projectId) {
        context.addIssue({
          code: "custom",
          path: [key, "projectId"],
          message: `${key} project '${value.projectId}' does not match runtime project '${bundle.projectId}'.`,
        });
      }
    }
    if (bundle.opening) {
      for (const issue of validateGameOpeningManifest(
        { id: bundle.projectId, sequences: bundle.sequences },
        bundle.opening,
      )) {
        context.addIssue({
          code: "custom",
          path: ["opening", issue.path],
          message: issue.message,
        });
      }
    }
  });
export type RuntimeBundle = z.infer<typeof runtimeBundleSchema>;

export class RuntimeInvestigationBindingValidationError extends Error {
  readonly issues: readonly RuntimeInvestigationBindingIssue[];

  constructor(issues: readonly RuntimeInvestigationBindingIssue[]) {
    super(`Runtime investigation bindings are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeInvestigationBindingValidationError";
    this.issues = issues;
  }
}

export class RuntimeMultiProtagonistValidationError extends Error {
  readonly issues: readonly RuntimeMultiProtagonistIssue[];

  constructor(issues: readonly RuntimeMultiProtagonistIssue[]) {
    super(`Runtime multi-protagonist manifest is invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeMultiProtagonistValidationError";
    this.issues = issues;
  }
}

export class RuntimeMultiProtagonistBindingValidationError extends Error {
  readonly issues: readonly RuntimeMultiProtagonistBindingIssue[];

  constructor(issues: readonly RuntimeMultiProtagonistBindingIssue[]) {
    super(`Runtime multi-protagonist bindings are invalid (${issues.length} issue(s)).`);
    this.name = "RuntimeMultiProtagonistBindingValidationError";
    this.issues = issues;
  }
}

const allRuntimeInteractions = (bundle: RuntimeBundle) => [
  ...bundle.scenes.flatMap((scene) => scene.hotspots.flatMap((hotspot) => hotspot.interactions)),
  ...(bundle.sceneInstances?.objectDefinitions.flatMap((definition) =>
    definition.states.flatMap((state) => state.interactions),
  ) ?? []),
];

const allRuntimeDialogueChoices = (bundle: RuntimeBundle) =>
  bundle.dialogues.flatMap((dialogue) => dialogue.nodes.flatMap((node) => node.choices));

const runtimeEntrancesByScene = (bundle: RuntimeBundle): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    bundle.scenes.map((scene) => [
      scene.id as string,
      new Set(scene.entrances.map((entrance) => entrance.id as string)),
    ]),
  );

export const parseRuntimeBundle = (input: unknown): RuntimeBundle => {
  const bundle = runtimeBundleSchema.parse(input);
  const issues = validateRuntimeBundleSemantics(bundle);
  if (issues.length > 0) throw new RuntimeBundleValidationError(issues);
  const sceneInstanceIssues = validateRuntimeSceneInstances(bundle);
  if (sceneInstanceIssues.length > 0) {
    throw new RuntimeSceneInstanceValidationError(sceneInstanceIssues);
  }
  const indexedAssetIssues = validateRuntimeIndexedAssets(bundle);
  if (indexedAssetIssues.length > 0) {
    throw new RuntimeIndexedAssetValidationError(indexedAssetIssues);
  }
  const paletteMapIssues = validateRuntimePaletteMaps(bundle);
  if (paletteMapIssues.length > 0) {
    throw new RuntimePaletteMapValidationError(paletteMapIssues);
  }
  const bitmapFontIssues = validateRuntimeBitmapFonts(bundle);
  if (bitmapFontIssues.length > 0) {
    throw new RuntimeBitmapFontValidationError(bitmapFontIssues);
  }
  const uiSkinIssues = validateRuntimeUiSkins(bundle).filter((issue) => issue.severity === "error");
  if (uiSkinIssues.length > 0) throw new RuntimeUiSkinValidationError(uiSkinIssues);
  const audioIssues = validateRuntimeAudioMix(bundle).filter((issue) => issue.severity === "error");
  if (audioIssues.length > 0) throw new RuntimeAudioMixValidationError(audioIssues);
  if (bundle.investigation) {
    const investigationIssues = validateRuntimeInvestigation(bundle.investigation);
    if (investigationIssues.length > 0) {
      throw new RuntimeInvestigationValidationError(investigationIssues);
    }
  }
  if (bundle.investigationBindings) {
    const interactions = allRuntimeInteractions(bundle);
    const dialogueChoices = allRuntimeDialogueChoices(bundle);
    const bindingIssues = validateRuntimeInvestigationBindings(bundle.investigationBindings, {
      investigation: bundle.investigation,
      interactionIds: new Set(interactions.map((interaction) => interaction.id as string)),
      dialogueChoiceIds: new Set(dialogueChoices.map((choice) => choice.id as string)),
      oneShotInteractionIds: new Set(
        interactions.filter((interaction) => interaction.once === true).map((interaction) => interaction.id as string),
      ),
      oneShotDialogueChoiceIds: new Set(
        dialogueChoices.filter((choice) => choice.once === true).map((choice) => choice.id as string),
      ),
    });
    if (bindingIssues.length > 0) {
      throw new RuntimeInvestigationBindingValidationError(bindingIssues);
    }
  }
  if (bundle.itemCombinations) {
    const combinationIssues = validateRuntimeItemCombinations(
      bundle.itemCombinations,
      new Set(bundle.inventoryItems.map((item) => item.id as string)),
    );
    if (combinationIssues.length > 0) {
      throw new RuntimeItemCombinationValidationError(combinationIssues);
    }
  }
  if (bundle.multiProtagonist) {
    const multiProtagonistIssues = validateRuntimeMultiProtagonist(bundle.multiProtagonist, {
      actorIds: new Set(bundle.actors.map((actor) => actor.id as string)),
      itemIds: new Set(bundle.inventoryItems.map((item) => item.id as string)),
      entrancesByScene: runtimeEntrancesByScene(bundle),
    });
    if (multiProtagonistIssues.length > 0) {
      throw new RuntimeMultiProtagonistValidationError(multiProtagonistIssues);
    }
  }
  if (bundle.multiProtagonistBindings) {
    const interactions = allRuntimeInteractions(bundle);
    const dialogueChoices = allRuntimeDialogueChoices(bundle);
    const recipeIds = new Set(bundle.itemCombinations?.recipes.map((recipe) => recipe.id) ?? []);
    const oneShotRecipeIds = new Set(
      (bundle.itemCombinations?.recipes ?? []).filter((recipe) => recipe.once === true).map((recipe) => recipe.id),
    );
    const bindingIssues = validateRuntimeMultiProtagonistBindings(bundle.multiProtagonistBindings, {
      protagonistIds: new Set(bundle.multiProtagonist?.protagonists.map((entry) => entry.protagonistId as string) ?? []),
      itemIds: new Set(bundle.inventoryItems.map((item) => item.id as string)),
      interactionIds: new Set(interactions.map((interaction) => interaction.id as string)),
      oneShotInteractionIds: new Set(interactions.filter((interaction) => interaction.once === true).map((interaction) => interaction.id as string)),
      dialogueChoiceIds: new Set(dialogueChoices.map((choice) => choice.id as string)),
      oneShotDialogueChoiceIds: new Set(dialogueChoices.filter((choice) => choice.once === true).map((choice) => choice.id as string)),
      recipeIds,
      oneShotRecipeIds,
      entrancesByScene: runtimeEntrancesByScene(bundle),
    });
    if (!bundle.multiProtagonist) {
      bindingIssues.unshift({
        severity: "error",
        code: "missing-multi-protagonist-manifest",
        path: "multiProtagonistBindings",
        message: "Cross-protagonist bindings require a multiProtagonist manifest.",
      });
    }
    if (bindingIssues.length > 0) {
      throw new RuntimeMultiProtagonistBindingValidationError(bindingIssues);
    }
  }
  if (bundle.roomScripts) {
    const roomScriptIssues = validateRuntimeRoomScripts(bundle.roomScripts, {
      sceneIds: new Set(bundle.scenes.map((scene) => scene.id as string)),
      entranceIdsByScene: runtimeEntrancesByScene(bundle),
      sequenceIds: new Set(bundle.sequences.map((sequence) => sequence.id as string)),
      interactionIds: new Set(allRuntimeInteractions(bundle).map((interaction) => interaction.id as string)),
      dialogueChoiceIds: new Set(allRuntimeDialogueChoices(bundle).map((choice) => choice.id as string)),
    });
    if (roomScriptIssues.length > 0) throw new RuntimeRoomScriptValidationError(roomScriptIssues);
  }
  if (bundle.rpg) {
    const rpgIssues = validateRuntimeAdventureRpg(bundle.rpg);
    if (rpgIssues.length > 0) throw new RuntimeAdventureRpgValidationError(rpgIssues);
  }
  if (bundle.bitmapFonts) registerBitmapFontsForAssetCollection(bundle.assets, bundle.bitmapFonts);
  return bundle;
};

export * from "./audio-validation.js";
export * from "./font-validation.js";
export * from "./front-end-localisation.js";
export * from "./indexed-asset-validation.js";
export * from "./instance-validation.js";
export * from "./investigation-bindings.js";
export * from "./investigation.js";
export * from "./item-combinations.js";
export * from "./localisation.js";
export * from "./multi-protagonist-bindings.js";
export * from "./multi-protagonist.js";
export * from "./palette-map-validation.js";
export * from "./room-scripts.js";
export * from "./rpg.js";
export * from "./ui-validation.js";
export * from "./validation.js";
