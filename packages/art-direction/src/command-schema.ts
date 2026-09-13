import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";
import { type ArtDirectionEditorCommand, artAssetRuleSchema, artDirectionProfileSchema } from "./index.js";

export const artDirectionEditorCommandSchema: z.ZodType<ArtDirectionEditorCommand> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("batch"),
        commands: z.array(artDirectionEditorCommandSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-profile"),
        profile: artDirectionProfileSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("replace-asset-rule"),
        assetId: idSchema("asset"),
        rule: artAssetRuleSchema,
      })
      .strict(),
  ]),
);

export const parseArtDirectionEditorCommand = (input: unknown): ArtDirectionEditorCommand =>
  artDirectionEditorCommandSchema.parse(input);
