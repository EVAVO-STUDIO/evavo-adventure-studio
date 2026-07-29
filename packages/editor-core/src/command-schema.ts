import { z } from "zod";
import { idSchema } from "@evavo/adventure-project-schema";
import {
  objectDefinitionSchema,
  sceneActorInstanceSchema,
  sceneCompositionSchema,
  sceneNavigationPortalSchema,
  sceneObjectInstanceSchema,
} from "@evavo/adventure-scene-instances";
import type { EditorCommand } from "./index.js";

export const editorCommandSchema: z.ZodType<EditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(editorCommandSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-scene-composition"),
        index: z.number().int().nonnegative(),
        composition: sceneCompositionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-scene-composition"),
        sceneId: idSchema("scene"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-scene-composition"),
        sceneId: idSchema("scene"),
        composition: sceneCompositionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-object-definition"),
        index: z.number().int().nonnegative(),
        definition: objectDefinitionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-object-definition"),
        definitionId: idSchema("object-definition"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-object-definition"),
        definitionId: idSchema("object-definition"),
        definition: objectDefinitionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-actor-instance"),
        sceneId: idSchema("scene"),
        index: z.number().int().nonnegative(),
        instance: sceneActorInstanceSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-actor-instance"),
        sceneId: idSchema("scene"),
        instanceId: idSchema("actor-instance"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-actor-instance"),
        sceneId: idSchema("scene"),
        instanceId: idSchema("actor-instance"),
        instance: sceneActorInstanceSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-object-instance"),
        sceneId: idSchema("scene"),
        index: z.number().int().nonnegative(),
        instance: sceneObjectInstanceSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-object-instance"),
        sceneId: idSchema("scene"),
        instanceId: idSchema("object"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-object-instance"),
        sceneId: idSchema("scene"),
        instanceId: idSchema("object"),
        instance: sceneObjectInstanceSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insert-navigation-portal"),
        sceneId: idSchema("scene"),
        index: z.number().int().nonnegative(),
        portal: sceneNavigationPortalSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-navigation-portal"),
        sceneId: idSchema("scene"),
        portalId: idSchema("navigation-portal"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-navigation-portal"),
        sceneId: idSchema("scene"),
        portalId: idSchema("navigation-portal"),
        portal: sceneNavigationPortalSchema,
      })
      .strict(),
  ]),
);

export const parseEditorCommand = (input: unknown): EditorCommand =>
  editorCommandSchema.parse(input);

export const editorOperationSchema = z
  .object({
    operationId: z.string().min(1),
    command: editorCommandSchema,
  })
  .strict();
export type EditorOperation = z.infer<typeof editorOperationSchema>;

export const editorOperationLogSchema = z
  .object({
    logVersion: z.literal(1),
    projectId: idSchema("project"),
    baseRevision: z.number().int().nonnegative(),
    operations: z.array(editorOperationSchema),
  })
  .strict();
export type EditorOperationLog = z.infer<typeof editorOperationLogSchema>;

export const parseEditorOperationLog = (input: unknown): EditorOperationLog =>
  editorOperationLogSchema.parse(input);
