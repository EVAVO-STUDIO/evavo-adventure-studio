import type {
  RuntimeBundle,
  RuntimeInvestigationManifest,
} from "@evavo/adventure-runtime-bundle";

export type RuntimeInvestigationChapterId = RuntimeInvestigationManifest["chapters"][number]["id"];
export type RuntimeInvestigationFactId = RuntimeInvestigationManifest["facts"][number]["id"];
export type RuntimeInvestigationTopicId = RuntimeInvestigationManifest["topics"][number]["id"];
export type RuntimeInvestigationSourceId = RuntimeInvestigationManifest["researchSources"][number]["id"];
export type RuntimeInvestigationObjectiveId = RuntimeInvestigationManifest["chapters"][number]["objectives"][number]["id"];

export interface RuntimeInvestigationDiscovery {
  readonly kind: "research" | "dialogue" | "evidence" | "event";
  readonly sourceId: string;
  readonly chapterId: RuntimeInvestigationChapterId;
}

export interface RuntimeInvestigationState {
  readonly chapterId: RuntimeInvestigationChapterId;
  readonly discoveredFactIds: readonly RuntimeInvestigationFactId[];
  readonly availableTopicIds: readonly RuntimeInvestigationTopicId[];
  readonly usedTopicIds: readonly RuntimeInvestigationTopicId[];
  readonly usedSourceIds: readonly RuntimeInvestigationSourceId[];
  readonly discovery: Readonly<Record<string, readonly RuntimeInvestigationDiscovery[]>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly score: number;
  readonly awardedObjectiveIds: readonly RuntimeInvestigationObjectiveId[];
}

export interface RuntimeInvestigationChapterReadiness {
  readonly chapterId: RuntimeInvestigationChapterId;
  readonly ready: boolean;
  readonly completedRequiredObjectiveIds: readonly RuntimeInvestigationObjectiveId[];
  readonly missingRequiredObjectiveIds: readonly RuntimeInvestigationObjectiveId[];
  readonly completedOptionalObjectiveIds: readonly RuntimeInvestigationObjectiveId[];
}

const unique = <T extends string>(values: readonly T[]): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const manifestFor = (bundle: RuntimeBundle): RuntimeInvestigationManifest => {
  if (!bundle.investigation) throw new Error(`Runtime bundle '${bundle.projectId}' has no investigation manifest.`);
  return bundle.investigation;
};

const hasAll = (actual: readonly string[], required: readonly string[] | undefined): boolean =>
  (required ?? []).every((id) => actual.includes(id));

const unlockedByFact = (
  manifest: RuntimeInvestigationManifest,
  state: RuntimeInvestigationState,
  topicId: RuntimeInvestigationTopicId,
): boolean => manifest.facts.some(
  (fact) => state.discoveredFactIds.includes(fact.id) && (fact.unlockTopicIds ?? []).includes(topicId),
);

const topicAvailable = (
  manifest: RuntimeInvestigationManifest,
  state: RuntimeInvestigationState,
  topic: RuntimeInvestigationManifest["topics"][number],
): boolean => {
  if (topic.initiallyAvailable) return true;
  if (state.availableTopicIds.includes(topic.id)) return true;
  if (unlockedByFact(manifest, state, topic.id)) return true;
  const required = topic.requiresFactIds ?? [];
  return required.length > 0 && hasAll(state.discoveredFactIds, required);
};

const recomputeTopics = (
  manifest: RuntimeInvestigationManifest,
  state: RuntimeInvestigationState,
): readonly RuntimeInvestigationTopicId[] => unique([
  ...state.availableTopicIds,
  ...manifest.topics.filter((topic) => topicAvailable(manifest, state, topic)).map((topic) => topic.id),
]);

export const createRuntimeInvestigationState = (
  bundle: RuntimeBundle,
): RuntimeInvestigationState | null => {
  if (!bundle.investigation) return null;
  const chapters = [...bundle.investigation.chapters].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
  const chapterId = chapters[0]?.id;
  if (!chapterId) throw new Error("Investigation manifest contains no chapter.");
  const state: RuntimeInvestigationState = {
    chapterId,
    discoveredFactIds: [],
    availableTopicIds: [],
    usedTopicIds: [],
    usedSourceIds: [],
    discovery: {},
    flags: {},
    score: 0,
    awardedObjectiveIds: [],
  };
  return { ...state, availableTopicIds: recomputeTopics(bundle.investigation, state) };
};

export const discoverRuntimeInvestigationFacts = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
  factIds: readonly RuntimeInvestigationFactId[],
  discovery: RuntimeInvestigationDiscovery,
): RuntimeInvestigationState => {
  const manifest = manifestFor(bundle);
  const known = new Set(manifest.facts.map((fact) => fact.id));
  for (const factId of factIds) {
    if (!known.has(factId)) throw new Error(`Unknown runtime investigation fact '${factId}'.`);
  }
  const provenance = { ...state.discovery } as Record<string, readonly RuntimeInvestigationDiscovery[]>;
  for (const factId of factIds) {
    const existing = provenance[factId] ?? [];
    const key = `${discovery.kind}:${discovery.sourceId}:${discovery.chapterId}`;
    if (!existing.some((entry) => `${entry.kind}:${entry.sourceId}:${entry.chapterId}` === key)) {
      provenance[factId] = [...existing, discovery];
    }
  }
  const next = {
    ...state,
    discoveredFactIds: unique([...state.discoveredFactIds, ...factIds]),
    discovery: provenance,
  };
  return { ...next, availableTopicIds: recomputeTopics(manifest, next) };
};

export const useRuntimeInvestigationResearchSource = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
  sourceId: RuntimeInvestigationSourceId,
): RuntimeInvestigationState => {
  const manifest = manifestFor(bundle);
  const source = manifest.researchSources.find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error(`Unknown runtime investigation research source '${sourceId}'.`);
  if (!source.availableChapterIds.includes(state.chapterId)) return state;
  if (!hasAll(state.discoveredFactIds, source.requiresFactIds)) return state;
  if (source.oneShot && state.usedSourceIds.includes(source.id)) return state;
  let next = discoverRuntimeInvestigationFacts(bundle, state, source.revealFactIds ?? [], {
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

export const useRuntimeInvestigationTopic = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
  topicId: RuntimeInvestigationTopicId,
  speakerId: string,
): RuntimeInvestigationState => {
  const manifest = manifestFor(bundle);
  const topic = manifest.topics.find((candidate) => candidate.id === topicId);
  if (!topic) throw new Error(`Unknown runtime investigation topic '${topicId}'.`);
  if (!state.availableTopicIds.includes(topicId)) return state;
  if (topic.oneShot && state.usedTopicIds.includes(topicId)) return state;
  let next = discoverRuntimeInvestigationFacts(bundle, state, topic.revealFactIds ?? [], {
    kind: "dialogue",
    sourceId: speakerId,
    chapterId: state.chapterId,
  });
  next = { ...next, usedTopicIds: unique([...next.usedTopicIds, topic.id]) };
  return next;
};

const objectiveSatisfied = (
  state: RuntimeInvestigationState,
  objective: RuntimeInvestigationManifest["chapters"][number]["objectives"][number],
): boolean => objective.requirements.every((requirement) => {
  switch (requirement.kind) {
    case "fact": return state.discoveredFactIds.includes(requirement.factId);
    case "topic-used": return state.usedTopicIds.includes(requirement.topicId);
    case "source-used": return state.usedSourceIds.includes(requirement.sourceId);
    case "flag": return (state.flags[requirement.flag] ?? false) === requirement.equals;
  }
});

export const evaluateRuntimeInvestigationChapter = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
): RuntimeInvestigationChapterReadiness => {
  const manifest = manifestFor(bundle);
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) throw new Error(`Unknown runtime investigation chapter '${state.chapterId}'.`);
  const complete = chapter.objectives.filter((objective) => objectiveSatisfied(state, objective));
  const completeIds = new Set(complete.map((objective) => objective.id));
  return {
    chapterId: chapter.id,
    ready: chapter.objectives.filter((objective) => objective.required).every((objective) => completeIds.has(objective.id)),
    completedRequiredObjectiveIds: complete.filter((objective) => objective.required).map((objective) => objective.id),
    missingRequiredObjectiveIds: chapter.objectives.filter((objective) => objective.required && !completeIds.has(objective.id)).map((objective) => objective.id),
    completedOptionalObjectiveIds: complete.filter((objective) => !objective.required).map((objective) => objective.id),
  };
};

export const awardRuntimeInvestigationObjectives = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
): RuntimeInvestigationState => {
  const manifest = manifestFor(bundle);
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) return state;
  const newlyCompleted = chapter.objectives.filter(
    (objective) => objectiveSatisfied(state, objective) && !state.awardedObjectiveIds.includes(objective.id),
  );
  if (newlyCompleted.length === 0) return state;
  return {
    ...state,
    score: state.score + newlyCompleted.reduce((sum, objective) => sum + (objective.score ?? 0), 0),
    awardedObjectiveIds: unique([
      ...state.awardedObjectiveIds,
      ...newlyCompleted.map((objective) => objective.id),
    ]),
  };
};

export const setRuntimeInvestigationFlag = (
  state: RuntimeInvestigationState,
  flag: string,
  value: boolean,
): RuntimeInvestigationState => ({ ...state, flags: { ...state.flags, [flag]: value } });

export const advanceRuntimeInvestigationChapter = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
): RuntimeInvestigationState => {
  const manifest = manifestFor(bundle);
  const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
  if (!chapter) throw new Error(`Unknown runtime investigation chapter '${state.chapterId}'.`);
  if (!evaluateRuntimeInvestigationChapter(bundle, state).ready || !chapter.nextChapterId) return state;
  const next = { ...state, chapterId: chapter.nextChapterId };
  return { ...next, availableTopicIds: recomputeTopics(manifest, next) };
};

export const runtimeInvestigationPresence = (
  bundle: RuntimeBundle,
  state: RuntimeInvestigationState,
) => (manifestFor(bundle).presenceVariants ?? [])
  .filter((variant) => variant.chapterIds.includes(state.chapterId))
  .sort((left, right) => left.id.localeCompare(right.id));
