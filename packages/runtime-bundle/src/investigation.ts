import { idSchema } from "@evavo/adventure-project-schema";
import { z } from "zod";

const investigationFactIdSchema = z.string().regex(/^fact\.[A-Za-z0-9._-]+$/u);
const investigationTopicIdSchema = z.string().regex(/^topic\.[A-Za-z0-9._-]+$/u);
const investigationSourceIdSchema = z.string().regex(/^source\.[A-Za-z0-9._-]+$/u);
const investigationChapterIdSchema = z.string().regex(/^chapter\.[A-Za-z0-9._-]+$/u);
const investigationObjectiveIdSchema = z.string().regex(/^objective\.[A-Za-z0-9._-]+$/u);

export const runtimeInvestigationFactSchema = z
  .object({
    id: investigationFactIdSchema,
    label: z.string().min(1),
    description: z.string(),
    unlockTopicIds: z.array(investigationTopicIdSchema).optional(),
  })
  .strict();

export const runtimeInvestigationTopicSchema = z
  .object({
    id: investigationTopicIdSchema,
    label: z.string().min(1),
    initiallyAvailable: z.boolean().optional(),
    requiresFactIds: z.array(investigationFactIdSchema).optional(),
    revealFactIds: z.array(investigationFactIdSchema).optional(),
    oneShot: z.boolean().optional(),
  })
  .strict();

export const runtimeInvestigationResearchSourceSchema = z
  .object({
    id: investigationSourceIdSchema,
    label: z.string().min(1),
    availableChapterIds: z.array(investigationChapterIdSchema).min(1),
    requiresFactIds: z.array(investigationFactIdSchema).optional(),
    revealFactIds: z.array(investigationFactIdSchema).optional(),
    revealTopicIds: z.array(investigationTopicIdSchema).optional(),
    oneShot: z.boolean().optional(),
  })
  .strict();

export const runtimeInvestigationObjectiveRequirementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fact"), factId: investigationFactIdSchema }).strict(),
  z.object({ kind: z.literal("topic-used"), topicId: investigationTopicIdSchema }).strict(),
  z.object({ kind: z.literal("source-used"), sourceId: investigationSourceIdSchema }).strict(),
  z.object({ kind: z.literal("flag"), flag: z.string().min(1), equals: z.boolean() }).strict(),
]);

export const runtimeInvestigationObjectiveSchema = z
  .object({
    id: investigationObjectiveIdSchema,
    label: z.string().min(1),
    required: z.boolean(),
    score: z.number().int().optional(),
    requirements: z.array(runtimeInvestigationObjectiveRequirementSchema),
  })
  .strict();

export const runtimeInvestigationChapterSchema = z
  .object({
    id: investigationChapterIdSchema,
    label: z.string().min(1),
    order: z.number().int().nonnegative(),
    objectives: z.array(runtimeInvestigationObjectiveSchema),
    nextChapterId: investigationChapterIdSchema.optional(),
  })
  .strict();

export const runtimeInvestigationPresenceVariantSchema = z
  .object({
    id: z.string().min(1),
    chapterIds: z.array(investigationChapterIdSchema).min(1),
    locationId: z.string().min(1),
    present: z.boolean(),
    state: z.string().min(1).optional(),
  })
  .strict();

export const runtimeInvestigationManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    facts: z.array(runtimeInvestigationFactSchema),
    topics: z.array(runtimeInvestigationTopicSchema),
    researchSources: z.array(runtimeInvestigationResearchSourceSchema),
    chapters: z.array(runtimeInvestigationChapterSchema).min(1),
    presenceVariants: z.array(runtimeInvestigationPresenceVariantSchema).optional(),
  })
  .strict();

export type RuntimeInvestigationManifest = z.infer<typeof runtimeInvestigationManifestSchema>;

export type RuntimeInvestigationIssueCode =
  | "duplicate-id"
  | "unknown-fact"
  | "unknown-topic"
  | "unknown-source"
  | "unknown-chapter"
  | "duplicate-chapter-order";

export interface RuntimeInvestigationIssue {
  readonly severity: "error";
  readonly code: RuntimeInvestigationIssueCode;
  readonly path: string;
  readonly message: string;
}

const duplicateIssues = (
  label: string,
  path: string,
  items: readonly { readonly id: string }[],
): RuntimeInvestigationIssue[] => {
  const seen = new Set<string>();
  const issues: RuntimeInvestigationIssue[] = [];
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-id",
        path: `${path}[${index}].id`,
        message: `${label} '${item.id}' is duplicated.`,
      });
    }
    seen.add(item.id);
  });
  return issues;
};

export const validateRuntimeInvestigation = (
  manifest: RuntimeInvestigationManifest,
): readonly RuntimeInvestigationIssue[] => {
  const issues: RuntimeInvestigationIssue[] = [
    ...duplicateIssues("Fact", "facts", manifest.facts),
    ...duplicateIssues("Topic", "topics", manifest.topics),
    ...duplicateIssues("Research source", "researchSources", manifest.researchSources),
    ...duplicateIssues("Chapter", "chapters", manifest.chapters),
  ];
  const facts = new Set(manifest.facts.map((item) => item.id));
  const topics = new Set(manifest.topics.map((item) => item.id));
  const sources = new Set(manifest.researchSources.map((item) => item.id));
  const chapters = new Set(manifest.chapters.map((item) => item.id));
  const addUnknown = (
    code: RuntimeInvestigationIssueCode,
    path: string,
    kind: string,
    id: string,
  ) => {
    issues.push({ severity: "error", code, path, message: `Unknown investigation ${kind} '${id}'.` });
  };

  manifest.facts.forEach((fact, factIndex) => {
    (fact.unlockTopicIds ?? []).forEach((topicId, index) => {
      if (!topics.has(topicId)) addUnknown("unknown-topic", `facts[${factIndex}].unlockTopicIds[${index}]`, "topic", topicId);
    });
  });
  manifest.topics.forEach((topic, topicIndex) => {
    [...(topic.requiresFactIds ?? []), ...(topic.revealFactIds ?? [])].forEach((factId, index) => {
      if (!facts.has(factId)) addUnknown("unknown-fact", `topics[${topicIndex}].factIds[${index}]`, "fact", factId);
    });
  });
  manifest.researchSources.forEach((source, sourceIndex) => {
    source.availableChapterIds.forEach((chapterId, index) => {
      if (!chapters.has(chapterId)) addUnknown("unknown-chapter", `researchSources[${sourceIndex}].availableChapterIds[${index}]`, "chapter", chapterId);
    });
    [...(source.requiresFactIds ?? []), ...(source.revealFactIds ?? [])].forEach((factId, index) => {
      if (!facts.has(factId)) addUnknown("unknown-fact", `researchSources[${sourceIndex}].factIds[${index}]`, "fact", factId);
    });
    (source.revealTopicIds ?? []).forEach((topicId, index) => {
      if (!topics.has(topicId)) addUnknown("unknown-topic", `researchSources[${sourceIndex}].revealTopicIds[${index}]`, "topic", topicId);
    });
  });
  const orderToChapter = new Map<number, string>();
  manifest.chapters.forEach((chapter, chapterIndex) => {
    const previous = orderToChapter.get(chapter.order);
    if (previous) {
      issues.push({
        severity: "error",
        code: "duplicate-chapter-order",
        path: `chapters[${chapterIndex}].order`,
        message: `Chapter order ${chapter.order} is shared by '${previous}' and '${chapter.id}'.`,
      });
    } else orderToChapter.set(chapter.order, chapter.id);
    if (chapter.nextChapterId && !chapters.has(chapter.nextChapterId)) {
      addUnknown("unknown-chapter", `chapters[${chapterIndex}].nextChapterId`, "chapter", chapter.nextChapterId);
    }
    chapter.objectives.forEach((objective, objectiveIndex) => {
      objective.requirements.forEach((requirement, requirementIndex) => {
        const path = `chapters[${chapterIndex}].objectives[${objectiveIndex}].requirements[${requirementIndex}]`;
        if (requirement.kind === "fact" && !facts.has(requirement.factId)) addUnknown("unknown-fact", path, "fact", requirement.factId);
        if (requirement.kind === "topic-used" && !topics.has(requirement.topicId)) addUnknown("unknown-topic", path, "topic", requirement.topicId);
        if (requirement.kind === "source-used" && !sources.has(requirement.sourceId)) addUnknown("unknown-source", path, "source", requirement.sourceId);
      });
    });
  });
  (manifest.presenceVariants ?? []).forEach((variant, variantIndex) => {
    variant.chapterIds.forEach((chapterId, index) => {
      if (!chapters.has(chapterId)) addUnknown("unknown-chapter", `presenceVariants[${variantIndex}].chapterIds[${index}]`, "chapter", chapterId);
    });
  });

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export class RuntimeInvestigationValidationError extends Error {
  readonly issues: readonly RuntimeInvestigationIssue[];
  constructor(issues: readonly RuntimeInvestigationIssue[]) {
    super(`Runtime investigation manifest has ${issues.length} semantic error(s).`);
    this.name = "RuntimeInvestigationValidationError";
    this.issues = issues;
  }
}
