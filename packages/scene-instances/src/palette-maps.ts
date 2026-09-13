import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

export const paletteMapRecordSchema = z
  .object({
    id: z.string().min(1),
    paletteAssetId: idSchema("asset"),
    paletteOffset: z.number().int().min(0).max(255).default(0),
    description: z.string().min(1).optional(),
  })
  .strict();
export type PaletteMapRecord = z.infer<typeof paletteMapRecordSchema>;

export const paletteMapManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    maps: z.array(paletteMapRecordSchema).default([]),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    for (let index = 0; index < manifest.maps.length; index += 1) {
      const map = manifest.maps[index];
      if (!map) continue;
      if (ids.has(map.id)) {
        context.addIssue({
          code: "custom",
          path: ["maps", index, "id"],
          message: `Palette map '${map.id}' is duplicated.`,
        });
      }
      ids.add(map.id);
    }
  });
export type PaletteMapManifest = z.infer<typeof paletteMapManifestSchema>;

export const parsePaletteMapManifest = (input: unknown): PaletteMapManifest =>
  paletteMapManifestSchema.parse(input);

export const paletteMapById = (
  manifest: PaletteMapManifest | null | undefined,
  id: string,
): PaletteMapRecord | null => manifest?.maps.find((map) => map.id === id) ?? null;
