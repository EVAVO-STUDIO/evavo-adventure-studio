import {
  openCaseInvestigationBindings,
  openCaseProject,
  openCaseRoomScripts,
  openCaseRuntimeInvestigation,
  validateOpenCaseRuntimeSource,
} from "./open-case-runtime-source.js";

export type OpenCasePackagedReadinessPhase =
  | "source"
  | "semantic-bindings"
  | "room-scripts"
  | "compiled-bundle"
  | "playtest-evidence";

export interface OpenCasePackagedReadinessIssue {
  readonly phase: OpenCasePackagedReadinessPhase;
  readonly code: string;
  readonly message: string;
}

export interface OpenCasePackagedEvidence {
  readonly compiledBundleReady?: boolean;
  readonly successReplayReady?: boolean;
  readonly failureReplayReady?: boolean;
  readonly nativeScreenshotsReady?: boolean;
}

export interface OpenCasePackagedReadiness {
  readonly authoredReady: boolean;
  readonly packagedPlayableReady: boolean;
  readonly issues: readonly OpenCasePackagedReadinessIssue[];
}

const projectInteractions = () =>
  openCaseProject.scenes.flatMap((scene) => scene.hotspots.flatMap((hotspot) => hotspot.interactions));

const dialogueChoices = () =>
  openCaseProject.dialogues.flatMap((dialogue) => dialogue.nodes.flatMap((node) => node.choices));

const validateBindings = (): readonly OpenCasePackagedReadinessIssue[] => {
  const issues: OpenCasePackagedReadinessIssue[] = [];
  const interactions = new Map(projectInteractions().map((interaction) => [interaction.id as string, interaction] as const));
  const choices = new Map(dialogueChoices().map((choice) => [choice.id as string, choice] as const));
  const factIds = new Set(openCaseRuntimeInvestigation.facts.map((fact) => fact.id));
  const topicIds = new Set(openCaseRuntimeInvestigation.topics.map((topic) => topic.id));
  const sourceIds = new Set(openCaseRuntimeInvestigation.researchSources.map((source) => source.id));

  for (const binding of openCaseInvestigationBindings.interactions) {
    const interaction = interactions.get(binding.interactionId);
    if (!interaction) {
      issues.push({
        phase: "semantic-bindings",
        code: "unknown-interaction",
        message: `Investigation binding references missing interaction '${binding.interactionId}'.`,
      });
    } else if (interaction.once !== true) {
      issues.push({
        phase: "semantic-bindings",
        code: "binding-source-not-one-shot",
        message: `Investigation binding '${binding.interactionId}' must be one-shot.`,
      });
    }
    for (const effect of binding.effects) {
      if (effect.kind === "use-research-source" && !sourceIds.has(effect.sourceId)) {
        issues.push({
          phase: "semantic-bindings",
          code: "unknown-source",
          message: `Binding references missing source '${effect.sourceId}'.`,
        });
      }
      if (effect.kind === "discover-facts") {
        for (const factId of effect.factIds) {
          if (!factIds.has(factId)) {
            issues.push({
              phase: "semantic-bindings",
              code: "unknown-fact",
              message: `Binding references missing fact '${factId}'.`,
            });
          }
        }
      }
      if (effect.kind === "use-topic" && !topicIds.has(effect.topicId)) {
        issues.push({
          phase: "semantic-bindings",
          code: "unknown-topic",
          message: `Binding references missing topic '${effect.topicId}'.`,
        });
      }
    }
  }

  for (const binding of openCaseInvestigationBindings.dialogueChoices) {
    const choice = choices.get(binding.choiceId);
    if (!choice) {
      issues.push({
        phase: "semantic-bindings",
        code: "unknown-dialogue-choice",
        message: `Investigation binding references missing dialogue choice '${binding.choiceId}'.`,
      });
    } else if (choice.once !== true) {
      issues.push({
        phase: "semantic-bindings",
        code: "binding-choice-not-one-shot",
        message: `Investigation dialogue binding '${binding.choiceId}' must be one-shot.`,
      });
    }
    for (const effect of binding.effects) {
      if (effect.kind === "use-topic" && !topicIds.has(effect.topicId)) {
        issues.push({
          phase: "semantic-bindings",
          code: "unknown-topic",
          message: `Dialogue binding references missing topic '${effect.topicId}'.`,
        });
      }
    }
  }
  return issues;
};

const validateRoomScripts = (): readonly OpenCasePackagedReadinessIssue[] => {
  const issues: OpenCasePackagedReadinessIssue[] = [];
  const sceneIds = new Set(openCaseProject.scenes.map((scene) => scene.id as string));
  const entranceIds = new Map(
    openCaseProject.scenes.map((scene) => [
      scene.id as string,
      new Set(scene.entrances.map((entrance) => entrance.id as string)),
    ] as const),
  );
  const sequenceIds = new Set(openCaseProject.sequences.map((sequence) => sequence.id as string));
  const interactionIds = new Set(projectInteractions().map((interaction) => interaction.id as string));
  const choiceIds = new Set(dialogueChoices().map((choice) => choice.id as string));

  for (const script of openCaseRoomScripts.scripts) {
    if (!sceneIds.has(script.sceneId)) {
      issues.push({ phase: "room-scripts", code: "unknown-scene", message: `Room script '${script.id}' references '${script.sceneId}'.` });
    }
    if (script.trigger.kind === "interaction-consumed" && !interactionIds.has(script.trigger.interactionId)) {
      issues.push({
        phase: "room-scripts",
        code: "unknown-trigger-interaction",
        message: `Room script '${script.id}' references missing interaction '${script.trigger.interactionId}'.`,
      });
    }
    if (script.trigger.kind === "dialogue-choice-consumed" && !choiceIds.has(script.trigger.choiceId)) {
      issues.push({
        phase: "room-scripts",
        code: "unknown-trigger-choice",
        message: `Room script '${script.id}' references missing dialogue choice '${script.trigger.choiceId}'.`,
      });
    }
    if (script.cutaway) {
      if (!sceneIds.has(script.cutaway.sceneId)) {
        issues.push({ phase: "room-scripts", code: "unknown-cutaway-scene", message: `Cutaway scene '${script.cutaway.sceneId}' is missing.` });
      }
      if (!entranceIds.get(script.cutaway.sceneId)?.has(script.cutaway.entranceId)) {
        issues.push({ phase: "room-scripts", code: "unknown-cutaway-entrance", message: `Cutaway entrance '${script.cutaway.entranceId}' is missing.` });
      }
      if (!sequenceIds.has(script.cutaway.sequenceId)) {
        issues.push({ phase: "room-scripts", code: "unknown-cutaway-sequence", message: `Cutaway sequence '${script.cutaway.sequenceId}' is missing.` });
      }
    }
  }
  return issues;
};

export const evaluateOpenCasePackagedReadiness = (
  evidence: OpenCasePackagedEvidence = {},
): OpenCasePackagedReadiness => {
  const issues: OpenCasePackagedReadinessIssue[] = [
    ...validateOpenCaseRuntimeSource().issues.map((message) => ({
      phase: "source" as const,
      code: "source-invalid",
      message,
    })),
    ...validateBindings(),
    ...validateRoomScripts(),
  ];

  const authoredReady = issues.length === 0;
  if (!evidence.compiledBundleReady) {
    issues.push({
      phase: "compiled-bundle",
      code: "compiled-bundle-missing",
      message: "A parsed compiled Runtime Bundle has not yet been retained for Open Case.",
    });
  }
  if (!evidence.successReplayReady) {
    issues.push({
      phase: "playtest-evidence",
      code: "success-replay-missing",
      message: "A deterministic successful case replay has not yet been retained.",
    });
  }
  if (!evidence.failureReplayReady) {
    issues.push({
      phase: "playtest-evidence",
      code: "failure-replay-missing",
      message: "A deterministic procedural failure/recovery replay has not yet been retained.",
    });
  }
  if (!evidence.nativeScreenshotsReady) {
    issues.push({
      phase: "playtest-evidence",
      code: "native-screenshots-missing",
      message: "Native-resolution packaged screenshots have not yet been retained.",
    });
  }

  return {
    authoredReady,
    packagedPlayableReady:
      authoredReady &&
      evidence.compiledBundleReady === true &&
      evidence.successReplayReady === true &&
      evidence.failureReplayReady === true &&
      evidence.nativeScreenshotsReady === true,
    issues,
  };
};
