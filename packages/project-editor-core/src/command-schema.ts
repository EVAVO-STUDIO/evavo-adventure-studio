import {
  depthBandSchema,
  entranceSchema,
  hotspotSchema,
  idSchema,
  navigationAreaSchema,
  presentationProfileSchema,
  sceneSchema,
} from "@evavo/adventure-project-schema";
import { z } from "zod";
import type { ProjectEditorCommand } from "./index.js";

export const projectEditorCommandSchema: z.ZodType<ProjectEditorCommand> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("batch"),
          commands: z.array(projectEditorCommandSchema).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-presentation"),
          presentation: presentationProfileSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-scene"),
          index: z.number().int().nonnegative(),
          scene: sceneSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-scene"),
          sceneId: idSchema("scene"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-scene"),
          sceneId: idSchema("scene"),
          scene: sceneSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-navigation-area"),
          sceneId: idSchema("scene"),
          index: z.number().int().nonnegative(),
          area: navigationAreaSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-navigation-area"),
          sceneId: idSchema("scene"),
          areaId: idSchema("navigation-area"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-navigation-area"),
          sceneId: idSchema("scene"),
          areaId: idSchema("navigation-area"),
          area: navigationAreaSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-depth-band"),
          sceneId: idSchema("scene"),
          index: z.number().int().nonnegative(),
          band: depthBandSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-depth-band"),
          sceneId: idSchema("scene"),
          bandId: idSchema("depth-band"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-depth-band"),
          sceneId: idSchema("scene"),
          bandId: idSchema("depth-band"),
          band: depthBandSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-hotspot"),
          sceneId: idSchema("scene"),
          index: z.number().int().nonnegative(),
          hotspot: hotspotSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-hotspot"),
          sceneId: idSchema("scene"),
          hotspotId: idSchema("hotspot"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-hotspot"),
          sceneId: idSchema("scene"),
          hotspotId: idSchema("hotspot"),
          hotspot: hotspotSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("insert-entrance"),
          sceneId: idSchema("scene"),
          index: z.number().int().nonnegative(),
          entrance: entranceSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("remove-entrance"),
          sceneId: idSchema("scene"),
          entranceId: idSchema("entrance"),
        })
        .strict(),
      z
        .object({
          kind: z.literal("replace-entrance"),
          sceneId: idSchema("scene"),
          entranceId: idSchema("entrance"),
          entrance: entranceSchema,
        })
        .strict(),
    ]) as z.ZodType<ProjectEditorCommand>,
);

export const parseProjectEditorCommand = (input: unknown): ProjectEditorCommand =>
  projectEditorCommandSchema.parse(input);
