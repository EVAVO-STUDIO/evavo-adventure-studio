import type {
  Actor,
  AdventureProject,
  Id,
} from "@evavo/adventure-project-schema";
import { validateEditableActor, type ActorAnimationIssue } from "./index.js";

export type ActorProjectIntegrationIssueCode =
  | "actor-not-in-project"
  | "project-id-collision"
  | "actor-animation-invalid"
  | "missing-dialogue-animation-state"
  | "missing-sequence-animation-state"
  | "missing-sequence-animation-facing"
  | "missing-arrival-facing";

export interface ActorProjectIntegrationIssue {
  readonly severity: "error";
  readonly code: ActorProjectIntegrationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly actorIssue?: ActorAnimationIssue;
}

export class ActorProjectIntegrationError extends Error {
  readonly issues: readonly ActorProjectIntegrationIssue[];

  constructor(issues: readonly ActorProjectIntegrationIssue[]) {
    super(
      `Actor project integration failed with ${issues.length} issue(s): ${
        issues[0]?.message ?? "unknown error"
      }`,
    );
    this.name = "ActorProjectIntegrationError";
    this.issues = issues;
  }
}

const addIssue = (
  issues: ActorProjectIntegrationIssue[],
  code: ActorProjectIntegrationIssueCode,
  path: string,
  message: string,
  actorIssue?: ActorAnimationIssue,
): void => {
  issues.push({
    severity: "error",
    code,
    path,
    message,
    ...(actorIssue ? { actorIssue } : {}),
  });
};

const actorIds = (actor: Actor): readonly string[] => [
  actor.id,
  ...actor.frames.map((frame) => frame.id),
  ...actor.animations.map((animation) => animation.id),
];

const collectProjectIdsExcludingActor = (
  project: AdventureProject,
  actorId: Id<"actor">,
): ReadonlySet<string> => {
  const ids = new Set<string>([project.id]);
  for (const scene of project.scenes) {
    ids.add(scene.id);
    for (const area of scene.navigationAreas) ids.add(area.id);
    for (const band of scene.depthBands) ids.add(band.id);
    for (const occluder of scene.occluders) ids.add(occluder.id);
    for (const hotspot of scene.hotspots) {
      ids.add(hotspot.id);
      for (const interaction of hotspot.interactions) ids.add(interaction.id);
    }
    for (const entrance of scene.entrances) ids.add(entrance.id);
  }
  for (const actor of project.actors) {
    if (actor.id === actorId) continue;
    for (const id of actorIds(actor)) ids.add(id);
  }
  for (const dialogue of project.dialogues) {
    ids.add(dialogue.id);
    for (const node of dialogue.nodes) {
      ids.add(node.id);
      for (const line of node.lines) ids.add(line.id);
      for (const choice of node.choices) ids.add(choice.id);
    }
  }
  for (const sequence of project.sequences) {
    ids.add(sequence.id);
    for (const track of sequence.tracks) ids.add(track.id);
  }
  for (const asset of project.assets) ids.add(asset.id);
  for (const item of project.inventoryItems) ids.add(item.id);
  return ids;
};

const performanceStateSet = (actor: Actor): ReadonlySet<string> =>
  new Set(actor.animations.map((animation) => animation.state));

const performanceFacingSet = (actor: Actor): ReadonlySet<string> =>
  new Set(actor.animations.map((animation) => animation.facing));

const performancePairSet = (actor: Actor): ReadonlySet<string> =>
  new Set(
    actor.animations.map(
      (animation) => `${animation.state}\u0000${animation.facing}`,
    ),
  );

export const validateActorProjectIntegration = (
  project: AdventureProject,
  actor: Actor,
): readonly ActorProjectIntegrationIssue[] => {
  const issues: ActorProjectIntegrationIssue[] = [];
  const actorIndex = project.actors.findIndex(
    (candidate) => candidate.id === actor.id,
  );
  if (actorIndex < 0) {
    addIssue(
      issues,
      "actor-not-in-project",
      "actor.id",
      `Actor '${actor.id}' does not exist in project '${project.id}'.`,
    );
    return issues;
  }

  for (const actorIssue of validateEditableActor(actor)) {
    addIssue(
      issues,
      "actor-animation-invalid",
      `actor.${actorIssue.path}`,
      actorIssue.message,
      actorIssue,
    );
  }

  const reserved = collectProjectIdsExcludingActor(project, actor.id);
  for (const id of actorIds(actor)) {
    if (reserved.has(id)) {
      addIssue(
        issues,
        "project-id-collision",
        "actor",
        `Actor data ID '${id}' collides with another project entity.`,
      );
    }
  }

  const states = performanceStateSet(actor);
  const facings = performanceFacingSet(actor);
  const pairs = performancePairSet(actor);

  project.dialogues.forEach((dialogue, dialogueIndex) => {
    dialogue.nodes.forEach((node, nodeIndex) => {
      node.lines.forEach((line, lineIndex) => {
        if (
          line.speakerId === actor.id &&
          line.animationState &&
          !states.has(line.animationState)
        ) {
          addIssue(
            issues,
            "missing-dialogue-animation-state",
            `dialogues[${dialogueIndex}].nodes[${nodeIndex}].lines[${lineIndex}].animationState`,
            `Dialogue line '${line.id}' requests missing actor state '${line.animationState}'.`,
          );
        }
      });
    });
  });

  project.sequences.forEach((sequence, sequenceIndex) => {
    sequence.tracks.forEach((track, trackIndex) => {
      track.cues.forEach((cue, cueIndex) => {
        const cuePath = `sequences[${sequenceIndex}].tracks[${trackIndex}].cues[${cueIndex}]`;
        if (
          cue.kind === "speech" &&
          cue.speakerId === actor.id &&
          cue.animationState &&
          !states.has(cue.animationState)
        ) {
          addIssue(
            issues,
            "missing-sequence-animation-state",
            `${cuePath}.animationState`,
            `Sequence speech requests missing actor state '${cue.animationState}'.`,
          );
        }
        if (cue.kind === "actor-animation" && cue.actorId === actor.id) {
          if (!states.has(cue.animationState)) {
            addIssue(
              issues,
              "missing-sequence-animation-state",
              `${cuePath}.animationState`,
              `Sequence animation requests missing actor state '${cue.animationState}'.`,
            );
          } else if (
            cue.facing &&
            !pairs.has(`${cue.animationState}\u0000${cue.facing}`)
          ) {
            addIssue(
              issues,
              "missing-sequence-animation-facing",
              `${cuePath}.facing`,
              `Actor '${actor.id}' has no '${cue.animationState}' clip facing '${cue.facing}'.`,
            );
          }
        }
        if (
          cue.kind === "actor-move" &&
          cue.actorId === actor.id &&
          cue.faceOnArrival &&
          !facings.has(cue.faceOnArrival)
        ) {
          addIssue(
            issues,
            "missing-arrival-facing",
            `${cuePath}.faceOnArrival`,
            `Actor '${actor.id}' has no animation facing '${cue.faceOnArrival}' for arrival.`,
          );
        }
      });
    });
  });

  return issues;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const replaceActorInProject = (
  project: AdventureProject,
  actor: Actor,
): AdventureProject => {
  const issues = validateActorProjectIntegration(project, actor);
  if (issues.length > 0) throw new ActorProjectIntegrationError(issues);
  const actorIndex = project.actors.findIndex(
    (candidate) => candidate.id === actor.id,
  );
  if (actorIndex < 0) {
    throw new ActorProjectIntegrationError([
      {
        severity: "error",
        code: "actor-not-in-project",
        path: "actor.id",
        message: `Actor '${actor.id}' does not exist in project '${project.id}'.`,
      },
    ]);
  }
  return {
    ...project,
    actors: [
      ...project.actors.slice(0, actorIndex).map(cloneJson),
      cloneJson(actor),
      ...project.actors.slice(actorIndex + 1).map(cloneJson),
    ],
  };
};

export const mergeActorsIntoProject = (
  project: AdventureProject,
  actors: readonly Actor[],
): AdventureProject => {
  let next = project;
  const actorById = new Map(actors.map((actor) => [actor.id as string, actor]));
  for (const canonical of project.actors) {
    const edited = actorById.get(canonical.id);
    if (edited) next = replaceActorInProject(next, edited);
  }
  const unknown = actors.find(
    (actor) => !project.actors.some((candidate) => candidate.id === actor.id),
  );
  if (unknown) {
    throw new ActorProjectIntegrationError([
      {
        severity: "error",
        code: "actor-not-in-project",
        path: "actors",
        message: `Actor '${unknown.id}' does not exist in project '${project.id}'.`,
      },
    ]);
  }
  return next;
};
