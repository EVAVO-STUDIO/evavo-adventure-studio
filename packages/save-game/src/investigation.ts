import type { RuntimeInvestigationState } from "@evavo/adventure-scene-runtime/investigation-runtime";
import { z } from "zod";

const chapterIdSchema = z.string().regex(/^chapter\.[A-Za-z0-9._-]+$/u);
const factIdSchema = z.string().regex(/^fact\.[A-Za-z0-9._-]+$/u);
const topicIdSchema = z.string().regex(/^topic\.[A-Za-z0-9._-]+$/u);
const sourceIdSchema = z.string().regex(/^source\.[A-Za-z0-9._-]+$/u);
const objectiveIdSchema = z.string().regex(/^objective\.[A-Za-z0-9._-]+$/u);

const discoverySchema = z
  .object({
    kind: z.enum(["research", "dialogue", "evidence", "event"]),
    sourceId: z.string().min(1),
    chapterId: chapterIdSchema,
  })
  .strict();

export const saveGameInvestigationStateSchema = z
  .object({
    chapterId: chapterIdSchema,
    discoveredFactIds: z.array(factIdSchema),
    availableTopicIds: z.array(topicIdSchema),
    usedTopicIds: z.array(topicIdSchema),
    usedSourceIds: z.array(sourceIdSchema),
    discovery: z.record(z.string().min(1), z.array(discoverySchema)),
    flags: z.record(z.string().min(1), z.boolean()),
    score: z.number().int(),
    awardedObjectiveIds: z.array(objectiveIdSchema),
  })
  .strict() as z.ZodType<RuntimeInvestigationState>;

export const parseSaveGameInvestigationState = (input: unknown): RuntimeInvestigationState =>
  saveGameInvestigationStateSchema.parse(input);
