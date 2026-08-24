import {
  advanceInvestigationChapter,
  awardInvestigationObjectives,
  createInvestigationState,
  evaluateInvestigationChapter,
  useInvestigationResearchSource,
  useInvestigationTopic,
  validateInvestigationManifest,
  type InvestigationChapterId,
  type InvestigationFactId,
  type InvestigationManifest,
  type InvestigationRuntimeState,
  type InvestigationSourceId,
  type InvestigationTopicId,
} from "./investigation-kernel.js";

export type InvestigationAnalysisIssueCode =
  | "manifest-invalid"
  | "chapter-deadlock"
  | "unreachable-fact"
  | "unreachable-topic"
  | "unreachable-source";

export interface InvestigationAnalysisIssue {
  readonly code: InvestigationAnalysisIssueCode;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface InvestigationAnalysisReport {
  readonly ready: boolean;
  readonly reachedChapterIds: readonly InvestigationChapterId[];
  readonly reachedFactIds: readonly InvestigationFactId[];
  readonly reachedTopicIds: readonly InvestigationTopicId[];
  readonly usedSourceIds: readonly InvestigationSourceId[];
  readonly finalState: InvestigationRuntimeState | null;
  readonly issues: readonly InvestigationAnalysisIssue[];
}

const stateKey = (state: InvestigationRuntimeState): string =>
  JSON.stringify({
    chapterId: state.chapterId,
    facts: state.discoveredFactIds,
    topics: state.availableTopicIds,
    usedTopics: state.usedTopicIds,
    sources: state.usedSourceIds,
    score: state.score,
    objectives: state.awardedObjectiveIds,
  });

const exhaustChapter = (
  manifest: InvestigationManifest,
  initial: InvestigationRuntimeState,
): InvestigationRuntimeState => {
  let state = initial;
  for (let iteration = 0; iteration < 128; iteration += 1) {
    const before = stateKey(state);
    for (const source of manifest.researchSources) {
      state = useInvestigationResearchSource(manifest, state, source.id);
    }
    for (const topic of manifest.topics) {
      if (state.availableTopicIds.includes(topic.id)) {
        state = useInvestigationTopic(manifest, state, topic.id, `analysis-speaker:${topic.id}`);
      }
    }
    state = awardInvestigationObjectives(manifest, state);
    if (stateKey(state) === before) return state;
  }
  return state;
};

export const analyzeInvestigationManifest = (
  manifest: InvestigationManifest,
): InvestigationAnalysisReport => {
  const validation = validateInvestigationManifest(manifest);
  if (validation.length > 0) {
    return {
      ready: false,
      reachedChapterIds: [],
      reachedFactIds: [],
      reachedTopicIds: [],
      usedSourceIds: [],
      finalState: null,
      issues: validation.map((message) => ({ code: "manifest-invalid" as const, severity: "error" as const, message })),
    };
  }

  let state = createInvestigationState(manifest);
  const reachedChapters = new Set<InvestigationChapterId>();
  const issues: InvestigationAnalysisIssue[] = [];
  for (let chapterCount = 0; chapterCount < manifest.chapters.length; chapterCount += 1) {
    reachedChapters.add(state.chapterId);
    state = exhaustChapter(manifest, state);
    const chapter = manifest.chapters.find((candidate) => candidate.id === state.chapterId);
    if (!chapter) break;
    const readiness = evaluateInvestigationChapter(manifest, state);
    if (chapter.nextChapterId && !readiness.ready) {
      issues.push({
        code: "chapter-deadlock",
        severity: "error",
        message:
          `Chapter '${chapter.id}' cannot satisfy required objectives under optimistic research/topic exploration: ` +
          readiness.missingRequiredObjectiveIds.join(", "),
      });
      break;
    }
    const advanced = advanceInvestigationChapter(manifest, state);
    if (advanced.chapterId === state.chapterId) break;
    state = advanced;
  }

  for (const fact of manifest.facts) {
    if (!state.discoveredFactIds.includes(fact.id)) {
      issues.push({ code: "unreachable-fact", severity: "warning", message: `Fact '${fact.id}' is unreachable in optimistic investigation exploration.` });
    }
  }
  for (const topic of manifest.topics) {
    if (!state.availableTopicIds.includes(topic.id) && !state.usedTopicIds.includes(topic.id)) {
      issues.push({ code: "unreachable-topic", severity: "warning", message: `Topic '${topic.id}' is never discovered.` });
    }
  }
  for (const source of manifest.researchSources) {
    if (!state.usedSourceIds.includes(source.id)) {
      issues.push({ code: "unreachable-source", severity: "warning", message: `Research source '${source.id}' is never usable.` });
    }
  }

  return {
    ready: !issues.some((issue) => issue.severity === "error"),
    reachedChapterIds: [...reachedChapters].sort((left, right) => left.localeCompare(right)),
    reachedFactIds: state.discoveredFactIds,
    reachedTopicIds: [...new Set([...state.availableTopicIds, ...state.usedTopicIds])].sort((left, right) => left.localeCompare(right)) as InvestigationTopicId[],
    usedSourceIds: state.usedSourceIds,
    finalState: state,
    issues: issues.sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
  };
};
