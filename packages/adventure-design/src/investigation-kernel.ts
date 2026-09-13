export type InvestigationFactId = `fact.${string}`;
export type InvestigationTopicId = `topic.${string}`;
export type InvestigationSourceId = `source.${string}`;
export type InvestigationChapterId = `chapter.${string}`;
export type InvestigationObjectiveId = `objective.${string}`;

export type InvestigationDiscoveryKind = "research" | "dialogue" | "evidence" | "event";

export interface InvestigationDiscoveryRecord {
  readonly kind: InvestigationDiscoveryKind;
  readonly sourceId: string;
  readonly chapterId: InvestigationChapterId;
}

export interface InvestigationFactDefinition {
  readonly id: InvestigationFactId;
  readonly label: string;
  readonly description: string;
  readonly unlockTopicIds?: readonly InvestigationTopicId[];
}

export interface InvestigationTopicDefinition {
  readonly id: InvestigationTopicId;
  readonly label: string;
  readonly initiallyAvailable?: boolean;
  readonly requiresFactIds?: readonly InvestigationFactId[];
  readonly revealFactIds?: readonly InvestigationFactId[];
  readonly oneShot?: boolean;
}

export interface InvestigationResearchSourceDefinition {
  readonly id: InvestigationSourceId;
  readonly label: string;
  readonly availableChapterIds: readonly InvestigationChapterId[];
  readonly requiresFactIds?: readonly InvestigationFactId[];
  readonly revealFactIds?: readonly InvestigationFactId[];
  readonly revealTopicIds?: readonly InvestigationTopicId[];
  readonly oneShot?: boolean;
}

export type InvestigationObjectiveRequirement =
  | { readonly kind: "fact"; readonly factId: InvestigationFactId }
  | { readonly kind: "topic-used"; readonly topicId: InvestigationTopicId }
  | { readonly kind: "source-used"; readonly sourceId: InvestigationSourceId }
  | { readonly kind: "flag"; readonly flag: string; readonly equals: boolean };

export interface InvestigationObjectiveDefinition {
  readonly id: InvestigationObjectiveId;
  readonly label: string;
  readonly required: boolean;
  readonly score?: number;
  readonly requirements: readonly InvestigationObjectiveRequirement[];
}

export interface InvestigationChapterDefinition {
  readonly id: InvestigationChapterId;
  readonly label: string;
  readonly order: number;
  readonly objectives: readonly InvestigationObjectiveDefinition[];
  readonly nextChapterId?: InvestigationChapterId;
}

export interface InvestigationPresenceVariant {
  readonly id: string;
  readonly chapterIds: readonly InvestigationChapterId[];
  readonly locationId: string;
  readonly present: boolean;
  readonly state?: string;
}

export interface InvestigationManifest {
  readonly manifestVersion: 1;
  readonly facts: readonly InvestigationFactDefinition[];
  readonly topics: readonly InvestigationTopicDefinition[];
  readonly researchSources: readonly InvestigationResearchSourceDefinition[];
  readonly chapters: readonly InvestigationChapterDefinition[];
  readonly presenceVariants?: readonly InvestigationPresenceVariant[];
}

export interface InvestigationRuntimeState {
  readonly chapterId: InvestigationChapterId;
  readonly discoveredFactIds: readonly InvestigationFactId[];
  readonly availableTopicIds: readonly InvestigationTopicId[];
  readonly usedTopicIds: readonly InvestigationTopicId[];
  readonly usedSourceIds: readonly InvestigationSourceId[];
  readonly discovery: Readonly<Record<string, readonly InvestigationDiscoveryRecord[]>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly score: number;
  readonly awardedObjectiveIds: readonly InvestigationObjectiveId[];
}

export interface InvestigationChapterReadiness {
  readonly chapterId: InvestigationChapterId;
  readonly ready: boolean;
  readonly completedRequiredObjectiveIds: readonly InvestigationObjectiveId[];
  readonly missingRequiredObjectiveIds: readonly InvestigationObjectiveId[];
  readonly completedOptionalObjectiveIds: readonly InvestigationObjectiveId[];
}

const unique = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const records = <T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> =>
  new Map(items.map((item) => [item.id, item] as const));

const hasAll = (actual: readonly string[], required: readonly string[] | undefined): boolean =>
  (required ?? []).every((id) => actual.includes(id));

export const validateInvestigationManifest = (manifest: InvestigationManifest): readonly string[] => {
  const issues: string[] = [];
  const facts = records(manifest.facts);
  const topics = records(manifest.topics);
  const sources = records(manifest.researchSources);
  const chapters = records(manifest.chapters);
  const ensureUnique = (label: string, items: readonly { readonly id: string }[]) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) issues.push(`${label} contains duplicate IDs.`);
  };
  ensureUnique("Facts", manifest.facts);
  ensureUnique("Topics", manifest.topics);
  ensureUnique("Research sources", manifest.researchSources);
  ensureUnique("Chapters", manifest.chapters);

  for (const fact of manifest.facts) {
    for (const topicId of fact.unlockTopicIds ?? []) {
      if (!topics.has(topicId)) issues.push(`Fact '${fact.id}' unlocks missing topic '${topicId}'.`);
    }
  }
  for (const topic of manifest.topics) {
    for (const factId of [...(topic.requiresFactIds ?? []), ...(topic.revealFactIds ?? [])]) {
      if (!facts.has(factId)) issues.push(`Topic '${topic.id}' references missing fact '${factId}'.`);
    }
  }
  for (const source of manifest.researchSources) {
    for (const chapterId of source.availableChapterIds) {
      if (!chapters.has(chapterId)) issues.push(`Research source '${source.id}' references missing chapter '${chapterId}'.`);
    }
    for (const factId of [...(source.requiresFactIds ?? []), ...(source.revealFactIds ?? [])]) {
      if (!facts.has(factId)) issues.push(`Research source '${source.id}' references missing fact '${factId}'.`);
    }
    for (const topicId of source.revealTopicIds ?? []) {
      if (!topics.has(topicId)) issues.push(`Research source '${source.id}' reveals missing topic '${topicId}'.`);
    }
  }
  for (const chapter of manifest.chapters) {
    if (chapter.nextChapterId && !chapters.has(chapter.nextChapterId)) {
      issues.push(`Chapter '${chapter.id}' references missing next chapter '${chapter.nextChapterId}'.`);
    }
    ensureUnique(`Chapter '${chapter.id}' objectives`, chapter.objectives);
    for (const objective of chapter.objectives) {
      for (const requirement of objective.requirements) {
        if (requirement.kind === "fact" && !facts.has(requirement.factId)) {
          issues.push(`Objective '${objective.id}' references missing fact '${requirement.factId}'.`);
        }
        if (requirement.kind === "topic-used" && !topics.has(requirement.topicId)) {
          issues.push(`Objective '${objective.id}' references missing topic '${requirement.topicId}'.`);
        }
        if (requirement.kind === "source-used" && !sources.has(requirement.sourceId)) {
          issues.push(`Objective '${objective.id}' references missing source '${requirement.sourceId}'.`);
        }
      }
    }
  }
  const ordered = [...manifest.chapters].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1]?.order === ordered[index]?.order) issues.push(`Chapter order ${ordered[index]?.order} is duplicated.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};

const unlockedByFact = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
  topicId: InvestigationTopicId,
): boolean => manifest.facts.some(
  (fact) => state.discoveredFactIds.includes(fact.id) && (fact.unlockTopicIds ?? []).includes(topicId),
);

const topicAvailable = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
  topic: InvestigationTopicDefinition,
): boolean => {
  if (topic.initiallyAvailable) return true;
  if (state.availableTopicIds.includes(topic.id)) return true;
  if (unlockedByFact(manifest, state, topic.id)) return true;
  const required = topic.requiresFactIds ?? [];
  return required.length > 0 && hasAll(state.discoveredFactIds, required);
};

const recomputeAvailableTopics = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
): readonly InvestigationTopicId[] =>
  unique([
    ...state.availableTopicIds,
    ...manifest.topics
      .filter((topic) => topicAvailable(manifest, state, topic))
      .map((topic) => topic.id),
  ]);

export const createInvestigationState = (
  manifest: InvestigationManifest,
  chapterId?: InvestigationChapterId,
): InvestigationRuntimeState => {
  const issues = validateInvestigationManifest(manifest);
  if (issues.length > 0) throw new Error(`Invalid investigation manifest: ${issues.join(" ")}`);
  const first = [...manifest.chapters].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))[0];
  const selected = chapterId ?? first?.id;
  if (!selected || !manifest.chapters.some((chapter) => chapter.id === selected)) {
    throw new Error(`Investigation chapter '${selected ?? "missing"}' does not exist.`);
  }
  const state: InvestigationRuntimeState = {
    chapterId: selected,
    discoveredFactIds: [],
    availableTopicIds: [],
    usedTopicIds: [],
    usedSourceIds: [],
    discovery: {},
    flags: {},
    score: 0,
    awardedObjectiveIds: [],
  };
  return { ...state, availableTopicIds: recomputeAvailableTopics(manifest, state) };
};

export const discoverInvestigationFacts = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
  factIds: readonly InvestigationFactId[],
  discovery: InvestigationDiscoveryRecord,
): InvestigationRuntimeState => {
  const knownFacts = records(manifest.facts);
  for (const factId of factIds) {
    if (!knownFacts.has(factId)) throw new Error(`Unknown investigation fact '${factId}'.`);
  }
  const discoveredFactIds = unique([...state.discoveredFactIds, ...factIds]);
  const provenance = { ...state.discovery } as Record<string, readonly InvestigationDiscoveryRecord[]>;
  for (const factId of factIds) {
    const existing = provenance[factId] ?? [];
    const key = `${discovery.kind}:${discovery.sourceId}:${discovery.chapterId}`;
    if (!existing.some((entry) => `${entry.kind}:${entry.sourceId}:${entry.chapterId}` === key)) {
      provenance[factId] = [...existing, discovery];
    }
  }
  const next = { ...state, discoveredFactIds, discovery: provenance };
  return { ...next, availableTopicIds: recomputeAvailableTopics(manifest, next) };
};

export const useInvestigationResearchSource = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
  sourceId: InvestigationSourceId,
): InvestigationRuntimeState => {
  const source = manifest.researchSources.find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error(`Unknown investigation research source '${sourceId}'.`);
  if (!source.availableChapterIds.includes(state.chapterId)) return state;
  if (!hasAll(state.discoveredFactIds, source.requiresFactIds)) return state;
  if (source.oneShot && state.usedSourceIds.includes(source.id)) return state;
  let next = discoverInvestigationFacts(manifest, state, source.revealFactIds ?? [], {
    kind: "research",
    sourceId: source.id,
    chapterId: state.chapterId,
  });
  next = {
    ...next,
    usedSourceIds: unique([...next.usedSourceIds, source.id]),
    availableTopicIds: unique([...next.availableTopicIds, ...(source.revealTopicIds ?? [])]),
  };
  return next;
};

export const useInvestigationTopic = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
  topicId: InvestigationTopicId,
  speakerId: string,
): InvestigationRuntimeState => {
  const topic = manifest.topics.find((candidate) => candidate.id === topicId);
  if (!topic) throw new Error(`Unknown investigation topic '${topicId}'.`);
  if (!state.availableTopicIds.includes(topicId)) return state;
  if (topic.oneShot && state.usedTopicIds.includes(topicId)) return state;
  let next = discoverInvestigationFacts(manifest, state, topic.revealFactIds ?? [], {
    kind: "dialogue",
    sourceId: speakerId,
    chapterId: state.chapterId,
  });
  next = { ...next, usedTopicIds: unique([...next.usedTopicIds, topicId]) };
  return next;
};

const objectiveSatisfied = (
  state: InvestigationRuntimeState,
  objective: InvestigationObjectiveDefinition,
): boolean => objective.requirements.every((requirement) => {
  switch (requirement.kind) {
    case "fact": return state.discoveredFactIds.includes(requirement.factId);
    case "topic-used": return state.usedTopicIds.includes(requirement.topicId);
    case "source-used": return state.usedSourceIds.includes(requirement.sourceId);
    case "flag": return (state.flags[requirement.flag] ?? false) === requirement.equals;
  }
});

export const evaluateInvestigationChapter = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
): InvestigationChapterReadiness => {
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) throw new Error(`Unknown current investigation chapter '${state.chapterId}'.`);
  const completed = chapter.objectives.filter((objective) => objectiveSatisfied(state, objective));
  const completedIds = new Set(completed.map((objective) => objective.id));
  return {
    chapterId: chapter.id,
    ready: chapter.objectives.filter((objective) => objective.required).every((objective) => completedIds.has(objective.id)),
    completedRequiredObjectiveIds: completed.filter((objective) => objective.required).map((objective) => objective.id),
    missingRequiredObjectiveIds: chapter.objectives.filter((objective) => objective.required && !completedIds.has(objective.id)).map((objective) => objective.id),
    completedOptionalObjectiveIds: completed.filter((objective) => !objective.required).map((objective) => objective.id),
  };
};

export const awardInvestigationObjectives = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
): InvestigationRuntimeState => {
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) return state;
  const newlyCompleted = chapter.objectives.filter(
    (objective) => objectiveSatisfied(state, objective) && !state.awardedObjectiveIds.includes(objective.id),
  );
  if (newlyCompleted.length === 0) return state;
  return {
    ...state,
    score: state.score + newlyCompleted.reduce((sum, objective) => sum + (objective.score ?? 0), 0),
    awardedObjectiveIds: unique([...state.awardedObjectiveIds, ...newlyCompleted.map((objective) => objective.id)]),
  };
};

export const advanceInvestigationChapter = (
  manifest: InvestigationManifest,
  state: InvestigationRuntimeState,
): InvestigationRuntimeState => {
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) throw new Error(`Unknown current investigation chapter '${state.chapterId}'.`);
  const readiness = evaluateInvestigationChapter(manifest, state);
  if (!readiness.ready || !chapter.nextChapterId) return state;
  const next = { ...state, chapterId: chapter.nextChapterId };
  return { ...next, availableTopicIds: recomputeAvailableTopics(manifest, next) };
};

export const investigationPresenceForChapter = (
  manifest: InvestigationManifest,
  chapterId: InvestigationChapterId,
): readonly InvestigationPresenceVariant[] =>
  (manifest.presenceVariants ?? [])
    .filter((variant) => variant.chapterIds.includes(chapterId))
    .sort((left, right) => left.id.localeCompare(right.id));
