import { audioMixManifestSchema } from "@evavo/adventure-audio";
import { sha256Schema } from "@evavo/adventure-asset-contract";
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
import { sceneInstanceManifestSchema } from "@evavo/adventure-scene-instances";
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
  RuntimeSceneInstanceValidationError,
  validateRuntimeSceneInstances,
} from "./instance-validation.js";
import { runtimeLocalisationPackSchema } from "./localisation.js";
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
    inventoryItems: z.array(inventoryItemSchema),
    actors: z.array(actorSchema),
    scenes: z.array(compiledSceneSchema).min(1),
    dialogues: z.array(compiledDialogueSchema),
    sequences: z.array(compiledSequenceSchema),
    sceneInstances: sceneInstanceManifestSchema.optional(),
    bitmapFonts: bitmapFontManifestSchema.optional(),
    uiSkins: uiSkinManifestSchema.optional(),
    audioMix: audioMixManifestSchema.optional(),
    localisation: runtimeLocalisationPackSchema.optional(),
  })
  .strict();
export type RuntimeBundle = z.infer<typeof runtimeBundleSchema>;

export const parseRuntimeBundle = (input: unknown): RuntimeBundle => {
  const bundle = runtimeBundleSchema.parse(input);
  const issues = validateRuntimeBundleSemantics(bundle);
  if (issues.length > 0) throw new RuntimeBundleValidationError(issues);
  const sceneInstanceIssues = validateRuntimeSceneInstances(bundle);
  if (sceneInstanceIssues.length > 0) {
    throw new RuntimeSceneInstanceValidationError(sceneInstanceIssues);
  }
  const bitmapFontIssues = validateRuntimeBitmapFonts(bundle);
  if (bitmapFontIssues.length > 0) {
    throw new RuntimeBitmapFontValidationError(bitmapFontIssues);
  }
  const uiSkinIssues = validateRuntimeUiSkins(bundle).filter((issue) => issue.severity === "error");
  if (uiSkinIssues.length > 0) throw new RuntimeUiSkinValidationError(uiSkinIssues);
  const audioIssues = validateRuntimeAudioMix(bundle).filter((issue) => issue.severity === "error");
  if (audioIssues.length > 0) throw new RuntimeAudioMixValidationError(audioIssues);
  if (bundle.bitmapFonts) registerBitmapFontsForAssetCollection(bundle.assets, bundle.bitmapFonts);
  return bundle;
};

export * from "./audio-validation.js";
export * from "./font-validation.js";
export * from "./instance-validation.js";
export * from "./localisation.js";
export * from "./ui-validation.js";
export * from "./validation.js";
